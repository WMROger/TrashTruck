import { IconSymbol } from '@/components/ui/IconSymbol';
import { db } from '@/config/firebase';
import { Colors } from '@/constants/Colors';
import { useTheme } from '@/hooks/useTheme';
import { collection, onSnapshot } from 'firebase/firestore';
import React, { useEffect, useMemo, useState } from 'react';
import { Image, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

export default function ScheduleScreen() {
  const { theme } = useTheme();
  const colors = Colors[theme ?? 'light'];

  type RawSchedule = {
    id: string;
    userId: string;
    dateText: string; // e.g., "August 17, 2025"
    timeText: string; // e.g., "07:00"
    street: string;
    frequency: string; // One-time | Daily | Weekly | Monthly
    wasteCategory: string;
    truck?: string;
    driver?: string;
    note?: string;
  };

  const [currentMonth, setCurrentMonth] = useState<Date>(() => new Date(new Date().getFullYear(), new Date().getMonth(), 1));
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [rawSchedules, setRawSchedules] = useState<RawSchedule[]>([]);
  const [monthScheduleDates, setMonthScheduleDates] = useState<Record<string, RawSchedule[]>>({});

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

  const CATEGORY_COLORS: Record<string, string> = useMemo(() => ({
    'Biodegradable': '#22C55E',
    'Non-Biodegradable': '#2563EB',
    'Recyclable': '#EAB308',
    'Residual': '#6B7280',
    'Hazardous': '#EF4444',
    'Special/Bulk': '#A855F7',
  }), []);

  // Robust US long-date parser (e.g., "September 4, 2025") for iOS JSC
  const MONTH_INDEX: Record<string, number> = useMemo(() => ({
    January: 0, February: 1, March: 2, April: 3, May: 4, June: 5,
    July: 6, August: 7, September: 8, October: 9, November: 10, December: 11,
  }), []);

  const parseUSLongDate = (text: string): Date | null => {
    if (!text || typeof text !== 'string') return null;
    const match = text.match(/^([A-Za-z]+)\s+(\d{1,2}),\s*(\d{4})$/);
    if (!match) return null;
    const monthName = match[1];
    const day = parseInt(match[2], 10);
    const year = parseInt(match[3], 10);
    const month = MONTH_INDEX[monthName];
    if (month === undefined || Number.isNaN(day) || Number.isNaN(year)) return null;
    return new Date(year, month, day);
  };

  // Subscribe to schedules from backend (Firestore)
  useEffect(() => {
    if (!db) return;
    const unsub = onSnapshot(collection(db, 'schedules'), (snap) => {
      const rows: RawSchedule[] = [];
      snap.forEach((doc) => {
        const d: any = doc.data();
        rows.push({ id: doc.id, ...d });
      });
      setRawSchedules(rows);
    });
    return () => unsub();
  }, []);

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

  return (
    <ScrollView style={[styles.container, { backgroundColor: colors.background }]}
      contentContainerStyle={styles.contentContainer}
    >
      {/* Header */}
      <View style={[styles.header, { backgroundColor: colors.primary }]}> 
        <Text style={styles.headerTitle}>Schedule Pickups</Text>
      </View>

      {/* Hero image */}
      <View style={styles.heroCard}>
        <Image
          source={require('../../assets/images/Schedule_trashtrack.png')}
          style={styles.heroImage}
          resizeMode="cover"
        />
      </View>

      {/* API-backed calendar */}
      <View style={[styles.calendarCard, { backgroundColor: colors.surface }]}> 
        <View style={styles.calendarHeader}> 
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <TouchableOpacity onPress={() => setCurrentMonth(prev => new Date(prev.getFullYear(), prev.getMonth() - 1, 1))}>
              <Text style={{ color: colors.primary }}>{'<'} Prev</Text>
            </TouchableOpacity>
            <Text style={styles.calendarMonth}>{formatMonthYear(currentMonth)}</Text>
            <TouchableOpacity onPress={() => setCurrentMonth(prev => new Date(prev.getFullYear(), prev.getMonth() + 1, 1))}>
              <Text style={{ color: colors.primary }}>Next {'>'}</Text>
            </TouchableOpacity>
          </View>
        </View>
        <View style={styles.calendarGrid}>
          {buildMonthDays(currentMonth).map((cell, index) => {
            if (!cell) return <View key={`e-${index}`} style={styles.calendarCell} />;
            const key = `${cell.getFullYear()}-${(cell.getMonth()+1).toString().padStart(2,'0')}-${cell.getDate().toString().padStart(2,'0')}`;
            const items = monthScheduleDates[key] || [];
            const hasItems = items.length > 0;
            const color = hasItems ? (CATEGORY_COLORS[items[0].wasteCategory] || colors.primary) : undefined;
            const isSelected = selectedDate && isSameDate(cell, selectedDate);
            return (
              <TouchableOpacity key={cell.toISOString()} style={[styles.calendarCell, hasItems ? { backgroundColor: color, borderRadius: 8 } : null, isSelected ? { borderWidth: 1, borderColor: colors.primary } : null]} onPress={() => setSelectedDate(cell)}>
                <Text style={[styles.calendarDay, hasItems ? { color: 'white', fontWeight: '700' } : null]}>{cell.getDate()}</Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      {/* Pickup location info (API-backed) */}
      <View style={styles.infoSection}>
        <Text style={[styles.infoTitle, { color: colors.textSecondary }]}>Pickup Location Info</Text>

        {selectedDate ? (
          (monthScheduleDates[`${selectedDate.getFullYear()}-${(selectedDate.getMonth()+1).toString().padStart(2,'0')}-${selectedDate.getDate().toString().padStart(2,'0')}`] || []).length > 0 ? (
            <>
              {(monthScheduleDates[`${selectedDate.getFullYear()}-${(selectedDate.getMonth()+1).toString().padStart(2,'0')}-${selectedDate.getDate().toString().padStart(2,'0')}`] || []).map((s) => (
                <View key={s.id} style={[styles.infoItem, { backgroundColor: colors.surface }]}> 
                  <IconSymbol name="calendar" size={18} color={colors.primary} />
                  <Text style={styles.infoText}>
                    {s.dateText} • {s.timeText} • {s.wasteCategory} • {s.street}
                  </Text>
                </View>
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
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  contentContainer: {
    paddingBottom: 24,
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
});


