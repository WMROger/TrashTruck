import { IconSymbol } from '@/components/ui/IconSymbol';
import { auth, db } from '@/config/firebase';
import { collection, onSnapshot, query, where } from 'firebase/firestore';
import React, { useEffect, useState } from 'react';
import { Image, Modal, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

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
  const [showSortModal, setShowSortModal] = useState(false);
  const [selectedSort, setSelectedSort] = useState('Date (Newest First)');
  const [historyData, setHistoryData] = useState<HistoryData[]>([]);
  const [loading, setLoading] = useState(true);

  // Fetch completed history data
  useEffect(() => {
    if (!db || !auth?.currentUser) {
      console.log('No db or user available for history');
      setLoading(false);
      return;
    }

    const currentUser = auth.currentUser;
    const driverName = currentUser.displayName || currentUser.email || 'Unknown Driver';
    console.log('Fetching history for driver:', driverName);

    const historyQuery = query(
      collection(db, 'schedules'),
      where('driver', '==', driverName),
      where('status', '==', 'completed')
    );

    const unsubscribe = onSnapshot(historyQuery, (snapshot) => {
      console.log('History query result:', snapshot.docs.length, 'documents');
      
      const historyList: HistoryData[] = [];
      snapshot.forEach((doc) => {
        const data = doc.data();
        console.log('History item data:', data);
        historyList.push({
          id: doc.id,
          street: data.street,
          type: data.wasteCategory,
          status: 'Completed',
          date: data.dateText,
          time: data.timeText,
          image: data.completionImage ? { uri: data.completionImage } : require('../../../assets/images/icon.png'),
          completedAt: data.completedAt,
        });
      });
      
      // Sort by completedAt in descending order (newest first)
      const sortedHistory = historyList.sort((a, b) => {
        if (a.completedAt && b.completedAt) {
          return b.completedAt.toMillis() - a.completedAt.toMillis();
        }
        return 0;
      });
      
      console.log('Processed history items:', sortedHistory.length);
      setHistoryData(sortedHistory);
      setLoading(false);
    }, (error) => {
      console.error('Error fetching history:', error);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const sortOptions = [
    'Date (Newest First)',
    'Date (Oldest First)',
    'Status'
  ];

  const HistoryCard = ({ item }: { item: any }) => (
    <View style={styles.historyCard}>
      <Image source={item.image} style={styles.cardImage} />
      <View style={styles.cardContent}>
        <Text style={styles.streetText}>Street Name: "{item.street}"</Text>
        <Text style={styles.typeText}>Type: {item.type}</Text>
        <Text style={styles.dateText}>Date & Time: {item.date} - {item.time}</Text>
        <Text style={styles.statusText}>{item.status}</Text>
      </View>
    </View>
  );

  if (loading) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.title}>History</Text>
          <Text style={styles.subtitle}>Loading your history...</Text>
        </View>
        <View style={styles.loadingContainer}>
          <Text style={styles.loadingText}>Loading history...</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>History</Text>
        <Text style={styles.subtitle}>Track your past garbage collection records.</Text>
        
        <TouchableOpacity 
          style={styles.sortButton}
          onPress={() => setShowSortModal(true)}
        >
          <IconSymbol name="line.3.horizontal.decrease" size={16} color="#666" />
          <Text style={styles.sortText}>Sort by</Text>
          <IconSymbol name="chevron.down" size={14} color="#666" />
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        <View style={styles.gridContainer}>
          {historyData.length > 0 ? (
            historyData.map((item) => (
              <HistoryCard key={item.id} item={item} />
            ))
          ) : (
            <View style={styles.emptyState}>
              <Text style={styles.emptyText}>No completed pickups found</Text>
            </View>
          )}
        </View>
      </ScrollView>

      {/* Sort Modal */}
      <Modal
        transparent
        visible={showSortModal}
        animationType="fade"
        onRequestClose={() => setShowSortModal(false)}
      >
        <TouchableOpacity 
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setShowSortModal(false)}
        >
          <View style={styles.sortModal}>
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
                  <View style={[
                    styles.radioButton,
                    selectedSort === option && styles.radioButtonSelected
                  ]}>
                    {selectedSort === option && <View style={styles.radioInner} />}
                  </View>
                </View>
                <Text style={styles.optionText}>{option}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </TouchableOpacity>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#E8F5E8',
  },
  header: {
    paddingHorizontal: 16,
    paddingTop: 20,
    paddingBottom: 16,
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
    marginBottom: 16,
  },
  sortButton: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-end',
    backgroundColor: '#fff',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#ddd',
  },
  sortText: {
    fontSize: 14,
    color: '#666',
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
    backgroundColor: '#fff',
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
  streetText: {
    fontSize: 12,
    color: '#333',
    marginBottom: 4,
  },
  typeText: {
    fontSize: 12,
    color: '#333',
    marginBottom: 4,
  },
  dateText: {
    fontSize: 12,
    color: '#333',
    marginBottom: 8,
  },
  statusText: {
    fontSize: 12,
    color: '#4CAF50',
    fontWeight: 'bold',
    textAlign: 'center',
  },
  // Sort Modal Styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.3)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  sortModal: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    minWidth: 200,
    maxWidth: 300,
  },
  sortOption: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 8,
  },
  radioContainer: {
    marginRight: 12,
  },
  radioButton: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: '#ddd',
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioButtonSelected: {
    borderColor: '#4CAF50',
  },
  radioInner: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#4CAF50',
  },
  optionText: {
    fontSize: 14,
    color: '#333',
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
    width: '100%',
  },
  emptyText: {
    fontSize: 14,
    color: '#6c757d',
    textAlign: 'center',
  },
});
