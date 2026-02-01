/**
 * VideoDisplay - Shows video generation progress and completed video with actions
 */

import React, { useState, useRef, useEffect } from 'react';
import { ProgressBar } from 'react-bootstrap';
import { Video, Download, AlertCircle, Play, Pause } from 'lucide-react';

export type VideoStatus = 'idle' | 'pending' | 'processing' | 'completed' | 'failed';

interface VideoDisplayProps {
  status: VideoStatus;
  progress: number; // 0-100
  videoData: string | null; // base64 or URL
  videoUrl: string | null; // Direct URL from API
  error: string | null;
  onDownload?: () => void;
}

export function VideoDisplay({
  status,
  progress,
  videoData,
  videoUrl,
  error,
  onDownload,
}: VideoDisplayProps): React.ReactElement {
  const [isPlaying, setIsPlaying] = useState(false);
  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);

  // Convert base64 to blob URL when videoData changes
  // This is needed because CSP blocks data: URLs for media
  useEffect(() => {
    if (videoData && !videoData.startsWith('http')) {
      // Clean base64 data - remove data URL prefix if present
      const base64 = videoData.startsWith('data:')
        ? videoData.split(',')[1]
        : videoData;

      try {
        // Convert base64 to blob
        const byteCharacters = atob(base64);
        const byteNumbers = new Array(byteCharacters.length);
        for (let i = 0; i < byteCharacters.length; i++) {
          byteNumbers[i] = byteCharacters.charCodeAt(i);
        }
        const byteArray = new Uint8Array(byteNumbers);
        const blob = new Blob([byteArray], { type: 'video/mp4' });
        const url = URL.createObjectURL(blob);
        setBlobUrl(url);

        // Cleanup previous blob URL
        return () => {
          URL.revokeObjectURL(url);
        };
      } catch (err) {
        console.error('Failed to convert video to blob:', err);
      }
    } else {
      setBlobUrl(null);
    }
  }, [videoData]);

  const handlePlayPause = () => {
    if (videoRef.current) {
      if (isPlaying) {
        videoRef.current.pause();
      } else {
        videoRef.current.play();
      }
      setIsPlaying(!isPlaying);
    }
  };

  const handleDownload = () => {
    if (onDownload) {
      onDownload();
      return;
    }

    // Fallback: try to download directly using blob URL
    const url = getVideoSrc();
    if (!url) return;

    const link = document.createElement('a');
    link.href = url;
    link.download = `generated-video-${Date.now()}.mp4`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const getVideoSrc = (): string => {
    if (videoUrl) return videoUrl;
    if (blobUrl) return blobUrl;
    if (videoData?.startsWith('http')) return videoData;
    return '';
  };

  const getStatusMessage = (): string => {
    switch (status) {
      case 'pending':
        return 'Starting video generation...';
      case 'processing':
        return `Generating video... ${progress}%`;
      case 'completed':
        return 'Video ready!';
      case 'failed':
        return 'Generation failed';
      default:
        return '';
    }
  };

  const renderContent = () => {
    // Error state
    if (error) {
      return (
        <div className="error-message">
          <AlertCircle size={20} className="error-message__icon" />
          <span className="error-message__text">{error}</span>
        </div>
      );
    }

    // Generating state
    if (status === 'pending' || status === 'processing') {
      return (
        <div className="video-display__loading">
          <div className="video-display__loading-icon">
            <Video size={32} />
          </div>
          <span className="video-display__loading-text">{getStatusMessage()}</span>
          <div className="video-display__progress">
            <ProgressBar
              now={status === 'pending' ? 0 : progress}
              animated={status === 'processing'}
              striped={status === 'processing'}
              variant="primary"
            />
          </div>
          <span className="video-display__loading-hint">
            Video generation may take several minutes
          </span>
        </div>
      );
    }

    // Completed state with video
    if (status === 'completed' && (videoData || videoUrl)) {
      return (
        <div className="video-display__player-wrapper">
          <video
            ref={videoRef}
            className="video-display__video"
            src={getVideoSrc()}
            controls
            onPlay={() => setIsPlaying(true)}
            onPause={() => setIsPlaying(false)}
            onEnded={() => setIsPlaying(false)}
          />
          <button
            className="video-display__play-overlay"
            onClick={handlePlayPause}
            type="button"
            style={{ display: isPlaying ? 'none' : 'flex' }}
          >
            <Play size={48} />
          </button>
        </div>
      );
    }

    // Empty state
    return (
      <div className="video-display__empty">
        <div className="video-display__empty-icon">
          <Video size={24} />
        </div>
        <span className="video-display__empty-text">
          Your generated video will appear here
        </span>
      </div>
    );
  };

  return (
    <div className="video-display">
      <div className="video-display__container">
        {renderContent()}
      </div>

      {status === 'completed' && (videoData || videoUrl) && (
        <div className="video-display__actions">
          <button
            className="video-display__action"
            onClick={handleDownload}
            type="button"
          >
            <Download size={16} />
            Download
          </button>
        </div>
      )}
    </div>
  );
}
