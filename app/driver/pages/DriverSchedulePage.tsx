import { IconSymbol } from '@/components/ui/IconSymbol';
import { auth, db } from '@/config/firebase';
import { collection, onSnapshot, query, where } from 'firebase/firestore';
import React, { useEffect, useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

interface DriverSchedulePageProps {
  // Add any props you might need
}

interface Schedule {
  id: string;
  dateText: string;
  timeText: string;
  street: string;
  wasteCategory: string;
  driver: string;
  status?: string;
  note?: string;
  createdAt: any;
}

export default function DriverSchedulePage({}: DriverSchedulePageProps) {
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [loading, setLoading] = useState(true);

  // Fetch schedules for the current driver
  useEffect(() => {
    if (!db || !auth?.currentUser) {
      setLoading(false);
      return;
    }

    const currentUser = auth.currentUser;
    
    // Query schedules where driver matches current user's display name or email
    const driverName = currentUser.displayName || currentUser.email || 'Unknown Driver';
    const q = query(
      collection(db, 'schedules'),
      where('driver', '==', driverName)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const scheduleData: Schedule[] = [];
      snapshot.forEach((doc) => {
        const data = doc.data();
        scheduleData.push({
          id: doc.id,
          dateText: data.dateText,
          timeText: data.timeText,
          street: data.street,
          wasteCategory: data.wasteCategory,
          driver: data.driver,
          status: data.status || 'pending',
          note: data.note,
          createdAt: data.createdAt,
        });
      });
      
      // Exclude completed or issue statuses from the active schedule list
      const active = scheduleData.filter((s) => {
        const st = (s.status || 'pending').toLowerCase();
        return st !== 'completed' && st !== 'issue' && st !== 'resolved' && st !== 'done';
      });

      // Sort by date and time
      active.sort((a, b) => {
        const dateA = new Date(a.dateText);
        const dateB = new Date(b.dateText);
        if (dateA.getTime() === dateB.getTime()) {
          return a.timeText.localeCompare(b.timeText);
        }
        return dateA.getTime() - dateB.getTime();
      });
      
      setSchedules(active);
      setLoading(false);
    }, (error) => {
      console.error('Error fetching schedules:', error);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  // Filter schedules by today and tomorrow
  const getTodaySchedules = () => {
    const today = new Date();
    const todayStr = today.toLocaleDateString('en-US', { 
      month: 'long', 
      day: 'numeric', 
      year: 'numeric' 
    });
    
    return schedules.filter(schedule => schedule.dateText === todayStr);
  };

  const getTomorrowSchedules = () => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowStr = tomorrow.toLocaleDateString('en-US', { 
      month: 'long', 
      day: 'numeric', 
      year: 'numeric' 
    });
    
    return schedules.filter(schedule => schedule.dateText === tomorrowStr);
  };

  const todaySchedule = getTodaySchedules();
  const tomorrowSchedule = getTomorrowSchedules();

  const PickupCard = ({ item }: { item: Schedule }) => (
    <View style={styles.pickupCard}>
      <Text style={styles.barangayName}>{item.street}</Text>
      
      <View style={styles.detailRow}>
        <IconSymbol name="location.fill" size={14} color="#ff4444" />
        <Text style={styles.detailText}>Street Name: "{item.street}"</Text>
      </View>
      
      <View style={styles.detailRow}>
        <IconSymbol name="clock.fill" size={14} color="#ff4444" />
        <Text style={styles.detailText}>Time: {item.timeText}</Text>
      </View>
      
      <Text style={styles.detailText}>Type: {item.wasteCategory}</Text>
      
      {item.note && (
        <Text style={styles.noteText}>Note: {item.note}</Text>
      )}
      
      <View style={styles.actionButtons}>
        <TouchableOpacity style={styles.completeBtn}>
          <Text style={styles.btnText}>Complete</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.issueBtn}>
          <Text style={styles.btnText}>Issue</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  if (loading) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.title}>Schedule</Text>
          <Text style={styles.subtitle}>Loading your assigned pickups...</Text>
        </View>
        <View style={styles.loadingContainer}>
          <Text style={styles.loadingText}>Loading schedules...</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Schedule</Text>
        <Text style={styles.subtitle}>Your list of assigned pickups for today.</Text>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Today</Text>
        {todaySchedule.length > 0 ? (
          todaySchedule.map((item) => (
            <PickupCard key={item.id} item={item} />
          ))
        ) : (
          <View style={styles.emptyState}>
            <Text style={styles.emptyText}>No pickups scheduled for today</Text>
          </View>
        )}
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Tomorrow</Text>
        {tomorrowSchedule.length > 0 ? (
          tomorrowSchedule.map((item) => (
            <PickupCard key={item.id} item={item} />
          ))
        ) : (
          <View style={styles.emptyState}>
            <Text style={styles.emptyText}>No pickups scheduled for tomorrow</Text>
          </View>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#E8F5E8',
    paddingHorizontal: 16,
    paddingTop: 20,
  },
  header: {
    marginBottom: 24,
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
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#000',
    marginBottom: 12,
  },
  pickupCard: {
    backgroundColor: '#2D5016',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  },
  barangayName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 12,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  detailText: {
    fontSize: 14,
    color: '#fff',
    marginLeft: 8,
  },
  actionButtons: {
    flexDirection: 'row',
    marginTop: 16,
    gap: 12,
  },
  completeBtn: {
    backgroundColor: '#4CAF50',
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 8,
    flex: 1,
    alignItems: 'center',
  },
  issueBtn: {
    backgroundColor: '#FF9800',
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 8,
    flex: 1,
    alignItems: 'center',
  },
  btnText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 14,
  },
  noteText: {
    fontSize: 12,
    color: '#fff',
    marginTop: 4,
    fontStyle: 'italic',
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
  },
  emptyText: {
    fontSize: 14,
    color: '#6c757d',
    textAlign: 'center',
  },
});
