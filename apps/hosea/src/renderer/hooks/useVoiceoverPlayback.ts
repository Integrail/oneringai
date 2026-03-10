/**
 * useVoiceoverPlayback - Browser-side ordered audio playback for voice pseudo-streaming
 *
 * Supports two modes:
 * - HTML5 Audio: For encoded formats (MP3, WAV, etc.) — buffers by chunkIndex, plays sequentially
 * - PCMStreamPlayer: For raw PCM (24kHz 16-bit LE) — ring buffer + ScriptProcessorNode
 */

import { useState, useEffect, useRef, useCallback } from 'react';

interface VoiceChunkDetail {
  instanceId: string;
  chunkIndex: number;
  subIndex?: number;
  audioBase64: string;
  format: string;
  durationSeconds?: number;
  text: string;
}

export interface PlaybackState {
  isPlaying: boolean;
  skipCurrent: () => void;
}

// =============================================================================
// PCMStreamPlayer - AudioBufferSourceNode scheduling with browser-native resampling
//
// OpenAI TTS PCM: 24kHz, 16-bit signed, little-endian, mono.
// We create AudioBuffers at 24000Hz sample rate on a default-rate AudioContext.
// The browser's built-in high-quality resampler upsamples to the output rate.
// =============================================================================

const PCM_SAMPLE_RATE = 24000;
const INITIAL_BUFFER_MS = 200;

class PCMStreamPlayer {
  private ctx: AudioContext;
  private nextStartTime = 0;
  private started = false;
  private _isPlaying = false;
  private onEndCallback?: () => void;
  private finalReceived = false;
  private scheduledCount = 0;
  // Accumulate initial chunks before starting playback
  private pendingSamples: Float32Array[] = [];
  private pendingSampleCount = 0;
  private initialSampleThreshold: number;

  constructor() {
    // Use default system sample rate — browser resamples from 24kHz automatically
    this.ctx = new AudioContext();
    // How many PCM samples (at 24kHz) to buffer before starting
    this.initialSampleThreshold = Math.floor((INITIAL_BUFFER_MS / 1000) * PCM_SAMPLE_RATE);
  }

  get isPlaying(): boolean {
    return this._isPlaying;
  }

  set onEnd(cb: () => void) {
    this.onEndCallback = cb;
  }

  /**
   * Enqueue PCM data (base64-encoded 16-bit signed LE at 24kHz).
   */
  enqueue(pcmBase64: string): void {
    const float32 = this.decodeBase64PCM(pcmBase64);
    if (!float32 || float32.length === 0) return;

    if (!this.started) {
      // Accumulate until we have enough for smooth start
      this.pendingSamples.push(float32);
      this.pendingSampleCount += float32.length;

      if (this.pendingSampleCount >= this.initialSampleThreshold) {
        this.flushAndStart();
      }
    } else {
      this.scheduleBuffer(float32);
    }
  }

  /**
   * Signal that all data for the current stream has been received.
   */
  markChunkComplete(): void {
    this.finalReceived = true;
    // Flush even if we haven't hit the threshold (short utterance)
    if (!this.started && this.pendingSamples.length > 0) {
      this.flushAndStart();
    }
    // If nothing was scheduled, signal end immediately
    if (this.scheduledCount === 0) {
      this._isPlaying = false;
      this.onEndCallback?.();
    }
  }

  private flushAndStart(): void {
    this.started = true;
    this._isPlaying = true;
    this.nextStartTime = this.ctx.currentTime;

    // Merge all pending into one buffer for a clean start
    if (this.pendingSamples.length === 1) {
      this.scheduleBuffer(this.pendingSamples[0]);
    } else {
      const merged = new Float32Array(this.pendingSampleCount);
      let offset = 0;
      for (const buf of this.pendingSamples) {
        merged.set(buf, offset);
        offset += buf.length;
      }
      this.scheduleBuffer(merged);
    }
    this.pendingSamples = [];
    this.pendingSampleCount = 0;
  }

  /**
   * Decode base64 PCM to Float32Array.
   * Uses DataView.getInt16 for guaranteed little-endian reading.
   */
  private decodeBase64PCM(pcmBase64: string): Float32Array | null {
    const binaryStr = atob(pcmBase64);
    const len = binaryStr.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
      bytes[i] = binaryStr.charCodeAt(i);
    }

    const evenLen = len & ~1;
    if (evenLen === 0) return null;

    const view = new DataView(bytes.buffer, bytes.byteOffset, evenLen);
    const sampleCount = evenLen / 2;
    const float32 = new Float32Array(sampleCount);

    for (let i = 0; i < sampleCount; i++) {
      float32[i] = view.getInt16(i * 2, true) / 32768;
    }

