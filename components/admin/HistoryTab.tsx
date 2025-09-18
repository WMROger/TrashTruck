import { Ionicons } from '@expo/vector-icons';
import { collection, doc, getDoc, getDocs, limit, onSnapshot, orderBy, query, where } from 'firebase/firestore';
import React, { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
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
  const shiftMonth = (delta: number) => {
    const d = new Date(selectedYear, selectedMonth + delta, 1);
    setSelectedYear(d.getFullYear());
    setSelectedMonth(d.getMonth());
  };
  const formatMonthYear = (y: number, m: number) => new Date(y, m, 1).toLocaleDateString(undefined, { month: 'short', year: 'numeric' });
  const [counts, setCounts] = useState<{ pickup: number; reports: number }>({ pickup: 0, reports: 0 });
  const [historyView, setHistoryView] = useState<'pickup' | 'reports'>('reports');
  const [items, setItems] = useState<Report[]>([]);
  const [loading, setLoading] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

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
      switch (historyFilter) {
        case 'today':
          start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
          end = null;
          break;
        case 'week':
          start = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
          end = null;
          break;
        case 'month':
          start = new Date(selectedYear, selectedMonth, 1);
          end = new Date(selectedYear, selectedMonth + 1, 1);
          break;
        default:
          start = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
          end = null;
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

  useEffect(() => { setCurrentPage(1); fetchItems(historyView); }, [historyView, historyFilter, selectedMonth, selectedYear]);

  const exportCSV = () => {
    try {
      const headers = 'Name,Barangay,Street,Date,Title,Status\n';
      const rows = items.map((r) => {
        const name = historyView === 'pickup'
          ? (r.userEmail || 'N/A')
          : (r.name || (r.userEmail || '').split('@')[0]);
        return `"${name}","${r.barangay}","${r.street}","${formatSimpleDate(r.createdAt)}","${r.title}","${r.status}"`;
      }).join('\n');
      const content = headers + rows;
      if (typeof window !== 'undefined' && window.URL && window.Blob) {
        const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'trash_history.csv';
        a.click();
        URL.revokeObjectURL(url);
      } else {
        console.log(content);
      }
    } catch (e) {
      console.warn('Export failed', e);
    }
  };

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

              {/* When Monthly is selected, show month navigator */}
              {historyFilter === 'month' && (
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginLeft: 8 }}>
                  <TouchableOpacity style={styles.monthNavButton} onPress={() => shiftMonth(-1)}>
                    <Text style={styles.monthNavText}>{'<'}</Text>
                  </TouchableOpacity>
                  <Text style={styles.monthLabel}>{formatMonthYear(selectedYear, selectedMonth)}</Text>
                  <TouchableOpacity style={styles.monthNavButton} onPress={() => shiftMonth(1)}>
                    <Text style={styles.monthNavText}>{'>'}</Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>
            <TouchableOpacity style={styles.exportSmallButton} onPress={exportCSV} activeOpacity={0.8}>
              <Ionicons name="download" size={16} color="#fff" />
              <Text style={styles.exportSmallButtonText}>Export</Text>
            </TouchableOpacity>
          </View>

          {historyView === 'pickup' ? (
            <PickupHistoryTab filter={historyFilter} />
          ) : (
            <ReportsHistoryTab filter={historyFilter} />
          )}

          {/* Pagination handled by child tabs as needed */}
        </View>
      </View>
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
  monthNavButton: { paddingHorizontal: 8, paddingVertical: 4, backgroundColor: '#EAF6EF', borderRadius: 6, borderWidth: 1, borderColor: '#CDE8D2' },
  monthNavText: { color: '#234033', fontWeight: '600' },
  monthLabel: { color: '#234033', fontWeight: '700' },
});

export default HistoryTab;


