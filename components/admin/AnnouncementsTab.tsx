import { MaterialIcons } from '@expo/vector-icons';
import { addDoc, collection, deleteDoc, doc, onSnapshot, orderBy, query, serverTimestamp, updateDoc } from 'firebase/firestore';
import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Modal, Pressable, ScrollView, StyleSheet, Switch, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { db } from '../../config/firebase';
import { useAuthContext } from '../AuthContext';
import ErrorModal from '../ErrorModal';

interface Announcement {
  id: string;
  title: string;
  description: string;
  datePosted: string;
  priority: 'Low' | 'Medium' | 'High' | 'Urgent';
  category: string;
  createdAt: any; // Firestore timestamp
  updatedAt?: any; // Firestore timestamp
  createdBy: string; // User ID who created the announcement
  scheduledDate?: Date; // When the announcement should be published
  scheduledTime?: Date; // Time for scheduled publishing
  isPublished?: boolean; // Whether the announcement is currently published
  publishedAt?: any; // When it was actually published
}

const AnnouncementsTab: React.FC = () => {
  const { user } = useAuthContext();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [selectedTime, setSelectedTime] = useState(new Date());
  const [selectedPriority, setSelectedPriority] = useState<'Low' | 'Medium' | 'High' | 'Urgent'>('Medium');
  const [selectedCategory, setSelectedCategory] = useState('General');
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isPublishing, setIsPublishing] = useState(false);
  const [isDeletingId, setIsDeletingId] = useState<string | null>(null);
  const [showPriorityDropdown, setShowPriorityDropdown] = useState(false);
  const [showCategoryDropdown, setShowCategoryDropdown] = useState(false);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(3);
  const [editingAnnouncement, setEditingAnnouncement] = useState<Announcement | null>(null);
  const [errorModal, setErrorModal] = useState({
    visible: false,
    title: 'Error',
    message: '',
    type: 'error' as 'error' | 'warning' | 'info' | 'success',
  });

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
  
  // Refs for time picker scroll views
  const hourScrollRef = useRef<ScrollView>(null);
  const minuteScrollRef = useRef<ScrollView>(null);
  const hourIdleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const minuteIdleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hourHoldIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const minuteHoldIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const hourHoldStartRef = useRef<number | null>(null);
  const minuteHoldStartRef = useRef<number | null>(null);
  // Time wheel constants for looping behavior
  const ITEM_HEIGHT = 40;
  const WHEEL_HEIGHT = ITEM_HEIGHT *4; // show exactly 3 rows
  const CENTER_SPACER = (WHEEL_HEIGHT - ITEM_HEIGHT) / 3.5;
  const HOUR_COUNT = 24;
  const MIN_COUNT = 60;
  const HOUR_MULTIPLIER = 5; // number of loops rendered
  const MIN_MULTIPLIER = 5;
  const getHourLoopSize = () => HOUR_COUNT * HOUR_MULTIPLIER;
  const getMinLoopSize = () => MIN_COUNT * MIN_MULTIPLIER;
  const middleHourBase = Math.floor(HOUR_MULTIPLIER / 2) * HOUR_COUNT;
  const middleMinBase = Math.floor(MIN_MULTIPLIER / 2) * MIN_COUNT;

  // Ensure wheels reflect current selected time when opened
  useEffect(() => {
    if (showTimePicker) {
      const h = selectedTime.getHours();
      const m = selectedTime.getMinutes();
      const hourY = (middleHourBase + h) * ITEM_HEIGHT;
      const minY = (middleMinBase + m) * ITEM_HEIGHT;
      requestAnimationFrame(() => {
        hourScrollRef.current?.scrollTo({ y: hourY, animated: false });
        minuteScrollRef.current?.scrollTo({ y: minY, animated: false });
      });
    }
  }, [showTimePicker]);

  // Cleanup idle timers when unmounting or closing picker
  useEffect(() => {
    if (!showTimePicker) {
      if (hourIdleTimerRef.current) clearTimeout(hourIdleTimerRef.current);
      if (minuteIdleTimerRef.current) clearTimeout(minuteIdleTimerRef.current);
      if (hourHoldIntervalRef.current) clearInterval(hourHoldIntervalRef.current);
      if (minuteHoldIntervalRef.current) clearInterval(minuteHoldIntervalRef.current);
    }
    return () => {
      if (hourIdleTimerRef.current) clearTimeout(hourIdleTimerRef.current);
      if (minuteIdleTimerRef.current) clearTimeout(minuteIdleTimerRef.current);
      if (hourHoldIntervalRef.current) clearInterval(hourHoldIntervalRef.current);
      if (minuteHoldIntervalRef.current) clearInterval(minuteHoldIntervalRef.current);
    };
  }, [showTimePicker]);
  const [showEditModal, setShowEditModal] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [timer, setTimer] = useState<NodeJS.Timeout | null>(null);
  const [publishNow, setPublishNow] = useState(false);

  const priorityOptions: { value: 'Low' | 'Medium' | 'High' | 'Urgent'; label: string; color: string }[] = [
    { value: 'Low', label: 'Low Priority', color: '#10B981' },
    { value: 'Medium', label: 'Medium Priority', color: '#F59E0B' },
    { value: 'High', label: 'High Priority', color: '#EF4444' },
    { value: 'Urgent', label: 'Urgent', color: '#DC2626' }
  ];

  const categoryOptions = [
    'General',
    'Schedule Change',
    'Service Update',
    'Emergency',
    'Maintenance',
    'Holiday Notice',
    'Policy Update'
  ];

  // Fetch announcements from Firestore
  useEffect(() => {
    if (!db) {
      setError('Firebase not initialized');
      setLoading(false);
      return;
    }

    console.log('Setting up real-time announcements listener...');
    
    const announcementsRef = collection(db, 'announcements');
    const q = query(announcementsRef, orderBy('createdAt', 'desc'));
    
    const unsubscribe = onSnapshot(q, 
      (snapshot) => {
        console.log('Announcements snapshot received:', snapshot.docs.length, 'documents');
        
        const announcementsData: Announcement[] = snapshot.docs.map(doc => {
          const data = doc.data();
          return {
            id: doc.id,
            title: data.title || '',
            description: data.description || '',
            datePosted: data.datePosted || '',
            priority: data.priority || 'Medium',
            category: data.category || 'General',
            createdAt: data.createdAt,
            updatedAt: data.updatedAt,
            createdBy: data.createdBy || '',
            scheduledDate: data.scheduledDate ? data.scheduledDate.toDate() : undefined,
            scheduledTime: data.scheduledTime ? data.scheduledTime.toDate() : undefined,
            isPublished: data.isPublished || false,
            publishedAt: data.publishedAt
          };
        });
        
        console.log('Processed announcements:', announcementsData.length);
        setAnnouncements(announcementsData);
        setLoading(false);
        setError(null);
      },
      (error) => {
        console.error('Error fetching announcements:', error);
        setError('Failed to fetch announcements');
        setLoading(false);
      }
    );

    return () => {
      console.log('Cleaning up announcements listener');
      unsubscribe();
    };
  }, []);

  const handlePublish = async () => {
    if (!title.trim() || !description.trim()) {
      showError('Please fill in both title and description', 'Validation Error', 'warning');
      return;
    }

    if (!user) {
      showError('You must be logged in to create announcements', 'Authentication Required', 'error');
      return;
    }

    if (!db) {
      showError('Database not available', 'Database Error', 'error');
      return;
    }

    setIsPublishing(true);

    try {
      console.log('Creating new announcement...');
      
      const now = new Date();
      const scheduledDateTime = new Date(selectedDate);
      scheduledDateTime.setHours(selectedTime.getHours(), selectedTime.getMinutes(), 0, 0);
      
      const announcementData = {
        title: title.trim(),
        description: description.trim(),
        datePosted: formatDateTime(selectedDate, selectedTime),
        scheduledDate: selectedDate,
        scheduledTime: selectedTime,
        priority: selectedPriority,
        category: selectedCategory,
        createdAt: serverTimestamp(),
        createdBy: user.uid,
        isPublished: now >= scheduledDateTime, // Publish immediately if scheduled time has passed
        publishedAt: now >= scheduledDateTime ? serverTimestamp() : null
      };

      await addDoc(collection(db, 'announcements'), announcementData);
      
      console.log('Announcement created successfully');
      
      if (now >= scheduledDateTime) {
        showError('Announcement published immediately!', 'Success', 'success');
      } else {
        showError('Announcement scheduled successfully!', 'Success', 'success');
      }
      
      // Reset form
      setTitle('');
      setDescription('');
      setSelectedDate(new Date());
      setSelectedTime(new Date());
      setSelectedPriority('Medium');
      setSelectedCategory('General');
    } catch (error) {
      console.error('Error creating announcement:', error);
      showError('Failed to publish announcement. Please try again.', 'Publish Error', 'error');
    } finally {
      setIsPublishing(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!db) {
      showError('Database not available', 'Database Error', 'error');
      return;
    }

    // For now, directly delete without confirmation
    // In a production app, you might want to add a confirmation modal
    try {
      setIsDeletingId(id);
      console.log('Deleting announcement:', id);
      await deleteDoc(doc(db, 'announcements', id));
      console.log('Announcement deleted successfully');
      showError('Announcement deleted successfully!', 'Success', 'success');
    } catch (error) {
      console.error('Error deleting announcement:', error);
      showError('Failed to delete announcement. Please try again.', 'Delete Error', 'error');
    } finally {
      setIsDeletingId(null);
    }
  };

  const formatDate = (timestamp: any) => {
    if (!timestamp) return 'Unknown date';
    
    try {
      const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
      return date.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        hour12: true
      });
    } catch (error) {
      console.error('Error formatting date:', error);
      return 'Invalid date';
    }
  };

  const getPriorityColor = (priority: string) => {
    const option = priorityOptions.find(opt => opt.value === priority);
    return option ? option.color : '#F59E0B';
  };

  const handleDateChange = (year: number, month: number, day: number) => {
    const newDate = new Date(year, month - 1, day);
    const now = new Date();
    
    // Check if selected date is in the future
    if (newDate < now) {
      showError('Please select a future date for the announcement.', 'Invalid Date', 'warning');
      return;
    }
    
    setSelectedDate(newDate);
    setShowDatePicker(false);
  };

  const handleTimeChange = (hour: number, minute: number) => {
    const newTime = new Date();
    newTime.setHours(hour, minute, 0, 0);
    setSelectedTime(newTime);
  };

  const scrollHourBy = (delta: number) => {
    const currentHour = selectedTime.getHours();
    const hour = (currentHour + delta + HOUR_COUNT) % HOUR_COUNT;
    handleTimeChange(hour, selectedTime.getMinutes());
    const targetY = (middleHourBase + hour) * ITEM_HEIGHT;
    hourScrollRef.current?.scrollTo({ y: targetY, animated: true });
  };

  const scrollMinuteBy = (delta: number) => {
    const currentMinute = selectedTime.getMinutes();
    const minute = (currentMinute + delta + MIN_COUNT) % MIN_COUNT;
    handleTimeChange(selectedTime.getHours(), minute);
    const targetY = (middleMinBase + minute) * ITEM_HEIGHT;
    minuteScrollRef.current?.scrollTo({ y: targetY, animated: true });
  };

  const startHourAutoScroll = (direction: 1 | -1) => {
    if (hourHoldIntervalRef.current) clearInterval(hourHoldIntervalRef.current);
    hourHoldStartRef.current = Date.now();
    const tick = () => {
      const nowTs = Date.now();
      const elapsed = hourHoldStartRef.current ? nowTs - hourHoldStartRef.current : 0;
      const step = elapsed > 2000 ? 10 : elapsed > 1200 ? 5 : elapsed > 600 ? 2 : 1;
      scrollHourBy(direction * step);
    };
    tick();
    hourHoldIntervalRef.current = setInterval(tick, 140);
  };

  const stopHourAutoScroll = () => {
    if (hourHoldIntervalRef.current) clearInterval(hourHoldIntervalRef.current);
    hourHoldIntervalRef.current = null;
    hourHoldStartRef.current = null;
  };

  const startMinuteAutoScroll = (direction: 1 | -1) => {
    if (minuteHoldIntervalRef.current) clearInterval(minuteHoldIntervalRef.current);
    minuteHoldStartRef.current = Date.now();
    const tick = () => {
      const nowTs = Date.now();
      const elapsed = minuteHoldStartRef.current ? nowTs - minuteHoldStartRef.current : 0;
      const step = elapsed > 2000 ? 10 : elapsed > 1200 ? 5 : elapsed > 600 ? 2 : 1;
      scrollMinuteBy(direction * step);
    };
    tick();
    minuteHoldIntervalRef.current = setInterval(tick, 110);
  };

  const stopMinuteAutoScroll = () => {
    if (minuteHoldIntervalRef.current) clearInterval(minuteHoldIntervalRef.current);
    minuteHoldIntervalRef.current = null;
    minuteHoldStartRef.current = null;
  };

  // Smooth infinite loop: keep offset within middle cycles without visual jump
  const getRebasedOffset = (y: number, count: number, middleBase: number) => {
    const cycleHeight = count * ITEM_HEIGHT;
    const yNoPad = y - CENTER_SPACER;
    const remainder = ((yNoPad % cycleHeight) + cycleHeight) % cycleHeight;
    const target = middleBase * ITEM_HEIGHT + remainder + CENTER_SPACER;
    return target;
  };

  const formatDateTime = (date: Date, time: Date) => {
    const combinedDateTime = new Date(date);
    combinedDateTime.setHours(time.getHours(), time.getMinutes());
    
    return combinedDateTime.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    });
  };

  const getMinDate = () => {
    return new Date(); // Today's date as minimum
  };

  // Timer functionality for scheduled publishing
  useEffect(() => {
    const checkScheduledAnnouncements = () => {
      const now = new Date();
      
      announcements.forEach(async (announcement) => {
        if (!announcement.isPublished && announcement.scheduledDate && announcement.scheduledTime) {
          const scheduledDateTime = new Date(announcement.scheduledDate);
          scheduledDateTime.setHours(
            announcement.scheduledTime.getHours(),
            announcement.scheduledTime.getMinutes(),
            0,
            0
          );
          
          if (now >= scheduledDateTime) {
            // Time to publish this announcement
            try {
              await updateDoc(doc(db, 'announcements', announcement.id), {
                isPublished: true,
                publishedAt: serverTimestamp()
              });
              console.log('Announcement published:', announcement.title);
            } catch (error) {
              console.error('Error publishing announcement:', error);
            }
          }
        }
      });
    };

    // Check every minute
    const interval = setInterval(checkScheduledAnnouncements, 60000);
    
    // Check immediately
    checkScheduledAnnouncements();

    return () => clearInterval(interval);
  }, [announcements]);

  const getTimeUntilPublish = (announcement: Announcement) => {
    if (!announcement.scheduledDate || !announcement.scheduledTime) return null;
    
    const scheduledDateTime = new Date(announcement.scheduledDate);
    scheduledDateTime.setHours(
      announcement.scheduledTime.getHours(),
      announcement.scheduledTime.getMinutes(),
      0,
      0
    );
    
    const now = new Date();
    const diff = scheduledDateTime.getTime() - now.getTime();
    
    if (diff <= 0) return null; // Already past scheduled time
    
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    
    if (days > 0) {
      return `${days}d ${hours}h ${minutes}m`;
    } else if (hours > 0) {
      return `${hours}h ${minutes}m`;
    } else {
      return `${minutes}m`;
    }
  };

  const getPublishStatus = (announcement: Announcement) => {
    if (announcement.isPublished) {
      return {
        text: 'Published',
        color: '#10B981',
        icon: 'checkmark-circle'
      };
    }
    
    if (announcement.scheduledDate && announcement.scheduledTime) {
      const timeUntil = getTimeUntilPublish(announcement);
      if (timeUntil) {
        return {
          text: `Scheduled (${timeUntil})`,
          color: '#F59E0B',
          icon: 'time'
        };
      } else {
        return {
          text: 'Ready to Publish',
          color: '#EF4444',
          icon: 'alert-circle'
        };
      }
    }
    
    return {
      text: 'Draft',
      color: '#6B7280',
      icon: 'document-text'
    };
  };

  // Pagination functions
  const getPaginatedAnnouncements = () => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    return announcements.slice(startIndex, endIndex);
  };

  const getTotalPages = () => {
    return Math.ceil(announcements.length / itemsPerPage);
  };

  const handlePageChange = (page: number) => {
    setCurrentPage(page);
  };

  const renderPagination = () => {
    const totalPages = getTotalPages();
    
    if (totalPages <= 1) return null;

    const pages = [];
    const maxVisiblePages = 5;
    let startPage = Math.max(1, currentPage - Math.floor(maxVisiblePages / 2));
    let endPage = Math.min(totalPages, startPage + maxVisiblePages - 1);

    if (endPage - startPage + 1 < maxVisiblePages) {
      startPage = Math.max(1, endPage - maxVisiblePages + 1);
    }

    // Previous button
    pages.push(
      <TouchableOpacity
        key="prev"
        style={[
          styles.paginationButton,
          currentPage === 1 && styles.paginationButtonDisabled
        ]}
        onPress={() => handlePageChange(currentPage - 1)}
        disabled={currentPage === 1}
      >
        <Text style={[
          styles.paginationButtonText,
          currentPage === 1 && styles.paginationButtonTextDisabled
        ]}>‹</Text>
      </TouchableOpacity>
    );

    // Page numbers
    for (let i = startPage; i <= endPage; i++) {
      pages.push(
        <TouchableOpacity
          key={i}
          style={[
            styles.paginationButton,
            currentPage === i && styles.paginationButtonActive
          ]}
          onPress={() => handlePageChange(i)}
        >
          <Text style={[
            styles.paginationButtonText,
            currentPage === i && styles.paginationButtonTextActive
          ]}>{i}</Text>
        </TouchableOpacity>
      );
    }

    // Next button
    pages.push(
      <TouchableOpacity
        key="next"
        style={[
          styles.paginationButton,
          currentPage === totalPages && styles.paginationButtonDisabled
        ]}
        onPress={() => handlePageChange(currentPage + 1)}
        disabled={currentPage === totalPages}
      >
        <Text style={[
          styles.paginationButtonText,
          currentPage === totalPages && styles.paginationButtonTextDisabled
        ]}>›</Text>
      </TouchableOpacity>
    );

    return (
      <View style={styles.paginationContainer}>
        <Text style={styles.paginationInfo}>
          Showing {((currentPage - 1) * itemsPerPage) + 1}-{Math.min(currentPage * itemsPerPage, announcements.length)} of {announcements.length} announcements
        </Text>
        <View style={styles.paginationButtons}>
          {pages}
        </View>
      </View>
    );
  };

  // Edit functionality
  const handleEdit = (announcement: Announcement) => {
    setEditingAnnouncement(announcement);
    setTitle(announcement.title);
    setDescription(announcement.description);
    setSelectedPriority(announcement.priority);
    setSelectedCategory(announcement.category);
    setPublishNow(!!announcement.isPublished);
    // Parse the date from the stored format
    if (announcement.createdAt) {
      const date = announcement.createdAt.toDate ? announcement.createdAt.toDate() : new Date(announcement.createdAt);
      setSelectedDate(date);
      setSelectedTime(date);
    }
    setShowEditModal(true);
  };

  const handleUpdate = async () => {
    if (!editingAnnouncement) return;

    if (!title.trim() || !description.trim()) {
      showError('Please fill in both title and description', 'Validation Error', 'warning');
      return;
    }

    if (!user) {
      showError('You must be logged in to update announcements', 'Authentication Required', 'error');
      return;
    }

    if (!db) {
      showError('Database not available', 'Database Error', 'error');
      return;
    }

    setIsUpdating(true);

    try {
      console.log('Updating announcement:', editingAnnouncement.id);
      
      const now = new Date();
      const scheduledDateTime = new Date(selectedDate);
      scheduledDateTime.setHours(selectedTime.getHours(), selectedTime.getMinutes(), 0, 0);
      
      const announcementData = {
        title: title.trim(),
        description: description.trim(),
        datePosted: formatDateTime(selectedDate, selectedTime),
        scheduledDate: selectedDate,
        scheduledTime: selectedTime,
        priority: selectedPriority,
        category: selectedCategory,
        updatedAt: serverTimestamp(),
        isPublished: publishNow || now >= scheduledDateTime,
        publishedAt: (publishNow || now >= scheduledDateTime) ? serverTimestamp() : null
      };

      await updateDoc(doc(db, 'announcements', editingAnnouncement.id), announcementData);
      
      console.log('Announcement updated successfully');
      showError('Announcement updated successfully!', 'Success', 'success');
      
      // Reset form and close modal
      setTitle('');
      setDescription('');
      setSelectedDate(new Date());
      setSelectedTime(new Date());
      setSelectedPriority('Medium');
      setSelectedCategory('General');
      setEditingAnnouncement(null);
      setShowEditModal(false);
    } catch (error) {
      console.error('Error updating announcement:', error);
      showError('Failed to update announcement. Please try again.', 'Update Error', 'error');
    } finally {
      setIsUpdating(false);
    }
  };

  const handleCloseEditModal = () => {
    setShowEditModal(false);
    setEditingAnnouncement(null);
    setTitle('');
    setDescription('');
    setSelectedDate(new Date());
    setSelectedTime(new Date());
    setSelectedPriority('Medium');
    setSelectedCategory('General');
  };

  return (
    <ScrollView style={styles.container}>
      <View style={styles.mainSection}>
        <Text style={styles.title}>Announcements Dashboard</Text>
        
        {/* Loading State */}
        {loading && (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#22C55E" />
            <Text style={styles.loadingText}>Loading announcements...</Text>
          </View>
        )}

        {/* Error State */}
        {error && (
          <View style={styles.errorContainer}>
            <MaterialIcons name="error" size={48} color="#EF4444" />
            <Text style={styles.errorText}>{error}</Text>
            <TouchableOpacity 
              style={styles.retryButton}
              onPress={() => {
                setError(null);
                setLoading(true);
              }}
            >
              <Text style={styles.retryButtonText}>Retry</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Content */}
        {!loading && !error && (
          <View style={styles.columnsContainer}>
          {/* Left Column - Create Announcement */}
          <View style={styles.leftColumn}>
            <View style={styles.formCard}>
              <Text style={styles.formTitle}>Schedule New Announcement</Text>
              
              <View style={styles.formField}>
                <Text style={styles.fieldLabel}>Title<Text style={{ color: '#EF4444' }}> *</Text></Text>
                <TextInput
                  style={styles.textInput}
                  value={title}
                  onChangeText={setTitle}
                  placeholder="Enter announcement title"
                  placeholderTextColor="#999"
                />
              </View>

              <View style={styles.formField}>
                <Text style={styles.fieldLabel}>Description<Text style={{ color: '#EF4444' }}> *</Text></Text>
                <TextInput
                  style={styles.textArea}
                  value={description}
                  onChangeText={setDescription}
                  placeholder="Enter announcement description"
                  placeholderTextColor="#999"
                  multiline
                  numberOfLines={4}
                  textAlignVertical="top"
                />
              </View>

              <View style={styles.formRow}>
                <TouchableOpacity 
                  style={styles.dateTimeButton}
                  onPress={() => setShowDatePicker(true)}
                >
                  <MaterialIcons name="event" size={20} color="#666" />
                  <Text style={styles.dateTimeText}>
                    {selectedDate.toLocaleDateString('en-US', {
                      month: 'short',
                      day: 'numeric',
                      year: 'numeric'
                    })}
                  </Text>
                </TouchableOpacity>
                
                <TouchableOpacity 
                  style={styles.dateTimeButton}
                  onPress={() => setShowTimePicker(true)}
                >
                  <MaterialIcons name="access-time" size={20} color="#666" />
                  <Text style={styles.dateTimeText}>
                    {selectedTime.toLocaleTimeString('en-US', {
                      hour: '2-digit',
                      minute: '2-digit',
                      hour12: true
                    })}
                  </Text>
                </TouchableOpacity>
              </View>
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
                <Text style={{ fontSize: 14, color: '#6B7280', fontWeight: '500' }}>Publish now</Text>
                <Switch value={publishNow} onValueChange={setPublishNow} />
              </View>

              <View style={styles.formRow}>
                <TouchableOpacity 
                  style={styles.dropdownButton}
                  onPress={() => setShowPriorityDropdown(!showPriorityDropdown)}
                >
                  <Text style={styles.dropdownText}>
                    {selectedPriority}
                  </Text>
                  <MaterialIcons name="keyboard-arrow-down" size={20} color="#666" />
                </TouchableOpacity>
                
                <TouchableOpacity 
                  style={styles.dropdownButton}
                  onPress={() => setShowCategoryDropdown(!showCategoryDropdown)}
                >
                  <Text style={styles.dropdownText}>
                    {selectedCategory}
                  </Text>
                  <MaterialIcons name="keyboard-arrow-down" size={20} color="#666" />
                </TouchableOpacity>
              </View>

              {/* Priority Dropdown */}
              {showPriorityDropdown && (
                <View style={styles.dropdownMenu}>
                  {priorityOptions.map((option) => (
                    <TouchableOpacity
                      key={option.value}
                      style={styles.dropdownItem}
                      onPress={() => {
                        setSelectedPriority(option.value);
                        setShowPriorityDropdown(false);
                      }}
                    >
                      <View style={[styles.priorityIndicator, { backgroundColor: option.color }]} />
                      <Text style={styles.dropdownItemText}>{option.label}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              )}

              {/* Category Dropdown */}
              {showCategoryDropdown && (
                <View style={styles.dropdownMenu}>
                  {categoryOptions.map((category) => (
                    <TouchableOpacity
                      key={category}
                      style={styles.dropdownItem}
                      onPress={() => {
                        setSelectedCategory(category);
                        setShowCategoryDropdown(false);
                      }}
                    >
                      <Text style={styles.dropdownItemText}>{category}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              )}

              <TouchableOpacity 
                style={[styles.publishButton, isPublishing && styles.publishButtonDisabled]}
                onPress={handlePublish}
                disabled={isPublishing}
              >
                {isPublishing ? (
                  <View style={styles.publishButtonContent}>
                    <ActivityIndicator size="small" color="white" />
                    <Text style={styles.publishButtonText}>Publishing...</Text>
                  </View>
                ) : (
                  <Text style={styles.publishButtonText}>Schedule Announcement</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>


          {/* Right Column - View Announcements */}
          <View style={styles.rightColumn}>
            <View style={styles.listCard}>
              <Text style={styles.listTitle}>Recent Announcements</Text>
              
              {announcements.length === 0 ? (
                <View style={styles.emptyContainer}>
                  <MaterialIcons name="campaign" size={64} color="#9CA3AF" />
                  <Text style={styles.emptyText}>No announcements yet</Text>
                  <Text style={styles.emptySubtext}>Create your first announcement to get started</Text>
                </View>
              ) : (
                getPaginatedAnnouncements().map((announcement) => (
                  <View key={announcement.id} style={styles.announcementItem}>
                    <View style={styles.announcementHeader}>
                      <View style={[styles.priorityIndicator, { backgroundColor: getPriorityColor(announcement.priority) }]} />
                      <Text style={styles.announcementTitle}>{announcement.title}</Text>
                      <View style={styles.actionButtons}>
                        <TouchableOpacity 
                          style={styles.actionButton}
                          onPress={() => handleEdit(announcement)}
                          disabled={isDeletingId === announcement.id}
                        >
                          <MaterialIcons name="edit" size={16} color="#4169E1" />
                        </TouchableOpacity>
                        <TouchableOpacity 
                          style={styles.actionButton}
                          onPress={() => handleDelete(announcement.id)}
                          disabled={isDeletingId === announcement.id}
                        >
                          {isDeletingId === announcement.id ? (
                            <ActivityIndicator size="small" color="#FF6347" />
                          ) : (
                            <MaterialIcons name="delete" size={16} color="#FF6347" />
                          )}
                        </TouchableOpacity>
                      </View>
                    </View>
                    
                    <Text style={styles.announcementDescription}>
                      {announcement.description}
                    </Text>
                    
                    <View style={styles.announcementMeta}>
                      <View style={styles.announcementMetaLeft}>
                        <Text style={styles.announcementCategory}>
                          {announcement.category}
                        </Text>
                        <View style={styles.publishStatus}>
                          <MaterialIcons 
                            name={getPublishStatus(announcement).icon as any} 
                            size={14} 
                            color={getPublishStatus(announcement).color} 
                          />
                          <Text style={[
                            styles.publishStatusText,
                            { color: getPublishStatus(announcement).color }
                          ]}>
                            {getPublishStatus(announcement).text}
                          </Text>
                        </View>
                      </View>
                      <Text style={styles.announcementDate}>
                        {formatDate(announcement.createdAt)}
                      </Text>
                    </View>
                  </View>
                ))
              )}
            </View>
            
            {/* Pagination */}
            {announcements.length > 0 && renderPagination()}
          </View>
        </View>
        )}
      </View>

      {/* Edit Announcement Modal */}
      <Modal
        visible={showEditModal}
        transparent={true}
        animationType="slide"
        onRequestClose={handleCloseEditModal}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.editModalContainer}>
            <View style={styles.editModalHeader}>
              <Text style={styles.editModalTitle}>Edit Announcement</Text>
              <TouchableOpacity 
                style={styles.closeButton}
                onPress={handleCloseEditModal}
              >
                <MaterialIcons name="close" size={24} color="#000" />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.editModalContent}>
              <View style={styles.formField}>
                <Text style={styles.fieldLabel}>Title<Text style={{ color: '#EF4444' }}> *</Text></Text>
                <TextInput
                  style={styles.textInput}
                  value={title}
                  onChangeText={setTitle}
                  placeholder="Enter announcement title"
                  placeholderTextColor="#999"
                />
              </View>

              <View style={styles.formField}>
                <Text style={styles.fieldLabel}>Description<Text style={{ color: '#EF4444' }}> *</Text></Text>
                <TextInput
                  style={styles.textArea}
                  value={description}
                  onChangeText={setDescription}
                  placeholder="Enter announcement description"
                  placeholderTextColor="#999"
                  multiline
                  numberOfLines={4}
                  textAlignVertical="top"
                />
              </View>

              <View style={styles.formRow}>
                <TouchableOpacity 
                  style={styles.dateTimeButton}
                  onPress={() => setShowDatePicker(true)}
                >
                  <MaterialIcons name="event" size={20} color="#666" />
                  <Text style={styles.dateTimeText}>
                    {selectedDate.toLocaleDateString('en-US', {
                      month: 'short',
                      day: 'numeric',
                      year: 'numeric'
                    })}
                  </Text>
                </TouchableOpacity>
                
                <TouchableOpacity 
                  style={styles.dateTimeButton}
                  onPress={() => setShowTimePicker(true)}
                >
                  <MaterialIcons name="access-time" size={20} color="#666" />
                  <Text style={styles.dateTimeText}>
                    {selectedTime.toLocaleTimeString('en-US', {
                      hour: '2-digit',
                      minute: '2-digit',
                      hour12: true
                    })}
                  </Text>
                </TouchableOpacity>
              </View>

              <View style={styles.formRow}>
                <TouchableOpacity 
                  style={styles.dropdownButton}
                  onPress={() => setShowPriorityDropdown(!showPriorityDropdown)}
                >
                  <Text style={styles.dropdownText}>
                    {selectedPriority}
                  </Text>
                  <MaterialIcons name="keyboard-arrow-down" size={20} color="#666" />
                </TouchableOpacity>
                
                <TouchableOpacity 
                  style={styles.dropdownButton}
                  onPress={() => setShowCategoryDropdown(!showCategoryDropdown)}
                >
                  <Text style={styles.dropdownText}>
                    {selectedCategory}
                  </Text>
                  <MaterialIcons name="keyboard-arrow-down" size={20} color="#666" />
                </TouchableOpacity>
              </View>

              {/* Priority Dropdown */}
              {showPriorityDropdown && (
                <View style={styles.dropdownMenu}>
                  {priorityOptions.map((option) => (
                    <TouchableOpacity
                      key={option.value}
                      style={styles.dropdownItem}
                      onPress={() => {
                        setSelectedPriority(option.value);
                        setShowPriorityDropdown(false);
                      }}
                    >
                      <View style={[styles.priorityIndicator, { backgroundColor: option.color }]} />
                      <Text style={styles.dropdownItemText}>{option.label}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              )}

              {/* Category Dropdown */}
              {showCategoryDropdown && (
                <View style={styles.dropdownMenu}>
                  {categoryOptions.map((category) => (
                    <TouchableOpacity
                      key={category}
                      style={styles.dropdownItem}
                      onPress={() => {
                        setSelectedCategory(category);
                        setShowCategoryDropdown(false);
                      }}
                    >
                      <Text style={styles.dropdownItemText}>{category}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              )}

              <TouchableOpacity 
                style={[styles.publishButton, isUpdating && styles.publishButtonDisabled]}
                onPress={handleUpdate}
                disabled={isUpdating}
              >
                {isUpdating ? (
                  <View style={styles.publishButtonContent}>
                    <ActivityIndicator size="small" color="white" />
                    <Text style={styles.publishButtonText}>Updating...</Text>
                  </View>
                ) : (
                  <Text style={styles.publishButtonText}>Update Announcement</Text>
                )}
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Date Picker Modal for Edit */}
      <Modal
        visible={showDatePicker}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowDatePicker(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.pickerModal}>
            <TouchableOpacity
              onPress={() => setShowDatePicker(false)}
              style={{ position: 'absolute', top: 12, right: 12, padding: 6 }}
            >
              <MaterialIcons name="close" size={20} color="#111" />
            </TouchableOpacity>
            <Text style={styles.pickerTitle}>Select Date</Text>
            <Text style={styles.pickerSubtitle}>Choose a future date for your announcement</Text>
            
            <View style={styles.dateInputs}>
              <View style={styles.dateInputGroup}>
                <Text style={styles.dateInputLabel}>Year</Text>
                <TextInput
                  style={styles.dateInput}
                  value={selectedDate.getFullYear().toString()}
                  onChangeText={(text) => {
                    const year = parseInt(text) || new Date().getFullYear();
                    handleDateChange(year, selectedDate.getMonth() + 1, selectedDate.getDate());
                  }}
                  keyboardType="numeric"
                  maxLength={4}
                />
              </View>
              
              <View style={styles.dateInputGroup}>
                <Text style={styles.dateInputLabel}>Month</Text>
                <TextInput
                  style={styles.dateInput}
                  value={(selectedDate.getMonth() + 1).toString()}
                  onChangeText={(text) => {
                    const month = parseInt(text) || 1;
                    if (month >= 1 && month <= 12) {
                      handleDateChange(selectedDate.getFullYear(), month, selectedDate.getDate());
                    }
                  }}
                  keyboardType="numeric"
                  maxLength={2}
                />
              </View>
              
              <View style={styles.dateInputGroup}>
                <Text style={styles.dateInputLabel}>Day</Text>
                <TextInput
                  style={styles.dateInput}
                  value={selectedDate.getDate().toString()}
                  onChangeText={(text) => {
                    const day = parseInt(text) || 1;
                    if (day >= 1 && day <= 31) {
                      handleDateChange(selectedDate.getFullYear(), selectedDate.getMonth() + 1, day);
                    }
                  }}
                  keyboardType="numeric"
                  maxLength={2}
                />
              </View>
            </View>
            
            <TouchableOpacity
              style={styles.pickerButton}
              onPress={() => setShowDatePicker(false)}
            >
              <Text style={styles.pickerButtonText}>Done</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Time Picker Modal for Edit */}
      <Modal
        visible={showTimePicker}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowTimePicker(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.pickerModal}>
            <TouchableOpacity
              onPress={() => setShowTimePicker(false)}
              style={{ position: 'absolute', top: 12, right: 12, padding: 6 }}
            >
              <MaterialIcons name="close" size={20} color="#111" />
            </TouchableOpacity>
            <Text style={styles.pickerTitle}>Select Time</Text>
            <Text style={styles.pickerSubtitle}>Choose a time for your announcement</Text>
            
            <View style={styles.timePickerContainer}>
              <View style={styles.timeWheelContainer}>
                <View style={[styles.timeWheel, { height: WHEEL_HEIGHT }]}>
                  <Text style={styles.timeWheelLabel}>Hour</Text>
                  <ScrollView
                    ref={hourScrollRef}
                    style={styles.timeScrollView}
                    contentContainerStyle={{ paddingVertical: CENTER_SPACER }}
                    showsVerticalScrollIndicator={false}
                    snapToInterval={ITEM_HEIGHT}
                    decelerationRate="fast"
                    nestedScrollEnabled
                    scrollEventThrottle={16}
                    onScroll={(event) => {
                      const y = event.nativeEvent.contentOffset.y;
                      // Debounce: if the user stops moving, snap and select center
                      if (hourIdleTimerRef.current) clearTimeout(hourIdleTimerRef.current);
                      hourIdleTimerRef.current = setTimeout(() => {
                        const index = Math.round(y / ITEM_HEIGHT) % HOUR_COUNT;
                        const hour = (index + HOUR_COUNT) % HOUR_COUNT;
                        handleTimeChange(hour, selectedTime.getMinutes());
                        const targetY = (middleHourBase + hour) * ITEM_HEIGHT;
                        hourScrollRef.current?.scrollTo({ y: targetY, animated: true });
                      }, 120);
                    }}
                    onMomentumScrollEnd={(event) => {
                      const y = event.nativeEvent.contentOffset.y;
                      const index = Math.round(y / ITEM_HEIGHT) % HOUR_COUNT;
                      const hour = (index + HOUR_COUNT) % HOUR_COUNT;
                      handleTimeChange(hour, selectedTime.getMinutes());
                      // smoothly rebase into middle cycles
                      const targetY = getRebasedOffset(y, HOUR_COUNT, middleHourBase);
                      hourScrollRef.current?.scrollTo({ y: targetY, animated: false });
                    }}
                    onScrollEndDrag={(event) => {
                      const y = event.nativeEvent.contentOffset.y;
                      const index = Math.round(y / ITEM_HEIGHT) % HOUR_COUNT;
                      const hour = (index + HOUR_COUNT) % HOUR_COUNT;
                      handleTimeChange(hour, selectedTime.getMinutes());
                      const targetY = getRebasedOffset(y, HOUR_COUNT, middleHourBase);
                      hourScrollRef.current?.scrollTo({ y: getRebasedOffset(targetY, HOUR_COUNT, middleHourBase), animated: true });
                    }}
                    onLayout={() => {
                      // Scroll to current hour when modal opens
                      const h = selectedTime.getHours();
                      const targetY = (middleHourBase + h) * ITEM_HEIGHT;
                      hourScrollRef.current?.scrollTo({ y: targetY, animated: false });
                    }}
                  >
                    {Array.from({ length: getHourLoopSize() }, (_, i) => {
                      const val = i % HOUR_COUNT;
                      const selected = selectedTime.getHours() === val;
                      return (
                        <TouchableOpacity
                          key={i}
                          style={styles.timeOption}
                          onPress={() => {
                            const hour = val;
                            handleTimeChange(hour, selectedTime.getMinutes());
                            const targetY = (middleHourBase + hour) * ITEM_HEIGHT;
                            hourScrollRef.current?.scrollTo({ y: targetY, animated: true });
                          }}
                          activeOpacity={0.6}
                        >
                          <Text style={[styles.timeOptionText, selected && styles.timeOptionSelected]}>
                            {val.toString().padStart(2, '0')}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </ScrollView>
                  {/* Hold-to-scroll zones */}
                  <View pointerEvents="box-none" style={styles.holdZonesContainer}>
                    <Pressable
                      onPressIn={() => startHourAutoScroll(-1)}
                      onPressOut={stopHourAutoScroll}
                      style={styles.holdZoneTop}
                    />
                    <Pressable
                      onPressIn={() => startHourAutoScroll(1)}
                      onPressOut={stopHourAutoScroll}
                      style={styles.holdZoneBottom}
                    />
                  </View>
                </View>
                
                <View style={[styles.timeWheel, { height: WHEEL_HEIGHT }]}>
                  <Text style={styles.timeWheelLabel}>Minute</Text>
                  <ScrollView
                    ref={minuteScrollRef}
                    style={styles.timeScrollView}
                    contentContainerStyle={{ paddingVertical: CENTER_SPACER }}
                    showsVerticalScrollIndicator={false}
                    snapToInterval={ITEM_HEIGHT}
                    decelerationRate="fast"
                    nestedScrollEnabled
                    scrollEventThrottle={16}
                    onScroll={(event) => {
                      const y = event.nativeEvent.contentOffset.y;
                      if (minuteIdleTimerRef.current) clearTimeout(minuteIdleTimerRef.current);
                      minuteIdleTimerRef.current = setTimeout(() => {
                        const index = Math.round(y / ITEM_HEIGHT) % MIN_COUNT;
                        const minute = (index + MIN_COUNT) % MIN_COUNT;
                        handleTimeChange(selectedTime.getHours(), minute);
                        const targetY = (middleMinBase + minute) * ITEM_HEIGHT;
                        minuteScrollRef.current?.scrollTo({ y: targetY, animated: true });
                      }, 120);
                    }}
                    onMomentumScrollEnd={(event) => {
                      const y = event.nativeEvent.contentOffset.y;
                      const index = Math.round(y / ITEM_HEIGHT) % MIN_COUNT;
                      const minute = (index + MIN_COUNT) % MIN_COUNT;
                      handleTimeChange(selectedTime.getHours(), minute);
                      const targetY = getRebasedOffset(y, MIN_COUNT, middleMinBase);
                      minuteScrollRef.current?.scrollTo({ y: targetY, animated: false });
                    }}
                    onScrollEndDrag={(event) => {
                      const y = event.nativeEvent.contentOffset.y;
                      const index = Math.round(y / ITEM_HEIGHT) % MIN_COUNT;
                      const minute = (index + MIN_COUNT) % MIN_COUNT;
                      handleTimeChange(selectedTime.getHours(), minute);
                      const targetY = getRebasedOffset(y, MIN_COUNT, middleMinBase);
                      minuteScrollRef.current?.scrollTo({ y: getRebasedOffset(targetY, MIN_COUNT, middleMinBase), animated: true });
                    }}
                    onLayout={() => {
                      const m = selectedTime.getMinutes();
                      const targetY = (middleMinBase + m) * ITEM_HEIGHT;
                      minuteScrollRef.current?.scrollTo({ y: targetY, animated: false });
                    }}
                  >
                    {Array.from({ length: getMinLoopSize() }, (_, i) => {
                      const val = i % MIN_COUNT;
                      const selected = selectedTime.getMinutes() === val;
                      return (
                        <TouchableOpacity
                          key={i}
                          style={styles.timeOption}
                          onPress={() => {
                            const minute = val;
                            handleTimeChange(selectedTime.getHours(), minute);
                            const targetY = (middleMinBase + minute) * ITEM_HEIGHT;
                            minuteScrollRef.current?.scrollTo({ y: targetY, animated: true });
                          }}
                          activeOpacity={0.6}
                        >
                          <Text style={[styles.timeOptionText, selected && styles.timeOptionSelected]}>
                            {val.toString().padStart(2, '0')}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </ScrollView>
                  {/* Hold-to-scroll zones */}
                  <View pointerEvents="box-none" style={styles.holdZonesContainer}>
                    <Pressable
                      onPressIn={() => startMinuteAutoScroll(-1)}
                      onPressOut={stopMinuteAutoScroll}
                      style={styles.holdZoneTop}
                    />
                    <Pressable
                      onPressIn={() => startMinuteAutoScroll(1)}
                      onPressOut={stopMinuteAutoScroll}
                      style={styles.holdZoneBottom}
                    />
                  </View>
                </View>
              </View>
              
              <View style={styles.timeDisplay}>
                <Text style={styles.timeDisplayText}>
                  {selectedTime.getHours().toString().padStart(2, '0')}:
                  {selectedTime.getMinutes().toString().padStart(2, '0')}
                </Text>
              </View>
            </View>
            
            <TouchableOpacity
              style={styles.pickerButton}
              onPress={() => setShowTimePicker(false)}
            >
              <Text style={styles.pickerButtonText}>Done</Text>
            </TouchableOpacity>
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
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  mainSection: {
    backgroundColor: '#F0FDF4',
    borderRadius: 12,
    padding: 20,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 3.84,
    elevation: 5,
    borderWidth: 1,
    borderColor: '#BBF7D0',
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1F2937',
    marginBottom: 20,
    textAlign: 'center',
  },
  columnsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  leftColumn: {
    flex: 1,
    marginRight: 8,
  },
  rightColumn: {
    flex: 1,
    marginLeft: 8,
  },
  formCard: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 3.84,
    elevation: 5,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  formTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1F2937',
    marginBottom: 20,
    textAlign: 'center',
  },
  formField: {
    marginBottom: 16,
  },
  fieldLabel: {
    fontSize: 14,
    color: '#6B7280',
    marginBottom: 8,
    fontWeight: '500',
  },
  textInput: {
    backgroundColor: '#F3F4F6',
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
    color: '#1F2937',
  },
  textArea: {
    backgroundColor: '#F3F4F6',
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
    color: '#1F2937',
    minHeight: 100,
  },
  formRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  dateTimeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F3F4F6',
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    flex: 1,
    marginHorizontal: 4,
  },
  dateTimeText: {
    fontSize: 14,
    color: '#6B7280',
    marginLeft: 8,
  },
  dropdownButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#F3F4F6',
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    flex: 1,
    marginHorizontal: 4,
  },
  dropdownText: {
    fontSize: 14,
    color: '#6B7280',
  },
  attachmentButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F3F4F6',
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    flex: 1,
    marginHorizontal: 4,
  },
  publishButton: {
    backgroundColor: '#2563EB',
    borderRadius: 8,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 8,
  },
  publishButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
  listCard: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 3.84,
    elevation: 5,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  listTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1F2937',
    marginBottom: 20,
    textAlign: 'center',
  },
  announcementItem: {
    backgroundColor: '#F9FAFB',
    borderRadius: 8,
    padding: 16,
    marginBottom: 16,
    borderLeftWidth: 4,
    borderLeftColor: '#EAB308',
  },
  announcementHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  priorityIndicator: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#EAB308',
    marginRight: 12,
  },
  announcementTitle: {
    flex: 1,
    fontSize: 16,
    fontWeight: 'bold',
    color: '#1F2937',
  },
  actionButtons: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  actionButton: {
    padding: 4,
    marginLeft: 8,
  },
  announcementDescription: {
    fontSize: 14,
    color: '#6B7280',
    lineHeight: 20,
    marginBottom: 12,
  },
  announcementDate: {
    fontSize: 12,
    color: '#9CA3AF',
    fontStyle: 'italic',
  },
  // New styles for functionality
  loadingContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#6B7280',
  },
  errorContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
  },
  errorText: {
    marginTop: 16,
    fontSize: 16,
    color: '#EF4444',
    textAlign: 'center',
  },
  retryButton: {
    marginTop: 16,
    backgroundColor: '#22C55E',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  retryButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },
  emptyText: {
    marginTop: 16,
    fontSize: 18,
    fontWeight: '600',
    color: '#6B7280',
  },
  emptySubtext: {
    marginTop: 8,
    fontSize: 14,
    color: '#9CA3AF',
    textAlign: 'center',
  },
  dropdownMenu: {
    position: 'absolute',
    top: '100%',
    left: 0,
    right: 0,
    backgroundColor: 'white',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 3.84,
    elevation: 5,
    zIndex: 1000,
    marginTop: 4,
  },
  dropdownItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  dropdownItemText: {
    fontSize: 14,
    color: '#1F2937',
    marginLeft: 8,
  },
  publishButtonDisabled: {
    backgroundColor: '#9CA3AF',
  },
  publishButtonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  announcementMeta: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 8,
  },
  announcementCategory: {
    fontSize: 12,
    color: '#6B7280',
    backgroundColor: '#F3F4F6',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  // Date/Time Picker Modal Styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  pickerModal: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 24,
    margin: 20,
    minWidth: 300,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  pickerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1F2937',
    textAlign: 'center',
    marginBottom: 8,
  },
  pickerSubtitle: {
    fontSize: 14,
    color: '#6B7280',
    textAlign: 'center',
    marginBottom: 24,
  },
  dateInputs: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 24,
  },
  dateInputGroup: {
    flex: 1,
    marginHorizontal: 4,
  },
  dateInputLabel: {
    fontSize: 12,
    color: '#6B7280',
    marginBottom: 8,
    textAlign: 'center',
  },
  dateInput: {
    backgroundColor: '#F3F4F6',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 12,
    fontSize: 16,
    color: '#1F2937',
    textAlign: 'center',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  timePickerContainer: {
    marginBottom: 24,
  },
  timeWheelContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 20,
  },
  timeWheel: {
    flex: 1,
    marginHorizontal: 8,
    height: 200,
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    overflow: 'hidden',
  },
  holdZonesContainer: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    right: 0,
    justifyContent: 'space-between',
  },
  holdZoneTop: {
    height: '35%',
  },
  holdZoneBottom: {
    height: '35%',
  },
  timeWheelLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#475569',
    textAlign: 'center',
    paddingVertical: 12,
    backgroundColor: '#F1F5F9',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  timeScrollView: {
    flex: 1,
  },
  timeOption: {
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  timeOptionText: {
    fontSize: 18,
    color: '#64748B',
    fontWeight: '500',
  },
  timeOptionSelected: {
    color: '#22C55E',
    fontWeight: 'bold',
    fontSize: 20,
  },
  timeDisplay: {
    backgroundColor: '#F0FDF4',
    borderRadius: 12,
    paddingVertical: 16,
    paddingHorizontal: 24,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#BBF7D0',
  },
  timeDisplayText: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#15803D',
  },
  futureTimeButton: {
    backgroundColor: '#3B82F6',
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 16,
    marginBottom: 16,
    alignSelf: 'center',
  },
  futureTimeButtonText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '600',
  },
  pickerButton: {
    backgroundColor: '#22C55E',
    borderRadius: 8,
    paddingVertical: 12,
    paddingHorizontal: 24,
    alignItems: 'center',
  },
  pickerButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  // Pagination styles
  paginationContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 20,
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: 'white',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  paginationInfo: {
    fontSize: 14,
    color: '#6B7280',
  },
  paginationButtons: {
    flexDirection: 'row',
    gap: 8,
  },
  paginationButton: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    backgroundColor: 'white',
    minWidth: 40,
    alignItems: 'center',
  },
  paginationButtonActive: {
    backgroundColor: '#22C55E',
    borderColor: '#22C55E',
  },
  paginationButtonDisabled: {
    backgroundColor: '#F3F4F6',
    borderColor: '#E5E7EB',
  },
  paginationButtonText: {
    fontSize: 14,
    color: '#6B7280',
    fontWeight: '500',
  },
  paginationButtonTextActive: {
    color: 'white',
  },
  paginationButtonTextDisabled: {
    color: '#9CA3AF',
  },
  // Edit Modal styles
  editModalContainer: {
    backgroundColor: 'white',
    borderRadius: 12,
    margin: 20,
    maxHeight: '80%',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  editModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  editModalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1F2937',
  },
  closeButton: {
    padding: 4,
  },
  editModalContent: {
    padding: 20,
  },
  // Publish status styles
  announcementMetaLeft: {
    flex: 1,
  },
  publishStatus: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
  },
  publishStatusText: {
    fontSize: 12,
    fontWeight: '500',
    marginLeft: 4,
  },
});

export default AnnouncementsTab;
