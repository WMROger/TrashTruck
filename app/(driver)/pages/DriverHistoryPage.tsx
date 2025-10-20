import { IconSymbol } from '@/components/ui/IconSymbol';
import { auth, db } from '@/config/firebase';
import { Colors } from '@/constants/Colors';
import { useTheme } from '@/hooks/useTheme';
import { collection, onSnapshot, query, where } from 'firebase/firestore';
import React, { useEffect, useMemo, useState } from 'react';
import { Image, Modal, Platform, ScrollView, StyleSheet, Text, TouchableOpacity, TouchableWithoutFeedback, View } from 'react-native';
import ErrorModal from '../../../components/ErrorModal';

interface DriverHistoryPageProps {
  // Add any props you might need
}

interface HistoryData {
  id: string;
  street: string;
  type: string;
  status: string;
  date: string;
  time: string;
  image: any;
  completedAt: any;
}

export default function DriverHistoryPage({}: DriverHistoryPageProps) {
  const { theme } = useTheme();
  const colors = Colors[theme ?? 'light'];
  const [showSortModal, setShowSortModal] = useState(false);
  const [selectedSort, setSelectedSort] = useState('Date (Newest First)');
  const [historyData, setHistoryData] = useState<HistoryData[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorModal, setErrorModal] = useState({
    visible: false,
    title: 'Error',
    message: '',
    type: 'error' as 'error' | 'warning' | 'info' | 'success',
  });

  // Add escape key support for web
  useEffect(() => {
    if (Platform.OS === 'web') {
      const handleKeyDown = (event: KeyboardEvent) => {
        if (event.key === 'Escape') {
          if (showSortModal) {
            setShowSortModal(false);
          }
        }
      };

      document.addEventListener('keydown', handleKeyDown);
      return () => {
        document.removeEventListener('keydown', handleKeyDown);
      };
    }
  }, [showSortModal]);

  // Fetch completed and issue history data
  useEffect(() => {
    if (!db || !auth?.currentUser) {
      console.log('No db or user available for history');
      setLoading(false);
      return;
    }

    const currentUser = auth.currentUser;
    const driverName = currentUser.displayName || currentUser.email || 'Unknown Driver';
    console.log('Fetching history for driver:', driverName);
    console.log('Current user info:', {
      uid: currentUser.uid,
      email: currentUser.email,
      displayName: currentUser.displayName
    });

    // Try different driver field variations
    const historyQuery = query(
      collection(db, 'schedules'),
      where('status', 'in', ['completed', 'issue'])
    );

    const unsubscribe = onSnapshot(historyQuery, (snapshot) => {
      console.log('History query result:', snapshot.docs.length, 'completed documents');
      
      const historyList: HistoryData[] = [];
      let matchingDriverCount = 0;
      
      snapshot.forEach((doc) => {
        const data = doc.data();
        console.log('Checking document:', {
          id: doc.id,
          driver: data.driver,
          status: data.status,
          street: data.street,
          assignedDriverId: data.assignedDriverId,
          assignedDriverName: data.assignedDriverName
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
        console.log('Found matching driver document:', data);
        // Determine image source (completion or issue)
        const rawImage = data.status === 'issue' ? data.issueImage : data.completionImage;
        let imageSource;
        if (rawImage) {
          imageSource = { uri: rawImage };
        } else {
          imageSource = require('../../../assets/images/icon.png');
        }

        // Normalize timestamp for sorting/display
        const finalTimestamp = data.completedAt || data.issueReportedAt;
        const finalStatusText = data.status === 'issue' ? 'Issue' : 'Completed';

        historyList.push({
          id: doc.id,
          street: data.street,
          type: data.wasteCategory,
          status: finalStatusText,
          date: data.dateText,
          time: data.timeText,
          image: imageSource,
          completedAt: finalTimestamp,
        });
      });
      
      console.log(`Found ${matchingDriverCount} matching driver documents out of ${snapshot.docs.length} total completed documents`);
      console.log('Final processed history items:', historyList.length);
      // Store raw list; sorting is applied by UI selection
      setHistoryData(historyList);
      setLoading(false);
    }, (error) => {
      console.error('Error fetching history:', error);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  // Derived, sorted history based on selectedSort
  const sortedHistoryData = useMemo(() => {
    const copy = [...historyData];
    const toMillis = (ts: any) => {
      if (!ts) return 0;
      try {
        return ts.toMillis ? ts.toMillis() : new Date(ts).getTime();
      } catch {
        return 0;
      }
    };

    if (selectedSort === 'Date (Newest First)') {
      return copy.sort((a, b) => toMillis(b.completedAt) - toMillis(a.completedAt));
    }
    if (selectedSort === 'Date (Oldest First)') {
      return copy.sort((a, b) => toMillis(a.completedAt) - toMillis(b.completedAt));
    }
    if (selectedSort === 'Status') {
      // Order: Issue first, then Completed; tie-breaker by newest first
      const statusRank = (s: string) => (s?.toLowerCase() === 'issue' ? 0 : 1);
      return copy.sort((a, b) => {
        const diff = statusRank(a.status) - statusRank(b.status);
        if (diff !== 0) return diff;
        return toMillis(b.completedAt) - toMillis(a.completedAt);
      });
    }
    return copy;
  }, [historyData, selectedSort]);

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

  const sortOptions = [
    'Date (Newest First)',
    'Date (Oldest First)',
    'Status'
  ];

  const HistoryCard = ({ item }: { item: any }) => {
    // Determine image source - use Cloudinary URL if available, otherwise fallback
    const getImageSource = () => {
      if (item.image && typeof item.image === 'object' && item.image.uri) {
        // If it's already a Cloudinary URL or valid URI, use it
        return item.image;
      } else if (item.image && typeof item.image === 'string') {
        // If it's a string URL (Cloudinary or local), use it
        return { uri: item.image };
      } else {
        // Fallback to default icon
        return require('../../../assets/images/icon.png');
      }
    };

    return (
      <View style={[styles.historyCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <Image 
          source={getImageSource()} 
          style={styles.cardImage}
          onError={(error) => {
            console.log('Image failed to load:', item.image);
          }}
          defaultSource={require('../../../assets/images/icon.png')}
        />
        <View style={styles.cardContent}>
          <View style={styles.infoRow}>
            <IconSymbol name="mappin.and.ellipse" size={12} color={colors.textTertiary} />
            <Text style={[styles.streetText, { color: colors.textPrimary }]}>Street Name: "{item.street}"</Text>
          </View>
          <View style={styles.infoRow}>
            <IconSymbol name="trash.fill" size={12} color={colors.textTertiary} />
            <Text style={[styles.typeText, { color: colors.textSecondary }]}>Type: {item.type}</Text>
          </View>
          <View style={styles.infoRow}>
            <IconSymbol name="clock.fill" size={12} color={colors.textTertiary} />
            <Text style={[styles.dateText, { color: colors.textSecondary }]}>Date & Time: {item.date} - {item.time}</Text>
          </View>
          <View style={styles.statusRow}>
            <IconSymbol 
              name={item.status === 'Issue' ? 'exclamationmark.triangle.fill' : 'checkmark.circle.fill'} 
              size={12} 
              color={item.status === 'Issue' ? colors.warning : colors.success} 
            />
            <Text style={[styles.statusText, { color: item.status === 'Issue' ? colors.warning : colors.success }]}>
              {item.status}
            </Text>
          </View>
        </View>
      </View>
    );
  };

  if (loading) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={styles.header}>
          <Text style={[styles.title, { color: colors.textPrimary }]}>History</Text>
          <Text style={[styles.subtitle, { color: colors.textSecondary }]}>Loading your history...</Text>
        </View>
        <View style={styles.loadingContainer}>
          <Text style={[styles.loadingText, { color: colors.textSecondary }]}>Loading history...</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={styles.header}>
        <Text style={[styles.title, { color: colors.textPrimary }]}>History</Text>
        <Text style={[styles.subtitle, { color: colors.textSecondary }]}>Track your past garbage collection records.</Text>
        
        <TouchableOpacity 
          style={[styles.sortButton, { backgroundColor: colors.surface, borderColor: colors.border }]}
          onPress={() => setShowSortModal(true)}
        >
          <IconSymbol name="slider.horizontal.3" size={16} color={colors.textTertiary} />
          <Text style={[styles.sortText, { color: colors.textPrimary }]}>Sort by</Text>
          <IconSymbol name="chevron.down" size={14} color={colors.textTertiary} />
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        <View style={styles.gridContainer}>
          {sortedHistoryData.length > 0 ? (
            sortedHistoryData.map((item) => (
              <HistoryCard key={item.id} item={item} />
            ))
          ) : (
            <View style={styles.emptyState}>
              <IconSymbol name="clock.fill" size={48} color={colors.textTertiary} />
              <Text style={[styles.emptyText, { color: colors.textSecondary }]}>No history found</Text>
              <Text style={[styles.emptySubText, { color: colors.textTertiary }]}>
                Your completed and issue records will appear here
              </Text>
              <TouchableOpacity 
                style={[styles.debugButton, { backgroundColor: colors.secondary }]}
                onPress={() => console.log('Debug: Current user and query info')}
              >
                <Text style={[styles.debugButtonText, { color: colors.primary }]}>Check Console for Debug Info</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      </ScrollView>

      {/* Sort Modal */}
      <Modal
        transparent={true}
        visible={showSortModal}
        animationType="fade"
        onRequestClose={() => setShowSortModal(false)}
      >
        <TouchableWithoutFeedback onPress={() => setShowSortModal(false)}>
          <View style={styles.modalOverlay}>
            <TouchableWithoutFeedback onPress={(e) => e.stopPropagation()}>
              <View style={[styles.sortModal, { backgroundColor: colors.surface, borderColor: colors.border }]}>                
                {sortOptions.map((option) => (
                  <TouchableOpacity
                    key={option}
                    style={styles.sortOption}
                    onPress={() => {
                      setSelectedSort(option);
                      setShowSortModal(false);
                    }}
                  >
                    <View style={styles.radioContainer}>
                      <View
                        style={[
                          styles.radioButton,
                          { borderColor: colors.border },
                          selectedSort === option && { borderColor: colors.primary }
                        ]}
                      >
                        {selectedSort === option && <View style={[styles.radioInner, { backgroundColor: colors.primary }]} />}
                      </View>
                    </View>
                    <Text style={[styles.optionText, { color: colors.textPrimary }]}>{option}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </TouchableWithoutFeedback>
          </View>
        </TouchableWithoutFeedback>
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
  header: {
    paddingHorizontal: 16,
    paddingTop: 20,
    paddingBottom: 16,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    fontWeight: '400',
    marginBottom: 16,
  },
  sortButton: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-end',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
  },
  sortText: {
    fontSize: 14,
    marginHorizontal: 8,
  },
  scrollView: {
    flex: 1,
  },
  gridContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 16,
    justifyContent: 'space-between',
  },
  historyCard: {
    borderRadius: 12,
    marginBottom: 16,
    width: '48%',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
    overflow: 'hidden',
  },
  cardImage: {
    width: '100%',
    height: 120,
  },
  cardContent: {
    padding: 12,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
    gap: 6,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
    gap: 6,
  },
  streetText: {
    fontSize: 12,
    marginBottom: 4,
  },
  typeText: {
    fontSize: 12,
    marginBottom: 4,
  },
  dateText: {
    fontSize: 12,
    marginBottom: 8,
  },
  statusText: {
    fontSize: 12,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  // Sort Modal Styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  sortModal: {
    borderRadius: 12,
    padding: 12,
    minWidth: 220,
    maxWidth: 300,
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 6,
    elevation: 5,
  },
  sortOption: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 10,
  },
  radioContainer: {
    marginRight: 12,
  },
  radioButton: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioButtonSelected: {
  },
  radioInner: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  optionText: {
    fontSize: 14,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 40,
  },
  loadingText: {
    fontSize: 16,
    textAlign: 'center',
  },
  emptyState: {
    borderRadius: 8,
    padding: 20,
    alignItems: 'center',
    borderWidth: 1,
    width: '100%',
  },
  emptyText: {
    fontSize: 16,
    textAlign: 'center',
    marginTop: 12,
    fontWeight: '500',
  },
  emptySubText: {
    fontSize: 14,
    textAlign: 'center',
    marginTop: 8,
    lineHeight: 20,
  },
  debugButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 6,
    marginTop: 16,
  },
  debugButtonText: {
    fontSize: 12,
    fontWeight: '600',
  },
});
