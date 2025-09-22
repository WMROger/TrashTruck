import { Ionicons } from '@expo/vector-icons';
import { collection, doc, getDoc, getDocs, limit, onSnapshot, orderBy, query, where } from 'firebase/firestore';
import React, { useEffect, useMemo, useState } from 'react';
import { Alert, Platform, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { db } from '../../config/firebase';

type Row = {
  id: string;
  title: string;
  barangay: string;
  street: string;
  name: string;
  status: string;
  createdAt: any;
  userEmail?: string;
  userId?: string;
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

type Props = { filter: 'today' | 'week' | 'month' };

const ReportsHistoryTab: React.FC<Props> = ({ filter }) => {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(false);
  const [currentMonth, setCurrentMonth] = useState<Date>(new Date());

  useEffect(() => {
    if (!db) return;
    const unsub = onSnapshot(collection(db, 'reports'), () => {
      fetchRows();
    });
    return () => unsub();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filter, currentMonth]);

  const fetchRows = async () => {
    if (!db) return;
    setLoading(true);
    try {
      const ref = collection(db, 'reports');
      const qy = query(ref, orderBy('createdAt', 'desc'), limit(100));
      const snap = await getDocs(qy);
      const all = snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) })) as any[];

      const now = new Date();
      const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
      let start = startOfDay(now);
      let end = new Date(start.getTime() + 24 * 60 * 60 * 1000); // tomorrow
      if (filter === 'week') {
        start = new Date(start.getTime() - 7 * 24 * 60 * 60 * 1000);
        end = new Date(startOfDay(now).getTime() + 24 * 60 * 60 * 1000);
      } else if (filter === 'month') {
        const base = currentMonth;
        start = new Date(base.getFullYear(), base.getMonth(), 1);
        end = new Date(base.getFullYear(), base.getMonth() + 1, 1);
      }

      const filtered = all.filter((r) => {
        const status = (r.status || '').toString().toLowerCase();
        const createdMs = r.createdAt?.toDate ? r.createdAt.toDate().getTime() : (r.createdAt ? new Date(r.createdAt).getTime() : 0);
        return status === 'resolved' && createdMs >= start.getTime() && createdMs < end.getTime();
      });

      const mapped: Row[] = filtered.map((r) => ({
        id: r.id,
        title: r.title || 'Untitled',
        barangay: DEFAULT_BARANGAY,
        street: r.street || '',
        name: (r.userName && String(r.userName).trim()) || '',
        status: r.status || 'resolved',
        createdAt: r.createdAt,
        userEmail: r.userEmail || r.createdBy || '',
        userId: r.userId || '',
      }));
      const enriched = await resolveNames(mapped);
      setRows(enriched);
    } finally {
      setLoading(false);
    }
  };

  const monthLabel = useMemo(() => {
    const base = currentMonth;
    return base.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
  }, [currentMonth]);

  const goPrevMonth = () => {
    setCurrentMonth((prev) => new Date(prev.getFullYear(), prev.getMonth() - 1, 1));
  };

  const goNextMonth = () => {
    setCurrentMonth((prev) => new Date(prev.getFullYear(), prev.getMonth() + 1, 1));
  };

  const toCsv = (data: Row[]) => {
    const header = ['Name', 'Barangay', 'Street', 'Date', 'Title'];
    const rowsCsv = data.map((r) => [
      (r.name || 'N/A').toString().replace(/\n|\r|,/g, ' '),
      r.barangay.replace(/\n|\r|,/g, ' '),
      (r.street || '').toString().replace(/\n|\r|,/g, ' '),
      formatSimpleDate(r.createdAt),
      r.title.replace(/\n|\r|,/g, ' '),
    ].join(','));
    return [header.join(','), ...rowsCsv].join('\n');
  };

  const exportCsv = () => {
    if (rows.length === 0) {
      Alert.alert('Nothing to export', 'No rows in this period.');
      return;
    }
    const base = filter === 'month' ? currentMonth : new Date();
    const month = base.toLocaleDateString(undefined, { month: 'short' });
    const year = base.getFullYear();
    const filename = `reports_resolved_${month}_${year}.csv`;
    const csv = toCsv(rows);
    if (Platform.OS === 'web') {
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } else {
      Alert.alert('Export', 'CSV export is currently available on web.');
    }
  };

  const resolveNames = async (rows: Row[]): Promise<Row[]> => {
    const cache = new Map<string, string>();
    const out: Row[] = [];
    for (const r of rows) {
      let name = r.name?.trim();
      if (!name) {
        // Try by userId first
        if (r.userId) {
          const key = `uid:${r.userId}`;
          if (cache.has(key)) {
            name = cache.get(key) as string;
          } else {
            try {
              const snap = await getDoc(doc(db, 'users', r.userId));
              const data: any = snap.exists() ? snap.data() : null;
              name = data?.displayName || data?.name || data?.fullName || '';
              if (name) cache.set(key, name);
            } catch {}
          }
        }
        // Fallback: lookup by email
        if (!name && r.userEmail) {
          const email = r.userEmail.toString();
          const key = `email:${email}`;
          if (cache.has(key)) {
            name = cache.get(key) as string;
          } else {
            try {
              const qy = query(collection(db, 'users'), where('email', '==', email), limit(1));
              const snap = await getDocs(qy);
              const docSnap = snap.docs[0];
              const data: any = docSnap ? docSnap.data() : null;
              name = data?.displayName || data?.name || data?.fullName || '';
              if (name) cache.set(key, name);
            } catch {}
          }
          if (!name) {
            // Use email username as last resort
            name = email.split('@')[0];
          }
        }
      }
      out.push({ ...r, name: name || 'N/A' });
    }
    return out;
  };

  return (
    <ScrollView style={styles.content}>
      {filter === 'month' && (
        <View style={styles.monthBar}>
          <TouchableOpacity onPress={goPrevMonth} style={styles.monthBtn}>
            <Text style={styles.monthBtnText}>{'‹'}</Text>
          </TouchableOpacity>
          <Text style={styles.monthLabel}>{monthLabel}</Text>
          <TouchableOpacity onPress={goNextMonth} style={styles.monthBtn}>
            <Text style={styles.monthBtnText}>{'›'}</Text>
          </TouchableOpacity>
          <View style={{ flex: 1 }} />
          <TouchableOpacity onPress={exportCsv} style={styles.exportBtn}>
            <Ionicons name="download" size={14} color="#fff" />
            <Text style={[styles.exportBtnText, { marginLeft: 6 }]}>Export CSV</Text>
          </TouchableOpacity>
        </View>
      )}
      <View style={styles.historyTable}>
        <View style={[styles.historyTableRow, styles.historyTableHeader]}>
          <Text style={[styles.historyTableCell, styles.colName, styles.headerText]}>Name</Text>
          <Text style={[styles.historyTableCell, styles.colBarangay, styles.headerText]}>Barangay</Text>
          <Text style={[styles.historyTableCell, styles.colStreet, styles.headerText]}>Street</Text>
          <Text style={[styles.historyTableCell, styles.colDate, styles.headerText]}>Date</Text>
          <Text style={[styles.historyTableCell, styles.colTitle, styles.headerText]}>Title</Text>
        </View>
        {loading ? (
          <View style={{ padding: 16 }}><Text style={{ color: '#234033' }}>Loading...</Text></View>
        ) : rows.length === 0 ? (
          <View style={{ padding: 16 }}><Text style={{ color: '#234033' }}>No data in this period.</Text></View>
        ) : (
          rows.map((r, idx) => (
            <View key={r.id} style={[styles.historyTableRow, idx % 2 === 0 ? styles.rowEven : styles.rowOdd]}>
              <Text style={[styles.historyTableCell, styles.colName]} numberOfLines={1}>{r.name}</Text>
              <Text style={[styles.historyTableCell, styles.colBarangay]} numberOfLines={1}>{r.barangay}</Text>
              <Text style={[styles.historyTableCell, styles.colStreet]} numberOfLines={1}>{r.street}</Text>
              <Text style={[styles.historyTableCell, styles.colDate]} numberOfLines={1}>{formatSimpleDate(r.createdAt)}</Text>
              <Text style={[styles.historyTableCell, styles.colTitle]} numberOfLines={1}>{r.title}</Text>
            </View>
          ))
        )}
      </View>

      {/* Filter controls are managed by the parent HistoryTab */}
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  content: { flex: 1 },
  monthBar: { flexDirection: 'row', alignItems: 'center', padding: 12, gap: 8 },
  monthBtn: { paddingHorizontal: 10, paddingVertical: 6, backgroundColor: '#ECF5EE', borderRadius: 6 },
  monthBtnText: { color: '#234033', fontWeight: 'bold', fontSize: 16 },
  monthLabel: { color: '#234033', fontWeight: 'bold', fontSize: 16, minWidth: 140, textAlign: 'center' },
  exportBtn: { flexDirection: 'row', alignItems: 'center', paddingVertical: 6, paddingHorizontal: 12, backgroundColor: '#234033', borderRadius: 6 },
  exportBtnText: { color: '#fff', fontSize: 12, fontWeight: '600' },
  historyTable: { backgroundColor: '#ffffff', borderRadius: 8, borderWidth: 1, borderColor: '#CDE8D2' },
  historyTableRow: { flexDirection: 'row', paddingVertical: 10, paddingHorizontal: 12, alignItems: 'center' },
  historyTableHeader: { backgroundColor: '#ECF5EE' },
  headerText: { fontWeight: 'bold', color: '#234033' },
  rowEven: { backgroundColor: '#ffffff' },
  rowOdd: { backgroundColor: '#F5FBF7' },
  historyTableCell: { flex: 1, fontSize: 12, color: '#234033' },
  colName: { flex: 1.2 },
  colBarangay: { flex: 1 },
  colStreet: { flex: 1 },
  colDate: { flex: 0.8 },
  colTitle: { flex: 1.2 },
  filterTab: { paddingVertical: 8, paddingHorizontal: 12, borderRadius: 6, backgroundColor: '#ffffff' },
  filterTabActive: { backgroundColor: '#234033' },
  filterTabText: { fontSize: 12, color: '#234033' },
  filterTabTextActive: { color: '#ffffff' },
});

export default ReportsHistoryTab;


