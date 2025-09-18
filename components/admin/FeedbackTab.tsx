import { Ionicons } from '@expo/vector-icons';
import { collection, doc, getDoc, getDocs, onSnapshot, orderBy, query, where } from 'firebase/firestore';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Image, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { db, storage } from '../../config/firebase';
import { useAuthContext } from '../AuthContext';

interface Feedback {
  id: string;
  userId: string;
  userEmail: string;
  userName: string;
  photoURL?: string;
  rating: string; // "Loved it", "Good", "Bad", "Terrible"
  title: string;
  message: string;
  createdAt: any;
  street?: string;
}

const FeedbackTab: React.FC = () => {
  const { user } = useAuthContext();
  const [feedbacks, setFeedbacks] = useState<Feedback[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Resolve storage path to download URL if needed
  const resolvePhotoURL = async (maybePath?: string) => {
    try {
      if (!maybePath) return undefined;
      const isHttp = /^https?:\/\//i.test(maybePath);
      if (isHttp) return maybePath;
      if (!storage) return undefined;
      const { getDownloadURL, ref } = await import('firebase/storage');
      const r = ref(storage, maybePath);
      return await getDownloadURL(r);
    } catch (e) {
      console.warn('FeedbackTab: Failed to resolve photo URL:', e);
      return undefined;
    }
  };

  // Fetch feedbacks from Firestore
  useEffect(() => {
    if (!db) {
      setError('Firebase not initialized');
      setLoading(false);
      return;
    }

    console.log('Setting up real-time feedbacks listener...');
    
    const feedbacksRef = collection(db, 'feedback');
    const q = query(feedbacksRef, orderBy('createdAt', 'desc'));
    
    const unsubscribe = onSnapshot(q, 
      (snapshot) => {
        console.log('Feedbacks snapshot received:', snapshot.docs.length, 'documents');
        
        // Process feedbacks and fetch user data
        const processFeedbacks = async () => {
          const feedbacksData: Feedback[] = [];
          const userCacheById = new Map<string, any>();
          const userCacheByEmail = new Map<string, any>();
          
          for (const docSnapshot of snapshot.docs) {
            const data = docSnapshot.data();
            let userName = 'User';
            let userEmail = '';
            let photoURL: string | undefined = undefined;
            
            // Fetch user data from users collection
            try {
              // 1) Try by userId
              if (data.userId) {
                let userData = userCacheById.get(data.userId);
                if (!userData) {
                  const userDoc = await getDoc(doc(db, 'users', data.userId));
                  if (userDoc.exists()) userData = userDoc.data();
                  if (userData) userCacheById.set(data.userId, userData);
                }
                if (userData) {
                  userName = userData.displayName || userData.email?.split('@')[0] || 'User';
                  userEmail = userData.email || data.userEmail || '';
                  photoURL = await resolvePhotoURL(userData.photoURL || userData.avatar || undefined);
                }
              }

              // 2) If still missing, try by email
              if (!userEmail) {
                const emailKey = (data.userEmail || '').toLowerCase();
                if (emailKey) {
                  let userData = userCacheByEmail.get(emailKey);
                  if (!userData) {
                    const usersRef = collection(db, 'users');
                    const qUsers = query(usersRef, where('email', '==', data.userEmail));
                    const snapUsers = await getDocs(qUsers);
                    if (!snapUsers.empty) userData = snapUsers.docs[0].data();
                    if (userData) userCacheByEmail.set(emailKey, userData);
                  }
                  if (userData) {
                    userName = userData.displayName || userData.email?.split('@')[0] || userName;
                    userEmail = userData.email || data.userEmail || userEmail;
                    if (!photoURL) photoURL = await resolvePhotoURL(userData.photoURL || userData.avatar || undefined);
                  }
                }
              }

              // 3) Fallbacks from feedback document itself
              if (!userEmail) userEmail = data.userEmail || '';
              if (!userName) userName = userEmail?.split('@')[0] || 'User';
              if (!photoURL && (data.photoURL || data.avatar)) {
                photoURL = await resolvePhotoURL(data.photoURL || data.avatar);
              }
            } catch (error) {
              console.error('Error enriching user data:', error);
              userName = data.userEmail?.split('@')[0] || 'User';
              userEmail = data.userEmail || '';
            }
            
            feedbacksData.push({
              id: docSnapshot.id,
              userId: data.userId || '',
              userEmail: userEmail,
              userName: userName,
              photoURL,
              rating: data.rating || 'Good',
              title: data.title || '',
              message: data.description || data.message || '',
              createdAt: data.createdAt,
              street: data.street || ''
            });
          }
          
          console.log('Processed feedbacks with user data:', feedbacksData.length);
          setFeedbacks(feedbacksData);
          setLoading(false);
          setError(null);
        };
        
        processFeedbacks();
      },
      (error) => {
        console.error('Error fetching feedbacks:', error);
        setError('Failed to fetch feedbacks');
        setLoading(false);
      }
    );

    return () => {
      console.log('Cleaning up feedbacks listener');
      unsubscribe();
    };
  }, []);

  const getRatingEmoji = (rating: string) => {
    switch (rating.toLowerCase()) {
      case 'loved it': return '😀';
      case 'good': return '😊';
      case 'bad': return '😐';
      case 'terrible': return '😠';
      default: return '😐';
    }
  };

  const getRatingText = (rating: string) => {
    switch (rating.toLowerCase()) {
      case 'loved it': return 'Loved it!';
      case 'good': return 'Good';
      case 'bad': return 'Bad';
      case 'terrible': return 'Terrible';
      default: return 'Unknown';
    }
  };

  const getRatingPercentage = (rating: string) => {
    if (feedbacks.length === 0) return 0;
    const count = feedbacks.filter(f => f.rating.toLowerCase() === rating.toLowerCase()).length;
    return Math.round((count / feedbacks.length) * 100);
  };

  const getRatingBarWidth = (rating: string) => {
    const percentage = getRatingPercentage(rating);
    return percentage;
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

  const getFeedbackStats = () => {
    const stats = {
      loved: getRatingPercentage('Loved it'),
      good: getRatingPercentage('Good'),
      bad: getRatingPercentage('Bad'),
      terrible: getRatingPercentage('Terrible')
    };
    return stats;
  };

  return (
    <ScrollView style={styles.container}>
      <View style={styles.mainSection}>
        <View style={styles.header}>
          <Text style={styles.title}>Feedbacks</Text>
          <TouchableOpacity style={styles.emojiButton}>
            <Text style={styles.emojiButtonText}>Select emoji</Text>
          </TouchableOpacity>
        </View>

        {/* Loading State */}
        {loading && (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#22C55E" />
            <Text style={styles.loadingText}>Loading feedbacks...</Text>
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
          <View style={styles.contentContainer}>
            {/* Feedback Summary Panel */}
            <View style={styles.summaryPanel}>
              <Text style={styles.summaryTitle}>Feedback Summary</Text>
              
              {/* Rating Bars */}
              <View style={styles.ratingBars}>
                <View style={styles.ratingBar}>
                  <Text style={styles.ratingEmoji}>😀</Text>
                  <View style={styles.barContainer}>
                    <View style={[styles.bar, { width: `${getRatingBarWidth('Loved it')}%` }]} />
                  </View>
                </View>
                
                <View style={styles.ratingBar}>
                  <Text style={styles.ratingEmoji}>😊</Text>
                  <View style={styles.barContainer}>
                    <View style={[styles.bar, { width: `${getRatingBarWidth('Good')}%` }]} />
                  </View>
                </View>
                
                <View style={styles.ratingBar}>
                  <Text style={styles.ratingEmoji}>😐</Text>
                  <View style={styles.barContainer}>
                    <View style={[styles.bar, { width: `${getRatingBarWidth('Bad')}%` }]} />
                  </View>
                </View>
                
                <View style={styles.ratingBar}>
                  <Text style={styles.ratingEmoji}>😠</Text>
                  <View style={styles.barContainer}>
                    <View style={[styles.bar, { width: `${getRatingBarWidth('Terrible')}%` }]} />
                  </View>
                </View>
              </View>

              {/* Percentage Breakdown */}
              <View style={styles.percentageBreakdown}>
                <Text style={styles.percentageItem}>
                  😀 Loved it! ({getRatingPercentage('Loved it')}%)
                </Text>
                <Text style={styles.percentageItem}>
                  😊 Good ({getRatingPercentage('Good')}%)
                </Text>
                <Text style={styles.percentageItem}>
                  😐 Bad ({getRatingPercentage('Bad')}%)
                </Text>
                <Text style={styles.percentageItem}>
                  😠 Terrible ({getRatingPercentage('Terrible')}%)
                </Text>
              </View>
            </View>

            {/* Individual Feedback Cards */}
            <View style={styles.feedbackCards}>
              {feedbacks.length === 0 ? (
                <View style={styles.emptyContainer}>
                  <Ionicons name="chatbubbles-outline" size={64} color="#9CA3AF" />
                  <Text style={styles.emptyText}>No feedbacks found</Text>
                  <Text style={styles.emptySubtext}>Feedbacks will appear here when users submit them</Text>
                </View>
              ) : (
                feedbacks.map((feedback) => (
                  <View key={feedback.id} style={styles.feedbackCard}>
                    <View style={styles.feedbackHeader}>
                      <View style={styles.userInfo}>
                        <View style={styles.avatarContainer}>
                          {feedback.photoURL ? (
                            <Image source={{ uri: feedback.photoURL }} style={styles.avatarImage} />
                          ) : (
                            <Ionicons name="person" size={24} color="#9CA3AF" />
                          )}
                          <View style={styles.ratingBadge}>
                            <Text style={styles.ratingBadgeEmoji}>
                              {getRatingEmoji(feedback.rating)}
                            </Text>
                          </View>
                        </View>
                        <Text style={styles.userName}>{feedback.userName}</Text>
                      </View>
                      
                      <View style={styles.feedbackContent}>
                        <Text style={styles.feedbackTitle}>
                          "{getRatingText(feedback.rating)}"
                        </Text>
                        <Text style={styles.feedbackMessage}>
                          {feedback.message}
                        </Text>
                        <Text style={styles.feedbackTimestamp}>
                          {feedback.street ? `[${feedback.street}] ` : ''}on {formatDate(feedback.createdAt)}
                        </Text>
                      </View>
                    </View>
                  </View>
                ))
              )}
            </View>
          </View>
        )}
      </View>
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
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1F2937',
  },
  emojiButton: {
    backgroundColor: 'white',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#D1FAE5',
  },
  emojiButtonText: {
    fontSize: 14,
    color: '#6B7280',
  },
  contentContainer: {
    flexDirection: 'row',
    gap: 20,
  },
  summaryPanel: {
    flex: 1,
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
  summaryTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1F2937',
    marginBottom: 20,
  },
  ratingBars: {
    marginBottom: 20,
  },
  ratingBar: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  ratingEmoji: {
    fontSize: 20,
    marginRight: 12,
    width: 30,
  },
  barContainer: {
    flex: 1,
    height: 8,
    backgroundColor: '#F3F4F6',
    borderRadius: 4,
    overflow: 'hidden',
  },
  bar: {
    height: '100%',
    backgroundColor: '#F97316',
    borderRadius: 4,
  },
  percentageBreakdown: {
    gap: 8,
  },
  percentageItem: {
    fontSize: 14,
    color: '#6B7280',
  },
  feedbackCards: {
    flex: 1,
    gap: 16,
  },
  feedbackCard: {
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
  feedbackHeader: {
    flexDirection: 'row',
    gap: 16,
  },
  userInfo: {
    alignItems: 'center',
    minWidth: 80,
  },
  avatarContainer: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#F3F4F6',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
    position: 'relative',
  },
  avatarImage: {
    width: 50,
    height: 50,
    borderRadius: 25,
  },
  ratingBadge: {
    position: 'absolute',
    top: -5,
    right: -5,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: 'white',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#E5E7EB',
  },
  ratingBadgeEmoji: {
    fontSize: 12,
  },
  userName: {
    fontSize: 12,
    color: '#6B7280',
    textAlign: 'center',
  },
  feedbackContent: {
    flex: 1,
  },
  feedbackTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#1F2937',
    marginBottom: 8,
  },
  feedbackMessage: {
    fontSize: 14,
    color: '#6B7280',
    lineHeight: 20,
    marginBottom: 8,
  },
  feedbackTimestamp: {
    fontSize: 12,
    color: '#9CA3AF',
    textAlign: 'right',
  },
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
});

export default FeedbackTab;
