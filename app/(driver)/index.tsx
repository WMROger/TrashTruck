import { IconSymbol } from '@/components/ui/IconSymbol';
import { auth, db } from '@/config/firebase';
import { Colors } from '@/constants/Colors';
import { useTheme } from '@/hooks/useTheme';
import { useRouter } from 'expo-router';
import { signOut } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import React, { useEffect, useState } from 'react';
import { Alert, Image, Modal, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import DriverHistoryPage from './pages/DriverHistoryPage';
import DriverHomePage from './pages/DriverHomePage';
import DriverProfilePage from './pages/DriverProfilePage';
import DriverSchedulePage from './pages/DriverSchedulePage';

export default function DriverHome() {
  const router = useRouter();
  const { theme } = useTheme();
  const colors = Colors['light'];
  const [showSettings, setShowSettings] = useState(false);
  const [activeTab, setActiveTab] = useState('home');
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);

  useEffect(() => {
    // If user is not driver, send back to tabs home
    (async () => {
      try {
        const user = auth?.currentUser;
        if (user && db) {
          const snap = await getDoc(doc(db, 'users', user.uid));
          const role = snap.exists() ? (snap.data() as any)?.role : undefined;
          if (role !== 'driver') {
            router.replace('/home' as any);
          }
        }
      } catch {}
    })();
  }, [router]);

  // Tab content components
  const renderTabContent = () => {
    switch (activeTab) {
      case 'home':
        return <DriverHomePage onTabChange={setActiveTab} />;
      case 'schedule':
        return <DriverSchedulePage />;
      case 'history':
        return <DriverHistoryPage />;
      case 'profile':
        return <DriverProfilePage onBack={() => setActiveTab('home')} />;
      default:
        return <DriverHomePage onTabChange={setActiveTab} />;
    }
  };

  const handleLogout = () => {
    Alert.alert(
      'Logout',
      'Are you sure you want to logout?',
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Logout',
          style: 'destructive',
          onPress: async () => {
            try {
              await signOut(auth as any);
              setShowSettings(false);
              setShowLogoutConfirm(false);
              router.replace('/auth' as any);
            } catch (error) {
              console.error('Logout error:', error);
            }
          },
        },
      ]
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <ScrollView style={styles.scrollView}>
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <View style={[styles.logoCircle, { backgroundColor: colors.secondary }]}>
              <Image 
                source={require('../../assets/images/trashtrack_logo_driver.png')} 
                style={styles.logoImage}
                resizeMode="contain"
              />
            </View>
            <Text style={[styles.greeting, { color: colors.textPrimary }]}>Ready to Work!</Text>
          </View>
          <View style={styles.headerActions}>
            <TouchableOpacity 
              style={[styles.iconBtn, { backgroundColor: activeTab === 'profile' ? colors.primary : colors.secondary }]} 
              onPress={() => setActiveTab('profile')}
            >
              <IconSymbol name="person.fill" size={20} color={activeTab === 'profile' ? colors.secondary : colors.primary} />
            </TouchableOpacity>
          </View>
        </View>

        {/* Tab Content */}
        {renderTabContent()}
      </ScrollView>

      {/* Tab Bar */}
      <View style={[styles.tabBar, { backgroundColor: colors.surface, borderTopColor: colors.border }]}>
        <TouchableOpacity 
          style={[styles.tabItem, activeTab === 'home' && { backgroundColor: colors.secondary }]} 
          onPress={() => setActiveTab('home')}
        >
          <IconSymbol name="house.fill" size={20} color={activeTab === 'home' ? colors.primary : colors.textTertiary} />
          <Text style={[styles.tabText, { color: activeTab === 'home' ? colors.primary : colors.textTertiary }]}>Home</Text>
        </TouchableOpacity>
        
        <TouchableOpacity 
          style={[styles.tabItem, activeTab === 'schedule' && { backgroundColor: colors.secondary }]} 
          onPress={() => setActiveTab('schedule')}
        >
          <IconSymbol name="calendar" size={20} color={activeTab === 'schedule' ? colors.primary : colors.textTertiary} />
          <Text style={[styles.tabText, { color: activeTab === 'schedule' ? colors.primary : colors.textTertiary }]}>Schedule</Text>
        </TouchableOpacity>
        
        <TouchableOpacity 
          style={[styles.tabItem, activeTab === 'history' && { backgroundColor: colors.secondary }]} 
          onPress={() => setActiveTab('history')}
        >
          <IconSymbol name="clock.fill" size={20} color={activeTab === 'history' ? colors.primary : colors.textTertiary} />
          <Text style={[styles.tabText, { color: activeTab === 'history' ? colors.primary : colors.textTertiary }]}>History</Text>
        </TouchableOpacity>
      </View>

      {/* Settings Modal */}
      <Modal
        transparent
        visible={showSettings}
        animationType="fade"
        onRequestClose={() => setShowSettings(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Text style={[styles.modalTitle, { color: colors.textPrimary }]}>Settings</Text>
            
            <Text style={[styles.settingsDescription, { color: colors.textSecondary }]}>
              Manage your notifications and account settings
            </Text>
            
            {/* Actions */}
            <TouchableOpacity
              style={[styles.btn, styles.btnWarn, { alignSelf: 'stretch', marginTop: 24 }]}
              onPress={handleLogout}
              activeOpacity={0.85}
            >
              <Text style={styles.btnText}>Logout</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.btn, { backgroundColor: colors.textTertiary, alignSelf: 'stretch', marginTop: 8 }]}
              onPress={() => setShowSettings(false)}
              activeOpacity={0.85}
            >
              <Text style={styles.btnText}>Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
      paddingTop: 48,
    paddingBottom: 8,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  logoCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoImage: {
    width: 24,
    height: 24,
  },
  greeting: {
    fontSize: 18,
    fontWeight: '800',
  },
  headerActions: {
    flexDirection: 'row',
    gap: 10,
  },
  iconBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
  },
  modalCard: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 16,
    width: '90%',
    maxWidth: 420,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '800',
    marginBottom: 8,
    textAlign: 'center',
  },
  settingsDescription: {
    fontSize: 14,
    textAlign: 'center',
    marginTop: 8,
    lineHeight: 20,
  },
  btn: {
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnWarn: {
    backgroundColor: '#dc3545',
  },
  btnText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  // Tab Bar Styles
  tabBar: {
    flexDirection: 'row',
    borderTopWidth: 1,
    paddingVertical: 8,
    paddingHorizontal: 16,
  },
  tabItem: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 8,
    borderRadius: 8,
  },
  tabText: {
    fontSize: 12,
    fontWeight: '600',
    marginTop: 4,
  },
});


