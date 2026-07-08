import { collection, getDocs, limit, onSnapshot, orderBy, query } from 'firebase/firestore';
import React, { useEffect, useState } from 'react';
import { Alert, Image, Modal, Platform, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { db } from '../../config/firebase';

type Row = {
  id: string;
  title: string;
  barangay: string;
  street: string;
  userEmail: string;
  status: string;
  createdAt: any;
  driverName?: string;
  wasteCategory?: string;
  note?: string;
  completionImage?: string | null;
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
  const [selectedItem, setSelectedItem] = useState<Row | null>(null);
  const [modalVisible, setModalVisible] = useState(false);
  const [imagePreviewUrl, setImagePreviewUrl] = useState<string | null>(null);
  const [isImagePreviewVisible, setIsImagePreviewVisible] = useState(false);

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
        title: r.title || r.wasteCategory || 'Pickup',
        barangay: DEFAULT_BARANGAY,
        street: r.street || '',
        userEmail: r.completedByEmail || r.completedBy || r.driverEmail || r.userEmail || 'N/A',
        status: r.status || 'completed',
        createdAt: r.completedAt || r.createdAt,
        driverName: r.driver || r.assignedDriverName || r.completedBy || '',
        wasteCategory: r.wasteCategory || 'General',
        note: r.note || r.description || '',
        completionImage: r.completionImage || r.imageURL || null,
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

  const handleView = (item: Row) => {
    setSelectedItem(item);
    setModalVisible(true);
  };

  const handleCloseModal = () => {
    setModalVisible(false);
    setSelectedItem(null);
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
            <TouchableOpacity key={r.id} style={[styles.historyTableRow, idx % 2 === 0 ? styles.rowEven : styles.rowOdd, styles.clickableRow]} activeOpacity={0.7} onPress={() => handleView(r)}>
              <Text style={[styles.historyTableCell, styles.colName]} numberOfLines={1}>{r.userEmail || 'N/A'}</Text>
              <Text style={[styles.historyTableCell, styles.colBarangay]} numberOfLines={1}>{r.barangay}</Text>
              <Text style={[styles.historyTableCell, styles.colStreet]} numberOfLines={1}>{r.street}</Text>
              <Text style={[styles.historyTableCell, styles.colDate]} numberOfLines={1}>{formatSimpleDate(r.createdAt)}</Text>
              <Text style={[styles.historyTableCell, styles.colTitle]} numberOfLines={1}>{r.title}</Text>
            </TouchableOpacity>
          ))
        )}
      </View>

      {/* Detail Modal */}
      <Modal
        visible={modalVisible}
        transparent={true}
        animationType="fade"
        onRequestClose={handleCloseModal}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            {selectedItem && (
              <>
                <View style={styles.modalHeader}>
                  <Text style={styles.modalTitle}>Pickup - {selectedItem.wasteCategory || 'Waste Collection'}</Text>
                  <TouchableOpacity style={styles.closeButton} onPress={handleCloseModal}>
                    <Text style={styles.closeButtonText}>✕</Text>
                  </TouchableOpacity>
                </View>
                <Text style={styles.modalDate}>Completed: {formatSimpleDate(selectedItem.createdAt)}</Text>

                {selectedItem.completionImage && (
                  <TouchableOpacity
                    style={styles.modalImageContainer}
                    activeOpacity={0.9}
                    onPress={() => { setImagePreviewUrl(selectedItem.completionImage!); setIsImagePreviewVisible(true); }}
                  >
                    <Image source={{ uri: selectedItem.completionImage }} style={styles.modalImage} resizeMode="cover" />
                  </TouchableOpacity>
                )}

                <View style={styles.modalSection}>
                  <Text style={styles.modalSectionTitle}>Location:</Text>
                  <Text style={styles.modalBulletPoint}>• Barangay: {selectedItem.barangay}</Text>
                  <Text style={styles.modalBulletPoint}>• Street: {selectedItem.street || 'N/A'}</Text>
                </View>

                <View style={styles.modalSection}>
                  <Text style={styles.modalSectionTitle}>Completed By:</Text>
                  <Text style={styles.modalBulletPoint}>• Driver: {selectedItem.driverName || 'Unknown'}</Text>
                  <Text style={styles.modalBulletPoint}>• Email: {selectedItem.userEmail}</Text>
                </View>

                {selectedItem.note ? (
                  <View style={styles.modalSection}>
                    <Text style={styles.modalSectionTitle}>Notes:</Text>
                    <Text style={styles.modalDescription}>{selectedItem.note}</Text>
                  </View>
                ) : null}
              </>
            )}
          </View>
        </View>
      </Modal>

      {/* Image Preview Modal */}
      <Modal
        visible={isImagePreviewVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setIsImagePreviewVisible(false)}
      >
        <View style={styles.previewOverlay}>
          <View style={styles.previewContainer}>
            <ScrollView contentContainerStyle={styles.previewScroll} maximumZoomScale={3} minimumZoomScale={1} centerContent>
              {imagePreviewUrl ? (
                <Image source={{ uri: imagePreviewUrl }} style={styles.previewImage} resizeMode="contain" />
              ) : null}
            </ScrollView>
            <TouchableOpacity style={styles.previewClose} onPress={() => setIsImagePreviewVisible(false)}>
              <Text style={styles.previewCloseText}>✕</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

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
  clickableRow: { borderLeftWidth: 3, borderLeftColor: 'transparent' },
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
  // Modal styles
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0, 0, 0, 0.5)', justifyContent: 'center', alignItems: 'center', padding: 20 },
  modalContainer: { backgroundColor: 'white', borderRadius: 12, padding: 24, width: '100%', maxWidth: 500, maxHeight: '90%', shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.25, shadowRadius: 8, elevation: 8 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 },
  modalTitle: { fontSize: 18, fontWeight: 'bold', color: '#1F2937', flex: 1, marginRight: 16 },
  closeButton: { padding: 4 },
  closeButtonText: { fontSize: 18, color: '#6B7280', fontWeight: 'bold' },
  modalDate: { fontSize: 14, color: '#6B7280', marginBottom: 16 },
  modalImageContainer: { marginBottom: 20, borderRadius: 8, overflow: 'hidden' },
  modalImage: { width: '100%', height: 200 },
  modalSection: { marginBottom: 16 },
  modalSectionTitle: { fontSize: 16, fontWeight: 'bold', color: '#1F2937', marginBottom: 8 },
  modalBulletPoint: { fontSize: 14, color: '#6B7280', marginLeft: 8, marginBottom: 4 },
  modalDescription: { fontSize: 14, color: '#6B7280', lineHeight: 20 },
  // Image preview styles
  previewOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.85)', justifyContent: 'center', alignItems: 'center', padding: 20 },
  previewContainer: { width: '100%', maxWidth: 900, maxHeight: '90%', borderRadius: 12, overflow: 'hidden' },
  previewScroll: { alignItems: 'center', justifyContent: 'center', minHeight: 300 },
  previewImage: { width: '100%', height: '100%' },
  previewClose: { position: 'absolute', top: 12, right: 12, backgroundColor: 'rgba(0,0,0,0.5)', borderRadius: 16, padding: 6 },
  previewCloseText: { color: 'white', fontSize: 18, fontWeight: 'bold' },
});

export default PickupHistoryTab;


