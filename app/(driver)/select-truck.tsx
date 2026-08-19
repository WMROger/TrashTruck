import { useAuthContext } from '@/components/AuthContext';
import { db } from '@/config/firebase';
import { useTheme } from '@/hooks/useTheme';
import { Feather, MaterialIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { collection, doc, onSnapshot, serverTimestamp, updateDoc } from 'firebase/firestore';
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  SafeAreaView,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

interface Truck {
  id: string;
  plateNumber: string;
  type: string;
  capacity: string;
  status: 'active' | 'maintenance' | 'out_of_service';
  assignedDriverId?: string;
  assignedDriverName?: string;
  shiftStartedAt?: any;
  createdAt: any;
}

export default function SelectTruckScreen() {
  const router = useRouter();
  const { user } = useAuthContext();
  const { theme } = useTheme();
  const isDark = theme === 'dark';

  const [trucks, setTrucks] = useState<Truck[]>([]);
  const [loading, setLoading] = useState(true);
  const [assigning, setAssigning] = useState(false);

  // Confirmation modal
  const [confirmTruck, setConfirmTruck] = useState<Truck | null>(null);
  const [showConfirmModal, setShowConfirmModal] = useState(false);

  // Fetch all trucks in real-time
  useEffect(() => {
    if (!db) {
      setLoading(false);
      return;
    }

    const unsubscribe = onSnapshot(collection(db, 'trucks'), (snapshot) => {
      const truckList: Truck[] = [];
      snapshot.forEach((docSnap) => {
        const data = docSnap.data();
        truckList.push({
          id: docSnap.id,
          plateNumber: data.plateNumber || 'N/A',
          type: data.type || 'Unknown',
          capacity: data.capacity || '0',
          status: data.status || 'active',
          assignedDriverId: data.assignedDriverId || undefined,
          assignedDriverName: data.assignedDriverName || undefined,
          shiftStartedAt: data.shiftStartedAt || undefined,
          createdAt: data.createdAt,
        });
      });

      // Sort: active first, then maintenance, then out_of_service
      const statusOrder: Record<string, number> = { active: 0, maintenance: 1, out_of_service: 2 };
      truckList.sort((a, b) => (statusOrder[a.status] ?? 3) - (statusOrder[b.status] ?? 3));

      setTrucks(truckList);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const getTruckIcon = (type: string): keyof typeof MaterialIcons.glyphMap => {
    switch (type.toLowerCase()) {
      case 'compactor':
        return 'compress';
      case 'dump truck':
        return 'local-shipping';
      case 'mini-dump':
        return 'fire-truck';
      default:
        return 'local-shipping';
    }
  };

  const getStatusConfig = (truck: Truck) => {
    const isAssignedToMe = truck.assignedDriverId === user?.uid;
    const isAssignedToOther = !!truck.assignedDriverId && truck.assignedDriverId !== user?.uid;

    if (isAssignedToOther) {
      return {
        borderColor: isDark ? '#4B5563' : '#D1D5DB',
        bgColor: isDark ? '#1F2937' : '#F9FAFB',
        label: `Assigned to: ${truck.assignedDriverName || 'Another Driver'}`,
        labelColor: isDark ? '#9CA3AF' : '#6B7280',
        disabled: true,
        iconBg: isDark ? '#374151' : '#E5E7EB',
        iconColor: isDark ? '#6B7280' : '#9CA3AF',
      };
    }

    if (isAssignedToMe) {
      return {
        borderColor: isDark ? '#3B82F6' : '#60A5FA',
        bgColor: isDark ? '#1E3A5F' : '#EFF6FF',
        label: 'Currently Assigned to You',
        labelColor: isDark ? '#93C5FD' : '#2563EB',
        disabled: true,
        iconBg: isDark ? '#1E40AF' : '#DBEAFE',
        iconColor: isDark ? '#60A5FA' : '#2563EB',
      };
    }

    switch (truck.status) {
      case 'active':
        return {
          borderColor: isDark ? '#22C55E' : '#86EFAC',
          bgColor: isDark ? '#1C2920' : '#F0FDF4',
          label: 'Available',
          labelColor: isDark ? '#86EFAC' : '#16A34A',
          disabled: false,
          iconBg: isDark ? '#166534' : '#DCFCE7',
          iconColor: isDark ? '#86EFAC' : '#16A34A',
        };
      case 'maintenance':
        return {
          borderColor: isDark ? '#F59E0B' : '#FCD34D',
          bgColor: isDark ? '#2D2410' : '#FFFBEB',
          label: 'Under Maintenance',
          labelColor: isDark ? '#FCD34D' : '#D97706',
          disabled: true,
          iconBg: isDark ? '#78350F' : '#FEF3C7',
          iconColor: isDark ? '#FCD34D' : '#D97706',
        };
      case 'out_of_service':
        return {
          borderColor: isDark ? '#EF4444' : '#FCA5A5',
          bgColor: isDark ? '#2D1010' : '#FEF2F2',
          label: 'Out of Service',
          labelColor: isDark ? '#FCA5A5' : '#DC2626',
          disabled: true,
          iconBg: isDark ? '#7F1D1D' : '#FEE2E2',
          iconColor: isDark ? '#FCA5A5' : '#DC2626',
        };
      default:
        return {
          borderColor: isDark ? '#4B5563' : '#D1D5DB',
          bgColor: isDark ? '#1F2937' : '#F9FAFB',
          label: 'Unknown',
          labelColor: isDark ? '#9CA3AF' : '#6B7280',
          disabled: true,
          iconBg: isDark ? '#374151' : '#E5E7EB',
          iconColor: isDark ? '#6B7280' : '#9CA3AF',
        };
    }
  };

  const handleSelectTruck = (truck: Truck) => {
    if (!user) return;
    setConfirmTruck(truck);
    setShowConfirmModal(true);
  };

  const handleConfirmAssignment = () => {
    if (!confirmTruck) return;
    setShowConfirmModal(false);
    assignTruck(confirmTruck);
  };

  const assignTruck = async (truck: Truck) => {
    if (!user || !db) return;

    setAssigning(true);
    try {
      const driverName = user.displayName || user.email || 'Unknown Driver';

      // Update the truck document
      const truckRef = doc(db, 'trucks', truck.id);
      await updateDoc(truckRef, {
        assignedDriverId: user.uid,
        assignedDriverName: driverName,
        shiftStartedAt: serverTimestamp(),
      });

      // Update the user's document
      const userRef = doc(db, 'users', user.uid);
      await updateDoc(userRef, {
        currentTruckId: truck.id,
        currentTruckPlate: truck.plateNumber,
        status: 'on_duty',
        dutyStatus: 'on_duty',
      });

      router.replace('/(driver)');
    } catch (error) {
      console.error('Failed to assign truck:', error);
      Alert.alert('Error', 'Failed to assign truck. Please try again.');
    } finally {
      setAssigning(false);
    }
  };

  const handleGoBack = () => {
    router.replace('/(tabs)/home');
  };

  if (loading) {
    return (
      <SafeAreaView style={[styles.safeArea, isDark && styles.safeAreaDark]}>
        <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={isDark ? '#86EFAC' : '#4E6C50'} />
          <Text style={[styles.loadingText, isDark && styles.textMuted]}>Loading trucks...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.safeArea, isDark && styles.safeAreaDark]}>
      <StatusBar barStyle="light-content" />

      {/* Header */}
      <View style={[styles.header, isDark && styles.headerDark]}>
        <TouchableOpacity style={styles.backButton} onPress={handleGoBack}>
          <Feather name="arrow-left" size={22} color="#FFFFFF" />
        </TouchableOpacity>

        <View style={styles.headerContent}>
          <View style={styles.headerTitleRow}>
            <MaterialIcons name="local-shipping" size={28} color="#FFFFFF" />
            <Text style={styles.headerTitle}>Select Your Truck</Text>
          </View>
          <Text style={styles.headerSubtitle}>Choose a truck for today’s shift</Text>
        </View>
      </View>

      {/* Truck List */}
      <ScrollView
        style={[styles.scrollView, isDark && styles.scrollViewDark]}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {trucks.length === 0 ? (
          <View style={[styles.emptyCard, isDark && styles.emptyCardDark]}>
            <MaterialIcons name="local-shipping" size={48} color={isDark ? '#4B5563' : '#D1D5DB'} />
            <Text style={[styles.emptyTitle, isDark && styles.textLight]}>No Trucks Available</Text>
            <Text style={[styles.emptySubtitle, isDark && styles.textMuted]}>
              No trucks have been added to the system yet.
            </Text>
          </View>
        ) : (
          trucks.map((truck) => {
            const config = getStatusConfig(truck);

            return (
              <TouchableOpacity
                key={truck.id}
                style={[
                  styles.truckCard,
                  {
                    backgroundColor: config.bgColor,
                    borderColor: config.borderColor,
                  },
                  config.disabled && styles.truckCardDisabled,
                ]}
                activeOpacity={config.disabled ? 1 : 0.7}
                onPress={() => !config.disabled && handleSelectTruck(truck)}
                disabled={config.disabled}
              >
                {/* Truck Icon */}
                <View style={[styles.truckIconContainer, { backgroundColor: config.iconBg }]}>
                  <MaterialIcons
                    name={getTruckIcon(truck.type)}
                    size={28}
                    color={config.iconColor}
                  />
                </View>

                {/* Truck Info */}
                <View style={styles.truckInfo}>
                  <Text
                    style={[
                      styles.plateNumber,
                      isDark && styles.textLight,
                      config.disabled && { opacity: 0.6 },
                    ]}
                  >
                    {truck.plateNumber}
                  </Text>
                  <Text
                    style={[
                      styles.truckType,
                      isDark && styles.textMuted,
                      config.disabled && { opacity: 0.6 },
                    ]}
                  >
                    {truck.type} • {truck.capacity} Tons
                  </Text>

                  {/* Status Badge */}
                  <View style={[styles.statusBadge, { backgroundColor: config.iconBg }]}>
                    <View
                      style={[
                        styles.statusDot,
                        { backgroundColor: config.labelColor },
                      ]}
                    />
                    <Text style={[styles.statusLabel, { color: config.labelColor }]}>
                      {config.label}
                    </Text>
                  </View>
                </View>

                {/* Arrow for selectable trucks */}
                {!config.disabled && (
                  <View style={styles.selectArrow}>
                    <Feather
                      name="chevron-right"
                      size={20}
                      color={isDark ? '#86EFAC' : '#16A34A'}
                    />
                  </View>
                )}

                {/* Lock icon for disabled trucks */}
                {config.disabled && (
                  <View style={styles.lockIcon}>
                    <Feather
                      name="lock"
                      size={16}
                      color={isDark ? '#4B5563' : '#D1D5DB'}
                    />
                  </View>
                )}
              </TouchableOpacity>
            );
          })
        )}

        <View style={{ height: 40 }} />
      </ScrollView>

      {/* ── Confirmation Modal ── */}
      <Modal
        visible={showConfirmModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowConfirmModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalCard, isDark && styles.modalCardDark]}>
            {/* Modal Header Icon */}
            <View style={styles.modalIconCircle}>
              <MaterialIcons name="local-shipping" size={36} color="#FFFFFF" />
            </View>

            <Text style={[styles.modalTitle, isDark && styles.textLight]}>
              Confirm Truck Selection
            </Text>
            <Text style={[styles.modalSubtitle, isDark && styles.textMuted]}>
              You’re about to start your shift with this truck
            </Text>

            {/* Truck Detail Card */}
            {confirmTruck && (
              <View style={[styles.modalDetailCard, isDark && { backgroundColor: '#1F2937', borderColor: '#374151' }]}>
                <View style={styles.modalDetailRow}>
                  <View style={styles.modalDetailLabel}>
                    <MaterialIcons name="confirmation-number" size={16} color={isDark ? '#86EFAC' : '#2E8B57'} />
                    <Text style={[styles.modalDetailLabelText, isDark && styles.textMuted]}>Plate Number</Text>
                  </View>
                  <Text style={[styles.modalDetailValue, isDark && styles.textLight]}>{confirmTruck.plateNumber}</Text>
                </View>

                <View style={[styles.modalDivider, isDark && { backgroundColor: '#374151' }]} />

                <View style={styles.modalDetailRow}>
                  <View style={styles.modalDetailLabel}>
                    <MaterialIcons name="category" size={16} color={isDark ? '#86EFAC' : '#2E8B57'} />
                    <Text style={[styles.modalDetailLabelText, isDark && styles.textMuted]}>Type</Text>
                  </View>
                  <Text style={[styles.modalDetailValue, isDark && styles.textLight]}>{confirmTruck.type}</Text>
                </View>

                <View style={[styles.modalDivider, isDark && { backgroundColor: '#374151' }]} />

                <View style={styles.modalDetailRow}>
                  <View style={styles.modalDetailLabel}>
                    <MaterialIcons name="fitness-center" size={16} color={isDark ? '#86EFAC' : '#2E8B57'} />
                    <Text style={[styles.modalDetailLabelText, isDark && styles.textMuted]}>Capacity</Text>
                  </View>
                  <Text style={[styles.modalDetailValue, isDark && styles.textLight]}>{confirmTruck.capacity} Tons</Text>
                </View>
              </View>
            )}

            {/* Action Buttons */}
            <View style={styles.modalActions}>
              <TouchableOpacity
                style={[styles.modalCancelBtn, isDark && { backgroundColor: '#374151', borderColor: '#4B5563' }]}
                onPress={() => setShowConfirmModal(false)}
                activeOpacity={0.8}
              >
                <Text style={[styles.modalCancelText, isDark && { color: '#D1D5DB' }]}>Cancel</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.modalConfirmBtn}
                onPress={handleConfirmAssignment}
                activeOpacity={0.85}
              >
                <MaterialIcons name="play-arrow" size={20} color="#FFFFFF" />
                <Text style={styles.modalConfirmText}>Start Shift</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Assigning Overlay */}
      {assigning && (
        <View style={styles.overlay}>
          <View style={[styles.overlayContent, isDark && styles.overlayContentDark]}>
            <ActivityIndicator size="large" color={isDark ? '#86EFAC' : '#4E6C50'} />
            <Text style={[styles.overlayText, isDark && styles.textLight]}>
              Starting your shift...
            </Text>
            <Text style={[styles.overlaySubtext, isDark && styles.textMuted]}>
              Assigning truck and preparing dashboard
            </Text>
          </View>
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#F4FBF1',
  },
  safeAreaDark: {
    backgroundColor: '#111827',
  },
  textLight: {
    color: '#F9FAFB',
  },
  textMuted: {
    color: '#9CA3AF',
  },

  // Loading
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 12,
  },
  loadingText: {
    fontSize: 14,
    color: '#6B7280',
    fontWeight: '500',
  },

  // Header
  header: {
    backgroundColor: '#2D4A35',
    paddingTop: 20,
    paddingBottom: 24,
    paddingHorizontal: 20,
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 6,
  },
  headerDark: {
    backgroundColor: '#1A2E23',
  },
  backButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.15)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  headerContent: {
    gap: 4,
  },
  headerTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: -0.5,
  },
  headerSubtitle: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.7)',
    marginLeft: 38,
  },

  // Scroll
  scrollView: {
    flex: 1,
    backgroundColor: '#F4FBF1',
  },
  scrollViewDark: {
    backgroundColor: '#111827',
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 20,
  },

  // Empty State
  emptyCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 40,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderStyle: 'dashed',
    gap: 8,
  },
  emptyCardDark: {
    backgroundColor: '#1F2937',
    borderColor: '#374151',
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1F2937',
    marginTop: 8,
  },
  emptySubtitle: {
    fontSize: 13,
    color: '#6B7280',
    textAlign: 'center',
  },

  // Truck Card
  truckCard: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1.5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  truckCardDisabled: {
    elevation: 0,
    shadowOpacity: 0,
  },
  truckIconContainer: {
    width: 52,
    height: 52,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
  },
  truckInfo: {
    flex: 1,
    gap: 2,
  },
  plateNumber: {
    fontSize: 17,
    fontWeight: '800',
    color: '#1F2937',
    letterSpacing: 0.3,
  },
  truckType: {
    fontSize: 13,
    color: '#6B7280',
    fontWeight: '500',
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    marginTop: 4,
    gap: 5,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  statusLabel: {
    fontSize: 11,
    fontWeight: '700',
  },
  selectArrow: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(22, 163, 74, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  lockIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },

  // ── Confirmation Modal ──
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  modalCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 28,
    width: '100%',
    maxWidth: 400,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.25,
    shadowRadius: 20,
    elevation: 15,
  },
  modalCardDark: {
    backgroundColor: '#111827',
  },
  modalIconCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: '#2E8B57',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
    shadowColor: '#2E8B57',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#111827',
    textAlign: 'center',
    marginBottom: 4,
  },
  modalSubtitle: {
    fontSize: 13,
    color: '#6B7280',
    textAlign: 'center',
    marginBottom: 20,
  },
  modalDetailCard: {
    width: '100%',
    backgroundColor: '#F9FAFB',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    marginBottom: 24,
  },
  modalDetailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
  },
  modalDetailLabel: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  modalDetailLabelText: {
    fontSize: 13,
    color: '#6B7280',
    fontWeight: '500',
  },
  modalDetailValue: {
    fontSize: 15,
    fontWeight: '700',
    color: '#111827',
  },
  modalDivider: {
    height: 1,
    backgroundColor: '#E5E7EB',
  },
  modalActions: {
    flexDirection: 'row',
    width: '100%',
    gap: 12,
  },
  modalCancelBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 14,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  modalCancelText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#4B5563',
  },
  modalConfirmBtn: {
    flex: 1.5,
    flexDirection: 'row',
    paddingVertical: 14,
    borderRadius: 14,
    backgroundColor: '#2E8B57',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    shadowColor: '#2E8B57',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  modalConfirmText: {
    fontSize: 15,
    fontWeight: '800',
    color: '#FFFFFF',
  },

  // Overlay
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 100,
  },
  overlayContent: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 40,
    alignItems: 'center',
    gap: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15,
    shadowRadius: 16,
    elevation: 10,
    minWidth: 260,
  },
  overlayContentDark: {
    backgroundColor: '#1F2937',
  },
  overlayText: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1F2937',
  },
  overlaySubtext: {
    fontSize: 13,
    color: '#6B7280',
    textAlign: 'center',
  },
});
