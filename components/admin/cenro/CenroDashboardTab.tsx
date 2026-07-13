import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';

export default function CenroDashboardTab() {
  return (
    <ScrollView style={styles.container}>
      <Text style={styles.greeting}>Good morning, Administrator</Text>
      <Text style={styles.dateText}>Tuesday, 24 Oct 2026</Text>

      <View style={styles.topCardsRow}>
        <View style={styles.card}>
          <View style={styles.cardIconWrapper}>
            <MaterialIcons name="delete-outline" size={24} color="#2E8B57" />
          </View>
          <Text style={styles.cardTitle}>Total Waste Collected</Text>
          <Text style={styles.cardValue}>42.5 <Text style={styles.cardUnit}>tons</Text></Text>
          <Text style={styles.cardTrend}>↑ 12% vs last week</Text>
        </View>

        <View style={styles.card}>
          <View style={styles.cardIconWrapper}>
            <MaterialIcons name="local-shipping" size={24} color="#2E8B57" />
          </View>
          <Text style={styles.cardTitle}>Active Trucks</Text>
          <Text style={styles.cardValue}>10/12 <Text style={styles.cardUnit}>trucks</Text></Text>
          <Text style={styles.cardTrendNeutral}>2 under maintenance</Text>
        </View>

        <View style={styles.card}>
          <View style={styles.cardIconWrapper}>
            <MaterialIcons name="report-problem" size={24} color="#ef4444" />
          </View>
          <Text style={styles.cardTitle}>Pending Issues</Text>
          <Text style={styles.cardValue}>5 <Text style={styles.cardUnit}>active</Text></Text>
          <Text style={styles.cardTrendNegative}>↑ 2 from yesterday</Text>
        </View>
      </View>

      <View style={styles.mainRow}>
        <View style={styles.leftColumn}>
          {/* Progress Section */}
          <View style={styles.progressCard}>
            <Text style={styles.sectionTitle}>Daily Schedule Progress</Text>
            <View style={styles.progressHeader}>
              <Text style={styles.progressMainValue}>75%</Text>
              <Text style={styles.progressSubValue}>Overall Completion</Text>
            </View>
            
            <View style={styles.barGroup}>
              <View style={styles.barLabelRow}>
                <Text style={styles.barLabel}>Biodegradable</Text>
                <Text style={styles.barValue}>80%</Text>
              </View>
              <View style={styles.barBackground}>
                <View style={[styles.barFill, { width: '80%', backgroundColor: '#2E8B57' }]} />
              </View>
            </View>

            <View style={styles.barGroup}>
              <View style={styles.barLabelRow}>
                <Text style={styles.barLabel}>Non-biodegradable</Text>
                <Text style={styles.barValue}>65%</Text>
              </View>
              <View style={styles.barBackground}>
                <View style={[styles.barFill, { width: '65%', backgroundColor: '#f59e0b' }]} />
              </View>
            </View>

            <View style={styles.barGroup}>
              <View style={styles.barLabelRow}>
                <Text style={styles.barLabel}>Recyclable</Text>
                <Text style={styles.barValue}>90%</Text>
              </View>
              <View style={styles.barBackground}>
                <View style={[styles.barFill, { width: '90%', backgroundColor: '#3b82f6' }]} />
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
            
            {[
              { id: 'REP-001', brgy: 'Sambag 1', type: 'Delayed Pickup', status: 'Pending', statusColor: '#ef4444' },
              { id: 'REP-002', brgy: 'Guadalupe', type: 'Vehicle Breakdown', status: 'In Progress', statusColor: '#f59e0b' },
              { id: 'REP-003', brgy: 'Lahug', type: 'Missed Collection', status: 'Resolved', statusColor: '#2E8B57' },
              { id: 'REP-004', brgy: 'Talamban', type: 'Illegal Dumping', status: 'Pending', statusColor: '#ef4444' },
            ].map((row, i) => (
              <View key={i} style={styles.tableRow}>
                <Text style={[styles.td, { flex: 1, fontWeight: '500' }]}>{row.id}</Text>
                <Text style={[styles.td, { flex: 2 }]}>{row.brgy}</Text>
                <Text style={[styles.td, { flex: 2 }]}>{row.type}</Text>
                <View style={[styles.td, { flex: 1.5 }]}>
                  <View style={[styles.badge, { backgroundColor: row.statusColor + '20' }]}>
                    <Text style={[styles.badgeText, { color: row.statusColor }]}>{row.status}</Text>
                  </View>
                </View>
              </View>
            ))}
            
            <TouchableOpacity style={styles.viewAllBtn}>
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
            
            {[
              { time: '08:00 AM', brgy: 'Guadalupe', truck: 'Truck A (TKA-123)', status: 'Completed', color: '#2E8B57' },
              { time: '10:30 AM', brgy: 'Lahug', truck: 'Truck B (TKB-456)', status: 'In Progress', color: '#f59e0b' },
              { time: '01:00 PM', brgy: 'Talamban', truck: 'Truck C (TKC-789)', status: 'Pending', color: '#6b7280' },
              { time: '03:30 PM', brgy: 'Mabolo', truck: 'Truck D (TKD-012)', status: 'Pending', color: '#6b7280' },
              { time: '05:00 PM', brgy: 'Tisa', truck: 'Truck E (TKE-345)', status: 'Pending', color: '#6b7280' },
            ].map((item, i) => (
              <View key={i} style={styles.scheduleItem}>
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
            ))}

            <TouchableOpacity style={styles.addScheduleBtn}>
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
