/**
 * ImageDropzone - Drag and drop image upload for image-to-video generation
 */

import React, { useState, useRef, useCallback } from 'react';
import { Image, Upload, X } from 'lucide-react';

interface ImageDropzoneProps {
  onImageSelect: (base64: string | null) => void;
  disabled?: boolean;
}

export function ImageDropzone({
  onImageSelect,
  disabled = false,
}: ImageDropzoneProps): React.ReactElement {
  const [isDragging, setIsDragging] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const processFile = useCallback(async (file: File) => {
    if (!file.type.startsWith('image/')) {
      console.warn('Invalid file type:', file.type);
      return;
    }

    // Read file as base64
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      // Remove the data URL prefix to get pure base64
      const base64 = result.split(',')[1];
      setPreview(result);
      setFileName(file.name);
      onImageSelect(result); // Pass full data URL for display/transmission
    };
    reader.readAsDataURL(file);
  }, [onImageSelect]);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!disabled) {
      setIsDragging(true);
    }
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    if (disabled) return;

    const files = e.dataTransfer.files;
    if (files.length > 0) {
      processFile(files[0]);
    }
  };

  const handleClick = () => {
    if (!disabled) {
      fileInputRef.current?.click();
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      processFile(files[0]);
    }
  };

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation();
    setPreview(null);
    setFileName(null);
    onImageSelect(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  return (
    <div className="image-dropzone-container">
      <div className="image-dropzone__label">
        Reference Image (optional)
        <span className="image-dropzone__hint">For image-to-video generation</span>
      </div>
      <div
        className={`image-dropzone ${isDragging ? 'image-dropzone--dragging' : ''} ${disabled ? 'image-dropzone--disabled' : ''} ${preview ? 'image-dropzone--has-image' : ''}`}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={handleClick}
        role="button"
        tabIndex={disabled ? -1 : 0}
        onKeyDown={(e) => e.key === 'Enter' && handleClick()}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          onChange={handleFileChange}
          className="image-dropzone__input"
          disabled={disabled}
        />

        {preview ? (
          <div className="image-dropzone__preview">
            <img src={preview} alt="Reference" className="image-dropzone__preview-image" />
            <div className="image-dropzone__preview-info">
              <span className="image-dropzone__preview-name">{fileName}</span>
              <button
                className="image-dropzone__clear"
                onClick={handleClear}
                type="button"
                disabled={disabled}
              >
                <X size={14} />
                Remove
              </button>
            </div>
          </div>
        ) : (
          <div className="image-dropzone__placeholder">
            <div className="image-dropzone__icon">
              <Upload size={20} />
            </div>
            <span className="image-dropzone__text">
              Drop an image or click to browse
            </span>
            <span className="image-dropzone__formats">
              PNG, JPG, WebP supported
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
