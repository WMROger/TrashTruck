import { auth, db } from '@/config/firebase';
import * as ImagePicker from 'expo-image-picker';
import { collection, doc, onSnapshot, query, serverTimestamp, updateDoc, where } from 'firebase/firestore';
import React, { useEffect, useState } from 'react';
import { Alert, Image, Modal, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';

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
  createdAt: any;
  completedAt?: any;
  completionImage?: string;
}

export default function DriverHomePage({ onTabChange }: DriverHomePageProps) {
  const [nextPickup, setNextPickup] = useState<PickupData | null>(null);
  const [recentHistory, setRecentHistory] = useState<PickupData[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Complete pickup modal state
  const [showCompleteModal, setShowCompleteModal] = useState(false);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [description, setDescription] = useState('');
  const [submitting, setSubmitting] = useState(false);

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
      
      // Filter for pending/undefined status and today's date or later
      const upcomingPickups = nextPickupData
        .filter(pickup => {
          const isPending = !pickup.status || pickup.status === 'pending' || pickup.status === undefined;
          const isUpcoming = pickup.dateText >= todayStr;
          console.log('Pickup filter:', pickup.street, 'Status:', pickup.status, 'IsPending:', isPending, 'IsUpcoming:', isUpcoming);
          return isPending && isUpcoming;
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

  const handleImagePicker = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [4, 3],
        quality: 0.8,
      });

      if (!result.canceled) {
        setSelectedImage(result.assets[0].uri);
      }
    } catch (error) {
      console.error('Error picking image:', error);
      Alert.alert('Error', 'Failed to pick image');
    }
  };

  const handleCameraCapture = async () => {
    try {
      const result = await ImagePicker.launchCameraAsync({
        allowsEditing: true,
        aspect: [4, 3],
        quality: 0.8,
      });

      if (!result.canceled) {
        setSelectedImage(result.assets[0].uri);
      }
    } catch (error) {
      console.error('Error capturing image:', error);
      Alert.alert('Error', 'Failed to capture image');
    }
  };

  const handleSubmitReport = async () => {
    if (!nextPickup || !db) return;
    
    setSubmitting(true);
    
    try {
      await updateDoc(doc(db, 'schedules', nextPickup.id), {
        status: 'completed',
        completedAt: serverTimestamp(),
        completionImage: selectedImage,
        completionDescription: description,
        completedBy: auth.currentUser?.email || 'Unknown Driver',
        completedByEmail: auth.currentUser?.email || undefined,
        completedByUid: auth.currentUser?.uid || undefined,
        completedByName: auth.currentUser?.displayName || auth.currentUser?.email || 'Unknown Driver',
      });
      
      console.log('Pickup marked as completed with report');
      
      // Show success notification
      Alert.alert(
        'Success!', 
        'Pickup completed successfully. Report has been submitted.',
        [
          {
            text: 'OK',
            onPress: () => {
              setShowCompleteModal(false);
              setSelectedImage(null);
              setDescription('');
            }
          }
        ]
      );
      
    } catch (error) {
      console.error('Error completing pickup:', error);
      Alert.alert('Error', 'Failed to complete pickup. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleCancelReport = () => {
    setShowCompleteModal(false);
    setSelectedImage(null);
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
    <View style={styles.container}>
      
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <Text style={styles.cardTitle}>Next Pickup</Text>
          <TouchableOpacity 
            style={styles.seeAllBtn}
            onPress={() => onTabChange?.('schedule')}
          >
            <Text style={styles.seeAllText}>See all</Text>
          </TouchableOpacity>
        </View>
        {nextPickup ? (
          <View style={styles.nextPickup}>
            <Text style={styles.label}>{nextPickup.street}</Text>
            <Text style={styles.line}>• Street: {nextPickup.street}</Text>
            <Text style={styles.line}>• Time: {nextPickup.timeText}</Text>
            <Text style={styles.line}>• Type: {nextPickup.wasteCategory}</Text>
            {nextPickup.note && (
              <Text style={styles.line}>• Note: {nextPickup.note}</Text>
            )}
            <View style={styles.actionsRow}>
              <TouchableOpacity 
                style={[styles.btn, styles.btnSuccess]}
                onPress={handleCompletePickup}
              >
                <Text style={styles.btnText}>Complete</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={[styles.btn, styles.btnWarn]}
                onPress={handleReportIssue}
              >
                <Text style={styles.btnText}>Issue</Text>
              </TouchableOpacity>
            </View>
          </View>
        ) : (
          <View style={styles.emptyState}>
            <Text style={styles.emptyText}>No upcoming pickups scheduled</Text>
          </View>
        )}
      </View>

      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <Text style={styles.cardTitle}>Your History</Text>
          <TouchableOpacity 
            style={styles.seeAllBtn}
            onPress={() => onTabChange?.('history')}
          >
            <Text style={styles.seeAllText}>See all</Text>
          </TouchableOpacity>
        </View>
        {recentHistory.length > 0 ? (
          <View style={styles.historyRow}>
            {recentHistory.map((item) => (
              <View key={item.id} style={styles.historyItem}>
                <Image 
                  source={item.completionImage ? { uri: item.completionImage } : require('../../../assets/images/icon.png')} 
                  style={styles.historyImage} 
                />
                <View style={styles.historyMeta}>
                  <Text style={styles.historyText}>Street: "{item.street}"</Text>
                  <Text style={styles.historyText}>Type: {item.wasteCategory}</Text>
                  <Text style={styles.historyText}>Date: {item.dateText}</Text>
                  <Text style={styles.historyStatus}>{item.status}</Text>
                </View>
              </View>
            ))}
          </View>
        ) : (
          <View style={styles.emptyState}>
            <Text style={styles.emptyText}>No completed pickups yet</Text>
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
          <View style={styles.modalContainer}>
            <Text style={styles.modalTitle}>Complete Pickup Report</Text>
            
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
                  <Text style={styles.photoButtonText}>Gallery</Text>
                </TouchableOpacity>
                <TouchableOpacity 
                  style={styles.photoButton}
                  onPress={handleCameraCapture}
                >
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
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              
              <TouchableOpacity 
                style={[styles.submitButton, submitting && styles.submitButtonDisabled]}
                onPress={handleSubmitReport}
                disabled={submitting}
              >
                <Text style={styles.submitButtonText}>
                  {submitting ? 'Submitting...' : 'Submit Report'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
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
