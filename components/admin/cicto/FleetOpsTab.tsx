import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { CictoOversightSnapshot, getCictoOversightSnapshot } from '@/services/cictoOversightService';

export default function FleetOpsTab() {
  const [data, setData] = useState<CictoOversightSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      setData(await getCictoOversightSnapshot());
    } catch (e: any) {
      setError(e?.message || 'Failed to load fleet operations.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <View>
          <Text style={styles.eyebrow}>CICTO / FLEET TELEMETRY</Text>
          <Text style={styles.title}>Municipal Fleet Telemetry</Text>
          <Text style={styles.sub}>
            Real-time GPS tracking status, collection route adherence, and vehicle diagnostics.
          </Text>
        </View>
        <TouchableOpacity style={styles.refresh} onPress={load} activeOpacity={0.7} accessibilityLabel="Refresh">
          <MaterialIcons name="refresh" size={20} color="#0D9488" />
        </TouchableOpacity>
      </View>

      {loading && !data ? (
        <ActivityIndicator size="large" color="#0D9488" />
      ) : null}

      {!!error && <Text style={styles.error}>{error}</Text>}

      <View style={styles.metricsRow}>
        <View style={styles.metricCard}>
          <Text style={styles.metricLabel}>ACTIVE FLEET</Text>
          <Text style={[styles.metricValue, { color: '#059669' }]}>
            {data?.operations.activeFleet || 0}
          </Text>
        </View>
        <View style={styles.metricCard}>
          <Text style={styles.metricLabel}>REGISTERED TRUCKS</Text>
          <Text style={[styles.metricValue, { color: '#0D9488' }]}>
            {data?.counts.trucks || 0}
          </Text>
        </View>
        <View style={styles.metricCard}>
          <Text style={styles.metricLabel}>ACTIVE SCHEDULES</Text>
          <Text style={[styles.metricValue, { color: '#D97706' }]}>
            {data?.operations.activeSchedules || 0}
          </Text>
        </View>
        <View style={styles.metricCard}>
          <Text style={styles.metricLabel}>COMPLETED PICKUPS</Text>
          <Text style={[styles.metricValue, { color: '#0F766E' }]}>
            {data?.operations.completedSchedules || 0}
          </Text>
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Fleet Status Summary</Text>
        <Text style={styles.sectionSubtitle}>
          Municipal waste trucks currently transmitting real-time coordinates to CICTO Central.
        </Text>
        <View style={styles.locationsList}>
          {data?.fleetLocations && data.fleetLocations.length > 0 ? (
            data.fleetLocations.map((truck, idx) => (
              <View key={truck.id || idx} style={styles.truckItem}>
                <View style={styles.truckIconWrap}>
                  <MaterialIcons name="local-shipping" size={22} color="#0D9488" />
                </View>
                <View style={styles.truckDetails}>
                  <Text style={styles.truckPlate}>{truck.plateNumber || truck.plate || `Truck #${idx + 1}`}</Text>
                  <Text style={styles.truckStatus}>
                    Status: {truck.status || 'Active'} • Driver: {truck.driverName || 'Assigned'}
                  </Text>
                </View>
                <View style={styles.badge}>
                  <View style={styles.dot} />
                  <Text style={styles.badgeText}>ONLINE</Text>
                </View>
              </View>
            ))
          ) : (
            <Text style={styles.emptyText}>No active fleet transmissions in the last window.</Text>
          )}
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
  metricsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 14,
    marginBottom: 24,
  },
  metricCard: {
    flex: 1,
    minWidth: 160,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 12,
    padding: 18,
  },
  metricLabel: {
    fontSize: 10,
    fontWeight: '900',
    color: '#64748B',
    letterSpacing: 0.8,
  },
  metricValue: {
    fontSize: 28,
    fontWeight: '900',
    marginTop: 6,
  },
  section: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 14,
    padding: 20,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '900',
    color: '#0F172A',
  },
  sectionSubtitle: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 4,
    marginBottom: 16,
  },
  locationsList: {
    gap: 10,
  },
  truckItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    backgroundColor: '#F8FAFC',
    borderRadius: 10,
    gap: 12,
  },
  truckIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 8,
    backgroundColor: '#F0FDFA',
    justifyContent: 'center',
    alignItems: 'center',
  },
  truckDetails: {
    flex: 1,
  },
  truckPlate: {
    fontSize: 13,
    fontWeight: '800',
    color: '#0F172A',
  },
  truckStatus: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 2,
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  dot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: '#10B981',
  },
  badgeText: {
    fontSize: 9,
    fontWeight: '900',
    color: '#166534',
  },
  emptyText: {
    fontSize: 12,
    color: '#94A3B8',
    fontStyle: 'italic',
    paddingVertical: 12,
  },
});
