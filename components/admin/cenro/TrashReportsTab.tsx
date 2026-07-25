import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TextInput, TouchableOpacity, Modal, Image, ActivityIndicator } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { db } from '../../../config/firebase';
import { collection, query, onSnapshot, doc, updateDoc, addDoc, serverTimestamp, Timestamp, orderBy } from 'firebase/firestore';

type ReportStatus = 'pending' | 'acknowledged' | 'in-progress' | 'resolved';

interface StatusHistoryItem {
  status: string;
  notes: string;
  timestamp: any;
  adminEmail: string;
}

interface Report {
  id: string;
  title: string;
  description: string;
  barangay: string;
  street: string;
  landmark: string;
  imageURL: string | null;
  location: { latitude: number; longitude: number } | null;
  userId: string;
  userEmail: string;
  createdAt: any;
  status: ReportStatus;
  aiAnalysis: { wasteType: string; estimatedWeight: string; confidence: string; details: string } | null;
  updatedAt?: any;
  statusHistory?: StatusHistoryItem[];
  adminNotes?: string;
}

export default function TrashReportsTab() {
  const [activeTab, setActiveTab] = useState<'active' | 'history'>('active');
  const [reports, setReports] = useState<Report[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  
  // Modal state
  const [selectedReport, setSelectedReport] = useState<Report | null>(null);
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [adminNotes, setAdminNotes] = useState('');
  const [updating, setUpdating] = useState(false);

  useEffect(() => {
    const reportsRef = collection(db, 'reports');
    const q = query(reportsRef, orderBy('createdAt', 'desc'));
    
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data: Report[] = [];
      snapshot.forEach((doc) => {
        data.push({ id: doc.id, ...doc.data() } as Report);
      });
      setReports(data);
      
      // Update selected report if it changes while modal is open
      if (selectedReport) {
        const updatedSelected = data.find(r => r.id === selectedReport.id);
        if (updatedSelected) {
          setSelectedReport(updatedSelected);
        }
      }
      
      setLoading(false);
    }, (error) => {
      console.error("Error fetching reports:", error);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const totalReports = reports.length;
  const pendingCount = reports.filter(r => r.status === 'pending').length;
  const inProgressCount = reports.filter(r => r.status === 'in-progress' || r.status === 'acknowledged').length;
  const resolvedCount = reports.filter(r => r.status === 'resolved').length;

  const activeReports = reports.filter(r => r.status !== 'resolved' && (
    r.title?.toLowerCase().includes(searchQuery.toLowerCase()) || 
    r.barangay?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    r.street?.toLowerCase().includes(searchQuery.toLowerCase())
  ));

  const historyReports = reports.filter(r => r.status === 'resolved' && (
    r.title?.toLowerCase().includes(searchQuery.toLowerCase()) || 
    r.barangay?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    r.street?.toLowerCase().includes(searchQuery.toLowerCase())
  ));

  const formatDate = (timestamp: any) => {
    if (!timestamp) return 'N/A';
    // Handle both Firestore Timestamp and ISO string
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    if (isNaN(date.getTime())) return 'Invalid Date';
    return date.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending': return { color: '#f59e0b', bg: '#fef3c7' }; // Yellow
      case 'acknowledged': return { color: '#3b82f6', bg: '#dbeafe' }; // Blue
      case 'in-progress': return { color: '#f97316', bg: '#ffedd5' }; // Orange
      case 'resolved': return { color: '#2E8B57', bg: '#dcfce7' }; // Green
      default: return { color: '#6B7280', bg: '#f3f4f6' };
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'pending': return 'Pending';
      case 'acknowledged': return 'Acknowledged';
      case 'in-progress': return 'In Progress';
      case 'resolved': return 'Resolved';
      default: return status.toUpperCase();
    }
  };

  const openReportDetail = (report: Report) => {
    setSelectedReport(report);
    setAdminNotes('');
    setIsModalVisible(true);
  };

  const handleUpdateStatus = async (newStatus: ReportStatus) => {
    if (!selectedReport) return;
    setUpdating(true);
    
    try {
      const reportRef = doc(db, 'reports', selectedReport.id);
      
      const newHistoryItem = {
        status: newStatus,
        notes: adminNotes || '',
        timestamp: serverTimestamp(),
        adminEmail: 'admin@cenro.gov.ph' // Placeholder for auth user
      };
      
      const currentHistory = selectedReport.statusHistory || [];
      
      await updateDoc(reportRef, {
        status: newStatus,
        updatedAt: serverTimestamp(),
        statusHistory: [...currentHistory, newHistoryItem]
      });

      // Send notification
      await addDoc(collection(db, 'notifications'), {
        userId: selectedReport.userId,
        type: 'report_status_update',
        reportId: selectedReport.id,
        reportTitle: selectedReport.title,
        oldStatus: selectedReport.status,
        newStatus: newStatus,
        adminNotes: adminNotes || '',
        read: false,
        createdAt: serverTimestamp()
      });
      
      setAdminNotes('');
    } catch (error) {
      console.error("Error updating report:", error);
      alert("Failed to update report status.");
    } finally {
      setUpdating(false);
    }
  };

  const renderStatusActions = () => {
    if (!selectedReport) return null;
    
    let nextStatus: ReportStatus | null = null;
    let buttonText = '';
    let buttonColor = '';
    
    if (selectedReport.status === 'pending') {
      nextStatus = 'acknowledged';
      buttonText = 'Acknowledge';
      buttonColor = '#3b82f6';
    } else if (selectedReport.status === 'acknowledged') {
      nextStatus = 'in-progress';
      buttonText = 'Mark In Progress';
      buttonColor = '#f97316';
    } else if (selectedReport.status === 'in-progress') {
      nextStatus = 'resolved';
      buttonText = 'Mark Resolved';
      buttonColor = '#2E8B57';
    } else {
      return null;
    }

    return (
      <View style={styles.actionContainer}>
        <TextInput
          style={styles.notesInput}
          placeholder="Add a note for the resident..."
          placeholderTextColor="#9CA3AF"
          value={adminNotes}
          onChangeText={setAdminNotes}
          multiline
        />
        <TouchableOpacity 
          style={[styles.actionBtn, { backgroundColor: buttonColor }]}
          onPress={() => handleUpdateStatus(nextStatus!)}
          disabled={updating}
        >
          {updating ? (
            <ActivityIndicator color="#fff" size="small" />
          ) : (
            <Text style={styles.actionBtnText}>{buttonText}</Text>
          )}
        </TouchableOpacity>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.headerRow}>
        <View>
          <Text style={styles.headerTitle}>Trash Reports</Text>
          <Text style={styles.headerDesc}>Manage and track citizen-reported waste issues.</Text>
        </View>
        <View style={styles.headerActions}>
          <TouchableOpacity style={styles.outlineBtn}>
            <MaterialIcons name="file-download" size={18} color="#374151" />
            <Text style={styles.outlineBtnText}>Export CSV</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Summary Cards */}
      <View style={styles.summaryRow}>
        <View style={styles.summaryCard}>
          <Text style={styles.summaryCardTitle}>Total Reports</Text>
          <Text style={styles.summaryCardValue}>{totalReports}</Text>
        </View>
        <View style={styles.summaryCard}>
          <Text style={styles.summaryCardTitle}>Pending</Text>
          <Text style={[styles.summaryCardValue, { color: '#f59e0b' }]}>{pendingCount}</Text>
        </View>
        <View style={styles.summaryCard}>
          <Text style={styles.summaryCardTitle}>In Progress</Text>
          <Text style={[styles.summaryCardValue, { color: '#f97316' }]}>{inProgressCount}</Text>
        </View>
        <View style={styles.summaryCard}>
          <Text style={styles.summaryCardTitle}>Resolved</Text>
          <Text style={[styles.summaryCardValue, { color: '#2E8B57' }]}>{resolvedCount}</Text>
        </View>
      </View>

      {/* Main Content Card */}
      <View style={styles.card}>
        <View style={styles.tabsRow}>
          <TouchableOpacity 
            style={[styles.tab, activeTab === 'active' && styles.activeTab]}
            onPress={() => setActiveTab('active')}
          >
            <Text style={[styles.tabText, activeTab === 'active' && styles.activeTabText]}>Active Reports</Text>
          </TouchableOpacity>
          <TouchableOpacity 
            style={[styles.tab, activeTab === 'history' && styles.activeTab]}
            onPress={() => setActiveTab('history')}
          >
            <Text style={[styles.tabText, activeTab === 'history' && styles.activeTabText]}>Report History</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.filtersRow}>
          <View style={styles.searchBox}>
            <MaterialIcons name="search" size={20} color="#9CA3AF" />
            <TextInput 
              style={styles.searchInput} 
              placeholder="Search by title, barangay, street..." 
              placeholderTextColor="#9CA3AF" 
              value={searchQuery}
              onChangeText={setSearchQuery}
            />
          </View>
        </View>

        {loading ? (
          <ActivityIndicator size="large" color="#2E8B57" style={{ marginTop: 40 }} />
        ) : (
          <View>
            <View style={styles.tableHead}>
              <Text style={[styles.th, { flex: 2 }]}>REPORT</Text>
              <Text style={[styles.th, { flex: 1.5 }]}>LOCATION</Text>
              <Text style={[styles.th, { flex: 1 }]}>WASTE TYPE</Text>
              <Text style={[styles.th, { flex: 1 }]}>{activeTab === 'history' ? 'RESOLVED DATE' : 'STATUS'}</Text>
              <Text style={[styles.th, { flex: 1 }]}>{activeTab === 'active' ? 'DATE' : 'ACTIONS'}</Text>
            </View>

            {(activeTab === 'active' ? activeReports : historyReports).length === 0 ? (
              <Text style={styles.emptyText}>No reports found.</Text>
            ) : (
              (activeTab === 'active' ? activeReports : historyReports).map((report, i) => {
                const statusColors = getStatusColor(report.status);
                return (
                  <TouchableOpacity key={report.id} style={styles.tableRow} onPress={() => openReportDetail(report)}>
                    <View style={[styles.td, { flex: 2 }]}>
                      <Text style={styles.reportTitle} numberOfLines={1}>{report.title}</Text>
                      <Text style={styles.reportDesc} numberOfLines={1}>{report.description}</Text>
                    </View>
                    <View style={[styles.td, { flex: 1.5 }]}>
                      <Text style={styles.brgyName} numberOfLines={1}>{report.barangay}</Text>
                      <Text style={styles.streetName} numberOfLines={1}>{report.street}</Text>
                    </View>
                    <View style={[styles.td, { flex: 1 }]}>
                      <Text style={styles.wasteTypeText}>{report.aiAnalysis?.wasteType || 'Unknown'}</Text>
                    </View>
                    <View style={[styles.td, { flex: 1 }]}>
                      {activeTab === 'history' ? (
                        <Text style={styles.dateTextTable}>{formatDate(report.updatedAt || report.createdAt)}</Text>
                      ) : (
                        <View style={[styles.statusBadge, { backgroundColor: statusColors.bg }]}>
                          <Text style={[styles.statusText, { color: statusColors.color }]}>{getStatusLabel(report.status)}</Text>
                        </View>
                      )}
                    </View>
                    <View style={[styles.td, { flex: 1 }]}>
                      {activeTab === 'active' ? (
                        <Text style={styles.dateTextTable}>{formatDate(report.createdAt)}</Text>
                      ) : (
                        <TouchableOpacity style={styles.viewBtn} onPress={() => openReportDetail(report)}>
                          <Text style={styles.viewBtnText}>View Details</Text>
                        </TouchableOpacity>
                      )}
                    </View>
                  </TouchableOpacity>
                );
              })
            )}
          </View>
        )}
      </View>

      {/* Report Detail Modal */}
      {isModalVisible && selectedReport && (
        <Modal transparent visible={isModalVisible} animationType="fade">
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Report Details</Text>
                <TouchableOpacity onPress={() => setIsModalVisible(false)}>
                  <MaterialIcons name="close" size={24} color="#6B7280" />
                </TouchableOpacity>
              </View>

              <ScrollView style={styles.modalScroll}>
                <View style={styles.modalBody}>
                  <View style={styles.modalLeft}>
                    {selectedReport.imageURL ? (
                      <Image source={{ uri: selectedReport.imageURL }} style={styles.reportImage} />
                    ) : (
                      <View style={styles.noImagePlaceholder}>
                        <MaterialIcons name="image-not-supported" size={40} color="#9CA3AF" />
                        <Text style={styles.noImageText}>No Image Provided</Text>
                      </View>
                    )}
                    
                    <View style={styles.detailsGroup}>
                      <Text style={styles.detailLabel}>TITLE</Text>
                      <Text style={styles.detailValue}>{selectedReport.title}</Text>
                    </View>

                    <View style={styles.detailsGroup}>
                      <Text style={styles.detailLabel}>DESCRIPTION</Text>
                      <Text style={styles.detailValue}>{selectedReport.description}</Text>
                    </View>

                    <View style={styles.detailsGroup}>
                      <Text style={styles.detailLabel}>LOCATION</Text>
                      <Text style={styles.detailValue}>{selectedReport.street}, {selectedReport.barangay}</Text>
                      {selectedReport.landmark && <Text style={styles.detailSubValue}>Landmark: {selectedReport.landmark}</Text>}
                    </View>

                    <View style={styles.detailsGroup}>
                      <Text style={styles.detailLabel}>REPORTER</Text>
                      <Text style={styles.detailValue}>{selectedReport.userEmail}</Text>
                      <Text style={styles.detailSubValue}>Submitted: {formatDate(selectedReport.createdAt)}</Text>
                    </View>

                    {selectedReport.aiAnalysis && (
                      <View style={styles.aiCard}>
                        <Text style={styles.aiCardTitle}>AI Analysis</Text>
                        <Text style={styles.aiDetail}>Type: <Text style={{fontWeight: 'bold'}}>{selectedReport.aiAnalysis.wasteType}</Text></Text>
                        <Text style={styles.aiDetail}>Est. Weight: {selectedReport.aiAnalysis.estimatedWeight}</Text>
                        <Text style={styles.aiDetail}>Confidence: {selectedReport.aiAnalysis.confidence}</Text>
                      </View>
                    )}
                  </View>

                  <View style={styles.modalRight}>
                    <Text style={styles.detailLabel}>STATUS TIMELINE</Text>
                    <View style={styles.timeline}>
                      {(selectedReport.statusHistory || []).map((history, idx) => (
                        <View key={idx} style={styles.timelineItem}>
                          <View style={styles.timelineDot} />
                          {idx !== (selectedReport.statusHistory?.length || 0) - 1 && <View style={styles.timelineLine} />}
                          <View style={styles.timelineContent}>
                            <Text style={styles.timelineStatus}>{getStatusLabel(history.status)}</Text>
                            <Text style={styles.timelineTime}>{formatDate(history.timestamp)}</Text>
                            {history.notes ? <Text style={styles.timelineNotes}>"{history.notes}"</Text> : null}
                          </View>
                        </View>
                      ))}
                      {(!selectedReport.statusHistory || selectedReport.statusHistory.length === 0) && (
                        <View style={styles.timelineItem}>
                          <View style={styles.timelineDot} />
                          <View style={styles.timelineContent}>
                            <Text style={styles.timelineStatus}>{getStatusLabel(selectedReport.status)}</Text>
                            <Text style={styles.timelineTime}>{formatDate(selectedReport.createdAt)}</Text>
                            <Text style={styles.timelineNotes}>Report created</Text>
                          </View>
                        </View>
                      )}
                    </View>
                    
                    <View style={{ marginTop: 24 }}>
                      {renderStatusActions()}
                    </View>
                  </View>
                </View>
              </ScrollView>
            </View>
          </View>
        </Modal>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F9FAFB', padding: 32 },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24 },
  headerTitle: { fontSize: 28, fontWeight: 'bold', color: '#111827', marginBottom: 8 },
  headerDesc: { fontSize: 14, color: '#4B5563' },
  headerActions: { flexDirection: 'row', gap: 16 },
  outlineBtn: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 10, paddingHorizontal: 16, borderRadius: 8, borderWidth: 1, borderColor: '#D1D5DB', backgroundColor: '#fff' },
  outlineBtnText: { color: '#374151', fontWeight: '600', fontSize: 14 },
  
  summaryRow: { flexDirection: 'row', gap: 16, marginBottom: 24 },
  summaryCard: { flex: 1, backgroundColor: '#fff', borderRadius: 12, padding: 20, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 2, elevation: 2 },
  summaryCardTitle: { fontSize: 14, color: '#6B7280', marginBottom: 8, fontWeight: '500' },
  summaryCardValue: { fontSize: 28, fontWeight: 'bold', color: '#111827' },

  card: { backgroundColor: '#fff', borderRadius: 12, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 2, elevation: 2, padding: 24, flex: 1 },
  
  tabsRow: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: '#E5E7EB', marginBottom: 24 },
  tab: { paddingVertical: 12, paddingHorizontal: 20, borderBottomWidth: 2, borderBottomColor: 'transparent' },
  activeTab: { borderBottomColor: '#2E8B57' },
  tabText: { fontSize: 14, fontWeight: '600', color: '#6B7280' },
  activeTabText: { color: '#2E8B57' },

  filtersRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 },
  searchBox: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#F9FAFB', borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 8, paddingHorizontal: 12, width: 350 },
  searchInput: { flex: 1, paddingVertical: 10, paddingHorizontal: 8, fontSize: 14, color: '#111827' },

  tableHead: { flexDirection: 'row', paddingVertical: 12, paddingHorizontal: 16, borderBottomWidth: 1, borderBottomColor: '#E5E7EB', marginBottom: 8, backgroundColor: '#F9FAFB', borderRadius: 8 },
  th: { fontSize: 11, fontWeight: '700', color: '#6B7280', letterSpacing: 0.5 },
  tableRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 16, paddingHorizontal: 16, borderBottomWidth: 1, borderBottomColor: '#F3F4F6' },
  td: { justifyContent: 'center' },
  
  reportTitle: { fontWeight: '600', color: '#111827', fontSize: 14, marginBottom: 2 },
  reportDesc: { fontSize: 12, color: '#6B7280' },
  brgyName: { fontWeight: '500', color: '#374151', fontSize: 14, marginBottom: 2 },
  streetName: { fontSize: 12, color: '#6B7280' },
  wasteTypeText: { fontSize: 13, color: '#4B5563' },
  dateTextTable: { fontSize: 13, color: '#6B7280' },
  emptyText: { textAlign: 'center', padding: 40, color: '#6B7280', fontSize: 14 },

  statusBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12, alignSelf: 'flex-start' },
  statusText: { fontSize: 11, fontWeight: 'bold', letterSpacing: 0.5 },
  
  viewBtn: { paddingVertical: 6, paddingHorizontal: 12, borderRadius: 6, backgroundColor: '#F3F4F6', alignSelf: 'flex-start' },
  viewBtnText: { fontSize: 12, fontWeight: '600', color: '#374151' },

  // Modal
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center', padding: 40 },
  modalContent: { backgroundColor: '#fff', borderRadius: 12, width: '100%', maxWidth: 900, maxHeight: '90%', overflow: 'hidden' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 20, borderBottomWidth: 1, borderBottomColor: '#E5E7EB' },
  modalTitle: { fontSize: 18, fontWeight: 'bold', color: '#111827' },
  modalScroll: { padding: 20 },
  modalBody: { flexDirection: 'row', gap: 32 },
  modalLeft: { flex: 1 },
  modalRight: { flex: 1, borderLeftWidth: 1, borderLeftColor: '#E5E7EB', paddingLeft: 32 },
  
  reportImage: { width: '100%', height: 200, borderRadius: 8, marginBottom: 24, backgroundColor: '#F3F4F6' },
  noImagePlaceholder: { width: '100%', height: 200, borderRadius: 8, marginBottom: 24, backgroundColor: '#F9FAFB', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#E5E7EB', borderStyle: 'dashed' },
  noImageText: { color: '#9CA3AF', marginTop: 8, fontSize: 14 },
  
  detailsGroup: { marginBottom: 20 },
  detailLabel: { fontSize: 11, fontWeight: '700', color: '#6B7280', marginBottom: 4, letterSpacing: 0.5 },
  detailValue: { fontSize: 15, color: '#111827', lineHeight: 22 },
  detailSubValue: { fontSize: 13, color: '#6B7280', marginTop: 2 },
  
  aiCard: { backgroundColor: '#F6FBF7', padding: 16, borderRadius: 8, borderWidth: 1, borderColor: '#dcfce7', marginTop: 8 },
  aiCardTitle: { fontSize: 13, fontWeight: 'bold', color: '#166534', marginBottom: 8 },
  aiDetail: { fontSize: 13, color: '#374151', marginBottom: 4 },

  timeline: { marginTop: 16 },
  timelineItem: { flexDirection: 'row', marginBottom: 24, position: 'relative' },
  timelineDot: { width: 12, height: 12, borderRadius: 6, backgroundColor: '#D1D5DB', marginTop: 4, marginRight: 16, zIndex: 2 },
  timelineLine: { position: 'absolute', top: 16, left: 5, width: 2, height: '100%', backgroundColor: '#E5E7EB', zIndex: 1 },
  timelineContent: { flex: 1 },
  timelineStatus: { fontSize: 14, fontWeight: 'bold', color: '#111827' },
  timelineTime: { fontSize: 12, color: '#6B7280', marginTop: 2, marginBottom: 4 },
  timelineNotes: { fontSize: 13, color: '#4B5563', fontStyle: 'italic', backgroundColor: '#F9FAFB', padding: 8, borderRadius: 6, marginTop: 4 },

  actionContainer: { backgroundColor: '#F9FAFB', padding: 16, borderRadius: 8, borderWidth: 1, borderColor: '#E5E7EB' },
  notesInput: { backgroundColor: '#fff', borderWidth: 1, borderColor: '#D1D5DB', borderRadius: 6, padding: 12, minHeight: 80, textAlignVertical: 'top', marginBottom: 12, fontSize: 14 },
  actionBtn: { paddingVertical: 12, borderRadius: 8, alignItems: 'center' },
  actionBtnText: { color: '#fff', fontWeight: 'bold', fontSize: 14 },
});
