import { Ionicons } from '@expo/vector-icons';
import { addDoc, collection, deleteDoc, doc, onSnapshot, orderBy, query, serverTimestamp, updateDoc } from 'firebase/firestore';
import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Modal, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { db } from '../../config/firebase';
import { useAuthContext } from '../AuthContext';

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
  const [showPriorityDropdown, setShowPriorityDropdown] = useState(false);
  const [showCategoryDropdown, setShowCategoryDropdown] = useState(false);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(3);
  const [editingAnnouncement, setEditingAnnouncement] = useState<Announcement | null>(null);
  
  // Refs for time picker scroll views
  const hourScrollRef = useRef<ScrollView>(null);
  const minuteScrollRef = useRef<ScrollView>(null);

  // Set future time when time picker opens
  useEffect(() => {
    if (showTimePicker) {
      const now = new Date();
      const futureTime = new Date(now.getTime() + 60 * 60 * 1000); // 1 hour from now
      setSelectedTime(futureTime);
    }
  }, [showTimePicker]);
  const [showEditModal, setShowEditModal] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [timer, setTimer] = useState<NodeJS.Timeout | null>(null);

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
      Alert.alert('Validation Error', 'Please fill in both title and description');
      return;
    }

    if (!user) {
      Alert.alert('Error', 'You must be logged in to create announcements');
      return;
    }

    if (!db) {
      Alert.alert('Error', 'Database not available');
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
        Alert.alert('Success', 'Announcement published immediately!');
      } else {
        Alert.alert('Success', 'Announcement scheduled successfully!');
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
      Alert.alert('Error', 'Failed to publish announcement. Please try again.');
    } finally {
      setIsPublishing(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!db) {
      Alert.alert('Error', 'Database not available');
      return;
    }

    Alert.alert(
      'Delete Announcement',
      'Are you sure you want to delete this announcement?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              console.log('Deleting announcement:', id);
              await deleteDoc(doc(db, 'announcements', id));
              console.log('Announcement deleted successfully');
              Alert.alert('Success', 'Announcement deleted successfully!');
            } catch (error) {
              console.error('Error deleting announcement:', error);
              Alert.alert('Error', 'Failed to delete announcement. Please try again.');
            }
          }
        }
      ]
    );
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
      Alert.alert('Invalid Date', 'Please select a future date for the announcement.');
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

  const setFutureTime = () => {
    const now = new Date();
    const futureTime = new Date(now.getTime() + 60 * 60 * 1000); // 1 hour from now
    setSelectedTime(futureTime);
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
      Alert.alert('Validation Error', 'Please fill in both title and description');
      return;
    }

    if (!user) {
      Alert.alert('Error', 'You must be logged in to update announcements');
      return;
    }

    if (!db) {
      Alert.alert('Error', 'Database not available');
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
        isPublished: now >= scheduledDateTime, // Publish immediately if scheduled time has passed
        publishedAt: now >= scheduledDateTime ? serverTimestamp() : null
      };

      await updateDoc(doc(db, 'announcements', editingAnnouncement.id), announcementData);
      
      console.log('Announcement updated successfully');
      Alert.alert('Success', 'Announcement updated successfully!');
      
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
      Alert.alert('Error', 'Failed to update announcement. Please try again.');
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
            <Ionicons name="alert-circle" size={48} color="#EF4444" />
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
                <Text style={styles.fieldLabel}>Title</Text>
                <TextInput
                  style={styles.textInput}
                  value={title}
                  onChangeText={setTitle}
                  placeholder="Enter announcement title"
                  placeholderTextColor="#999"
                />
              </View>

              <View style={styles.formField}>
                <Text style={styles.fieldLabel}>Description</Text>
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
                  <Ionicons name="calendar" size={20} color="#666" />
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
                  <Ionicons name="time" size={20} color="#666" />
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
                  <Ionicons name="chevron-down" size={20} color="#666" />
                </TouchableOpacity>
                
                <TouchableOpacity 
                  style={styles.dropdownButton}
                  onPress={() => setShowCategoryDropdown(!showCategoryDropdown)}
                >
                  <Text style={styles.dropdownText}>
                    {selectedCategory}
                  </Text>
                  <Ionicons name="chevron-down" size={20} color="#666" />
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
                  <Ionicons name="megaphone-outline" size={64} color="#9CA3AF" />
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
                        >
                          <Ionicons name="create" size={16} color="#4169E1" />
                        </TouchableOpacity>
                        <TouchableOpacity 
                          style={styles.actionButton}
                          onPress={() => handleDelete(announcement.id)}
                        >
                          <Ionicons name="trash" size={16} color="#FF6347" />
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
                          <Ionicons 
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
                <Ionicons name="close" size={24} color="#000" />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.editModalContent}>
              <View style={styles.formField}>
                <Text style={styles.fieldLabel}>Title</Text>
                <TextInput
                  style={styles.textInput}
                  value={title}
                  onChangeText={setTitle}
                  placeholder="Enter announcement title"
                  placeholderTextColor="#999"
                />
              </View>

              <View style={styles.formField}>
                <Text style={styles.fieldLabel}>Description</Text>
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
                  <Ionicons name="calendar" size={20} color="#666" />
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
                  <Ionicons name="time" size={20} color="#666" />
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
                  <Ionicons name="chevron-down" size={20} color="#666" />
                </TouchableOpacity>
                
                <TouchableOpacity 
                  style={styles.dropdownButton}
                  onPress={() => setShowCategoryDropdown(!showCategoryDropdown)}
                >
                  <Text style={styles.dropdownText}>
                    {selectedCategory}
                  </Text>
                  <Ionicons name="chevron-down" size={20} color="#666" />
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
            <Text style={styles.pickerTitle}>Select Time</Text>
            <Text style={styles.pickerSubtitle}>Choose a time for your announcement</Text>
            
            <TouchableOpacity 
              style={styles.futureTimeButton}
              onPress={setFutureTime}
            >
              <Text style={styles.futureTimeButtonText}>Set to 1 hour from now</Text>
            </TouchableOpacity>
            
            <View style={styles.timePickerContainer}>
              <View style={styles.timeWheelContainer}>
                <View style={styles.timeWheel}>
                  <Text style={styles.timeWheelLabel}>Hour</Text>
                  <ScrollView
                    ref={hourScrollRef}
                    style={styles.timeScrollView}
                    showsVerticalScrollIndicator={false}
                    snapToInterval={40}
                    decelerationRate="fast"
                    onMomentumScrollEnd={(event) => {
                      const index = Math.round(event.nativeEvent.contentOffset.y / 40);
                      const hour = Math.max(0, Math.min(23, index));
                      handleTimeChange(hour, selectedTime.getMinutes());
                    }}
                    onLayout={() => {
                      // Scroll to current hour when modal opens
                      hourScrollRef.current?.scrollTo({
                        y: selectedTime.getHours() * 40,
                        animated: false
                      });
                    }}
                  >
                    {Array.from({ length: 24 }, (_, i) => (
                      <View key={i} style={styles.timeOption}>
                        <Text style={[
                          styles.timeOptionText,
                          selectedTime.getHours() === i && styles.timeOptionSelected
                        ]}>
                          {i.toString().padStart(2, '0')}
                        </Text>
                      </View>
                    ))}
                  </ScrollView>
                </View>
                
                <View style={styles.timeWheel}>
                  <Text style={styles.timeWheelLabel}>Minute</Text>
                  <ScrollView
                    ref={minuteScrollRef}
                    style={styles.timeScrollView}
                    showsVerticalScrollIndicator={false}
                    snapToInterval={40}
                    decelerationRate="fast"
                    onMomentumScrollEnd={(event) => {
                      const index = Math.round(event.nativeEvent.contentOffset.y / 40);
                      const minute = Math.max(0, Math.min(59, index));
                      handleTimeChange(selectedTime.getHours(), minute);
                    }}
                    onLayout={() => {
                      // Scroll to current minute when modal opens
                      minuteScrollRef.current?.scrollTo({
                        y: selectedTime.getMinutes() * 40,
                        animated: false
                      });
                    }}
                  >
                    {Array.from({ length: 60 }, (_, i) => (
                      <View key={i} style={styles.timeOption}>
                        <Text style={[
                          styles.timeOptionText,
                          selectedTime.getMinutes() === i && styles.timeOptionSelected
                        ]}>
                          {i.toString().padStart(2, '0')}
                        </Text>
                      </View>
                    ))}
                  </ScrollView>
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
