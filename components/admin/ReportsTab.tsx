import { MaterialIcons } from '@expo/vector-icons';
import { addDoc, collection, doc, getDoc, onSnapshot, orderBy, query, serverTimestamp, updateDoc } from 'firebase/firestore';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Image, Modal, Platform, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { db } from '../../config/firebase';
import { useAuthContext } from '../AuthContext';
import ErrorModal from '../ErrorModal';

interface Report {
  id: string;
  title: string;
  description: string;
  barangay: string;
  street: string;
  userId: string;
  userEmail: string;
  imageURL?: string;
  status: 'pending' | 'in-progress' | 'resolved' | 'closed';
  createdAt: any; // Firestore timestamp
  updatedAt?: any; // Firestore timestamp
}

const ReportsTab: React.FC = () => {
  const { user } = useAuthContext();
  const [selectedDate, setSelectedDate] = useState('');
  const [reports, setReports] = useState<Report[]>([]);
  const [filteredReports, setFilteredReports] = useState<Report[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedReport, setSelectedReport] = useState<Report | null>(null);
  const [modalVisible, setModalVisible] = useState(false);
  const [sortColumn, setSortColumn] = useState<string>('');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc' | 'default'>('default');
  const [searchQuery, setSearchQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(10);
  const [isResolving, setIsResolving] = useState(false);
  const [imagePreviewUrl, setImagePreviewUrl] = useState<string | null>(null);
  const [isImagePreviewVisible, setIsImagePreviewVisible] = useState(false);
  const [errorModal, setErrorModal] = useState({
    visible: false,
    title: 'Error',
    message: '',
    type: 'error' as 'error' | 'warning' | 'info' | 'success',
  });

  // Show error modal
  const showError = (message: string, title = 'Error', type: 'error' | 'warning' | 'info' | 'success' = 'error') => {
    setErrorModal({
      visible: true,
      title,
      message,
      type,
    });
  };

  // Close error modal
  const closeErrorModal = () => {
    setErrorModal(prev => ({ ...prev, visible: false }));
  };

  // Fetch reports from Firestore
  useEffect(() => {
    if (!db) {
      setError('Firebase not initialized');
      setLoading(false);
      return;
    }

    console.log('Setting up real-time reports listener...');
    
    const reportsRef = collection(db, 'reports');
    const q = query(reportsRef, orderBy('createdAt', 'desc'));
    
    const unsubscribe = onSnapshot(q, 
      (snapshot) => {
        console.log('Reports snapshot received:', snapshot.docs.length, 'documents');
        
        const reportsData: Report[] = snapshot.docs.map(doc => {
          const data = doc.data();
          return {
            id: doc.id,
            title: data.title || 'Untitled Report',
            description: data.description || '',
            barangay: data.barangay || '',
            street: data.street || '',
            userId: data.userId || '',
            userEmail: data.userEmail || '',
            imageURL: data.imageURL || null,
            status: data.status || 'pending',
            createdAt: data.createdAt,
            updatedAt: data.updatedAt
          };
        });
        
        console.log('Processed reports:', reportsData.length);
        setReports(reportsData);
        setLoading(false);
        setError(null);
      },
      (error) => {
        console.error('Error fetching reports:', error);
        setError('Failed to fetch reports');
        setLoading(false);
      }
    );

    return () => {
      console.log('Cleaning up reports listener');
      unsubscribe();
    };
  }, []);

  const handleFilterChange = (_filter: 'today' | 'weekly' | 'monthly') => {
    // Filter UI not implemented yet
  };

  const handleStatusChange = async (reportId: string, newStatus: Report['status']) => {
    if (!db) {
      showError('Database not available', 'Database Error', 'error');
      return;
    }

    try {
      console.log('Updating report status:', reportId, 'to', newStatus);
      
      const reportRef = doc(db, 'reports', reportId);
      await updateDoc(reportRef, {
        status: newStatus,
        updatedAt: serverTimestamp()
      });
      
      console.log('Report status updated successfully');
    } catch (error) {
      console.error('Error updating report status:', error);
      showError('Failed to update report status', 'Update Error', 'error');
    }
  };

  const getStatusColor = (status: Report['status']) => {
    switch (status) {
      case 'pending': return '#FFD700';
      case 'in-progress': return '#4169E1';
      case 'resolved': return '#32CD32';
      case 'closed': return '#666';
      default: return '#666';
    }
  };

  const getStatusText = (status: Report['status']) => {
    switch (status) {
      case 'pending': return 'Pending';
      case 'in-progress': return 'In Progress';
      case 'resolved': return 'Resolved';
      case 'closed': return 'Closed';
      default: return 'Unknown';
    }
  };

  const formatDate = (timestamp: any) => {
    if (!timestamp) return 'Unknown date';
    
    try {
      const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
      return date.toLocaleDateString('en-US', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        hour12: true
      });
    } catch (error) {
      console.error('Error formatting date:', error);
      return 'Invalid date';
    }
  };

  const getLocationText = (report: Report) => {
    const parts = [report.barangay, report.street].filter(Boolean);
    return parts.length > 0 ? parts.join(', ') : 'Location not specified';
  };

  const handleViewReport = (report: Report) => {
    console.log('[ReportsTab] Opening report modal for id:', report.id);
    setSelectedReport(report);
    setModalVisible(true);
  };

  const handleCloseModal = () => {
    console.log('[ReportsTab] Closing report modal');
    setModalVisible(false);
    setSelectedReport(null);
  };

  const handleMarkAsResolved = async () => {
    if (!selectedReport) return;

    const performResolve = async () => {
      try {
        console.log('[Resolve] Start for reportId:', selectedReport.id);
        setIsResolving(true);
        if (!db) {
          console.error('[Resolve] db is not initialized');
          showError('Database not available', 'Database Error', 'error');
          setIsResolving(false);
          return;
        }
        // 1) Update status to resolved
        try {
          await handleStatusChange(selectedReport.id, 'resolved');
          console.log('[Resolve] Status updated');
        } catch (e) {
          console.error('[Resolve] Failed to update status:', e);
          showError('Failed to update status to resolved.', 'Update Error', 'error');
          setIsResolving(false);
          return;
        }

        // 2) Re-fetch the latest report data to persist to history
        const reportRef = doc(db as any, 'reports', selectedReport.id);
        console.log('[Resolve] Fetching latest report snapshot...');
        const snap = await getDoc(reportRef);
        console.log('[Resolve] Snapshot exists:', snap.exists());
        const data = snap.exists() ? snap.data() : selectedReport;
        console.log('[Resolve] Data prepared for history:', data);

        // 3) Write to history collection
        const historyRef = collection(db as any, 'history');
        console.log('[Resolve] Writing to history collection...');
        try {
          const written = await addDoc(historyRef, {
            ...data,
            id: selectedReport.id,
            status: 'resolved',
            resolvedAt: serverTimestamp(),
          });
          console.log('[Resolve] History doc id:', written.id);
        } catch (writeErr) {
          console.error('[Resolve] Failed to write history doc:', writeErr);
        }

        console.log('[Resolve] Keeping resolved item in reports collection');
        handleCloseModal();
        showError('Report marked as resolved', 'Success', 'success');
        setIsResolving(false);
      } catch (e) {
        console.error('[Resolve] Flow failed:', e);
        showError('Failed to move report to history. Please try again.', 'Resolve Error', 'error');
        setIsResolving(false);
      }
    };

    // On web, RN Alert's confirm buttons don't work; use native confirm
    if (Platform.OS === 'web') {
      const ok = (typeof window !== 'undefined') ? window.confirm('Mark this report as resolved?') : true;
      if (ok) await performResolve();
      return;
    }

    // For now, directly resolve without confirmation
    // In a production app, you might want to add a confirmation modal
    await performResolve();
  };

  const handleSort = (column: string) => {
    if (sortColumn === column) {
      // Cycle through: default -> asc -> desc -> default
      if (sortDirection === 'default') {
        setSortDirection('asc');
      } else if (sortDirection === 'asc') {
        setSortDirection('desc');
      } else {
        setSortDirection('default');
        setSortColumn(''); // Reset to no sorting
      }
    } else {
      setSortColumn(column);
      setSortDirection('asc');
    }
  };

  const getSortedReports = () => {
    const filtered = getFilteredReports();
    
    if (sortDirection === 'default' || sortColumn === '') {
      // Return filtered reports in original order (most recent first by default from Firestore query)
      return filtered;
    }

    return [...filtered].sort((a, b) => {
      let valueA: string | number;
      let valueB: string | number;

      switch (sortColumn) {
        case 'name':
          valueA = a.userEmail.split('@')[0].toLowerCase();
          valueB = b.userEmail.split('@')[0].toLowerCase();
          break;
        case 'barangay':
          valueA = a.barangay.toLowerCase();
          valueB = b.barangay.toLowerCase();
          break;
        case 'street':
          valueA = a.street.toLowerCase();
          valueB = b.street.toLowerCase();
          break;
        case 'date':
          valueA = a.createdAt?.toDate ? a.createdAt.toDate().getTime() : new Date(a.createdAt).getTime();
          valueB = b.createdAt?.toDate ? b.createdAt.toDate().getTime() : new Date(b.createdAt).getTime();
          break;
        case 'title':
          valueA = a.title.toLowerCase();
          valueB = b.title.toLowerCase();
          break;
        default:
          return 0;
      }

      if (typeof valueA === 'string' && typeof valueB === 'string') {
        return sortDirection === 'asc' 
          ? valueA.localeCompare(valueB)
          : valueB.localeCompare(valueA);
      } else {
        return sortDirection === 'asc' 
          ? (valueA as number) - (valueB as number)
          : (valueB as number) - (valueA as number);
      }
    });
  };

  const getSortIcon = (column: string) => {
    if (sortColumn !== column || sortDirection === 'default') return 'swap-vertical';
    
    switch (sortDirection) {
      case 'asc': return 'arrow-up';
      case 'desc': return 'arrow-down';
      default: return 'swap-vertical';
    }
  };

  // Search functionality
  const handleSearch = (query: string) => {
    setSearchQuery(query);
    setCurrentPage(1); // Reset to first page when searching
  };

  const getFilteredReports = () => {
    let filtered = [...reports];
    // Hide resolved items from the Reports tab. They will appear in History.
    filtered = filtered.filter(r => r.status !== 'resolved');
    
    // Apply search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(report => 
        report.title.toLowerCase().includes(query) ||
        report.description.toLowerCase().includes(query) ||
        report.barangay.toLowerCase().includes(query) ||
        report.street.toLowerCase().includes(query) ||
        report.userEmail.toLowerCase().includes(query)
      );
    }
    
    return filtered;
  };

  const getPaginatedReports = () => {
    const sorted = getSortedReports();
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    return sorted.slice(startIndex, endIndex);
  };

  const getTotalPages = () => {
    const filtered = getFilteredReports();
    return Math.ceil(filtered.length / itemsPerPage);
  };

  const handlePageChange = (page: number) => {
    setCurrentPage(page);
  };

  const renderPagination = () => {
    const totalPages = getTotalPages();
    const filtered = getFilteredReports();
    
    if (totalPages <= 1) return null;

    const pages = [];
    const maxVisiblePages = 5;
    let startPage = Math.max(1, currentPage - Math.floor(maxVisiblePages / 2));
    let endPage = Math.min(totalPages, startPage + maxVisiblePages - 1);

    if (endPage - startPage + 1 < maxVisiblePages) {
      startPage = Math.max(1, endPage - maxVisiblePages + 1);
    }

    // Previous button
    pages.push(
      <TouchableOpacity
        key="prev"
        style={[
          styles.paginationButton,
          currentPage === 1 && styles.paginationButtonDisabled
        ]}
        onPress={() => handlePageChange(currentPage - 1)}
        disabled={currentPage === 1}
      >
        <Text style={[
          styles.paginationButtonText,
          currentPage === 1 && styles.paginationButtonTextDisabled
        ]}>‹</Text>
      </TouchableOpacity>
    );

    // Page numbers
    for (let i = startPage; i <= endPage; i++) {
      pages.push(
        <TouchableOpacity
          key={i}
          style={[
            styles.paginationButton,
            currentPage === i && styles.paginationButtonActive
          ]}
          onPress={() => handlePageChange(i)}
        >
          <Text style={[
            styles.paginationButtonText,
            currentPage === i && styles.paginationButtonTextActive
          ]}>{i}</Text>
        </TouchableOpacity>
      );
    }

    // Next button
    pages.push(
      <TouchableOpacity
        key="next"
        style={[
          styles.paginationButton,
          currentPage === totalPages && styles.paginationButtonDisabled
        ]}
        onPress={() => handlePageChange(currentPage + 1)}
        disabled={currentPage === totalPages}
      >
        <Text style={[
          styles.paginationButtonText,
          currentPage === totalPages && styles.paginationButtonTextDisabled
        ]}>›</Text>
      </TouchableOpacity>
    );

    return (
      <View style={styles.paginationContainer}>
        <Text style={styles.paginationInfo}>
          Showing {((currentPage - 1) * itemsPerPage) + 1}-{Math.min(currentPage * itemsPerPage, filtered.length)} of {filtered.length} reports
        </Text>
        <View style={styles.paginationButtons}>
          {pages}
        </View>
      </View>
    );
  };

  return (
    <ScrollView style={styles.container}>
      <View style={styles.mainSection}>
        <Text style={styles.title}>Reports</Text>
        
        

        {/* Search Input */}
        <View style={styles.searchContainer}>
          <View style={styles.searchInputContainer}>
            <MaterialIcons name="search" size={20} color="#6B7280" style={styles.searchIcon} />
            <TextInput
              style={styles.searchInput}
              placeholder="Search reports..."
              value={searchQuery}
              onChangeText={handleSearch}
              placeholderTextColor="#9CA3AF"
            />
            {searchQuery.length > 0 && (
              <TouchableOpacity
                style={styles.clearButton}
                onPress={() => handleSearch('')}
              >
                <MaterialIcons name="cancel" size={20} color="#6B7280" />
              </TouchableOpacity>
            )}
          </View>
        </View>

        {/* Loading State */}
        {loading && (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#22C55E" />
            <Text style={styles.loadingText}>Loading reports...</Text>
          </View>
        )}

        {/* Error State */}
        {error && (
          <View style={styles.errorContainer}>
            <MaterialIcons name="error" size={48} color="#EF4444" />
            <Text style={styles.errorText}>{error}</Text>
            <TouchableOpacity 
              style={styles.retryButton}
              onPress={() => {
                setError(null);
                setLoading(true);
                // The useEffect will re-run and fetch data again
              }}
            >
              <Text style={styles.retryButtonText}>Retry</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Reports List (Card style) */}
        {!loading && !error && (
          <View style={styles.cardListContainer}>
            {getFilteredReports().length === 0 ? (
              <View style={styles.emptyContainer}>
                <MaterialIcons name="description" size={64} color="#9CA3AF" />
                <Text style={styles.emptyText}>
                  {searchQuery ? 'No reports found matching your search' : 'No reports found'}
                </Text>
                <Text style={styles.emptySubtext}>
                  {searchQuery ? 'Try adjusting your search terms' : 'Reports will appear here when users submit them'}
                </Text>
              </View>
            ) : (
              getPaginatedReports().map((report) => (
                <TouchableOpacity
                  key={report.id}
                  style={styles.reportCardBlock}
                  activeOpacity={0.85}
                  onPress={() => handleViewReport(report)}
                >
                  <View style={styles.reportCardInner}>
                    <TouchableOpacity
                      style={styles.cardImageWrap}
                      activeOpacity={0.85}
                      onPress={() => {
                        if (report.imageURL) {
                          setImagePreviewUrl(report.imageURL);
                          setIsImagePreviewVisible(true);
                        }
                      }}
                    >
                      {report.imageURL ? (
                        <Image source={{ uri: report.imageURL }} style={styles.cardImage} resizeMode="cover" />
                      ) : (
                        <View style={styles.cardImagePlaceholder}>
                          <MaterialIcons name="image" size={32} color="#9CA3AF" />
                        </View>
                      )}
                    </TouchableOpacity>
                    <View style={styles.cardDetails}>
                      <Text style={styles.cardTitle} numberOfLines={1}>{report.title}</Text>
                      <Text style={styles.cardSubtitle} numberOfLines={1}>Title: {report.title}</Text>
                      <Text style={styles.cardLocation} numberOfLines={2}>
                        Location: {report.street ? `${report.street}, ` : ''}{report.barangay}
                      </Text>
                      <Text style={styles.cardDescription} numberOfLines={2}>
                        Description: {report.description || 'No description provided.'}
                      </Text>
                      <Text style={styles.cardSubmittedBy} numberOfLines={1}>
                        Submitted by: {report.userEmail.split('@')[0]}
                      </Text>
                    </View>
                  </View>
                  <Text style={styles.cardDateText}>Date & Time: {formatDate(report.createdAt)}</Text>
                </TouchableOpacity>
              ))
            )}
          </View>
        )}

        {/* Pagination */}
        {!loading && !error && getFilteredReports().length > 0 && renderPagination()}
      </View>

      {/* Report Detail Modal */}
      <Modal
        visible={modalVisible}
        transparent={true}
        animationType="fade"
        onRequestClose={handleCloseModal}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            {selectedReport && (
              <>
                {/* Modal Header */}
                <View style={styles.modalHeader}>
                  <Text style={styles.modalTitle}>Title: {selectedReport.title}</Text>
                  <TouchableOpacity 
                    style={styles.closeButton}
                    onPress={handleCloseModal}
                  >
                    <MaterialIcons name="close" size={24} color="#000" />
                  </TouchableOpacity>
                </View>

                {/* Date Reported */}
                <Text style={styles.modalDate}>
                  Date Reported: {formatDate(selectedReport.createdAt)}
                </Text>

                {/* Image */}
                {selectedReport.imageURL && (
                  <TouchableOpacity
                    style={styles.modalImageContainer}
                    activeOpacity={0.9}
                    onPress={() => {
                      setImagePreviewUrl(selectedReport.imageURL!);
                      setIsImagePreviewVisible(true);
                    }}
                  >
                    <Image 
                      source={{ uri: selectedReport.imageURL }} 
                      style={styles.modalImage}
                      resizeMode="cover"
                    />
                  </TouchableOpacity>
                )}

                {/* Location */}
                <View style={styles.modalSection}>
                  <Text style={styles.modalSectionTitle}>Location:</Text>
                  <Text style={styles.modalBulletPoint}>
                    • Barangay: {selectedReport.barangay}
                  </Text>
                  <Text style={styles.modalBulletPoint}>
                    • Street: {selectedReport.street}
                  </Text>
                </View>

                {/* Reported By */}
                <Text style={styles.modalReportedBy}>
                  Reported By: {selectedReport.userEmail}
                </Text>

                {/* Description */}
                <View style={styles.modalSection}>
                  <Text style={styles.modalSectionTitle}>Description:</Text>
                  <Text style={styles.modalDescription}>
                    {selectedReport.description}
                  </Text>
                </View>

                {/* Action Button */}
                <TouchableOpacity 
                  style={[styles.modalActionButton, isResolving && { opacity: 0.6 }]}
                  onPress={handleMarkAsResolved}
                  disabled={isResolving}
                >
                  <Text style={styles.modalActionButtonText}>{isResolving ? 'Marking…' : 'Mark as resolved'}</Text>
                </TouchableOpacity>
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
            <ScrollView
              contentContainerStyle={styles.previewScroll}
              maximumZoomScale={3}
              minimumZoomScale={1}
              centerContent
            >
              {imagePreviewUrl ? (
                <Image source={{ uri: imagePreviewUrl }} style={styles.previewImage} resizeMode="contain" />
              ) : null}
            </ScrollView>
            <TouchableOpacity style={styles.previewClose} onPress={() => setIsImagePreviewVisible(false)}>
              <MaterialIcons name="close" size={24} color="#fff" />
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Error Modal */}
      <ErrorModal
        visible={errorModal.visible}
        title={errorModal.title}
        message={errorModal.message}
        type={errorModal.type}
        onClose={closeErrorModal}
        autoClose={true}
        autoCloseDelay={4000}
      />
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  mainSection: {
    backgroundColor: '#F0FDF4',
    borderRadius: 12,
    padding: 20,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 3.84,
    elevation: 5,
    borderWidth: 1,
    borderColor: '#BBF7D0',
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1F2937',
    marginBottom: 20,
    textAlign: 'center',
  },
  filterContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  filterButtons: {
    flexDirection: 'row',
    backgroundColor: 'white',
    borderRadius: 8,
    padding: 4,
  },
  filterButton: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 6,
  },
  activeFilterButton: {
    backgroundColor: '#22C55E',
  },
  filterButtonText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#6B7280',
  },
  activeFilterButtonText: {
    color: 'white',
  },
  dateButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'white',
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  dateButtonText: {
    fontSize: 14,
    color: '#6B7280',
    marginLeft: 8,
  },
  // Table Styles
  cardListContainer: {
    backgroundColor: '#E7F6EA',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#CDE8D2',
    padding: 12,
    gap: 12,
  },
  reportCardBlock: {
    backgroundColor: '#F4FBF6',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#D9F1DE',
    padding: 12,
  },
  reportCardInner: {
    flexDirection: 'row',
    gap: 12,
    alignItems: 'flex-start',
  },
  cardImageWrap: {
    width: 140,
    height: 90,
    borderRadius: 10,
    overflow: 'hidden',
    backgroundColor: '#ECF5EE',
  },
  cardImage: {
    width: '100%',
    height: '100%',
  },
  cardImagePlaceholder: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cardDetails: {
    flex: 1,
  },
  cardTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#1F3A2C',
  },
  cardSubtitle: {
    fontSize: 12,
    color: '#1F3A2C',
    marginTop: 4,
  },
  cardLocation: {
    fontSize: 12,
    color: '#1F3A2C',
    marginTop: 4,
  },
  cardDescription: {
    fontSize: 12,
    color: '#1F3A2C',
    marginTop: 4,
  },
  cardSubmittedBy: {
    fontSize: 12,
    color: '#1F3A2C',
    marginTop: 4,
  },
  cardDateText: {
    fontSize: 10,
    color: '#1F3A2C',
    textAlign: 'right',
    marginTop: 8,
  },
  loadingContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#6B7280',
  },
  errorContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
  },
  errorText: {
    marginTop: 16,
    fontSize: 16,
    color: '#EF4444',
    textAlign: 'center',
  },
  retryButton: {
    marginTop: 16,
    backgroundColor: '#22C55E',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  retryButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },
  emptyText: {
    marginTop: 16,
    fontSize: 18,
    fontWeight: '600',
    color: '#6B7280',
  },
  emptySubtext: {
    marginTop: 8,
    fontSize: 14,
    color: '#9CA3AF',
    textAlign: 'center',
  },
  // Modal Styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContainer: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 24,
    width: '100%',
    maxWidth: 500,
    maxHeight: '90%',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 8,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1F2937',
    flex: 1,
    marginRight: 16,
  },
  closeButton: {
    padding: 4,
  },
  modalDate: {
    fontSize: 14,
    color: '#6B7280',
    marginBottom: 16,
  },
  modalImageContainer: {
    marginBottom: 20,
    borderRadius: 8,
    overflow: 'hidden',
  },
  modalImage: {
    width: '100%',
    height: 200,
  },
  modalSection: {
    marginBottom: 16,
  },
  modalSectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#1F2937',
    marginBottom: 8,
  },
  modalBulletPoint: {
    fontSize: 14,
    color: '#6B7280',
    marginLeft: 8,
    marginBottom: 4,
  },
  modalReportedBy: {
    fontSize: 14,
    color: '#6B7280',
    marginBottom: 16,
  },
  modalDescription: {
    fontSize: 14,
    color: '#6B7280',
    lineHeight: 20,
  },
  modalActionButton: {
    backgroundColor: '#22C55E',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 20,
  },
  modalActionButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  // Image preview styles
  previewOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.85)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  previewContainer: {
    width: '100%',
    maxWidth: 900,
    maxHeight: '90%',
    borderRadius: 12,
    overflow: 'hidden',
  },
  previewScroll: {
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 300,
  },
  previewImage: {
    width: '100%',
    height: '100%',
  },
  previewClose: {
    position: 'absolute',
    top: 12,
    right: 12,
    backgroundColor: 'rgba(0,0,0,0.5)',
    borderRadius: 16,
    padding: 6,
  },
  // Search styles
  searchContainer: {
    marginBottom: 20,
  },
  searchInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'white',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    color: '#1F2937',
    paddingVertical: 4,
  },
  clearButton: {
    padding: 4,
  },
  // Pagination styles
  paginationContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 20,
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: 'white',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  paginationInfo: {
    fontSize: 14,
    color: '#6B7280',
  },
  paginationButtons: {
    flexDirection: 'row',
    gap: 8,
  },
  paginationButton: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    backgroundColor: 'white',
    minWidth: 40,
    alignItems: 'center',
  },
  paginationButtonActive: {
    backgroundColor: '#22C55E',
    borderColor: '#22C55E',
  },
  paginationButtonDisabled: {
    backgroundColor: '#F3F4F6',
    borderColor: '#E5E7EB',
  },
  paginationButtonText: {
    fontSize: 14,
    color: '#6B7280',
    fontWeight: '500',
  },
  paginationButtonTextActive: {
    color: 'white',
  },
  paginationButtonTextDisabled: {
    color: '#9CA3AF',
  },
});

export default ReportsTab;
