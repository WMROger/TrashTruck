import { Ionicons } from '@expo/vector-icons';
import React, { useState } from 'react';
import {
    Alert,
    Image,
    SafeAreaView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import driverImageService from '../services/driverImageService';
import ErrorModal from './ErrorModal';

export default function DriverImageTest() {
  const [uploadedImage, setUploadedImage] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [errorModal, setErrorModal] = useState({
    visible: false,
    title: 'Error',
    message: '',
    type: 'error' as 'error' | 'warning' | 'info' | 'success',
  });

  const showError = (message: string, title = 'Error', type: 'error' | 'warning' | 'info' | 'success' = 'error') => {
    setErrorModal({
      visible: true,
      title,
      message,
      type,
    });
  };

  const closeErrorModal = () => {
    setErrorModal(prev => ({ ...prev, visible: false }));
  };

  const testCompletionImageUpload = async () => {
    setUploading(true);
    try {
      // This would normally be called from the image picker
      // For testing, we'll simulate with a placeholder
      Alert.alert(
        'Test Upload',
        'This would normally open the image picker. In a real scenario, the image would be uploaded to Cloudinary.',
        [
          {
            text: 'Simulate Success',
            onPress: () => {
              setUploadedImage('https://res.cloudinary.com/demo/image/upload/sample.jpg');
              showError('Test upload completed successfully!', 'Success', 'success');
            }
          },
          {
            text: 'Simulate Error',
            onPress: () => {
              showError('Test upload failed. Please try again.', 'Upload Error', 'error');
            }
          }
        ]
      );
    } catch (error) {
      showError('Test failed', 'Error', 'error');
    } finally {
      setUploading(false);
    }
  };

  const testImageUrlGeneration = () => {
    const publicId = 'sample';
    const thumbnailUrl = driverImageService.generateThumbnailUrl(publicId);
    const fullSizeUrl = driverImageService.generateFullSizeUrl(publicId);
    
    Alert.alert(
      'URL Generation Test',
      `Thumbnail: ${thumbnailUrl}\n\nFull Size: ${fullSizeUrl}`,
      [{ text: 'OK' }]
    );
  };

  const testCloudinaryDetection = () => {
    const cloudinaryUrl = 'https://res.cloudinary.com/demo/image/upload/sample.jpg';
    const localUrl = 'file:///path/to/local/image.jpg';
    
    const isCloudinary1 = driverImageService.isCloudinaryUrl(cloudinaryUrl);
    const isCloudinary2 = driverImageService.isCloudinaryUrl(localUrl);
    
    Alert.alert(
      'Cloudinary Detection Test',
      `Cloudinary URL detected: ${isCloudinary1}\nLocal URL detected: ${isCloudinary2}`,
      [{ text: 'OK' }]
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <Text style={styles.title}>Driver Image Service Test</Text>
        <Text style={styles.subtitle}>Test Cloudinary integration for driver images</Text>

        <View style={styles.buttonContainer}>
          <TouchableOpacity
            style={[styles.button, styles.uploadButton]}
            onPress={testCompletionImageUpload}
            disabled={uploading}
          >
            <Ionicons name="cloud-upload" size={20} color="white" />
            <Text style={styles.buttonText}>
              {uploading ? 'Testing...' : 'Test Image Upload'}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.button, styles.urlButton]}
            onPress={testImageUrlGeneration}
          >
            <Ionicons name="link" size={20} color="white" />
            <Text style={styles.buttonText}>Test URL Generation</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.button, styles.detectButton]}
            onPress={testCloudinaryDetection}
          >
            <Ionicons name="search" size={20} color="white" />
            <Text style={styles.buttonText}>Test URL Detection</Text>
          </TouchableOpacity>

          {uploadedImage && (
            <View style={styles.imageContainer}>
              <Text style={styles.imageLabel}>Uploaded Image:</Text>
              <Image 
                source={{ uri: uploadedImage }} 
                style={styles.testImage}
                onError={() => {
                  showError('Failed to load test image', 'Image Error', 'error');
                }}
              />
            </View>
          )}
        </View>
      </View>

      {/* Error Modal */}
      <ErrorModal
        visible={errorModal.visible}
        title={errorModal.title}
        message={errorModal.message}
        type={errorModal.type}
        onClose={closeErrorModal}
        autoClose={true}
        autoCloseDelay={4000}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#E8F5E8',
  },
  content: {
    flex: 1,
    padding: 20,
    justifyContent: 'center',
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#2f3a31',
    textAlign: 'center',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#6b6b6b',
    textAlign: 'center',
    marginBottom: 40,
  },
  buttonContainer: {
    gap: 16,
  },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderRadius: 12,
    gap: 12,
  },
  buttonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  uploadButton: {
    backgroundColor: '#10B981',
  },
  urlButton: {
    backgroundColor: '#3B82F6',
  },
  detectButton: {
    backgroundColor: '#8B5CF6',
  },
  imageContainer: {
    marginTop: 20,
    alignItems: 'center',
  },
  imageLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#2f3a31',
    marginBottom: 10,
  },
  testImage: {
    width: 200,
    height: 200,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#CBE5CB',
  },
});
