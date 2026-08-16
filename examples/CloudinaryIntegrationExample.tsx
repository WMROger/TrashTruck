import React, { useState } from 'react';
import {
    Alert,
    Image,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import { AdvancedImagePicker, CloudinaryImagePicker } from '../components/ImagePicker';
import { cloudinaryService, UPLOAD_FOLDERS, UploadResult } from '../services/cloudinaryService';

/**
 * Example component demonstrating various Cloudinary integration patterns
 * This shows different ways to use the Cloudinary service in your app
 */
export default function CloudinaryIntegrationExample() {
  const [uploadedImages, setUploadedImages] = useState<UploadResult[]>([]);
  const [profileImage, setProfileImage] = useState<string | null>(null);

  // Example 1: Simple image upload for reports
  const handleReportImageUpload = (result: UploadResult) => {
    if (result.success) {
      console.log('Report image uploaded:', result.url);
      Alert.alert('Success', 'Image uploaded successfully!');
      setUploadedImages(prev => [...prev, result]);
    } else {
      Alert.alert('Upload Failed', result.error || 'Unknown error');
    }
  };

  // Example 2: Profile image upload with immediate update
  const handleProfileImageUpload = (result: UploadResult) => {
    if (result.success) {
      setProfileImage(result.url!);
      Alert.alert('Success', 'Profile image updated!');
    } else {
      Alert.alert('Upload Failed', result.error || 'Unknown error');
    }
  };

  // Example 3: Programmatic upload (without image picker)
  const handleDirectUpload = async () => {
    try {
      // This would typically be called with an existing image URI
      // For example, from camera capture or gallery selection
      const result = await cloudinaryService.pickAndUploadImage('gallery', UPLOAD_FOLDERS.REPORTS);
      
      if (result.success) {
        console.log('Direct upload successful:', result.url);
        setUploadedImages(prev => [...prev, result]);
      }
    } catch (error) {
      console.error('Direct upload failed:', error);
    }
  };

  // Example 4: Generate optimized URLs for existing images
  const generateThumbnail = (publicId: string) => {
    return cloudinaryService.generateOptimizedUrl(publicId, 150, 150, 'fill');
  };

  return (
    <ScrollView style={styles.container}>
      <Text style={styles.title}>Cloudinary Integration Examples</Text>
      
      {/* Example 1: Basic Image Picker for Reports */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>1. Report Image Upload</Text>
        <Text style={styles.description}>
          Upload images for trash reports. Images are stored in the 'reports' folder.
        </Text>
        <CloudinaryImagePicker
          onImageSelected={handleReportImageUpload}
          folder="REPORTS"
          placeholder="Add report photo"
          style={styles.imagePicker}
        />
      </View>

      {/* Example 2: Profile Image Upload */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>2. Profile Image Upload</Text>
        <Text style={styles.description}>
          Upload profile pictures. Images are optimized for profile display.
        </Text>
        <CloudinaryImagePicker
          onImageSelected={handleProfileImageUpload}
          folder="PROFILES"
          placeholder="Update profile picture"
          currentImageUrl={profileImage || undefined}
          showPreview={true}
          style={styles.profilePicker}
        />
      </View>

      {/* Example 3: Advanced Image Picker */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>3. Advanced Image Upload</Text>
        <Text style={styles.description}>
          Advanced picker with more options and better UX feedback.
        </Text>
        <AdvancedImagePicker
          onImageSelected={handleReportImageUpload}
          folder="ANNOUNCEMENTS"
          placeholder="Upload announcement images"
          multiple={false}
          style={styles.advancedPicker}
        />
      </View>

      {/* Example 4: Direct Service Usage */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>4. Direct Service Usage</Text>
        <Text style={styles.description}>
          Use the service directly for custom upload flows.
        </Text>
        <TouchableOpacity style={styles.button} onPress={handleDirectUpload}>
          <Text style={styles.buttonText}>Upload with Service</Text>
        </TouchableOpacity>
      </View>

      {/* Display uploaded images */}
      {uploadedImages.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Uploaded Images</Text>
          <View style={styles.imageGrid}>
            {uploadedImages.map((image, index) => (
              <View key={index} style={styles.imageItem}>
                <Image source={{ uri: image.url }} style={styles.thumbnailImage} />
                <Text style={styles.imageUrl} numberOfLines={1}>
                  {image.publicId}
                </Text>
              </View>
            ))}
          </View>
        </View>
      )}

      {/* Code Examples */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>5. Code Examples</Text>
        <View style={styles.codeBlock}>
          <Text style={styles.codeTitle}>Basic Upload:</Text>
          <Text style={styles.codeText}>
{`// Using the component
<CloudinaryImagePicker
  onImageSelected={(result) => {
    if (result.success) {
      console.log('Image URL:', result.url);
    }
  }}
  folder="REPORTS"
/>

// Using the service directly
const result = await cloudinaryService
  .pickAndUploadImage('gallery', 'reports');`}
          </Text>
        </View>

        <View style={styles.codeBlock}>
          <Text style={styles.codeTitle}>Generate Optimized URLs:</Text>
          <Text style={styles.codeText}>
{`// Create thumbnail
const thumbnailUrl = cloudinaryService
  .generateOptimizedUrl(publicId, 150, 150, 'fill');

// Create responsive image
const responsiveUrl = cloudinaryService
  .generateOptimizedUrl(publicId, 800, 600, 'fit');`}
          </Text>
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    textAlign: 'center',
    marginVertical: 20,
    color: '#333',
  },
  section: {
    backgroundColor: 'white',
    margin: 16,
    padding: 16,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 8,
    color: '#333',
  },
  description: {
    fontSize: 14,
    color: '#666',
    marginBottom: 16,
    lineHeight: 20,
  },
  imagePicker: {
    minHeight: 120,
  },
  profilePicker: {
    minHeight: 150,
    borderRadius: 75,
  },
  advancedPicker: {
    minHeight: 140,
  },
  button: {
    backgroundColor: '#4CAF50',
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  buttonText: {
    color: 'white',
    fontWeight: 'bold',
    fontSize: 16,
  },
  imageGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  imageItem: {
    width: 100,
    alignItems: 'center',
  },
  thumbnailImage: {
    width: 80,
    height: 80,
    borderRadius: 8,
  },
  imageUrl: {
    fontSize: 10,
    color: '#666',
    marginTop: 4,
    textAlign: 'center',
  },
  codeBlock: {
    backgroundColor: '#f8f8f8',
    padding: 12,
    borderRadius: 6,
    marginBottom: 12,
    borderLeftWidth: 4,
    borderLeftColor: '#4CAF50',
  },
  codeTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    marginBottom: 6,
    color: '#333',
  },
  codeText: {
    fontSize: 12,
    fontFamily: 'monospace',
    color: '#555',
    lineHeight: 16,
  },
});
