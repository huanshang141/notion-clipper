/**
 * Image Processing Service
 * Handles downloading and uploading images
 */

import requestService from '../utils/request';
import { ExtractedImage } from '../types';

class ImageService {
  /**
   * Download image from URL
   */
  async downloadImage(url: string): Promise<Blob> {
    try {
      // Add timeout for download
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 15000);

      const response = await fetch(url, {
        signal: controller.signal,
        credentials: 'omit', // Avoid CORS issues
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const blob = await response.blob();

      // Validate size (max 5MB for MVP)
      const maxSize = 5 * 1024 * 1024;
      if (blob.size > maxSize) {
        throw new Error('Image too large (max 5MB)');
      }

      return blob;
    } catch (error) {
      throw new Error(`Failed to download image: ${error}`);
    }
  }

  /**
   * Download multiple images in parallel
   */
  async downloadImages(images: ExtractedImage[], maxConcurrent: number = 3) {
    const results: Map<string, Blob> = new Map();
    const errors: Map<string, string> = new Map();

    // Process in batches to avoid overwhelming the network
    for (let i = 0; i < images.length; i += maxConcurrent) {
      const batch = images.slice(i, i + maxConcurrent);
      const promises = batch.map(async (img) => {
        try {
          const blob = await this.downloadImage(img.src);
          results.set(img.src, blob);
        } catch (error) {
          errors.set(img.src, error instanceof Error ? error.message : String(error));
        }
      });

      await Promise.all(promises);
    }

    return { results, errors };
  }

  /**
   * Upload image to Notion
   * For MVP: Use external URL if available, otherwise convert to data URI
   * In future: Implement proper Notion file upload via API
   */
  async uploadImageToNotion(blob: Blob, filename: string): Promise<string> {
    try {
      // For now, convert blob to data URI for storage in Notion
      // This allows offline viewing but increases page payload
      // Future implementation should:
      // 1. Upload to Notion's S3 bucket
      // 2. Or upload to external CDN (Cloudinary, Imgix, etc.)
      // 3. Or store reference with lazy loading

      const dataUri = await this.blobToDataUri(blob);
      return dataUri;
    } catch (error) {
      console.error('Failed to upload image to Notion:', error);
      throw new Error(`Failed to upload image: ${error}`);
    }
  }

  /**
   * Convert image blob to data URI
   * Useful for fallback when upload fails
   */
  async blobToDataUri(blob: Blob): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  }

  /**
   * Get image dimensions
   */
  async getImageDimensions(blob: Blob): Promise<{ width: number; height: number }> {
    return new Promise((resolve, reject) => {
      const url = URL.createObjectURL(blob);
      const img = new Image();

      img.onload = () => {
        resolve({ width: img.width, height: img.height });
        URL.revokeObjectURL(url);
      };

      img.onerror = () => {
        reject(new Error('Failed to load image'));
        URL.revokeObjectURL(url);
      };

      img.src = url;
    });
  }

  /**
   * Validate image MIME type
   */
  isValidImageType(mimeType: string): boolean {
    const validTypes = [
      'image/jpeg',
      'image/jpg',
      'image/png',
      'image/gif',
      'image/webp',
      'image/svg+xml',
    ];
    return validTypes.includes(mimeType);
  }

  /**
   * Get file extension from blob
   */
  getImageExtension(blob: Blob): string {
    const mimeToExt: Record<string, string> = {
      'image/jpeg': 'jpg',
      'image/jpg': 'jpg',
      'image/png': 'png',
      'image/gif': 'gif',
      'image/webp': 'webp',
      'image/svg+xml': 'svg',
    };

    return mimeToExt[blob.type] || 'jpg';
  }

  /**
   * Process image URLs - download and prepare for upload
   * Returns mapping of original URL to uploaded Notion URL
   */
  async processImagesForNotion(images: ExtractedImage[], shouldDownload: boolean = true): Promise<Record<string, string>> {
    if (!shouldDownload || !images.length) {
      return {};
    }

    const { results, errors } = await this.downloadImages(images);

    const uploadedUrls: Record<string, string> = {};

    // For MVP: Use original URL if download fails
    // Upload downloaded images as data URIs for direct embedding
    for (const img of images) {
      try {
        if (results.has(img.src)) {
          const blob = results.get(img.src)!;
          // Upload the blob and get a URL (data URI for MVP)
          const uploadedUrl = await this.uploadImageToNotion(blob, `image-${Date.now()}`);
          uploadedUrls[img.src] = uploadedUrl;
        } else if (errors.has(img.src)) {
          // Fall back to original URL if download failed
          console.warn(`Failed to download ${img.src}, using original URL`);
          uploadedUrls[img.src] = img.src;
        }
      } catch (error) {
        console.error(`Failed to process image ${img.src}:`, error);
        // Use original URL as final fallback
        uploadedUrls[img.src] = img.src;
      }
    }

    return uploadedUrls;
  }
}

export default new ImageService();
