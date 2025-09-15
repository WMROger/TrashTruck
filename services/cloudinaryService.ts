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
    const cloudName = process.env.EXPO_PUBLIC_CLOUDINARY_CLOUD_NAME;
    if (!cloudName) {
      throw new Error('EXPO_PUBLIC_CLOUDINARY_CLOUD_NAME is not set in environment variables');
    }
    return cloudName;
  }

  private get baseUrl(): string {
    return `https://api.cloudinary.com/v1_1/${this.getCloudName()}`;
  }

  /**
   * Upload image to Cloudinary using unsigned upload
   */
  async uploadImage(
    imageUri: string,
    options: UploadOptions = {}
  ): Promise<UploadResult> {
    try {
      // Validate image URI
      if (!imageUri) {
        return { success: false, error: 'No image URI provided' };
      }

      // Prepare form data
      const formData = new FormData();
      
      // Add the image file
      formData.append('file', {
        uri: imageUri,
        type: 'image/jpeg', // You might want to detect the actual MIME type
        name: `image_${Date.now()}.jpg`,
      } as any);

      // Add upload preset (use specific preset or default)
      const preset = options.preset ? 
        (typeof options.preset === 'string' ? options.preset : UPLOAD_PRESETS[options.preset]) : 
        UPLOAD_PRESET;
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
      const response = await fetch(`${this.baseUrl}/image/upload`, {
        method: 'POST',
        body: formData,
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });

      if (!response.ok) {
        const errorData = await response.json();
        return {
          success: false,
          error: errorData.error?.message || 'Upload failed',
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
