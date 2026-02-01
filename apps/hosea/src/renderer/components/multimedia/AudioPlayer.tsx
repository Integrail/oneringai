/**
 * AudioPlayer - Audio playback component for TTS output
 */

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Play, Pause, Download, Volume2, AlertTriangle, Loader2 } from 'lucide-react';

interface AudioPlayerProps {
  audioData: string | null; // base64 encoded audio
  format: string; // 'mp3', 'wav', etc.
  isLoading?: boolean;
  error?: string | null;
}

const formatTime = (seconds: number): string => {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
};

const getMimeType = (format: string): string => {
  const mimeTypes: Record<string, string> = {
    mp3: 'audio/mpeg',
    wav: 'audio/wav',
    opus: 'audio/opus',
    aac: 'audio/aac',
    flac: 'audio/flac',
    ogg: 'audio/ogg',
    pcm: 'audio/pcm',
  };
  return mimeTypes[format.toLowerCase()] || 'audio/mpeg';
};

export function AudioPlayer({
  audioData,
  format,
  isLoading = false,
  error = null,
}: AudioPlayerProps): React.ReactElement {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);

  // Create blob URL from base64 data
  useEffect(() => {
    if (audioData) {
      // Decode base64 and create blob
      const byteCharacters = atob(audioData);
      const byteNumbers = new Array(byteCharacters.length);
      for (let i = 0; i < byteCharacters.length; i++) {
        byteNumbers[i] = byteCharacters.charCodeAt(i);
      }
      const byteArray = new Uint8Array(byteNumbers);
      const blob = new Blob([byteArray], { type: getMimeType(format) });
      const url = URL.createObjectURL(blob);
      setAudioUrl(url);

      // Auto-play when new audio is generated
      return () => {
        URL.revokeObjectURL(url);
      };
    } else {
      setAudioUrl(null);
    }
  }, [audioData, format]);

  // Reset playback state when audio changes
  useEffect(() => {
    setIsPlaying(false);
    setCurrentTime(0);
    setDuration(0);
  }, [audioData]);

  const handlePlayPause = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) return;

    if (isPlaying) {
      audio.pause();
    } else {
      audio.play();
    }
    setIsPlaying(!isPlaying);
  }, [isPlaying]);

  const handleTimeUpdate = useCallback(() => {
    const audio = audioRef.current;
    if (audio) {
      setCurrentTime(audio.currentTime);
    }
  }, []);

  const handleLoadedMetadata = useCallback(() => {
    const audio = audioRef.current;
    if (audio) {
      setDuration(audio.duration);
    }
  }, []);

  const handleEnded = useCallback(() => {
    setIsPlaying(false);
    setCurrentTime(0);
    if (audioRef.current) {
      audioRef.current.currentTime = 0;
    }
  }, []);

  const handleSeek = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const audio = audioRef.current;
    if (audio) {
      const time = parseFloat(e.target.value);
      audio.currentTime = time;
      setCurrentTime(time);
    }
  }, []);

  const handleDownload = useCallback(() => {
    if (!audioUrl) return;

    const link = document.createElement('a');
    link.href = audioUrl;
    link.download = `speech.${format}`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }, [audioUrl, format]);

  // Loading state
  if (isLoading) {
    return (
      <div className="audio-player">
        <div className="audio-player__container audio-player__container--loading">
          <div className="audio-player__loading">
            <Loader2 size={32} className="audio-player__loading-spinner" />
            <span className="audio-player__loading-text">Synthesizing speech...</span>
          </div>
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="audio-player">
        <div className="audio-player__container audio-player__container--error">
          <div className="audio-player__error">
            <AlertTriangle size={24} />
            <span className="audio-player__error-text">{error}</span>
          </div>
        </div>
      </div>
    );
  }

  // Empty state
  if (!audioData) {
    return (
      <div className="audio-player">
        <div className="audio-player__container audio-player__container--empty">
          <div className="audio-player__empty">
            <div className="audio-player__empty-icon">
              <Volume2 size={24} />
            </div>
            <span className="audio-player__empty-text">
              Enter text and click Generate to synthesize speech
            </span>
          </div>
        </div>
      </div>
    );
  }

  const progress = duration > 0 ? (currentTime / duration) * 100 : 0;

  return (
    <div className="audio-player">
      <div className="audio-player__container">
        {audioUrl && (
          <audio
            ref={audioRef}
            src={audioUrl}
            onTimeUpdate={handleTimeUpdate}
            onLoadedMetadata={handleLoadedMetadata}
            onEnded={handleEnded}
          />
        )}

        <div className="audio-player__controls">
          <button
            type="button"
            className="audio-player__play-button"
            onClick={handlePlayPause}
            aria-label={isPlaying ? 'Pause' : 'Play'}
          >
            {isPlaying ? <Pause size={24} /> : <Play size={24} />}
          </button>

          <div className="audio-player__progress-container">
            <input
              type="range"
              className="audio-player__progress"
              min={0}
              max={duration || 100}
              value={currentTime}
              onChange={handleSeek}
              style={{
                background: `linear-gradient(to right, var(--color-primary) ${progress}%, var(--color-gray-300) ${progress}%)`,
              }}
            />
            <div className="audio-player__time">
              <span>{formatTime(currentTime)}</span>
              <span>{formatTime(duration)}</span>
            </div>
          </div>

          <button
            type="button"
            className="audio-player__download-button"
            onClick={handleDownload}
            aria-label="Download audio"
            title="Download audio"
          >
            <Download size={20} />
          </button>
        </div>
      </div>

      <div className="audio-player__actions">
        <button
          type="button"
          className="audio-player__action"
          onClick={handleDownload}
        >
          <Download size={16} />
          Download {format.toUpperCase()}
        </button>
      </div>
    </div>
  );
}
