import { collection, getDocs, limit, onSnapshot, orderBy, query } from 'firebase/firestore';
import React, { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { db } from '../../config/firebase';

type Row = {
  id: string;
  title: string;
  barangay: string;
  street: string;
  userEmail: string;
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

type Props = { filter: 'today' | 'week' | 'month' };

const PickupHistoryTab: React.FC<Props> = ({ filter }) => {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!db) return;
    const unsub = onSnapshot(collection(db, 'schedules'), () => {
      fetchRows();
    });
    return () => unsub();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filter]);

  const fetchRows = async () => {
    if (!db) return;
    setLoading(true);
    try {
      const ref = collection(db, 'schedules');
      const qy = query(ref, orderBy('createdAt', 'desc'), limit(100));
      const snap = await getDocs(qy);
      const all = snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) })) as any[];

      const now = new Date();
      const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
      let start = startOfDay(now);
      let end = new Date(start.getTime() + 24 * 60 * 60 * 1000);
      if (filter === 'week') {
        start = new Date(start.getTime() - 7 * 24 * 60 * 60 * 1000);
        end = new Date(startOfDay(now).getTime() + 24 * 60 * 60 * 1000);
      } else if (filter === 'month') {
        start = new Date(now.getFullYear(), now.getMonth(), 1);
        end = new Date(now.getFullYear(), now.getMonth() + 1, 1);
      }

      const filtered = all.filter((r) => {
        const status = (r.status || '').toString().toLowerCase();
        const createdMs = r.createdAt?.toDate ? r.createdAt.toDate().getTime() : (r.createdAt ? new Date(r.createdAt).getTime() : 0);
        return ['completed', 'resolved', 'done'].includes(status) && createdMs >= start.getTime() && createdMs < end.getTime();
      });

      const mapped: Row[] = filtered.map((r) => ({
        id: r.id,
        title: r.title || 'Pickup',
        barangay: DEFAULT_BARANGAY,
        street: r.street || '',
        userEmail: r.completedByEmail || r.completedBy || r.driverEmail || r.userEmail || 'N/A',
        status: r.status || 'completed',
        createdAt: r.completedAt || r.createdAt,
      }));
      setRows(mapped);
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScrollView style={styles.content}>
      <View style={styles.historyTable}>
        <View style={[styles.historyTableRow, styles.historyTableHeader]}>
          <Text style={[styles.historyTableCell, styles.colName, styles.headerText]}>Email</Text>
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
              <Text style={[styles.historyTableCell, styles.colName]} numberOfLines={1}>{r.userEmail || 'N/A'}</Text>
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

export default PickupHistoryTab;


