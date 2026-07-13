import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';

export default function CollectionSchedulerTab() {
  return (
    <ScrollView style={styles.container}>
      <Text style={styles.headerSubtitle}>RESOURCE MANAGEMENT</Text>
      <Text style={styles.headerTitle}>Barangay Collection Scheduler</Text>
      <Text style={styles.headerDesc}>
        Streamline waste collection workflows across city districts. Manage recurring routes, assign specialized vehicles, and monitor service status in real-time.
      </Text>

      {/* Header Actions */}
      <View style={styles.actionsContainer}>
        <View style={styles.filtersRow}>
          <View style={styles.dropdown}>
            <Text style={styles.dropdownText}>All Barangays</Text>
            <MaterialIcons name="keyboard-arrow-down" size={20} color="#6B7280" />
          </View>
          <View style={styles.dropdown}>
            <Text style={styles.dropdownText}>Any Day of the Week</Text>
            <MaterialIcons name="keyboard-arrow-down" size={20} color="#6B7280" />
          </View>
          
          <View style={styles.viewStyleGroup}>
            <Text style={styles.viewStyleLabel}>VIEW STYLE</Text>
            <View style={styles.viewToggleActive}><MaterialIcons name="view-list" size={18} color="#fff" /></View>
            <View style={styles.viewToggle}><MaterialIcons name="grid-view" size={18} color="#6B7280" /></View>
          </View>
        </View>

        <View style={styles.buttonsRow}>
          <TouchableOpacity style={styles.outlineBtn}>
            <MaterialIcons name="edit" size={18} color="#374151" />
            <Text style={styles.outlineBtnText}>Update Schedule</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.primaryBtn}>
            <MaterialIcons name="add" size={18} color="#fff" />
            <Text style={styles.primaryBtnText}>Add New Barangay</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Scheduler Table */}
      <View style={styles.card}>
        <View style={styles.tableHead}>
          <Text style={[styles.th, { flex: 2.5 }]}>BARANGAY NAME</Text>
          <Text style={[styles.th, { flex: 2 }]}>COLLECTION DAYS</Text>
          <Text style={[styles.th, { flex: 2 }]}>ASSIGNED TRUCK</Text>
          <Text style={[styles.th, { flex: 1.5 }]}>STATUS</Text>
          <Text style={[styles.th, { flex: 0.5, textAlign: 'center' }]}>ACTIONS</Text>
        </View>

        {[
          { initials: 'SJ', name: 'San Jose District', desc: 'South Sector • Zone 4', days: ['MON', 'WED', 'FRI'], truck: 'Truck #402', truckDesc: '(Heavy)', status: 'BIODEGRADABLE', statusColor: '#2E8B57' },
          { initials: 'SL', name: 'Santa Lucia', desc: 'East Sector • Zone 1', days: ['TUE', 'THU', 'SAT'], truck: 'Truck #118', truckDesc: '(Compact)', status: 'BIODEGRADABLE', statusColor: '#2E8B57' },
          { initials: 'PO', name: 'Poblacion Central', desc: 'Central Hub • All Zones', days: ['DAILY SERVICE'], truck: 'Truck #505', truckDesc: '(Heavy)', status: 'HAZARDOUS', statusColor: '#ef4444' },
          { initials: 'SN', name: 'Santo Nino', desc: 'North Sector • Zone 2', days: ['MON', 'THU'], truck: 'Truck #210', truckDesc: '(Compact)', status: 'NON-BIODEGRADABLE', statusColor: '#6B7280' },
        ].map((row, i) => (
          <View key={i} style={styles.tableRow}>
            <View style={[styles.td, { flex: 2.5, flexDirection: 'row', alignItems: 'center', gap: 12 }]}>
              <View style={styles.avatarBadge}>
                <Text style={styles.avatarText}>{row.initials}</Text>
              </View>
              <View>
                <Text style={styles.brgyName}>{row.name}</Text>
                <Text style={styles.brgyDesc}>{row.desc}</Text>
              </View>
            </View>

            <View style={[styles.td, { flex: 2, flexDirection: 'row', gap: 4, flexWrap: 'wrap' }]}>
              {row.days.map((day, dIdx) => (
                <View key={dIdx} style={[styles.dayBadge, day === 'DAILY SERVICE' && { backgroundColor: '#2E8B57' }]}>
                  <Text style={[styles.dayText, day === 'DAILY SERVICE' && { color: '#fff' }]}>{day}</Text>
                </View>
              ))}
            </View>

            <View style={[styles.td, { flex: 2, flexDirection: 'row', alignItems: 'center', gap: 8 }]}>
              <MaterialIcons name="local-shipping" size={16} color="#6B7280" />
              <View>
                <Text style={styles.truckName}>{row.truck}</Text>
                <Text style={styles.truckDesc}>{row.truckDesc}</Text>
              </View>
            </View>

            <View style={[styles.td, { flex: 1.5 }]}>
              <View style={[styles.statusBadge, { backgroundColor: row.statusColor + '20' }]}>
                <Text style={[styles.statusText, { color: row.statusColor }]}>{row.status}</Text>
              </View>
            </View>

            <View style={[styles.td, { flex: 0.5, alignItems: 'center' }]}>
              <TouchableOpacity>
                <MaterialIcons name="more-vert" size={20} color="#6B7280" />
              </TouchableOpacity>
            </View>
          </View>
        ))}

        <View style={styles.pagination}>
          <Text style={styles.pageInfo}>Showing 1-4 of 32 Barangays</Text>
          <View style={styles.pageControls}>
            <TouchableOpacity><MaterialIcons name="chevron-left" size={20} color="#D1D5DB" /></TouchableOpacity>
            <Text style={[styles.pageNum, styles.pageNumActive]}>1</Text>
            <Text style={styles.pageNum}>2</Text>
            <Text style={styles.pageNum}>3</Text>
            <TouchableOpacity><MaterialIcons name="chevron-right" size={20} color="#374151" /></TouchableOpacity>
          </View>
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F9FAFB', padding: 32 },
  headerSubtitle: { fontSize: 12, fontWeight: '700', color: '#2E8B57', letterSpacing: 1, marginBottom: 8, textTransform: 'uppercase' },
  headerTitle: { fontSize: 28, fontWeight: 'bold', color: '#111827', marginBottom: 12 },
  headerDesc: { fontSize: 14, color: '#4B5563', lineHeight: 22, maxWidth: 600, marginBottom: 32 },

  actionsContainer: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 24, zIndex: 10 },
  filtersRow: { flexDirection: 'row', gap: 16, alignItems: 'center' },
  dropdown: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#fff', padding: 12, borderRadius: 8, borderWidth: 1, borderColor: '#E5E7EB', width: 200 },
  dropdownText: { fontSize: 14, color: '#374151', fontWeight: '500' },
  
  viewStyleGroup: { flexDirection: 'row', alignItems: 'center', gap: 8, marginLeft: 16 },
  viewStyleLabel: { fontSize: 10, fontWeight: '700', color: '#6B7280', letterSpacing: 0.5 },
  viewToggleActive: { backgroundColor: '#2E8B57', padding: 8, borderRadius: 6 },
  viewToggle: { backgroundColor: '#F3F4F6', padding: 8, borderRadius: 6 },

  buttonsRow: { flexDirection: 'row', gap: 16 },
  outlineBtn: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 12, paddingHorizontal: 20, borderRadius: 8, borderWidth: 1, borderColor: '#D1D5DB', backgroundColor: '#fff' },
  outlineBtnText: { color: '#374151', fontWeight: '600', fontSize: 14 },
  primaryBtn: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 12, paddingHorizontal: 20, borderRadius: 8, backgroundColor: '#4b6354' },
  primaryBtnText: { color: '#fff', fontWeight: '600', fontSize: 14 },

  card: { backgroundColor: '#fff', borderRadius: 12, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 2, elevation: 2, padding: 24 },
  tableHead: { flexDirection: 'row', backgroundColor: '#F9FAFB', paddingVertical: 12, paddingHorizontal: 16, borderRadius: 8, marginBottom: 8 },
  th: { fontSize: 11, fontWeight: '700', color: '#6B7280', letterSpacing: 0.5 },
  tableRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 20, paddingHorizontal: 16, borderBottomWidth: 1, borderBottomColor: '#F3F4F6' },
  td: { justifyContent: 'center' },
  
  avatarBadge: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#F3F4F6', alignItems: 'center', justifyContent: 'center' },
  avatarText: { fontSize: 14, fontWeight: 'bold', color: '#4B5563' },
  brgyName: { fontWeight: '700', color: '#111827', fontSize: 15, marginBottom: 2 },
  brgyDesc: { fontSize: 12, color: '#6B7280' },

  dayBadge: { backgroundColor: '#dcfce7', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 4 },
  dayText: { fontSize: 10, fontWeight: '700', color: '#166534' },

  truckName: { fontWeight: '600', color: '#374151', fontSize: 14 },
  truckDesc: { fontSize: 12, color: '#6B7280' },

  statusBadge: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 12, alignSelf: 'flex-start' },
  statusText: { fontSize: 10, fontWeight: 'bold', letterSpacing: 0.5 },

  pagination: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 24, paddingTop: 16 },
  pageInfo: { fontSize: 13, color: '#6B7280' },
  pageControls: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  pageNum: { fontSize: 14, fontWeight: '500', color: '#6B7280' },
  pageNumActive: { color: '#111827', fontWeight: 'bold' },
});
