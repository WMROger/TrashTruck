import { MaterialIcons } from '@expo/vector-icons';
import React from 'react';
import {
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

export type CictoTabType =
  | 'dashboard'
  | 'identity-access'
  | 'fleet-ops'
  | 'cenro-command'
  | 'data-mgmt'
  | 'rewards'
  | 'activity-logs';

export interface CictoSidebarProps {
  activeTab: CictoTabType | string;
  onSelectTab?: (tab: CictoTabType) => void;
  onTabChange?: (tab: any) => void;
  onLogout: () => void;
  collapsed?: boolean;
}

export default function CictoSidebar({
  activeTab,
  onSelectTab,
  onTabChange,
  onLogout,
  collapsed = false,
}: CictoSidebarProps) {
  const handleSelectTab = (id: CictoTabType) => {
    if (onSelectTab) onSelectTab(id);
    else if (onTabChange) onTabChange(id);
  };

  const menuItems: { id: CictoTabType; label: string; icon: keyof typeof MaterialIcons.glyphMap }[] = [
    { id: 'dashboard', label: 'Executive Dashboard', icon: 'dashboard' },
    { id: 'identity-access', label: 'User Governance', icon: 'people' },
    { id: 'fleet-ops', label: 'Fleet Telemetry', icon: 'local-shipping' },
    { id: 'cenro-command', label: 'CENRO Command', icon: 'campaign' },
    { id: 'data-mgmt', label: 'Data Governance', icon: 'storage' },
    { id: 'rewards', label: 'Reward Reconcile', icon: 'stars' },
    { id: 'activity-logs', label: 'Audit Trail', icon: 'receipt-long' },
  ];

  return (
    <View style={[styles.container, collapsed && styles.containerCollapsed]}>
      {/* Top Header Logo / Seal */}
      <View style={styles.header}>
        <View style={styles.logoWrap}>
          <MaterialIcons name="security" size={22} color="#0D9488" />
        </View>
        {!collapsed && (
          <View style={styles.titleWrap}>
            <Text style={styles.agencyTitle}>CICTO DANAO</Text>
            <Text style={styles.agencySubtitle}>IT Oversight & Governance</Text>
          </View>
        )}
      </View>

      {/* Navigation Items */}
      <ScrollView style={styles.scrollArea} showsVerticalScrollIndicator={false}>
        <View style={styles.menuSection}>
          {!collapsed && <Text style={styles.sectionHeader}>OVERSIGHT MODULES</Text>}
          {menuItems.map((item) => {
            const isActive = activeTab === item.id;
            return (
              <TouchableOpacity
                key={item.id}
                style={[styles.menuItem, isActive && styles.menuItemActive]}
                onPress={() => handleSelectTab(item.id)}
                activeOpacity={0.7}
              >
                <MaterialIcons
                  name={item.icon}
                  size={20}
                  color={isActive ? '#0D9488' : '#94A3B8'}
                />
                {!collapsed && (
                  <Text style={[styles.menuLabel, isActive && styles.menuLabelActive]}>
                    {item.label}
                  </Text>
                )}
              </TouchableOpacity>
            );
          })}
        </View>
      </ScrollView>

      {/* Footer / Sign out */}
      <View style={styles.footer}>
        <TouchableOpacity
          style={styles.logoutBtn}
          onPress={onLogout}
          activeOpacity={0.7}
        >
          <MaterialIcons name="logout" size={18} color="#EF4444" />
          {!collapsed && <Text style={styles.logoutText}>Sign Out</Text>}
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: 240,
    backgroundColor: '#042F2E',
    borderRightWidth: 1,
    borderRightColor: '#115E59',
    flexDirection: 'column',
  },
  containerCollapsed: {
    width: 64,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#115E59',
    gap: 12,
  },
  logoWrap: {
    width: 36,
    height: 36,
    borderRadius: 8,
    backgroundColor: '#F0FDFA',
    borderWidth: 1,
    borderColor: '#CCFBF1',
    justifyContent: 'center',
    alignItems: 'center',
  },
  titleWrap: {
    flex: 1,
  },
  agencyTitle: {
    fontSize: 13,
    fontWeight: '900',
    color: '#CCFBF1',
    letterSpacing: 0.8,
  },
  agencySubtitle: {
    fontSize: 10,
    color: '#5EEAD4',
    fontWeight: '500',
  },
  scrollArea: {
    flex: 1,
  },
  menuSection: {
    padding: 12,
    gap: 4,
  },
  sectionHeader: {
    fontSize: 9.5,
    fontWeight: '800',
    color: '#5EEAD4',
    letterSpacing: 0.8,
    marginBottom: 8,
    paddingHorizontal: 8,
    opacity: 0.8,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 8,
    gap: 12,
  },
  menuItemActive: {
    backgroundColor: '#0F766E',
  },
  menuLabel: {
    fontSize: 12.5,
    fontWeight: '600',
    color: '#E2E8F0',
  },
  menuLabelActive: {
    color: '#FFFFFF',
    fontWeight: '800',
  },
  footer: {
    padding: 12,
    borderTopWidth: 1,
    borderTopColor: '#115E59',
  },
  logoutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 8,
    gap: 10,
  },
  logoutText: {
    fontSize: 12.5,
    fontWeight: '700',
    color: '#EF4444',
  },
});
