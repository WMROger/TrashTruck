import { Feather } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import * as Location from 'expo-location';
import React, { useState } from 'react';
import { ActivityIndicator, Alert, Image, Modal, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { submitPickupCompletion } from '@/services/driverOfflineQueue';
import { formatAdaptiveMassFromMetricTons } from '@/utils/wasteUnits';

type MeasurementUnit = 'ton';

export type PickupCompletionData = {
  imageUrl: string;
  location: { lat: number; lng: number };
  description: string;
  measurement: { value: number; unit: MeasurementUnit; bagCount: number | null };
};

interface CompletePickupModalProps {
  visible: boolean;
  scheduleId: string;
  onClose: () => void;
  onSubmit?: (data: PickupCompletionData) => void;
  location?: string;
  wasteType?: string;
}

export default function CompletePickupModal({ 
  visible, 
  scheduleId,
  onClose, 
  onSubmit,
  location = 'Scheduled pickup',
  wasteType = 'Not specified'
}: CompletePickupModalProps) {
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [description, setDescription] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const [geoCoords, setGeoCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [errorMsg, setErrorMsg] = useState('');
  const [measurementValue, setMeasurementValue] = useState('');
  const [bagCount, setBagCount] = useState('');

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
            setErrorMsg('Photo captured, but GPS is unavailable. Enable location services and retake the photo.');
          }
        }
      }
    } catch {
      setErrorMsg('Error capturing photo or location.');
    }
  };

  const handleSubmit = async () => {
    if (!imageUri || !geoCoords) {
      setErrorMsg('A completion photo with GPS coordinates is required.');
      return;
    }
    const numericMeasurement = Number(measurementValue);
    const numericBagCount = bagCount.trim() ? Number(bagCount) : null;
    if (!Number.isFinite(numericMeasurement) || numericMeasurement <= 0) {
      setErrorMsg('Enter the actual collected weight in kilograms.');
      return;
    }
    if (numericBagCount !== null && (!Number.isInteger(numericBagCount) || numericBagCount < 0)) {
      setErrorMsg('Bag/bin count must be a whole number or left blank.');
      return;
    }

    setIsUploading(true);
    setErrorMsg('');

    try {
      const metricTons = numericMeasurement / 1000;
      const result = await submitPickupCompletion({
        scheduleId,
        imageUri,
        location: geoCoords,
        description: description.trim(),
        measurement: { value: metricTons, unit: 'ton', bagCount: numericBagCount },
      });
      {
        const completionData: PickupCompletionData = {
          imageUrl: result.imageUrl || '',
          location: geoCoords,
          description: description.trim(),
          measurement: { value: metricTons, unit: 'ton', bagCount: numericBagCount },
        };
        onSubmit?.(completionData);
        if (result.queued) Alert.alert('Saved offline', 'Completion evidence will upload automatically when internet access returns.');
        // Reset states
        setImageUri(null);
        setDescription('');
        setGeoCoords(null);
        setMeasurementValue('');
        setBagCount('');
      }
    } catch {
      setErrorMsg('An error occurred during submission.');
    } finally {
      setIsUploading(false);
    }
  };

  const handleClose = () => {
    setImageUri(null);
    setDescription('');
    setGeoCoords(null);
    setMeasurementValue('');
    setBagCount('');
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

          <View style={styles.measurementRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.label}>Collected weight *</Text>
              <View style={styles.measurementInputWrap}>
                <TextInput
                  style={styles.measurementInput}
                  value={measurementValue}
                  onChangeText={setMeasurementValue}
                  keyboardType="decimal-pad"
                  placeholder="e.g. 125"
                />
                <View style={styles.fixedUnitBadge}>
                  <Text style={styles.fixedUnitText}>kg</Text>
                </View>
              </View>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.label}>Bags/bins (optional)</Text>
              <TextInput
                style={styles.compactInput}
                value={bagCount}
                onChangeText={setBagCount}
                keyboardType="number-pad"
                placeholder="e.g. 12"
              />
            </View>
          </View>
          <Text style={styles.measurementHint}>
            {Number.isFinite(Number(measurementValue)) && Number(measurementValue) > 0
              ? `Displayed as ${formatAdaptiveMassFromMetricTons(Number(measurementValue) / 1000)}`
              : 'At 1,000 kg, the system automatically displays the weight as 1 t.'}
          </Text>

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
  measurementRow: { flexDirection: 'row', gap: 12, marginBottom: 10 },
  compactInput: { borderWidth: 1, borderColor: '#D1D5DB', borderRadius: 8, padding: 12, backgroundColor: '#FFFFFF' },
  measurementInputWrap: { flexDirection: 'row', borderWidth: 1, borderColor: '#D1D5DB', borderRadius: 8, backgroundColor: '#FFFFFF', overflow: 'hidden' },
  measurementInput: { flex: 1, minWidth: 70, paddingHorizontal: 12, paddingVertical: 12 },
  fixedUnitBadge: { justifyContent: 'center', paddingHorizontal: 10, backgroundColor: '#E8F5E9', borderLeftWidth: 1, borderLeftColor: '#C8D8CA' },
  fixedUnitText: { color: '#3B5241', fontSize: 10, fontWeight: '800' },
  measurementHint: { color: '#6B7280', fontSize: 11, marginBottom: 18 },
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
