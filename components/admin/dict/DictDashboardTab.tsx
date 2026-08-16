import { MaterialIcons } from '@expo/vector-icons';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { DictOversightSnapshot, getDictOversightSnapshot } from '@/services/dictOversightService';

export default function DictDashboardTab() {
  const [data, setData] = useState<DictOversightSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const load = async () => {
    setLoading(true); setError('');
    try { setData(await getDictOversightSnapshot()); }
    catch (loadError) { setError(loadError instanceof Error ? loadError.message : 'Oversight data could not be loaded.'); }
    finally { setLoading(false); }
  };
  useEffect(() => { load(); }, []);
  if (loading && !data) return <View style={styles.center}><ActivityIndicator size="large" color="#4F46E5" /><Text style={styles.muted}>Loading system oversight…</Text></View>;

  const cards = [
    ['REGISTERED USERS', data?.counts.users || 0, 'people', '#4F46E5'],
    ['OPEN REPORTS', data?.operations.pendingReports || 0, 'assignment-late', '#D97706'],
    ['ACTIVE FLEET', data?.operations.activeFleet || 0, 'local-shipping', '#059669'],
    ['SYSTEM ERRORS', data?.counts.errorEvents || 0, 'error-outline', '#DC2626'],
  ] as const;
  return <ScrollView style={styles.container} contentContainerStyle={styles.content}>
    <View style={styles.header}><View><Text style={styles.eyebrow}>DICT / SYSTEM OVERSIGHT</Text><Text style={styles.title}>Digital Governance Dashboard</Text><Text style={styles.subtitle}>Read-only cross-system health, activity, and data-quality visibility.</Text></View><TouchableOpacity style={styles.refresh} onPress={load}><MaterialIcons name="refresh" size={18} color="#374151" /><Text style={styles.refreshText}>Refresh</Text></TouchableOpacity></View>
    {!!error && <Text style={styles.error}>{error}</Text>}
    <View style={styles.cards}>{cards.map(([label, value, icon, color]) => <View key={label} style={styles.card}><View style={[styles.icon, { backgroundColor: `${color}15` }]}><MaterialIcons name={icon as any} size={22} color={color} /></View><Text style={styles.cardValue}>{value}</Text><Text style={styles.cardLabel}>{label}</Text></View>)}</View>
    <View style={styles.grid}>
      <View style={styles.panel}><Text style={styles.panelTitle}>System Readiness</Text>{[
        ['Fleet telemetry', `${data?.operations.activeFleet || 0} active / ${data?.operations.staleFleet || 0} stale`, (data?.operations.staleFleet || 0) === 0],
        ['GPS coverage', `${data?.dataQuality.reportsMissingGps || 0} reports missing coordinates`, (data?.dataQuality.reportsMissingGps || 0) === 0],
        ['Pickup evidence', `${data?.dataQuality.completedSchedulesMissingMeasurement || 0} completed pickups unmeasured`, (data?.dataQuality.completedSchedulesMissingMeasurement || 0) === 0],
        ['Expense validation', `${data?.dataQuality.expensePeriods || 0} actual periods linked`, (data?.dataQuality.expensePeriods || 0) >= 3],
      ].map(([label, detail, ok]) => <View key={String(label)} style={styles.healthRow}><View style={[styles.dot, { backgroundColor: ok ? '#10B981' : '#F59E0B' }]} /><View><Text style={styles.healthLabel}>{label}</Text><Text style={styles.healthDetail}>{detail}</Text></View></View>)}</View>
      <View style={styles.panel}><Text style={styles.panelTitle}>Identity Distribution</Text>{Object.entries(data?.roles || {}).map(([role, count]) => <View key={role} style={styles.roleRow}><Text style={styles.roleName}>{role.toUpperCase()}</Text><Text style={styles.roleCount}>{count}</Text></View>)}</View>
    </View>
    <View style={styles.panel}><Text style={styles.panelTitle}>Recent Audit Activity</Text>{!data?.recentAudit.length ? <Text style={styles.muted}>No audit records available.</Text> : data.recentAudit.slice(0, 10).map(item => <View key={item.id} style={styles.auditRow}><MaterialIcons name="history" size={17} color="#64748B" /><View style={{ flex: 1 }}><Text style={styles.auditEvent}>{String(item.event || 'system.event').replaceAll('.', ' ')}</Text><Text style={styles.auditMeta}>{item.actorUid || 'server'} · {item.createdAt ? new Date(item.createdAt).toLocaleString() : 'pending timestamp'}</Text></View></View>)}</View>
    <Text style={styles.generated}>Snapshot generated {data?.generatedAt ? new Date(data.generatedAt).toLocaleString() : '—'}</Text>
  </ScrollView>;
}

