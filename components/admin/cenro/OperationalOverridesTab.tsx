import React, { useState, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  Platform,
  useWindowDimensions,
  TextInput,
} from 'react-native';
import { MaterialIcons, Feather } from '@expo/vector-icons';
import { db } from '../../../config/firebase';
import { doc, collection, onSnapshot, query, orderBy, limit } from 'firebase/firestore';
import LiveOperationsMap, { LiveMapReport, LiveMapTruck } from './LiveOperationsMap';

interface LogItem {
  id: string;
  timestamp: any;
  source: string;
  action: string;
  category: 'system' | 'driver' | 'dispatch' | 'report' | 'other';
  confidence?: string;
  details?: string;
}

export default function OperationalOverridesTab() {
  const { width } = useWindowDimensions();
  const isMobile = width < 768;

  const [settings, setSettings] = useState({
    forcePauseCollection: false,
    activateBackupFleet: true,
  });

  const [overrideLogs, setOverrideLogs] = useState<LogItem[]>([]);
  const [clientLogs, setClientLogs] = useState<LogItem[]>([]);
  const [liveTrucks, setLiveTrucks] = useState<LiveMapTruck[]>([]);
  const [openReports, setOpenReports] = useState<(LiveMapReport & { barangay: string })[]>([]);
  const [loading, setLoading] = useState(true);

  // Search and filter state
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<'all' | 'system' | 'driver' | 'dispatch' | 'report'>('all');

  useEffect(() => {
    if (!db) {
      setLoading(false);
      return;
    }

    // 1. Listen to system settings (Read-only for CENRO)
    const docRef = doc(db, 'system_settings', 'overrides');
    const unsubDoc = onSnapshot(
      docRef,
      (snap) => {
        if (snap.exists()) {
          setSettings(snap.data() as any);
        }
        setLoading(false);
      },
      (error) => {
        console.error('Error fetching system_settings:', error);
        setLoading(false);
      }
    );

    // 2. Listen to system override activity logs
    const logsRef = collection(db, 'system_settings', 'overrides', 'activity_logs');
    const qLogs = query(logsRef, orderBy('timestamp', 'desc'), limit(40));
    const unsubLogs = onSnapshot(
      qLogs,
      (snap) => {
        const fetched = snap.docs.map((d) => {
          const data = d.data();
          return {
            id: `override-${d.id}`,
            timestamp: data.timestamp,
            source: data.source || 'Admin',
            action: data.action || 'System Override Event',
            category: 'system' as const,
            confidence: data.confidence || 'Manual',
            details: data.details || '',
          };
        });
        setOverrideLogs(fetched);
      },
      (error) => {
        console.error('Error fetching activity_logs:', error);
      }
    );

    // 3. Listen to client/driver operational activity logs
    const clientRef = collection(db, 'client_activity');
    const qClient = query(clientRef, orderBy('createdAt', 'desc'), limit(50));
    const unsubClient = onSnapshot(
      qClient,
      (snap) => {
        const fetched = snap.docs.map((d) => {
          const data = d.data();
          const evt = String(data.event || '');
          let cat: LogItem['category'] = 'other';
          if (evt.startsWith('pickup')) cat = 'driver';
          else if (evt.startsWith('route')) cat = 'dispatch';
          else if (evt.startsWith('report')) cat = 'report';
          else cat = 'driver';

          const actionLabel = evt
            .replace(/\./g, ' ')
            .replace(/_/g, ' ')
            .replace(/\b\w/g, (c) => c.toUpperCase());

          return {
            id: `client-${d.id}`,
            timestamp: data.createdAt,
            source: data.actorEmail || data.actorUid || 'Driver Terminal',
            action: actionLabel || 'Field Operation Event',
            category: cat,
            confidence: 'Verified',
            details: data.targetId ? `Target: ${data.targetId}` : '',
          };
        });
        setClientLogs(fetched);
      },
      (error) => {
        console.error('Error fetching client_activity:', error);
      }
    );

    // 4. Listen to Live Truck Locations
    const unsubLocations = onSnapshot(
      collection(db, 'truck_locations'),
      (snapshot) => {
        setLiveTrucks(
          snapshot.docs
            .map((item) => {
              const data = item.data();
              return {
                id: item.id,
                latitude: Number(data.lat ?? data.latitude),
                longitude: Number(data.lng ?? data.longitude),
                label: String(data.truckId || item.id),
                active: String(data.status || '').toLowerCase() === 'active',
              };
            })
            .filter((item) => Number.isFinite(item.latitude) && Number.isFinite(item.longitude))
        );
      },
      (error) => console.error('Error fetching live truck locations:', error)
    );

    // 5. Listen to Reports
    const unsubReports = onSnapshot(
      collection(db, 'reports'),
      (snapshot) => {
        setOpenReports(
          snapshot.docs
            .map((item) => {
              const data = item.data();
              const location = data.location || {};
              return {
                id: item.id,
                latitude: Number(location.lat ?? location.latitude ?? data.lat ?? data.latitude),
                longitude: Number(location.lng ?? location.longitude ?? data.lng ?? data.longitude),
                label: String(data.title || data.barangay || 'Open report'),
                barangay: String(data.barangay || 'Unspecified'),
                status: String(data.status || 'pending'),
              };
            })
            .filter(
              (item) =>
                !['resolved', 'completed', 'done', 'rejected'].includes(item.status.toLowerCase()) &&
                Number.isFinite(item.latitude) &&
                Number.isFinite(item.longitude)
            )
        );
      },
      (error) => console.error('Error fetching report locations:', error)
    );

    return () => {
      unsubDoc();
      unsubLogs();
      unsubClient();
      unsubLocations();
      unsubReports();
    };
  }, []);

  // Combine and sort logs
  const allLogs = useMemo(() => {
    const combined = [...overrideLogs, ...clientLogs];
    return combined.sort((a, b) => {
      const timeA = a.timestamp?.toMillis ? a.timestamp.toMillis() : 0;
      const timeB = b.timestamp?.toMillis ? b.timestamp.toMillis() : 0;
      return timeB - timeA;
    });
  }, [overrideLogs, clientLogs]);

  // Filter logs based on search query and category filter
  const filteredLogs = useMemo(() => {
    return allLogs.filter((log) => {
      if (categoryFilter !== 'all' && log.category !== categoryFilter) {
        return false;
      }
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchesSource = log.source.toLowerCase().includes(q);
        const matchesAction = log.action.toLowerCase().includes(q);
        const matchesDetails = (log.details || '').toLowerCase().includes(q);
        return matchesSource || matchesAction || matchesDetails;
      }
      return true;
    });
  }, [allLogs, categoryFilter, searchQuery]);

  const riskHotspots = useMemo(() => {
    const counts = openReports.reduce<Record<string, number>>((result, report) => {
      result[report.barangay] = (result[report.barangay] || 0) + 1;
      return result;
    }, {});
    return Object.entries(counts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3);
  }, [openReports]);

  // Read-only Export of Activity Logs to CSV
  const exportActivityLog = () => {
    if (Platform.OS !== 'web' || typeof document === 'undefined') {
      Alert.alert('Web export only', 'Open the CENRO dashboard on web to download this report.');
      return;
    }
    const escape = (value: unknown) => `"${String(value ?? '').replace(/"/g, '""')}"`;
    const csv = [
      ['Timestamp', 'Category', 'Source', 'Action', 'Details', 'Confidence'].join(','),
      ...filteredLogs.map((row) =>
        [
          row.timestamp?.toDate ? row.timestamp.toDate().toISOString() : '',
          row.category.toUpperCase(),
          row.source,
          row.action,
          row.details || '',
          row.confidence || 'Logged',
        ]
          .map(escape)
          .join(',')
      ),
    ].join('\n');

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `trashtrack-cenro-logs-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const getCategoryBadge = (category: LogItem['category']) => {
    switch (category) {
      case 'system':
        return { label: 'SYSTEM', bg: '#FEF3C7', color: '#B45309', icon: 'settings' };
      case 'driver':
        return { label: 'DRIVER', bg: '#DCFCE7', color: '#15803D', icon: 'local-shipping' };
      case 'dispatch':
        return { label: 'DISPATCH', bg: '#E0E7FF', color: '#4338CA', icon: 'alt-route' };
      case 'report':
        return { label: 'REPORT', bg: '#FEE2E2', color: '#B91C1C', icon: 'report-problem' };
      default:
        return { label: 'LOG', bg: '#F1F5F9', color: '#475569', icon: 'info' };
    }
  };

  if (loading) {
    return (
      <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator size="large" color="#2E8B57" />
      </View>
    );
  }

  return (
    <ScrollView style={[styles.container, isMobile && { padding: 16 }]} showsVerticalScrollIndicator={false}>
      {/* Header Row */}
      <View style={[styles.headerRow, isMobile && { flexDirection: 'column', gap: 12, marginBottom: 16 }]}>
        <View style={[styles.headerTextContainer, isMobile && { paddingRight: 0 }]}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6 }}>
            <Text style={styles.headerTitle}>System & Operational Logs</Text>
            <View style={styles.readOnlyBadge}>
              <MaterialIcons name="lock" size={12} color="#047857" />
              <Text style={styles.readOnlyBadgeText}>READ-ONLY AUDIT</Text>
            </View>
          </View>
          <Text style={styles.headerDesc}>
            Real-time, immutable audit trail of collection telemetry, field operations, and system override states.
          </Text>
        </View>

        <TouchableOpacity style={styles.exportTopBtn} onPress={exportActivityLog} activeOpacity={0.8}>
          <MaterialIcons name="download" size={18} color="#FFFFFF" />
          <Text style={styles.exportTopBtnText}>Export CSV Logs</Text>
        </TouchableOpacity>
      </View>

      {/* Read-Only Notice Banner */}
      <View style={styles.readOnlyNoticeBanner}>
        <MaterialIcons name="security" size={18} color="#1E40AF" />
        <Text style={styles.readOnlyNoticeText}>
          <Text style={{ fontWeight: '800' }}>CENRO Audit Mode:</Text> Logs and system protocol states are read-only. Policy overrides and system directives are administered by DICT.
        </Text>
      </View>

      <View style={[styles.mainRow, isMobile && { flexDirection: 'column', gap: 20 }]}>
        {/* Left Column: Overrides Status & Filterable Activity Logs */}
        <View style={[styles.leftColumn, isMobile && { flex: undefined, width: '100%' }]}>
          {/* Active Override Protocol States (Read-Only) */}
          <View style={styles.sectionHeader}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <MaterialIcons name="policy" size={16} color="#475569" />
              <Text style={styles.sectionTitle}>Protocol Override Status</Text>
            </View>
            <View style={styles.dictManagedBadge}>
              <MaterialIcons name="verified-user" size={12} color="#4338CA" />
              <Text style={styles.dictManagedBadgeText}>MANAGED BY DICT</Text>
            </View>
          </View>

          <View style={{ flexDirection: isMobile ? 'column' : 'row', gap: 12, marginBottom: 8 }}>
            {/* Scenario 1: Collection Pause */}
            <View
              style={[
                styles.scenarioCard,
                { flex: 1 },
                settings.forcePauseCollection && styles.scenarioCardActive,
              ]}
            >
              <View
                style={
                  settings.forcePauseCollection
                    ? styles.scenarioIconWrapperActive
                    : styles.scenarioIconWrapper
                }
              >
                <MaterialIcons
                  name="pause-circle-outline"
                  size={20}
                  color={settings.forcePauseCollection ? '#FFFFFF' : '#6B7280'}
                />
              </View>
              <View style={styles.scenarioContent}>
                <Text style={styles.scenarioTitle}>Collection Pause</Text>
                <View style={styles.scenarioDetailsRow}>
                  <View style={styles.scenarioDetailCol}>
                    <Text style={styles.scenarioLabel}>STATE</Text>
                    <View
                      style={[
                        styles.statusPill,
                        {
                          backgroundColor: settings.forcePauseCollection ? '#FEE2E2' : '#DCFCE7',
                        },
                      ]}
                    >
                      <Text
                        style={[
                          styles.statusPillText,
                          { color: settings.forcePauseCollection ? '#B91C1C' : '#15803D' },
                        ]}
                      >
                        {settings.forcePauseCollection ? 'PAUSED' : 'NORMAL'}
                      </Text>
                    </View>
                  </View>
                </View>
              </View>
            </View>

            {/* Scenario 2: Backup Fleet */}
            <View style={[styles.scenarioCard, { flex: 1 }]}>
              <View
                style={
                  settings.activateBackupFleet
                    ? styles.scenarioIconWrapperActive
                    : styles.scenarioIconWrapper
                }
              >
                <MaterialIcons
                  name="local-shipping"
                  size={20}
                  color={settings.activateBackupFleet ? '#FFFFFF' : '#6B7280'}
                />
              </View>
              <View style={styles.scenarioContent}>
                <Text style={styles.scenarioTitle}>Backup Fleet</Text>
                <View style={styles.scenarioDetailsRow}>
                  <View style={styles.scenarioDetailCol}>
                    <Text style={styles.scenarioLabel}>STATE</Text>
                    <View
                      style={[
                        styles.statusPill,
                        {
                          backgroundColor: settings.activateBackupFleet ? '#DCFCE7' : '#F1F5F9',
                        },
                      ]}
                    >
                      <Text
                        style={[
                          styles.statusPillText,
                          { color: settings.activateBackupFleet ? '#15803D' : '#475569' },
                        ]}
                      >
                        {settings.activateBackupFleet ? 'READY / ACTIVE' : 'STANDBY'}
                      </Text>
                    </View>
                  </View>
                </View>
              </View>
            </View>
          </View>

          {/* Activity Log Section with Search & Filters */}
          <View style={[styles.sectionHeader, { marginTop: 12 }]}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <MaterialIcons name="history" size={18} color="#1B4D3E" />
              <Text style={styles.sectionTitle}>Activity & Telemetry Log</Text>
            </View>
            <Text style={styles.sectionCount}>
              {filteredLogs.length} OF {allLogs.length} LOGS
            </Text>
          </View>

          {/* Search Box & Category Filter Chips */}
          <View style={styles.searchFilterContainer}>
            <View style={styles.searchInputRow}>
              <Feather name="search" size={16} color="#94A3B8" />
              <TextInput
                style={styles.searchInput}
                placeholder="Search logs by actor, action, or target..."
                placeholderTextColor="#94A3B8"
                value={searchQuery}
                onChangeText={setSearchQuery}
              />
              {searchQuery ? (
                <TouchableOpacity onPress={() => setSearchQuery('')}>
                  <Feather name="x" size={16} color="#94A3B8" />
                </TouchableOpacity>
              ) : null}
            </View>

            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterChipsRow}>
              {[
                { id: 'all', label: 'All Logs' },
                { id: 'system', label: 'System & Overrides' },
                { id: 'driver', label: 'Driver Operations' },
                { id: 'dispatch', label: 'Route Dispatches' },
                { id: 'report', label: 'Citizen Reports' },
              ].map((chip) => {
                const isActive = categoryFilter === chip.id;
                return (
                  <TouchableOpacity
                    key={chip.id}
                    style={[styles.filterChip, isActive && styles.filterChipActive]}
                    onPress={() => setCategoryFilter(chip.id as any)}
                    activeOpacity={0.7}
                  >
                    <Text style={[styles.filterChipText, isActive && styles.filterChipTextActive]}>
                      {chip.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>

          {/* Logs Table Card */}
          <View style={[styles.logCard, isMobile && { padding: 12 }]}>
            <ScrollView
              horizontal={isMobile}
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ flexGrow: 1, minWidth: '100%' }}
              style={{ width: '100%' }}
            >
              <View style={{ minWidth: isMobile ? 650 : '100%', width: '100%' }}>
                <View style={styles.tableHead}>
                  <Text style={[styles.th, { flex: 1.2 }]}>TIMESTAMP</Text>
                  <Text style={[styles.th, { flex: 1 }]}>CATEGORY</Text>
                  <Text style={[styles.th, { flex: 1.5 }]}>SOURCE / ACTOR</Text>
                  <Text style={[styles.th, { flex: 2 }]}>EVENT ACTION</Text>
                  <Text style={[styles.th, { flex: 1, textAlign: 'right' }]}>STATUS</Text>
                </View>

                {filteredLogs.length === 0 ? (
                  <View style={{ padding: 32, alignItems: 'center' }}>
                    <MaterialIcons name="search-off" size={32} color="#CBD5E1" />
                    <Text style={{ marginTop: 8, color: '#64748B', fontWeight: '600' }}>
                      No matching activity logs found.
                    </Text>
                  </View>
                ) : (
                  filteredLogs.map((log) => {
                    const badge = getCategoryBadge(log.category);
                    let formattedDate = 'Just now';
                    if (log.timestamp?.toDate) {
                      const d = log.timestamp.toDate();
                      formattedDate = `${d.toLocaleDateString([], { month: 'short', day: 'numeric' })} ${d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
                    }

                    return (
                      <View key={log.id} style={styles.tableRow}>
                        <Text style={[styles.td, { flex: 1.2, color: '#64748B', fontSize: 12 }]}>
                          {formattedDate}
                        </Text>
                        <View style={[styles.td, { flex: 1 }]}>
                          <View style={[styles.categoryBadge, { backgroundColor: badge.bg }]}>
                            <Text style={[styles.categoryBadgeText, { color: badge.color }]}>
                              {badge.label}
                            </Text>
                          </View>
                        </View>
                        <Text style={[styles.td, { flex: 1.5, fontWeight: '700', color: '#1E293B', fontSize: 12.5 }]} numberOfLines={1}>
                          {log.source}
                        </Text>
                        <View style={[styles.td, { flex: 2 }]}>
                          <Text style={{ fontSize: 13, color: '#334151', fontWeight: '600' }}>
                            {log.action}
                          </Text>
                          {log.details ? (
                            <Text style={{ fontSize: 11, color: '#94A3B8' }}>{log.details}</Text>
                          ) : null}
                        </View>
                        <View style={[styles.td, { flex: 1, alignItems: 'flex-end' }]}>
                          <View style={styles.verifiedBadge}>
                            <MaterialIcons name="check" size={10} color="#059669" />
                            <Text style={styles.verifiedBadgeText}>Logged</Text>
                          </View>
                        </View>
                      </View>
                    );
                  })
                )}
              </View>
            </ScrollView>
          </View>
        </View>

        {/* Right Column: Live Operational Telemetry Map */}
        <View style={[styles.rightColumn, isMobile && { flex: undefined, width: '100%' }]}>
          <View style={styles.sectionHeader}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <MaterialIcons name="map" size={16} color="#475569" />
              <Text style={styles.sectionTitle}>Live Telemetry Map</Text>
            </View>
            <Text style={styles.sectionCount}>{openReports.length} OPEN REPORTS</Text>
          </View>

          <View style={styles.mapContainer}>
            <LiveOperationsMap trucks={liveTrucks} reports={openReports} />
            <View style={styles.mapBadge}>
              <View style={styles.pulsingDot} />
              <Text style={styles.mapBadgeText}>
                {liveTrucks.filter((item) => item.active).length} ACTIVE TRUCK
                {liveTrucks.filter((item) => item.active).length === 1 ? '' : 'S'}
              </Text>
            </View>
            <View style={styles.riskCard}>
              <Text style={styles.riskTitle}>RISK HOTSPOTS</Text>
              {riskHotspots.length === 0 ? (
                <Text style={styles.noRisk}>No unresolved geotagged reports.</Text>
              ) : (
                riskHotspots.map(([barangay, count]) => (
                  <View style={styles.riskRow} key={barangay}>
                    <Text style={styles.riskBrgy}>{barangay}</Text>
                    <Text style={count >= 4 ? styles.riskHigh : styles.riskModerate}>
                      {count} OPEN &bull; {count >= 4 ? 'HIGH' : 'MONITOR'}
                    </Text>
                  </View>
                ))
              )}
            </View>
          </View>
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8FAFC', padding: 32 },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 },
  headerTextContainer: { flex: 1, paddingRight: 32 },
  headerTitle: { fontSize: 24, fontWeight: '900', color: '#0F172A', letterSpacing: -0.5 },
  headerDesc: { fontSize: 13.5, color: '#475569', lineHeight: 20, maxWidth: 640 },

  readOnlyBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#ECFDF5',
    borderWidth: 1,
    borderColor: '#A7F3D0',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  readOnlyBadgeText: { fontSize: 10, fontWeight: '800', color: '#047857', letterSpacing: 0.5 },

  exportTopBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#1B4D3E',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  exportTopBtnText: { color: '#FFFFFF', fontWeight: '800', fontSize: 13 },

  readOnlyNoticeBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#EFF6FF',
    borderWidth: 1,
    borderColor: '#BFDBFE',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginBottom: 20,
  },
  readOnlyNoticeText: { fontSize: 12.5, color: '#1E40AF', flex: 1, lineHeight: 18 },

  mainRow: { flexDirection: 'row', gap: 24, paddingBottom: 40 },
  leftColumn: { flex: 1.3, gap: 14 },
  rightColumn: { flex: 1 },

  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  sectionTitle: { fontSize: 14, fontWeight: '800', color: '#0F172A', letterSpacing: 0.2 },
  sectionCount: { fontSize: 11, fontWeight: '800', color: '#64748B', letterSpacing: 0.5 },

  dictManagedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#EEF2FF',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  dictManagedBadgeText: { fontSize: 10, fontWeight: '800', color: '#4338CA', letterSpacing: 0.5 },

  scenarioCard: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    alignItems: 'center',
  },
  scenarioCardActive: { borderColor: '#BBF7D0', backgroundColor: '#F0FDF4' },
  scenarioIconWrapper: {
    width: 38,
    height: 38,
    borderRadius: 8,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  scenarioIconWrapperActive: {
    width: 38,
    height: 38,
    borderRadius: 8,
    backgroundColor: '#1B4D3E',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  scenarioContent: { flex: 1 },
  scenarioTitle: { fontSize: 13, fontWeight: '800', color: '#0F172A', marginBottom: 4 },
  scenarioDetailsRow: { flexDirection: 'row', gap: 16 },
  scenarioDetailCol: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  scenarioLabel: { fontSize: 10, fontWeight: '700', color: '#64748B', letterSpacing: 0.5 },

  statusPill: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 4 },
  statusPillText: { fontSize: 10.5, fontWeight: '800' },

  searchFilterContainer: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 12,
    padding: 12,
    gap: 10,
  },
  searchInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  searchInput: { flex: 1, fontSize: 12.5, color: '#0F172A', padding: 0 },

  filterChipsRow: { gap: 6 },
  filterChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    backgroundColor: '#F1F5F9',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  filterChipActive: { backgroundColor: '#1B4D3E', borderColor: '#1B4D3E' },
  filterChipText: { fontSize: 11.5, fontWeight: '700', color: '#475569' },
  filterChipTextActive: { color: '#FFFFFF' },

  logCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 1,
  },
  tableHead: {
    flexDirection: 'row',
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
    marginBottom: 6,
  },
  th: { fontSize: 10.5, fontWeight: '800', color: '#64748B', letterSpacing: 0.5 },
  tableRow: {
    flexDirection: 'row',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#F8FAFC',
    alignItems: 'center',
  },
  td: { justifyContent: 'center' },

  categoryBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 4,
  },
  categoryBadgeText: { fontSize: 9.5, fontWeight: '800', letterSpacing: 0.5 },

  verifiedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: '#ECFDF5',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  verifiedBadgeText: { fontSize: 10, fontWeight: '700', color: '#059669' },

  mapContainer: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    minHeight: 560,
    overflow: 'hidden',
    position: 'relative',
    padding: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  mapBadge: {
    position: 'absolute',
    top: 20,
    left: 20,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 4,
  },
  pulsingDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#10B981' },
  mapBadgeText: { fontSize: 11, fontWeight: 'bold', color: '#0F172A', letterSpacing: 0.5 },

  riskCard: {
    position: 'absolute',
    bottom: 20,
    left: 20,
    right: 20,
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    padding: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 8,
  },
  riskTitle: { fontSize: 11, fontWeight: '800', color: '#64748B', letterSpacing: 0.5, marginBottom: 10 },
  riskRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  riskBrgy: { fontSize: 13, color: '#1E293B', fontWeight: '600' },
  riskHigh: { fontSize: 11.5, fontWeight: '800', color: '#EF4444' },
  riskModerate: { fontSize: 11.5, fontWeight: '800', color: '#059669' },
  noRisk: { color: '#64748B', fontSize: 12 },
});
