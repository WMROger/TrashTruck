import { auth, db } from '@/config/firebase';
import { Feather } from '@expo/vector-icons';
import { collection, onSnapshot, query, where } from 'firebase/firestore';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Image, ScrollView, StatusBar, StyleSheet, Text, View } from 'react-native';

interface HistoryItem {
  id: string;
  street: string;
  wasteCategory: string;
  month: string;
  completionImage: string;
}

export default function DriverHistoryPage() {
  const [loading, setLoading] = useState(true);
  const [historyData, setHistoryData] = useState<Record<string, HistoryItem[]>>({});

  useEffect(() => {
    if (!db || !auth?.currentUser) {
      setLoading(false);
      return;
    }

    const currentUser = auth.currentUser;
    const driverName = currentUser.displayName || currentUser.email || 'Unknown Driver';
    
    const historyQuery = query(
      collection(db, 'schedules'),
      where('status', 'in', ['completed', 'issue'])
    );

    const unsubscribe = onSnapshot(historyQuery, (snapshot) => {
      const groupedData: Record<string, HistoryItem[]> = {};
      
      snapshot.forEach((doc) => {
        const data = doc.data();
        
        const isDriverMatch = 
          data.driver === driverName ||
          data.driver === currentUser.email ||
          data.assignedDriverName === driverName ||
          data.assignedDriverId === currentUser.uid;
          
        if (isDriverMatch) {
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
            completionImage: (data.status === 'issue' ? data.issueImage : data.completionImage) || 'https://via.placeholder.com/150'
          });
        }
      });
      
      setHistoryData(groupedData);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  if (loading) {
    return (
      <View style={[styles.container, styles.center]}>
        <ActivityIndicator size="large" color="#4E6C50" />
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      <StatusBar barStyle="dark-content" backgroundColor="#F4FBF1" />
      
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>History</Text>
        <Text style={styles.subtitle}>Track your past garbage collection records.</Text>
      </View>

      {/* History List Grouped by Month */}
      {Object.keys(historyData).length > 0 ? (
        Object.entries(historyData).map(([month, items]) => (
          <View key={month} style={styles.monthSection}>
            <Text style={styles.monthTitle}>{month}</Text>
            
            <View style={styles.cardsContainer}>
              {items.map((item) => (
                <View key={item.id} style={styles.historyCard}>
                  <Image 
                    source={{ uri: item.completionImage }} 
                    style={styles.historyImage}
                  />
                  <View style={styles.historyContent}>
                    <View style={styles.historyTextContainer}>
                      <Text style={styles.historyStreet}>Street Name: {item.street}</Text>
                      <Text style={styles.historyType}>Type: {item.wasteCategory}</Text>
                    </View>
                    <View style={styles.completedBadge}>
                      <Text style={styles.completedBadgeText}>Completed</Text>
                    </View>
                  </View>
                </View>
              ))}
            </View>
          </View>
        ))
      ) : (
        <View style={styles.emptyCard}>
          <Feather name="clock" size={48} color="#9CA3AF" />
          <Text style={styles.emptyText}>No history found</Text>
          <Text style={styles.emptySubtext}>Your completed pickups will appear here.</Text>
        </View>
      )}
      
      <View style={{ height: 100 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F4FBF1',
    paddingHorizontal: 20,
  },
  center: {
    justifyContent: 'center',
    alignItems: 'center',
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
});
