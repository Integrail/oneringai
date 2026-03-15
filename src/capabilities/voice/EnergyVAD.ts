/**
 * EnergyVAD - Simple energy-based Voice Activity Detection
 *
 * Detects speech start/end based on RMS energy threshold and timing.
 * Suitable for telephony audio where background noise is relatively low.
 *
 * Can be replaced with more sophisticated VAD (WebRTC VAD, Silero, etc.)
 * by implementing IVoiceActivityDetector.
 */

import type { AudioFrame, IVoiceActivityDetector, VADEvent, EnergyVADConfig } from './types.js';

const DEFAULTS: Required<EnergyVADConfig> = {
  energyThreshold: 0.01,
  speechFramesThreshold: 3,
  silenceTimeout: 1500,
  minSpeechDuration: 250,
};

export class EnergyVAD implements IVoiceActivityDetector {
  private config: Required<EnergyVADConfig>;
  private isSpeaking = false;
  private consecutiveSpeechFrames = 0;
  private speechStartTime = 0;
  private lastSpeechTime = 0;

  constructor(config?: EnergyVADConfig) {
    this.config = { ...DEFAULTS, ...config };
  }

  process(frame: AudioFrame): VADEvent {
    const energy = this.calculateRMS(frame);
    const now = frame.timestamp;
    const isSpeechFrame = energy > this.config.energyThreshold;

    if (isSpeechFrame) {
      this.lastSpeechTime = now;
      this.consecutiveSpeechFrames++;

      if (!this.isSpeaking && this.consecutiveSpeechFrames >= this.config.speechFramesThreshold) {
        this.isSpeaking = true;
        this.speechStartTime = now;
        return 'speech_start';
      }
    } else {
      this.consecutiveSpeechFrames = 0;

      if (this.isSpeaking) {
        const silenceDuration = now - this.lastSpeechTime;
        const speechDuration = now - this.speechStartTime;

        if (
          silenceDuration >= this.config.silenceTimeout &&
          speechDuration >= this.config.minSpeechDuration
        ) {
          this.isSpeaking = false;
          return 'speech_end';
        }
      }
    }

    return null;
  }

  reset(): void {
    this.isSpeaking = false;
    this.consecutiveSpeechFrames = 0;
    this.speechStartTime = 0;
    this.lastSpeechTime = 0;
  }

  /**
   * Calculate RMS (Root Mean Square) energy of an audio frame.
   * Handles PCM 16-bit signed little-endian. For μ-law/a-law,
   * the frame should be transcoded to PCM first.
   */
  private calculateRMS(frame: AudioFrame): number {
    const { audio, encoding } = frame;

    if (encoding !== 'pcm_s16le') {
      // For non-PCM formats, use raw byte energy as rough approximation.
      // In practice, the adapter should transcode to PCM before VAD.
      let sum = 0;
      for (let i = 0; i < audio.length; i++) {
        const val = (audio[i]! - 128) / 128;
        sum += val * val;
      }
      return Math.sqrt(sum / audio.length);
    }

    // PCM 16-bit signed little-endian
    const samples = audio.length / 2;
    if (samples === 0) return 0;

    let sum = 0;
    for (let i = 0; i < audio.length; i += 2) {
      const sample = audio.readInt16LE(i) / 32768;
      sum += sample * sample;
    }

    return Math.sqrt(sum / samples);
  }
}
