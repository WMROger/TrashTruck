import { db } from '@/config/firebase';
import { Ionicons } from '@expo/vector-icons';
import { collection, onSnapshot, query, where } from 'firebase/firestore';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, RefreshControl, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

interface Announcement {
  id: string;
  title: string;
  description: string;
  datePosted: string;
  priority: 'Low' | 'Medium' | 'High' | 'Urgent';
  category: string;
  createdAt: any;
  publishedAt?: any;
}

export default function AnnouncementsScreen() {
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fetch published announcements from Firestore
  useEffect(() => {
    if (!db) {
      setError('Firebase not initialized');
      setLoading(false);
      return;
    }

    console.log('Setting up announcements listener...');
    
    const announcementsRef = collection(db, 'announcements');
    const q = query(
      announcementsRef, 
      where('isPublished', '==', true)
    );
    
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
            publishedAt: data.publishedAt
          };
        });
        
        // Sort by creation date (newest first) on the client side
        announcementsData.sort((a, b) => {
          const dateA = a.createdAt?.toDate ? a.createdAt.toDate() : new Date(a.createdAt);
          const dateB = b.createdAt?.toDate ? b.createdAt.toDate() : new Date(b.createdAt);
          return dateB.getTime() - dateA.getTime();
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

  const onRefresh = async () => {
    setRefreshing(true);
    // The real-time listener will automatically update the data
    setTimeout(() => setRefreshing(false), 1000);
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'Urgent':
        return '#EF4444';
      case 'High':
        return '#F97316';
      case 'Medium':
        return '#EAB308';
      case 'Low':
        return '#22C55E';
      default:
        return '#6B7280';
    }
  };

  const getPriorityIcon = (priority: string) => {
    switch (priority) {
      case 'Urgent':
        return 'alert-circle';
      case 'High':
        return 'warning';
      case 'Medium':
        return 'information-circle';
      case 'Low':
        return 'checkmark-circle';
      default:
        return 'ellipse';
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

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#22C55E" />
          <Text style={styles.loadingText}>Loading announcements...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (error) {
    return (
      <SafeAreaView style={styles.container}>
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
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Announcements</Text>
        <Text style={styles.subtitle}>Stay updated with the latest news</Text>
      </View>

      <ScrollView 
        style={styles.content}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={['#22C55E']}
            tintColor="#22C55E"
          />
        }
      >
        {announcements.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Ionicons name="megaphone-outline" size={64} color="#9CA3AF" />
            <Text style={styles.emptyText}>No announcements yet</Text>
            <Text style={styles.emptySubtext}>Check back later for updates</Text>
          </View>
        ) : (
          announcements.map((announcement) => (
            <View key={announcement.id} style={styles.announcementCard}>
              <View style={styles.announcementHeader}>
                <View style={styles.priorityContainer}>
                  <Ionicons 
                    name={getPriorityIcon(announcement.priority)} 
                    size={20} 
                    color={getPriorityColor(announcement.priority)} 
                  />
                  <Text style={[styles.priorityText, { color: getPriorityColor(announcement.priority) }]}>
                    {announcement.priority}
                  </Text>
                </View>
                <Text style={styles.categoryText}>{announcement.category}</Text>
              </View>
              
              <Text style={styles.announcementTitle}>{announcement.title}</Text>
              <Text style={styles.announcementDescription}>{announcement.description}</Text>
              
              <View style={styles.announcementFooter}>
                <Text style={styles.dateText}>
                  {formatDate(announcement.publishedAt || announcement.createdAt)}
                </Text>
              </View>
            </View>
          ))
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F0FDF4',
  },
  header: {
    paddingHorizontal: 20,
    paddingVertical: 20,
    backgroundColor: 'white',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#1F2937',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 16,
    color: '#6B7280',
  },
  content: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 20,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#6B7280',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  errorText: {
    marginTop: 16,
    fontSize: 16,
    color: '#EF4444',
    textAlign: 'center',
    marginBottom: 20,
  },
  retryButton: {
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
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
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
  announcementCard: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 20,
    marginBottom: 16,
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
  announcementHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  priorityContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  priorityText: {
    fontSize: 12,
    fontWeight: '600',
    marginLeft: 6,
    textTransform: 'uppercase',
  },
  categoryText: {
    fontSize: 12,
    color: '#6B7280',
    backgroundColor: '#F3F4F6',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  announcementTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1F2937',
    marginBottom: 8,
    lineHeight: 24,
  },
  announcementDescription: {
    fontSize: 14,
    color: '#6B7280',
    lineHeight: 20,
    marginBottom: 16,
  },
  announcementFooter: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
  },
  dateText: {
    fontSize: 12,
    color: '#9CA3AF',
  },
});
