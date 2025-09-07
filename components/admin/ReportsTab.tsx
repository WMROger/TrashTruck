import { Ionicons } from '@expo/vector-icons';
import { collection, doc, onSnapshot, orderBy, query, serverTimestamp, updateDoc } from 'firebase/firestore';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Image, Modal, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { db } from '../../config/firebase';
import { useAuthContext } from '../AuthContext';

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
  const [activeFilter, setActiveFilter] = useState<'today' | 'weekly' | 'monthly'>('today');
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

  const handleFilterChange = (filter: 'today' | 'weekly' | 'monthly') => {
    setActiveFilter(filter);
    // TODO: Implement date filtering
  };

  const handleStatusChange = async (reportId: string, newStatus: Report['status']) => {
    if (!db) {
      Alert.alert('Error', 'Database not available');
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
      Alert.alert('Error', 'Failed to update report status');
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
    setSelectedReport(report);
    setModalVisible(true);
  };

  const handleCloseModal = () => {
    setModalVisible(false);
    setSelectedReport(null);
  };

  const handleMarkAsResolved = async () => {
    if (!selectedReport) return;
    
    try {
      await handleStatusChange(selectedReport.id, 'resolved');
      handleCloseModal();
      Alert.alert('Success', 'Report marked as resolved');
    } catch (error) {
      Alert.alert('Error', 'Failed to mark report as resolved');
    }
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
        
        {/* Filter Options */}
        <View style={styles.filterContainer}>
          <View style={styles.filterButtons}>
            <TouchableOpacity 
              style={[
                styles.filterButton,
                activeFilter === 'today' && styles.activeFilterButton
              ]}
              onPress={() => handleFilterChange('today')}
            >
              <Text style={[
                styles.filterButtonText,
                activeFilter === 'today' && styles.activeFilterButtonText
              ]}>
                Today
              </Text>
            </TouchableOpacity>
            
            <TouchableOpacity 
              style={[
                styles.filterButton,
                activeFilter === 'weekly' && styles.activeFilterButton
              ]}
              onPress={() => handleFilterChange('weekly')}
            >
              <Text style={[
                styles.filterButtonText,
                activeFilter === 'weekly' && styles.activeFilterButtonText
              ]}>
                Weekly
              </Text>
            </TouchableOpacity>
            
            <TouchableOpacity 
              style={[
                styles.filterButton,
                activeFilter === 'monthly' && styles.activeFilterButton
              ]}
              onPress={() => handleFilterChange('monthly')}
            >
              <Text style={[
                styles.filterButtonText,
                activeFilter === 'monthly' && styles.activeFilterButtonText
              ]}>
                Monthly
              </Text>
            </TouchableOpacity>
          </View>
          
          <TouchableOpacity style={styles.dateButton}>
            <Ionicons name="calendar" size={20} color="#666" />
            <Text style={styles.dateButtonText}>Date</Text>
          </TouchableOpacity>
        </View>

        {/* Search Input */}
        <View style={styles.searchContainer}>
          <View style={styles.searchInputContainer}>
            <Ionicons name="search" size={20} color="#6B7280" style={styles.searchIcon} />
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
                <Ionicons name="close-circle" size={20} color="#6B7280" />
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
            <Ionicons name="alert-circle" size={48} color="#EF4444" />
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

        {/* Reports Table */}
        {!loading && !error && (
          <View style={styles.reportsTable}>
            {getFilteredReports().length === 0 ? (
              <View style={styles.emptyContainer}>
                <Ionicons name="document-outline" size={64} color="#9CA3AF" />
                <Text style={styles.emptyText}>
                  {searchQuery ? 'No reports found matching your search' : 'No reports found'}
                </Text>
                <Text style={styles.emptySubtext}>
                  {searchQuery ? 'Try adjusting your search terms' : 'Reports will appear here when users submit them'}
                </Text>
              </View>
            ) : (
              <>
                {/* Table Header */}
                <View style={styles.tableHeader}>
                  <TouchableOpacity 
                    style={[styles.headerCell, styles.nameColumn]}
                    onPress={() => handleSort('name')}
                  >
                    <Text style={styles.headerText}>Name</Text>
                    <Ionicons 
                      name={getSortIcon('name') as any} 
                      size={16} 
                      color={sortColumn === 'name' ? '#22C55E' : '#9CA3AF'} 
                    />
                  </TouchableOpacity>
                  
                  <TouchableOpacity 
                    style={[styles.headerCell, styles.barangayColumn]}
                    onPress={() => handleSort('barangay')}
                  >
                    <Text style={styles.headerText}>Barangay</Text>
                    <Ionicons 
                      name={getSortIcon('barangay') as any} 
                      size={16} 
                      color={sortColumn === 'barangay' ? '#22C55E' : '#9CA3AF'} 
                    />
                  </TouchableOpacity>
                  
                  <TouchableOpacity 
                    style={[styles.headerCell, styles.streetColumn]}
                    onPress={() => handleSort('street')}
                  >
                    <Text style={styles.headerText}>Street</Text>
                    <Ionicons 
                      name={getSortIcon('street') as any} 
                      size={16} 
                      color={sortColumn === 'street' ? '#22C55E' : '#9CA3AF'} 
                    />
                  </TouchableOpacity>
                  
                  <TouchableOpacity 
                    style={[styles.headerCell, styles.dateColumn]}
                    onPress={() => handleSort('date')}
                  >
                    <Text style={styles.headerText}>Date</Text>
                    <Ionicons 
                      name={getSortIcon('date') as any} 
                      size={16} 
                      color={sortColumn === 'date' ? '#22C55E' : '#9CA3AF'} 
                    />
                  </TouchableOpacity>
                  
                  <TouchableOpacity 
                    style={[styles.headerCell, styles.titleColumn]}
                    onPress={() => handleSort('title')}
                  >
                    <Text style={styles.headerText}>Title</Text>
                    <Ionicons 
                      name={getSortIcon('title') as any} 
                      size={16} 
                      color={sortColumn === 'title' ? '#22C55E' : '#9CA3AF'} 
                    />
                  </TouchableOpacity>
                  
                  <View style={[styles.headerCell, styles.actionsColumn]}>
                    <Text style={styles.headerText}>Actions</Text>
                  </View>
                </View>
                
                {/* Table Rows */}
                {getPaginatedReports().map((report, index) => (
                  <TouchableOpacity 
                    key={report.id} 
                    style={[
                      styles.tableRow,
                      index % 2 === 0 ? styles.tableRowEven : styles.tableRowOdd
                    ]}
                    onPress={() => handleViewReport(report)}
                  >
                    <Text style={[styles.cellText, styles.nameColumn]} numberOfLines={1}>
                      {report.userEmail.split('@')[0]}
                    </Text>
                    <Text style={[styles.cellText, styles.barangayColumn]} numberOfLines={1}>
                      {report.barangay}
                    </Text>
                    <Text style={[styles.cellText, styles.streetColumn]} numberOfLines={1}>
                      {report.street}
                    </Text>
                    <Text style={[styles.cellText, styles.dateColumn]} numberOfLines={1}>
                      {formatDate(report.createdAt).split(',')[0]}
                    </Text>
                    <Text style={[styles.cellText, styles.titleColumn]} numberOfLines={1}>
                      {report.title}
                    </Text>
                    <View style={[styles.actionCell, styles.actionsColumn]}>
                      <TouchableOpacity 
                        style={styles.tableActionButton}
                        onPress={(e) => {
                          e.stopPropagation();
                          handleViewReport(report);
                        }}
                      >
                        <Ionicons name="eye" size={16} color="#4169E1" />
                      </TouchableOpacity>
                      
                      {report.status === 'in-progress' ? (
                        <TouchableOpacity 
                          style={styles.tableActionButton}
                          onPress={(e) => {
                            e.stopPropagation();
                            handleStatusChange(report.id, 'pending');
                          }}
                        >
                          <Ionicons name="stop" size={16} color="#EF4444" />
                        </TouchableOpacity>
                      ) : (
                        <TouchableOpacity 
                          style={styles.tableActionButton}
                          onPress={(e) => {
                            e.stopPropagation();
                            handleStatusChange(report.id, 'in-progress');
                          }}
                        >
                          <Ionicons name="play" size={16} color="#4169E1" />
                        </TouchableOpacity>
                      )}
                      
                      <TouchableOpacity 
                        style={styles.tableActionButton}
                        onPress={(e) => {
                          e.stopPropagation();
                          handleStatusChange(report.id, 'resolved');
                        }}
                      >
                        <Ionicons name="checkmark" size={16} color="#32CD32" />
                      </TouchableOpacity>
                    </View>
                  </TouchableOpacity>
                ))}
              </>
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
                    <Ionicons name="close" size={24} color="#000" />
                  </TouchableOpacity>
                </View>

                {/* Date Reported */}
                <Text style={styles.modalDate}>
                  Date Reported: {formatDate(selectedReport.createdAt)}
                </Text>

                {/* Image */}
                {selectedReport.imageURL && (
                  <View style={styles.modalImageContainer}>
                    <Image 
                      source={{ uri: selectedReport.imageURL }} 
                      style={styles.modalImage}
                      resizeMode="cover"
                    />
                  </View>
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
                  style={styles.modalActionButton}
                  onPress={handleMarkAsResolved}
                >
                  <Text style={styles.modalActionButtonText}>Mark as resolved</Text>
                </TouchableOpacity>
              </>
            )}
          </View>
        </View>
      </Modal>
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
  reportsTable: {
    backgroundColor: 'white',
    borderRadius: 8,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  tableHeader: {
    flexDirection: 'row',
    backgroundColor: '#F0FDF4',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#D1FAE5',
  },
  headerCell: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 4,
  },
  headerText: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#1F2937',
    textAlign: 'left',
  },
  tableRow: {
    flexDirection: 'row',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
    alignItems: 'center',
  },
  tableRowEven: {
    backgroundColor: '#F9FAFB',
  },
  tableRowOdd: {
    backgroundColor: 'white',
  },
  cellText: {
    fontSize: 14,
    color: '#1F2937',
    textAlign: 'left',
    paddingHorizontal: 4,
  },
  // Column Width Styles
  nameColumn: {
    width: '15%',
    minWidth: 80,
  },
  barangayColumn: {
    width: '18%',
    minWidth: 100,
  },
  streetColumn: {
    width: '20%',
    minWidth: 120,
  },
  dateColumn: {
    width: '12%',
    minWidth: 80,
  },
  titleColumn: {
    width: '25%',
    minWidth: 150,
  },
  actionsColumn: {
    width: '10%',
    minWidth: 100,
  },
  actionCell: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
    justifyContent: 'flex-end',
    paddingHorizontal: 4,
  },
  tableActionButton: {
    padding: 6,
    borderRadius: 4,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
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
