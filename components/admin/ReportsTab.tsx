import { Ionicons } from '@expo/vector-icons';
import React, { useState } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

interface Report {
  id: string;
  title: string;
  subtitle: string;
  location: string;
  description: string;
  submittedBy: string;
  dateTime: string;
  imageUrl?: string;
  status: 'pending' | 'in-progress' | 'resolved' | 'closed';
}

const ReportsTab: React.FC = () => {
  const [activeFilter, setActiveFilter] = useState<'today' | 'weekly' | 'monthly'>('today');
  const [selectedDate, setSelectedDate] = useState('');

  // Mock data - replace with backend integration
  const [reports, setReports] = useState<Report[]>([
    {
      id: '1',
      title: 'Missed Garbage Pickup',
      subtitle: 'Garbage Not Collected on Scheduled Day',
      location: '123 Maple Street, Zone B',
      description: 'Garbage was not picked up on the regular Tuesday schedule. It has been sitting outside for two days and is beginning to smell.',
      submittedBy: 'Sarah L., Resident',
      dateTime: '2025-08-21, 08:47 AM',
      status: 'pending'
    },
    {
      id: '2',
      title: 'Missed Garbage Pickup',
      subtitle: 'Garbage Not Collected on Scheduled Day',
      location: '456 Oak Avenue, Zone A',
      description: 'Garbage was not picked up on the regular Tuesday schedule. It has been sitting outside for two days and is beginning to smell.',
      submittedBy: 'John D., Resident',
      dateTime: '2025-08-21, 09:15 AM',
      status: 'in-progress'
    }
  ]);

  const handleFilterChange = (filter: 'today' | 'weekly' | 'monthly') => {
    setActiveFilter(filter);
    // Here you would typically fetch filtered data from backend
  };

  const handleStatusChange = (reportId: string, newStatus: Report['status']) => {
    setReports(reports.map(report => 
      report.id === reportId ? { ...report, status: newStatus } : report
    ));
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

        {/* Reports List */}
        <View style={styles.reportsList}>
          {reports.map((report) => (
            <View key={report.id} style={styles.reportCard}>
              <View style={styles.reportHeader}>
                <View style={styles.reportImage}>
                  <Ionicons name="image" size={40} color="#999" />
                </View>
                
                <View style={styles.reportContent}>
                  <Text style={styles.reportTitle}>{report.title}</Text>
                  <Text style={styles.reportSubtitle}>{report.subtitle}</Text>
                  <View style={styles.locationContainer}>
                    <Ionicons name="location" size={16} color="#666" />
                    <Text style={styles.locationText}>{report.location}</Text>
                  </View>
                  <Text style={styles.reportDescription}>{report.description}</Text>
                  
                  <View style={styles.reportMeta}>
                    <Text style={styles.metaText}>
                      Submitted by: {report.submittedBy}
                    </Text>
                    <Text style={styles.metaText}>
                      Date & Time: {report.dateTime}
                    </Text>
                  </View>
                </View>
              </View>
              
              {/* Status and Actions */}
              <View style={styles.reportFooter}>
                <View style={styles.statusContainer}>
                  <View 
                    style={[
                      styles.statusIndicator,
                      { backgroundColor: getStatusColor(report.status) }
                    ]}
                  />
                  <Text style={styles.statusText}>{getStatusText(report.status)}</Text>
                </View>
                
                <View style={styles.actionButtons}>
                  <TouchableOpacity style={styles.actionButton}>
                    <Ionicons name="eye" size={16} color="#4169E1" />
                    <Text style={styles.actionButtonText}>View</Text>
                  </TouchableOpacity>
                  
                  <TouchableOpacity style={styles.actionButton}>
                    <Ionicons name="create" size={16} color="#FFD700" />
                    <Text style={styles.actionButtonText}>Edit</Text>
                  </TouchableOpacity>
                  
                  <TouchableOpacity style={styles.actionButton}>
                    <Ionicons name="checkmark" size={16} color="#32CD32" />
                    <Text style={styles.actionButtonText}>Resolve</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          ))}
        </View>
      </View>
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
  reportsList: {
    gap: 16,
  },
  reportCard: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 3.84,
    elevation: 5,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  reportHeader: {
    flexDirection: 'row',
    marginBottom: 16,
  },
  reportImage: {
    width: 80,
    height: 80,
    backgroundColor: '#F3F4F6',
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  reportContent: {
    flex: 1,
  },
  reportTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1F2937',
    marginBottom: 4,
  },
  reportSubtitle: {
    fontSize: 16,
    color: '#6B7280',
    marginBottom: 8,
  },
  locationContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  locationText: {
    fontSize: 14,
    color: '#6B7280',
    marginLeft: 4,
  },
  reportDescription: {
    fontSize: 14,
    color: '#6B7280',
    lineHeight: 20,
    marginBottom: 12,
  },
  reportMeta: {
    gap: 4,
  },
  metaText: {
    fontSize: 12,
    color: '#9CA3AF',
  },
  reportFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
  },
  statusContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statusIndicator: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 8,
  },
  statusText: {
    fontSize: 14,
    color: '#6B7280',
    fontWeight: '500',
  },
  actionButtons: {
    flexDirection: 'row',
    gap: 16,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 4,
    paddingHorizontal: 12,
    borderRadius: 6,
    backgroundColor: '#F9FAFB',
  },
  actionButtonText: {
    fontSize: 12,
    color: '#6B7280',
    marginLeft: 4,
    fontWeight: '500',
  },
});

export default ReportsTab;
