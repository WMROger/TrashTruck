import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, Alert, TextInput } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { collection, query, where, getDocs, onSnapshot, orderBy, limit, addDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../../../config/firebase';
import { formatAdaptiveMassFromMetricTons, parseWasteAmountToMetricTons } from '../../../utils/wasteUnits';

interface DashboardStats {
  totalWaste: number;
  activeTrucks: number;
  totalTrucks: number;
  pendingIssues: number;
}

interface Report {
  id: string;
  barangay: string;
  type: string;
  status: string;
  statusColor: string;
}

interface Schedule {
  id: string;
  time: string;
  brgy: string;
  truck: string;
  status: string;
  color: string;
}

export default function CenroDashboardTab({ onTabChange }: { onTabChange?: (tab: string) => void }) {
  const [stats, setStats] = useState<DashboardStats>({ totalWaste: 0, activeTrucks: 0, totalTrucks: 0, pendingIssues: 0 });
  const [recentReports, setRecentReports] = useState<Report[]>([]);
  const [todaySchedules, setTodaySchedules] = useState<Schedule[]>([]);
  const [progress, setProgress] = useState({ completed: 0, total: 0 });
  const [loading, setLoading] = useState(true);

  // Manual Schedule State
  const [drivers, setDrivers] = useState<{id: string, name: string}[]>([]);

  useEffect(() => {
    if (!db) return;

    // 1. Fetch Drivers count and list
    const fetchDrivers = async () => {
      try {
        const usersRef = collection(db, 'users');
        const q = query(usersRef, where('role', '==', 'driver'));
        const snap = await getDocs(q);
        const total = snap.size;
        setStats(prev => ({ ...prev, totalTrucks: total, activeTrucks: total }));
        
        const dList: {id: string, name: string}[] = [];
        snap.forEach(doc => dList.push({ id: doc.id, name: doc.data().displayName || doc.data().email || 'Driver' }));
        setDrivers(dList);
      } catch(e) { console.error('Drivers error', e); }
    };
    fetchDrivers();

    // 2. Listen to Reports for metrics and recent table
    const reportsRef = collection(db, 'reports');
    const reportsQuery = query(reportsRef, orderBy('createdAt', 'desc'), limit(20));
    
    const unsubReports = onSnapshot(reportsQuery, (snapshot) => {
      let pendingCount = 0;
      let wasteSum = 0;
      const recent: Report[] = [];

      snapshot.forEach(doc => {
        const data = doc.data();
        
        // Count pending
        if (data.status === 'pending' || data.status === 'acknowledged') pendingCount++;
        
        // Sum waste if resolved/in-progress
        if (['resolved', 'in progress', 'in-progress'].includes(data.status)) {
          if (data.aiAnalysis && data.aiAnalysis.estimatedWeight) {
            wasteSum += parseWasteAmountToMetricTons(data.aiAnalysis.estimatedWeight) || 0;
          }
        }

        // Add to recent if we have less than 5
        if (recent.length < 5) {
          let statusColor = '#6b7280';
          if (data.status === 'pending') statusColor = '#ef4444';
          else if (data.status === 'acknowledged') statusColor = '#3b82f6';
          else if (data.status === 'in progress') statusColor = '#f59e0b';
          else if (data.status === 'resolved') statusColor = '#2E8B57';
          
          recent.push({
            id: doc.id.substring(0, 8).toUpperCase(),
            barangay: data.barangay || 'Unknown',
            type: (data.aiAnalysis?.wasteType || 'General Waste'),
            status: data.status ? data.status.toUpperCase() : 'UNKNOWN',
            statusColor
          });
        }
      });

      setStats(prev => ({ ...prev, pendingIssues: pendingCount, totalWaste: wasteSum }));
      setRecentReports(recent);
    });

    // 3. Listen to today's schedules from barangay_schedules
    const bSchedRef = collection(db, 'barangay_schedules');
    const bSchedQuery = query(bSchedRef, orderBy('createdAt', 'desc'));
    
    const unsubSched = onSnapshot(bSchedQuery, (snapshot) => {
      const schedules: Schedule[] = [];
      let comp = 0;
      let tot = 0;

      const now = new Date();
      const DAYS = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];
      const todayDayStr = DAYS[now.getDay()];
      const todayDateStr = `${(now.getMonth() + 1).toString().padStart(2, '0')}/${now.getDate().toString().padStart(2, '0')}`;

      snapshot.forEach(doc => {
        const data = doc.data();
        
        // Check for specific date matches
        if (data.specificSchedules && Array.isArray(data.specificSchedules)) {
          data.specificSchedules.forEach((spec: any, idx: number) => {
            if (spec.date === todayDateStr) {
              tot++;
              schedules.push({
                id: `${doc.id}-spec-${idx}`,
                time: spec.time || 'ASAP',
                brgy: data.barangayName || 'Unknown',
                truck: data.truck || 'Unassigned',
                status: 'SCHEDULED',
                color: '#3b82f6'
              });
            }
          });
        }
        
        // Check for recurring day matches
        if (data.days && Array.isArray(data.days) && data.days.includes(todayDayStr)) {
          tot++;
          schedules.push({
            id: `${doc.id}-rec`,
            time: 'Regular Route',
            brgy: data.barangayName || 'Unknown',
            truck: data.truck || 'Unassigned',
            status: 'SCHEDULED',
            color: '#2E8B57' // Green for regular routes
          });
        }
      });

      setProgress({ completed: comp, total: tot });
      setTodaySchedules(schedules);
      setLoading(false);
    });

    return () => {
      unsubReports();
      unsubSched();
    };
  }, []);

  const todayStr = new Date().toLocaleDateString('en-US', { weekday: 'long', day: 'numeric', month: 'short', year: 'numeric' });

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color="#2E8B57" />
      </View>
    );
  }

  const progressPercent = progress.total > 0 ? Math.round((progress.completed / progress.total) * 100) : 0;

  return (
    <ScrollView style={styles.container}>
      <Text style={styles.greeting}>Good morning, Administrator</Text>
      <Text style={styles.dateText}>{todayStr}</Text>

      <View style={styles.topCardsRow}>
        <View style={styles.card}>
          <View style={styles.cardIconWrapper}>
            <MaterialIcons name="delete-outline" size={24} color="#2E8B57" />
          </View>
          <Text style={styles.cardTitle}>AI-Estimated Waste</Text>
          <Text style={styles.cardValue}>{formatAdaptiveMassFromMetricTons(stats.totalWaste)}</Text>
          <Text style={styles.cardTrend}>Resolved and active reports</Text>
        </View>

        <View style={styles.card}>
          <View style={styles.cardIconWrapper}>
            <MaterialIcons name="local-shipping" size={24} color="#2E8B57" />
          </View>
          <Text style={styles.cardTitle}>Active Trucks</Text>
          <Text style={styles.cardValue}>{stats.activeTrucks}/{stats.totalTrucks} <Text style={styles.cardUnit}>drivers</Text></Text>
          <Text style={styles.cardTrendNeutral}>Registered drivers online</Text>
        </View>

        <View style={styles.card}>
          <View style={styles.cardIconWrapper}>
            <MaterialIcons name="report-problem" size={24} color="#ef4444" />
          </View>
          <Text style={styles.cardTitle}>Pending Issues</Text>
          <Text style={styles.cardValue}>{stats.pendingIssues} <Text style={styles.cardUnit}>active</Text></Text>
          <Text style={styles.cardTrendNegative}>Requires routing</Text>
        </View>
      </View>

      <View style={styles.mainRow}>
        <View style={styles.leftColumn}>
          {/* Progress Section */}
          <View style={styles.progressCard}>
            <Text style={styles.sectionTitle}>Daily Schedule Progress</Text>
            <View style={styles.progressHeader}>
              <Text style={styles.progressMainValue}>{progressPercent}%</Text>
              <Text style={styles.progressSubValue}>Overall Completion ({progress.completed}/{progress.total})</Text>
            </View>
            
            <View style={styles.barGroup}>
              <View style={styles.barLabelRow}>
                <Text style={styles.barLabel}>Route Tasks Completed</Text>
                <Text style={styles.barValue}>{progressPercent}%</Text>
              </View>
              <View style={styles.barBackground}>
                <View style={[styles.barFill, { width: `${progressPercent}%`, backgroundColor: '#2E8B57' }]} />
              </View>
            </View>
          </View>

          {/* Recent Issues Table */}
          <View style={styles.tableCard}>
            <Text style={styles.sectionTitle}>Recent Issues Reported</Text>
            <View style={styles.tableHeader}>
              <Text style={[styles.th, { flex: 1 }]}>Report ID</Text>
              <Text style={[styles.th, { flex: 2 }]}>Barangay</Text>
              <Text style={[styles.th, { flex: 2 }]}>Issue Type</Text>
              <Text style={[styles.th, { flex: 1.5 }]}>Status</Text>
            </View>
            
            {recentReports.length === 0 ? (
              <Text style={{ textAlign: 'center', marginTop: 20, color: '#6B7280' }}>No recent reports found.</Text>
            ) : (
              recentReports.map((row, i) => (
                <View key={i} style={styles.tableRow}>
                  <Text style={[styles.td, { flex: 1, fontWeight: '500' }]}>{row.id}</Text>
                  <Text style={[styles.td, { flex: 2 }]}>{row.barangay}</Text>
                  <Text style={[styles.td, { flex: 2 }]} numberOfLines={1}>{row.type}</Text>
                  <View style={[styles.td, { flex: 1.5 }]}>
                    <View style={[styles.badge, { backgroundColor: row.statusColor + '20' }]}>
                      <Text style={[styles.badgeText, { color: row.statusColor }]}>{row.status}</Text>
                    </View>
                  </View>
                </View>
              ))
            )}
            
            <TouchableOpacity style={styles.viewAllBtn} onPress={() => onTabChange?.('trash-reports')}>
              <Text style={styles.viewAllText}>View All Reports</Text>
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.rightColumn}>
          {/* Today's Schedule List */}
          <View style={styles.scheduleCard}>
            <View style={styles.scheduleHeaderRow}>
              <Text style={styles.sectionTitle}>Today's Schedule</Text>
              <TouchableOpacity>
                <Text style={styles.seeAllText}>See All</Text>
              </TouchableOpacity>
            </View>
            
            {todaySchedules.length === 0 ? (
              <Text style={{ textAlign: 'center', marginTop: 20, color: '#6B7280' }}>No schedules dispatched today.</Text>
            ) : (
              todaySchedules.map((item, i) => (
                <View key={item.id} style={styles.scheduleItem}>
                  <View style={[styles.timelineDot, { backgroundColor: item.color }]} />
                  <View style={styles.scheduleContent}>
                    <Text style={styles.scheduleTime}>{item.time}</Text>
                    <Text style={styles.scheduleBrgy}>{item.brgy}</Text>
                    <Text style={styles.scheduleTruck}>{item.truck}</Text>
                  </View>
                  <View style={[styles.statusBadge, { borderColor: item.color }]}>
                    <Text style={[styles.statusText, { color: item.color }]}>{item.status}</Text>
                  </View>
                </View>
              ))
            )}

            <TouchableOpacity style={styles.addScheduleBtn} onPress={() => onTabChange?.('collection-scheduler')}>
              <MaterialIcons name="add" size={20} color="#fff" />
              <Text style={styles.addScheduleBtnText}>Add New Schedule</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9FAFB',
    padding: 24,
  },
  greeting: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#111827',
  },
  dateText: {
    fontSize: 14,
    color: '#6B7280',
    marginTop: 4,
    marginBottom: 24,
  },
  topCardsRow: {
    flexDirection: 'row',
    gap: 16,
    marginBottom: 24,
  },
  card: {
    flex: 1,
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  cardIconWrapper: {
    width: 40,
    height: 40,
    borderRadius: 8,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  cardTitle: {
    fontSize: 14,
    color: '#6B7280',
    marginBottom: 8,
  },
  cardValue: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#111827',
    marginBottom: 8,
  },
  cardUnit: {
    fontSize: 16,
    fontWeight: 'normal',
    color: '#6B7280',
  },
  cardTrend: {
    fontSize: 12,
    color: '#2E8B57',
    fontWeight: '600',
  },
  cardTrendNeutral: {
    fontSize: 12,
    color: '#6B7280',
    fontWeight: '500',
  },
  cardTrendNegative: {
    fontSize: 12,
    color: '#ef4444',
    fontWeight: '600',
  },
  mainRow: {
    flexDirection: 'row',
    gap: 24,
    paddingBottom: 40,
  },
  leftColumn: {
    flex: 2,
    gap: 24,
  },
  rightColumn: {
    flex: 1,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#111827',
    marginBottom: 16,
  },
  progressCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  progressHeader: {
    flexDirection: 'row',
    alignItems: 'baseline',
    marginBottom: 20,
    gap: 8,
  },
  progressMainValue: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#111827',
  },
  progressSubValue: {
    fontSize: 14,
    color: '#6B7280',
  },
  barGroup: {
    marginBottom: 16,
  },
  barLabelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  barLabel: {
    fontSize: 14,
    color: '#374151',
    fontWeight: '500',
  },
  barValue: {
    fontSize: 14,
    color: '#6B7280',
    fontWeight: '600',
  },
  barBackground: {
    height: 8,
    backgroundColor: '#F3F4F6',
    borderRadius: 4,
    overflow: 'hidden',
  },
  barFill: {
    height: '100%',
    borderRadius: 4,
  },
  tableCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  tableHeader: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
    paddingBottom: 12,
    marginBottom: 12,
  },
  th: {
    fontSize: 12,
    fontWeight: '600',
    color: '#6B7280',
    textTransform: 'uppercase',
  },
  tableRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  td: {
    fontSize: 14,
    color: '#111827',
  },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    alignSelf: 'flex-start',
  },
  badgeText: {
    fontSize: 12,
    fontWeight: '600',
  },
  viewAllBtn: {
    marginTop: 16,
    alignItems: 'center',
    paddingVertical: 8,
  },
  viewAllText: {
    color: '#2E8B57',
    fontWeight: '600',
    fontSize: 14,
  },
  scheduleCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  scheduleHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  seeAllText: {
    color: '#2E8B57',
    fontSize: 14,
    fontWeight: '600',
  },
  scheduleItem: {
    flexDirection: 'row',
    marginBottom: 20,
    alignItems: 'flex-start',
  },
  timelineDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginTop: 4,
    marginRight: 12,
  },
  scheduleContent: {
    flex: 1,
  },
  scheduleTime: {
    fontSize: 12,
    color: '#6B7280',
    marginBottom: 4,
    fontWeight: '500',
  },
  scheduleBrgy: {
    fontSize: 15,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 2,
  },
  scheduleTruck: {
    fontSize: 13,
    color: '#6B7280',
  },
  statusBadge: {
    borderWidth: 1,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  statusText: {
    fontSize: 11,
    fontWeight: '600',
  },
  addScheduleBtn: {
    backgroundColor: '#2E8B57',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 8,
    marginTop: 8,
    gap: 8,
  },
  addScheduleBtnText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 14,
  },
});
