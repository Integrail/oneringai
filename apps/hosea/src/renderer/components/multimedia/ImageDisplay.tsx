/**
 * ImageDisplay - Shows generated image with actions (download, copy)
 */

import React, { useState } from 'react';
import { Spinner } from 'react-bootstrap';
import { Image, Download, Copy, Check, AlertCircle } from 'lucide-react';

interface ImageDisplayProps {
  imageData: string | null; // base64 or URL
  isLoading: boolean;
  error: string | null;
  revisedPrompt?: string;
}

export function ImageDisplay({
  imageData,
  isLoading,
  error,
  revisedPrompt,
}: ImageDisplayProps): React.ReactElement {
  const [copied, setCopied] = useState(false);

  const handleDownload = () => {
    if (!imageData) return;

    // Create download link
    const link = document.createElement('a');

    if (imageData.startsWith('data:')) {
      // Base64 data URL
      link.href = imageData;
    } else if (imageData.startsWith('http')) {
      // URL - open in new tab (can't download directly due to CORS)
      window.open(imageData, '_blank');
      return;
    } else {
      // Raw base64 - use getImageSrc which handles cleaning and format detection
      link.href = getImageSrc();
    }

    // Determine file extension from MIME type
    const ext = getImageSrc().includes('image/jpeg') ? 'jpg'
      : getImageSrc().includes('image/webp') ? 'webp'
      : 'png';
    link.download = `generated-image-${Date.now()}.${ext}`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleCopy = async () => {
    if (!imageData) return;

    try {
      // Try to copy as image to clipboard
      if (imageData.startsWith('data:') || !imageData.startsWith('http')) {
        // Convert base64 to blob
        const base64 = imageData.startsWith('data:')
          ? imageData.split(',')[1]
          : imageData;
        const byteCharacters = atob(base64);
        const byteNumbers = new Array(byteCharacters.length);
        for (let i = 0; i < byteCharacters.length; i++) {
          byteNumbers[i] = byteCharacters.charCodeAt(i);
        }
        const byteArray = new Uint8Array(byteNumbers);
        const blob = new Blob([byteArray], { type: 'image/png' });

        await navigator.clipboard.write([
          new ClipboardItem({ 'image/png': blob }),
        ]);
      } else {
        // Copy URL
        await navigator.clipboard.writeText(imageData);
      }

      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy image:', err);
      // Fallback: copy as URL or base64 string
      await navigator.clipboard.writeText(imageData);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const getImageSrc = () => {
    if (!imageData) return '';
    if (imageData.startsWith('data:') || imageData.startsWith('http')) {
      return imageData;
    }
    // Clean the base64 data - remove any whitespace/newlines that might break the data URL
    const cleanedData = imageData.replace(/\s/g, '');

    // Detect image format from base64 magic bytes
    // PNG: iVBORw0KGgo, JPEG: /9j/, WebP: UklGR
    let mimeType = 'image/png';
    if (cleanedData.startsWith('/9j/')) {
      mimeType = 'image/jpeg';
    } else if (cleanedData.startsWith('UklGR')) {
      mimeType = 'image/webp';
    }
    return `data:${mimeType};base64,${cleanedData}`;
  };


  return (
    <div className="image-display">
      <div className="image-display__container">
        {isLoading ? (
          <div className="image-display__loading">
            <Spinner animation="border" variant="primary" />
            <span className="image-display__loading-text">Generating image...</span>
          </div>
        ) : error ? (
          <div className="error-message">
            <AlertCircle size={20} className="error-message__icon" />
            <span className="error-message__text">{error}</span>
          </div>
        ) : imageData ? (
          <img
            src={getImageSrc()}
            alt="Generated"
            className="image-display__image"
          />
        ) : (
          <div className="image-display__empty">
            <div className="image-display__empty-icon">
              <Image size={24} />
            </div>
            <span className="image-display__empty-text">
              Your generated image will appear here
            </span>
          </div>
        )}
      </div>

      {imageData && !isLoading && !error && (
        <>
          {revisedPrompt && (
            <div className="image-display__revised-prompt">
              <span className="image-display__revised-label">Revised prompt:</span>
              <span className="image-display__revised-text">{revisedPrompt}</span>
            </div>
          )}
          <div className="image-display__actions">
            <button
              className="image-display__action"
              onClick={handleDownload}
              type="button"
            >
              <Download size={16} />
              Download
            </button>
            <button
              className="image-display__action"
              onClick={handleCopy}
              type="button"
            >
              {copied ? <Check size={16} /> : <Copy size={16} />}
              {copied ? 'Copied!' : 'Copy'}
            </button>
          </div>
        </>
      )}
    </div>
  );
}
