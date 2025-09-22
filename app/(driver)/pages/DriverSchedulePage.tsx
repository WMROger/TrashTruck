import { IconSymbol } from '@/components/ui/IconSymbol';
import { auth, db } from '@/config/firebase';
import { Colors } from '@/constants/Colors';
import { useTheme } from '@/hooks/useTheme';
import * as ImagePicker from 'expo-image-picker';
import { addDoc, collection, doc, onSnapshot, query, serverTimestamp, updateDoc, where } from 'firebase/firestore';
import React, { useEffect, useState } from 'react';
import { Image, Modal, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import ErrorModal from '../../../components/ErrorModal';
import driverImageService from '../../../services/driverImageService';

interface DriverSchedulePageProps {
  // Add any props you might need
}

interface Schedule {
  id: string;
  dateText: string;
  timeText: string;
  street: string;
  wasteCategory: string;
  driver: string;
  status?: string;
  note?: string;
  frequency?: string;
  createdAt: any;
}

export default function DriverSchedulePage({}: DriverSchedulePageProps) {
  const { theme } = useTheme();
  const colors = Colors[theme ?? 'light'];
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Complete pickup modal state
  const [showCompleteModal, setShowCompleteModal] = useState(false);
  const [selectedPickup, setSelectedPickup] = useState<Schedule | null>(null);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [selectedImageUri, setSelectedImageUri] = useState<string | null>(null);
  const [description, setDescription] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [errorModal, setErrorModal] = useState({
    visible: false,
    title: 'Error',
    message: '',
    type: 'error' as 'error' | 'warning' | 'info' | 'success',
  });

  // Fetch schedules for the current driver
  useEffect(() => {
    if (!db || !auth?.currentUser) {
      setLoading(false);
      return;
    }

    const currentUser = auth.currentUser;
    
    // Query schedules where driver matches current user's display name or email
    const driverName = currentUser.displayName || currentUser.email || 'Unknown Driver';
    const q = query(
      collection(db, 'schedules'),
      where('driver', '==', driverName)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const scheduleData: Schedule[] = [];
      snapshot.forEach((doc) => {
        const data = doc.data();
        scheduleData.push({
          id: doc.id,
          dateText: data.dateText,
          timeText: data.timeText,
          street: data.street,
          wasteCategory: data.wasteCategory,
          driver: data.driver,
          status: data.status || 'pending',
          note: data.note,
          frequency: data.frequency,
          createdAt: data.createdAt,
        });
      });
      
      // Exclude completed or issue statuses from the active schedule list
      const active = scheduleData.filter((s) => {
        const st = (s.status || 'pending').toLowerCase();
        return st !== 'completed' && st !== 'issue' && st !== 'resolved' && st !== 'done';
      });

      // Sort by date and time
      active.sort((a, b) => {
        const dateA = new Date(a.dateText);
        const dateB = new Date(b.dateText);
        if (dateA.getTime() === dateB.getTime()) {
          return a.timeText.localeCompare(b.timeText);
        }
        return dateA.getTime() - dateB.getTime();
      });
      
      setSchedules(active);
      setLoading(false);
    }, (error) => {
      console.error('Error fetching schedules:', error);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  // Show error modal
  const showError = (message: string, title = 'Error', type: 'error' | 'warning' | 'info' | 'success' = 'error') => {
    setErrorModal({
      visible: true,
      title,
      message,
      type,
    });
  };

  // Close error modal
  const closeErrorModal = () => {
    setErrorModal(prev => ({ ...prev, visible: false }));
  };

  const handleCompletePickup = (pickup: Schedule) => {
    setSelectedPickup(pickup);
    setShowCompleteModal(true);
    setSelectedImage(null);
    setSelectedImageUri(null);
    setDescription('');
  };

  const handleReportIssue = (pickup: Schedule) => {
    setSelectedPickup(pickup);
    setShowCompleteModal(true);
    setSelectedImage(null);
    setSelectedImageUri(null);
    setDescription('');
  };

  const handleImagePicker = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [4, 3],
        quality: 0.8,
        base64: true, // Enable base64 for web compatibility
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const asset = result.assets[0];
        const imageUri = typeof asset.uri === 'string' ? asset.uri : String(asset.uri);
        const base64 = asset.base64;
        
        console.log('Image picker result:', { imageUri, base64: base64 ? 'present' : 'missing' });
        
        // Use base64 data URI for web compatibility
        if (base64) {
          const dataUri = `data:image/jpeg;base64,${base64}`;
          setSelectedImage(dataUri);
          setSelectedImageUri(dataUri); // Use data URI for upload too
        } else {
          setSelectedImage(imageUri);
          setSelectedImageUri(imageUri);
        }
      }
    } catch (error) {
      console.error('Error picking image:', error);
      showError('Failed to pick image from gallery', 'Image Selection Error', 'error');
    }
  };

  const handleCameraCapture = async () => {
    try {
      const result = await ImagePicker.launchCameraAsync({
        allowsEditing: true,
        aspect: [4, 3],
        quality: 0.8,
        base64: true, // Enable base64 for web compatibility
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const asset = result.assets[0];
        const imageUri = typeof asset.uri === 'string' ? asset.uri : String(asset.uri);
        const base64 = asset.base64;
        
        console.log('Camera capture result:', { imageUri, base64: base64 ? 'present' : 'missing' });
        
        // Use base64 data URI for web compatibility
        if (base64) {
          const dataUri = `data:image/jpeg;base64,${base64}`;
          setSelectedImage(dataUri);
          setSelectedImageUri(dataUri); // Use data URI for upload too
        } else {
          setSelectedImage(imageUri);
          setSelectedImageUri(imageUri);
        }
      }
    } catch (error) {
      console.error('Error capturing image:', error);
      showError('Failed to capture image from camera', 'Camera Error', 'error');
    }
  };

  const handleSubmitReport = async () => {
    if (!selectedPickup || !db) return;
    
    setSubmitting(true);
    
    try {
      let cloudinaryImageUrl = null;
      
      // Upload image to Cloudinary if one was selected
      if (selectedImageUri) {
        // Ensure we have a string URI
        const imageUriString = typeof selectedImageUri === 'string' ? selectedImageUri : String(selectedImageUri);
        
        console.log('Uploading image to Cloudinary...', {
          uri: imageUriString.substring(0, 50) + '...',
          type: typeof imageUriString,
          isDataUri: imageUriString.startsWith('data:'),
          isFileUri: imageUriString.startsWith('file:')
        });
        
        const uploadResult = await driverImageService.uploadCompletionImage(imageUriString);
        
        if (uploadResult.success && uploadResult.url) {
          cloudinaryImageUrl = uploadResult.url;
          console.log('Image uploaded successfully:', cloudinaryImageUrl);
        } else {
          console.error('Image upload failed:', uploadResult.error);
          showError(
            uploadResult.error || 'Failed to upload image. Please try again.',
            'Upload Error',
            'error'
          );
          setSubmitting(false);
          return;
        }
      }

      // Check if this is a recurring schedule
      const isRecurring = selectedPickup.frequency && 
        ['daily', 'weekly', 'monthly'].includes(selectedPickup.frequency.toLowerCase());
      
      if (isRecurring) {
        // For recurring schedules, create a completion instance instead of updating the original
        const completionData = {
          // Copy original schedule data
          dateText: selectedPickup.dateText,
          timeText: selectedPickup.timeText,
          street: selectedPickup.street,
          wasteCategory: selectedPickup.wasteCategory,
          driver: selectedPickup.driver,
          note: selectedPickup.note,
          frequency: selectedPickup.frequency,
          originalScheduleId: selectedPickup.id, // Reference to original recurring schedule
          
          // Add completion data
          status: 'completed',
          completedAt: serverTimestamp(),
          completionImage: cloudinaryImageUrl,
          completionImagePublicId: cloudinaryImageUrl ? driverImageService.extractPublicId(cloudinaryImageUrl) : null,
          completionDescription: description,
          completedBy: auth.currentUser?.email || 'Unknown Driver',
          completedByEmail: auth.currentUser?.email || undefined,
          completedByUid: auth.currentUser?.uid || undefined,
          completedByName: auth.currentUser?.displayName || auth.currentUser?.email || 'Unknown Driver',
          
          // Mark as completion instance
          isCompletionInstance: true,
          completionDate: new Date().toISOString(),
        };
        
        // Add completion instance to a separate collection
        await addDoc(collection(db, 'pickupCompletions'), completionData);
        
        console.log('Created completion instance for recurring schedule:', selectedPickup.id);
      } else {
        // For one-time schedules, update the original record
        await updateDoc(doc(db, 'schedules', selectedPickup.id), {
          status: 'completed',
          completedAt: serverTimestamp(),
          completionImage: cloudinaryImageUrl,
          completionImagePublicId: cloudinaryImageUrl ? driverImageService.extractPublicId(cloudinaryImageUrl) : null,
          completionDescription: description,
          completedBy: auth.currentUser?.email || 'Unknown Driver',
          completedByEmail: auth.currentUser?.email || undefined,
          completedByUid: auth.currentUser?.uid || undefined,
          completedByName: auth.currentUser?.displayName || auth.currentUser?.email || 'Unknown Driver',
        });
        
        console.log('Updated one-time schedule as completed:', selectedPickup.id);
      }
      
      console.log('Pickup marked as completed with report');
      
      // Close modal and reset state
      setShowCompleteModal(false);
      setSelectedPickup(null);
      setSelectedImage(null);
      setSelectedImageUri(null);
      setDescription('');
      
      showError('Pickup completed successfully!', 'Success', 'success');
      
    } catch (error) {
      console.error('Error completing pickup:', error);
      showError(
        'Failed to complete pickup. Please try again.',
        'Completion Error',
        'error'
      );
    } finally {
      setSubmitting(false);
    }
  };

  const handleCancelReport = () => {
    setShowCompleteModal(false);
    setSelectedPickup(null);
    setSelectedImage(null);
    setSelectedImageUri(null);
    setDescription('');
  };

  // Filter schedules by today and tomorrow
  const getTodaySchedules = () => {
    const today = new Date();
    const todayStr = today.toLocaleDateString('en-US', { 
      month: 'long', 
      day: 'numeric', 
      year: 'numeric' 
    });
    
    return schedules.filter(schedule => schedule.dateText === todayStr);
  };

  const getTomorrowSchedules = () => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowStr = tomorrow.toLocaleDateString('en-US', { 
      month: 'long', 
      day: 'numeric', 
      year: 'numeric' 
    });
    
    return schedules.filter(schedule => schedule.dateText === tomorrowStr);
  };

  const todaySchedule = getTodaySchedules();
  const tomorrowSchedule = getTomorrowSchedules();

  // Check if pickup is for today (actionable)
  const isTodayPickup = (item: Schedule) => {
    const today = new Date();
    const todayStr = today.toLocaleDateString('en-US', { 
      month: 'long', 
      day: 'numeric', 
      year: 'numeric' 
    });
    return item.dateText === todayStr;
  };

  const PickupCard = ({ item }: { item: Schedule }) => {
    const isToday = isTodayPickup(item);
    
    return (
      <View style={[styles.pickupCard, { backgroundColor: colors.primary }]}>
        <Text style={[styles.barangayName, { color: colors.surface }]}>{item.street}</Text>
        
        <View style={styles.detailRow}>
          <IconSymbol name="location.fill" size={14} color={colors.surface} />
          <Text style={[styles.detailText, { color: colors.surface }]}>Street Name: "{item.street}"</Text>
        </View>
        
        <View style={styles.detailRow}>
          <IconSymbol name="clock.fill" size={14} color={colors.surface} />
          <Text style={[styles.detailText, { color: colors.surface }]}>Time: {item.timeText}</Text>
        </View>
        
        <Text style={[styles.detailText, { color: colors.surface }]}>Type: {item.wasteCategory}</Text>
        
        {item.note && (
          <Text style={[styles.noteText, { color: colors.surface }]}>Note: {item.note}</Text>
        )}
        
        {/* Only show action buttons for today's pickups */}
        {isToday ? (
          <View style={styles.actionButtons}>
            <TouchableOpacity 
              style={styles.completeBtn}
              onPress={() => handleCompletePickup(item)}
            >
              <IconSymbol name="checkmark.circle.fill" size={16} color="#FFFFFF" />
              <Text style={styles.btnText}>Complete</Text>
            </TouchableOpacity>
            <TouchableOpacity 
              style={styles.issueBtn}
              onPress={() => handleReportIssue(item)}
            >
              <IconSymbol name="exclamationmark.triangle.fill" size={16} color="#FFFFFF" />
              <Text style={styles.btnText}>Issue</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={[styles.futurePickupInfo, { backgroundColor: colors.secondary }]}>
            <Text style={[styles.futurePickupText, { color: colors.textPrimary }]}>
              📅 Scheduled for {item.dateText}
            </Text>
            <Text style={[styles.futurePickupSubtext, { color: colors.textSecondary }]}>
              Complete/Issue buttons will appear on the scheduled date
            </Text>
          </View>
        )}
      </View>
    );
  };

  if (loading) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={styles.header}>
          <Text style={[styles.title, { color: colors.textPrimary }]}>Schedule</Text>
          <Text style={[styles.subtitle, { color: colors.textSecondary }]}>Loading your assigned pickups...</Text>
        </View>
        <View style={styles.loadingContainer}>
          <Text style={[styles.loadingText, { color: colors.textSecondary }]}>Loading schedules...</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={styles.header}>
        <Text style={[styles.title, { color: colors.textPrimary }]}>Schedule</Text>
        <Text style={[styles.subtitle, { color: colors.textSecondary }]}>Your list of assigned pickups for today.</Text>
      </View>

      <View style={styles.section}>
        <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>Today</Text>
        {todaySchedule.length > 0 ? (
          todaySchedule.map((item) => (
            <PickupCard key={item.id} item={item} />
          ))
        ) : (
          <View style={styles.emptyState}>
            <Text style={[styles.emptyText, { color: colors.textSecondary }]}>No pickups scheduled for today</Text>
          </View>
        )}
      </View>

      <View style={styles.section}>
        <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>Tomorrow</Text>
        {tomorrowSchedule.length > 0 ? (
          tomorrowSchedule.map((item) => (
            <PickupCard key={item.id} item={item} />
          ))
        ) : (
          <View style={styles.emptyState}>
            <Text style={[styles.emptyText, { color: colors.textSecondary }]}>No pickups scheduled for tomorrow</Text>
          </View>
        )}
      </View>

      {/* Complete Pickup Modal */}
      <Modal
        visible={showCompleteModal}
        transparent={true}
        animationType="slide"
        onRequestClose={handleCancelReport}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Text style={[styles.modalTitle, { color: colors.textPrimary }]}>Complete Pickup Report</Text>
            
            {/* Pickup Details */}
            <View style={styles.pickupDetails}>
              <Text style={[styles.detailLabel, { color: colors.textPrimary }]}>Location: {selectedPickup?.street}</Text>
              <Text style={[styles.detailLabel, { color: colors.textPrimary }]}>Waste Type: {selectedPickup?.wasteCategory}</Text>
            </View>

            {/* Add Photo Section */}
            <View style={styles.photoSection}>
              <Text style={styles.sectionLabel}>Add Photo</Text>
              <TouchableOpacity 
                style={styles.photoContainer}
                onPress={handleImagePicker}
              >
                {selectedImage ? (
                  <Image source={{ uri: selectedImage }} style={styles.selectedImage} />
                ) : (
                  <View style={styles.photoPlaceholder}>
                    <Text style={styles.photoIcon}>📷</Text>
                    <Text style={styles.photoText}>Add photo</Text>
                  </View>
                )}
              </TouchableOpacity>
              
              <View style={styles.photoButtons}>
                <TouchableOpacity 
                  style={styles.photoButton}
                  onPress={handleImagePicker}
                >
                  <IconSymbol name="photo.fill" size={16} color="#FFFFFF" />
                  <Text style={styles.photoButtonText}>Gallery</Text>
                </TouchableOpacity>
                <TouchableOpacity 
                  style={styles.photoButton}
                  onPress={handleCameraCapture}
                >
                  <IconSymbol name="camera.fill" size={16} color="#FFFFFF" />
                  <Text style={styles.photoButtonText}>Camera</Text>
                </TouchableOpacity>
              </View>
            </View>
            {/* Add Description Section */}
            <View style={styles.descriptionSection}>
              <Text style={styles.sectionLabel}>Add Description:</Text>
              <TextInput
                style={styles.descriptionInput}
                placeholder="Enter pickup details, issues, or notes..."
                value={description}
                onChangeText={setDescription}
                multiline
                numberOfLines={4}
                textAlignVertical="top"
              />
            </View>

            {/* Action Buttons */}
            <View style={styles.modalButtons}>
              <TouchableOpacity 
                style={styles.cancelButton}
                onPress={handleCancelReport}
                disabled={submitting}
              >
                <IconSymbol name="xmark.circle.fill" size={16} color="#FFFFFF" />
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              
              <TouchableOpacity 
                style={[styles.submitButton, submitting && styles.submitButtonDisabled]}
                onPress={handleSubmitReport}
                disabled={submitting}
              >
                <IconSymbol name="checkmark.circle.fill" size={16} color="#FFFFFF" />
                <Text style={styles.submitButtonText}>
                  {submitting ? 'Submitting...' : 'Submit Report'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

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
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#E8F5E8',
    paddingHorizontal: 16,
    paddingTop: 20,
  },
  header: {
    marginBottom: 24,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#000',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#666',
    fontWeight: '400',
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#000',
    marginBottom: 12,
  },
  pickupCard: {
    backgroundColor: '#2D5016',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  },
  barangayName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 12,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  detailText: {
    fontSize: 14,
    color: '#fff',
    marginLeft: 8,
  },
  actionButtons: {
    flexDirection: 'row',
    marginTop: 16,
    gap: 12,
  },
  completeBtn: {
    backgroundColor: '#4CAF50',
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 8,
    flex: 1,
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 6,
  },
  issueBtn: {
    backgroundColor: '#FF9800',
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 8,
    flex: 1,
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 6,
  },
  btnText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 14,
  },
  noteText: {
    fontSize: 12,
    color: '#fff',
    marginTop: 4,
    fontStyle: 'italic',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 40,
  },
  loadingText: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
  },
  emptyState: {
    backgroundColor: '#f8f9fa',
    borderRadius: 8,
    padding: 20,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#e9ecef',
  },
  emptyText: {
    fontSize: 14,
    color: '#6c757d',
    textAlign: 'center',
  },
  // Modal styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContent: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 20,
    width: '100%',
    maxHeight: '80%',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#000',
    marginBottom: 16,
    textAlign: 'center',
  },
  pickupDetails: {
    backgroundColor: '#f8f9fa',
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
  },
  detailLabel: {
    fontSize: 14,
    color: '#333',
    marginBottom: 4,
  },
  photoSection: {
    marginBottom: 16,
  },
  sectionLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  photoContainer: {
    borderWidth: 2,
    borderColor: '#ddd',
    borderStyle: 'dashed',
    borderRadius: 8,
    height: 120,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  selectedImage: {
    width: '100%',
    height: '100%',
    borderRadius: 6,
  },
  photoPlaceholder: {
    alignItems: 'center',
  },
  photoIcon: {
    fontSize: 32,
    marginBottom: 8,
  },
  photoText: {
    fontSize: 14,
    color: '#666',
  },
  photoButtons: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  photoButton: {
    backgroundColor: '#007bff',
    paddingHorizontal: 20,
    paddingVertical: 8,
    borderRadius: 6,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  photoButtonText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '500',
  },
  descriptionSection: {
    marginBottom: 20,
  },
  descriptionInput: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 12,
    fontSize: 14,
    minHeight: 80,
    textAlignVertical: 'top',
  },
  modalButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
  },
  cancelButton: {
    flex: 1,
    backgroundColor: '#6c757d',
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 6,
  },
  cancelButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  submitButton: {
    flex: 1,
    backgroundColor: '#28a745',
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 6,
  },
  submitButtonDisabled: {
    backgroundColor: '#6c757d',
  },
  submitButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  // Future pickup styles
  futurePickupInfo: {
    backgroundColor: '#f8f9fa',
    borderRadius: 8,
    padding: 12,
    marginTop: 8,
    borderLeftWidth: 4,
    borderLeftColor: '#17a2b8',
  },
  futurePickupText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#17a2b8',
    marginBottom: 4,
  },
  futurePickupSubtext: {
    fontSize: 12,
    color: '#6c757d',
    fontStyle: 'italic',
  },
});
