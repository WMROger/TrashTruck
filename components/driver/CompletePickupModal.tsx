import { Feather } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import * as Location from 'expo-location';
import React, { useState } from 'react';
import { ActivityIndicator, Image, Modal, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { cloudinaryService, UPLOAD_FOLDERS } from '@/services/cloudinaryService';

interface CompletePickupModalProps {
  visible: boolean;
  onClose: () => void;
  onComplete: (data: { imageUrl: string; location: { lat: number; lng: number }; description: string }) => void;
  location?: string;
  wasteType?: string;
}

export default function CompletePickupModal({ 
  visible, 
  onClose, 
  onComplete,
  location = 'House #23, Mabini St.',
  wasteType = 'Biodegradable'
}: CompletePickupModalProps) {
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [description, setDescription] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const [geoCoords, setGeoCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [errorMsg, setErrorMsg] = useState('');

  const handleTakePhoto = async () => {
    try {
      setErrorMsg('');
      const { status: cameraStatus } = await ImagePicker.requestCameraPermissionsAsync();
      if (cameraStatus !== 'granted') {
        setErrorMsg('Camera permission is required to verify pickup.');
        return;
      }

      const { status: locationStatus } = await Location.requestForegroundPermissionsAsync();
      if (locationStatus !== 'granted') {
        setErrorMsg('Location permission is required for Geo-Photo verification.');
        return;
      }

      const result = await ImagePicker.launchCameraAsync({
        allowsEditing: false,
        quality: 0.7,
      });

      if (!result.canceled && result.assets[0]) {
        setImageUri(result.assets[0].uri);
        
        try {
          let loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Highest });
          setGeoCoords({
            lat: loc.coords.latitude,
            lng: loc.coords.longitude,
          });
        } catch (locErr) {
          console.warn("Failed to get current location, trying last known:", locErr);
          try {
            let loc = await Location.getLastKnownPositionAsync();
            if (loc) {
              setGeoCoords({
                lat: loc.coords.latitude,
                lng: loc.coords.longitude,
              });
            } else {
              throw new Error("No last known location");
            }
          } catch (fallbackErr) {
            console.warn("Failed to get fallback location:", fallbackErr);
            Alert.alert("Location Error", "Could not get your exact location. Are you on an emulator?");
          }
        }
      }
    } catch (err) {
      setErrorMsg('Error capturing photo or location.');
    }
  };

  const handleSubmit = async () => {
    if (!imageUri || !geoCoords) {
      setErrorMsg('Please take a photo to verify the pickup.');
      return;
    }

    setIsUploading(true);
    setErrorMsg('');

    try {
      const uploadResult = await cloudinaryService.uploadImage(imageUri, { folder: UPLOAD_FOLDERS.REPORTS });
      
      if (uploadResult.success && uploadResult.url) {
        onComplete({
          imageUrl: uploadResult.url,
          location: geoCoords,
          description: description.trim(),
        });
        // Reset states
        setImageUri(null);
        setDescription('');
        setGeoCoords(null);
      } else {
        setErrorMsg('Failed to upload image. Please try again.');
      }
    } catch (error) {
      setErrorMsg('An error occurred during submission.');
    } finally {
      setIsUploading(false);
    }
  };

  const handleClose = () => {
    setImageUri(null);
    setDescription('');
    setGeoCoords(null);
    setErrorMsg('');
    onClose();
  };

  return (
    <Modal
      animationType="fade"
      transparent={true}
      visible={visible}
      onRequestClose={handleClose}
    >
      <View style={styles.overlay}>
        <View style={styles.modalContent}>
          <Text style={styles.title}>Complete Pickup Report</Text>
          
          <View style={styles.detailsContainer}>
            <Text style={styles.detailText}>Location: {location}</Text>
            <Text style={styles.detailText}>Waste Type: {wasteType}</Text>
          </View>

          {errorMsg ? <Text style={styles.errorText}>{errorMsg}</Text> : null}

          {imageUri ? (
            <View style={styles.imagePreviewContainer}>
              <Image source={{ uri: imageUri }} style={styles.imagePreview} />
              <TouchableOpacity style={styles.retakeButton} onPress={handleTakePhoto}>
                <Feather name="refresh-cw" size={16} color="#FFFFFF" />
                <Text style={styles.retakeText}>Retake Photo</Text>
              </TouchableOpacity>
              {geoCoords && (
                <View style={styles.geoTag}>
                  <Feather name="map-pin" size={12} color="#FFFFFF" />
                  <Text style={styles.geoText}>
                    {geoCoords.lat.toFixed(5)}, {geoCoords.lng.toFixed(5)}
                  </Text>
                </View>
              )}
            </View>
          ) : (
            <TouchableOpacity style={styles.photoUploadBox} onPress={handleTakePhoto}>
              <Feather name="camera" size={24} color="#1F2937" />
              <Text style={styles.uploadText}>Take Geo-Photo</Text>
              <Text style={styles.uploadSubtext}>(Requires Camera & Location)</Text>
            </TouchableOpacity>
          )}

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Add Description (Optional):</Text>
            <TextInput
              style={styles.textInput}
              multiline
              numberOfLines={3}
              value={description}
              onChangeText={setDescription}
              placeholder="Any notes about this pickup?"
            />
          </View>

          <View style={styles.buttonRow}>
            <TouchableOpacity style={styles.cancelButton} onPress={handleClose} disabled={isUploading}>
              <Text style={styles.cancelButtonText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity 
              style={[styles.completeButton, (!imageUri || isUploading) && styles.disabledButton]} 
              onPress={handleSubmit}
              disabled={!imageUri || isUploading}
            >
              {isUploading ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <Text style={styles.completeButtonText}>Complete Pickup</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  modalContent: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    width: '100%',
    padding: 24,
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1F2937',
    marginBottom: 12,
  },
  detailsContainer: {
    marginBottom: 20,
  },
  detailText: {
    fontSize: 13,
    color: '#4B5563',
    fontWeight: '500',
    marginBottom: 2,
  },
  errorText: {
    color: '#EF4444',
    fontSize: 12,
    marginBottom: 12,
    fontWeight: '500',
  },
  photoUploadBox: {
    backgroundColor: '#E5E7EB',
    borderRadius: 8,
    height: 120,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  uploadText: {
    marginTop: 8,
    fontSize: 14,
    color: '#1F2937',
    fontWeight: '500',
  },
  uploadSubtext: {
    fontSize: 10,
    color: '#6B7280',
    marginTop: 4,
  },
  imagePreviewContainer: {
    width: '100%',
    height: 160,
    borderRadius: 8,
    overflow: 'hidden',
    marginBottom: 20,
    position: 'relative',
  },
  imagePreview: {
    width: '100%',
    height: '100%',
  },
  retakeButton: {
    position: 'absolute',
    top: 8,
    right: 8,
    backgroundColor: 'rgba(0,0,0,0.6)',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    gap: 6,
  },
  retakeText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600',
  },
  geoTag: {
    position: 'absolute',
    bottom: 8,
    left: 8,
    backgroundColor: 'rgba(0,0,0,0.6)',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    gap: 4,
  },
  geoText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: 'bold',
  },
  inputGroup: {
    marginBottom: 24,
  },
  label: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#4B5563',
    marginBottom: 8,
  },
  textInput: {
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 8,
    padding: 12,
    height: 80,
    textAlignVertical: 'top',
    backgroundColor: '#FFFFFF',
  },
  buttonRow: {
    flexDirection: 'row',
    gap: 12,
  },
  cancelButton: {
    flex: 1,
    backgroundColor: '#EF4444',
    borderRadius: 24,
    paddingVertical: 12,
    alignItems: 'center',
  },
  cancelButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  completeButton: {
    flex: 1,
    backgroundColor: '#3B5241',
    borderRadius: 24,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  disabledButton: {
    backgroundColor: '#9CA3AF',
  },
  completeButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
});
