import { auth, db } from '@/config/firebase';
import { Feather } from '@expo/vector-icons';
import { collection, onSnapshot, query, where } from 'firebase/firestore';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Image, ScrollView, StatusBar, StyleSheet, Text, View, TouchableOpacity, Modal } from 'react-native';
import { useTheme } from '@/hooks/useTheme';

interface HistoryItem {
  id: string;
  street: string;
  wasteCategory: string;
  month: string;
  completionImage?: string;
}

export default function DriverHistoryPage() {
  const { theme } = useTheme();
  const isDark = theme === 'dark';

  const [loading, setLoading] = useState(true);
  const [historyData, setHistoryData] = useState<Record<string, HistoryItem[]>>({});

  useEffect(() => {
    if (!db || !auth?.currentUser) {
      setLoading(false);
      return;
    }

    const currentUser = auth.currentUser;
    const historyQuery = query(
      collection(db, 'schedules'),
      where('assignedDriverId', '==', currentUser.uid),
      where('status', 'in', ['completed', 'issue'])
    );

    const unsubscribe = onSnapshot(historyQuery, (snapshot) => {
      const groupedData: Record<string, HistoryItem[]> = {};
      
      snapshot.forEach((doc) => {
        const data = doc.data();
        
        const timestamp = data.completedAt || data.issueReportedAt || new Date();
          const date = timestamp?.toDate ? timestamp.toDate() : new Date(timestamp);
          const monthKey = date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
          
          if (!groupedData[monthKey]) {
            groupedData[monthKey] = [];
          }
          
        groupedData[monthKey].push({
            id: doc.id,
            street: data.street || 'Unknown Street',
            wasteCategory: data.wasteCategory || 'General',
            month: monthKey,
            completionImage: (data.status === 'issue' ? data.issueImage : data.completionImage) || undefined
        });
      });
      
      setHistoryData(groupedData);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);
  const [selectedItem, setSelectedItem] = useState<HistoryItem | null>(null);

  if (loading) {
    return (
      <View style={[styles.container, isDark && styles.containerDark, styles.center]}>
        <ActivityIndicator size="large" color={isDark ? "#86EFAC" : "#4E6C50"} />
      </View>
    );
  }

  return (
    <View style={{ flex: 1 }}>
      <ScrollView style={[styles.container, isDark && styles.containerDark]} showsVerticalScrollIndicator={false}>
        <StatusBar barStyle={isDark ? "light-content" : "dark-content"} backgroundColor={isDark ? "#111827" : "#F4FBF1"} />
        
        {/* Header */}
        <View style={styles.header}>
          <Text style={[styles.title, isDark && styles.textLight]}>History</Text>
          <Text style={[styles.subtitle, isDark && styles.textMuted]}>Track your past garbage collection records.</Text>
        </View>

        {/* History List Grouped by Month */}
        {Object.keys(historyData).length > 0 ? (
          Object.entries(historyData).map(([month, items]) => (
            <View key={month} style={styles.monthSection}>
              <Text style={[styles.monthTitle, isDark && styles.textLight]}>{month}</Text>
              
              <View style={styles.cardsContainer}>
                {items.map((item) => (
                  <TouchableOpacity 
                    key={item.id} 
                    style={[styles.historyCard, isDark && styles.cardDark]}
                    onPress={() => setSelectedItem(item)}
                    activeOpacity={0.7}
                  >
                    {item.completionImage ? (
                      <Image source={{ uri: item.completionImage }} style={styles.historyImage} />
                    ) : (
                      <View style={[styles.historyImage, { alignItems: 'center', justifyContent: 'center', backgroundColor: '#E5E7EB' }]}>
                        <Feather name="image" size={24} color="#9CA3AF" />
                      </View>
                    )}
                    <View style={styles.historyContent}>
                      <View style={styles.historyTextContainer}>
                        <Text style={[styles.historyStreet, isDark && styles.textLight]}>Street Name: {item.street}</Text>
                        <Text style={[styles.historyType, isDark && styles.textMuted]}>Type: {item.wasteCategory}</Text>
                      </View>
                      <View style={styles.completedBadge}>
                        <Text style={styles.completedBadgeText}>Completed</Text>
                      </View>
                    </View>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          ))
        ) : (
          <View style={[styles.emptyCard, isDark && styles.emptyCardDark]}>
            <Feather name="clock" size={48} color={isDark ? "#4B5563" : "#9CA3AF"} />
            <Text style={[styles.emptyText, isDark && styles.textLight]}>No history found</Text>
            <Text style={[styles.emptySubtext, isDark && styles.textMuted]}>Your completed pickups will appear here.</Text>
          </View>
        )}
        
        <View style={{ height: 100 }} />
      </ScrollView>

      {/* Details Modal */}
      <Modal
        visible={!!selectedItem}
        transparent
        animationType="fade"
        onRequestClose={() => setSelectedItem(null)}
      >
        <View style={styles.modalOverlay}>
          {selectedItem && (
            <View style={[styles.modalContent, isDark && styles.modalContentDark]}>
              {selectedItem.completionImage ? (
                <Image source={{ uri: selectedItem.completionImage }} style={styles.modalImage} />
              ) : (
                <View style={[styles.modalImage, { alignItems: 'center', justifyContent: 'center', backgroundColor: '#E5E7EB' }]}>
                  <Feather name="image" size={32} color="#9CA3AF" />
                </View>
              )}
              <Text style={[styles.modalStreet, isDark && styles.textLight]}>{selectedItem.street}</Text>
              <Text style={[styles.modalType, isDark && styles.textMuted]}>Category: {selectedItem.wasteCategory}</Text>
              <Text style={[styles.modalType, isDark && styles.textMuted]}>Month: {selectedItem.month}</Text>
              
              <TouchableOpacity style={styles.closeBtn} onPress={() => setSelectedItem(null)}>
                <Text style={styles.closeBtnText}>Close</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F4FBF1',
    paddingHorizontal: 20,
  },
  containerDark: {
    backgroundColor: '#111827',
  },
  center: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  textLight: {
    color: '#F9FAFB',
  },
  textMuted: {
    color: '#9CA3AF',
  },
  header: {
    marginTop: 60,
    marginBottom: 30,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#3B5241',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14,
    color: '#4B5563',
  },
  monthSection: {
    marginBottom: 24,
  },
  monthTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1F2937',
    marginBottom: 16,
  },
  cardsContainer: {
    gap: 16,
  },
  historyCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 5,
    elevation: 2,
    borderWidth: 1,
    borderColor: '#F3F4F6',
    flexDirection: 'row',
  },
  cardDark: {
    backgroundColor: '#1F2937',
    borderColor: '#374151',
  },
  historyImage: {
    width: 120,
    height: 120,
  },
  historyContent: {
    flex: 1,
    padding: 16,
    justifyContent: 'space-between',
  },
  historyTextContainer: {
    gap: 4,
  },
  historyStreet: {
    fontSize: 13,
    fontWeight: '600',
    color: '#1F2937',
  },
  historyType: {
    fontSize: 12,
    color: '#6B7280',
  },
  completedBadge: {
    alignSelf: 'flex-end',
  },
  completedBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#9CA3AF',
  },
  emptyCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 32,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderStyle: 'dashed',
    marginTop: 40,
  },
  emptyCardDark: {
    backgroundColor: '#1F2937',
    borderColor: '#374151',
  },
  emptyText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#4B5563',
    marginTop: 12,
  },
  emptySubtext: {
    fontSize: 14,
    color: '#9CA3AF',
    marginTop: 4,
    textAlign: 'center',
  },
  modalOverlay: {
    position: 'absolute',
    top: 0, bottom: 0, left: 0, right: 0,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    zIndex: 1000,
  },
  modalContent: {
    backgroundColor: '#FFF',
    borderRadius: 16,
    padding: 24,
    width: '100%',
    maxWidth: 400,
    alignItems: 'center',
  },
  modalContentDark: {
    backgroundColor: '#1F2937',
  },
  modalImage: {
    width: '100%',
    height: 200,
    borderRadius: 12,
    marginBottom: 16,
    resizeMode: 'cover',
  },
  modalStreet: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1F2937',
    marginBottom: 8,
    textAlign: 'center',
  },
  modalType: {
    fontSize: 14,
    color: '#4B5563',
    marginBottom: 4,
  },
  closeBtn: {
    marginTop: 24,
    backgroundColor: '#4E6C50',
    paddingVertical: 12,
    paddingHorizontal: 32,
    borderRadius: 8,
    width: '100%',
  },
  closeBtnText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
  }
});
