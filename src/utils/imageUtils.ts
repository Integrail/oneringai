/**
 * Image utilities for processing images
 */

export interface ImageData {
  mimeType: string;
  base64Data: string;
  size: number;
}

/**
 * Fetch an image from URL and convert to base64
 * Used by providers that require base64 (like Google)
 */
export async function fetchImageAsBase64(url: string): Promise<ImageData> {
  // Check if it's already a data URI
  if (url.startsWith('data:image/')) {
    const matches = url.match(/^data:(image\/\w+);base64,(.+)$/);
    if (matches) {
      return {
        mimeType: matches[1] || 'image/png',
        base64Data: matches[2] || '',
        size: Math.round(((matches[2]?.length || 0) * 3) / 4),
      };
    }
  }

  // Fetch from URL
  try {
    const response = await fetch(url);

    if (!response.ok) {
      throw new Error(`Failed to fetch image: ${response.status} ${response.statusText}`);
    }

    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const base64Data = buffer.toString('base64');

    // Detect MIME type from content-type header or buffer magic numbers
    let mimeType = response.headers.get('content-type') || 'image/png';

    // Validate it's an image
    if (!mimeType.startsWith('image/')) {
      // Try to detect from magic numbers
      const magic = buffer.slice(0, 4).toString('hex');
      if (magic.startsWith('89504e47')) {
        mimeType = 'image/png';
      } else if (magic.startsWith('ffd8ff')) {
        mimeType = 'image/jpeg';
      } else if (magic.startsWith('47494638')) {
        mimeType = 'image/gif';
      } else if (magic.startsWith('52494646')) {
        mimeType = 'image/webp';
      } else {
        throw new Error('URL does not point to a valid image');
      }
    }

    return {
      mimeType,
      base64Data,
      size: buffer.length,
    };
  } catch (error: any) {
    throw new Error(`Failed to fetch image from URL: ${error.message}`);
  }
}

/**
 * Detect image format from base64 data
 */
export function detectImageFormat(base64Data: string): string {
  const buffer = Buffer.from(base64Data, 'base64');
  const magic = buffer.slice(0, 4).toString('hex');

  if (magic.startsWith('89504e47')) return 'image/png';
  if (magic.startsWith('ffd8ff')) return 'image/jpeg';
  if (magic.startsWith('47494638')) return 'image/gif';
  if (magic.startsWith('52494646')) return 'image/webp';

  return 'image/png'; // Default
}

/**
 * Get image size from base64 data (in bytes)
 */
export function getBase64ImageSize(base64Data: string): number {
  return Math.round((base64Data.length * 3) / 4);
}
