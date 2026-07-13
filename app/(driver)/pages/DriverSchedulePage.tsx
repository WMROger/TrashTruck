import { auth, db } from '@/config/firebase';
import { Feather } from '@expo/vector-icons';
import { collection, onSnapshot, query } from 'firebase/firestore';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, StatusBar, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import CompletePickupModal from '@/components/driver/CompletePickupModal';
import ReportIssueModal from '@/components/driver/ReportIssueModal';

interface ScheduleItem {
  id: string;
  street: string;
  wasteCategory: string;
  timeText: string;
  dateText: string;
}

export default function DriverSchedulePage() {
  const [loading, setLoading] = useState(true);
  const [todaySchedules, setTodaySchedules] = useState<ScheduleItem[]>([]);
  const [tomorrowSchedules, setTomorrowSchedules] = useState<ScheduleItem[]>([]);

  // Modal states
  const [showCompleteModal, setShowCompleteModal] = useState(false);
  const [showIssueModal, setShowIssueModal] = useState(false);
  const [selectedPickupId, setSelectedPickupId] = useState<string | null>(null);

  useEffect(() => {
    if (!db || !auth?.currentUser) {
      setLoading(false);
      return;
    }

    const currentUser = auth.currentUser;
    const driverName = currentUser.displayName || currentUser.email || 'Unknown Driver';
    
    const allSchedulesQuery = query(collection(db, 'schedules'));
    
    const unsubscribe = onSnapshot(allSchedulesQuery, (snapshot) => {
      let todayList: ScheduleItem[] = [];
      let tomorrowList: ScheduleItem[] = [];
      
      const today = new Date();
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      
      const todayString = today.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
      const tomorrowString = tomorrow.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
      
      snapshot.forEach((doc) => {
        const data = doc.data();
        
        const isDriverMatch = 
          data.driver === driverName ||
          data.driver === currentUser.email ||
          data.assignedDriverName === driverName ||
          data.assignedDriverId === currentUser.uid;
          
        if (isDriverMatch && (data.status === 'pending' || !data.status)) {
          const item = {
            id: doc.id,
            street: data.street || 'Unknown Street',
            wasteCategory: data.wasteCategory || 'General',
            timeText: data.timeText || 'Unknown Time',
            dateText: data.dateText || 'Unknown Date'
          };

          if (data.dateText === todayString || data.dateText === 'Today') {
            todayList.push(item);
          } else if (data.dateText === tomorrowString || data.dateText === 'Tomorrow') {
            tomorrowList.push(item);
          }
        }
      });
      
      todayList.sort((a, b) => a.timeText.localeCompare(b.timeText));
      tomorrowList.sort((a, b) => a.timeText.localeCompare(b.timeText));
      
      setTodaySchedules(todayList);
      setTomorrowSchedules(tomorrowList);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const handleCompletePickup = (id: string) => {
    console.log('Open Complete Popup for', id);
  };

  const handleIssuePickup = (id: string) => {
    console.log('Open Issue Popup for', id);
  };

  if (loading) {
    return (
      <View style={[styles.container, styles.center]}>
        <ActivityIndicator size="large" color="#4E6C50" />
      </View>
    );
  }

  const renderScheduleCard = (item: ScheduleItem) => (
    <View key={item.id} style={styles.pickupCard}>
      <Text style={styles.pickupBarangay}>Barangay Poblacion</Text>
      <View style={styles.pickupDetails}>
        <View style={styles.detailRow}>
          <View style={styles.dotRed} />
          <Text style={styles.detailText}>Street Name: {item.street}</Text>
        </View>
        <View style={styles.detailRow}>
          <Feather name="clock" size={12} color="#E5E7EB" style={styles.detailIcon} />
          <Text style={styles.detailText}>Time: {item.timeText}</Text>
        </View>
        <View style={styles.detailRow}>
          <Text style={styles.detailTextType}>Type: {item.wasteCategory}</Text>
        </View>
      </View>
      
      <View style={styles.actionButtons}>
        <TouchableOpacity style={styles.completeBtn} onPress={() => handleCompletePickup(item.id)}>
          <Text style={styles.completeBtnText}>Complete</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.issueBtn} onPress={() => handleIssuePickup(item.id)}>
          <Text style={styles.issueBtnText}>Issue</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      <StatusBar barStyle="dark-content" backgroundColor="#F4FBF1" />
      
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>Schedule</Text>
        <Text style={styles.subtitle}>Your list of assigned pickups for today.</Text>
      </View>

      {/* Today Section */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Today</Text>
        {todaySchedules.length > 0 ? (
          todaySchedules.map(renderScheduleCard)
        ) : (
          <View style={styles.emptyCard}>
            <Feather name="calendar" size={32} color="#9CA3AF" />
            <Text style={styles.emptyText}>No pickups for today</Text>
          </View>
        )}
      </View>

      {/* Tomorrow Section */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Tomorrow</Text>
        {tomorrowSchedules.length > 0 ? (
          tomorrowSchedules.map(renderScheduleCard)
        ) : (
          <View style={styles.emptyCard}>
            <Feather name="calendar" size={32} color="#9CA3AF" />
            <Text style={styles.emptyText}>No pickups for tomorrow</Text>
          </View>
        )}
      </View>
      
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
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1F2937',
    marginBottom: 12,
  },
  pickupCard: {
    backgroundColor: '#58715B',
    borderRadius: 20,
    padding: 20,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  pickupBarangay: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 16,
  },
  pickupDetails: {
    marginBottom: 20,
    gap: 6,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  dotRed: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#EF4444',
    marginRight: 8,
    marginLeft: 3,
  },
  detailIcon: {
    marginRight: 8,
  },
  detailText: {
    fontSize: 13,
    color: '#E5E7EB',
  },
  detailTextType: {
    fontSize: 13,
    color: '#E5E7EB',
    marginLeft: 14,
  },
  actionButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  completeBtn: {
    backgroundColor: '#95C596',
    borderRadius: 20,
    paddingVertical: 10,
    paddingHorizontal: 24,
  },
  completeBtnText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 13,
  },
  issueBtn: {
    backgroundColor: '#F59E0B',
    borderRadius: 20,
    paddingVertical: 10,
    paddingHorizontal: 24,
  },
  issueBtnText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 13,
  },
  emptyCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 32,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderStyle: 'dashed',
  },
  emptyText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#4B5563',
    marginTop: 12,
  },
});
