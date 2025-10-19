import { IconSymbol } from '@/components/ui/IconSymbol';
import { auth, db } from '@/config/firebase';
import { Colors } from '@/constants/Colors';
import { useTheme } from '@/hooks/useTheme';
import * as ImagePicker from 'expo-image-picker';
import { useLocalSearchParams } from 'expo-router';
import { addDoc, collection, doc, onSnapshot, query, serverTimestamp, updateDoc } from 'firebase/firestore';
import React, { useEffect, useState } from 'react';
import { Image, Modal, Platform, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import ErrorModal from '../../../components/ErrorModal';
import driverImageService from '../../../services/driverImageService';
import { ScheduleNotificationService } from '../../../services/scheduleNotificationService';

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
  barangay?: string;
  status?: string;
  note?: string;
  frequency?: string;
  createdAt: any;
}

export default function DriverSchedulePage({}: DriverSchedulePageProps) {
  const { theme } = useTheme();
  const colors = Colors[theme ?? 'light'];
  const params = useLocalSearchParams<{ open?: string; pickupId?: string }>();
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
      console.log('No db or user available for schedule fetch');
      setLoading(false);
      return;
    }

    const currentUser = auth.currentUser;
    const driverName = currentUser.displayName || currentUser.email || 'Unknown Driver';
    console.log('Fetching schedules for driver:', driverName);
    console.log('User displayName:', currentUser.displayName);
    console.log('User email:', currentUser.email);

    // Get all schedules first, then filter manually to handle multiple driver field possibilities
    const allSchedulesQuery = query(collection(db, 'schedules'));
    
    const unsubscribe = onSnapshot(allSchedulesQuery, (snapshot) => {
      console.log('All schedules in database:', snapshot.docs.length);
      
      const scheduleData: Schedule[] = [];
      let matchingDriverCount = 0;
      
      snapshot.forEach((doc) => {
        const data = doc.data();
        console.log('Checking schedule:', {
          id: doc.id,
          driver: data.driver,
          assignedDriverName: data.assignedDriverName,
          assignedDriverId: data.assignedDriverId,
          driverName: data.driverName,
          status: data.status,
          street: data.street
        });
        
        // Check multiple driver field possibilities including email matching
        const isDriverMatch = 
          data.driver === driverName ||
          data.driver === currentUser.email ||
          data.assignedDriverName === driverName ||
          data.assignedDriverName === currentUser.email ||
          data.assignedDriverId === currentUser.uid ||
          data.driverName === driverName ||
          data.driverName === currentUser.email;
          
        if (!isDriverMatch) {
          console.log('Skipping - driver mismatch. Expected:', driverName, 'Found driver fields:', {
            driver: data.driver,
            assignedDriverName: data.assignedDriverName,
            assignedDriverId: data.assignedDriverId,
            driverName: data.driverName
          });
          return;
        }
        
        matchingDriverCount++;
        console.log('Found matching driver schedule:', data);
        
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
      
      console.log('Total matching schedules found:', matchingDriverCount);
      
      // Exclude completed or issue statuses from the active schedule list
      const active = scheduleData.filter((s) => {
        const st = (s.status || 'pending').toLowerCase();
        const isPending = st !== 'completed' && st !== 'issue' && st !== 'resolved' && st !== 'done';
        console.log('Schedule filter:', s.street, 'Status:', st, 'IsPending:', isPending);
        return isPending;
      });

      console.log('Active schedules after filtering:', active.length);

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

      // Upsert notifications for upcoming active schedules (dedup by identifiers)
      (async () => {
        try {
          for (const a of active) {
            await ScheduleNotificationService.upsertScheduleNotifications({
              id: a.id,
              userId: auth?.currentUser?.uid || '',
              dateText: a.dateText,
              timeText: a.timeText,
              street: a.street,
              frequency: a.frequency || 'One-time',
              wasteCategory: a.wasteCategory,
              truck: undefined,
              driver: a.driver,
              note: a.note,
            });
          }
        } catch (e) {
          console.warn('Notification upsert skipped:', e);
        }
      })();
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

  // If navigated with params from Home, auto-open the modal for that pickup
  useEffect(() => {
    if (!params || (!params.open && !params.pickupId)) return;
    if (!schedules || schedules.length === 0) return; // wait until schedules load

    const target = schedules.find(s => s.id === params.pickupId);
    if (!target) return;

    if (params.open === 'complete') {
      handleCompletePickup(target);
    } else if (params.open === 'issue') {
      handleReportIssue(target);
    }
  }, [params, schedules]);

  const handleImagePicker = async () => {
    try {
      // Check if permission is already granted
      const { status: existingStatus } = await ImagePicker.getMediaLibraryPermissionsAsync();
      let finalStatus = existingStatus;

      // If not granted, request permission
      if (existingStatus !== 'granted') {
        const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
        finalStatus = status;
      }
      
      if (finalStatus !== 'granted') {
        showError(
          'Permission to access gallery is required to select photos. Please enable it in your device settings.',
          'Permission Required',
          'warning'
        );
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [4, 3],
        quality: 0.9, // Increased quality to ensure we have good data
        base64: true, // Enable base64 for web compatibility
        exif: false, // Reduce size
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const asset = result.assets[0];
        const imageUri = typeof asset.uri === 'string' ? asset.uri : String(asset.uri);
        const base64 = asset.base64;
        
        console.log('Image picker result:', { 
          imageUri: imageUri.substring(0, 50) + '...',
          base64: base64 ? 'present' : 'missing',
          base64Length: base64 ? base64.length : 0,
          platform: Platform.OS
        });
        
        // Prefer file URI for React Native, base64 for web
        if (Platform.OS === 'web' && base64 && base64.length > 0) {
          const dataUri = `data:image/jpeg;base64,${base64}`;
          console.log('Using base64 data URI for web upload, length:', dataUri.length);
          setSelectedImage(dataUri);
          setSelectedImageUri(dataUri);
        } else {
          console.log('Using file URI for native upload:', imageUri);
          setSelectedImage(imageUri);
          setSelectedImageUri(imageUri); // Prefer file URI for React Native
        }
      }
    } catch (error) {
      console.error('Error picking image:', error);
      showError('Failed to pick image from gallery. Please try again.', 'Image Selection Error', 'error');
    }
  };

  const handleCameraCapture = async () => {
    try {
      // Check if permission is already granted
      const { status: existingStatus } = await ImagePicker.getCameraPermissionsAsync();
      let finalStatus = existingStatus;

      // If not granted, request permission
      if (existingStatus !== 'granted') {
        const { status } = await ImagePicker.requestCameraPermissionsAsync();
        finalStatus = status;
      }
      
      if (finalStatus !== 'granted') {
        showError(
          'Permission to access camera is required to take photos. Please enable it in your device settings.',
          'Permission Required',
          'warning'
        );
        return;
      }

      const result = await ImagePicker.launchCameraAsync({
        allowsEditing: true,
        aspect: [4, 3],
        quality: 0.9, // Increased quality to ensure we have good data
        base64: true, // Enable base64 for web compatibility
        exif: false, // Reduce size
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const asset = result.assets[0];
        const imageUri = typeof asset.uri === 'string' ? asset.uri : String(asset.uri);
        const base64 = asset.base64;
        
        console.log('Camera capture result:', { 
          imageUri: imageUri.substring(0, 50) + '...',
          base64: base64 ? 'present' : 'missing',
          base64Length: base64 ? base64.length : 0,
          platform: Platform.OS
        });
        
        // Prefer file URI for React Native, base64 for web
        if (Platform.OS === 'web' && base64 && base64.length > 0) {
          const dataUri = `data:image/jpeg;base64,${base64}`;
          console.log('Using base64 data URI for web upload, length:', dataUri.length);
          setSelectedImage(dataUri);
          setSelectedImageUri(dataUri);
        } else {
          console.log('Using file URI for native upload:', imageUri);
          setSelectedImage(imageUri);
          setSelectedImageUri(imageUri); // Prefer file URI for React Native
        }
      }
    } catch (error) {
      console.error('Error capturing image:', error);
      showError('Failed to capture image from camera. Please try again.', 'Camera Error', 'error');
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
          uriLength: imageUriString.length,
          type: typeof imageUriString,
          isDataUri: imageUriString.startsWith('data:'),
          isFileUri: imageUriString.startsWith('file:'),
          hasBase64: imageUriString.includes('base64,')
        });
        
        // Validate the image URI before uploading
        if (!imageUriString || imageUriString.length < 50) {
          console.error('Invalid image URI - too short:', imageUriString.length);
          showError(
            'Selected image data is invalid. Please try taking/selecting another image.',
            'Invalid Image',
            'error'
          );
          setSubmitting(false);
          return;
        }
        
        const uploadResult = await driverImageService.uploadCompletionImage(imageUriString);
        
        if (uploadResult.success && uploadResult.url) {
          cloudinaryImageUrl = uploadResult.url;
          console.log('Image uploaded successfully:', cloudinaryImageUrl);
        } else {
          console.error('Image upload failed:', uploadResult.error);
          showError(
            uploadResult.error || 'Failed to upload image. Please try taking/selecting another image.',
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
        
        // Also save to driver_reports collection for admin viewing
        const driverReportData = {
          title: `Recurring Pickup Completed - ${selectedPickup.wasteCategory || 'Waste Collection'}`,
          description: description || 'Recurring pickup completed by driver',
          barangay: selectedPickup.barangay || 'Unknown',
          street: selectedPickup.street || 'Unknown Street',
          userId: auth.currentUser?.uid || '',
          userEmail: auth.currentUser?.email || 'Unknown Driver',
          imageURL: cloudinaryImageUrl || null,
          status: 'completed',
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
          // Driver completion specific fields
          driverName: auth.currentUser?.displayName || auth.currentUser?.email || 'Unknown Driver',
          wasteCategory: selectedPickup.wasteCategory || 'General',
          completionDate: new Date().toISOString(),
          isDriverCompletion: true,
          isRecurringCompletion: true,
          originalScheduleId: selectedPickup.id,
          completedBy: auth.currentUser?.email || 'Unknown Driver',
          completedByUid: auth.currentUser?.uid || undefined,
          completedByName: auth.currentUser?.displayName || auth.currentUser?.email || 'Unknown Driver'
        };
        
        await addDoc(collection(db, 'driver_reports'), driverReportData);
        
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
        
        // Also save to driver_reports collection for admin viewing
        const driverReportData = {
          title: `Pickup Completed - ${selectedPickup.wasteCategory || 'Waste Collection'}`,
          description: description || 'Pickup completed by driver',
          barangay: selectedPickup.barangay || 'Unknown',
          street: selectedPickup.street || 'Unknown Street',
          userId: auth.currentUser?.uid || '',
          userEmail: auth.currentUser?.email || 'Unknown Driver',
          imageURL: cloudinaryImageUrl || null,
          status: 'completed',
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
          // Driver completion specific fields
          driverName: auth.currentUser?.displayName || auth.currentUser?.email || 'Unknown Driver',
          wasteCategory: selectedPickup.wasteCategory || 'General',
          completionDate: new Date().toISOString(),
          isDriverCompletion: true,
          isRecurringCompletion: false,
          originalScheduleId: selectedPickup.id,
          completedBy: auth.currentUser?.email || 'Unknown Driver',
          completedByUid: auth.currentUser?.uid || undefined,
          completedByName: auth.currentUser?.displayName || auth.currentUser?.email || 'Unknown Driver'
        };
        
        await addDoc(collection(db, 'driver_reports'), driverReportData);
        
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

  const getUpcomingSchedules = () => {
    const today = new Date();
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    
    const todayStr = today.toLocaleDateString('en-US', { 
      month: 'long', 
      day: 'numeric', 
      year: 'numeric' 
    });
    
    const tomorrowStr = tomorrow.toLocaleDateString('en-US', { 
      month: 'long', 
      day: 'numeric', 
      year: 'numeric' 
    });
    
    return schedules.filter(schedule => 
      schedule.dateText !== todayStr && 
      schedule.dateText !== tomorrowStr &&
      new Date(schedule.dateText) > today
    );
  };

  const todaySchedule = getTodaySchedules();
  const tomorrowSchedule = getTomorrowSchedules();
  const upcomingSchedule = getUpcomingSchedules();

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
            <Text style={[styles.debugText, { color: colors.textTertiary }]}>
              Total schedules loaded: {schedules.length}
            </Text>
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
            <Text style={[styles.debugText, { color: colors.textTertiary }]}>
              Total schedules loaded: {schedules.length}
            </Text>
          </View>
        )}
      </View>

      {upcomingSchedule.length > 0 && (
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>Upcoming Schedules</Text>
          {upcomingSchedule.map((item) => (
            <View key={item.id} style={styles.upcomingCard}>
              <Text style={[styles.upcomingDate, { color: colors.primary }]}>{item.dateText}</Text>
              <Text style={[styles.upcomingTime, { color: colors.textPrimary }]}>{item.timeText}</Text>
              <Text style={[styles.upcomingStreet, { color: colors.textSecondary }]}>{item.street}</Text>
              <Text style={[styles.upcomingCategory, { color: colors.textSecondary }]}>{item.wasteCategory}</Text>
              {item.note && (
                <Text style={[styles.upcomingNote, { color: colors.textTertiary }]}>Note: {item.note}</Text>
              )}
            </View>
          ))}
        </View>
      )}

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
  debugText: {
    fontSize: 12,
    marginTop: 8,
    fontStyle: 'italic',
    textAlign: 'center',
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
  upcomingCard: {
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: 16,
    marginBottom: 12,
    borderLeftWidth: 4,
    borderLeftColor: '#2E8B57',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 1,
    },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  upcomingDate: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  upcomingTime: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 4,
  },
  upcomingStreet: {
    fontSize: 14,
    marginBottom: 2,
  },
  upcomingCategory: {
    fontSize: 12,
    marginBottom: 2,
  },
  upcomingNote: {
    fontSize: 12,
    fontStyle: 'italic',
    marginTop: 4,
  },
});

