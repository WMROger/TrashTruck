// Cloudinary configuration for React Native
export const getCloudinaryConfig = () => ({
  cloud_name: process.env.EXPO_PUBLIC_CLOUDINARY_CLOUD_NAME || 'dosewf6kp',
  api_key: process.env.EXPO_PUBLIC_CLOUDINARY_API_KEY,
  api_secret: process.env.EXPO_PUBLIC_CLOUDINARY_API_SECRET,
  secure: true,
});

// Upload presets for different types of uploads
export const UPLOAD_PRESETS = {
  REPORTS: 'trashtrack_reports',
  PROFILES: 'trashtrack_profile',
  ANNOUNCEMENTS: 'trashtrack_reports', // Can reuse reports preset
  FEEDBACK: 'trashtrack_reports', // Can reuse reports preset
  DRIVER_PHOTOS: 'trashtrack_reports', // Use existing preset for now
} as const;

// Default upload preset - use a fallback if environment variable is not set
export const UPLOAD_PRESET = process.env.EXPO_PUBLIC_CLOUDINARY_UPLOAD_PRESET || 'trashtrack_reports';

// Folder structure for organizing uploads (these will be set in your upload presets)
export const UPLOAD_FOLDERS = {
  REPORTS: 'trashtruck/reports',
  PROFILES: 'trashtruck/profiles',
  ANNOUNCEMENTS: 'trashtruck/announcements',
  FEEDBACK: 'trashtruck/feedback',
  DRIVER_PHOTOS: 'trashtruck/driver-photos',
  COMPLETION_IMAGES: 'trashtruck/completion-images',
  DRIVER_PROFILES: 'trashtruck/driver-profiles',
  ISSUE_REPORTS: 'trashtruck/issue-reports',
} as const;

// Image transformation presets
export const IMAGE_TRANSFORMATIONS = {
  THUMBNAIL: 'w_150,h_150,c_fill,q_auto,f_auto',
  PROFILE: 'w_300,h_300,c_fill,q_auto,f_auto',
  REPORT: 'w_800,h_600,c_limit,q_auto,f_auto',
  ANNOUNCEMENT: 'w_1200,h_800,c_limit,q_auto,f_auto',
} as const;

// Helper function to build Cloudinary URL
export const buildCloudinaryUrl = (
  publicId: string,
  transformation?: string
): string => {
  const config = getCloudinaryConfig();
  const baseUrl = `https://res.cloudinary.com/${config.cloud_name}`;
  const transformationPart = transformation ? `/${transformation}` : '';
  return `${baseUrl}/image/upload${transformationPart}/${publicId}`;
};

// Helper function to extract public ID from Cloudinary URL
export const extractPublicId = (cloudinaryUrl: string): string => {
  const match = cloudinaryUrl.match(/\/upload\/(?:v\d+\/)?(.+)$/);
  return match ? match[1].replace(/\.[^/.]+$/, '') : '';
};

// Export helper functions for React Native compatibility
export { getCloudinaryConfig as default };

