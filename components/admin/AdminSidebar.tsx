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
  ];

  return (
    <View style={styles.sidebar}>
      <View style={styles.header}>
        <Text style={styles.welcomeText}>Welcome, Admin!</Text>
      </View>
      
      <View style={styles.navigation}>
        {navigationItems.map((item) => {
          const isActive = activeTab === item.id;
          return (
            <TouchableOpacity
              key={item.id}
              style={[styles.navItem, isActive && styles.activeNavItem]}
              onPress={() => onTabPress(item.id)}
              activeOpacity={0.7}
            >
              <Ionicons
                name={isActive ? item.activeIcon : item.icon}
                size={24}
                color={isActive ? '#2E8B57' : '#666'}
              />
              <Text style={[styles.navText, isActive && styles.activeNavText]}>
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
    width: 250,
    backgroundColor: '#2E8B57',
    borderRightWidth: 1,
    borderRightColor: '#E0E0E0',
    shadowColor: '#000',
    shadowOffset: {
      width: 2,
      height: 0,
    },
    shadowOpacity: 0.1,
    shadowRadius: 3.84,
    elevation: 5,
  },
  header: {
    padding: 20,
    paddingTop: 40,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
    backgroundColor: '#1B5E20',
  },
  welcomeText: {
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
    marginHorizontal: 10,
    marginVertical: 2,
    borderRadius: 8,
  },
  activeNavItem: {
    backgroundColor: '#E8F5E8',
    borderLeftWidth: 4,
    borderLeftColor: '#4CAF50',
  },
  navText: {
    fontSize: 16,
    color: 'white',
    marginLeft: 15,
    fontWeight: '500',
  },
  activeNavText: {
    color: '#2E8B57',
    fontWeight: 'bold',
  },
});

export default AdminSidebar;