    return float32;
  }

  /**
   * Schedule a Float32Array for gapless playback.
   * Creates AudioBuffer at 24kHz — browser resamples to output rate.
   */
  private scheduleBuffer(float32: Float32Array): void {
    if (float32.length === 0) return;

    // Create buffer at PCM_SAMPLE_RATE (24kHz) — browser auto-resamples to ctx.sampleRate
    const audioBuffer = this.ctx.createBuffer(1, float32.length, PCM_SAMPLE_RATE);
    audioBuffer.copyToChannel(float32, 0);

    const source = this.ctx.createBufferSource();
    source.buffer = audioBuffer;
    source.connect(this.ctx.destination);

    // Schedule for gapless playback
    const now = this.ctx.currentTime;
    if (this.nextStartTime < now) {
      this.nextStartTime = now;
    }
    source.start(this.nextStartTime);
    this.nextStartTime += audioBuffer.duration;
    this.scheduledCount++;

    source.onended = () => {
      this.scheduledCount--;
      if (this.scheduledCount === 0 && this.finalReceived) {
        this._isPlaying = false;
        this.onEndCallback?.();
      }
    };
  }

  stop(): void {
    this.ctx.close().catch(() => {});
    this._isPlaying = false;
    this.started = false;
    this.pendingSamples = [];
    this.pendingSampleCount = 0;
    this.scheduledCount = 0;
    this.finalReceived = false;
  }

  reset(): void {
    this.ctx.close().catch(() => {});
    this.ctx = new AudioContext();
    this.nextStartTime = 0;
    this.started = false;
    this._isPlaying = false;
    this.pendingSamples = [];
    this.pendingSampleCount = 0;
    this.scheduledCount = 0;
    this.finalReceived = false;
  }
}

// =============================================================================
// Hook
// =============================================================================

