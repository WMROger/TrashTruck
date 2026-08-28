import { MaterialIcons } from '@expo/vector-icons';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { CictoOversightSnapshot, getCictoOversightSnapshot } from '@/services/cictoOversightService';

export default function CictoDashboardTab() {
  const [data, setData] = useState<CictoOversightSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const load = async () => {
    setLoading(true); setError('');
    try { setData(await getCictoOversightSnapshot()); }
    catch (loadError) { setError(loadError instanceof Error ? loadError.message : 'Oversight data could not be loaded.'); }
    finally { setLoading(false); }
  };
  useEffect(() => { load(); }, []);
  if (loading && !data) return <View style={styles.center}><ActivityIndicator size="large" color="#0D9488" /><Text style={styles.muted}>Loading system oversight…</Text></View>;

  const cards = [
    ['REGISTERED USERS', data?.counts.users || 0, 'people', '#0D9488'],
    ['OPEN REPORTS', data?.operations.pendingReports || 0, 'assignment-late', '#D97706'],
    ['ACTIVE FLEET', data?.operations.activeFleet || 0, 'local-shipping', '#059669'],
    ['SYSTEM ERRORS', data?.counts.errorEvents || 0, 'error-outline', '#DC2626'],
  ] as const;
  return <ScrollView style={styles.container} contentContainerStyle={styles.content}>
    <View style={styles.header}><View><Text style={styles.eyebrow}>CICTO / EXECUTIVE OVERSIGHT</Text><Text style={styles.title}>System Governance</Text><Text style={styles.sub}>Real-time system telemetry, active user governance, and infrastructure status.</Text></View><TouchableOpacity style={styles.refresh} onPress={load}><MaterialIcons name="refresh" size={18} color="#374151" /><Text style={styles.refreshText}>Refresh telemetry</Text></TouchableOpacity></View>
    {!!error && <Text style={styles.error}>{error}</Text>}
    <View style={styles.cards}>{cards.map(([title, value, icon, color]) => <View key={title} style={styles.card}><View style={styles.cardTop}><Text style={styles.cardTitle}>{title}</Text><MaterialIcons name={icon as any} size={20} color={color} /></View><Text style={[styles.cardValue, { color }]}>{value}</Text></View>)}</View>
    <View style={styles.section}><Text style={styles.sectionTitle}>Operational Integrity</Text><View style={styles.integrityGrid}>
      <View style={styles.integrityItem}><Text style={styles.integrityValue}>{data?.dataQuality.reportsMissingGps || 0}</Text><Text style={styles.integrityLabel}>Reports Missing GPS Coordinates</Text></View>
      <View style={styles.integrityItem}><Text style={styles.integrityValue}>{data?.dataQuality.completedSchedulesMissingMeasurement || 0}</Text><Text style={styles.integrityLabel}>Unmeasured Completed Pickups</Text></View>
      <View style={styles.integrityItem}><Text style={styles.integrityValue}>{data?.counts.auditEvents || 0}</Text><Text style={styles.integrityLabel}>Immutable Audit Log Events</Text></View>
    </View></View>
  </ScrollView>;
}
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8FAFC' },
  content: { padding: 28 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#F8FAFC' },
  muted: { color: '#64748B', marginTop: 10, fontSize: 13 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24 },
  eyebrow: { fontSize: 10, fontWeight: '900', color: '#0D9488', letterSpacing: 1.1 },
  title: { fontSize: 26, fontWeight: '900', color: '#0F172A', marginTop: 4 },
  sub: { fontSize: 12, color: '#64748B', marginTop: 4 },
  refresh: { flexDirection: 'row', alignItems: 'center', gap: 6, borderWidth: 1, borderColor: '#CBD5E1', backgroundColor: '#FFF', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 8 },
  refreshText: { fontSize: 11, fontWeight: '800', color: '#374151' },
  error: { color: '#B91C1C', backgroundColor: '#FEF2F2', padding: 12, borderRadius: 8, marginBottom: 16 },
  cards: { flexDirection: 'row', flexWrap: 'wrap', gap: 14, marginBottom: 24 },
  card: { flex: 1, minWidth: 200, backgroundColor: '#FFF', borderWidth: 1, borderColor: '#E2E8F0', borderRadius: 12, padding: 18 },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  cardTitle: { fontSize: 9.5, fontWeight: '900', color: '#64748B', letterSpacing: 0.8 },
  cardValue: { fontSize: 28, fontWeight: '900' },
  section: { backgroundColor: '#FFF', borderWidth: 1, borderColor: '#E2E8F0', borderRadius: 12, padding: 20 },
  sectionTitle: { fontSize: 14, fontWeight: '900', color: '#0F172A', marginBottom: 16 },
  integrityGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 16 },
  integrityItem: { flex: 1, minWidth: 160, backgroundColor: '#F8FAFC', borderRadius: 10, padding: 14 },
  integrityValue: { fontSize: 22, fontWeight: '900', color: '#0F172A' },
  integrityLabel: { fontSize: 11, color: '#64748B', marginTop: 4, fontWeight: '600' },
});
