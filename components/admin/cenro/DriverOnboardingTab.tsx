import React from 'react';
import { View, Text, StyleSheet, ScrollView, TextInput, TouchableOpacity } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';

export default function DriverOnboardingTab() {
  return (
    <ScrollView style={styles.container}>
      <Text style={styles.headerSubtitle}>ADMINISTRATIVE MANAGEMENT</Text>
      <Text style={styles.headerTitle}>Driver Onboarding & Vehicle Assignment</Text>

      {/* Driver Registration Card */}
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <View style={styles.cardTitleRow}>
            <MaterialIcons name="person-add" size={20} color="#2E8B57" style={styles.cardIcon} />
            <Text style={styles.cardTitle}>Driver Registration</Text>
          </View>
          <View style={styles.badge}>
            <Text style={styles.badgeText}>NEW ENTRY</Text>
          </View>
        </View>

        <View style={styles.formGrid}>
          <View style={styles.formGroup}>
            <Text style={styles.label}>FULL NAME</Text>
            <TextInput style={styles.input} placeholder="e.g. Juan De La Cruz" placeholderTextColor="#9CA3AF" />
          </View>
          <View style={styles.formGroup}>
            <Text style={styles.label}>EMPLOYEE ID</Text>
            <TextInput style={styles.input} placeholder="CENRO-2024-XXXX" placeholderTextColor="#9CA3AF" />
          </View>
          <View style={styles.formGroup}>
            <Text style={styles.label}>LICENSE NUMBER</Text>
            <TextInput style={styles.input} placeholder="N01-XX-XXXXXX" placeholderTextColor="#9CA3AF" />
          </View>
          <View style={styles.formGroup}>
            <Text style={styles.label}>CONTACT INFORMATION</Text>
            <TextInput style={styles.input} placeholder="+63 9XX XXX XXXX" placeholderTextColor="#9CA3AF" />
          </View>
        </View>
      </View>

      {/* Vehicle Assignment Card */}
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <View style={styles.cardTitleRow}>
            <MaterialIcons name="local-shipping" size={20} color="#2E8B57" style={styles.cardIcon} />
            <Text style={styles.cardTitle}>Vehicle Assignment</Text>
          </View>
        </View>

        <View style={styles.assignmentRow}>
          <View style={styles.assignmentSelect}>
            <Text style={styles.subtext}>Select an active unit from the municipal fleet to assign to this driver's permanent route.</Text>
            <View style={styles.dropdown}>
              <Text style={styles.dropdownText}>Select Available Truck</Text>
              <MaterialIcons name="keyboard-arrow-down" size={20} color="#6B7280" />
            </View>
          </View>

          <View style={styles.infoBox}>
            <MaterialIcons name="info-outline" size={20} color="#2E8B57" style={styles.infoIcon} />
            <View style={{ flex: 1 }}>
              <Text style={styles.infoTitle}>Route Optimization</Text>
              <Text style={styles.infoText}>Assigning a truck automatically links the driver to the pre-designated AI-optimized route for that vehicle.</Text>
            </View>
          </View>
        </View>
      </View>

      {/* Action Buttons */}
      <View style={styles.actionsRow}>
        <TouchableOpacity style={styles.outlineBtn}>
          <Text style={styles.outlineBtnText}>Save Draft</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.primaryBtn}>
          <MaterialIcons name="person-add" size={18} color="#fff" />
          <Text style={styles.primaryBtnText}>Complete Onboarding</Text>
        </TouchableOpacity>
      </View>

      {/* Recent Assignments Table */}
      <View style={styles.card}>
        <View style={[styles.cardHeader, { borderBottomWidth: 0, paddingBottom: 0 }]}>
          <Text style={styles.cardTitle}>Recent Assignments</Text>
          <View style={styles.tableActions}>
            <TouchableOpacity style={styles.iconBtn}><MaterialIcons name="filter-list" size={18} color="#6B7280" /></TouchableOpacity>
            <TouchableOpacity style={styles.iconBtn}><MaterialIcons name="search" size={18} color="#6B7280" /></TouchableOpacity>
          </View>
        </View>

        <View style={styles.table}>
          <View style={styles.tableHead}>
            <Text style={[styles.th, { flex: 2 }]}>DRIVER NAME</Text>
            <Text style={[styles.th, { flex: 2 }]}>EMPLOYEE ID</Text>
            <Text style={[styles.th, { flex: 1.5 }]}>ASSIGNED TRUCK</Text>
            <Text style={[styles.th, { flex: 1 }]}>ASSIGNMENT DATE</Text>
          </View>
          
          {[
            { initials: 'RM', name: 'Ricardo Mendoza', id: 'CENRO-2024-0891', truck: 'TRUCK #402', date: 'Oct 24, 2023', color: '#86efac' },
            { initials: 'SL', name: 'Sarah Lim', id: 'CENRO-2024-1123', truck: 'TRUCK #118', date: 'Oct 23, 2023', color: '#a7f3d0' },
            { initials: 'AB', name: 'Antonio Blanco', id: 'CENRO-2024-0045', truck: 'TRUCK #221', date: 'Oct 22, 2023', color: '#dcfce7' },
          ].map((row, i) => (
            <View key={i} style={styles.tableRow}>
              <View style={[styles.td, { flex: 2, flexDirection: 'row', alignItems: 'center', gap: 12 }]}>
                <View style={[styles.avatarBadge, { backgroundColor: row.color }]}>
                  <Text style={styles.avatarText}>{row.initials}</Text>
                </View>
                <Text style={styles.driverName}>{row.name}</Text>
              </View>
              <Text style={[styles.td, { flex: 2, color: '#4B5563' }]}>{row.id}</Text>
              <View style={[styles.td, { flex: 1.5 }]}>
                <View style={styles.truckBadge}>
                  <Text style={styles.truckBadgeText}>{row.truck}</Text>
                </View>
              </View>
              <Text style={[styles.td, { flex: 1, color: '#6B7280' }]}>{row.date}</Text>
            </View>
          ))}
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F9FAFB', padding: 32 },
  headerSubtitle: { fontSize: 12, fontWeight: '700', color: '#6B7280', letterSpacing: 1, marginBottom: 8, textTransform: 'uppercase' },
  headerTitle: { fontSize: 28, fontWeight: 'bold', color: '#111827', marginBottom: 32 },
  
  card: { backgroundColor: '#fff', borderRadius: 12, padding: 24, marginBottom: 24, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 2, elevation: 2 },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 },
  cardTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  cardIcon: { marginRight: 4 },
  cardTitle: { fontSize: 18, fontWeight: 'bold', color: '#111827' },
  badge: { backgroundColor: '#dcfce7', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 },
  badgeText: { color: '#166534', fontSize: 10, fontWeight: 'bold', letterSpacing: 0.5 },
  
  formGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 24 },
  formGroup: { width: '48%' },
  label: { fontSize: 11, fontWeight: '700', color: '#374151', marginBottom: 8, letterSpacing: 0.5 },
  input: { backgroundColor: '#F3F4F6', borderRadius: 8, padding: 14, fontSize: 14, color: '#111827', borderWidth: 1, borderColor: '#E5E7EB' },
  
  assignmentRow: { flexDirection: 'row', gap: 24 },
  assignmentSelect: { flex: 1, justifyContent: 'center' },
  subtext: { fontSize: 13, color: '#6B7280', marginBottom: 12, lineHeight: 20 },
  dropdown: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#F3F4F6', padding: 14, borderRadius: 8, borderWidth: 1, borderColor: '#E5E7EB' },
  dropdownText: { fontSize: 14, color: '#111827' },
  
  infoBox: { flex: 1, flexDirection: 'row', backgroundColor: '#F6FBF7', padding: 20, borderRadius: 8, borderWidth: 1, borderColor: '#dcfce7', gap: 12 },
  infoIcon: { marginTop: 2 },
  infoTitle: { fontSize: 14, fontWeight: '600', color: '#111827', marginBottom: 4 },
  infoText: { fontSize: 12, color: '#4B5563', lineHeight: 18 },
  
  actionsRow: { flexDirection: 'row', justifyContent: 'flex-end', gap: 16, marginBottom: 32 },
  outlineBtn: { paddingVertical: 12, paddingHorizontal: 24, borderRadius: 8, borderWidth: 1, borderColor: '#E5E7EB', backgroundColor: '#fff' },
  outlineBtnText: { color: '#374151', fontWeight: '600', fontSize: 14 },
  primaryBtn: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 12, paddingHorizontal: 24, borderRadius: 8, backgroundColor: '#2E8B57' },
  primaryBtnText: { color: '#fff', fontWeight: '600', fontSize: 14 },

  tableActions: { flexDirection: 'row', gap: 8 },
  iconBtn: { padding: 8, backgroundColor: '#F3F4F6', borderRadius: 6 },
  
  table: { marginTop: 24 },
  tableHead: { flexDirection: 'row', backgroundColor: '#F9FAFB', paddingVertical: 12, paddingHorizontal: 16, borderRadius: 8, marginBottom: 8 },
  th: { fontSize: 11, fontWeight: '700', color: '#6B7280', letterSpacing: 0.5 },
  tableRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 16, paddingHorizontal: 16, borderBottomWidth: 1, borderBottomColor: '#F3F4F6' },
  td: { fontSize: 14 },
  avatarBadge: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  avatarText: { fontSize: 12, fontWeight: 'bold', color: '#064e3b' },
  driverName: { fontWeight: '600', color: '#111827' },
  truckBadge: { backgroundColor: '#F3F4F6', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 4, alignSelf: 'flex-start' },
  truckBadgeText: { fontSize: 11, fontWeight: '700', color: '#374151' },
});