export function useVoiceoverPlayback(
  instanceId: string | null,
  enabled: boolean,
): PlaybackState {
  const [isPlaying, setIsPlaying] = useState(false);

  // Refs for mutable state that doesn't need re-renders
  const nextPlayIndex = useRef(0);
  const buffer = useRef<Map<number, VoiceChunkDetail>>(new Map());
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const playingRef = useRef(false);
  const enabledRef = useRef(enabled);
  const instanceIdRef = useRef(instanceId);
  // When true, ignore incoming chunks until a new message starts (chunkIndex 0)
  const mutedRef = useRef(false);
  // PCM streaming player
  const pcmPlayerRef = useRef<PCMStreamPlayer | null>(null);
  // Track current format mode: 'pcm' for streaming, anything else for HTML5 Audio
  const formatModeRef = useRef<string | null>(null);

  // Keep refs in sync
  enabledRef.current = enabled;
  instanceIdRef.current = instanceId;

  // Play the next chunk in sequence (HTML5 Audio path)
  const playNext = useCallback(() => {
    if (!enabledRef.current || mutedRef.current) {
      playingRef.current = false;
      setIsPlaying(false);
      return;
    }

    const chunk = buffer.current.get(nextPlayIndex.current);
    if (!chunk) {
      // No more chunks ready
      playingRef.current = false;
      setIsPlaying(false);
      return;
    }

    // Remove from buffer and advance index
    buffer.current.delete(nextPlayIndex.current);
    nextPlayIndex.current++;

    // Decode base64 → Blob → URL
    const byteChars = atob(chunk.audioBase64);
    const byteArray = new Uint8Array(byteChars.length);
    for (let i = 0; i < byteChars.length; i++) {
      byteArray[i] = byteChars.charCodeAt(i);
    }
    const mimeType = chunk.format === 'mp3' ? 'audio/mpeg'
      : chunk.format === 'opus' ? 'audio/opus'
      : chunk.format === 'wav' ? 'audio/wav'
      : chunk.format === 'aac' ? 'audio/aac'
      : chunk.format === 'flac' ? 'audio/flac'
      : `audio/${chunk.format}`;

    const blob = new Blob([byteArray], { type: mimeType });
    const url = URL.createObjectURL(blob);

    // Clean up previous audio element
    if (audioRef.current) {
      audioRef.current.pause();
      if (audioRef.current.src) {
        URL.revokeObjectURL(audioRef.current.src);
      }
    }

    const audio = new Audio(url);
    audioRef.current = audio;

    audio.onended = () => {
      URL.revokeObjectURL(url);
      playNext();
    };

    audio.onerror = () => {
      console.error(`Voice playback error for chunk ${chunk.chunkIndex}`);
      URL.revokeObjectURL(url);
      playNext(); // Skip errored chunk, continue with next
    };

    playingRef.current = true;
    setIsPlaying(true);
    console.log(`[VoicePlayback] Playing chunk ${nextPlayIndex.current - 1}, text="${chunk.text.slice(0, 40)}..."`);
    audio.play().catch((err) => {
      console.error('Audio play failed:', err);
      URL.revokeObjectURL(url);
      playNext();
    });
  }, []);

  // Skip current message audio: stop playback, discard buffer, mute until next message
  const skipCurrent = useCallback(() => {
    mutedRef.current = true;
    buffer.current.clear();
    nextPlayIndex.current = 0;

    // Stop HTML5 Audio
    if (audioRef.current) {
      audioRef.current.pause();
      if (audioRef.current.src) {
        URL.revokeObjectURL(audioRef.current.src);
      }
      audioRef.current = null;
    }

    // Stop PCM player
    if (pcmPlayerRef.current) {
      pcmPlayerRef.current.stop();
      pcmPlayerRef.current = null;
    }

    playingRef.current = false;
    setIsPlaying(false);
    formatModeRef.current = null;
  }, []);

  // Handle incoming voice chunks
  useEffect(() => {
    if (!enabled || !instanceId) return;

    const handleChunk = (e: Event) => {
      const detail = (e as CustomEvent<VoiceChunkDetail>).detail;
      if (detail.instanceId !== instanceIdRef.current) return;
      if (!enabledRef.current) return;

      // New message starts at chunkIndex 0 + first sub-chunk — un-mute and detect format
      if (detail.chunkIndex === 0 && (detail.subIndex === undefined || detail.subIndex === 0)) {
        mutedRef.current = false;
        buffer.current.clear();
        nextPlayIndex.current = 0;
        formatModeRef.current = detail.format;

        // Clean up previous PCM player
        if (pcmPlayerRef.current) {
          pcmPlayerRef.current.stop();
          pcmPlayerRef.current = null;
        }

        // Initialize PCM player if this is a PCM stream
        if (detail.format === 'pcm') {
          pcmPlayerRef.current = new PCMStreamPlayer();
          pcmPlayerRef.current.onEnd = () => {
            playingRef.current = false;
            setIsPlaying(false);
          };
        }
      }

      // If muted (user skipped current message), discard
      if (mutedRef.current) return;

      // PCM streaming path
      if (formatModeRef.current === 'pcm' && pcmPlayerRef.current) {
        if (detail.audioBase64 && detail.audioBase64.length > 0) {
          pcmPlayerRef.current.enqueue(detail.audioBase64);
          if (!playingRef.current) {
            playingRef.current = true;
            setIsPlaying(true);
          }
        }
        return;
      }

      // HTML5 Audio path (MP3, WAV, etc.)
      console.log(`[VoicePlayback] Received chunk ${detail.chunkIndex}, playing=${playingRef.current}, text="${detail.text.slice(0, 40)}..."`);
      buffer.current.set(detail.chunkIndex, detail);

      // If not currently playing, try to start
      if (!playingRef.current) {
        playNext();
      }
    };

    // Listen for voice:complete to mark PCM stream as done
    const handleComplete = (e: Event) => {
      const detail = (e as CustomEvent<{ instanceId: string }>).detail;
      if (detail.instanceId !== instanceIdRef.current) return;

      if (pcmPlayerRef.current) {
        pcmPlayerRef.current.markChunkComplete();
      }
    };

    window.addEventListener('hosea:voice-chunk', handleChunk);
    window.addEventListener('hosea:voice-complete', handleComplete);
    return () => {
      window.removeEventListener('hosea:voice-chunk', handleChunk);
      window.removeEventListener('hosea:voice-complete', handleComplete);
    };
  }, [enabled, instanceId, playNext]);

  // Clean up when disabled
  useEffect(() => {
    if (!enabled) {
      if (audioRef.current) {
        audioRef.current.pause();
        if (audioRef.current.src) {
          URL.revokeObjectURL(audioRef.current.src);
        }
        audioRef.current = null;
      }
      if (pcmPlayerRef.current) {
        pcmPlayerRef.current.stop();
        pcmPlayerRef.current = null;
      }
      buffer.current.clear();
      nextPlayIndex.current = 0;
      playingRef.current = false;
      mutedRef.current = false;
      formatModeRef.current = null;
      setIsPlaying(false);
    }
  }, [enabled]);

  // Reset on instanceId change
  useEffect(() => {
    buffer.current.clear();
    nextPlayIndex.current = 0;
    mutedRef.current = false;
    formatModeRef.current = null;
    if (audioRef.current) {
      audioRef.current.pause();
      if (audioRef.current.src) {
        URL.revokeObjectURL(audioRef.current.src);
      }
      audioRef.current = null;
    }
    if (pcmPlayerRef.current) {
      pcmPlayerRef.current.stop();
      pcmPlayerRef.current = null;
    }
    playingRef.current = false;
    setIsPlaying(false);
  }, [instanceId]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        if (audioRef.current.src) {
          URL.revokeObjectURL(audioRef.current.src);
        }
      }
      if (pcmPlayerRef.current) {
        pcmPlayerRef.current.stop();
      }
    };
  }, []);

  return { isPlaying, skipCurrent };
}
