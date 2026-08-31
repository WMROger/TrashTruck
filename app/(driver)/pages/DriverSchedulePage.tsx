import { auth, db } from '@/config/firebase';
import { Feather, MaterialIcons } from '@expo/vector-icons';
import { collection, doc, onSnapshot, query, where } from 'firebase/firestore';
import React, { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'expo-router';
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

import CompletePickupModal from '@/components/driver/CompletePickupModal';
import ReportIssueModal from '@/components/driver/ReportIssueModal';
import { useTheme } from '@/hooks/useTheme';

export interface ScheduleItem {
  id: string;
  street: string;
  barangay: string;
  wasteCategory: string;
  timeText: string;
  dateText: string;
  zone?: string;
  truckName?: string;
  status?: string;
  isRecurring?: boolean;
}

export interface WeeklyScheduleEntry {
  id: string;
  street: string;
  barangay: string;
  days: string[];
  wasteCategory: string;
  timeText: string;
  zone?: string;
  truckName?: string;
}

const DOW_SHORT = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];
const DOW_FULL = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

function isDayScheduled(daysList: string[] = [], dayIndex: number): boolean {
  if (!Array.isArray(daysList) || daysList.length === 0) return false;
  const shortName = DOW_SHORT[dayIndex]; // e.g. 'MON'
  const fullName = DOW_FULL[dayIndex].toLowerCase(); // e.g. 'monday'

  return daysList.some((d) => {
    const clean = String(d || '').trim().toUpperCase();
    return clean === shortName || clean.startsWith(shortName) || clean.toLowerCase() === fullName;
  });
}

function getTimeForDay(schedData: any, dayIndex: number): string {
  const shortName = DOW_SHORT[dayIndex];
  if (schedData.dayTimes && typeof schedData.dayTimes === 'object' && schedData.dayTimes[shortName]) {
    return schedData.dayTimes[shortName];
  }
  return (
    schedData.time ||
    schedData.timeText ||
    schedData.collectionTime ||
    schedData.modalTimeStr ||
    '06:00 AM'
  );
}

