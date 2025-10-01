import { MaterialIcons } from '@expo/vector-icons';
import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

interface AdminSidebarProps {
  activeTab: string;
  onTabPress: (tab: string) => void;
}

const AdminSidebar: React.FC<AdminSidebarProps> = ({ activeTab, onTabPress }) => {
  const navigationItems = [
    { id: 'home', label: 'Home', icon: 'home', activeIcon: 'home' },
    { id: 'schedule', label: 'Schedule', icon: 'event', activeIcon: 'event' },
    { id: 'announcements', label: 'Announcements', icon: 'campaign', activeIcon: 'campaign' },
    { id: 'reports', label: 'Reports', icon: 'description', activeIcon: 'description' },
    { id: 'history', label: 'History', icon: 'history', activeIcon: 'history' },
    { id: 'feedbacks', label: 'Feedbacks', icon: 'chat', activeIcon: 'chat' },
    { id: 'accounts', label: 'Accounts', icon: 'people', activeIcon: 'people' },
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
              <MaterialIcons
                name={isActive ? item.activeIcon : item.icon}
                size={24}
                color={isActive ? '#FFFFFF' : '#E5E7EB'}
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
  },
  activeNavItem: {
    backgroundColor: '#1B5E20',
  },
  navText: {
    fontSize: 16,
    marginLeft: 16,
    fontWeight: '500',
    color: 'white',
  },
  activeNavText: {
    color: '#FFFFFF',
    fontWeight: 'bold',
  },
});

export default AdminSidebar;
