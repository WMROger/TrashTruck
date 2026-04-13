import { Alert } from 'react-native';
import { UploadResult } from '../services/cloudinaryService';

/**
 * Helper utilities for Cloudinary integration
 * These functions provide better error handling, validation, and user experience
 */

// Error types for better error handling
export enum CloudinaryErrorType {
  PERMISSION_DENIED = 'PERMISSION_DENIED',
  UPLOAD_FAILED = 'UPLOAD_FAILED',
  NETWORK_ERROR = 'NETWORK_ERROR',
  FILE_TOO_LARGE = 'FILE_TOO_LARGE',
  INVALID_FILE_TYPE = 'INVALID_FILE_TYPE',
  QUOTA_EXCEEDED = 'QUOTA_EXCEEDED',
  UNKNOWN = 'UNKNOWN',
}

export interface CloudinaryError {
  type: CloudinaryErrorType;
  message: string;
  originalError?: any;
}

/**
 * Parse and categorize Cloudinary errors for better user messaging
 */
export function parseCloudinaryError(error: any): CloudinaryError {
  const errorMessage = error?.message || error?.error?.message || 'Unknown error';
  
  // Check for specific error patterns
  if (errorMessage.includes('permission') || errorMessage.includes('denied')) {
    return {
      type: CloudinaryErrorType.PERMISSION_DENIED,
      message: 'Camera or photo library permission was denied. Please check your device settings.',
      originalError: error,
    };
  }
  
  if (errorMessage.includes('network') || errorMessage.includes('fetch')) {
    return {
      type: CloudinaryErrorType.NETWORK_ERROR,
      message: 'Network error occurred. Please check your internet connection and try again.',
      originalError: error,
    };
  }
  
  if (errorMessage.includes('file size') || errorMessage.includes('too large')) {
    return {
      type: CloudinaryErrorType.FILE_TOO_LARGE,
      message: 'The selected image is too large. Please choose a smaller image.',
      originalError: error,
    };
  }
  
  if (errorMessage.includes('file type') || errorMessage.includes('format')) {
    return {
      type: CloudinaryErrorType.INVALID_FILE_TYPE,
      message: 'Invalid file type. Please select a valid image file.',
      originalError: error,
    };
  }
  
  if (errorMessage.includes('quota') || errorMessage.includes('limit')) {
    return {
      type: CloudinaryErrorType.QUOTA_EXCEEDED,
      message: 'Upload limit reached. Please try again later or contact support.',
      originalError: error,
    };
  }
  
  return {
    type: CloudinaryErrorType.UNKNOWN,
    message: errorMessage,
    originalError: error,
  };
}

/**
 * Show user-friendly error alerts
 */
export function showCloudinaryError(error: CloudinaryError, customActions?: Array<{ text: string; onPress: () => void }>) {
  const defaultActions = [{ text: 'OK', onPress: () => {} }];
  const actions = customActions || defaultActions;
  
  let title = 'Upload Error';
  
  switch (error.type) {
    case CloudinaryErrorType.PERMISSION_DENIED:
      title = 'Permission Required';
      break;
    case CloudinaryErrorType.NETWORK_ERROR:
      title = 'Network Error';
      break;
    case CloudinaryErrorType.FILE_TOO_LARGE:
      title = 'File Too Large';
      break;
    case CloudinaryErrorType.INVALID_FILE_TYPE:
      title = 'Invalid File';
      break;
    case CloudinaryErrorType.QUOTA_EXCEEDED:
      title = 'Upload Limit Reached';
      break;
  }
  
  Alert.alert(title, error.message, actions);
}

/**
 * Validate image before upload
 */
export interface ImageValidationOptions {
  maxSizeInMB?: number;
  allowedTypes?: string[];
  minWidth?: number;
  minHeight?: number;
  maxWidth?: number;
  maxHeight?: number;
}

export function validateImage(
  imageUri: string,
  options: ImageValidationOptions = {}
): Promise<{ isValid: boolean; error?: CloudinaryError }> {
  return new Promise((resolve) => {
    const {
      maxSizeInMB = 10,
      allowedTypes = ['image/jpeg', 'image/png', 'image/webp'],
    } = options;
    
    // For now, we'll do basic validation
    // In a real app, you might want to get actual file info
    
    if (!imageUri) {
      resolve({
        isValid: false,
        error: {
          type: CloudinaryErrorType.INVALID_FILE_TYPE,
          message: 'No image selected',
        },
      });
      return;
    }
    
    // Basic URI validation
    if (!imageUri.startsWith('file://') && !imageUri.startsWith('data:') && !imageUri.startsWith('http')) {
      resolve({
        isValid: false,
        error: {
          type: CloudinaryErrorType.INVALID_FILE_TYPE,
          message: 'Invalid image URI format',
        },
      });
      return;
    }
    
    // For more sophisticated validation, you'd need to:
    // 1. Get file size from the URI
    // 2. Check MIME type
    // 3. Get image dimensions
    // This requires platform-specific code or additional libraries
    
    resolve({ isValid: true });
  });
}

