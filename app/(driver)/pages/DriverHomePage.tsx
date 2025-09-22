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

interface DriverHomePageProps {
  onTabChange?: (tab: string) => void;
}

interface PickupData {
  id: string;
  dateText: string;
  timeText: string;
  street: string;
  wasteCategory: string;
  status: string;
  note?: string;
  frequency?: string;
  createdAt: any;
  completedAt?: any;
  completionImage?: string;
}

export default function DriverHomePage({ onTabChange }: DriverHomePageProps) {
  const { theme } = useTheme();
  const colors = Colors[theme ?? 'light'];
  const [nextPickup, setNextPickup] = useState<PickupData | null>(null);
  const [recentHistory, setRecentHistory] = useState<PickupData[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Complete pickup modal state
  const [showCompleteModal, setShowCompleteModal] = useState(false);
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

  // Fetch next pickup and recent history
  useEffect(() => {
    if (!db || !auth?.currentUser) {
      console.log('No db or user available');
      setLoading(false);
      return;
    }

    const currentUser = auth.currentUser;
    const driverName = currentUser.displayName || currentUser.email || 'Unknown Driver';
    console.log('Fetching data for driver:', driverName);
    console.log('User displayName:', currentUser.displayName);
    console.log('User email:', currentUser.email);

    // First, let's get all schedules to see what's in the database
    const allSchedulesQuery = query(collection(db, 'schedules'));
    const unsubscribeAll = onSnapshot(allSchedulesQuery, (snapshot) => {
      console.log('All schedules in database:', snapshot.docs.length);
      snapshot.forEach((doc) => {
        const data = doc.data();
        console.log('Schedule:', doc.id, 'Driver:', data.driver, 'Status:', data.status);
      });
    });

    // Query for next pickup (pending status or undefined status)
    const nextPickupQuery = query(
      collection(db, 'schedules'),
      where('driver', '==', driverName)
    );

    // Fallback query using email if displayName doesn't match
    const nextPickupQueryFallback = query(
      collection(db, 'schedules'),
      where('driver', '==', currentUser.email)
    );

    // Query for recent completed history (completed status only)
    const historyQuery = query(
      collection(db, 'schedules'),
      where('driver', '==', driverName)
    );

    // Fallback query using email for history
    const historyQueryFallback = query(
      collection(db, 'schedules'),
      where('driver', '==', currentUser.email)
    );

    let nextPickupData: any[] = [];
    let historyData: any[] = [];

    const processNextPickup = () => {
      const today = new Date();
      const todayStr = today.toLocaleDateString('en-US', { 
        month: 'long', 
        day: 'numeric', 
        year: 'numeric' 
      });
      
      // Filter for pending/undefined status and today's date only (actionable pickups)
      const upcomingPickups = nextPickupData
        .filter(pickup => {
          const isPending = !pickup.status || pickup.status === 'pending' || pickup.status === undefined;
          const isToday = pickup.dateText === todayStr; // Only today's pickups are actionable
          console.log('Pickup filter:', pickup.street, 'Status:', pickup.status, 'IsPending:', isPending, 'IsToday:', isToday);
          return isPending && isToday;
        })
        .sort((a, b) => {
          if (a.dateText === b.dateText) {
            return a.timeText.localeCompare(b.timeText);
          }
          return a.dateText.localeCompare(b.dateText);
        });

      console.log('Upcoming pickups after filtering:', upcomingPickups.length);
      if (upcomingPickups.length > 0) {
        setNextPickup(upcomingPickups[0]);
      } else {
        setNextPickup(null);
      }
    };

    const processHistory = () => {
      // Filter for completed status and sort by completedAt, take only the last 2
      const completedHistory = historyData.filter(pickup => {
        const isCompleted = pickup.status === 'completed';
        console.log('History filter:', pickup.street, 'Status:', pickup.status, 'IsCompleted:', isCompleted);
        return isCompleted;
      });
      
      const sortedHistory = completedHistory
        .sort((a, b) => {
          if (a.completedAt && b.completedAt) {
            return b.completedAt.toMillis() - a.completedAt.toMillis();
          }
          return 0;
        })
        .slice(0, 2);
        
      console.log('Recent history after processing:', sortedHistory.length);
      setRecentHistory(sortedHistory);
      setLoading(false);
    };

    const unsubscribeNext = onSnapshot(nextPickupQuery, (snapshot) => {
      console.log('Next pickup query result (displayName):', snapshot.docs.length, 'documents');
      
      nextPickupData = snapshot.docs.map(doc => {
        const data = doc.data();
        console.log('Pickup data:', data);
        return {
          id: doc.id,
          dateText: data.dateText,
          timeText: data.timeText,
          street: data.street,
          wasteCategory: data.wasteCategory,
          status: data.status || 'pending', // Default to pending if undefined
          note: data.note,
          frequency: data.frequency,
          createdAt: data.createdAt,
          completedAt: data.completedAt,
          completionImage: data.completionImage,
        };
      });
      
      processNextPickup();
    }, (error) => {
      console.error('Error fetching next pickup (displayName):', error);
    });

    const unsubscribeNextFallback = onSnapshot(nextPickupQueryFallback, (snapshot) => {
      console.log('Next pickup query result (email):', snapshot.docs.length, 'documents');
      
      if (snapshot.docs.length > 0) {
        nextPickupData = snapshot.docs.map(doc => {
          const data = doc.data();
          console.log('Pickup data (email):', data);
          return {
            id: doc.id,
            dateText: data.dateText,
            timeText: data.timeText,
            street: data.street,
            wasteCategory: data.wasteCategory,
            status: data.status || 'pending', // Default to pending if undefined
            note: data.note,
            createdAt: data.createdAt,
            completedAt: data.completedAt,
            completionImage: data.completionImage,
          };
        });
        
        processNextPickup();
      }
    }, (error) => {
      console.error('Error fetching next pickup (email):', error);
    });

    const unsubscribeHistory = onSnapshot(historyQuery, (snapshot) => {
      console.log('History query result (displayName):', snapshot.docs.length, 'documents');
      
      historyData = snapshot.docs.map(doc => {
        const data = doc.data();
        console.log('History data:', data);
        return {
          id: doc.id,
          dateText: data.dateText,
          timeText: data.timeText,
          street: data.street,
          wasteCategory: data.wasteCategory,
          status: data.status || 'pending', // Default to pending if undefined
          note: data.note,
          frequency: data.frequency,
          createdAt: data.createdAt,
          completedAt: data.completedAt,
          completionImage: data.completionImage,
        };
      });
      
      processHistory();
    }, (error) => {
      console.error('Error fetching history (displayName):', error);
    });

    const unsubscribeHistoryFallback = onSnapshot(historyQueryFallback, (snapshot) => {
      console.log('History query result (email):', snapshot.docs.length, 'documents');
      
      if (snapshot.docs.length > 0) {
        historyData = snapshot.docs.map(doc => {
          const data = doc.data();
          console.log('History data (email):', data);
          return {
            id: doc.id,
            dateText: data.dateText,
            timeText: data.timeText,
            street: data.street,
            wasteCategory: data.wasteCategory,
            status: data.status || 'pending', // Default to pending if undefined
            note: data.note,
            createdAt: data.createdAt,
            completedAt: data.completedAt,
            completionImage: data.completionImage,
          };
        });
        
        processHistory();
      }
    }, (error) => {
      console.error('Error fetching history (email):', error);
    });

    return () => {
      unsubscribeAll();
      unsubscribeNext();
      unsubscribeNextFallback();
      unsubscribeHistory();
      unsubscribeHistoryFallback();
    };
  }, []);

  const handleCompletePickup = () => {
    setShowCompleteModal(true);
  };

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
    if (!nextPickup || !db) return;
    
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
      const isRecurring = nextPickup.frequency && 
        ['daily', 'weekly', 'monthly'].includes(nextPickup.frequency.toLowerCase());
      
      if (isRecurring) {
        // For recurring schedules, create a completion instance instead of updating the original
        const completionData = {
          // Copy original schedule data
          dateText: nextPickup.dateText,
          timeText: nextPickup.timeText,
          street: nextPickup.street,
          wasteCategory: nextPickup.wasteCategory,
          driver: nextPickup.driver,
          note: nextPickup.note,
          frequency: nextPickup.frequency,
          originalScheduleId: nextPickup.id, // Reference to original recurring schedule
          
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
        
        console.log('Created completion instance for recurring schedule:', nextPickup.id);
      } else {
        // For one-time schedules, update the original record
        await updateDoc(doc(db, 'schedules', nextPickup.id), {
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
        
        console.log('Updated one-time schedule as completed:', nextPickup.id);
      }
      
      console.log('Pickup marked as completed with report');
      
      // Show success notification
      showError(
        'Pickup completed successfully! Report has been submitted.',
        'Success!',
        'success'
      );
      
      // Reset form after a short delay
      setTimeout(() => {
        setShowCompleteModal(false);
        setSelectedImage(null);
        setSelectedImageUri(null);
        setDescription('');
      }, 2000);
      
    } catch (error) {
      console.error('Error completing pickup:', error);
      showError(
        'Failed to complete pickup. Please try again.',
        'Submission Error',
        'error'
      );
    } finally {
      setSubmitting(false);
    }
  };

  const handleCancelReport = () => {
    setShowCompleteModal(false);
    setSelectedImage(null);
    setSelectedImageUri(null);
    setDescription('');
  };

  const handleReportIssue = async () => {
    if (!nextPickup || !db) return;
    
    try {
      await updateDoc(doc(db, 'schedules', nextPickup.id), {
        status: 'issue',
        completedAt: serverTimestamp(),
      });
      console.log('Pickup marked as having issue');
    } catch (error) {
      console.error('Error reporting issue:', error);
    }
  };

  if (loading) {
    return (
      <View style={styles.container}>
        <View style={styles.loadingContainer}>
          <Text style={styles.loadingText}>Loading your data...</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <View style={styles.cardHeader}>
          <Text style={[styles.cardTitle, { color: colors.textPrimary }]}>Next Pickup</Text>
          <TouchableOpacity 
            style={styles.seeAllBtn}
            onPress={() => onTabChange?.('schedule')}
          >
            <Text style={[styles.seeAllText, { color: colors.primary }]}>See all</Text>
          </TouchableOpacity>
        </View>
        {nextPickup ? (
          <View style={styles.nextPickup}>
            <Text style={[styles.label, { color: colors.textPrimary }]}>{nextPickup.street}</Text>
            <Text style={[styles.line, { color: colors.textSecondary }]}>• Street: {nextPickup.street}</Text>
            <Text style={[styles.line, { color: colors.textSecondary }]}>• Time: {nextPickup.timeText}</Text>
            <Text style={[styles.line, { color: colors.textSecondary }]}>• Type: {nextPickup.wasteCategory}</Text>
            {nextPickup.note && (
              <Text style={[styles.line, { color: colors.textSecondary }]}>• Note: {nextPickup.note}</Text>
            )}
            <View style={styles.actionsRow}>
              <TouchableOpacity 
                style={[styles.btn, styles.btnSuccess]}
                onPress={handleCompletePickup}
              >
                <IconSymbol name="checkmark.circle.fill" size={16} color="#FFFFFF" />
                <Text style={styles.btnText}>Complete</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={[styles.btn, styles.btnWarn]}
                onPress={handleReportIssue}
              >
                <IconSymbol name="exclamationmark.triangle.fill" size={16} color="#FFFFFF" />
                <Text style={styles.btnText}>Issue</Text>
              </TouchableOpacity>
            </View>
          </View>
        ) : (
          <View style={styles.emptyState}>
            <Text style={[styles.emptyText, { color: colors.textSecondary }]}>No upcoming pickups scheduled</Text>
          </View>
        )}
      </View>

      <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <View style={styles.cardHeader}>
          <Text style={[styles.cardTitle, { color: colors.textPrimary }]}>Your History</Text>
          <TouchableOpacity 
            style={styles.seeAllBtn}
            onPress={() => onTabChange?.('history')}
          >
            <Text style={[styles.seeAllText, { color: colors.primary }]}>See all</Text>
          </TouchableOpacity>
        </View>
        {recentHistory.length > 0 ? (
          <View style={styles.historyRow}>
            {recentHistory.map((item) => (
              <View key={item.id} style={styles.historyItem}>
                <Image 
                  source={
                    item.completionImage 
                      ? { uri: item.completionImage } 
                      : require('../../../assets/images/icon.png')
                  } 
                  style={styles.historyImage}
                  onError={() => {
                    console.log('Image failed to load:', item.completionImage);
                  }}
                  defaultSource={require('../../../assets/images/icon.png')}
                />
                <View style={styles.historyMeta}>
                  <Text style={[styles.historyText, { color: colors.textSecondary }]}>Street: "{item.street}"</Text>
                  <Text style={[styles.historyText, { color: colors.textSecondary }]}>Type: {item.wasteCategory}</Text>
                  <Text style={[styles.historyText, { color: colors.textSecondary }]}>Date: {item.dateText}</Text>
                  <Text style={[styles.historyStatus, { color: colors.success }]}>{item.status}</Text>
                </View>
              </View>
            ))}
          </View>
        ) : (
          <View style={styles.emptyState}>
            <Text style={[styles.emptyText, { color: colors.textSecondary }]}>No completed pickups yet</Text>
          </View>
        )}
      </View>

      {/* Complete Pickup Report Modal */}
      <Modal
        visible={showCompleteModal}
        transparent
        animationType="fade"
        onRequestClose={handleCancelReport}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContainer, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Text style={[styles.modalTitle, { color: colors.textPrimary }]}>Complete Pickup Report</Text>
            
            {/* Pickup Details */}
            <View style={styles.pickupDetails}>
              <Text style={styles.detailLabel}>Location: {nextPickup?.street}</Text>
              <Text style={styles.detailLabel}>Waste Type: {nextPickup?.wasteCategory}</Text>
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
  },
  card: {
    backgroundColor: '#F5FFF5',
    marginHorizontal: 16,
    marginTop: 12,
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: '#CBE5CB',
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#2f3a31',
  },
  seeAllBtn: {
    paddingVertical: 4,
    paddingHorizontal: 8,
  },
  seeAllText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#2E8B57',
  },
  nextPickup: {
    backgroundColor: '#5D815D',
    borderRadius: 12,
    padding: 12,
  },
  label: {
    color: '#E7F6E7',
    fontWeight: '700',
    marginBottom: 6,
  },
  line: {
    color: '#E7F6E7',
    marginBottom: 4,
  },
  actionsRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 10,
  },
  btn: {
    backgroundColor: '#234033',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  btnText: {
    color: '#fff',
    fontWeight: '700',
  },
  btnSuccess: { backgroundColor: '#2E8B57' },
  btnWarn: { backgroundColor: '#d97706' },
  // History Styles
  historyRow: {
    flexDirection: 'row',
    gap: 12,
  },
  historyItem: {
    flex: 1,
    backgroundColor: '#fff',
    borderRadius: 10,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#DDEEDB',
  },
  historyImage: {
    width: '100%',
    height: 80,
  },
  historyMeta: {
    padding: 8,
  },
  historyText: {
    fontSize: 12,
    color: '#2f3a31',
    marginBottom: 2,
  },
  historyStatus: {
    fontSize: 11,
    color: '#2E8B57',
    fontWeight: '700',
    marginTop: 4,
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
  modalContainer: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 20,
    width: '100%',
    maxWidth: 400,
    maxHeight: '90%',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#2f3a31',
    textAlign: 'center',
    marginBottom: 20,
  },
  pickupDetails: {
    backgroundColor: '#f8f9fa',
    borderRadius: 8,
    padding: 15,
    marginBottom: 20,
  },
  detailLabel: {
    fontSize: 14,
    color: '#2f3a31',
    marginBottom: 5,
  },
  photoSection: {
    marginBottom: 20,
  },
  sectionLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#2f3a31',
    marginBottom: 10,
  },
  photoContainer: {
    backgroundColor: '#f8f9fa',
    borderRadius: 8,
    height: 120,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#e9ecef',
    marginBottom: 10,
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
    color: '#6c757d',
  },
  selectedImage: {
    width: '100%',
    height: '100%',
    borderRadius: 8,
  },
  photoButtons: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  photoButton: {
    backgroundColor: '#2E8B57',
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
    fontWeight: '600',
  },
  descriptionSection: {
    marginBottom: 20,
  },
  descriptionInput: {
    borderWidth: 1,
    borderColor: '#e9ecef',
    borderRadius: 8,
    padding: 12,
    fontSize: 14,
    color: '#2f3a31',
    backgroundColor: '#f8f9fa',
    minHeight: 80,
  },
  modalButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 15,
  },
  cancelButton: {
    flex: 1,
    backgroundColor: '#dc3545',
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
    backgroundColor: '#2E8B57',
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
});
