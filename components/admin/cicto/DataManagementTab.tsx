import { MaterialIcons } from '@expo/vector-icons';
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

import { db } from '@/config/firebase';
import {
  CictoOversightSnapshot,
  getCictoOversightSnapshot,
} from '@/services/cictoOversightService';

export default function DataManagementTab() {
  const [data, setData] = useState<CictoOversightSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      setData(await getCictoOversightSnapshot());
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Data inventory failed.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const collections = [
    ['Users', data?.counts.users || 0, 'Identity directory'],
    ['Reports', data?.counts.reports || 0, `${data?.dataQuality.reportsMissingGps || 0} missing GPS`],
    ['Schedules', data?.counts.schedules || 0, `${data?.dataQuality.completedSchedulesMissingMeasurement || 0} completed without measurement`],
    ['Trucks', data?.counts.trucks || 0, 'Fleet inventory'],
    ['Expense records', data?.counts.expenses || 0, `${data?.dataQuality.expensePeriods || 0} distinct periods`],
    ['Audit events', data?.counts.auditEvents || 0, 'Latest server audit window'],
  ];

  const [seeding, setSeeding] = useState(false);
  const [seedSuccess, setSeedSuccess] = useState('');

  const handleBootstrapData = async () => {
    if (!db) return;
    setSeeding(true);
    setSeedSuccess('');
    try {
      const { collection, doc, writeBatch, serverTimestamp } = await import('firebase/firestore');
      const batch = writeBatch(db);

      // 21 Danao Barangays
      const barangays = [
        'Poblacion', 'Suba', 'Looc', 'Sabang', 'Guinsay', 'Maslog', 'Taytay',
        'Tuburan Sur', 'Cogon-Cruz', 'Baliang', 'Cabungahan', 'Cambanay',
        'Dunggoan', 'Guinacot', 'Ibo', 'Lawaan', 'Malapoc', 'Manlayag',
        'Mantija', 'Quisol', 'Santican'
      ];

      for (const bName of barangays) {
        const slug = bName.toLowerCase().replace(/[^a-z0-9]/g, '_');
        batch.set(doc(db, 'barangays', slug), {
          name: bName,
          slug,
          city: 'Danao City',
          province: 'Cebu',
          active: true,
          createdAt: serverTimestamp(),
          seededBy: 'CICTO Web Bootstrap',
        }, { merge: true });
      }

      // Souvenir Catalog
      const souvenirs = [
        { id: 'tumbler', name: 'Eco-Friendly Tumbler', type: 'Matte Green, Double-walled insulation', cost: 1000, stock: 50, category: 'Merchandise' },
        { id: 'tote', name: 'CENRO Tote Bag', type: 'Canvas, Heavy Duty', cost: 500, stock: 100, category: 'Apparel' },
        { id: 'kit', name: 'Reusable Utensil Kit', type: 'Bamboo with pouch', cost: 2000, stock: 30, category: 'Eco Kit' },
        { id: 'seedling_pack', name: 'Native Tree Seedling Pack', type: 'Narra & Mahogany Seedlings', cost: 300, stock: 75, category: 'Eco Initiative' },
      ];

      for (const item of souvenirs) {
        batch.set(doc(db, 'reward_catalog', item.id), {
          ...item,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        }, { merge: true });
      }
      batch.set(doc(db, 'app_config', 'rewards'), {
        updatedAt: serverTimestamp(),
        items: souvenirs,
      }, { merge: true });

      // Fleet Trucks
      const trucks = [
        { id: 'TRK-01', plateNumber: 'GA-2026-01', model: 'Isuzu Elf 6-Wheeler Compactor (10m³)', capacityKg: 5000, status: 'available', currentBarangay: 'Poblacion', fuelLevelPercent: 95 },
        { id: 'TRK-02', plateNumber: 'GA-2026-02', model: 'Hino 500 Heavy Compactor (16m³)', capacityKg: 8000, status: 'available', currentBarangay: 'Sabang', fuelLevelPercent: 88 },
        { id: 'TRK-03', plateNumber: 'GA-2026-03', model: 'Fuso Canter Mini-Compactor (6m³)', capacityKg: 3500, status: 'available', currentBarangay: 'Suba', fuelLevelPercent: 92 },
      ];

      for (const t of trucks) {
        batch.set(doc(db, 'trucks', t.id), {
          ...t,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        }, { merge: true });
      }

      // Auto-dispatch settings
      batch.set(doc(db, 'system_settings', 'auto_dispatch'), {
        enabled: true,
        updatedAt: serverTimestamp(),
        systemMode: 'autonomous_ai_routing',
        city: 'Danao City',
      }, { merge: true });

      await batch.commit();
      setSeedSuccess('✅ 21 Danao Barangays, Souvenir Catalog, and Fleet Trucks successfully seeded!');
      await load();
    } catch (e: any) {
      setError(e?.message || 'Bootstrap failed.');
    } finally {
      setSeeding(false);
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <View>
          <Text style={styles.eyebrow}>CICTO / DATA GOVERNANCE</Text>
          <Text style={styles.title}>Data Management</Text>
          <Text style={styles.sub}>
            Live collection inventory, completeness checks, and operational data readiness.
          </Text>
        </View>
        <TouchableOpacity style={styles.refresh} onPress={load} activeOpacity={0.7} accessibilityLabel="Refresh">
          <MaterialIcons name="refresh" size={20} color="#0D9488" />
        </TouchableOpacity>
      </View>

      {/* 1-Click Defense Bootstrap Banner */}
      <View style={styles.bootstrapBanner}>
        <View style={{ flex: 1 }}>
          <Text style={styles.bootstrapTitle}>Defense Demo Bootstrap</Text>
          <Text style={styles.bootstrapText}>
            Quickly seed 21 Danao Barangays, Souvenir Rewards, and Fleet Trucks into Firestore with 1 click.
          </Text>
          {!!seedSuccess && <Text style={styles.seedSuccessText}>{seedSuccess}</Text>}
        </View>
        <TouchableOpacity
          style={[styles.bootstrapBtn, seeding && { opacity: 0.6 }]}
          onPress={handleBootstrapData}
          disabled={seeding}
          activeOpacity={0.8}
        >
          {seeding ? (
            <ActivityIndicator size="small" color="#FFFFFF" />
          ) : (
            <>
              <MaterialIcons name="auto-fix-high" size={18} color="#FFFFFF" style={{ marginRight: 6 }} />
              <Text style={styles.bootstrapBtnText}>Bootstrap Data</Text>
            </>
          )}
        </TouchableOpacity>
      </View>

      {loading && !data ? (
        <ActivityIndicator size="large" color="#0D9488" style={{ marginVertical: 20 }} />
      ) : null}

      {!!error && <Text style={styles.error}>{error}</Text>}

      <View style={styles.table}>
        <View style={styles.tableHead}>
          <Text style={[styles.th, { flex: 1.2 }]}>DATASET</Text>
          <Text style={[styles.th, { width: 100 }]}>RECORDS</Text>
          <Text style={[styles.th, { flex: 2 }]}>QUALITY SIGNAL</Text>
          <Text style={[styles.th, { width: 100 }]}>STATUS</Text>
        </View>
        {collections.map(([name, count, signal]) => (
          <View key={String(name)} style={styles.row}>
            <Text style={[styles.name, { flex: 1.2 }]}>{name}</Text>
            <Text style={[styles.count, { width: 100 }]}>{count}</Text>
            <Text style={[styles.signal, { flex: 2 }]}>{signal}</Text>
            <View style={[styles.badge, { width: 100 }]}>
              <View style={styles.dot} />
              <Text style={styles.badgeText}>CONNECTED</Text>
            </View>
          </View>
        ))}
      </View>

      <View style={styles.quality}>
        <Text style={styles.qualityTitle}>Readiness Gates</Text>
        <View style={styles.gates}>
          {[
            ['GPS completeness', (data?.dataQuality.reportsMissingGps || 0) === 0, `${data?.dataQuality.reportsMissingGps || 0} missing`],
            ['Measured pickups', (data?.dataQuality.completedSchedulesMissingMeasurement || 0) === 0, `${data?.dataQuality.completedSchedulesMissingMeasurement || 0} incomplete`],
            ['Budget backtest', (data?.dataQuality.expensePeriods || 0) >= 3, `${data?.dataQuality.expensePeriods || 0}/3 periods`],
          ].map(([label, ok, detail]) => (
            <View key={String(label)} style={styles.gate}>
              <MaterialIcons name={ok ? 'check-circle' : 'pending'} size={23} color={ok ? '#16A34A' : '#D97706'} />
              <Text style={styles.gateLabel}>{label}</Text>
              <Text style={styles.gateDetail}>{detail}</Text>
            </View>
          ))}
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8FAFC' },
  content: { padding: 28 },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 16,
    marginBottom: 22,
  },
  eyebrow: {
    fontSize: 10,
    fontWeight: '900',
    color: '#0D9488',
    letterSpacing: 1.1,
  },
  title: {
    fontSize: 26,
    fontWeight: '900',
    color: '#0F172A',
    marginTop: 5,
  },
  sub: { fontSize: 12, color: '#64748B', marginTop: 5 },
  refresh: {
    width: 38,
    height: 38,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  error: {
    color: '#B91C1C',
    backgroundColor: '#FEF2F2',
    padding: 12,
    borderRadius: 9,
    marginBottom: 14,
  },
  table: {
    backgroundColor: '#FFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 14,
    overflow: 'hidden',
  },
  tableHead: {
    flexDirection: 'row',
    padding: 13,
    backgroundColor: '#F1F5F9',
  },
  th: {
    fontSize: 9,
    fontWeight: '900',
    color: '#64748B',
    letterSpacing: 0.7,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 15,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
  },
  name: { fontSize: 12, fontWeight: '900', color: '#0F172A' },
  count: { fontSize: 15, fontWeight: '900', color: '#0D9488' },
  signal: { fontSize: 11, color: '#64748B' },
  badge: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  dot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: '#10B981',
  },
  badgeText: { fontSize: 8, fontWeight: '900', color: '#166534' },
  quality: {
    backgroundColor: '#FFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 14,
    padding: 17,
    marginTop: 16,
  },
  qualityTitle: { fontSize: 14, fontWeight: '900', color: '#0F172A' },
  gates: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginTop: 12 },
  gate: {
    flex: 1,
    minWidth: 180,
    backgroundColor: '#F8FAFC',
    borderRadius: 11,
    padding: 14,
  },
  gateLabel: { fontSize: 11, fontWeight: '900', color: '#334155', marginTop: 8 },
  gateDetail: { fontSize: 9, color: '#64748B', marginTop: 3 },
  bootstrapBanner: {
    backgroundColor: '#ECFDF5',
    borderWidth: 1.5,
    borderColor: '#A7F3D0',
    borderRadius: 14,
    padding: 18,
    marginBottom: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 16,
    flexWrap: 'wrap',
  },
  bootstrapTitle: { fontSize: 15, fontWeight: '900', color: '#065F46' },
  bootstrapText: { fontSize: 12, color: '#047857', marginTop: 4, lineHeight: 17 },
  seedSuccessText: { fontSize: 12, fontWeight: '800', color: '#059669', marginTop: 8 },
  bootstrapBtn: {
    backgroundColor: '#059669',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#059669',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
  },
  bootstrapBtnText: { color: '#FFFFFF', fontSize: 13, fontWeight: '800' },
});
