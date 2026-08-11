import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Switch, Alert, ActivityIndicator, Platform } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { db, auth } from '../../../config/firebase';
import { doc, getDoc, setDoc, collection, addDoc, onSnapshot, query, orderBy, limit, serverTimestamp } from 'firebase/firestore';

export default function OperationalOverridesTab() {
  const [settings, setSettings] = useState({
    forcePauseCollection: false,
    activateBackupFleet: true,
  });
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Listen to overrides doc
    const docRef = doc(db, 'system_settings', 'overrides');
    const unsubDoc = onSnapshot(docRef, (snap) => {
      if (snap.exists()) {
        setSettings(snap.data() as any);
      } else {
        // Initialize if not exists
        setDoc(docRef, settings).catch(e => console.error("Error init settings:", e));
      }
      setLoading(false);
    }, (error) => {
      console.error("Error fetching system_settings:", error);
      setLoading(false);
    });

    // Listen to activity logs
    const logsRef = collection(db, 'system_settings', 'overrides', 'activity_logs');
    const qLogs = query(logsRef, orderBy('timestamp', 'desc'), limit(10));
    const unsubLogs = onSnapshot(qLogs, (snap) => {
      const fetchedLogs = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      setLogs(fetchedLogs);
    }, (error) => {
      console.error("Error fetching activity_logs:", error);
    });

    return () => {
      unsubDoc();
      unsubLogs();
    };
  }, []);

  const handleToggle = async (key: string, value: boolean) => {
    // Optimistic update
    setSettings(prev => ({ ...prev, [key]: value }));
    
    try {
      await setDoc(doc(db, 'system_settings', 'overrides'), { [key]: value }, { merge: true });
      
      // Add log
      const logsRef = collection(db, 'system_settings', 'overrides', 'activity_logs');
      await addDoc(logsRef, {
        timestamp: serverTimestamp(),
        source: auth.currentUser?.email || 'Admin',
        action: `${key === 'forcePauseCollection' ? 'Force Pause Collection' : 'Backup Fleet'} turned ${value ? 'ON' : 'OFF'}`,
        confidence: 'Manual'
      });
    } catch (err) {
      console.error('Error toggling override:', err);
      Alert.alert('Error', 'Failed to update system setting.');
    }
  };

  const handleEmergencyBroadcast = async () => {
    const executeBroadcast = async () => {
      try {
        await addDoc(collection(db, 'announcements'), {
          title: "EMERGENCY ALERT: System Override",
          description: "Waste collection services are experiencing a major disruption. Please secure your waste bins and wait for further instructions.",
          priority: "High",
          category: "Alert",
          isPublished: true,
          createdAt: serverTimestamp(),
          createdBy: auth.currentUser?.email || 'Admin'
        });

        // Add log
        const logsRef = collection(db, 'system_settings', 'overrides', 'activity_logs');
        await addDoc(logsRef, {
          timestamp: serverTimestamp(),
          source: auth.currentUser?.email || 'Admin',
          action: `Emergency Broadcast Sent`,
          confidence: 'Manual'
        });

        if (Platform.OS === 'web') {
          window.alert("Emergency broadcast sent.");
        } else {
          Alert.alert("Success", "Emergency broadcast sent.");
        }
      } catch (err) {
        console.error("Broadcast error:", err);
        if (Platform.OS === 'web') {
          window.alert("Failed to send broadcast.");
        } else {
          Alert.alert("Error", "Failed to send broadcast.");
        }
      }
    };

    if (Platform.OS === 'web') {
      const confirmed = window.confirm("Emergency Broadcast: Send an urgent push announcement to all residents?");
      if (confirmed) {
        executeBroadcast();
      }
    } else {
      Alert.alert(
        "Emergency Broadcast",
        "Send an urgent push announcement to all residents?",
        [
          { text: "Cancel", style: "cancel" },
          { 
            text: "Send Now", 
            style: "destructive",
            onPress: executeBroadcast
          }
        ]
      );
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
    <ScrollView style={styles.container}>
      <View style={styles.headerRow}>
        <View style={styles.headerTextContainer}>
          <Text style={styles.headerTitle}>Operational Overrides</Text>
          <Text style={styles.headerDesc}>
            Configure emergency responses based on real-time environmental hazards and logistical obstructions.
          </Text>
        </View>
        <TouchableOpacity style={styles.dangerBtn} onPress={handleEmergencyBroadcast}>
          <MaterialIcons name="emergency" size={18} color="#fff" />
          <Text style={styles.dangerBtnText}>Emergency Broadcast</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.mainRow}>
        {/* Left Column - Controls & Logs */}
        <View style={styles.leftColumn}>
          
          {/* Active Scenarios */}
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Active Scenarios</Text>
            <Text style={styles.sectionCount}>2 EVENTS DETECTED</Text>
          </View>

          <View style={[styles.scenarioCard, styles.scenarioCardActive]}>
            <View style={styles.scenarioIconWrapperActive}>
              <MaterialIcons name="water-drop" size={20} color="#fff" />
            </View>
            <View style={styles.scenarioContent}>
              <Text style={styles.scenarioTitle}>Heavy Rainfall Protocol</Text>
              <View style={styles.scenarioDetailsRow}>
                <View style={styles.scenarioDetailCol}>
                  <Text style={styles.scenarioLabel}>CAUSE</Text>
                  <Text style={styles.scenarioValue}>Typhoon Signal #2 Alert</Text>
                </View>
                <View style={styles.scenarioDetailCol}>
                  <Text style={styles.scenarioLabel}>IMPLICATION</Text>
                  <Text style={styles.scenarioValue}>40% Route Delay Risk</Text>
                </View>
              </View>
            </View>
            <View style={styles.activeDot} />
          </View>

          <View style={styles.scenarioCard}>
            <View style={styles.scenarioIconWrapper}>
              <MaterialIcons name="do-not-disturb" size={20} color="#6B7280" />
            </View>
            <View style={styles.scenarioContent}>
              <Text style={styles.scenarioTitle}>Major Road Closure</Text>
              <View style={styles.scenarioDetailsRow}>
                <View style={styles.scenarioDetailCol}>
                  <Text style={styles.scenarioLabel}>CAUSE</Text>
                  <Text style={styles.scenarioValue}>Mainline Obstruction</Text>
                </View>
                <View style={styles.scenarioDetailCol}>
                  <Text style={styles.scenarioLabel}>IMPLICATION</Text>
                  <Text style={styles.scenarioValue}>Route Diversion Required</Text>
                </View>
              </View>
            </View>
          </View>

          {/* System Controls */}
          <Text style={[styles.sectionTitle, { marginTop: 16 }]}>System Controls</Text>
          <View style={styles.controlsCard}>
            <View style={styles.controlRow}>
              <View style={styles.controlLeft}>
                <MaterialIcons name="pause-circle-outline" size={20} color="#374151" />
                <Text style={styles.controlText}>Force Pause Collection</Text>
              </View>
              <Switch 
                value={settings.forcePauseCollection} 
                onValueChange={(val) => handleToggle('forcePauseCollection', val)}
                trackColor={{ false: '#E5E7EB', true: '#2E8B57' }} 
              />
            </View>
            <View style={styles.divider} />
            <View style={styles.controlRow}>
              <View style={styles.controlLeft}>
                <MaterialIcons name="local-shipping" size={20} color="#374151" />
                <Text style={styles.controlText}>Activate Backup Fleet</Text>
              </View>
              <Switch 
                value={settings.activateBackupFleet} 
                onValueChange={(val) => handleToggle('activateBackupFleet', val)}
                trackColor={{ false: '#E5E7EB', true: '#2E8B57' }} 
              />
            </View>
          </View>

          {/* Protocol Activity Log */}
          <View style={[styles.sectionHeader, { marginTop: 16 }]}>
            <Text style={styles.sectionTitle}>Protocol Activity Log</Text>
            <TouchableOpacity><Text style={styles.exportText}>Export Report</Text></TouchableOpacity>
          </View>

          <View style={styles.logCard}>
            <View style={styles.tableHead}>
              <Text style={[styles.th, { flex: 1 }]}>TIMESTAMP</Text>
              <Text style={[styles.th, { flex: 1.5 }]}>SOURCE</Text>
              <Text style={[styles.th, { flex: 2 }]}>EVENT ACTION</Text>
              <Text style={[styles.th, { flex: 1 }]}>CONFIDENCE</Text>
            </View>
            
            {logs.length === 0 ? (
              <Text style={{ padding: 16, color: '#6B7280', textAlign: 'center' }}>No recent activity logs.</Text>
            ) : (
              logs.map((row, i) => (
                <View key={i} style={styles.tableRow}>
                  <Text style={[styles.td, { flex: 1, color: '#6B7280', fontSize: 12 }]}>
                    {row.timestamp ? new Date(row.timestamp.seconds * 1000).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) : 'Just now'}
                  </Text>
                  <Text style={[styles.td, { flex: 1.5, color: '#4B5563' }]}>{row.source}</Text>
                  <Text style={[styles.td, { flex: 2, color: '#111827' }]}>{row.action}</Text>
                  <Text style={[styles.td, { flex: 1, color: row.confidence === 'Manual' ? '#374151' : '#ef4444', fontWeight: '600' }]}>{row.confidence}</Text>
                </View>
              ))
            )}
          </View>
        </View>

        {/* Right Column - Map View */}
        <View style={styles.rightColumn}>
          <View style={styles.mapContainer}>
            <View style={styles.mapPlaceholder}>
              <MaterialIcons name="map" size={64} color="#D1D5DB" />
              <Text style={styles.mapPlaceholderText}>Live Map Integration</Text>
            </View>
            
            <View style={styles.mapBadge}>
              <View style={styles.pulsingDot} />
              <Text style={styles.mapBadgeText}>LIVE IMPACT VIEW</Text>
            </View>

            {/* Simulated Risk Hotspots Overlay */}
            <View style={styles.riskCard}>
              <Text style={styles.riskTitle}>RISK HOTSPOTS</Text>
              <View style={styles.riskRow}>
                <Text style={styles.riskBrgy}>San Isidro</Text>
                <Text style={styles.riskHigh}>HIGH</Text>
              </View>
              <View style={styles.riskRow}>
                <Text style={styles.riskBrgy}>Santa Maria</Text>
                <Text style={styles.riskModerate}>MODERATE</Text>
              </View>
              <View style={styles.riskRow}>
                <Text style={styles.riskBrgy}>Sto. Nino Central</Text>
                <Text style={styles.riskModerate}>MODERATE</Text>
              </View>
            </View>
          </View>
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F9FAFB', padding: 32 },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 32 },
  headerTextContainer: { flex: 1, paddingRight: 32 },
  headerTitle: { fontSize: 28, fontWeight: 'bold', color: '#111827', marginBottom: 8 },
  headerDesc: { fontSize: 14, color: '#4B5563', lineHeight: 22, maxWidth: 600 },
  dangerBtn: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#ef4444', paddingVertical: 12, paddingHorizontal: 20, borderRadius: 8 },
  dangerBtnText: { color: '#fff', fontWeight: 'bold', fontSize: 14 },

  mainRow: { flexDirection: 'row', gap: 32, paddingBottom: 40 },
  leftColumn: { flex: 1.2, gap: 16 },
  rightColumn: { flex: 1 },

  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  sectionTitle: { fontSize: 16, fontWeight: 'bold', color: '#111827' },
  sectionCount: { fontSize: 11, fontWeight: '700', color: '#6B7280', letterSpacing: 0.5 },
  exportText: { fontSize: 13, fontWeight: '600', color: '#2E8B57' },

  scenarioCard: { flexDirection: 'row', backgroundColor: '#fff', borderRadius: 12, padding: 20, borderWidth: 1, borderColor: '#E5E7EB' },
  scenarioCardActive: { borderColor: '#bbf7d0', backgroundColor: '#f0fdf4' },
  scenarioIconWrapper: { width: 40, height: 40, borderRadius: 8, backgroundColor: '#F3F4F6', alignItems: 'center', justifyContent: 'center', marginRight: 16 },
  scenarioIconWrapperActive: { width: 40, height: 40, borderRadius: 8, backgroundColor: '#2E8B57', alignItems: 'center', justifyContent: 'center', marginRight: 16 },
  scenarioContent: { flex: 1 },
  scenarioTitle: { fontSize: 16, fontWeight: 'bold', color: '#111827', marginBottom: 12 },
  scenarioDetailsRow: { flexDirection: 'row', gap: 24 },
  scenarioDetailCol: { flex: 1 },
  scenarioLabel: { fontSize: 10, fontWeight: '700', color: '#6B7280', letterSpacing: 0.5, marginBottom: 4 },
  scenarioValue: { fontSize: 13, color: '#374151' },
  activeDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#2E8B57', position: 'absolute', top: 20, right: 20 },

  controlsCard: { backgroundColor: '#fff', borderRadius: 12, padding: 8, borderWidth: 1, borderColor: '#E5E7EB' },
  controlRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16 },
  controlLeft: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  controlText: { fontSize: 15, fontWeight: '500', color: '#111827' },
  divider: { height: 1, backgroundColor: '#F3F4F6', marginHorizontal: 16 },

  logCard: { backgroundColor: '#fff', borderRadius: 12, padding: 16, borderWidth: 1, borderColor: '#E5E7EB' },
  tableHead: { flexDirection: 'row', paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: '#F3F4F6', marginBottom: 8 },
  th: { fontSize: 10, fontWeight: '700', color: '#6B7280', letterSpacing: 0.5 },
  tableRow: { flexDirection: 'row', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#F3F4F6' },
  td: { fontSize: 13 },

  mapContainer: { flex: 1, backgroundColor: '#E5E7EB', borderRadius: 16, minHeight: 600, overflow: 'hidden', position: 'relative' },
  mapPlaceholder: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  mapPlaceholderText: { marginTop: 12, fontSize: 16, fontWeight: '500', color: '#9CA3AF' },
  mapBadge: { position: 'absolute', top: 24, left: 24, backgroundColor: '#fff', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 20, flexDirection: 'row', alignItems: 'center', gap: 8, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 4, elevation: 4 },
  pulsingDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#ef4444' },
  mapBadgeText: { fontSize: 11, fontWeight: 'bold', color: '#374151', letterSpacing: 0.5 },
  
  riskCard: { position: 'absolute', bottom: 24, left: 24, right: 24, backgroundColor: '#fff', borderRadius: 12, padding: 20, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.1, shadowRadius: 8, elevation: 8 },
  riskTitle: { fontSize: 11, fontWeight: '700', color: '#6B7280', letterSpacing: 0.5, marginBottom: 16 },
  riskRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  riskBrgy: { fontSize: 14, color: '#374151', fontWeight: '500' },
  riskHigh: { fontSize: 12, fontWeight: 'bold', color: '#ef4444' },
  riskModerate: { fontSize: 12, fontWeight: 'bold', color: '#2E8B57' },
});
