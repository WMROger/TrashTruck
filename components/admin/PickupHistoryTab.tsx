import { collection, getDocs, limit, onSnapshot, orderBy, query } from 'firebase/firestore';
import React, { useEffect, useState } from 'react';
import { Alert, Platform, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
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

type Props = { 
  filter: 'today' | 'week' | 'month';
  selectedYear?: number;
  selectedMonth?: number;
  selectedWeek?: number;
  selectedDate?: number;
};

const PickupHistoryTab: React.FC<Props> = ({ 
  filter, 
  selectedYear = new Date().getFullYear(), 
  selectedMonth = new Date().getMonth(), 
  selectedWeek = 1, 
  selectedDate = new Date().getDate() 
}) => {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!db) return;
    const unsub = onSnapshot(collection(db, 'schedules'), () => {
      fetchRows();
    });
    return () => unsub();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filter, selectedYear, selectedMonth, selectedWeek, selectedDate]);

  const fetchRows = async () => {
    if (!db) return;
    setLoading(true);
    try {
      const ref = collection(db, 'schedules');
      const qy = query(ref, orderBy('createdAt', 'desc'), limit(100));
      const snap = await getDocs(qy);
      const all = snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) })) as any[];

      let start: Date; let end: Date;
      
      switch (filter) {
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


  const toCsv = (data: Row[]) => {
    const header = ['Email', 'Barangay', 'Street', 'Date', 'Title'];
    const rowsCsv = data.map((r) => [
      (r.userEmail || 'N/A').toString().replace(/\n|\r|,/g, ' '),
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
    const month = new Date(selectedYear, selectedMonth, 1).toLocaleDateString(undefined, { month: 'short' });
    const year = selectedYear;
    const filename = `pickup_completion_${month}_${year}.csv`;
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

  return (
    <ScrollView style={styles.content}>
      {/* Export button for all filters */}
      <View style={styles.exportBar}>
        <View style={{ flex: 1 }} />
        <TouchableOpacity onPress={exportCsv} style={styles.exportBtn}>
          <Text style={styles.exportIcon}>📥</Text>
          <Text style={[styles.exportBtnText, { marginLeft: 6 }]}>Export CSV</Text>
        </TouchableOpacity>
      </View>
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
  exportBar: { flexDirection: 'row', alignItems: 'center', padding: 12 },
  exportBtn: { flexDirection: 'row', alignItems: 'center', paddingVertical: 6, paddingHorizontal: 12, backgroundColor: '#234033', borderRadius: 6 },
  exportIcon: { fontSize: 14 },
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

export default PickupHistoryTab;


