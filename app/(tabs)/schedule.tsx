import { useAuthContext } from '@/components/AuthContext';
import PickupDetailsModal from '@/components/PickupDetailsModal';
import { IconSymbol } from '@/components/ui/IconSymbol';
import { db } from '@/config/firebase';
import { Colors } from '@/constants/Colors';
import { useTheme } from '@/hooks/useTheme';
import { ScheduleData, ScheduleNotificationService } from '@/services/scheduleNotificationService';
import { collection, onSnapshot } from 'firebase/firestore';
import React, { useEffect, useMemo, useState } from 'react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Dimensions, Image, Modal, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import MapView, { Marker } from '@/components/MapView';
import { Calendar } from 'react-native-calendars';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

export default function ScheduleScreen() {
  const { theme } = useTheme();
  const colors = Colors[theme ?? 'light'];
  const insets = useSafeAreaInsets();
  const { user } = useAuthContext();

  type RawSchedule = ScheduleData;

  const [currentMonth, setCurrentMonth] = useState<Date>(() => new Date(new Date().getFullYear(), new Date().getMonth(), 1));
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [rawSchedules, setRawSchedules] = useState<RawSchedule[]>([]);
  const [monthScheduleDates, setMonthScheduleDates] = useState<Record<string, RawSchedule[]>>({});
  const [showLegend, setShowLegend] = useState(false);
  const [showPickupModal, setShowPickupModal] = useState(false);
  const [selectedPickup, setSelectedPickup] = useState<RawSchedule | null>(null);
  const [showMapZoom, setShowMapZoom] = useState(false);

  const formatMonthYear = (d: Date) => d.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  const startOfWeekIndex = (d: Date) => {
    const day = new Date(d.getFullYear(), d.getMonth(), 1).getDay();
    return day === 0 ? 6 : day - 1; // Monday start
  };
  const daysInMonth = (d: Date) => new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
  const buildMonthDays = (d: Date): Array<Date | null> => {
    const leading = startOfWeekIndex(d);
    const total = daysInMonth(d);
    const cells: Array<Date | null> = [];
    for (let i = 0; i < leading; i++) cells.push(null);
    for (let i = 1; i <= total; i++) cells.push(new Date(d.getFullYear(), d.getMonth(), i));
    return cells;
  };
  const isSameDate = (a: Date, b: Date) => a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
  const formatDate = (d: Date) => d.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });

  const handlePickupPress = (pickup: RawSchedule) => {
    setSelectedPickup(pickup);
    setShowPickupModal(true);
  };

  const handleCloseModal = () => {
    setShowPickupModal(false);
    setSelectedPickup(null);
  };

  const CATEGORY_COLORS: Record<string, string> = useMemo(() => ({
    'Biodegradable': '#22C55E',
    'Non-Biodegradable': '#2563EB',
    'Recyclable': '#EAB308',
    'Residual': '#6B7280',
    'Hazardous': '#EF4444',
    'Special/Bulk': '#A855F7',
  }), []);

  const LEGEND_ITEMS = useMemo(() => [
    { name: 'Non-biodegradable', color: '#2563EB' },
    { name: 'Recyclable', color: '#EAB308' },
    { name: 'Residual', color: '#6B7280' },
    { name: 'Hazardous', color: '#EF4444' },
    { name: 'Biodegradable', color: '#22C55E' },
    { name: 'Special / Bulk Collection', color: '#A855F7' },
  ], []);

  // Robust US long-date parser (e.g., "September 4, 2025") for iOS JSC
  const MONTH_INDEX: Record<string, number> = useMemo(() => ({
    January: 0, February: 1, March: 2, April: 3, May: 4, June: 5,
    July: 6, August: 7, September: 8, October: 9, November: 10, December: 11,
  }), []);

  const parseUSLongDate = (text: string): Date | null => {
    if (!text || typeof text !== 'string') return null;
    
    // Clean up the input text
    const cleanText = text.trim();
    if (!cleanText) return null;
    
    // Try to handle different date formats
    try {
      // First try the US long format (e.g., "September 20, 2025")
      const match = cleanText.match(/^([A-Za-z]+)\s+(\d{1,2}),\s*(\d{4})$/);
      if (match) {
        const monthName = match[1];
        const day = parseInt(match[2], 10);
        const year = parseInt(match[3], 10);
        
        // Case-insensitive month lookup
        const monthKey = Object.keys(MONTH_INDEX).find(key => 
          key.toLowerCase() === monthName.toLowerCase()
        );
        const month = monthKey ? MONTH_INDEX[monthKey] : undefined;
        
        // Validate parsed values
        if (month === undefined) {
          console.warn('Unknown month name:', monthName, 'in date:', text);
          // Try fallback parsing
          const fallback = new Date(cleanText);
          if (!isNaN(fallback.getTime())) {
            console.log('Fallback parsing succeeded for:', text);
            return fallback;
          }
          return null;
        }
        if (Number.isNaN(day) || day < 1 || day > 31) {
          console.warn('Invalid day:', day, 'in date:', text);
          return null;
        }
        if (Number.isNaN(year) || year < 1900 || year > 2100) {
          console.warn('Invalid year:', year, 'in date:', text);
          return null;
        }
        
        // Create date and validate it
        const date = new Date(year, month, day);
        if (isNaN(date.getTime())) {
          console.warn('Created invalid date object for:', text);
          return null;
        }
        
        // Double-check the date components match (e.g., February 30 would become March 2)
        if (date.getFullYear() !== year || date.getMonth() !== month || date.getDate() !== day) {
          console.warn('Date overflow detected for:', text, 'resulted in:', date.toDateString());
          return null;
        }
        
        return date;
      }
      
      // Fallback to standard Date constructor with better validation
      const fallback = new Date(cleanText);
      if (!isNaN(fallback.getTime()) && fallback.getFullYear() > 1900 && fallback.getFullYear() < 2100) {
        return fallback;
      }
      
      console.warn('Could not parse date:', text);
      return null;
    } catch (error) {
      console.error('Error parsing date:', text, error);
      return null;
    }
  };

  // Subscribe to schedules from backend (Firestore)
  useEffect(() => {
    if (!db) return;
    const unsub = onSnapshot(collection(db, 'schedules'), async (snap) => {
      const rows: RawSchedule[] = [];
      snap.forEach((doc) => {
        const d: any = doc.data();
        rows.push({ id: doc.id, ...d });
      });
      setRawSchedules(rows);
      
      // Upsert notifications only for this user's schedules
      try {
        if (user?.uid) {
          const myRows = rows.filter((r: any) => r.userId === user.uid);
          for (const r of myRows) {
            await ScheduleNotificationService.upsertScheduleNotifications({
              ...r,
              userId: user.uid,
            } as any);
          }
        }
      } catch (error) {
        console.error('Error upserting pickup notifications:', error);
      }
    });
    return () => unsub();
  }, [user?.uid]);

  // Expand recurring schedules for current month
  useEffect(() => {
    const mapping: Record<string, RawSchedule[]> = {};
    const year = currentMonth.getFullYear();
    const month = currentMonth.getMonth();
    const daysIn = (new Date(year, month + 1, 0)).getDate();

    const push = (d: Date, sched: RawSchedule) => {
      const key = `${d.getFullYear()}-${(d.getMonth()+1).toString().padStart(2,'0')}-${d.getDate().toString().padStart(2,'0')}`;
      if (!mapping[key]) mapping[key] = [];
      mapping[key].push(sched);
    };

    for (const s of rawSchedules) {
      const baseParsed = parseUSLongDate(s.dateText) || new Date(s.dateText);
      if (!(baseParsed instanceof Date) || isNaN(baseParsed.getTime())) {
        continue; // skip unparseable dates on iOS
      }
      const [monthStr, dayStr, yearStr] = baseParsed
        .toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric' })
        .split('/');
      const base = new Date(parseInt(yearStr,10), parseInt(monthStr,10)-1, parseInt(dayStr,10));

      switch ((s.frequency || 'One-time').toLowerCase()) {
        case 'daily': {
          for (let d = 1; d <= daysIn; d++) push(new Date(year, month, d), s);
          break;
        }
        case 'weekly': {
          const targetDow = base.getDay();
          for (let d = 1; d <= daysIn; d++) {
            const date = new Date(year, month, d);
            if (date.getDay() === targetDow) push(date, s);
          }
          break;
        }
        case 'monthly': {
          const targetDom = base.getDate();
          const date = new Date(year, month, Math.min(targetDom, daysIn));
          push(date, s);
          break;
        }
        default: {
          if (base.getFullYear() === year && base.getMonth() === month) push(base, s);
        }
      }
    }
    setMonthScheduleDates(mapping);
  }, [currentMonth, rawSchedules]);

  const markedDates = useMemo(() => {
    const dates: any = {};
    
    // Add schedule markers
    Object.keys(monthScheduleDates).forEach(key => {
      const items = monthScheduleDates[key];
      if (items.length > 0) {
        const allCompleted = items.every((it: any) => (it.status || '').toLowerCase() === 'completed');
        const color = CATEGORY_COLORS[items[0].wasteCategory] || colors.primary;
        
        dates[key] = {
          customStyles: {
            container: {
              backgroundColor: allCompleted ? '#F1F5F9' : color,
              borderWidth: allCompleted ? 1 : 0,
              borderColor: '#E2E8F0',
              borderRadius: 8,
            },
            text: {
              color: allCompleted ? '#94A3B8' : 'white',
              fontWeight: '700'
            }
          }
        };
      }
    });

    // Add selected date marker
    if (selectedDate) {
      const selKey = `${selectedDate.getFullYear()}-${(selectedDate.getMonth()+1).toString().padStart(2,'0')}-${selectedDate.getDate().toString().padStart(2,'0')}`;
      
      if (dates[selKey]) {
        // preserve the schedule color but add a border for selection
        dates[selKey] = {
          ...dates[selKey],
          customStyles: {
            ...dates[selKey].customStyles,
            container: {
              ...dates[selKey].customStyles.container,
              borderWidth: 2,
              borderColor: colors.primary,
            }
          }
        };
      } else {
        // empty day selected
        dates[selKey] = {
          customStyles: {
            container: {
              borderWidth: 2,
              borderColor: colors.primary,
              backgroundColor: 'transparent',
              borderRadius: 8,
            },
            text: {
              color: colors.textPrimary,
              fontWeight: '700'
            }
          }
        };
      }
    }

    return dates;
  }, [monthScheduleDates, selectedDate, CATEGORY_COLORS, colors]);

  return (
    <ScrollView style={[styles.container, { backgroundColor: colors.background }]}
      contentContainerStyle={styles.contentContainer}
    >
      {/* Header */}
      <View style={[
        styles.header, 
        { 
          backgroundColor: colors.primary, 
          paddingTop: Math.max(insets.top, 20),
          height: undefined, // remove fixed height
          minHeight: 90
        }
      ]}> 
        <Text style={styles.headerTitle}>Schedule Pickups</Text>
      </View>

      {/* Map Tracker (Moved to Top) */}
      <View style={[styles.mapCard, { backgroundColor: colors.surface }]}>
        <View style={styles.mapHeader}>
          <IconSymbol name="map" size={20} color={colors.primary} />
          <Text style={[styles.mapTitle, { color: colors.textPrimary }]}>Live Tracker (API)</Text>
        </View>
        <Text style={[styles.mapSubtitle, { color: colors.textSecondary }]}>
          Track the current location of the trash collector in real-time.
        </Text>
        <TouchableOpacity style={styles.mapImageContainer} activeOpacity={0.9} onPress={() => setShowMapZoom(true)}>
          <MapView
            style={styles.mapImage}
            initialRegion={{
              latitude: 10.5217,
              longitude: 124.0253, // Danao, Cebu
              latitudeDelta: 0.05,
              longitudeDelta: 0.05,
            }}
            pitchEnabled={false}
            rotateEnabled={false}
            scrollEnabled={false}
            zoomEnabled={false}
          >
            <Marker
              coordinate={{ latitude: 10.5217, longitude: 124.0253 }}
              title="Trash Truck"
              description="Currently collecting in Danao..."
            >
              <View style={{ backgroundColor: colors.primary, padding: 6, borderRadius: 20 }}>
                <IconSymbol name="car.fill" size={24} color="white" />
              </View>
            </Marker>
          </MapView>
          <View style={styles.mapOverlay} pointerEvents="none">
            <View style={styles.liveIndicator}>
              <View style={styles.liveDot} />
              <Text style={styles.liveText}>LIVE</Text>
            </View>
            <View style={styles.etaContainer}>
              <Text style={styles.mapEtaText}>Arriving in ~15 mins</Text>
            </View>
          </View>
        </TouchableOpacity>
      </View>

      {/* API-backed calendar */}
      <View style={[styles.calendarCard, { backgroundColor: colors.surface, padding: 0, overflow: 'hidden' }]}> 
        <Calendar
          markingType={'custom'}
          markedDates={markedDates}
          onDayPress={(day: any) => {
            const parts = day.dateString.split('-');
            setSelectedDate(new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10)));
          }}
          onMonthChange={(month: any) => {
            setCurrentMonth(new Date(month.year, month.month - 1, 1));
          }}
          theme={{
            backgroundColor: colors.surface,
            calendarBackground: colors.surface,
            textSectionTitleColor: colors.textSecondary,
            todayTextColor: colors.primary,
            dayTextColor: colors.textPrimary,
            textDisabledColor: '#d9e1e8',
            arrowColor: colors.primary,
            monthTextColor: colors.textPrimary,
            indicatorColor: colors.primary,
            textDayFontWeight: '500',
            textMonthFontWeight: 'bold',
            textDayHeaderFontWeight: '600',
            textDayFontSize: 14,
            textMonthFontSize: 16,
            textDayHeaderFontSize: 12
          }}
        />
      </View>

      {/* Legend Dropdown */}
      <View style={[styles.legendCard, { backgroundColor: colors.surface }]}>
        <TouchableOpacity 
          style={styles.legendHeader}
          onPress={() => setShowLegend(!showLegend)}
        >
          <Text style={[styles.legendTitle, { color: colors.textPrimary }]}>
            Waste Category Legend
          </Text>
          <IconSymbol 
            name={showLegend ? "chevron.up" : "chevron.down"} 
            size={20} 
            color={colors.textSecondary} 
          />
        </TouchableOpacity>
        
        {showLegend && (
          <View style={styles.legendContent}>
            {LEGEND_ITEMS.map((item, index) => (
              <View key={index} style={styles.legendItem}>
                <View style={[styles.legendColorBox, { backgroundColor: item.color }]} />
                <Text style={[styles.legendText, { color: colors.textPrimary }]}>
                  {item.name}
                </Text>
              </View>
            ))}
          </View>
        )}
      </View>

      {/* Pickup location info (API-backed) */}
      <View style={styles.infoSection}>
        <Text style={[styles.infoTitle, { color: colors.textSecondary }]}>Pickup Location Info</Text>

        {selectedDate ? (
          (monthScheduleDates[`${selectedDate.getFullYear()}-${(selectedDate.getMonth()+1).toString().padStart(2,'0')}-${selectedDate.getDate().toString().padStart(2,'0')}`] || []).length > 0 ? (
            <>
              {(monthScheduleDates[`${selectedDate.getFullYear()}-${(selectedDate.getMonth()+1).toString().padStart(2,'0')}-${selectedDate.getDate().toString().padStart(2,'0')}`] || []).map((s) => (
                <TouchableOpacity 
                  key={s.id} 
                  style={[styles.infoItem, { backgroundColor: colors.surface }, (s as any).status && (s as any).status.toLowerCase() === 'completed' ? { opacity: 0.55 } : null]}
                  onPress={() => handlePickupPress(s)}
                  activeOpacity={0.7}
                > 
                  <IconSymbol name="calendar" size={18} color={colors.primary} />
                  <Text style={styles.infoText}>
                    {s.dateText} • {s.timeText} • {s.wasteCategory} • {s.street}
                  </Text>
                  <IconSymbol name="chevron.right" size={16} color={colors.textSecondary} />
                </TouchableOpacity>
              ))}
            </>
          ) : (
            <View style={[styles.infoItem, { backgroundColor: colors.surface }]}> 
              <IconSymbol name="info.circle" size={18} color={colors.primary} />
              <Text style={styles.infoText}>No pickups on {formatDate(selectedDate)}</Text>
            </View>
          )
        ) : (
          <View style={[styles.infoItem, { backgroundColor: colors.surface }]}> 
            <IconSymbol name="info.circle" size={18} color={colors.primary} />
            <Text style={styles.infoText}>Select a date to view pickups</Text>
          </View>
        )}
      </View>

      {/* Pickup Details Modal */}
      <PickupDetailsModal
        visible={showPickupModal}
        onClose={handleCloseModal}
        pickupData={selectedPickup}
      />

      {/* Fullscreen Map Modal */}
      <Modal visible={showMapZoom} transparent animationType="slide" onRequestClose={() => setShowMapZoom(false)}>
        <View style={styles.fullscreenMapContainer}>
          <MapView
            style={styles.fullscreenMapImage}
            initialRegion={{
              latitude: 10.5217,
              longitude: 124.0253, // Danao, Cebu
              latitudeDelta: 0.05,
              longitudeDelta: 0.05,
            }}
            showsUserLocation
          >
            <Marker
              coordinate={{ latitude: 10.5217, longitude: 124.0253 }}
              title="Trash Truck"
              description="Currently collecting in Danao..."
            >
              <View style={{ backgroundColor: colors.primary, padding: 8, borderRadius: 20 }}>
                <IconSymbol name="car.fill" size={28} color="white" />
              </View>
            </Marker>
          </MapView>
          
          <TouchableOpacity style={styles.fullscreenMapClose} onPress={() => setShowMapZoom(false)}>
            <IconSymbol name="xmark.circle.fill" size={36} color="#333" />
          </TouchableOpacity>
          
          <View style={styles.fullscreenMapOverlay} pointerEvents="none">
            <View style={styles.liveIndicator}>
              <View style={styles.liveDot} />
              <Text style={styles.liveText}>LIVE</Text>
            </View>
            <View style={styles.etaContainer}>
              <Text style={styles.mapEtaText}>Arriving in ~15 mins</Text>
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
  },
  contentContainer: {
    paddingBottom: 120,
  },
  header: {
    height: 90,
    justifyContent: 'flex-end',
    paddingHorizontal: 20,
    paddingBottom: 16,
    borderBottomLeftRadius: 0,
    borderBottomRightRadius: 0,
  },
  headerTitle: {
    color: 'white',
    fontSize: 18,
    fontWeight: '600',
  },
  heroCard: {
    marginTop: 16,
    marginHorizontal: 16,
    height: 120,
    borderRadius: 12,
    overflow: 'hidden',
  },
  heroImage: {
    width: '100%',
    height: '100%',
  },
  calendarCard: {
    marginTop: 16,
    marginHorizontal: 16,
    borderRadius: 12,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
  },
  calendarHeader: {
    marginBottom: 12,
  },
  calendarMonth: {
    fontWeight: '600',
  },
  weekdaysRow: {
    flexDirection: 'row',
    marginBottom: 8,
  },
  weekdayCell: {
    width: `${100 / 7}%`,
    alignItems: 'center',
    paddingVertical: 4,
  },
  weekdayText: {
    fontSize: 12,
    fontWeight: '700',
  },
  calendarGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  calendarCell: {
    width: `${100 / 7}%`,
    paddingVertical: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  calendarDay: {
    color: '#333',
  },
  legendCard: {
    marginTop: 16,
    marginHorizontal: 16,
    borderRadius: 12,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
  },
  legendHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 4,
  },
  legendTitle: {
    fontSize: 16,
    fontWeight: '600',
  },
  legendContent: {
    marginTop: 12,
    gap: 8,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 4,
  },
  legendColorBox: {
    width: 20,
    height: 20,
    borderRadius: 4,
  },
  legendText: {
    fontSize: 14,
    flex: 1,
  },
  fabAIBadge: {
    position: 'absolute',
    bottom: -18,
    left: 60,
    flexDirection: 'row',
    gap: 8,
  },
  badge: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: {
    color: 'white',
    fontWeight: '700',
  },
  infoSection: {
    marginTop: 32,
    marginHorizontal: 16,
    gap: 10,
  },
  infoTitle: {
    fontWeight: '600',
  },
  infoItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 12,
    borderRadius: 10,
  },
  infoText: {
    flex: 1,
  },
  mapCard: {
    marginTop: 16,
    marginHorizontal: 16,
    borderRadius: 12,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
  },
  mapHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  mapTitle: {
    fontSize: 16,
    fontWeight: '700',
  },
  mapSubtitle: {
    fontSize: 14,
    marginBottom: 12,
  },
  mapImageContainer: {
    width: '100%',
    height: 180,
    borderRadius: 12,
    overflow: 'hidden',
    position: 'relative',
    backgroundColor: '#E2E8F0', // fallback color
  },
  mapImage: {
    width: '100%',
    height: '100%',
  },
  mapOverlay: {
    position: 'absolute',
    top: 12,
    left: 12,
    right: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  liveIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(239, 68, 68, 0.9)', // Red background
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 16,
    gap: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 4,
  },
  liveDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: 'white',
  },
  liveText: {
    color: 'white',
    fontSize: 12,
    fontWeight: 'bold',
    letterSpacing: 0.5,
  },
  etaContainer: {
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 4,
  },
  mapEtaText: {
    color: '#333',
    fontSize: 13,
    fontWeight: '600',
  },
  zoomModalContainer: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.9)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  zoomModalClose: {
    position: 'absolute',
    top: 50,
    right: 20,
    zIndex: 10,
    padding: 10,
  },
  zoomScrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  zoomMapImage: {
    width: SCREEN_WIDTH,
    height: SCREEN_HEIGHT * 0.8,
  },
  fullscreenMapContainer: {
    flex: 1,
    backgroundColor: 'white',
    position: 'relative',
  },
  fullscreenMapImage: {
    flex: 1,
    width: '100%',
    height: '100%',
  },
  fullscreenMapClose: {
    position: 'absolute',
    top: 40,
    right: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.8)',
    borderRadius: 20,
    padding: 4,
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowOffset: { width: 0, height: 2 },
    elevation: 5,
  },
  fullscreenMapOverlay: {
    position: 'absolute',
    top: 50,
    left: 20,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
});


