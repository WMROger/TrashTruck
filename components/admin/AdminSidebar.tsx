import { MaterialIcons } from '@expo/vector-icons';
import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

interface AdminSidebarProps {
  activeTab: string;
  onTabPress: (tab: string) => void;
}

const AdminSidebar: React.FC<AdminSidebarProps> = ({ activeTab, onTabPress }) => {
  const navigationItems = [
    { id: 'dashboard', label: 'DASHBOARD', icon: 'grid-view', activeIcon: 'grid-view' },
    { id: 'trash-reports', label: 'TRASH REPORTS', icon: 'assignment', activeIcon: 'assignment' },
    { id: 'service-feedback', label: 'SERVICE FEEDBACK', icon: 'rate-review', activeIcon: 'rate-review' },
    { id: 'route-optimization', label: 'ROUTE OPTIMIZATION', icon: 'route', activeIcon: 'route' },
    { id: 'truck-inventory', label: 'FLEET INVENTORY', icon: 'local-shipping', activeIcon: 'local-shipping' },
    { id: 'driver-onboarding', label: 'DRIVER ACCOUNTS', icon: 'person-search', activeIcon: 'person-search' },
    { id: 'collection-scheduler', label: 'COLLECTION SCHEDULES', icon: 'event-note', activeIcon: 'event-note' },
    { id: 'coordinators', label: 'COORDINATOR DIRECTORY', icon: 'people', activeIcon: 'people' },
    { id: 'operational-overrides', label: 'SYSTEM OVERRIDES', icon: 'report-problem', activeIcon: 'report-problem' },
    { id: 'analytics', label: 'ANALYTICS', icon: 'bar-chart', activeIcon: 'bar-chart' },
  ];

  return (
    <View style={styles.sidebar}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>CENRO</Text>
        <Text style={styles.headerSubtitle}>CITY GOVT PORTAL</Text>
      </View>
      
      <View style={styles.navigation}>
        {navigationItems.map((item) => {
          const isActive = activeTab === item.id;
          return (
            <TouchableOpacity
              key={item.id}
              style={[
                styles.navItem,
                isActive && styles.activeNavItem
              ]}
              onPress={() => onTabPress(item.id)}
              activeOpacity={0.7}
            >
              <MaterialIcons
                name={(isActive ? item.activeIcon : item.icon) as any}
                size={20}
                color={isActive ? '#FFFFFF' : '#4B5563'}
              />
              <Text style={[
                styles.navText,
                isActive && styles.activeNavText
              ]}>
                {item.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      <View style={styles.bottomSection}>
        <View style={styles.statusBlock}>
          <Text style={styles.statusLabel}>SYSTEM STATUS</Text>
          <View style={styles.statusRow}>
            <View style={styles.statusDot} />
            <Text style={styles.statusText}>Optimal Performance</Text>
          </View>
        </View>

        <TouchableOpacity style={styles.bottomNavBtn}>
          <MaterialIcons name="help-outline" size={20} color="#4B5563" />
          <Text style={styles.bottomNavText}>SUPPORT</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.bottomNavBtn}>
          <MaterialIcons name="history" size={20} color="#4B5563" />
          <Text style={styles.bottomNavText}>LOGS</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  sidebar: {
    width: 256,
    backgroundColor: '#F3F4F6',
    borderRightWidth: 1,
    borderRightColor: '#E5E7EB',
    justifyContent: 'space-between',
  },
  header: {
    padding: 24,
    paddingTop: 40,
    marginBottom: 8,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '900',
    color: '#2E8B57',
    marginBottom: 4,
    letterSpacing: 0.5,
  },
  headerSubtitle: {
    fontSize: 10,
    fontWeight: '700',
    color: '#6B7280',
    letterSpacing: 1,
  },
  navigation: {
    flex: 1,
    paddingHorizontal: 16,
  },
  navItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    marginBottom: 8,
  },
  activeNavItem: {
    backgroundColor: '#4b6354',
  },
  navText: {
    fontSize: 12,
    marginLeft: 16,
    fontWeight: '700',
    color: '#4B5563',
    letterSpacing: 0.5,
  },
  activeNavText: {
    color: '#FFFFFF',
  },
  
  bottomSection: {
    padding: 24,
    paddingBottom: 40,
  },
  statusBlock: {
    backgroundColor: '#E5E7EB',
    padding: 16,
    borderRadius: 8,
    marginBottom: 24,
  },
  statusLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: '#4b6354',
    letterSpacing: 0.5,
    marginBottom: 8,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#2E8B57',
  },
  statusText: {
    fontSize: 12,
    color: '#374151',
    fontWeight: '500',
  },
  bottomNavBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
  },
  bottomNavText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#4B5563',
    letterSpacing: 0.5,
  },
});

export default AdminSidebar;
