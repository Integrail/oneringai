/**
 * ImageDisplay - Shows generated images with grid/carousel view and actions
 */

import React, { useState } from 'react';
import { Spinner } from 'react-bootstrap';
import { Image, Download, Copy, Check, AlertCircle, ChevronLeft, ChevronRight } from 'lucide-react';

interface GeneratedImage {
  data: string; // base64 or URL
  revisedPrompt?: string;
}

interface ImageDisplayProps {
  images: GeneratedImage[];
  selectedIndex: number;
  onSelectImage: (index: number) => void;
  isLoading: boolean;
  error: string | null;
}

export function ImageDisplay({
  images,
  selectedIndex,
  onSelectImage,
  isLoading,
  error,
}: ImageDisplayProps): React.ReactElement {
  const [copied, setCopied] = useState(false);

  const selectedImage = images[selectedIndex];
  const hasMultipleImages = images.length > 1;

  const getImageSrc = (imageData: string) => {
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

  const handleDownload = () => {
    if (!selectedImage?.data) return;

    const imageData = selectedImage.data;

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
      link.href = getImageSrc(imageData);
    }

    // Determine file extension from MIME type
    const src = getImageSrc(imageData);
    const ext = src.includes('image/jpeg') ? 'jpg'
      : src.includes('image/webp') ? 'webp'
      : 'png';
    link.download = `generated-image-${Date.now()}-${selectedIndex + 1}.${ext}`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleDownloadAll = () => {
    images.forEach((img, index) => {
      const imageData = img.data;
      const link = document.createElement('a');

      if (imageData.startsWith('data:')) {
        link.href = imageData;
      } else if (imageData.startsWith('http')) {
        window.open(imageData, '_blank');
        return;
      } else {
        link.href = getImageSrc(imageData);
      }

      const src = getImageSrc(imageData);
      const ext = src.includes('image/jpeg') ? 'jpg'
        : src.includes('image/webp') ? 'webp'
        : 'png';
      link.download = `generated-image-${Date.now()}-${index + 1}.${ext}`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    });
  };

  const handleCopy = async () => {
    if (!selectedImage?.data) return;

    const imageData = selectedImage.data;

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

  const handlePrevious = () => {
    onSelectImage(selectedIndex > 0 ? selectedIndex - 1 : images.length - 1);
  };

  const handleNext = () => {
    onSelectImage(selectedIndex < images.length - 1 ? selectedIndex + 1 : 0);
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
        ) : selectedImage ? (
          <div className="image-display__main">
            {hasMultipleImages && (
              <button
                className="image-display__nav image-display__nav--prev"
                onClick={handlePrevious}
                type="button"
                aria-label="Previous image"
              >
                <ChevronLeft size={24} />
              </button>
            )}
            <img
              src={getImageSrc(selectedImage.data)}
              alt={`Generated ${selectedIndex + 1}`}
              className="image-display__image"
            />
            {hasMultipleImages && (
              <button
                className="image-display__nav image-display__nav--next"
                onClick={handleNext}
                type="button"
                aria-label="Next image"
              >
                <ChevronRight size={24} />
              </button>
            )}
          </div>
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

      {/* Thumbnails for multiple images */}
      {hasMultipleImages && !isLoading && !error && (
        <div className="image-display__thumbnails">
          {images.map((img, index) => (
            <button
              key={index}
              className={`image-display__thumbnail ${
                index === selectedIndex ? 'image-display__thumbnail--selected' : ''
              }`}
              onClick={() => onSelectImage(index)}
              type="button"
              aria-label={`Select image ${index + 1}`}
            >
              <img
                src={getImageSrc(img.data)}
                alt={`Thumbnail ${index + 1}`}
              />
            </button>
          ))}
        </div>
      )}

      {selectedImage && !isLoading && !error && (
        <>
          {selectedImage.revisedPrompt && (
            <div className="image-display__revised-prompt">
              <span className="image-display__revised-label">Revised prompt:</span>
              <span className="image-display__revised-text">{selectedImage.revisedPrompt}</span>
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
            {hasMultipleImages && (
              <button
                className="image-display__action"
                onClick={handleDownloadAll}
                type="button"
              >
                <Download size={16} />
                Download All
              </button>
            )}
            <button
              className="image-display__action"
              onClick={handleCopy}
              type="button"
            >
              {copied ? <Check size={16} /> : <Copy size={16} />}
              {copied ? 'Copied!' : 'Copy'}
            </button>
          </div>
          {hasMultipleImages && (
            <div className="image-display__counter">
              {selectedIndex + 1} / {images.length}
            </div>
          )}
        </>
      )}
    </div>
  );
}
