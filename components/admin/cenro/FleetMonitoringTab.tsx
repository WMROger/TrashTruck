import { MaterialIcons } from '@expo/vector-icons';
import { collection, limit, onSnapshot, orderBy, query } from 'firebase/firestore';
import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import { db } from '@/config/firebase';
import FleetReplayMap, { ReplayPoint } from './FleetReplayMap';

type FleetEvent = {
  id: string;
  event: 'fleet.location' | 'fleet.alert';
  driverId: string;
  truckId: string;
  tripId: string;
  location?: { lat?: number; lng?: number };
  speedKph?: number;
  alertType?: string;
  severity?: string;
  metadata?: Record<string, any>;
  recordedAtClient?: string;
  createdAt?: any;
};

const eventTime = (event: FleetEvent) => {
  if (event.recordedAtClient) return new Date(event.recordedAtClient).getTime();
  if (event.createdAt?.toMillis) return event.createdAt.toMillis();
  return 0;
};

export default function FleetMonitoringTab({ oversightLabel = 'CENRO FLEET CONTROL' }: { oversightLabel?: string }) {
  const [events, setEvents] = useState<FleetEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedTrip, setSelectedTrip] = useState('');
  const [replayIndex, setReplayIndex] = useState(0);
  const [playing, setPlaying] = useState(false);

  useEffect(() => {
    return onSnapshot(query(collection(db, 'client_activity'), orderBy('createdAt', 'desc'), limit(1500)), snapshot => {
      setEvents(snapshot.docs
        .map(item => ({ id: item.id, ...item.data() } as FleetEvent))
        .filter(item => item.event === 'fleet.location' || item.event === 'fleet.alert'));
      setLoading(false);
    }, error => {
      console.warn('Fleet history could not be loaded:', error);
      setLoading(false);
    });
  }, []);

  const locations = useMemo(() => events.filter(event => event.event === 'fleet.location'), [events]);
  const alerts = useMemo(() => events.filter(event => event.event === 'fleet.alert').sort((a, b) => eventTime(b) - eventTime(a)), [events]);
  const trips = useMemo(() => {
    const grouped = new Map<string, FleetEvent[]>();
    locations.forEach(event => {
      const id = event.tripId || `${event.truckId}-${new Date(eventTime(event)).toLocaleDateString()}`;
      grouped.set(id, [...(grouped.get(id) || []), event]);
    });
    return Array.from(grouped.entries()).map(([id, points]) => ({
      id,
      truckId: points[0]?.truckId || 'Unknown truck',
      driverId: points[0]?.driverId || 'Unknown driver',
      points: points.sort((a, b) => eventTime(a) - eventTime(b)),
      lastUpdate: Math.max(...points.map(eventTime)),
    })).sort((a, b) => b.lastUpdate - a.lastUpdate);
  }, [locations]);

  useEffect(() => {
    if (!selectedTrip && trips.length) setSelectedTrip(trips[0].id);
  }, [selectedTrip, trips]);

  const trip = trips.find(item => item.id === selectedTrip) || null;
  const replayPoints: ReplayPoint[] = (trip?.points || []).map(point => ({
    id: point.id,
    latitude: Number(point.location?.lat),
    longitude: Number(point.location?.lng),
    speedKph: Number(point.speedKph || 0),
    timestampMs: eventTime(point),
  })).filter(point => Number.isFinite(point.latitude) && Number.isFinite(point.longitude));

  useEffect(() => {
    setReplayIndex(0);
    setPlaying(false);
  }, [selectedTrip]);

  useEffect(() => {
    if (!playing || replayPoints.length < 2) return;
    const timer = setInterval(() => {
      setReplayIndex(index => {
        if (index >= replayPoints.length - 1) {
          setPlaying(false);
          return index;
        }
        return index + 1;
      });
    }, 700);
    return () => clearInterval(timer);
  }, [playing, replayPoints.length]);

  const now = Date.now();
  const latestByTruck = new Map<string, FleetEvent>();
  locations.forEach(event => {
    if (!latestByTruck.has(event.truckId) || eventTime(event) > eventTime(latestByTruck.get(event.truckId)!)) latestByTruck.set(event.truckId, event);
  });
  const activeCount = Array.from(latestByTruck.values()).filter(event => now - eventTime(event) <= 2 * 60 * 1000).length;

  if (loading) return <View style={styles.loading}><ActivityIndicator size="large" color="#2563EB" /><Text style={styles.loadingText}>Loading fleet telemetry…</Text></View>;

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.headerRow}>
        <View><Text style={styles.eyebrow}>{oversightLabel} / FEATURE 30</Text><Text style={styles.title}>Fleet Monitoring, Trip Replay & Alerts</Text><Text style={styles.subtitle}>Driver GPS points are retained as append-only trip telemetry while an active route is assigned.</Text></View>
      </View>
      <View style={styles.metrics}>
        <View style={styles.metric}><Text style={styles.metricLabel}>ACTIVE ≤2 MIN</Text><Text style={styles.metricValue}>{activeCount}</Text></View>
        <View style={styles.metric}><Text style={styles.metricLabel}>RECORDED TRIPS</Text><Text style={styles.metricValue}>{trips.length}</Text></View>
        <View style={styles.metric}><Text style={styles.metricLabel}>TRIP POINTS</Text><Text style={styles.metricValue}>{locations.length}</Text></View>
        <View style={[styles.metric, alerts.length ? styles.alertMetric : null]}><Text style={styles.metricLabel}>OPERATIONAL ALERTS</Text><Text style={[styles.metricValue, alerts.length ? { color: '#B91C1C' } : null]}>{alerts.length}</Text></View>
      </View>

      <View style={styles.mainGrid}>
        <View style={styles.replayCard}>
          <View style={styles.cardHeader}><View><Text style={styles.cardTitle}>Trip Replay</Text><Text style={styles.cardSubtitle}>{trip ? `${trip.truckId} · ${trip.points.length} recorded points` : 'No trip selected'}</Text></View><View style={styles.replayActions}><TouchableOpacity style={styles.iconButton} onPress={() => setReplayIndex(index => Math.max(0, index - 1))}><MaterialIcons name="skip-previous" size={20} color="#334155" /></TouchableOpacity><TouchableOpacity style={styles.playButton} onPress={() => setPlaying(value => !value)} disabled={replayPoints.length < 2}><MaterialIcons name={playing ? 'pause' : 'play-arrow'} size={20} color="#FFFFFF" /><Text style={styles.playText}>{playing ? 'Pause' : 'Replay'}</Text></TouchableOpacity><TouchableOpacity style={styles.iconButton} onPress={() => setReplayIndex(index => Math.min(replayPoints.length - 1, index + 1))}><MaterialIcons name="skip-next" size={20} color="#334155" /></TouchableOpacity></View></View>
          <FleetReplayMap points={replayPoints} activeIndex={replayIndex} />
          {!!replayPoints.length && <View style={styles.progressTrack}><View style={[styles.progressFill, { width: `${((replayIndex + 1) / replayPoints.length) * 100}%` }]} /></View>}
        </View>

        <View style={styles.tripListCard}><Text style={styles.cardTitle}>Recorded Trips</Text><ScrollView style={{ maxHeight: 430 }}>{trips.length === 0 ? <Text style={styles.empty}>Trip history appears after an assigned driver begins moving.</Text> : trips.map(item => <TouchableOpacity key={item.id} style={[styles.tripRow, selectedTrip === item.id && styles.tripRowActive]} onPress={() => setSelectedTrip(item.id)}><View style={styles.truckIcon}><MaterialIcons name="local-shipping" size={18} color={selectedTrip === item.id ? '#FFFFFF' : '#2563EB'} /></View><View style={{ flex: 1 }}><Text style={[styles.tripTruck, selectedTrip === item.id && { color: '#FFFFFF' }]}>{item.truckId}</Text><Text style={[styles.tripMeta, selectedTrip === item.id && { color: '#DBEAFE' }]}>{item.points.length} points · {new Date(item.lastUpdate).toLocaleString()}</Text></View></TouchableOpacity>)}</ScrollView></View>
      </View>

      <View style={styles.alertCard}><Text style={styles.cardTitle}>Operational Alerts</Text><Text style={styles.cardSubtitle}>Speed ≥60 km/h and route deviation ≥500 m for three consecutive samples are flagged with a five-minute cooldown.</Text>{alerts.length === 0 ? <Text style={styles.empty}>No operational alerts recorded.</Text> : alerts.slice(0, 12).map(alert => <View key={alert.id} style={styles.alertRow}><View style={[styles.alertIcon, { backgroundColor: alert.severity === 'high' ? '#FEE2E2' : '#FEF3C7' }]}><MaterialIcons name={alert.alertType === 'route-deviation' ? 'wrong-location' : 'speed'} size={18} color={alert.severity === 'high' ? '#DC2626' : '#D97706'} /></View><View style={{ flex: 1 }}><Text style={styles.alertTitle}>{String(alert.alertType || 'fleet alert').replace('-', ' ').toUpperCase()}</Text><Text style={styles.alertMeta}>{alert.truckId} · {new Date(eventTime(alert)).toLocaleString()}</Text></View><Text style={styles.alertDetail}>{alert.metadata?.speedKph ? `${alert.metadata.speedKph} km/h` : alert.metadata?.deviationMeters ? `${alert.metadata.deviationMeters} m` : ''}</Text></View>)}</View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8FAFC' }, content: { padding: 24 }, loading: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#F8FAFC' }, loadingText: { color: '#64748B', marginTop: 12 },
  headerRow: { marginBottom: 18 }, eyebrow: { color: '#2563EB', fontSize: 10, fontWeight: '900', letterSpacing: 1.1, marginBottom: 5 }, title: { color: '#0F172A', fontSize: 24, fontWeight: '900' }, subtitle: { color: '#64748B', fontSize: 12, marginTop: 5 },
  metrics: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginBottom: 18 }, metric: { flex: 1, minWidth: 150, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#E2E8F0', borderRadius: 12, padding: 15 }, alertMetric: { backgroundColor: '#FEF2F2', borderColor: '#FECACA' }, metricLabel: { color: '#64748B', fontSize: 9, fontWeight: '900', letterSpacing: 0.7 }, metricValue: { color: '#0F172A', fontSize: 25, fontWeight: '900', marginTop: 5 },
  mainGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 16 }, replayCard: { flex: 3, minWidth: 560, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#E2E8F0', borderRadius: 14, padding: 16 }, tripListCard: { flex: 1, minWidth: 260, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#E2E8F0', borderRadius: 14, padding: 16 },
  cardHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 12 }, cardTitle: { color: '#0F172A', fontSize: 15, fontWeight: '900' }, cardSubtitle: { color: '#64748B', fontSize: 10, marginTop: 3, lineHeight: 15 }, replayActions: { flexDirection: 'row', alignItems: 'center', gap: 7 }, iconButton: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#CBD5E1', borderRadius: 8 }, playButton: { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: '#2563EB', paddingHorizontal: 12, height: 36, borderRadius: 8 }, playText: { color: '#FFFFFF', fontSize: 10, fontWeight: '900' }, progressTrack: { height: 5, backgroundColor: '#E2E8F0', borderRadius: 5, marginTop: 10, overflow: 'hidden' }, progressFill: { height: '100%', backgroundColor: '#2563EB' },
  tripRow: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 11, borderRadius: 10, backgroundColor: '#F8FAFC', marginTop: 9 }, tripRowActive: { backgroundColor: '#2563EB' }, truckIcon: { width: 34, height: 34, borderRadius: 9, backgroundColor: 'rgba(255,255,255,0.16)', alignItems: 'center', justifyContent: 'center' }, tripTruck: { color: '#0F172A', fontSize: 11, fontWeight: '900' }, tripMeta: { color: '#64748B', fontSize: 9, marginTop: 3 }, empty: { color: '#64748B', fontSize: 11, lineHeight: 17, paddingVertical: 16 },
  alertCard: { backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#E2E8F0', borderRadius: 14, padding: 16, marginTop: 16 }, alertRow: { flexDirection: 'row', alignItems: 'center', gap: 11, paddingVertical: 11, borderBottomWidth: 1, borderBottomColor: '#F1F5F9' }, alertIcon: { width: 36, height: 36, borderRadius: 9, alignItems: 'center', justifyContent: 'center' }, alertTitle: { color: '#0F172A', fontSize: 11, fontWeight: '900' }, alertMeta: { color: '#64748B', fontSize: 9, marginTop: 3 }, alertDetail: { color: '#B91C1C', fontSize: 11, fontWeight: '900' },
});
