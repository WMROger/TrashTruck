import React, { useState, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Switch,
  Alert,
  ActivityIndicator,
  Modal,
  TextInput,
  useWindowDimensions,
  Platform,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { db, auth } from '../../../config/firebase';
import {
  doc,
  collection,
  onSnapshot,
  setDoc,
  addDoc,
  serverTimestamp,
} from 'firebase/firestore';
import LiveOperationsMap, { LiveMapReport, LiveMapTruck } from './LiveOperationsMap';

interface OperationalOverridesTabProps {
  onNavigateToLogs?: () => void;
}

export default function OperationalOverridesTab({ onNavigateToLogs }: OperationalOverridesTabProps) {
  const { width } = useWindowDimensions();
  const isMobile = width < 768;

  const [settings, setSettings] = useState<{
    forcePauseCollection: boolean;
    activateBackupFleet: boolean;
    severeWeatherProtocol?: boolean;
    surgePriorityMode?: boolean;
    updatedAt?: any;
    updatedBy?: string;
  }>({
    forcePauseCollection: false,
    activateBackupFleet: true,
    severeWeatherProtocol: false,
    surgePriorityMode: false,
  });

  const [isUpdating, setIsUpdating] = useState<string | null>(null);
  const [liveTrucks, setLiveTrucks] = useState<LiveMapTruck[]>([]);
  const [openReports, setOpenReports] = useState<(LiveMapReport & { barangay: string })[]>([]);
  const [recentLogs, setRecentLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Emergency Broadcast Modal
  const [broadcastModalVisible, setBroadcastModalVisible] = useState(false);
  const [broadcastSubject, setBroadcastSubject] = useState('');
  const [broadcastMessage, setBroadcastMessage] = useState('');
  const [broadcastPriority, setBroadcastPriority] = useState<'high' | 'urgent'>('urgent');
  const [isBroadcasting, setIsBroadcasting] = useState(false);

  useEffect(() => {
    if (!db) {
      setLoading(false);
      return;
    }

    // 1. Listen to system settings overrides in real-time
    const docRef = doc(db, 'system_settings', 'overrides');
    const unsubDoc = onSnapshot(
      docRef,
      (snap) => {
        if (snap.exists()) {
          const data = snap.data();
          setSettings({
            forcePauseCollection: Boolean(data.forcePauseCollection),
            activateBackupFleet: data.activateBackupFleet !== undefined ? Boolean(data.activateBackupFleet) : true,
            severeWeatherProtocol: Boolean(data.severeWeatherProtocol),
            surgePriorityMode: Boolean(data.surgePriorityMode),
            updatedAt: data.updatedAt,
            updatedBy: data.updatedBy,
          });
        }
        setLoading(false);
      },
      (error) => {
        console.error('Error listening to system_settings:', error);
        setLoading(false);
      }
    );

    // 2. Listen to recent override activity logs
    const logsRef = collection(db, 'system_settings', 'overrides', 'activity_logs');
    const unsubLogs = onSnapshot(
      logsRef,
      (snap) => {
        const fetched = snap.docs.map((d) => ({
          id: d.id,
          ...d.data(),
        }));
        fetched.sort((a: any, b: any) => {
          const timeA = a.timestamp?.toMillis ? a.timestamp.toMillis() : (a.timestamp instanceof Date ? a.timestamp.getTime() : 0);
          const timeB = b.timestamp?.toMillis ? b.timestamp.toMillis() : (b.timestamp instanceof Date ? b.timestamp.getTime() : 0);
          return timeB - timeA;
        });
        setRecentLogs(fetched.slice(0, 5));
      },
      (error) => console.error('Error fetching override activity logs:', error)
    );

    // 3. Listen to Trucks & Live Locations
    let truckPlatesMap: Record<string, string> = {};
    const unsubTrucks = onSnapshot(collection(db, 'trucks'), (snap) => {
      const map: Record<string, string> = {};
      snap.forEach((d) => {
        const data = d.data();
        if (data.plateNumber) {
          map[d.id] = data.plateNumber;
        }
      });
      truckPlatesMap = map;
      setLiveTrucks((prev) =>
        prev.map((t) => ({
          ...t,
          label: truckPlatesMap[t.id] || truckPlatesMap[t.label] || t.label,
        }))
      );
    });

    const unsubLocations = onSnapshot(
      collection(db, 'truck_locations'),
      (snapshot) => {
        setLiveTrucks(
          snapshot.docs
            .map((item) => {
              const data = item.data();
              const rawTruckId = String(data.truckId || item.id);
              const plate = truckPlatesMap[rawTruckId] || truckPlatesMap[item.id] || rawTruckId;
              return {
                id: item.id,
                latitude: Number(data.lat ?? data.latitude),
                longitude: Number(data.lng ?? data.longitude),
                label: plate,
                active: String(data.status || '').toLowerCase() === 'active',
              };
            })
            .filter((item) => Number.isFinite(item.latitude) && Number.isFinite(item.longitude))
        );
      },
      (error) => console.error('Error fetching live truck locations:', error)
    );

    // 4. Listen to Reports
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
      unsubTrucks();
      unsubLocations();
      unsubReports();
    };
  }, []);

  const riskHotspots = useMemo(() => {
    const counts = openReports.reduce<Record<string, number>>((result, report) => {
      result[report.barangay] = (result[report.barangay] || 0) + 1;
      return result;
    }, {});
    return Object.entries(counts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3);
  }, [openReports]);

  // Handle Interactive System Override Switch Toggle
  const handleToggleSetting = async (key: 'forcePauseCollection' | 'activateBackupFleet' | 'severeWeatherProtocol' | 'surgePriorityMode', newValue: boolean) => {
    if (!db) return;
    setIsUpdating(key);
    const actorEmail = auth.currentUser?.email || 'CENRO Administrator';
    const actorUid = auth.currentUser?.uid || 'cenro-admin';

    const labels: Record<string, string> = {
      forcePauseCollection: newValue ? 'Collection Force-Paused' : 'Collection Resumed Normal Operation',
      activateBackupFleet: newValue ? 'Backup Fleet Activated' : 'Backup Fleet Standby',
      severeWeatherProtocol: newValue ? 'Severe Weather Protocol Enabled' : 'Severe Weather Protocol Deactivated',
      surgePriorityMode: newValue ? 'Surge Dumpsite Priority Enabled' : 'Standard Routing Restored',
    };

    const newSettings = {
      ...settings,
      [key]: newValue,
      updatedAt: serverTimestamp(),
      updatedBy: actorEmail,
      updatedByUid: actorUid,
    };

    try {
      // 1. Update Firestore settings
      const docRef = doc(db, 'system_settings', 'overrides');
      await setDoc(docRef, newSettings, { merge: true });

      // 2. Log in overrides activity_logs
      await addDoc(collection(db, 'system_settings', 'overrides', 'activity_logs'), {
        source: actorEmail,
        action: labels[key] || `Override ${key} set to ${newValue}`,
        timestamp: serverTimestamp(),
        confidence: 'Manual Override',
        details: `CENRO command updated protocol state for ${key}.`,
      });

      // 3. Log in client_activity
      try {
        await addDoc(collection(db, 'client_activity'), {
          event: `override.${key}`,
          targetType: 'system_settings',
          targetId: 'overrides',
          actorUid,
          actorEmail,
          metadata: {
            setting: key,
            value: newValue,
            label: labels[key],
          },
          createdAt: serverTimestamp(),
        });
      } catch {}
    } catch (err: any) {
      console.error('Error updating system override:', err);
      Alert.alert('Update Failed', err?.message || 'Could not update system override.');
    } finally {
      setIsUpdating(null);
    }
  };

  // Handle Emergency Broadcast
  const handleSendBroadcast = async () => {
    const message = broadcastMessage.trim();
    const subject = broadcastSubject.trim() || (broadcastPriority === 'urgent' ? '🚨 EMERGENCY DISPATCH DIRECTIVE' : '⚡ PRIORITY WEATHER ADVISORY');

    if (!message) {
      Alert.alert('Validation Error', 'Please enter an emergency broadcast message.');
      return;
    }

    if (!db) return;
    setIsBroadcasting(true);

    try {
      const actorEmail = auth.currentUser?.email || 'cenro@trashtrack.gov.ph';
      const actorUid = auth.currentUser?.uid || 'cenro-admin';
      const actorName = auth.currentUser?.displayName || 'CENRO Administrator';

      // 1. Broadcast to interagency_messages
      await addDoc(collection(db, 'interagency_messages'), {
        subject,
        message,
        priority: broadcastPriority,
        channelId: 'urgent-advisories',
        senderUid: actorUid,
        senderName: actorName,
        senderEmail: actorEmail,
        senderRole: 'cenro',
        status: 'sent',
        deliveryMode: 'spark-firestore',
        createdAt: serverTimestamp(),
      });

      // 2. Broadcast to municipal announcements
      try {
        await addDoc(collection(db, 'announcements'), {
          title: subject,
          content: message,
          priority: broadcastPriority,
          author: actorName,
          authorEmail: actorEmail,
          authorRole: 'CENRO Administrator',
          createdAt: serverTimestamp(),
        });
      } catch {}

      // 3. Log in activity
      try {
        await addDoc(collection(db, 'client_activity'), {
          event: 'emergency.broadcast',
          targetType: 'fleet_broadcast',
          actorUid,
          actorEmail,
          metadata: { subject, priority: broadcastPriority },
          createdAt: serverTimestamp(),
        });
      } catch {}

      setBroadcastModalVisible(false);
      setBroadcastSubject('');
      setBroadcastMessage('');
      Alert.alert('Broadcast Dispatched', 'Emergency directive successfully transmitted to all active trucks and environmental coordinators.');
    } catch (err: any) {
      console.error('Error sending broadcast:', err);
      Alert.alert('Broadcast Failed', err?.message || 'Could not dispatch emergency broadcast.');
    } finally {
      setIsBroadcasting(false);
    }
  };

  if (loading) {
    return (
      <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator size="large" color="#1B4D3E" />
        <Text style={{ marginTop: 12, color: '#6B7280', fontSize: 13, fontWeight: '600' }}>Synchronizing system controls...</Text>
      </View>
    );
  }

  return (
    <ScrollView style={[styles.container, isMobile && { padding: 16 }]} showsVerticalScrollIndicator={false}>
      {/* Header Row */}
      <View style={[styles.headerRow, isMobile && { flexDirection: 'column', gap: 12, marginBottom: 20 }]}>
        <View style={[styles.headerTextContainer, isMobile && { paddingRight: 0 }]}>
          <Text style={styles.headerTitle}>Operational Overrides</Text>
          <Text style={styles.headerDesc}>
            Configure emergency responses, pause fleet dispatches, and trigger operational contingency protocols based on real-time environmental hazards and logistical disruptions.
          </Text>
        </View>

        <TouchableOpacity
          style={styles.dangerBtn}
          onPress={() => setBroadcastModalVisible(true)}
          activeOpacity={0.85}
        >
          <MaterialIcons name="emergency" size={18} color="#FFFFFF" />
          <Text style={styles.dangerBtnText}>Emergency Broadcast</Text>
        </TouchableOpacity>
      </View>

      <View style={[styles.mainRow, isMobile && { flexDirection: 'column', gap: 24 }]}>
        {/* Left Column - Active Scenarios & Interactive Controls */}
        <View style={[styles.leftColumn, isMobile && { flex: undefined, width: '100%' }]}>

          {/* Section: Active Scenarios */}
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Active Scenarios & Protocols</Text>
            <Text style={styles.sectionCount}>
              {openReports.length} GEOTAGGED REPORT{openReports.length === 1 ? '' : 'S'}
            </Text>
          </View>

          {/* Scenario 1: Heavy Rainfall Protocol */}
          <View style={[styles.scenarioCard, settings.severeWeatherProtocol && styles.scenarioCardActive]}>
            <View style={settings.severeWeatherProtocol ? styles.scenarioIconWrapperActive : styles.scenarioIconWrapper}>
              <MaterialIcons name="water-drop" size={22} color={settings.severeWeatherProtocol ? '#FFFFFF' : '#0284C7'} />
            </View>
            <View style={styles.scenarioContent}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                <Text style={styles.scenarioTitle}>Heavy Rainfall & Flood Protocol</Text>
                {settings.severeWeatherProtocol && <View style={styles.activeDot} />}
              </View>
              <View style={styles.scenarioDetailsRow}>
                <View style={styles.scenarioDetailCol}>
                  <Text style={styles.scenarioLabel}>TRIGGER CAUSE</Text>
                  <Text style={styles.scenarioValue}>PAGASA Weather Warning / Flood Watch</Text>
                </View>
                <View style={styles.scenarioDetailCol}>
                  <Text style={styles.scenarioLabel}>OPERATIONAL IMPACT</Text>
                  <Text style={styles.scenarioValue}>
                    {settings.severeWeatherProtocol ? 'Bypass low-elevation flood corridors' : 'Standard route adherence active'}
                  </Text>
                </View>
              </View>
            </View>
          </View>

          {/* Scenario 2: Collection Pause State */}
          <View style={[styles.scenarioCard, settings.forcePauseCollection && styles.scenarioCardAlert]}>
            <View style={settings.forcePauseCollection ? styles.scenarioIconWrapperAlert : styles.scenarioIconWrapper}>
              <MaterialIcons name="pause-circle-outline" size={22} color={settings.forcePauseCollection ? '#FFFFFF' : '#64748B'} />
            </View>
            <View style={styles.scenarioContent}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                <Text style={styles.scenarioTitle}>Fleet Collection Pause</Text>
                {settings.forcePauseCollection && <View style={[styles.activeDot, { backgroundColor: '#EF4444' }]} />}
              </View>
              <View style={styles.scenarioDetailsRow}>
                <View style={styles.scenarioDetailCol}>
                  <Text style={styles.scenarioLabel}>STATUS</Text>
                  <Text style={[styles.scenarioValue, { fontWeight: '700', color: settings.forcePauseCollection ? '#DC2626' : '#059669' }]}>
                    {settings.forcePauseCollection ? 'DISPATCH PAUSED' : 'NORMAL DISPATCH'}
                  </Text>
                </View>
                <View style={styles.scenarioDetailCol}>
                  <Text style={styles.scenarioLabel}>IMPLICATION</Text>
                  <Text style={styles.scenarioValue}>
                    {settings.forcePauseCollection ? 'Drivers standby at depot until resumed' : 'Trucks actively executing routes'}
                  </Text>
                </View>
              </View>
            </View>
          </View>

          {/* Section: Interactive System Controls */}
          <View style={[styles.sectionHeader, { marginTop: 12 }]}>
            <Text style={styles.sectionTitle}>System Override Controls</Text>
            <Text style={styles.sectionCount}>INSTANT PERSISTENCE</Text>
          </View>

          <View style={styles.controlsCard}>
            {/* Control 1: Force Pause Collection */}
            <View style={styles.controlRow}>
              <View style={styles.controlLeft}>
                <View style={[styles.controlIconBox, { backgroundColor: settings.forcePauseCollection ? '#FEE2E2' : '#F1F5F9' }]}>
                  <MaterialIcons name="pause-circle-filled" size={22} color={settings.forcePauseCollection ? '#DC2626' : '#475569'} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.controlText}>Force Pause Collection</Text>
                  <Text style={styles.controlSubtext}>Immediately pause all active municipal truck dispatches.</Text>
                </View>
              </View>
              {isUpdating === 'forcePauseCollection' ? (
                <ActivityIndicator size="small" color="#DC2626" />
              ) : (
                <Switch
                  value={settings.forcePauseCollection}
                  onValueChange={(val) => handleToggleSetting('forcePauseCollection', val)}
                  trackColor={{ false: '#E2E8F0', true: '#DC2626' }}
                  thumbColor={Platform.OS === 'web' ? '#FFFFFF' : (settings.forcePauseCollection ? '#FFFFFF' : '#F8FAFC')}
                />
              )}
            </View>

            <View style={styles.divider} />

            {/* Control 2: Activate Backup Fleet */}
            <View style={styles.controlRow}>
              <View style={styles.controlLeft}>
                <View style={[styles.controlIconBox, { backgroundColor: settings.activateBackupFleet ? '#DCFCE7' : '#F1F5F9' }]}>
                  <MaterialIcons name="local-shipping" size={22} color={settings.activateBackupFleet ? '#15803D' : '#475569'} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.controlText}>Activate Backup Fleet</Text>
                  <Text style={styles.controlSubtext}>Mobilize reserve compactor units and standby driver shifts.</Text>
                </View>
              </View>
              {isUpdating === 'activateBackupFleet' ? (
                <ActivityIndicator size="small" color="#15803D" />
              ) : (
                <Switch
                  value={settings.activateBackupFleet}
                  onValueChange={(val) => handleToggleSetting('activateBackupFleet', val)}
                  trackColor={{ false: '#E2E8F0', true: '#1B4D3E' }}
                  thumbColor={Platform.OS === 'web' ? '#FFFFFF' : (settings.activateBackupFleet ? '#FFFFFF' : '#F8FAFC')}
                />
              )}
            </View>

            <View style={styles.divider} />

            {/* Control 3: Severe Weather Protocol */}
            <View style={styles.controlRow}>
              <View style={styles.controlLeft}>
                <View style={[styles.controlIconBox, { backgroundColor: settings.severeWeatherProtocol ? '#E0F2FE' : '#F1F5F9' }]}>
                  <MaterialIcons name="thunderstorm" size={22} color={settings.severeWeatherProtocol ? '#0284C7' : '#475569'} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.controlText}>Severe Weather Emergency Routing</Text>
                  <Text style={styles.controlSubtext}>Allow trucks to bypass flooded lowlands and switch to elevated collector streets.</Text>
                </View>
              </View>
              {isUpdating === 'severeWeatherProtocol' ? (
                <ActivityIndicator size="small" color="#0284C7" />
              ) : (
                <Switch
                  value={Boolean(settings.severeWeatherProtocol)}
                  onValueChange={(val) => handleToggleSetting('severeWeatherProtocol', val)}
                  trackColor={{ false: '#E2E8F0', true: '#0284C7' }}
                  thumbColor={Platform.OS === 'web' ? '#FFFFFF' : '#FFFFFF'}
                />
              )}
            </View>

            <View style={styles.divider} />

            {/* Control 4: Surge Priority Mode */}
            <View style={styles.controlRow}>
              <View style={styles.controlLeft}>
                <View style={[styles.controlIconBox, { backgroundColor: settings.surgePriorityMode ? '#FEF3C7' : '#F1F5F9' }]}>
                  <MaterialIcons name="speed" size={22} color={settings.surgePriorityMode ? '#D97706' : '#475569'} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.controlText}>Overload Surge Priority</Text>
                  <Text style={styles.controlSubtext}>Prioritize high-tonnage barangay hubs and fast-track MRF unloading.</Text>
                </View>
              </View>
              {isUpdating === 'surgePriorityMode' ? (
                <ActivityIndicator size="small" color="#D97706" />
              ) : (
                <Switch
                  value={Boolean(settings.surgePriorityMode)}
                  onValueChange={(val) => handleToggleSetting('surgePriorityMode', val)}
                  trackColor={{ false: '#E2E8F0', true: '#D97706' }}
                  thumbColor={Platform.OS === 'web' ? '#FFFFFF' : '#FFFFFF'}
                />
              )}
            </View>
          </View>

          {/* Recent Override Log Snippet */}
          <View style={[styles.sectionHeader, { marginTop: 16 }]}>
            <Text style={styles.sectionTitle}>Recent Override Activity</Text>
            {onNavigateToLogs && (
              <TouchableOpacity onPress={onNavigateToLogs}>
                <Text style={styles.viewAllText}>View All Logs →</Text>
              </TouchableOpacity>
            )}
          </View>

          <View style={styles.logCard}>
            <View style={styles.tableHead}>
              <Text style={[styles.th, { flex: 1.5 }]}>SOURCE</Text>
              <Text style={[styles.th, { flex: 2 }]}>ACTION</Text>
              <Text style={[styles.th, { flex: 1, textAlign: 'right' }]}>CONFIDENCE</Text>
            </View>

            {recentLogs.length === 0 ? (
              <View style={{ padding: 18, alignItems: 'center' }}>
                <Text style={{ color: '#94A3B8', fontSize: 12 }}>No override events logged recently.</Text>
              </View>
            ) : (
              recentLogs.map((row) => (
                <View key={row.id} style={styles.tableRow}>
                  <Text style={[styles.td, { flex: 1.5, color: '#475569', fontWeight: '600' }]} numberOfLines={1}>
                    {row.source}
                  </Text>
                  <Text style={[styles.td, { flex: 2, color: '#0F172A', fontWeight: '600' }]} numberOfLines={1}>
                    {row.action}
                  </Text>
                  <Text style={[styles.td, { flex: 1, color: '#059669', fontWeight: '700', textAlign: 'right' }]}>
                    {row.confidence || 'Manual'}
                  </Text>
                </View>
              ))
            )}
          </View>
        </View>

        {/* Right Column - Live Telemetry & Risk Map */}
        <View style={[styles.rightColumn, isMobile && { flex: undefined, width: '100%' }]}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Live Impact & Telemetry View</Text>
            <Text style={styles.sectionCount}>
              {liveTrucks.filter((t) => t.active).length} TRUCKS ONLINE
            </Text>
          </View>

          <View style={styles.mapContainer}>
            <LiveOperationsMap trucks={liveTrucks} reports={openReports} />

            <View style={styles.mapBadge}>
              <View style={styles.pulsingDot} />
              <Text style={styles.mapBadgeText}>
                {liveTrucks.filter((item) => item.active).length} ACTIVE TRUCK{liveTrucks.filter((item) => item.active).length === 1 ? '' : 'S'}
              </Text>
            </View>

            {/* Risk Hotspots Overlay */}
            <View style={styles.riskCard}>
              <Text style={styles.riskTitle}>RISK HOTSPOTS & CITIZEN REPORTS</Text>
              {riskHotspots.length === 0 ? (
                <Text style={styles.noRisk}>No active high-risk report clusters.</Text>
              ) : (
                riskHotspots.map(([barangay, count]) => (
                  <View style={styles.riskRow} key={barangay}>
                    <Text style={styles.riskBrgy}>{barangay}</Text>
                    <Text style={count >= 4 ? styles.riskHigh : styles.riskModerate}>
                      {count} OPEN · {count >= 4 ? 'HIGH RISK' : 'MONITOR'}
                    </Text>
                  </View>
                ))
              )}
            </View>
          </View>
        </View>
      </View>

      {/* EMERGENCY BROADCAST MODAL */}
      <Modal visible={broadcastModalVisible} transparent={true} animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, isMobile && { width: '95%', padding: 18 }]}>
            <View style={styles.modalHeader}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                <View style={styles.modalIconBox}>
                  <MaterialIcons name="emergency" size={24} color="#EF4444" />
                </View>
                <View>
                  <Text style={styles.modalTitle}>Emergency Broadcast</Text>
                  <Text style={styles.modalSubtitle}>Dispatch immediate priority alert to municipal units.</Text>
                </View>
              </View>
              <TouchableOpacity onPress={() => setBroadcastModalVisible(false)} style={styles.modalCloseBtn}>
                <MaterialIcons name="close" size={20} color="#64748B" />
              </TouchableOpacity>
            </View>

            <View style={styles.modalBody}>
              <View style={styles.formGroup}>
                <Text style={styles.formLabel}>PRIORITY LEVEL</Text>
                <View style={styles.prioritySelector}>
                  <TouchableOpacity
                    style={[styles.priorityPill, broadcastPriority === 'high' && styles.priorityPillHighActive]}
                    onPress={() => setBroadcastPriority('high')}
                  >
                    <MaterialIcons name="bolt" size={14} color={broadcastPriority === 'high' ? '#B45309' : '#64748B'} />
                    <Text style={[styles.priorityPillText, broadcastPriority === 'high' && { color: '#B45309', fontWeight: '800' }]}>HIGH PRIORITY</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[styles.priorityPill, broadcastPriority === 'urgent' && styles.priorityPillUrgentActive]}
                    onPress={() => setBroadcastPriority('urgent')}
                  >
                    <MaterialIcons name="warning" size={14} color={broadcastPriority === 'urgent' ? '#DC2626' : '#64748B'} />
                    <Text style={[styles.priorityPillText, broadcastPriority === 'urgent' && { color: '#DC2626', fontWeight: '800' }]}>URGENT CALAMITY</Text>
                  </TouchableOpacity>
                </View>
              </View>

              <View style={styles.formGroup}>
                <Text style={styles.formLabel}>DIRECTIVE SUBJECT</Text>
                <TextInput
                  style={styles.formInput}
                  placeholder="e.g. FLASH FLOOD: Reroute Trucks from Lowland Corridors"
                  placeholderTextColor="#94A3B8"
                  value={broadcastSubject}
                  onChangeText={setBroadcastSubject}
                />
              </View>

              <View style={styles.formGroup}>
                <Text style={styles.formLabel}>DIRECTIVE MESSAGE</Text>
                <TextInput
                  style={[styles.formInput, { height: 100, textAlignVertical: 'top' }]}
                  placeholder="Enter detailed directives for drivers and field coordinators..."
                  placeholderTextColor="#94A3B8"
                  multiline={true}
                  numberOfLines={4}
                  value={broadcastMessage}
                  onChangeText={setBroadcastMessage}
                />
              </View>
            </View>

            <View style={styles.modalFooter}>
              <TouchableOpacity
                style={styles.modalCancelBtn}
                onPress={() => setBroadcastModalVisible(false)}
                disabled={isBroadcasting}
              >
                <Text style={styles.modalCancelBtnText}>Cancel</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.modalSendBtn}
                onPress={handleSendBroadcast}
                disabled={isBroadcasting}
                activeOpacity={0.85}
              >
                {isBroadcasting ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <>
                    <MaterialIcons name="send" size={16} color="#FFFFFF" />
                    <Text style={styles.modalSendBtnText}>Transmit Broadcast</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
    padding: 24,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 24,
  },
  headerTextContainer: {
    flex: 1,
    paddingRight: 24,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: '800',
    color: '#0F172A',
    letterSpacing: -0.5,
  },
  headerDesc: {
    fontSize: 13,
    color: '#64748B',
    lineHeight: 20,
    maxWidth: 700,
    marginTop: 4,
  },
  dangerBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#EF4444',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
    shadowColor: '#EF4444',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
  },
  dangerBtnText: {
    color: '#FFFFFF',
    fontWeight: '800',
    fontSize: 13,
  },
  mainRow: {
    flexDirection: 'row',
    gap: 24,
    paddingBottom: 40,
  },
  leftColumn: {
    flex: 1.25,
    gap: 14,
  },
  rightColumn: {
    flex: 1,
    gap: 14,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#1E293B',
  },
  sectionCount: {
    fontSize: 10,
    fontWeight: '800',
    color: '#64748B',
    letterSpacing: 0.5,
  },
  viewAllText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#1B4D3E',
  },
  scenarioCard: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 3,
    elevation: 1,
  },
  scenarioCardActive: {
    borderColor: '#7DD3FC',
    backgroundColor: '#F0F9FF',
  },
  scenarioCardAlert: {
    borderColor: '#FECACA',
    backgroundColor: '#FEF2F2',
  },
  scenarioIconWrapper: {
    width: 44,
    height: 44,
    borderRadius: 10,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  scenarioIconWrapperActive: {
    width: 44,
    height: 44,
    borderRadius: 10,
    backgroundColor: '#0284C7',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  scenarioIconWrapperAlert: {
    width: 44,
    height: 44,
    borderRadius: 10,
    backgroundColor: '#EF4444',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  scenarioContent: {
    flex: 1,
  },
  scenarioTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0F172A',
    marginBottom: 8,
  },
  scenarioDetailsRow: {
    flexDirection: 'row',
    gap: 16,
  },
  scenarioDetailCol: {
    flex: 1,
  },
  scenarioLabel: {
    fontSize: 9,
    fontWeight: '800',
    color: '#64748B',
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  scenarioValue: {
    fontSize: 12,
    color: '#334155',
  },
  activeDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#0284C7',
  },
  controlsCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 6,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 3,
    elevation: 1,
  },
  controlRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 12,
  },
  controlLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
    paddingRight: 12,
  },
  controlIconBox: {
    width: 36,
    height: 36,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  controlText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0F172A',
  },
  controlSubtext: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 2,
  },
  divider: {
    height: 1,
    backgroundColor: '#F1F5F9',
    marginHorizontal: 12,
  },
  logCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  tableHead: {
    flexDirection: 'row',
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
    marginBottom: 4,
  },
  th: {
    fontSize: 9,
    fontWeight: '800',
    color: '#64748B',
    letterSpacing: 0.5,
  },
  tableRow: {
    flexDirection: 'row',
    paddingVertical: 9,
    borderBottomWidth: 1,
    borderBottomColor: '#F8FAFC',
    alignItems: 'center',
  },
  td: {
    fontSize: 12,
  },
  mapContainer: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    minHeight: 520,
    overflow: 'hidden',
    position: 'relative',
    padding: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  mapBadge: {
    position: 'absolute',
    top: 20,
    left: 20,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 20,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  pulsingDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
    backgroundColor: '#10B981',
  },
  mapBadgeText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#1E293B',
    letterSpacing: 0.5,
  },
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
    shadowRadius: 6,
    elevation: 4,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  riskTitle: {
    fontSize: 10,
    fontWeight: '800',
    color: '#64748B',
    letterSpacing: 0.6,
    marginBottom: 10,
  },
  riskRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  riskBrgy: {
    fontSize: 13,
    color: '#1E293B',
    fontWeight: '600',
  },
  riskHigh: {
    fontSize: 11,
    fontWeight: '800',
    color: '#EF4444',
  },
  riskModerate: {
    fontSize: 11,
    fontWeight: '700',
    color: '#059669',
  },
  noRisk: {
    color: '#94A3B8',
    fontSize: 12,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  modalContent: {
    width: 520,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.2,
    shadowRadius: 20,
    elevation: 20,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 18,
  },
  modalIconBox: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: '#FEE2E2',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: '#0F172A',
  },
  modalSubtitle: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 1,
  },
  modalCloseBtn: {
    padding: 6,
  },
  modalBody: {
    gap: 14,
  },
  formGroup: {
    gap: 6,
  },
  formLabel: {
    fontSize: 10,
    fontWeight: '800',
    color: '#475569',
    letterSpacing: 0.6,
  },
  formInput: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 13,
    color: '#0F172A',
  },
  prioritySelector: {
    flexDirection: 'row',
    gap: 10,
  },
  priorityPill: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 9,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    backgroundColor: '#F8FAFC',
  },
  priorityPillHighActive: {
    backgroundColor: '#FEF3C7',
    borderColor: '#FDE68A',
  },
  priorityPillUrgentActive: {
    backgroundColor: '#FEE2E2',
    borderColor: '#FECACA',
  },
  priorityPillText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#64748B',
  },
  modalFooter: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 10,
    marginTop: 20,
    paddingTop: 14,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
  },
  modalCancelBtn: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  modalCancelBtnText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#64748B',
  },
  modalSendBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#EF4444',
    paddingVertical: 10,
    paddingHorizontal: 18,
    borderRadius: 8,
  },
  modalSendBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#FFFFFF',
  },
});
