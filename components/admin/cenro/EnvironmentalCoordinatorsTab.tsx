import React from 'react';
import { View, Text, StyleSheet, ScrollView, TextInput, TouchableOpacity } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';

export default function EnvironmentalCoordinatorsTab() {
  return (
    <ScrollView style={styles.container}>
      <View style={styles.headerRow}>
        <View>
          <Text style={styles.headerTitle}>Environmental Coordinators</Text>
          <Text style={styles.headerDesc}>Manage field leads across urban barangays.</Text>
        </View>
        <View style={styles.headerActions}>
          <TouchableOpacity style={styles.outlineBtn}>
            <MaterialIcons name="file-download" size={18} color="#374151" />
            <Text style={styles.outlineBtnText}>Export</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.primaryBtn}>
            <MaterialIcons name="person-add" size={18} color="#fff" />
            <Text style={styles.primaryBtnText}>Add Coordinator</Text>
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.card}>
        {/* Filters Row */}
        <View style={styles.filtersRow}>
          <View style={styles.searchBox}>
            <MaterialIcons name="search" size={20} color="#9CA3AF" />
            <TextInput style={styles.searchInput} placeholder="Search by name, ID..." placeholderTextColor="#9CA3AF" />
          </View>
          
          <View style={styles.dropdownsContainer}>
            <View style={styles.dropdown}>
              <Text style={styles.dropdownText}>All Barangays</Text>
              <MaterialIcons name="keyboard-arrow-down" size={20} color="#6B7280" />
            </View>
            <View style={styles.dropdown}>
              <Text style={styles.dropdownText}>Status: All</Text>
              <MaterialIcons name="keyboard-arrow-down" size={20} color="#6B7280" />
            </View>
            <TouchableOpacity style={styles.iconBtn}>
              <MaterialIcons name="filter-list" size={20} color="#6B7280" />
            </TouchableOpacity>
          </View>
        </View>

        {/* Table */}
        <View style={styles.tableHead}>
          <Text style={[styles.th, { flex: 2 }]}>COORDINATOR</Text>
          <Text style={[styles.th, { flex: 1.5 }]}>BARANGAY</Text>
          <Text style={[styles.th, { flex: 1.5 }]}>CONTACT</Text>
          <Text style={[styles.th, { flex: 1 }]}>STATUS</Text>
          <Text style={[styles.th, { flex: 0.5, textAlign: 'center' }]}>ACTIONS</Text>
        </View>

        {[
          { name: 'Arnel Bautista', id: 'ID: CENRO-800', brgy: 'San Jose', zone: 'Zone 4', contact: '+63 917 555 0123', status: 'CERTIFIED', statusColor: '#2E8B57', statusBg: '#F6FBF7' },
          { name: 'Maria Elena Cruz', id: 'ID: CENRO-132', brgy: 'Maligaya', zone: 'Central', contact: '+63 918 222 9876', status: 'PENDING', statusColor: '#ef4444', statusBg: '#FEF2F2' },
          { name: 'Ricardo Pineda', id: 'ID: CENRO-441', brgy: 'Sto. Nino', zone: 'North', contact: '+63 920 444 5566', status: 'CERTIFIED', statusColor: '#2E8B57', statusBg: '#F6FBF7' },
          { name: 'Ricardo Pineda', id: 'ID: CENRO-441', brgy: 'Sto. Nino', zone: 'North', contact: '+63 920 444 5566', status: 'CERTIFIED', statusColor: '#2E8B57', statusBg: '#F6FBF7' },
          { name: 'Arnel Bautista', id: 'ID: CENRO-800', brgy: 'San Jose', zone: 'Zone 4', contact: '+63 917 555 0123', status: 'CERTIFIED', statusColor: '#2E8B57', statusBg: '#F6FBF7' },
          { name: 'Maria Elena Cruz', id: 'ID: CENRO-132', brgy: 'Maligaya', zone: 'Central', contact: '+63 918 222 9876', status: 'PENDING', statusColor: '#ef4444', statusBg: '#FEF2F2' },
          { name: 'Ricardo Pineda', id: 'ID: CENRO-441', brgy: 'Sto. Nino', zone: 'North', contact: '+63 920 444 5566', status: 'CERTIFIED', statusColor: '#2E8B57', statusBg: '#F6FBF7' },
        ].map((row, i) => (
          <View key={i} style={styles.tableRow}>
            <View style={[styles.td, { flex: 2, flexDirection: 'row', alignItems: 'center', gap: 12 }]}>
              <View style={styles.avatarPlaceholder}>
                <MaterialIcons name="person" size={20} color="#9CA3AF" />
              </View>
              <View>
                <Text style={styles.coordName}>{row.name}</Text>
                <Text style={styles.coordId}>{row.id}</Text>
              </View>
            </View>
            <View style={[styles.td, { flex: 1.5 }]}>
              <Text style={styles.brgyName}>{row.brgy}</Text>
              <Text style={styles.brgyZone}>{row.zone}</Text>
            </View>
            <Text style={[styles.td, { flex: 1.5, color: '#4B5563', fontSize: 13 }]}>{row.contact}</Text>
            <View style={[styles.td, { flex: 1 }]}>
              <View style={[styles.statusBadge, { borderColor: row.statusColor, backgroundColor: row.statusBg }]}>
                <Text style={[styles.statusText, { color: row.statusColor }]}>{row.status}</Text>
              </View>
            </View>
            <View style={[styles.td, { flex: 0.5, alignItems: 'center' }]}>
              <TouchableOpacity>
                <MaterialIcons name="more-vert" size={20} color="#9CA3AF" />
              </TouchableOpacity>
            </View>
          </View>
        ))}

        <View style={styles.pagination}>
          <Text style={styles.pageInfo}>Showing 1-10 of 42 coordinators</Text>
          <View style={styles.pageControls}>
            <TouchableOpacity style={styles.pageBtnActive}><Text style={styles.pageTextActive}>1</Text></TouchableOpacity>
            <TouchableOpacity style={styles.pageBtn}><Text style={styles.pageText}>2</Text></TouchableOpacity>
            <TouchableOpacity style={styles.pageBtn}><Text style={styles.pageText}>3</Text></TouchableOpacity>
            <TouchableOpacity style={styles.pageBtn}><MaterialIcons name="chevron-right" size={20} color="#6B7280" /></TouchableOpacity>
          </View>
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F9FAFB', padding: 32 },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 32 },
  headerTitle: { fontSize: 28, fontWeight: 'bold', color: '#111827', marginBottom: 8 },
  headerDesc: { fontSize: 14, color: '#4B5563' },
  headerActions: { flexDirection: 'row', gap: 16 },
  outlineBtn: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 10, paddingHorizontal: 16, borderRadius: 8, borderWidth: 1, borderColor: '#D1D5DB', backgroundColor: '#fff' },
  outlineBtnText: { color: '#374151', fontWeight: '600', fontSize: 14 },
  primaryBtn: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 10, paddingHorizontal: 16, borderRadius: 8, backgroundColor: '#4b6354' },
  primaryBtnText: { color: '#fff', fontWeight: '600', fontSize: 14 },

  card: { backgroundColor: '#fff', borderRadius: 12, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 2, elevation: 2, padding: 24 },
  filtersRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 },
  searchBox: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#F9FAFB', borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 8, paddingHorizontal: 12, width: 300 },
  searchInput: { flex: 1, paddingVertical: 10, paddingHorizontal: 8, fontSize: 14, color: '#111827' },
  dropdownsContainer: { flexDirection: 'row', gap: 12, alignItems: 'center' },
  dropdown: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#fff', paddingVertical: 10, paddingHorizontal: 16, borderRadius: 8, borderWidth: 1, borderColor: '#E5E7EB', minWidth: 160 },
  dropdownText: { fontSize: 13, color: '#374151', fontWeight: '500' },
  iconBtn: { padding: 10, borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 8, backgroundColor: '#fff' },

  tableHead: { flexDirection: 'row', paddingVertical: 12, paddingHorizontal: 16, borderBottomWidth: 1, borderBottomColor: '#E5E7EB', marginBottom: 8 },
  th: { fontSize: 11, fontWeight: '700', color: '#6B7280', letterSpacing: 0.5 },
  tableRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 16, paddingHorizontal: 16, borderBottomWidth: 1, borderBottomColor: '#F3F4F6' },
  td: { justifyContent: 'center' },
  
  avatarPlaceholder: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#F3F4F6', alignItems: 'center', justifyContent: 'center' },
  coordName: { fontWeight: '600', color: '#111827', fontSize: 14, marginBottom: 2 },
  coordId: { fontSize: 11, color: '#6B7280' },
  brgyName: { fontWeight: '500', color: '#374151', fontSize: 14, marginBottom: 2 },
  brgyZone: { fontSize: 12, color: '#6B7280' },

  statusBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12, borderWidth: 1, alignSelf: 'flex-start' },
  statusText: { fontSize: 10, fontWeight: 'bold', letterSpacing: 0.5 },

  pagination: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 24, paddingTop: 16 },
  pageInfo: { fontSize: 13, color: '#6B7280' },
  pageControls: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  pageBtn: { width: 32, height: 32, alignItems: 'center', justifyContent: 'center', borderRadius: 4 },
  pageBtnActive: { width: 32, height: 32, alignItems: 'center', justifyContent: 'center', borderRadius: 4, backgroundColor: '#2E8B57' },
  pageText: { fontSize: 14, color: '#6B7280', fontWeight: '500' },
  pageTextActive: { fontSize: 14, color: '#fff', fontWeight: 'bold' },
});
