import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

interface AdminSidebarProps {
  activeTab: string;
  onTabPress: (tab: string) => void;
}

const AdminSidebar: React.FC<AdminSidebarProps> = ({ activeTab, onTabPress }) => {
  const navigationItems = [
    { id: 'home', label: 'Home', icon: 'home-outline', activeIcon: 'home' },
    { id: 'schedule', label: 'Schedule', icon: 'calendar-outline', activeIcon: 'calendar' },
    { id: 'announcements', label: 'Announcements', icon: 'megaphone-outline', activeIcon: 'megaphone' },
    { id: 'reports', label: 'Reports', icon: 'document-text-outline', activeIcon: 'document-text' },
    { id: 'history', label: 'History', icon: 'time-outline', activeIcon: 'time' },
    { id: 'feedbacks', label: 'Feedbacks', icon: 'chatbubble-ellipses-outline', activeIcon: 'chatbubble-ellipses' },
    { id: 'accounts', label: 'Accounts', icon: 'people-outline', activeIcon: 'people' },
  ];

  return (
    <View style={styles.sidebar}>
      <View style={styles.header}>
        <Text style={styles.headerText}>Welcome, Admin!</Text>
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
              <Ionicons
                name={isActive ? item.activeIcon : item.icon}
                size={24}
                color={isActive ? '#2E8B57' : '#E5E7EB'}
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
    </View>
  );
};

const styles = StyleSheet.create({
  sidebar: {
    width: 256,
    backgroundColor: '#2E8B57',
    borderRightWidth: 1,
    borderRightColor: '#1B5E20',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 10,
    },
    shadowOpacity: 0.25,
    shadowRadius: 10,
    elevation: 10,
  },
  header: {
    padding: 20,
    paddingTop: 40,
    borderBottomWidth: 1,
    borderBottomColor: '#1B5E20',
    backgroundColor: '#1B5E20',
  },
  headerText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: 'white',
    textAlign: 'center',
  },
  navigation: {
    paddingTop: 20,
  },
  navItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 20,
    marginHorizontal: 8,
    marginVertical: 2,
    borderRadius: 8,
  },
  activeNavItem: {
    backgroundColor: '#F0F9F0',
    borderLeftWidth: 4,
    borderLeftColor: '#2E8B57',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 1,
    },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  navText: {
    fontSize: 16,
    marginLeft: 16,
    fontWeight: '500',
    color: 'white',
  },
  activeNavText: {
    color: '#2E8B57',
    fontWeight: 'bold',
  },
});

export default AdminSidebar;
