import { collection, doc, getDoc, getDocs, limit, onSnapshot, orderBy, query, where } from 'firebase/firestore';
import React, { useEffect, useState } from 'react';
import { Modal, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { db } from '../../config/firebase';
import PickupHistoryTab from './PickupHistoryTab';
import ReportsHistoryTab from './ReportsHistoryTab';

type Report = {
  id: string;
  title: string;
  description?: string;
  barangay: string;
  street: string;
  userEmail: string;
  name?: string;
  userId?: string;
  status: string;
  createdAt: any;
};

const DEFAULT_BARANGAY = 'Sambag 2';

const formatSimpleDate = (ts: any) => {
  if (!ts) return 'N/A';
  try {
    const d = ts.toDate ? ts.toDate() : new Date(ts);
    return d.toLocaleDateString();
  } catch {
    return 'N/A';
  }
};

const HistoryTab: React.FC = () => {
  const [historyFilter, setHistoryFilter] = useState<'today' | 'week' | 'month'>('today');
  // Extended month selector for historical browsing (e.g., 6 months or 1 year ago)
  const nowRef = new Date();
  const [selectedMonth, setSelectedMonth] = useState<number>(nowRef.getMonth()); // 0..11
  const [selectedYear, setSelectedYear] = useState<number>(nowRef.getFullYear());
  const formatMonthYear = (y: number, m: number) => new Date(y, m, 1).toLocaleDateString(undefined, { month: 'short', year: 'numeric' });
  
  // Generate month options for the picker (last 24 months)
  const generateMonthOptions = () => {
    const options = [];
    const now = new Date();
    for (let i = 0; i < 24; i++) {
      const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
      options.push({
        year: date.getFullYear(),
        month: date.getMonth(),
        label: formatMonthYear(date.getFullYear(), date.getMonth())
      });
    }
    return options;
  };

  // Generate week options for the selected month (1-4 weeks)
  const generateWeekOptions = () => {
    const daysInMonth = new Date(selectedYear, selectedMonth + 1, 0).getDate();
    const weeks = Math.ceil(daysInMonth / 7);
    const options = [];
    for (let i = 1; i <= weeks; i++) {
      const weekStart = (i - 1) * 7 + 1;
      const weekEnd = Math.min(weekStart + 6, daysInMonth);
      options.push({
        week: i,
        label: `Week ${i} (${weekStart}-${weekEnd})`
      });
    }
    return options;
  };

  // Generate date options for the selected month (1-31)
  const generateDateOptions = () => {
    const daysInMonth = new Date(selectedYear, selectedMonth + 1, 0).getDate();
    const options = [];
    for (let i = 1; i <= daysInMonth; i++) {
      const date = new Date(selectedYear, selectedMonth, i);
      options.push({
        date: i,
        label: `${i} (${date.toLocaleDateString('en-US', { weekday: 'short' })})`
      });
    }
    return options;
  };
  const [counts, setCounts] = useState<{ pickup: number; reports: number }>({ pickup: 0, reports: 0 });
  const [historyView, setHistoryView] = useState<'pickup' | 'reports'>('reports');
  const [items, setItems] = useState<Report[]>([]);
  const [loading, setLoading] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;
  const [showMonthPicker, setShowMonthPicker] = useState(false);
  const [showWeekPicker, setShowWeekPicker] = useState(false);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [selectedWeek, setSelectedWeek] = useState(1); // 1-4 for weeks of the month
  const [selectedDate, setSelectedDate] = useState(new Date().getDate()); // 1-31 for specific date

  useEffect(() => {
    if (!db) return;
    const schedulesRef = collection(db, 'schedules');
    const reportsRef = collection(db, 'reports');
    const unsubSched = onSnapshot(schedulesRef, (snap) => {
      const all = snap.docs.map((d) => d.data() as any);
      const completed = all.filter((i) => ['completed', 'resolved', 'done'].includes((i.status || '').toString().toLowerCase()));
      setCounts((prev) => ({ ...prev, pickup: completed.length || all.length }));
    });
    const unsubRep = onSnapshot(reportsRef, (snap) => {
      const onlyResolved = snap.docs
        .map((d) => ({ id: d.id, ...(d.data() as any) }))
        .filter((r) => (r.status || '').toString().toLowerCase() === 'resolved');
      setCounts((prev) => ({ ...prev, reports: onlyResolved.length }));
    });
    return () => { unsubSched(); unsubRep(); };
  }, []);

  const fetchItems = async (type: 'pickup' | 'reports') => {
    if (!db) return;
    setLoading(true);
    try {
      const now = new Date();
      let start: Date; let end: Date | null = null;
      
      // Use selected month/year for all filters
      const baseDate = new Date(selectedYear, selectedMonth, 1);
      
      switch (historyFilter) {
        case 'today':
          // For today, use the specific selected date
          start = new Date(selectedYear, selectedMonth, selectedDate);
          end = new Date(selectedYear, selectedMonth, selectedDate + 1);
          break;
        case 'week':
          // For week, calculate the start and end of the selected week
          const weekStart = (selectedWeek - 1) * 7 + 1;
          const weekEnd = Math.min(weekStart + 7, new Date(selectedYear, selectedMonth + 1, 0).getDate() + 1);
          start = new Date(selectedYear, selectedMonth, weekStart);
          end = new Date(selectedYear, selectedMonth, weekEnd);
          break;
        case 'month':
          start = new Date(selectedYear, selectedMonth, 1);
          end = new Date(selectedYear, selectedMonth + 1, 1);
          break;
        default:
          start = new Date(selectedYear, selectedMonth, 1);
          end = new Date(selectedYear, selectedMonth + 1, 1);
      }

      if (type === 'pickup') {
        // Read from schedules to avoid restricted collections
        const ref = collection(db, 'schedules');
        const qy = query(ref, orderBy('createdAt', 'desc'), limit(50));
        const snap = await getDocs(qy);
        const data = snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) })) as any[];
        const filtered = data.filter((r) => {
          const status = (r.status || '').toString().toLowerCase();
          const createdMs = r.createdAt?.toDate ? r.createdAt.toDate().getTime() : (r.createdAt ? new Date(r.createdAt).getTime() : 0);
          const inStart = createdMs >= start.getTime();
          const inEnd = !end || createdMs < end.getTime();
          return ['completed', 'resolved', 'done'].includes(status) && inStart && inEnd;
        });
        const mapped: Report[] = filtered.map((r) => ({
          id: r.id,
          title: r.title || 'Pickup',
          description: r.description || '',
          barangay: DEFAULT_BARANGAY,
          street: r.street || '',
          // For pickups, stick strictly to the driver who completed
          userEmail: r.completedByEmail || 'N/A',
          name: r.completedByName || undefined,
          userId: r.completedByUid || undefined,
          status: r.status || 'completed',
          createdAt: r.createdAt || r.scheduledAt,
        }));
        const enriched = await resolveNames(mapped);
        setItems(enriched);
      } else {
        // Reports: fetch then filter by date and resolved status client-side
        const ref = collection(db, 'reports');
        const qy = query(ref, orderBy('createdAt', 'desc'), limit(50));
        const snap = await getDocs(qy);
        const data = snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) })) as any[];
        const filtered = data.filter((r) => {
          const createdMs = r.createdAt?.toDate ? r.createdAt.toDate().getTime() : (r.createdAt ? new Date(r.createdAt).getTime() : 0);
          const status = (r.status || '').toString().toLowerCase();
          const inStart = createdMs >= start.getTime();
          const inEnd = !end || createdMs < end.getTime();
          return inStart && inEnd && status === 'resolved';
        });
        const mapped: Report[] = filtered.map((r) => ({
          id: r.id,
          title: r.title || 'Untitled',
          description: r.description || '',
          barangay: DEFAULT_BARANGAY,
          street: r.street || '',
          userEmail: r.userEmail || r.createdBy || 'N/A',
          name: r.userName || undefined,
          userId: r.userId || undefined,
          status: r.status || 'resolved',
          createdAt: r.createdAt,
        }));
        const enriched = await resolveNames(mapped);
        setItems(enriched);
      }
    } finally {
      setLoading(false);
    }
  };

  // Resolve human-readable names for items using users collection
  const resolveNames = async (rows: Report[]): Promise<Report[]> => {
    try {
      const cache = new Map<string, string>();
      const results: Report[] = [];
      for (const r of rows) {
        // If name is provided and looks like a proper display name, keep it
        if (r.name && !r.name.includes('@')) {
          results.push(r);
          continue;
        }

        let resolved: string | undefined;

        // For pickup rows, prefer to resolve strictly by driver identity only
        // If we have a completedByUid, use it. Otherwise, fallback to completedByEmail.
        // Prefer lookup by userId
        if (r.userId) {
          const key = `uid:${r.userId}`;
          if (cache.has(key)) {
            resolved = cache.get(key);
          } else {
            try {
              const snap = await getDoc(doc(db, 'users', r.userId));
              const data: any = snap.exists() ? snap.data() : null;
              resolved = data?.displayName || data?.name || data?.fullName;
              if (resolved) cache.set(key, resolved);
            } catch {}
          }
        }

        // Fallback: lookup by email
        if (!resolved && r.userEmail) {
          const email = r.userEmail.toString();
          const key = `email:${email}`;
          if (cache.has(key)) {
            resolved = cache.get(key);
          } else {
            try {
              const qy = query(collection(db, 'users'), where('email', '==', email), limit(1));
              const snap = await getDocs(qy);
              const docSnap = snap.docs[0];
              const data: any = docSnap ? docSnap.data() : null;
              resolved = data?.displayName || data?.name || data?.fullName;
              if (resolved) cache.set(key, resolved);
            } catch {}
          }
        }

        // If no name resolved, display the email username part
        results.push({ ...r, name: resolved || r.name || (r.userEmail ? r.userEmail.split('@')[0] : 'N/A') });
      }
      return results;
    } catch {
      return rows.map((r) => ({ ...r, name: r.name || (r.userEmail ? r.userEmail.split('@')[0] : 'N/A') }));
    }
  };

  useEffect(() => { 
    setCurrentPage(1); 
    fetchItems(historyView); 
  }, [historyView, historyFilter, selectedMonth, selectedYear, selectedWeek, selectedDate]);

 
  const totalPages = Math.max(1, Math.ceil(items.length / itemsPerPage));
  const paginatedItems = items.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  return (
    <ScrollView style={styles.content}>
      <View style={styles.historyContainer}>
        <View style={styles.historyHeaderRow}>
          <View>
            <Text style={styles.historyTitle}>History</Text>
            <Text style={styles.historySubtitle}>Showing your all histories with a clear view</Text>
          </View>
         
        </View>
        <View style={styles.historyDivider} />

        <View style={styles.historyCardsRow}>
          <TouchableOpacity
            style={[styles.historyCard, { backgroundColor: '#FFE7B3', borderColor: '#F7D78A' }, historyView === 'pickup' && { borderWidth: 2 }]}
            onPress={() => setHistoryView('pickup')}
            activeOpacity={0.8}
          >
            <Text style={styles.historyCardTitle}>Pickup Completion</Text>
            <Text style={[styles.historyCardNumber, { color: '#D97706' }]}>{counts.pickup}</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.historyCard, { backgroundColor: '#FFD6D6', borderColor: '#F4B4B4' }, historyView === 'reports' && { borderWidth: 2 }]}
            onPress={() => setHistoryView('reports')}
            activeOpacity={0.8}
          >
            <Text style={styles.historyCardTitle}>Trash Reports</Text>
            <Text style={[styles.historyCardNumber, { color: '#DC2626' }]}>{counts.reports}</Text>
          </TouchableOpacity>
        </View>

        <View style={{ marginTop: 24 }}>
          <Text style={styles.blockTitle}>{historyView === 'pickup' ? 'Pickup Completion' : 'Trash Reports'}</Text>
          <View style={styles.filterRowWithExport}>
            <View style={{ flexDirection: 'row', gap: 8 }}>
              {(['today','week','month'] as const).map((key) => (
                <TouchableOpacity
                  key={key}
                  style={[styles.historyFilterTab, historyFilter === key && styles.historyFilterTabActive]}
                  onPress={() => setHistoryFilter(key)}
                  activeOpacity={0.8}
                >
                  <Text style={[styles.historyFilterTabText, historyFilter === key && styles.historyFilterTabTextActive]}>
                    {key === 'week' ? 'Weekly' : key === 'month' ? 'Monthly' : 'Today'}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
            
            {/* Dynamic Selectors based on filter type */}
            <View style={styles.selectorsRow}>
              {/* Month Selector for all filters */}
              <TouchableOpacity
                style={styles.monthSelector}
                onPress={() => setShowMonthPicker(true)}
                activeOpacity={0.8}
              >
                <Text style={styles.monthSelectorText}>
                  📅 {formatMonthYear(selectedYear, selectedMonth)}
                </Text>
              </TouchableOpacity>

              {/* Week Selector for weekly filter */}
              {historyFilter === 'week' && (
                <TouchableOpacity
                  style={styles.weekSelector}
                  onPress={() => setShowWeekPicker(true)}
                  activeOpacity={0.8}
                >
                  <Text style={styles.weekSelectorText}>
                    📆 Week {selectedWeek}
                  </Text>
                </TouchableOpacity>
              )}

              {/* Date Selector for today filter */}
              {historyFilter === 'today' && (
                <TouchableOpacity
                  style={styles.dateSelector}
                  onPress={() => setShowDatePicker(true)}
                  activeOpacity={0.8}
                >
                  <Text style={styles.dateSelectorText}>
                    📅 {selectedDate}
                  </Text>
                </TouchableOpacity>
              )}
            </View>
          </View>

          {historyView === 'pickup' ? (
            <PickupHistoryTab 
              filter={historyFilter} 
              selectedYear={selectedYear}
              selectedMonth={selectedMonth}
              selectedWeek={selectedWeek}
              selectedDate={selectedDate}
            />
          ) : (
            <ReportsHistoryTab 
              filter={historyFilter} 
              selectedYear={selectedYear}
              selectedMonth={selectedMonth}
              selectedWeek={selectedWeek}
              selectedDate={selectedDate}
            />
          )}

          {/* Pagination handled by child tabs as needed */}
        </View>
      </View>

      {/* Month Picker Modal */}
      <Modal
        visible={showMonthPicker}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowMonthPicker(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.monthPickerContainer}>
            <View style={styles.monthPickerHeader}>
              <Text style={styles.monthPickerTitle}>Select Month</Text>
              <TouchableOpacity
                style={styles.monthPickerClose}
                onPress={() => setShowMonthPicker(false)}
              >
                <Text style={styles.monthPickerCloseText}>✕</Text>
              </TouchableOpacity>
            </View>
            
            <ScrollView style={styles.monthPickerList}>
              {generateMonthOptions().map((option, index) => (
                <TouchableOpacity
                  key={`${option.year}-${option.month}`}
                  style={[
                    styles.monthPickerItem,
                    selectedYear === option.year && selectedMonth === option.month && styles.monthPickerItemSelected
                  ]}
                  onPress={() => {
                    setSelectedYear(option.year);
                    setSelectedMonth(option.month);
                    setShowMonthPicker(false);
                  }}
                  activeOpacity={0.8}
                >
                  <Text style={[
                    styles.monthPickerItemText,
                    selectedYear === option.year && selectedMonth === option.month && styles.monthPickerItemTextSelected
                  ]}>
                    {option.label}
                  </Text>
                  {selectedYear === option.year && selectedMonth === option.month && (
                    <Text style={styles.monthPickerItemCheck}>✓</Text>
                  )}
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Week Picker Modal */}
      <Modal
        visible={showWeekPicker}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowWeekPicker(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.monthPickerContainer}>
            <View style={styles.monthPickerHeader}>
              <Text style={styles.monthPickerTitle}>Select Week</Text>
              <TouchableOpacity
                style={styles.monthPickerClose}
                onPress={() => setShowWeekPicker(false)}
              >
                <Text style={styles.monthPickerCloseText}>✕</Text>
              </TouchableOpacity>
            </View>
            
            <ScrollView style={styles.monthPickerList}>
              {generateWeekOptions().map((option) => (
                <TouchableOpacity
                  key={option.week}
                  style={[
                    styles.monthPickerItem,
                    selectedWeek === option.week && styles.monthPickerItemSelected
                  ]}
                  onPress={() => {
                    setSelectedWeek(option.week);
                    setShowWeekPicker(false);
                  }}
                  activeOpacity={0.8}
                >
                  <Text style={[
                    styles.monthPickerItemText,
                    selectedWeek === option.week && styles.monthPickerItemTextSelected
                  ]}>
                    {option.label}
                  </Text>
                  {selectedWeek === option.week && (
                    <Text style={styles.monthPickerItemCheck}>✓</Text>
                  )}
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Date Picker Modal */}
      <Modal
        visible={showDatePicker}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowDatePicker(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.monthPickerContainer}>
            <View style={styles.monthPickerHeader}>
              <Text style={styles.monthPickerTitle}>Select Date</Text>
              <TouchableOpacity
                style={styles.monthPickerClose}
                onPress={() => setShowDatePicker(false)}
              >
                <Text style={styles.monthPickerCloseText}>✕</Text>
              </TouchableOpacity>
            </View>
            
            <ScrollView style={styles.monthPickerList}>
              {generateDateOptions().map((option) => (
                <TouchableOpacity
                  key={option.date}
                  style={[
                    styles.monthPickerItem,
                    selectedDate === option.date && styles.monthPickerItemSelected
                  ]}
                  onPress={() => {
                    setSelectedDate(option.date);
                    setShowDatePicker(false);
                  }}
                  activeOpacity={0.8}
                >
                  <Text style={[
                    styles.monthPickerItemText,
                    selectedDate === option.date && styles.monthPickerItemTextSelected
                  ]}>
                    {option.label}
                  </Text>
                  {selectedDate === option.date && (
                    <Text style={styles.monthPickerItemCheck}>✓</Text>
                  )}
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  content: { flex: 1 },
  historyContainer: { backgroundColor: '#EAF6EF', borderRadius: 12, padding: 16, borderWidth: 1, borderColor: '#CDE8D2' },
  historyHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  historyTitle: { fontSize: 18, fontWeight: 'bold', color: '#234033' },
  historySubtitle: { fontSize: 12, color: '#242E21' },
  historyDivider: { height: 1, backgroundColor: '#CDE8D2', marginVertical: 12 },
  historyCardsRow: { flexDirection: 'row', gap: 12 },
  historyCard: { flex: 1, borderWidth: 1, borderRadius: 10, padding: 16 },
  historyCardTitle: { fontSize: 12, color: '#234033' },
  historyCardNumber: { fontSize: 36, fontWeight: 'bold', marginTop: 8 },
  blockTitle: { fontSize: 16, fontWeight: 'bold', color: '#234033', marginBottom: 12 },
  historyFilterTab: { paddingVertical: 8, paddingHorizontal: 12, borderRadius: 6, backgroundColor: '#ffffff' },
  historyFilterTabActive: { backgroundColor: '#234033' },
  historyFilterTabText: { fontSize: 12, color: '#234033' },
  historyFilterTabTextActive: { color: '#ffffff' },
  historyTable: { backgroundColor: '#ffffff', borderRadius: 8, borderWidth: 1, borderColor: '#CDE8D2' },
  historyTableRow: { flexDirection: 'row', paddingVertical: 10, paddingHorizontal: 12, alignItems: 'center' },
  historyTableHeader: { backgroundColor: '#ECF5EE' },
  historyTableHeaderText: { fontWeight: 'bold', color: '#234033' },
  historyTableRowEven: { backgroundColor: '#ffffff' },
  historyTableRowOdd: { backgroundColor: '#F5FBF7' },
  historyTableCell: { flex: 1, fontSize: 12, color: '#234033' },
  colName: { flex: 1.2 },
  colBarangay: { flex: 1 },
  colStreet: { flex: 1 },
  colDate: { flex: 0.8 },
  colTitle: { flex: 1.2 },
  exportSmallButton: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#234033', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8, gap: 6 },
  exportSmallButtonText: { color: 'white', fontSize: 12, fontWeight: '600' },
  filterRowWithExport: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  paginationContainer: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 12 },
  paginationButton: { paddingHorizontal: 12, paddingVertical: 8, backgroundColor: '#234033', borderRadius: 6 },
  paginationButtonDisabled: { backgroundColor: '#E5E7EB' },
  paginationButtonText: { color: 'white', fontSize: 12, fontWeight: '600' },
  paginationButtonTextDisabled: { color: '#888' },
  paginationInfo: { fontSize: 12, color: '#234033' },
  // Selectors Row
  selectorsRow: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
  },
  // Month Selector Styles
  monthSelector: {
    backgroundColor: '#234033',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  monthSelectorText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  // Week Selector Styles
  weekSelector: {
    backgroundColor: '#D97706',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  weekSelectorText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  // Date Selector Styles
  dateSelector: {
    backgroundColor: '#059669',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  dateSelectorText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  // Month Picker Modal Styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  monthPickerContainer: {
    backgroundColor: '#fff',
    borderRadius: 16,
    width: '90%',
    maxWidth: 350,
    maxHeight: '70%',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 10,
    },
    shadowOpacity: 0.25,
    shadowRadius: 20,
    elevation: 15,
  },
  monthPickerHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  monthPickerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#234033',
  },
  monthPickerClose: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  monthPickerCloseText: {
    color: '#6B7280',
    fontSize: 16,
    fontWeight: 'bold',
  },
  monthPickerList: {
    maxHeight: 300,
  },
  monthPickerItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  monthPickerItemSelected: {
    backgroundColor: '#EAF6EF',
  },
  monthPickerItemText: {
    fontSize: 16,
    color: '#374151',
    fontWeight: '500',
  },
  monthPickerItemTextSelected: {
    color: '#234033',
    fontWeight: '600',
  },
  monthPickerItemCheck: {
    color: '#234033',
    fontSize: 16,
    fontWeight: 'bold',
  },
});

export default HistoryTab;


