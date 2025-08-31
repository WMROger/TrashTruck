import { Ionicons } from '@expo/vector-icons';
import React, { useState } from 'react';
import { ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';

interface Announcement {
  id: string;
  title: string;
  description: string;
  datePosted: string;
  priority: string;
  category: string;
}

const AnnouncementsTab: React.FC = () => {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [selectedDate, setSelectedDate] = useState('');
  const [selectedTime, setSelectedTime] = useState('');
  const [selectedPriority, setSelectedPriority] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');

  // Mock data - replace with backend integration
  const [announcements, setAnnouncements] = useState<Announcement[]>([
    {
      id: '1',
      title: 'Pickup Rescheduled - Zone 2',
      description: 'Please note that garbage pickup in Zone 2 will take place on Friday, August 30 instead of Thursday due to a city event. Thank you for your understanding.',
      datePosted: 'August 20, 2025',
      priority: 'Medium',
      category: 'Schedule Change'
    }
  ]);

  const handlePublish = () => {
    if (!title || !description) {
      // Show validation error
      return;
    }

    const newAnnouncement: Announcement = {
      id: Date.now().toString(),
      title,
      description,
      datePosted: new Date().toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      }),
      priority: selectedPriority || 'Medium',
      category: selectedCategory || 'General'
    };

    setAnnouncements([newAnnouncement, ...announcements]);
    
    // Reset form
    setTitle('');
    setDescription('');
    setSelectedDate('');
    setSelectedTime('');
    setSelectedPriority('');
    setSelectedCategory('');
  };

  const handleDelete = (id: string) => {
    setAnnouncements(announcements.filter(announcement => announcement.id !== id));
  };

  return (
    <ScrollView style={styles.container}>
      <View style={styles.announcementsContainer}>
        <Text style={styles.sectionTitle}>Announcements Dashboard</Text>
        
        <View style={styles.layout}>
          {/* Left Column - Create Announcement */}
          <View style={styles.createColumn}>
            <View style={styles.createPanel}>
              <Text style={styles.panelTitle}>Create a New Announcement</Text>
              
              <View style={styles.formField}>
                <Text style={styles.formLabel}>Title</Text>
                <TextInput
                  style={styles.titleInput}
                  value={title}
                  onChangeText={setTitle}
                  placeholder="Enter announcement title"
                  placeholderTextColor="#999"
                />
              </View>

              <View style={styles.formField}>
                <Text style={styles.formLabel}>Description</Text>
                <TextInput
                  style={styles.descriptionInput}
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
                <TouchableOpacity style={styles.dateTimeButton}>
                  <Ionicons name="calendar" size={20} color="#666" />
                  <Text style={styles.dateTimeText}>Set date</Text>
                </TouchableOpacity>
                
                <TouchableOpacity style={styles.dateTimeButton}>
                  <Ionicons name="time" size={20} color="#666" />
                  <Text style={styles.dateTimeText}>Set time</Text>
                </TouchableOpacity>
              </View>

              <View style={styles.formRow}>
                <TouchableOpacity style={styles.dropdownButton}>
                  <Text style={styles.dropdownText}>
                    {selectedPriority || 'Priority/Category'}
                  </Text>
                  <Ionicons name="chevron-down" size={20} color="#666" />
                </TouchableOpacity>
                
                <TouchableOpacity style={styles.attachmentButton}>
                  <Ionicons name="attach" size={20} color="#666" />
                  <Text style={styles.attachmentText}>Attachments</Text>
                </TouchableOpacity>
              </View>

              <TouchableOpacity style={styles.publishButton} onPress={handlePublish}>
                <Text style={styles.publishButtonText}>Publish Now</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Right Column - View Announcements */}
          <View style={styles.viewColumn}>
            <View style={styles.viewPanel}>
              <Text style={styles.panelTitle}>Today</Text>
              
              {announcements.map((announcement) => (
                <View key={announcement.id} style={styles.announcementCard}>
                  <View style={styles.announcementHeader}>
                    <View style={styles.priorityDot} />
                    <Text style={styles.announcementTitle}>{announcement.title}</Text>
                    <View style={styles.actionButtons}>
                      <TouchableOpacity style={styles.editButton}>
                        <Ionicons name="create" size={16} color="#4169E1" />
                      </TouchableOpacity>
                      <TouchableOpacity 
                        style={styles.deleteButton}
                        onPress={() => handleDelete(announcement.id)}
                      >
                        <Ionicons name="trash" size={16} color="#FF6347" />
                      </TouchableOpacity>
                    </View>
                  </View>
                  
                  <Text style={styles.announcementDescription}>
                    {announcement.description}
                  </Text>
                  
                  <Text style={styles.announcementDate}>
                    Date Posted: {announcement.datePosted}
                  </Text>
                </View>
              ))}
            </View>
          </View>
        </View>
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  announcementsContainer: {
    backgroundColor: '#E8F5E8',
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
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 20,
    textAlign: 'center',
  },
  layout: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  createColumn: {
    flex: 1,
    marginRight: 10,
  },
  viewColumn: {
    flex: 1,
    marginLeft: 10,
  },
  createPanel: {
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
  },
  viewPanel: {
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
  },
  panelTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 20,
    textAlign: 'center',
  },
  formField: {
    marginBottom: 15,
  },
  formLabel: {
    fontSize: 14,
    color: '#666',
    marginBottom: 8,
    fontWeight: '500',
  },
  titleInput: {
    backgroundColor: '#F0F0F0',
    borderRadius: 8,
    paddingHorizontal: 15,
    paddingVertical: 12,
    fontSize: 16,
    color: '#333',
  },
  descriptionInput: {
    backgroundColor: '#F0F0F0',
    borderRadius: 8,
    paddingHorizontal: 15,
    paddingVertical: 12,
    fontSize: 16,
    color: '#333',
    minHeight: 100,
  },
  formRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 15,
  },
  dateTimeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F0F0F0',
    borderRadius: 8,
    paddingHorizontal: 15,
    paddingVertical: 12,
    flex: 1,
    marginHorizontal: 5,
  },
  dateTimeText: {
    fontSize: 14,
    color: '#666',
    marginLeft: 8,
  },
  dropdownButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#F0F0F0',
    borderRadius: 8,
    paddingHorizontal: 15,
    paddingVertical: 12,
    flex: 1,
    marginHorizontal: 5,
  },
  dropdownText: {
    fontSize: 14,
    color: '#666',
  },
  attachmentButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F0F0F0',
    borderRadius: 8,
    paddingHorizontal: 15,
    paddingVertical: 12,
    flex: 1,
    marginHorizontal: 5,
  },
  attachmentText: {
    fontSize: 14,
    color: '#666',
    marginLeft: 8,
  },
  publishButton: {
    backgroundColor: '#4169E1',
    borderRadius: 8,
    paddingVertical: 15,
    alignItems: 'center',
    marginTop: 10,
  },
  publishButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
  announcementCard: {
    backgroundColor: '#F8F9FA',
    borderRadius: 8,
    padding: 15,
    marginBottom: 15,
    borderLeftWidth: 4,
    borderLeftColor: '#FFD700',
  },
  announcementHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  priorityDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#FFD700',
    marginRight: 10,
  },
  announcementTitle: {
    flex: 1,
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
  },
  actionButtons: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  editButton: {
    padding: 5,
    marginRight: 10,
  },
  deleteButton: {
    padding: 5,
  },
  announcementDescription: {
    fontSize: 14,
    color: '#666',
    lineHeight: 20,
    marginBottom: 10,
  },
  announcementDate: {
    fontSize: 12,
    color: '#999',
    fontStyle: 'italic',
  },
});

export default AnnouncementsTab;
