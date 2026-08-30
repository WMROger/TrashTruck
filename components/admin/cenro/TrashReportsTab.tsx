import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TextInput, TouchableOpacity, Modal, Image, ActivityIndicator, Platform, TouchableWithoutFeedback, Pressable, useWindowDimensions } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { auth, db } from '../../../config/firebase';
import { collection, query, onSnapshot, doc, updateDoc, addDoc, serverTimestamp, Timestamp, orderBy, arrayUnion } from 'firebase/firestore';
import { formatWasteAmount } from '../../../utils/wasteUnits';
import { autoDispatchReportToActiveRoute } from '../../../services/autoDispatchService';

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
  assignedDriver?: string;
}

const ITEMS_PER_PAGE = 5;

export default function TrashReportsTab({
  userRole,
  assignedBarangay,
}: {
  userRole?: string;
  assignedBarangay?: string;
} = {}) {
  const isCoordinator = userRole === 'coordinator';
  const { width } = useWindowDimensions();
  const isMobile = width < 768;
  const [activeTab, setActiveTab] = useState<'active' | 'history'>('active');
  const [reports, setReports] = useState<Report[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [brgyFilterOnly, setBrgyFilterOnly] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  
  // Modal state
  const [selectedReport, setSelectedReport] = useState<Report | null>(null);
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [isImageViewerVisible, setIsImageViewerVisible] = useState(false);
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

  const matchesBrgy = (r: Report) => {
    if (!isCoordinator || !assignedBarangay || !brgyFilterOnly) return true;
    return (r.barangay || '').toLowerCase().includes(assignedBarangay.toLowerCase());
  };

  const activeReports = reports.filter(r => r.status !== 'resolved' && matchesBrgy(r) && (
    r.title?.toLowerCase().includes(searchQuery.toLowerCase()) || 
    r.barangay?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    r.street?.toLowerCase().includes(searchQuery.toLowerCase())
  ));

  const historyReports = reports.filter(r => r.status === 'resolved' && matchesBrgy(r) && (
    r.title?.toLowerCase().includes(searchQuery.toLowerCase()) || 
    r.barangay?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    r.street?.toLowerCase().includes(searchQuery.toLowerCase())
  ));

  const filteredReports = activeTab === 'active' ? activeReports : historyReports;
  const totalPages = Math.ceil(filteredReports.length / ITEMS_PER_PAGE) || 1;
  const paginatedReports = filteredReports.slice(
    (currentPage - 1) * ITEMS_PER_PAGE,
    currentPage * ITEMS_PER_PAGE
  );

  // Keep currentPage in valid bounds when data or filter changes
  useEffect(() => {
    if (currentPage > totalPages && totalPages > 0) {
      setCurrentPage(totalPages);
    }
  }, [totalPages, currentPage]);

  const handleTabChange = (tab: 'active' | 'history') => {
    setActiveTab(tab);
    setCurrentPage(1);
  };

  const handleSearchChange = (text: string) => {
    setSearchQuery(text);
    setCurrentPage(1);
  };

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
    setIsImageViewerVisible(false);
  };

  const handleUpdateStatus = async (newStatus: ReportStatus) => {
    if (!selectedReport) return;
    setUpdating(true);
    
    try {
      const reportRef = doc(db, 'reports', selectedReport.id);
      
      const newHistoryItem: StatusHistoryItem = {
        status: newStatus,
        notes: adminNotes?.trim() || '',
        timestamp: new Date().toISOString(),
        adminEmail: auth?.currentUser?.email || 'admin@cenro.gov.ph'
      };
      
      await updateDoc(reportRef, {
        status: newStatus,
        updatedAt: serverTimestamp(),
        statusHistory: arrayUnion(newHistoryItem)
      });

      // Send notification to user if userId is available
      const targetUserId = selectedReport.userId || (selectedReport as any).userUid || (selectedReport as any).uid;
      if (targetUserId) {
        try {
          await addDoc(collection(db, 'notifications'), {
            userId: targetUserId,
            type: 'report_status_update',
            reportId: selectedReport.id,
            reportTitle: selectedReport.title || 'Trash Report',
            oldStatus: selectedReport.status,
            newStatus: newStatus,
            adminNotes: adminNotes?.trim() || '',
            read: false,
            createdAt: serverTimestamp()
          });
        } catch (notifErr) {
          console.warn("Could not dispatch push/in-app notification:", notifErr);
        }
      }
      
      // Update local state and close modal cleanly
      setSelectedReport((prev) => prev ? {
        ...prev,
        status: newStatus,
        statusHistory: [...(prev.statusHistory || []), newHistoryItem]
      } : null);
      setAdminNotes('');
      setIsModalVisible(false);

      // Auto-dispatch: If acknowledging, automatically slot into active on-duty driver's live route
      if (newStatus === 'acknowledged') {
        autoDispatchReportToActiveRoute({
          id: selectedReport.id,
          title: selectedReport.title,
          street: selectedReport.street,
          barangay: selectedReport.barangay,
          location: selectedReport.location,
          aiAnalysis: selectedReport.aiAnalysis,
        }).then((res) => {
          if (res.dispatched) {
            console.log('🚛 Real-time auto-dispatch:', res.message);
          }
        }).catch((err) => {
          console.warn('Auto-dispatch notice:', err);
        });
      }
    } catch (error: any) {
      console.error("Error updating report:", error);
      alert(`Failed to update report status: ${error?.message || error}`);
    } finally {
      setUpdating(false);
    }
  };

  const renderStatusActions = () => {
    if (!selectedReport) return null;
    
    if (selectedReport.status === 'acknowledged') {
      return (
        <View style={[styles.actionContainer, { alignItems: 'center', paddingVertical: 16 }]}>
          <Text style={{ color: '#6B7280', fontSize: 13, fontStyle: 'italic', textAlign: 'center' }}>
            {`✅ Report is Acknowledged.\nHead to the Route Optimization tab to assign a driver. This report will automatically move to “In Progress” once dispatched.`}
          </Text>
        </View>
      );
    }

    let nextStatus: ReportStatus | null = null;
    let buttonText = '';
    let buttonColor = '';
    
    if (selectedReport.status === 'pending') {
      nextStatus = 'acknowledged';
      buttonText = 'Acknowledge';
      buttonColor = '#3b82f6';
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

  const exportCsv = () => {
    const dataToExport = activeTab === 'active' ? activeReports : historyReports;
    if (dataToExport.length === 0) {
      alert('No reports to export in this tab.');
      return;
    }

    const header = ['Title', 'Description', 'Reporter Email', 'Barangay', 'Street', 'Waste Type', 'Status', 'Date'];
    const rowsCsv = dataToExport.map((r) => [
      (r.title || 'N/A').toString().replace(/\n|\r|,/g, ' '),
      (r.description || 'N/A').toString().replace(/\n|\r|,/g, ' '),
      (r.userEmail || 'N/A').toString().replace(/\n|\r|,/g, ' '),
      (r.barangay || 'N/A').toString().replace(/\n|\r|,/g, ' '),
      (r.street || 'N/A').toString().replace(/\n|\r|,/g, ' '),
      (r.aiAnalysis?.wasteType || 'Unknown').toString().replace(/\n|\r|,/g, ' '),
      (r.status || 'N/A').toString().replace(/\n|\r|,/g, ' '),
      formatDate(r.createdAt).replace(/\n|\r|,/g, ' '),
    ].join(','));

    const csv = [header.join(','), ...rowsCsv].join('\n');
    const filename = `trash_reports_${activeTab}_${new Date().toISOString().split('T')[0]}.csv`;

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
      alert('CSV export is currently available on web.');
    }
  };

  return (
    <ScrollView 
      style={styles.container} 
      contentContainerStyle={[styles.scrollContent, isMobile && { padding: 16, paddingBottom: 48 }]}
      showsVerticalScrollIndicator={true}
    >
      {/* Header */}
      <View style={[styles.headerRow, isMobile && { flexDirection: 'column', gap: 12 }]}>
        <View>
          <Text style={styles.headerTitle}>Trash Reports</Text>
          <Text style={styles.headerDesc}>
            {isCoordinator && assignedBarangay
              ? `Review, inspect, and track waste reports for Brgy. ${assignedBarangay}.`
              : 'Manage and track citizen-reported waste issues.'}
          </Text>
          {isCoordinator && assignedBarangay && (
            <TouchableOpacity
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: 6,
                backgroundColor: brgyFilterOnly ? '#DCFCE7' : '#F1F5F9',
                borderColor: brgyFilterOnly ? '#86EFAC' : '#CBD5E1',
                borderWidth: 1,
                borderRadius: 8,
                paddingHorizontal: 10,
                paddingVertical: 5,
                marginTop: 8,
                alignSelf: 'flex-start',
              }}
              onPress={() => setBrgyFilterOnly(!brgyFilterOnly)}
              activeOpacity={0.7}
            >
              <MaterialIcons
                name={brgyFilterOnly ? 'check-circle' : 'radio-button-unchecked'}
                size={15}
                color={brgyFilterOnly ? '#059669' : '#64748B'}
              />
              <Text style={{ fontSize: 11.5, fontWeight: '700', color: brgyFilterOnly ? '#065F46' : '#475569' }}>
                {brgyFilterOnly
                  ? `Filtered: Brgy. ${assignedBarangay} (Click to show all)`
                  : `Showing all Danao barangays (Click to filter Brgy. ${assignedBarangay})`}
              </Text>
            </TouchableOpacity>
          )}
        </View>
        <View style={styles.headerActions}>
          <TouchableOpacity style={styles.outlineBtn} onPress={exportCsv}>
            <MaterialIcons name="file-download" size={18} color="#374151" />
            <Text style={styles.outlineBtnText}>Export CSV</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Summary Cards */}
      <View style={[styles.summaryRow, isMobile && { flexWrap: 'wrap', gap: 10 }]}>
        <View style={[styles.summaryCard, isMobile && { width: '48%', minWidth: 130 }]}>
          <Text style={styles.summaryCardTitle}>Total Reports</Text>
          <Text style={styles.summaryCardValue}>{totalReports}</Text>
        </View>
        <View style={[styles.summaryCard, isMobile && { width: '48%', minWidth: 130 }]}>
          <Text style={styles.summaryCardTitle}>Pending</Text>
          <Text style={[styles.summaryCardValue, { color: '#f59e0b' }]}>{pendingCount}</Text>
        </View>
        <View style={[styles.summaryCard, isMobile && { width: '48%', minWidth: 130 }]}>
          <Text style={styles.summaryCardTitle}>In Progress</Text>
          <Text style={[styles.summaryCardValue, { color: '#f97316' }]}>{inProgressCount}</Text>
        </View>
        <View style={[styles.summaryCard, isMobile && { width: '48%', minWidth: 130 }]}>
          <Text style={styles.summaryCardTitle}>Resolved</Text>
          <Text style={[styles.summaryCardValue, { color: '#2E8B57' }]}>{resolvedCount}</Text>
        </View>
      </View>

      {/* Main Content Card */}
      <View style={[styles.card, isMobile && { padding: 14 }]}>
        <View style={styles.tabsRow}>
          <TouchableOpacity 
            style={[styles.tab, activeTab === 'active' && styles.activeTab]}
            onPress={() => handleTabChange('active')}
          >
            <Text style={[styles.tabText, activeTab === 'active' && styles.activeTabText]}>Active Reports</Text>
          </TouchableOpacity>
          <TouchableOpacity 
            style={[styles.tab, activeTab === 'history' && styles.activeTab]}
            onPress={() => handleTabChange('history')}
          >
            <Text style={[styles.tabText, activeTab === 'history' && styles.activeTabText]}>Report History</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.filtersRow}>
          <View style={[styles.searchBox, isMobile && { width: '100%' }]}>
            <MaterialIcons name="search" size={20} color="#9CA3AF" />
            <TextInput 
              style={styles.searchInput} 
              placeholder="Search by title, barangay, street..." 
              placeholderTextColor="#9CA3AF" 
              value={searchQuery}
              onChangeText={handleSearchChange}
            />
          </View>
        </View>

        {loading ? (
          <ActivityIndicator size="large" color="#2E8B57" style={{ marginVertical: 40 }} />
        ) : (
          <View>
            <ScrollView 
              horizontal={isMobile} 
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ flexGrow: 1, minWidth: '100%' }}
              style={{ width: '100%' }}
            >
              <View style={{ minWidth: isMobile ? 650 : '100%', width: '100%' }}>
                <View style={styles.tableHead}>
                  <Text style={[styles.th, { flex: 2 }]}>REPORT</Text>
                  <Text style={[styles.th, { flex: 1.5 }]}>LOCATION</Text>
                  <Text style={[styles.th, { flex: 1 }]}>WASTE TYPE</Text>
                  <Text style={[styles.th, { flex: 1 }]}>{activeTab === 'history' ? 'RESOLVED DATE' : 'STATUS'}</Text>
                  <Text style={[styles.th, { flex: 1 }]}>{activeTab === 'active' ? 'DATE' : 'ACTIONS'}</Text>
                </View>

                {filteredReports.length === 0 ? (
                  <Text style={styles.emptyText}>No reports found.</Text>
                ) : (
                  paginatedReports.map((report) => {
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
            </ScrollView>

            {/* Pagination Controls */}
            {filteredReports.length > 0 && (
              <View style={styles.paginationContainer}>
                <Text style={styles.paginationInfo}>
                  Showing {(currentPage - 1) * ITEMS_PER_PAGE + 1} - {Math.min(currentPage * ITEMS_PER_PAGE, filteredReports.length)} of {filteredReports.length} reports
                </Text>

                {totalPages > 1 && (
                  <View style={styles.paginationControls}>
                    <TouchableOpacity
                      style={[styles.pageNavBtn, currentPage === 1 && styles.pageNavBtnDisabled]}
                      disabled={currentPage === 1}
                      onPress={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
                      activeOpacity={0.7}
                    >
                      <MaterialIcons name="chevron-left" size={18} color={currentPage === 1 ? '#9CA3AF' : '#374151'} />
                      <Text style={[styles.pageNavBtnText, currentPage === 1 && styles.pageNavBtnTextDisabled]}>Prev</Text>
                    </TouchableOpacity>

                    <View style={styles.pageNumberGroup}>
                      {Array.from({ length: totalPages }, (_, idx) => idx + 1).map((pageNum) => {
                        const isActive = pageNum === currentPage;
                        return (
                          <TouchableOpacity
                            key={pageNum}
                            style={[styles.pageNumBtn, isActive && styles.pageNumBtnActive]}
                            onPress={() => setCurrentPage(pageNum)}
                            activeOpacity={0.7}
                          >
                            <Text style={[styles.pageNumText, isActive && styles.pageNumTextActive]}>
                              {pageNum}
                            </Text>
                          </TouchableOpacity>
                        );
                      })}
                    </View>

                    <TouchableOpacity
                      style={[styles.pageNavBtn, currentPage === totalPages && styles.pageNavBtnDisabled]}
                      disabled={currentPage === totalPages}
                      onPress={() => setCurrentPage((prev) => Math.min(totalPages, prev + 1))}
                      activeOpacity={0.7}
                    >
                      <Text style={[styles.pageNavBtnText, currentPage === totalPages && styles.pageNavBtnTextDisabled]}>Next</Text>
                      <MaterialIcons name="chevron-right" size={18} color={currentPage === totalPages ? '#9CA3AF' : '#374151'} />
                    </TouchableOpacity>
                  </View>
                )}
              </View>
            )}
          </View>
        )}
      </View>

      {/* Report Detail Modal */}
      {isModalVisible && selectedReport && (
        <Modal transparent visible={isModalVisible} animationType="fade" onRequestClose={() => { setIsModalVisible(false); setIsImageViewerVisible(false); }}>
          <Pressable style={[styles.modalOverlay, isMobile && { padding: 12 }, { cursor: 'default' } as any]} onPress={() => setIsModalVisible(false)}>
            <TouchableWithoutFeedback>
              <View style={[styles.modalContent, { cursor: 'default' } as any]}>
                <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Report Details</Text>
                <TouchableOpacity onPress={() => setIsModalVisible(false)}>
                  <MaterialIcons name="close" size={24} color="#6B7280" />
                </TouchableOpacity>
              </View>

              <ScrollView style={styles.modalScroll}>
                <View style={[styles.modalBody, isMobile && { flexDirection: 'column', gap: 20 }]}>
                  <View style={styles.modalLeft}>
                    {selectedReport.imageURL ? (
                      <TouchableOpacity onPress={() => setIsImageViewerVisible(true)}>
                        <Image source={{ uri: selectedReport.imageURL }} style={styles.reportImage} />
                      </TouchableOpacity>
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
                      {Boolean(selectedReport.landmark) ? (
                        <Text style={styles.detailSubValue}>Landmark: {selectedReport.landmark}</Text>
                      ) : null}
                    </View>

                    <View style={styles.detailsGroup}>
                      <Text style={styles.detailLabel}>REPORTER</Text>
                      <Text style={styles.detailValue}>{selectedReport.userEmail}</Text>
                      <Text style={styles.detailSubValue}>Submitted: {formatDate(selectedReport.createdAt)}</Text>
                    </View>

                    {Boolean(selectedReport.assignedDriver) ? (
                      <View style={styles.detailsGroup}>
                        <Text style={styles.detailLabel}>ASSIGNED DRIVER</Text>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4 }}>
                          <MaterialIcons name="local-shipping" size={16} color="#2E8B57" />
                          <Text style={{ fontSize: 15, fontWeight: '700', color: '#2E8B57' }}>{selectedReport.assignedDriver}</Text>
                        </View>
                      </View>
                    ) : null}

                    {selectedReport.aiAnalysis ? (
                      <View style={styles.aiCard}>
                        <Text style={styles.aiCardTitle}>AI Analysis</Text>
                        <Text style={styles.aiDetail}>Type: <Text style={{fontWeight: 'bold'}}>{selectedReport.aiAnalysis.wasteType}</Text></Text>
                        <Text style={styles.aiDetail}>Est. Weight: {formatWasteAmount(selectedReport.aiAnalysis.estimatedWeight)}</Text>
                        <Text style={styles.aiDetail}>Confidence: {selectedReport.aiAnalysis.confidence}</Text>
                      </View>
                    ) : null}
                  </View>

                  <View style={[styles.modalRight, isMobile && { borderLeftWidth: 0, paddingLeft: 0, borderTopWidth: 1, borderTopColor: '#E5E7EB', paddingTop: 20 }]}>
                    <Text style={styles.detailLabel}>STATUS TIMELINE</Text>
                    <View style={styles.timeline}>
                      {/* Initial Report Created State (Always visible at the top of the timeline) */}
                      <View style={styles.timelineItem}>
                        <View style={styles.timelineDot} />
                        {Boolean((selectedReport.statusHistory?.length || 0) > 0) ? <View style={styles.timelineLine} /> : null}
                        <View style={styles.timelineContent}>
                          <Text style={styles.timelineStatus}>Pending</Text>
                          <Text style={styles.timelineTime}>{formatDate(selectedReport.createdAt)}</Text>
                          <Text style={styles.timelineNotes}>Report created</Text>
                        </View>
                      </View>

                      {/* Map through all subsequent status changes */}
                      {(selectedReport.statusHistory || []).map((history, idx) => (
                        <View key={idx} style={styles.timelineItem}>
                          <View style={styles.timelineDot} />
                          {idx !== (selectedReport.statusHistory?.length || 0) - 1 ? <View style={styles.timelineLine} /> : null}
                          <View style={styles.timelineContent}>
                            <Text style={styles.timelineStatus}>{getStatusLabel(history.status)}</Text>
                            <Text style={styles.timelineTime}>{formatDate(history.timestamp)}</Text>
                            {Boolean(history.notes) ? <Text style={styles.timelineNotes}>“{history.notes}”</Text> : null}
                          </View>
                        </View>
                      ))}
                    </View>
                    
                    <View style={{ marginTop: 24 }}>
                      {renderStatusActions()}
                    </View>
                  </View>
                </View>
              </ScrollView>
            </View>
          </TouchableWithoutFeedback>
          </Pressable>

          {/* Full Screen Image Viewer inside the main Modal for correct layering but unnested from the background Pressable */}
          {isImageViewerVisible && (
            <Pressable style={[styles.imageViewerOverlay, { cursor: 'default' } as any]} onPress={() => setIsImageViewerVisible(false)}>
              <TouchableOpacity style={styles.imageViewerCloseBtn} onPress={() => setIsImageViewerVisible(false)}>
                <MaterialIcons name="close" size={32} color="#FFF" />
              </TouchableOpacity>
              {selectedReport?.imageURL && (
                <TouchableWithoutFeedback>
                  <Image source={{ uri: selectedReport.imageURL }} style={[styles.fullScreenImage, { cursor: 'default' } as any]} resizeMode="contain" />
                </TouchableWithoutFeedback>
              )}
            </Pressable>
          )}
        </Modal>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F9FAFB' },
  scrollContent: { padding: 32, paddingBottom: 64 },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24 },
  headerTitle: { fontSize: 28, fontWeight: 'bold', color: '#111827', marginBottom: 8 },
  headerDesc: { fontSize: 14, color: '#4B5563' },
  headerActions: { flexDirection: 'row', gap: 16 },
  outlineBtn: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 10, paddingHorizontal: 16, borderRadius: 8, borderWidth: 1, borderColor: '#D1D5DB', backgroundColor: '#fff' },
  outlineBtnText: { color: '#374151', fontWeight: '600', fontSize: 14 },
  
  summaryRow: { flexDirection: 'row', gap: 16, marginBottom: 24 },
  summaryCard: { flex: 1, backgroundColor: '#fff', borderRadius: 12, padding: 20, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 2, elevation: 2, borderWidth: 1, borderColor: '#E5E7EB' },
  summaryCardTitle: { fontSize: 14, color: '#6B7280', marginBottom: 8, fontWeight: '500' },
  summaryCardValue: { fontSize: 28, fontWeight: 'bold', color: '#111827' },

  card: { backgroundColor: '#fff', borderRadius: 12, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 2, elevation: 2, borderWidth: 1, borderColor: '#E5E7EB', padding: 24, marginBottom: 24 },
  
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

  // Pagination
  paginationContainer: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingTop: 20, marginTop: 12, borderTopWidth: 1, borderTopColor: '#F3F4F6', flexWrap: 'wrap', gap: 12 },
  paginationInfo: { fontSize: 13, color: '#6B7280', fontWeight: '500' },
  paginationControls: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  pageNavBtn: { flexDirection: 'row', alignItems: 'center', paddingVertical: 6, paddingHorizontal: 10, borderRadius: 6, borderWidth: 1, borderColor: '#E5E7EB', backgroundColor: '#fff', gap: 2 },
  pageNavBtnDisabled: { backgroundColor: '#F9FAFB', borderColor: '#F3F4F6' },
  pageNavBtnText: { fontSize: 13, fontWeight: '500', color: '#374151' },
  pageNavBtnTextDisabled: { color: '#9CA3AF' },
  pageNumberGroup: { flexDirection: 'row', alignItems: 'center', gap: 4, marginHorizontal: 4 },
  pageNumBtn: { width: 32, height: 32, borderRadius: 6, borderWidth: 1, borderColor: '#E5E7EB', backgroundColor: '#fff', justifyContent: 'center', alignItems: 'center' },
  pageNumBtnActive: { backgroundColor: '#2E8B57', borderColor: '#2E8B57' },
  pageNumText: { fontSize: 13, fontWeight: '600', color: '#374151' },
  pageNumTextActive: { color: '#ffffff' },

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

  imageViewerOverlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.9)', justifyContent: 'center', alignItems: 'center', zIndex: 9999 },
  imageViewerCloseBtn: { position: 'absolute', top: 40, right: 20, zIndex: 10000, padding: 8 },
  fullScreenImage: { width: '100%', height: '100%' },
});

