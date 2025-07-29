import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function AdminDashboard() {
  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Admin Dashboard</Text>
        <Text style={styles.subtitle}>TrashTruck Management System</Text>
      </View>
      
      <ScrollView style={styles.content}>
        <View style={styles.statsContainer}>
          <View style={styles.statCard}>
            <Ionicons name="trash" size={32} color="#2E8B57" />
            <Text style={styles.statNumber}>1,234</Text>
            <Text style={styles.statLabel}>Collections Today</Text>
          </View>
          
          <View style={styles.statCard}>
            <Ionicons name="car" size={32} color="#4169E1" />
            <Text style={styles.statNumber}>45</Text>
            <Text style={styles.statLabel}>Active Trucks</Text>
          </View>
          
          <View style={styles.statCard}>
            <Ionicons name="people" size={32} color="#FF6347" />
            <Text style={styles.statNumber}>89</Text>
            <Text style={styles.statLabel}>Staff Online</Text>
          </View>
          
          <View style={styles.statCard}>
            <Ionicons name="checkmark-circle" size={32} color="#32CD32" />
            <Text style={styles.statNumber}>98%</Text>
            <Text style={styles.statLabel}>Completion Rate</Text>
          </View>
        </View>
        
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Recent Activity</Text>
          <View style={styles.activityItem}>
            <Ionicons name="time" size={20} color="#666" />
            <Text style={styles.activityText}>Truck #12 completed route in Downtown</Text>
            <Text style={styles.activityTime}>2 minutes ago</Text>
          </View>
          <View style={styles.activityItem}>
            <Ionicons name="alert" size={20} color="#FF6347" />
            <Text style={styles.activityText}>Maintenance alert: Truck #8 needs service</Text>
            <Text style={styles.activityTime}>15 minutes ago</Text>
          </View>
          <View style={styles.activityItem}>
            <Ionicons name="checkmark" size={20} color="#32CD32" />
            <Text style={styles.activityText}>New route assigned to Truck #15</Text>
            <Text style={styles.activityTime}>1 hour ago</Text>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F5F5',
  },
  header: {
    backgroundColor: '#2E8B57',
    padding: 20,
    paddingTop: 40,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: 'white',
    marginBottom: 5,
  },
  subtitle: {
    fontSize: 16,
    color: '#E8F5E8',
  },
  content: {
    flex: 1,
    padding: 20,
  },
  statsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginBottom: 30,
  },
  statCard: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 20,
    width: '48%',
    marginBottom: 15,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 3.84,
    elevation: 5,
  },
  statNumber: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
    marginTop: 10,
  },
  statLabel: {
    fontSize: 14,
    color: '#666',
    marginTop: 5,
    textAlign: 'center',
  },
  section: {
    backgroundColor: 'white',
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
    marginBottom: 15,
  },
  activityItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  activityText: {
    flex: 1,
    fontSize: 16,
    color: '#333',
    marginLeft: 12,
  },
  activityTime: {
    fontSize: 12,
    color: '#999',
  },
}); 