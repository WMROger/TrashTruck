import React, { useState, useEffect, useMemo } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  TouchableOpacity, 
  ScrollView, 
  Image, 
  ActivityIndicator, 
  Modal, 
  RefreshControl,
  Platform
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter, Stack } from 'expo-router';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { auth, db } from '@/config/firebase';
import { Ionicons, MaterialIcons } from '@expo/vector-icons';
import { formatWasteAmount } from '@/utils/wasteUnits';

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
  createdAt: string;
  status: 'pending' | 'acknowledged' | 'in-progress' | 'resolved';
  aiAnalysis: { 
    wasteType: string; 
    estimatedWeight: string; 
    confidence: string; 
    details: string;
  } | null;
  updatedAt?: any;
  statusHistory?: Array<{ status: string; notes: string; timestamp: any; adminEmail: string }>;
}

export default function MyReportsScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  
  const [reports, setReports] = useState<Report[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedReport, setSelectedReport] = useState<Report | null>(null);
  const [modalVisible, setModalVisible] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    if (!auth.currentUser?.uid) {
      setLoading(false);
      return;
    }

    const q = query(
      collection(db, 'reports'),
      where('userId', '==', auth.currentUser.uid)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const fetchedReports: Report[] = [];
      snapshot.forEach((doc) => {
        fetchedReports.push({ id: doc.id, ...doc.data() } as Report);
      });
      
      // Sort client-side to avoid requiring composite indexes initially
      fetchedReports.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      
      setReports(fetchedReports);
      setLoading(false);
      setRefreshing(false);
    }, (error) => {
      console.error("Error fetching reports:", error);
      setLoading(false);
      setRefreshing(false);
    });

    return () => unsubscribe();
  }, []);

  const onRefresh = () => {
    setRefreshing(true);
    // onSnapshot automatically updates, but we can simulate a refresh state
    setTimeout(() => setRefreshing(false), 1000);
  };

  const statusCounts = useMemo(() => {
    return reports.reduce(
      (acc, report) => {
        const s = report.status || 'pending';
        if (acc[s] !== undefined) {
          acc[s]++;
        }
        return acc;
      },
      { pending: 0, acknowledged: 0, 'in-progress': 0, resolved: 0 } as Record<string, number>
    );
  }, [reports]);

  const openReport = (report: Report) => {
    setSelectedReport(report);
    setModalVisible(true);
  };

  const closeReport = () => {
    setModalVisible(false);
    setSelectedReport(null);
  };

  const getStatusDetails = (status: string) => {
    switch (status) {
      case 'pending': return { label: 'Pending', color: '#F59E0B', icon: 'time-outline' };
      case 'acknowledged': return { label: 'Acknowledged', color: '#3B82F6', icon: 'checkmark-circle-outline' };
      case 'in-progress': return { label: 'In Progress', color: '#F97316', icon: 'bicycle-outline' };
      case 'resolved': return { label: 'Resolved', color: '#10B981', icon: 'checkmark-done-circle' };
      default: return { label: 'Unknown', color: '#6B7280', icon: 'help-circle-outline' };
    }
  };

  const renderTimeline = (report: Report) => {
    const steps = [
      { id: 'pending', label: 'Submitted' },
      { id: 'acknowledged', label: 'Acknowledged' },
      { id: 'in-progress', label: 'In Progress' },
      { id: 'resolved', label: 'Resolved' }
    ];

    const currentStatusIndex = steps.findIndex(s => s.id === report.status);
    // If status is somehow unknown, default to first step
    const currentIndex = currentStatusIndex >= 0 ? currentStatusIndex : 0;

    return (
      <View style={styles.timelineContainer}>
        <Text style={styles.sectionTitle}>Status Timeline</Text>
        {steps.map((step, index) => {
          const isCompleted = index < currentIndex;
          const isCurrent = index === currentIndex;
          const isFuture = index > currentIndex;

          let iconColor = '#9CA3AF'; // Future (Grey)
          if (isCompleted) iconColor = '#10B981'; // Green check
          if (isCurrent) iconColor = getStatusDetails(report.status).color; // Highlight current

          // Find history item for this step if it exists
          const historyItem = report.statusHistory?.find(h => h.status === step.id);
          const timestamp = historyItem?.timestamp 
            ? new Date(historyItem.timestamp.toDate ? historyItem.timestamp.toDate() : historyItem.timestamp).toLocaleString()
            : (step.id === 'pending' ? new Date(report.createdAt).toLocaleString() : null);

          return (
            <View key={step.id} style={styles.timelineStep}>
              <View style={styles.timelineIconContainer}>
                {isCompleted ? (
                  <View style={[styles.timelineDot, { backgroundColor: '#10B981' }]}>
                    <Ionicons name="checkmark" size={14} color="white" />
                  </View>
                ) : isCurrent ? (
                  <View style={[styles.timelineDot, { backgroundColor: iconColor, transform: [{ scale: 1.2 }] }]}>
                    <Ionicons name="radio-button-on" size={14} color="white" />
                  </View>
                ) : (
                  <View style={[styles.timelineDot, { backgroundColor: '#E5E7EB', borderWidth: 2, borderColor: '#D1D5DB' }]} />
                )}
                {index < steps.length - 1 && (
                  <View style={[styles.timelineLine, { backgroundColor: isCompleted ? '#10B981' : '#E5E7EB' }]} />
                )}
              </View>
              
              <View style={styles.timelineContent}>
                <Text style={[
                  styles.timelineLabel, 
                  isCurrent && styles.timelineLabelCurrent,
                  isFuture && styles.timelineLabelFuture
                ]}>
                  {step.label}
                </Text>
                {timestamp ? <Text style={styles.timelineDate}>{timestamp}</Text> : null}
                {historyItem?.notes ? (
                  <View style={styles.timelineNotes}>
                    <Text style={styles.timelineNotesText}>Note: {historyItem.notes}</Text>
                  </View>
                ) : null}
              </View>
            </View>
          );
        })}
      </View>
    );
  };

  return (
    <View style={styles.root}>
      <Stack.Screen options={{ headerShown: false }} />
      {/* Header */}
      <View style={[styles.header, { paddingTop: Math.max(insets.top, 20) }]}>
        <View style={styles.headerTop}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color="#1F2937" />
          </TouchableOpacity>
          <View style={styles.headerTitles}>
            <Text style={styles.headerTitle}>My Reports</Text>
            <Text style={styles.headerSubtitle}>{reports.length} total report{reports.length !== 1 ? 's' : ''}</Text>
          </View>
          <View style={{ width: 40 }} />
        </View>
      </View>

      <ScrollView 
        style={styles.container}
        contentContainerStyle={[styles.content, { paddingBottom: Math.max(insets.bottom, 24) }]}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#4A6741']} />}
      >
        {/* Summary Cards */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.summaryContainer}>
          <View style={[styles.summaryCard, { borderBottomColor: '#F59E0B' }]}>
            <Text style={styles.summaryCount}>{statusCounts['pending']}</Text>
            <Text style={styles.summaryLabel}>Pending</Text>
          </View>
          <View style={[styles.summaryCard, { borderBottomColor: '#3B82F6' }]}>
            <Text style={styles.summaryCount}>{statusCounts['acknowledged']}</Text>
            <Text style={styles.summaryLabel}>Acknowledged</Text>
          </View>
          <View style={[styles.summaryCard, { borderBottomColor: '#F97316' }]}>
            <Text style={styles.summaryCount}>{statusCounts['in-progress']}</Text>
            <Text style={styles.summaryLabel}>In Progress</Text>
          </View>
          <View style={[styles.summaryCard, { borderBottomColor: '#10B981' }]}>
            <Text style={styles.summaryCount}>{statusCounts['resolved']}</Text>
            <Text style={styles.summaryLabel}>Resolved</Text>
          </View>
        </ScrollView>

        {/* Reports List */}
        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#4A6741" />
            <Text style={styles.loadingText}>Loading your reports...</Text>
          </View>
        ) : reports.length === 0 ? (
          <View style={styles.emptyContainer}>
            <View style={styles.emptyIconBg}>
              <Ionicons name="document-text-outline" size={64} color="#4A6741" />
            </View>
            <Text style={styles.emptyTitle}>No reports yet</Text>
            <Text style={styles.emptyText}>You haven't submitted any trash reports.</Text>
            <TouchableOpacity 
              style={styles.emptyButton} 
              onPress={() => router.push('/(tabs)/report')}
            >
              <Text style={styles.emptyButtonText}>Report Trash</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.reportsList}>
            {reports.map((report) => {
              const statusDetails = getStatusDetails(report.status);
              
              return (
                <TouchableOpacity 
                  key={report.id} 
                  style={styles.reportCard}
                  activeOpacity={0.7}
                  onPress={() => openReport(report)}
                >
                  {report.imageURL ? (
                    <Image source={{ uri: report.imageURL }} style={styles.reportImage} />
                  ) : (
                    <View style={[styles.reportImage, styles.reportImagePlaceholder]}>
                      <Ionicons name="image-outline" size={24} color="#9CA3AF" />
                    </View>
                  )}
                  
                  <View style={styles.reportCardContent}>
                    <View style={styles.reportHeader}>
                      <Text style={styles.reportTitle} numberOfLines={1}>{report.title}</Text>
                      <View style={[styles.statusBadge, { backgroundColor: `${statusDetails.color}15` }]}>
                        <Ionicons name={statusDetails.icon as any} size={12} color={statusDetails.color} />
                        <Text style={[styles.statusText, { color: statusDetails.color }]}>{statusDetails.label}</Text>
                      </View>
                    </View>
                    
                    <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 4 }}>
                      <Ionicons name="location-outline" size={12} color="#6B7280" /> 
                      <Text style={[styles.reportLocation, { marginTop: 0, marginLeft: 4, flex: 1 }]} numberOfLines={1}>
                        {report.street}, {report.barangay}
                      </Text>
                    </View>
                    
                    <View style={styles.reportFooter}>
                      <Text style={styles.reportDate}>{new Date(report.createdAt).toLocaleDateString()}</Text>
                      {report.aiAnalysis?.wasteType && report.aiAnalysis.wasteType !== 'Not waste' ? (
                        <View style={styles.aiBadge}>
                          <Ionicons name="sparkles" size={10} color="#4A6741" />
                          <Text style={styles.aiBadgeText}>{report.aiAnalysis.wasteType}</Text>
                        </View>
                      ) : null}
                    </View>
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>
        )}
      </ScrollView>

      {/* Report Details Modal */}
      <Modal
        visible={modalVisible}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={closeReport}
      >
        {selectedReport && (
          <View style={styles.modalContainer}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Report Details</Text>
              <TouchableOpacity onPress={closeReport} style={styles.closeButton}>
                <Ionicons name="close" size={24} color="#1F2937" />
              </TouchableOpacity>
            </View>

            <ScrollView contentContainerStyle={styles.modalContent} showsVerticalScrollIndicator={false}>
              {selectedReport.imageURL ? (
                <Image source={{ uri: selectedReport.imageURL }} style={styles.modalImage} />
              ) : (
                <View style={[styles.modalImage, styles.reportImagePlaceholder]}>
                  <Ionicons name="image-outline" size={48} color="#9CA3AF" />
                  <Text style={{ color: '#9CA3AF', marginTop: 8 }}>No photo attached</Text>
                </View>
              )}

              <View style={styles.modalDetails}>
                <Text style={styles.modalReportTitle}>{selectedReport.title}</Text>
                
                <View style={styles.modalInfoRow}>
                  <Ionicons name="location" size={18} color="#4A6741" />
                  <Text style={styles.modalInfoText}>{selectedReport.street}, {selectedReport.barangay}</Text>
                </View>
                
                {selectedReport.landmark ? (
                  <View style={styles.modalInfoRow}>
                    <Ionicons name="business" size={18} color="#4A6741" />
                    <Text style={styles.modalInfoText}>Near {selectedReport.landmark}</Text>
                  </View>
                ) : null}

                <View style={styles.modalInfoRow}>
                  <Ionicons name="calendar" size={18} color="#4A6741" />
                  <Text style={styles.modalInfoText}>Submitted on {new Date(selectedReport.createdAt).toLocaleString()}</Text>
                </View>

                {selectedReport.description ? (
                  <View style={styles.descriptionContainer}>
                    <Text style={styles.sectionTitle}>Description</Text>
                    <Text style={styles.descriptionText}>{selectedReport.description}</Text>
                  </View>
                ) : null}

                {selectedReport.aiAnalysis && selectedReport.aiAnalysis.wasteType !== 'Not waste' ? (
                  <View style={styles.aiAnalysisContainer}>
                    <View style={styles.aiHeader}>
                      <Ionicons name="sparkles" size={16} color="#4A6741" />
                      <Text style={styles.sectionTitle}>AI Analysis</Text>
                    </View>
                    <View style={styles.aiGrid}>
                      <View style={styles.aiGridItem}>
                        <Text style={styles.aiGridLabel}>Waste Type</Text>
                        <Text style={styles.aiGridValue}>{selectedReport.aiAnalysis.wasteType}</Text>
                      </View>
                      <View style={styles.aiGridItem}>
                        <Text style={styles.aiGridLabel}>Est. Weight</Text>
                        <Text style={styles.aiGridValue}>{formatWasteAmount(selectedReport.aiAnalysis.estimatedWeight)}</Text>
                      </View>
                    </View>
                    {selectedReport.aiAnalysis.details ? (
                      <Text style={styles.aiDetailsText}>{selectedReport.aiAnalysis.details}</Text>
                    ) : null}
                  </View>
                ) : null}

                {renderTimeline(selectedReport)}
              </View>
            </ScrollView>
          </View>
        )}
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#E8F5E9',
  },
  header: {
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
    paddingBottom: 16,
    paddingHorizontal: 20,
  },
  headerTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 8,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitles: {
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1F2937',
  },
  headerSubtitle: {
    fontSize: 13,
    color: '#6B7280',
    marginTop: 2,
  },
  container: {
    flex: 1,
  },
  content: {
    paddingTop: 16,
  },
  summaryContainer: {
    paddingHorizontal: 16,
    paddingBottom: 20,
    gap: 12,
  },
  summaryCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    minWidth: 110,
    alignItems: 'center',
    borderBottomWidth: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  summaryCount: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1F2937',
  },
  summaryLabel: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 4,
    fontWeight: '500',
  },
  loadingContainer: {
    padding: 40,
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 12,
    color: '#4A6741',
    fontWeight: '500',
  },
  emptyContainer: {
    padding: 40,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 40,
  },
  emptyIconBg: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: '#C8E6C9',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1F2937',
    marginBottom: 8,
  },
  emptyText: {
    fontSize: 14,
    color: '#6B7280',
    textAlign: 'center',
    marginBottom: 24,
  },
  emptyButton: {
    backgroundColor: '#4A6741',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 24,
  },
  emptyButtonText: {
    color: '#FFFFFF',
    fontWeight: 'bold',
    fontSize: 16,
  },
  reportsList: {
    paddingHorizontal: 16,
    gap: 12,
  },
  reportCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    flexDirection: 'row',
    padding: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  reportImage: {
    width: 80,
    height: 80,
    borderRadius: 12,
  },
  reportImagePlaceholder: {
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  reportCardContent: {
    flex: 1,
    marginLeft: 12,
    justifyContent: 'space-between',
  },
  reportHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  reportTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1F2937',
    flex: 1,
    marginRight: 8,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 12,
    gap: 4,
  },
  statusText: {
    fontSize: 10,
    fontWeight: 'bold',
  },
  reportLocation: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 4,
  },
  reportFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 8,
  },
  reportDate: {
    fontSize: 11,
    color: '#9CA3AF',
  },
  aiBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#E8F5E9',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
    gap: 4,
  },
  aiBadgeText: {
    fontSize: 10,
    color: '#4A6741',
    fontWeight: '600',
  },
  modalContainer: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1F2937',
  },
  closeButton: {
    padding: 4,
  },
  modalContent: {
    paddingBottom: 40,
  },
  modalImage: {
    width: '100%',
    height: 250,
  },
  modalDetails: {
    padding: 20,
  },
  modalReportTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#1F2937',
    marginBottom: 16,
  },
  modalInfoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
    gap: 8,
  },
  modalInfoText: {
    fontSize: 14,
    color: '#4B5563',
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#1F2937',
    marginBottom: 12,
  },
  descriptionContainer: {
    marginTop: 20,
    paddingTop: 20,
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
  },
  descriptionText: {
    fontSize: 14,
    color: '#4B5563',
    lineHeight: 22,
  },
  aiAnalysisContainer: {
    marginTop: 20,
    backgroundColor: '#E8F5E9',
    borderRadius: 12,
    padding: 16,
  },
  aiHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  aiGrid: {
    flexDirection: 'row',
    gap: 16,
    marginBottom: 12,
  },
  aiGridItem: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    padding: 12,
    borderRadius: 8,
  },
  aiGridLabel: {
    fontSize: 11,
    color: '#6B7280',
    marginBottom: 4,
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  aiGridValue: {
    fontSize: 14,
    color: '#4A6741',
    fontWeight: 'bold',
  },
  aiDetailsText: {
    fontSize: 13,
    color: '#4B5563',
    fontStyle: 'italic',
  },
  timelineContainer: {
    marginTop: 24,
    paddingTop: 20,
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
  },
  timelineStep: {
    flexDirection: 'row',
    marginBottom: 20,
  },
  timelineIconContainer: {
    alignItems: 'center',
    marginRight: 16,
  },
  timelineDot: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 2,
  },
  timelineLine: {
    width: 2,
    flex: 1,
    marginTop: -4,
    marginBottom: -24,
    zIndex: 1,
  },
  timelineContent: {
    flex: 1,
    paddingBottom: 16,
  },
  timelineLabel: {
    fontSize: 15,
    fontWeight: '600',
    color: '#6B7280',
  },
  timelineLabelCurrent: {
    color: '#1F2937',
  },
  timelineLabelFuture: {
    color: '#9CA3AF',
  },
  timelineDate: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 4,
  },
  timelineNotes: {
    marginTop: 8,
    backgroundColor: '#F3F4F6',
    padding: 10,
    borderRadius: 8,
    borderLeftWidth: 3,
    borderLeftColor: '#4A6741',
  },
  timelineNotesText: {
    fontSize: 13,
    color: '#4B5563',
    fontStyle: 'italic',
  },
});