export default function DriverSchedulePage() {
  const router = useRouter();
  const { theme } = useTheme();
  const isDark = theme === 'dark';

  const [loading, setLoading] = useState(true);
  const [assignedBarangay, setAssignedBarangay] = useState<string>('');
  const [driverName, setDriverName] = useState<string>('');
  const [assignedTruckPlate, setAssignedTruckPlate] = useState<string>('');
  const [isShiftActive, setIsShiftActive] = useState<boolean>(false);

  const [rawBarangaySchedules, setRawBarangaySchedules] = useState<any[]>([]);
  const [rawDirectSchedules, setRawDirectSchedules] = useState<any[]>([]);

  // Modal states
  const [showCompleteModal, setShowCompleteModal] = useState(false);
  const [showIssueModal, setShowIssueModal] = useState(false);
  const [selectedPickupId, setSelectedPickupId] = useState<string | null>(null);

  // 1. Fetch current driver profile (to know assignedBarangay and active shift)
  useEffect(() => {
    const currentUser = auth?.currentUser;
    if (!currentUser || !db) {
      setLoading(false);
      return;
    }

    const unsubUser = onSnapshot(
      doc(db, 'users', currentUser.uid),
      (snap) => {
        if (snap.exists()) {
          const data = snap.data();
          const b = (data.assignedBarangay || data.barangay || '').trim();
          setAssignedBarangay(b);
          setDriverName(data.displayName || data.name || data.email || 'Driver');
          setAssignedTruckPlate(data.currentTruckPlate || '');
          const activeShift = Boolean(
            data.dutyStatus === 'on_duty' || data.status === 'on_duty' || data.currentTruckId
          );
          setIsShiftActive(activeShift);
        }
      },
      (err) => {
        if (err?.code !== 'permission-denied') {
          console.warn('DriverSchedulePage: user profile listener error:', err);
        }
      }
    );

    return () => unsubUser();
  }, []);

  // 2. Fetch all collection schedules for the driver's barangay from 'barangay_schedules'
  useEffect(() => {
    if (!db) {
      setLoading(false);
      return;
    }

    const unsubBarangaySchedules = onSnapshot(
      collection(db, 'barangay_schedules'),
      (snap) => {
        const list: any[] = [];
        snap.forEach((d) => {
          list.push({ id: d.id, ...d.data() });
        });
        setRawBarangaySchedules(list);
        setLoading(false);
      },
      (err) => {
        if (err?.code !== 'permission-denied') {
          console.warn('DriverSchedulePage: barangay_schedules listener error:', err);
        }
        setLoading(false);
      }
    );

    return () => unsubBarangaySchedules();
  }, []);

  // 3. Fetch direct driver-specific tasks from 'schedules'
  useEffect(() => {
    const currentUser = auth?.currentUser;
    if (!currentUser || !db) return;

    const directQuery = query(
      collection(db, 'schedules'),
      where('assignedDriverId', '==', currentUser.uid)
    );

    const unsubDirect = onSnapshot(
      directQuery,
      (snap) => {
        const list: any[] = [];
        snap.forEach((d) => {
          list.push({ id: d.id, ...d.data() });
        });
        setRawDirectSchedules(list);
      },
      (err) => {
        if (err?.code !== 'permission-denied') {
          console.warn('DriverSchedulePage: direct schedules listener error:', err);
        }
      }
    );

    return () => unsubDirect();
  }, []);

  // Compute Today, Tomorrow, and Weekly Schedules
  const { todayList, tomorrowList, weeklyList } = useMemo(() => {
    const today = new Date();
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);

    const todayDOW = today.getDay(); // 0 = Sun, 1 = Mon, ...
    const tomorrowDOW = tomorrow.getDay();

    const todayDateString = today.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
    const tomorrowDateString = tomorrow.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });

    const normalizedDriverBarangay = assignedBarangay.trim().toLowerCase();

    // Filter relevant barangay schedules
    const matchedBarangaySchedules = rawBarangaySchedules.filter((sched) => {
      if (!normalizedDriverBarangay) return true; // Show all if unassigned
      const bName = String(sched.barangayName || sched.barangay || '').trim().toLowerCase();
      return (
        bName === normalizedDriverBarangay ||
        normalizedDriverBarangay.includes(bName) ||
        bName.includes(normalizedDriverBarangay)
      );
    });

    const todayItems: ScheduleItem[] = [];
    const tomorrowItems: ScheduleItem[] = [];
    const weeklyItems: WeeklyScheduleEntry[] = [];

    // A. Expand from barangay_schedules
    matchedBarangaySchedules.forEach((sched) => {
      const days = Array.isArray(sched.days)
        ? sched.days
        : Array.isArray(sched.selectedDays)
        ? sched.selectedDays
        : [];
      const street = sched.streetName || sched.street || sched.route || 'Barangay Route';
      const bName = sched.barangayName || sched.barangay || assignedBarangay || 'Assigned Barangay';
      const category = sched.wasteCategory || sched.wasteType || 'BIODEGRADABLE';
      const zone = sched.zone || '';
      const truck = sched.truckName || '';

      // Weekly Entry
      weeklyItems.push({
        id: `weekly_${sched.id}`,
        street,
        barangay: bName,
        days: days.length > 0 ? days : ['Daily'],
        wasteCategory: category,
        timeText: getTimeForDay(sched, todayDOW),
        zone,
        truckName: truck,
      });

      // Check Today
      if (isDayScheduled(days, todayDOW) || sched.isDaily === true) {
        todayItems.push({
          id: `bs_today_${sched.id}`,
          street,
          barangay: bName,
          wasteCategory: category,
          timeText: getTimeForDay(sched, todayDOW),
          dateText: 'Today',
          zone,
          truckName: truck,
          status: 'pending',
          isRecurring: true,
        });
      }

      // Check Tomorrow
      if (isDayScheduled(days, tomorrowDOW) || sched.isDaily === true) {
        tomorrowItems.push({
          id: `bs_tmrw_${sched.id}`,
          street,
          barangay: bName,
          wasteCategory: category,
          timeText: getTimeForDay(sched, tomorrowDOW),
          dateText: 'Tomorrow',
          zone,
          truckName: truck,
          status: 'pending',
          isRecurring: true,
        });
      }

      // Check specific one-off pickups inside specificSchedules / pickups array
      const specific = sched.specificSchedules || sched.pickups || [];
      if (Array.isArray(specific)) {
        specific.forEach((item: any, idx: number) => {
          const itemDateStr = item.date || item.dateText || '';
          if (itemDateStr === todayDateString || itemDateStr === 'Today') {
            todayItems.push({
              id: `spec_today_${sched.id}_${idx}`,
              street: item.street || street,
              barangay: bName,
              wasteCategory: item.category || category,
              timeText: item.time || getTimeForDay(sched, todayDOW),
              dateText: 'Today',
              zone,
              truckName: truck,
              status: item.status || 'pending',
              isRecurring: false,
            });
          } else if (itemDateStr === tomorrowDateString || itemDateStr === 'Tomorrow') {
            tomorrowItems.push({
              id: `spec_tmrw_${sched.id}_${idx}`,
              street: item.street || street,
              barangay: bName,
              wasteCategory: item.category || category,
              timeText: item.time || getTimeForDay(sched, tomorrowDOW),
              dateText: 'Tomorrow',
              zone,
              truckName: truck,
              status: item.status || 'pending',
              isRecurring: false,
            });
          }
        });
      }
    });

    // B. Merge direct schedules assigned to this driver
    rawDirectSchedules.forEach((data) => {
      if (data.status === 'completed' || data.status === 'cancelled') return;

      const item: ScheduleItem = {
        id: data.id,
        street: data.street || 'Unknown Street',
        barangay: data.barangay || assignedBarangay || 'Assigned Barangay',
        wasteCategory: data.wasteCategory || data.wasteType || 'General',
        timeText: data.timeText || data.time || 'ASAP',
        dateText: data.dateText || 'Today',
        status: data.status || 'pending',
        isRecurring: false,
      };

      if (data.dateText === todayDateString || data.dateText === 'Today' || !data.dateText) {
        todayItems.push(item);
      } else if (data.dateText === tomorrowDateString || data.dateText === 'Tomorrow') {
        tomorrowItems.push(item);
      }
    });

    todayItems.sort((a, b) => a.timeText.localeCompare(b.timeText));
    tomorrowItems.sort((a, b) => a.timeText.localeCompare(b.timeText));

    return {
      todayList: todayItems,
      tomorrowList: tomorrowItems,
      weeklyList: weeklyItems,
    };
  }, [rawBarangaySchedules, rawDirectSchedules, assignedBarangay]);

  const handleCompletePickup = (id: string) => {
    if (!isShiftActive) {
      Alert.alert(
        'Off-Duty Notice',
        'You are currently off duty. Please start your shift and select a truck before completing pickups.',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Start Shift', onPress: () => router.push('/(driver)/select-truck') },
        ]
      );
      return;
    }
    setSelectedPickupId(id);
    setShowCompleteModal(true);
  };

  const handleIssuePickup = (id: string) => {
    if (!isShiftActive) {
      Alert.alert(
        'Off-Duty Notice',
        'You are currently off duty. Please start your shift and select a truck before reporting issues.',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Start Shift', onPress: () => router.push('/(driver)/select-truck') },
        ]
      );
      return;
    }
    setSelectedPickupId(id);
    setShowIssueModal(true);
  };

  const getCategoryColor = (category: string) => {
    const c = category.toUpperCase();
    if (c.includes('BIO') && !c.includes('NON')) return '#10B981'; // Emerald Green
    if (c.includes('NON-BIO') || c.includes('NON BIO')) return '#3B82F6'; // Blue
    if (c.includes('RECYCL')) return '#F59E0B'; // Amber
    if (c.includes('RESIDUAL')) return '#64748B'; // Slate Gray
    if (c.includes('HAZARD')) return '#EF4444'; // Red
    return '#8B5CF6'; // Purple / Bulk
  };

  if (loading) {
    return (
      <View style={[styles.container, isDark && styles.containerDark, styles.center]}>
        <ActivityIndicator size="large" color={isDark ? '#86EFAC' : '#4E6C50'} />
      </View>
    );
  }

  const renderScheduleCard = (item: ScheduleItem) => {
    const color = getCategoryColor(item.wasteCategory);
    return (
      <View key={item.id} style={[styles.pickupCard, isDark && styles.pickupCardDark]}>
        <View style={styles.cardTopRow}>
          <View style={styles.barangayTag}>
            <MaterialIcons name="location-on" size={13} color="#FFFFFF" />
            <Text style={styles.pickupBarangay}>Brgy. {item.barangay}</Text>
          </View>
          <View style={[styles.categoryBadge, { backgroundColor: color }]}>
            <Text style={styles.categoryBadgeText}>{item.wasteCategory}</Text>
          </View>
        </View>

        <View style={styles.pickupDetails}>
          <View style={styles.detailRow}>
            <View style={styles.dotGreen} />
            <Text style={styles.detailText}>
              <Text style={{ fontWeight: '700' }}>Street / Route:</Text> {item.street}
            </Text>
          </View>
          <View style={styles.detailRow}>
            <Feather name="clock" size={13} color="#E5E7EB" style={styles.detailIcon} />
            <Text style={styles.detailText}>
              <Text style={{ fontWeight: '700' }}>Collection Window:</Text> {item.timeText}
            </Text>
          </View>
          {item.zone ? (
            <View style={styles.detailRow}>
              <MaterialIcons name="grid-view" size={13} color="#E5E7EB" style={styles.detailIcon} />
              <Text style={styles.detailText}>
                <Text style={{ fontWeight: '700' }}>Zone / Sector:</Text> {item.zone}
              </Text>
            </View>
          ) : null}
        </View>

        {isShiftActive ? (
          <View style={styles.actionButtons}>
            <TouchableOpacity
              style={styles.completeBtn}
              onPress={() => handleCompletePickup(item.id)}
              activeOpacity={0.8}
            >
              <Feather name="check-circle" size={14} color="#FFFFFF" />
              <Text style={styles.completeBtnText}>Mark Done</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.issueBtn}
              onPress={() => handleIssuePickup(item.id)}
              activeOpacity={0.8}
            >
              <Feather name="alert-triangle" size={14} color="#FFFFFF" />
              <Text style={styles.issueBtnText}>Report Issue</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.offDutyNoticeRow}>
            <Feather name="eye" size={13} color="rgba(255, 255, 255, 0.8)" />
            <Text style={styles.offDutyNoticeText}>Viewing Mode &bull; Start shift to perform collection actions</Text>
          </View>
        )}
      </View>
    );
  };

  return (
    <ScrollView style={[styles.container, isDark && styles.containerDark]} showsVerticalScrollIndicator={false}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} backgroundColor={isDark ? '#111827' : '#F4FBF1'} />

      {/* Header Banner */}
      <View style={styles.header}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <View>
            <Text style={[styles.title, isDark && styles.textLight]}>Driver Schedule</Text>
            <Text style={[styles.subtitle, isDark && styles.textMuted]}>
              Municipal collection timetable for your assigned area.
            </Text>
          </View>
        </View>

        {/* Assigned Barangay & Truck Pill Banner */}
        <View style={[styles.assignmentBanner, isDark && styles.assignmentBannerDark]}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <View style={styles.assignmentPill}>
              <MaterialIcons name="holiday-village" size={16} color="#065F46" />
              <Text style={styles.assignmentPillText}>
                {assignedBarangay ? `Brgy. ${assignedBarangay}` : 'No Barangay Assigned'}
              </Text>
            </View>
            {assignedTruckPlate ? (
              <View style={styles.truckPill}>
                <MaterialIcons name="local-shipping" size={15} color="#1E40AF" />
                <Text style={styles.truckPillText}>{assignedTruckPlate}</Text>
              </View>
            ) : null}
          </View>
          {!assignedBarangay && (
            <Text style={styles.unassignedWarning}>
              ⚠️ No barangay currently linked to your driver account. Contact CENRO Admin to configure your operational area.
            </Text>
          )}
        </View>
      </View>

      {/* Today Section */}
      <View style={styles.section}>
        <View style={styles.sectionTitleRow}>
          <Text style={[styles.sectionTitle, isDark && styles.textLight]}>Today&apos;s Pickups</Text>
          <View style={[styles.countBadge, todayList.length > 0 ? styles.countBadgeActive : styles.countBadgeMuted]}>
            <Text style={styles.countBadgeText}>{todayList.length} scheduled</Text>
          </View>
        </View>

        {todayList.length > 0 ? (
          todayList.map(renderScheduleCard)
        ) : (
          <View style={[styles.emptyCard, isDark && styles.emptyCardDark]}>
            <Feather name="calendar" size={32} color={isDark ? '#4B5563' : '#9CA3AF'} />
            <Text style={[styles.emptyText, isDark && styles.textLight]}>
              No scheduled collections for today in {assignedBarangay ? `Brgy. ${assignedBarangay}` : 'your area'}
            </Text>
            <Text style={[styles.emptySubText, isDark && styles.textMuted]}>
              Check the upcoming or weekly routine below for your next scheduled pickup date.
            </Text>
          </View>
        )}
      </View>

      {/* Tomorrow Section */}
      <View style={styles.section}>
        <View style={styles.sectionTitleRow}>
          <Text style={[styles.sectionTitle, isDark && styles.textLight]}>Tomorrow&apos;s Pickups</Text>
          <View style={[styles.countBadge, tomorrowList.length > 0 ? styles.countBadgeActive : styles.countBadgeMuted]}>
            <Text style={styles.countBadgeText}>{tomorrowList.length} scheduled</Text>
          </View>
        </View>

        {tomorrowList.length > 0 ? (
          tomorrowList.map(renderScheduleCard)
        ) : (
          <View style={[styles.emptyCard, isDark && styles.emptyCardDark]}>
            <Feather name="calendar" size={32} color={isDark ? '#4B5563' : '#9CA3AF'} />
            <Text style={[styles.emptyText, isDark && styles.textLight]}>No scheduled collections for tomorrow</Text>
          </View>
        )}
      </View>

      {/* Weekly Route Routine Section */}
      {weeklyList.length > 0 && (
        <View style={styles.section}>
          <View style={styles.sectionTitleRow}>
            <Text style={[styles.sectionTitle, isDark && styles.textLight]}>
              Weekly Collection Routine ({assignedBarangay ? `Brgy. ${assignedBarangay}` : 'Assigned Area'})
            </Text>
          </View>

          <View style={[styles.weeklyCard, isDark && styles.weeklyCardDark]}>
            {weeklyList.map((w, idx) => {
              const catColor = getCategoryColor(w.wasteCategory);
              return (
                <View
                  key={w.id}
                  style={[
                    styles.weeklyRow,
                    idx < weeklyList.length - 1 && styles.weeklyRowDivider,
                    idx % 2 === 1 && { backgroundColor: isDark ? '#1F2937' : '#F9FAFB' },
                  ]}
                >
                  <View style={{ flex: 1 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                      <Text style={[styles.weeklyStreetText, isDark && styles.textLight]}>{w.street}</Text>
                      <View style={[styles.smallCategoryPill, { backgroundColor: catColor }]}>
                        <Text style={styles.smallCategoryPillText}>{w.wasteCategory}</Text>
                      </View>
                    </View>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                      <View style={styles.daysTag}>
                        <MaterialIcons name="event-repeat" size={12} color="#065F46" />
                        <Text style={styles.daysTagText}>{w.days.join(', ')}</Text>
                      </View>
                      <View style={styles.timeTag}>
                        <Feather name="clock" size={11} color="#475569" />
                        <Text style={styles.timeTagText}>{w.timeText}</Text>
                      </View>
                    </View>
                  </View>
                </View>
              );
            })}
          </View>
        </View>
      )}

      <View style={{ height: 40 }} />

      {selectedPickupId && (
        <CompletePickupModal
          visible={showCompleteModal}
          scheduleId={selectedPickupId}
          onClose={() => setShowCompleteModal(false)}
          onSubmit={() => {
            setShowCompleteModal(false);
          }}
        />
      )}

      {selectedPickupId && (
        <ReportIssueModal
          visible={showIssueModal}
          scheduleId={selectedPickupId}
          onClose={() => setShowIssueModal(false)}
          onSubmit={() => {
            setShowIssueModal(false);
          }}
        />
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F4FBF1',
    paddingHorizontal: 20,
  },
  containerDark: {
    backgroundColor: '#111827',
  },
  center: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  textLight: {
    color: '#F9FAFB',
  },
  textMuted: {
    color: '#9CA3AF',
  },
  header: {
    marginTop: 50,
    marginBottom: 24,
  },
  title: {
    fontSize: 26,
    fontWeight: '800',
    color: '#1A3B2B',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 13,
    color: '#4B5563',
  },
  assignmentBanner: {
    marginTop: 14,
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  assignmentBannerDark: {
    backgroundColor: '#1E293B',
    borderColor: '#334155',
  },
  assignmentPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#D1FAE5',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
  },
  assignmentPillText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#065F46',
  },
  truckPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#DBEAFE',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
  },
  truckPillText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#1E40AF',
  },
  unassignedWarning: {
    marginTop: 8,
    fontSize: 12,
    color: '#DC2626',
    fontWeight: '600',
  },
  section: {
    marginBottom: 24,
  },
  sectionTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#1F2937',
  },
  countBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
  },
  countBadgeActive: {
    backgroundColor: '#DCFCE7',
  },
  countBadgeMuted: {
    backgroundColor: '#E2E8F0',
  },
  countBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#166534',
  },
  pickupCard: {
    backgroundColor: '#2D4A3E',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
  },
  pickupCardDark: {
    backgroundColor: '#1E293B',
    borderWidth: 1,
    borderColor: '#334155',
  },
  cardTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  barangayTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  pickupBarangay: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  categoryBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  categoryBadgeText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#FFFFFF',
    textTransform: 'uppercase',
  },
  pickupDetails: {
    gap: 6,
    marginBottom: 14,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  dotGreen: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#10B981',
  },
  detailIcon: {
    marginLeft: -1,
  },
  detailText: {
    fontSize: 13,
    color: '#F1F5F9',
    flex: 1,
  },
  actionButtons: {
    flexDirection: 'row',
    gap: 10,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.15)',
    paddingTop: 12,
  },
  completeBtn: {
    flex: 1,
    backgroundColor: '#059669',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    borderRadius: 10,
  },
  completeBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  issueBtn: {
    flex: 1,
    backgroundColor: '#D97706',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    borderRadius: 10,
  },
  issueBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  emptyCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 24,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  emptyCardDark: {
    backgroundColor: '#1E293B',
    borderColor: '#334155',
  },
  emptyText: {
    marginTop: 10,
    fontSize: 14,
    fontWeight: '700',
    color: '#334155',
    textAlign: 'center',
  },
  emptySubText: {
    marginTop: 4,
    fontSize: 12,
    color: '#64748B',
    textAlign: 'center',
  },
  weeklyCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    overflow: 'hidden',
  },
  weeklyCardDark: {
    backgroundColor: '#1E293B',
    borderColor: '#334155',
  },
  weeklyRow: {
    padding: 12,
  },
  weeklyRowDivider: {
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  weeklyStreetText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0F172A',
  },
  smallCategoryPill: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  smallCategoryPillText: {
    fontSize: 9,
    fontWeight: '800',
    color: '#FFFFFF',
    textTransform: 'uppercase',
  },
  daysTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#DCFCE7',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  daysTagText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#166534',
  },
  timeTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  timeTagText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#475569',
  },
  offDutyNoticeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.15)',
    paddingTop: 12,
    marginTop: 4,
  },
  offDutyNoticeText: {
    fontSize: 12,
    fontWeight: '600',
    color: 'rgba(255, 255, 255, 0.8)',
  },
});