const styles = StyleSheet.create({
  container:{flex:1,backgroundColor:'#F8FAFC'},content:{padding:28},center:{flex:1,alignItems:'center',justifyContent:'center'},muted:{color:'#64748B',fontSize:12,marginTop:10},header:{flexDirection:'row',justifyContent:'space-between',alignItems:'flex-start',gap:16,marginBottom:22},eyebrow:{fontSize:10,fontWeight:'900',color:'#4F46E5',letterSpacing:1.1},title:{fontSize:26,fontWeight:'900',color:'#0F172A',marginTop:5},subtitle:{fontSize:12,color:'#64748B',marginTop:5},refresh:{flexDirection:'row',alignItems:'center',gap:7,borderWidth:1,borderColor:'#CBD5E1',borderRadius:9,paddingHorizontal:13,paddingVertical:9,backgroundColor:'#FFFFFF'},refreshText:{fontSize:11,fontWeight:'800',color:'#374151'},error:{color:'#B91C1C',backgroundColor:'#FEF2F2',padding:12,borderRadius:9,marginBottom:14},cards:{flexDirection:'row',flexWrap:'wrap',gap:13,marginBottom:16},card:{flex:1,minWidth:170,backgroundColor:'#FFFFFF',borderWidth:1,borderColor:'#E2E8F0',borderRadius:14,padding:16},icon:{width:40,height:40,borderRadius:10,alignItems:'center',justifyContent:'center',marginBottom:12},cardValue:{fontSize:27,fontWeight:'900',color:'#0F172A'},cardLabel:{fontSize:9,fontWeight:'900',color:'#64748B',letterSpacing:.7,marginTop:3},grid:{flexDirection:'row',flexWrap:'wrap',gap:16,marginBottom:16},panel:{flex:1,minWidth:300,backgroundColor:'#FFFFFF',borderWidth:1,borderColor:'#E2E8F0',borderRadius:14,padding:17,marginBottom:16},panelTitle:{fontSize:14,fontWeight:'900',color:'#0F172A',marginBottom:10},healthRow:{flexDirection:'row',alignItems:'center',gap:10,paddingVertical:9,borderBottomWidth:1,borderBottomColor:'#F1F5F9'},dot:{width:9,height:9,borderRadius:5},healthLabel:{fontSize:11,fontWeight:'800',color:'#334155'},healthDetail:{fontSize:9,color:'#64748B',marginTop:2},roleRow:{flexDirection:'row',justifyContent:'space-between',paddingVertical:10,borderBottomWidth:1,borderBottomColor:'#F1F5F9'},roleName:{fontSize:10,fontWeight:'800',color:'#475569'},roleCount:{fontSize:13,fontWeight:'900',color:'#4F46E5'},auditRow:{flexDirection:'row',alignItems:'center',gap:10,paddingVertical:9,borderBottomWidth:1,borderBottomColor:'#F1F5F9'},auditEvent:{fontSize:11,fontWeight:'800',color:'#334155',textTransform:'capitalize'},auditMeta:{fontSize:9,color:'#64748B',marginTop:2},generated:{fontSize:9,color:'#94A3B8',textAlign:'right'},
});