/**
 * Handle upload result with automatic error handling
 */
export function handleUploadResult(
  result: UploadResult,
  onSuccess: (url: string, publicId: string) => void,
  onError?: (error: CloudinaryError) => void
) {
  if (result.success && result.url) {
    onSuccess(result.url, result.publicId || '');
  } else {
    const error = parseCloudinaryError(result.error);
    
    if (onError) {
      onError(error);
    } else {
      showCloudinaryError(error);
    }
  }
}

/**
 * Retry upload with exponential backoff
 */
export async function retryUpload<T>(
  uploadFunction: () => Promise<T>,
  maxRetries: number = 3,
  initialDelay: number = 1000
): Promise<T> {
  let lastError;
  
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await uploadFunction();
    } catch (error) {
      lastError = error;
      
      if (attempt === maxRetries) {
        throw error;
      }
      
      // Exponential backoff
      const delay = initialDelay * Math.pow(2, attempt);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
  
  throw lastError;
}

/**
 * Generate responsive image URLs for different screen sizes
 */
export interface ResponsiveImageUrls {
  thumbnail: string;
  small: string;
  medium: string;
  large: string;
  original: string;
}

export function generateResponsiveUrls(publicId: string, cloudName?: string): ResponsiveImageUrls {
  const actualCloudName = cloudName || process.env.EXPO_PUBLIC_CLOUDINARY_CLOUD_NAME;
  if (!actualCloudName) {
    throw new Error('Cloud name is required. Either pass it as parameter or set EXPO_PUBLIC_CLOUDINARY_CLOUD_NAME');
  }
  
  const baseUrl = `https://res.cloudinary.com/${actualCloudName}/image/upload`;
  
  return {
    thumbnail: `${baseUrl}/w_150,h_150,c_fill,q_auto,f_auto/${publicId}`,
    small: `${baseUrl}/w_300,h_300,c_limit,q_auto,f_auto/${publicId}`,
    medium: `${baseUrl}/w_600,h_600,c_limit,q_auto,f_auto/${publicId}`,
    large: `${baseUrl}/w_1200,h_1200,c_limit,q_auto,f_auto/${publicId}`,
    original: `${baseUrl}/q_auto,f_auto/${publicId}`,
  };
}

/**
 * Compress image before upload (for React Native)
 */
export interface CompressionOptions {
  quality?: number;
  maxWidth?: number;
  maxHeight?: number;
  format?: 'jpeg' | 'png' | 'webp';
}

// Note: This would require additional libraries like react-native-image-resizer
// or expo-image-manipulator for actual implementation
export function compressImage(
  imageUri: string,
  options: CompressionOptions = {}
): Promise<string> {
  // Placeholder for image compression
  // In a real implementation, you'd use:
  // - expo-image-manipulator for Expo projects
  // - react-native-image-resizer for bare React Native
  // - or similar libraries
  
  console.log('Image compression not implemented. Add expo-image-manipulator or similar.');
  return Promise.resolve(imageUri);
}

/**
 * Log upload analytics
 */
export function logUploadAnalytics(
  eventType: 'upload_started' | 'upload_success' | 'upload_failed',
  metadata: {
    folder?: string;
    fileSize?: number;
    uploadTime?: number;
    errorType?: CloudinaryErrorType;
  }
) {
  // Log to your analytics service
  console.log(`Cloudinary ${eventType}:`, metadata);
  
  // You could integrate with services like:
  // - Firebase Analytics
  // - Mixpanel
  // - Amplitude
  // - Custom analytics
}

/**
 * Cache management for uploaded images
 */
class CloudinaryCache {
  private cache = new Map<string, UploadResult>();
  private maxCacheSize = 100;
  
  set(key: string, result: UploadResult) {
    if (this.cache.size >= this.maxCacheSize) {
      const firstKey = this.cache.keys().next().value;
      if (firstKey) {
        this.cache.delete(firstKey);
      }
    }
    this.cache.set(key, result);
  }
  
  get(key: string): UploadResult | undefined {
    return this.cache.get(key);
  }
  
  clear() {
    this.cache.clear();
  }
  
  has(key: string): boolean {
    return this.cache.has(key);
  }
}

export const cloudinaryCache = new CloudinaryCache();

/**
 * Utility for generating cache keys
 */
export function generateCacheKey(imageUri: string, folder?: string): string {
  const timestamp = Math.floor(Date.now() / 1000); // Cache for 1 second intervals
  return `${imageUri}_${folder || 'default'}_${timestamp}`;
}
