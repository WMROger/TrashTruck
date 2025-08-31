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
      <View style={styles.reportsContainer}>
        <Text style={styles.sectionTitle}>Reports</Text>
        
        {/* Filter Options */}
        <View style={styles.filterContainer}>
          <View style={styles.filterButtons}>
            <TouchableOpacity 
              style={[styles.filterButton, activeFilter === 'today' && styles.activeFilterButton]}
              onPress={() => handleFilterChange('today')}
            >
              <Text style={[styles.filterButtonText, activeFilter === 'today' && styles.activeFilterButtonText]}>
                Today
              </Text>
            </TouchableOpacity>
            
            <TouchableOpacity 
              style={[styles.filterButton, activeFilter === 'weekly' && styles.activeFilterButton]}
              onPress={() => handleFilterChange('weekly')}
            >
              <Text style={[styles.filterButtonText, activeFilter === 'weekly' && styles.activeFilterButtonText]}>
                Weekly
              </Text>
            </TouchableOpacity>
            
            <TouchableOpacity 
              style={[styles.filterButton, activeFilter === 'monthly' && styles.activeFilterButton]}
              onPress={() => handleFilterChange('monthly')}
            >
              <Text style={[styles.filterButtonText, activeFilter === 'monthly' && styles.activeFilterButtonText]}>
                Monthly
              </Text>
            </TouchableOpacity>
          </View>
          
          <TouchableOpacity style={styles.datePicker}>
            <Ionicons name="calendar" size={20} color="#666" />
            <Text style={styles.datePickerText}>Date</Text>
          </TouchableOpacity>
        </View>

        {/* Reports List */}
        <View style={styles.reportsList}>
          {reports.map((report) => (
            <View key={report.id} style={styles.reportCard}>
              <View style={styles.reportHeader}>
                <View style={styles.reportImageContainer}>
                  <View style={styles.reportImagePlaceholder}>
                    <Ionicons name="image" size={40} color="#999" />
                  </View>
                </View>
                
                <View style={styles.reportContent}>
                  <Text style={styles.reportTitle}>{report.title}</Text>
                  <Text style={styles.reportSubtitle}>{report.subtitle}</Text>
                  <Text style={styles.reportLocation}>
                    <Ionicons name="location" size={16} color="#666" />
                    {' '}{report.location}
                  </Text>
                  <Text style={styles.reportDescription}>{report.description}</Text>
                  
                  <View style={styles.reportFooter}>
                    <Text style={styles.reportSubmittedBy}>
                      Submitted by: {report.submittedBy}
                    </Text>
                    <Text style={styles.reportDateTime}>
                      Date & Time: {report.dateTime}
                    </Text>
                  </View>
                </View>
              </View>
              
              {/* Status and Actions */}
              <View style={styles.reportActions}>
                <View style={styles.statusContainer}>
                  <View style={[styles.statusDot, { backgroundColor: getStatusColor(report.status) }]} />
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
  reportsContainer: {
    backgroundColor: '#E8F5E8',
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
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
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
    backgroundColor: '#2E8B57',
  },
  filterButtonText: {
    fontSize: 14,
    color: '#666',
    fontWeight: '500',
  },
  activeFilterButtonText: {
    color: 'white',
  },
  datePicker: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'white',
    borderRadius: 8,
    paddingHorizontal: 15,
    paddingVertical: 10,
  },
  datePickerText: {
    fontSize: 14,
    color: '#666',
    marginLeft: 8,
  },
  reportsList: {
    gap: 15,
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
  },
  reportHeader: {
    flexDirection: 'row',
    marginBottom: 15,
  },
  reportImageContainer: {
    marginRight: 15,
  },
  reportImagePlaceholder: {
    width: 80,
    height: 80,
    backgroundColor: '#F0F0F0',
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  reportContent: {
    flex: 1,
  },
  reportTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 5,
  },
  reportSubtitle: {
    fontSize: 16,
    color: '#666',
    marginBottom: 8,
  },
  reportLocation: {
    fontSize: 14,
    color: '#666',
    marginBottom: 8,
    flexDirection: 'row',
    alignItems: 'center',
  },
  reportDescription: {
    fontSize: 14,
    color: '#666',
    lineHeight: 20,
    marginBottom: 10,
  },
  reportFooter: {
    gap: 4,
  },
  reportSubmittedBy: {
    fontSize: 12,
    color: '#999',
  },
  reportDateTime: {
    fontSize: 12,
    color: '#999',
  },
  reportActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 15,
    borderTopWidth: 1,
    borderTopColor: '#F0F0F0',
  },
  statusContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 8,
  },
  statusText: {
    fontSize: 14,
    color: '#666',
    fontWeight: '500',
  },
  actionButtons: {
    flexDirection: 'row',
    gap: 15,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderRadius: 6,
    backgroundColor: '#F8F9FA',
  },
  actionButtonText: {
    fontSize: 12,
    color: '#666',
    marginLeft: 4,
    fontWeight: '500',
  },
});

export default ReportsTab;
