import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image, ScrollView, Platform } from 'react-native';
import { MaterialIcons, Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';

interface SidebarProps {
  activeTab: string;
  onTabChange: (tabId: string) => void;
  onLogout: () => void;
}

export default function DictSidebar({ activeTab, onTabChange, onLogout }: SidebarProps) {
  const router = useRouter();
  
  const navigationItems = [
    { id: 'dashboard', label: 'DASHBOARD', icon: 'grid-view', activeIcon: 'grid-view' },
    { id: 'rewards', label: 'REWARDS', icon: 'card-giftcard', activeIcon: 'card-giftcard' },
    { id: 'identity-access', label: 'IDENTITY & ACCESS', icon: 'security', activeIcon: 'security' },
    { id: 'data-management', label: 'DATA MANAGEMENT', icon: 'storage', activeIcon: 'storage' },
    { id: 'fleet-ops', label: 'FLEET OPS', icon: 'directions-car', activeIcon: 'directions-car' },
    { id: 'cenro-command', label: 'CENRO Command', icon: 'message', activeIcon: 'message' },
  ];

  return (
    <View style={styles.sidebar}>
      <View style={styles.sidebarHeader}>
        <View style={styles.logoContainer}>
          <View style={styles.logoBg}>
            <MaterialIcons name="computer" size={24} color="#FFF" />
          </View>
          <View>
            <Text style={styles.logoTitle}>DICT</Text>
            <Text style={styles.logoSubtitle}>SUPER ADMIN PORTAL</Text>
          </View>
        </View>
      </View>

      <ScrollView style={styles.sidebarNav} showsVerticalScrollIndicator={false}>
        {navigationItems.map((item, index) => {
          const isActive = activeTab === item.id;
          
          return (
            <React.Fragment key={item.id}>
              <TouchableOpacity
                style={[
                  styles.navItem,
                  isActive && styles.navItemActive
                ]}
                onPress={() => onTabChange(item.id)}
              >
                <View style={styles.navItemIconContainer}>
                  <MaterialIcons 
                    name={isActive ? item.activeIcon as any : item.icon as any} 
                    size={22} 
                    color={isActive ? '#FFF' : '#6B7280'} 
                  />
                </View>
                <Text style={[
                  styles.navItemText,
                  isActive && styles.navItemTextActive
                ]}>
                  {item.label}
                </Text>
              </TouchableOpacity>
              
              {/* Divider after Fleet Ops */}
              {item.id === 'fleet-ops' && (
                <View style={styles.dividerContainer}>
                  <Text style={styles.dividerText}>INTER-AGENCY CHANNELS</Text>
                </View>
              )}
            </React.Fragment>
          );
        })}
      </ScrollView>

      <View style={styles.sidebarFooter}>
        <View style={styles.systemStatusContainer}>
          <View style={styles.statusIndicator} />
          <View>
            <Text style={styles.statusTitle}>SYSTEM STATUS</Text>
            <Text style={styles.statusValue}>System Status: Optimal</Text>
          </View>
        </View>

        <TouchableOpacity style={styles.footerLink}>
          <MaterialIcons name="help-outline" size={18} color="#6B7280" />
          <Text style={styles.footerLinkText}>SUPPORT</Text>
        </TouchableOpacity>
        
        <TouchableOpacity style={styles.footerLink} onPress={onLogout}>
          <MaterialIcons name="logout" size={18} color="#6B7280" />
          <Text style={styles.footerLinkText}>LOGOUT</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  sidebar: {
    width: 280,
    backgroundColor: '#FFFFFF',
    borderRightWidth: 1,
    borderRightColor: '#E5E7EB',
    height: '100%',
    display: 'flex',
    flexDirection: 'column',
    ...(Platform.OS === 'web' ? { position: 'fixed', left: 0, top: 0, bottom: 0, zIndex: 50 } : {})
  },
  sidebarHeader: {
    padding: 24,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  logoContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  logoBg: {
    width: 40,
    height: 40,
    borderRadius: 8,
    backgroundColor: '#374151',
    justifyContent: 'center',
    alignItems: 'center',
  },
  logoTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#111827',
    letterSpacing: -0.5,
  },
  logoSubtitle: {
    fontSize: 10,
    color: '#6B7280',
    fontWeight: '700',
    letterSpacing: 1,
  },
  sidebarNav: {
    flex: 1,
    paddingVertical: 16,
    paddingHorizontal: 12,
  },
  navItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    marginBottom: 4,
    gap: 16,
  },
  navItemActive: {
    backgroundColor: '#4B6354', // Dark green theme
  },
  navItemIconContainer: {
    width: 24,
    alignItems: 'center',
  },
  navItemText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#4B5563',
    letterSpacing: 0.5,
  },
  navItemTextActive: {
    color: '#FFFFFF',
  },
  dividerContainer: {
    paddingVertical: 16,
    paddingHorizontal: 16,
    marginTop: 8,
  },
  dividerText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#9CA3AF',
    letterSpacing: 1,
  },
  sidebarFooter: {
    padding: 24,
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
  },
  systemStatusContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 24,
    backgroundColor: '#F9FAFB',
    padding: 12,
    borderRadius: 8,
  },
  statusIndicator: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#10B981',
  },
  statusTitle: {
    fontSize: 10,
    fontWeight: '700',
    color: '#6B7280',
    letterSpacing: 1,
  },
  statusValue: {
    fontSize: 12,
    color: '#111827',
    marginTop: 2,
  },
  footerLink: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 10,
  },
  footerLinkText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#6B7280',
    letterSpacing: 0.5,
  },
});
