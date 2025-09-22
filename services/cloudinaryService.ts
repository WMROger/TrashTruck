import * as ImagePicker from 'expo-image-picker';
import { UPLOAD_FOLDERS, UPLOAD_PRESET, UPLOAD_PRESETS } from '../config/cloudinary';

export interface UploadResult {
  success: boolean;
  url?: string;
  publicId?: string;
  error?: string;
}

export interface UploadOptions {
  folder?: string;
  preset?: keyof typeof UPLOAD_PRESETS | string;
  transformation?: string;
  tags?: string[];
  resourceType?: 'image' | 'video' | 'raw' | 'auto';
}

class CloudinaryService {
  private getCloudName(): string {
    const cloudName = process.env.EXPO_PUBLIC_CLOUDINARY_CLOUD_NAME || 'dosewf6kp';
    return cloudName;
  }

  private get baseUrl(): string {
    return `https://api.cloudinary.com/v1_1/${this.getCloudName()}`;
  }

  /**
   * Upload image to Cloudinary using unsigned upload
   */
  async uploadImage(
    imageUri: string | any,
    options: UploadOptions = {}
  ): Promise<UploadResult> {
    try {
      // Validate image URI and ensure it's a string
      if (!imageUri) {
        return { success: false, error: 'No image URI provided' };
      }

      // Convert to string if it's an object
      let uriString: string;
      try {
        uriString = typeof imageUri === 'string' ? imageUri : String(imageUri);
        if (!uriString || uriString === 'undefined' || uriString === 'null') {
          return { success: false, error: 'Invalid image URI: could not convert to string' };
        }
      } catch (error) {
        return { success: false, error: 'Invalid image URI: conversion failed' };
      }
      
      console.log('Uploading image with URI:', uriString.substring(0, 100) + '...');

      // Prepare form data
      const formData = new FormData();
      
      // Handle different image URI types
      if (uriString.startsWith('data:')) {
        // Base64 data URI - convert to blob for web
        try {
          const response = await fetch(uriString);
          const blob = await response.blob();
          formData.append('file', blob, `image_${Date.now()}.jpg`);
        } catch (error) {
          console.error('Error converting data URI to blob:', error);
          return { success: false, error: 'Failed to process image data' };
        }
      } else if (uriString.startsWith('blob:')) {
        // Blob URL - fetch and convert to blob
        try {
          const response = await fetch(uriString);
          const blob = await response.blob();
          formData.append('file', blob, `image_${Date.now()}.jpg`);
        } catch (error) {
          console.error('Error converting blob URL to blob:', error);
          return { success: false, error: 'Failed to process image blob' };
        }
      } else {
        // Regular file URI (for native platforms)
        formData.append('file', {
          uri: uriString,
          type: 'image/jpeg',
          name: `image_${Date.now()}.jpg`,
        } as any);
      }

      // Add upload preset (use specific preset or default)
      const preset = options.preset ? 
        (typeof options.preset === 'string' ? options.preset : UPLOAD_PRESETS[options.preset]) : 
        UPLOAD_PRESET;
      
      // Validate that we have a preset
      if (!preset) {
        return {
          success: false,
          error: 'Upload preset not configured. Please set EXPO_PUBLIC_CLOUDINARY_UPLOAD_PRESET environment variable.',
        };
      }
      
      formData.append('upload_preset', preset);

      // Add optional parameters
      if (options.folder) {
        formData.append('folder', options.folder);
      }

      if (options.tags && options.tags.length > 0) {
        formData.append('tags', options.tags.join(','));
      }

      // Add timestamp for security (if using signed uploads)
      formData.append('timestamp', Math.floor(Date.now() / 1000).toString());

      // Make the upload request
      console.log('Uploading to Cloudinary with preset:', preset);
      const response = await fetch(`${this.baseUrl}/image/upload`, {
        method: 'POST',
        body: formData,
        // Don't set Content-Type header - let the browser set it with boundary
      });

      if (!response.ok) {
        const errorData = await response.json();
        console.error('Cloudinary upload error details:', errorData);
        return {
          success: false,
          error: errorData.error?.message || `Upload failed with status ${response.status}`,
        };
      }

      const result = await response.json();

      return {
        success: true,
        url: result.secure_url,
        publicId: result.public_id,
      };
    } catch (error) {
      console.error('Cloudinary upload error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred',
      };
    }
  }

  /**
   * Upload multiple images
   */
  async uploadMultipleImages(
    imageUris: string[],
    options: UploadOptions = {}
  ): Promise<UploadResult[]> {
    const uploadPromises = imageUris.map(uri => this.uploadImage(uri, options));
    return Promise.all(uploadPromises);
  }

  /**
   * Delete image from Cloudinary (requires API key and secret)
   */
  async deleteImage(publicId: string): Promise<boolean> {
    try {
      // Note: For deletion, you'll need to implement server-side endpoint
      // as it requires API secret which shouldn't be exposed in mobile app
      console.warn('Image deletion should be implemented server-side for security');
      return false;
    } catch (error) {
      console.error('Image deletion error:', error);
      return false;
    }
  }

  /**
   * Pick image from gallery or camera and upload
   */
  async pickAndUploadImage(
    source: 'gallery' | 'camera' = 'gallery',
    folder?: string
  ): Promise<UploadResult> {
    try {
      // Request permissions
      if (source === 'camera') {
        const { status } = await ImagePicker.requestCameraPermissionsAsync();
        if (status !== 'granted') {
          return { success: false, error: 'Camera permission denied' };
        }
      } else {
        const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (status !== 'granted') {
          return { success: false, error: 'Gallery permission denied' };
        }
      }

      // Pick image
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: source === 'camera' ? [1, 1] : undefined,
        quality: 0.8,
        exif: false,
      });

      if (result.canceled || !result.assets[0]) {
        return { success: false, error: 'Image selection was cancelled' };
      }

      const imageUri = result.assets[0].uri;

      // Upload to Cloudinary
      return this.uploadImage(imageUri, { folder });
    } catch (error) {
      console.error('Pick and upload error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to pick and upload image',
      };
    }
  }

  /**
   * Pick image from camera and upload
   */
  async takePhotoAndUpload(folder?: string): Promise<UploadResult> {
    try {
      // Request camera permissions
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== 'granted') {
        return { success: false, error: 'Camera permission denied' };
      }

      // Take photo
      const result = await ImagePicker.launchCameraAsync({
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
        exif: false,
      });

      if (result.canceled || !result.assets[0]) {
        return { success: false, error: 'Photo capture was cancelled' };
      }

      const imageUri = result.assets[0].uri;

      // Upload to Cloudinary
      return this.uploadImage(imageUri, { folder });
    } catch (error) {
      console.error('Take photo and upload error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to take and upload photo',
      };
    }
  }

  /**
   * Generate optimized image URL with transformations
   */
  generateOptimizedUrl(
    publicId: string,
    width?: number,
    height?: number,
    crop: 'fill' | 'fit' | 'crop' | 'scale' = 'fill'
  ): string {
    const baseUrl = `https://res.cloudinary.com/${this.getCloudName()}/image/upload`;
    let transformation = 'q_auto,f_auto';

    if (width || height) {
      transformation += `,w_${width || 'auto'},h_${height || 'auto'},c_${crop}`;
    }

    return `${baseUrl}/${transformation}/${publicId}`;
  }
}

// Export singleton instance
export const cloudinaryService = new CloudinaryService();

// Export folder constants for easy access
export { UPLOAD_FOLDERS };

export default cloudinaryService;
