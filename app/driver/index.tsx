import { IconSymbol } from '@/components/ui/IconSymbol';
import { auth, db } from '@/config/firebase';
import { useRouter } from 'expo-router';
import { signOut } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import React, { useEffect, useState } from 'react';
import { Image, Modal, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import DriverHistoryPage from './pages/DriverHistoryPage';
import DriverHomePage from './pages/DriverHomePage';
import DriverSchedulePage from './pages/DriverSchedulePage';

export default function DriverHome() {
  const router = useRouter();
  const [showSettings, setShowSettings] = useState(false);
  const [activeTab, setActiveTab] = useState('home');

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
      default:
        return <DriverHomePage onTabChange={setActiveTab} />;
    }
  };

  return (
    <View style={styles.container}>
      <ScrollView style={styles.scrollView}>
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <View style={styles.logoCircle}>
              <Image 
                source={require('../../assets/images/trashtrack_logo_driver.png')} 
                style={styles.logoImage}
                resizeMode="contain"
              />
            </View>
            <Text style={styles.greeting}>Ready to Work!</Text>
          </View>
          <View style={styles.headerActions}>
            <TouchableOpacity style={styles.iconBtn} onPress={() => setShowSettings(true)}>
              <IconSymbol name="gear" size={20} color="#2f3a31" />
            </TouchableOpacity>
            <TouchableOpacity style={styles.iconBtn}>
              <IconSymbol name="bell" size={20} color="#2f3a31" />
            </TouchableOpacity>
          </View>
        </View>

        {/* Tab Content */}
        {renderTabContent()}
      </ScrollView>

      {/* Tab Bar */}
      <View style={styles.tabBar}>
        <TouchableOpacity 
          style={[styles.tabItem, activeTab === 'home' && styles.activeTab]} 
          onPress={() => setActiveTab('home')}
        >
          <IconSymbol name="house.fill" size={20} color={activeTab === 'home' ? '#2E8B57' : '#6b8b6b'} />
          <Text style={[styles.tabText, activeTab === 'home' && styles.activeTabText]}>Home</Text>
        </TouchableOpacity>
        
        <TouchableOpacity 
          style={[styles.tabItem, activeTab === 'schedule' && styles.activeTab]} 
          onPress={() => setActiveTab('schedule')}
        >
          <IconSymbol name="calendar" size={20} color={activeTab === 'schedule' ? '#2E8B57' : '#6b8b6b'} />
          <Text style={[styles.tabText, activeTab === 'schedule' && styles.activeTabText]}>Schedule</Text>
        </TouchableOpacity>
        
        <TouchableOpacity 
          style={[styles.tabItem, activeTab === 'history' && styles.activeTab]} 
          onPress={() => setActiveTab('history')}
        >
          <IconSymbol name="clock.fill" size={20} color={activeTab === 'history' ? '#2E8B57' : '#6b8b6b'} />
          <Text style={[styles.tabText, activeTab === 'history' && styles.activeTabText]}>History</Text>
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
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Settings</Text>
            <TouchableOpacity
              style={[styles.btn, styles.btnWarn, { alignSelf: 'stretch', marginTop: 8 }]}
              onPress={async () => {
                try {
                  await signOut(auth as any);
                } catch {}
                setShowSettings(false);
                router.replace('/auth' as any);
              }}
              activeOpacity={0.85}
            >
              <Text style={styles.btnText}>Logout</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.btn, { backgroundColor: '#6b8b6b', alignSelf: 'stretch', marginTop: 8 }]}
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
    backgroundColor: '#E8F5E8',
  },
  scrollView: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 16,
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
    backgroundColor: '#D5EED5',
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
    color: '#2f3a31',
  },
  headerActions: {
    flexDirection: 'row',
    gap: 10,
  },
  iconBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#D5EED5',
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
    backgroundColor: '#F5FFF5',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#CBE5CB',
    padding: 16,
    width: '90%',
    maxWidth: 420,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#2f3a31',
    marginBottom: 8,
    textAlign: 'center',
  },
  // Tab Bar Styles
  tabBar: {
    flexDirection: 'row',
    backgroundColor: '#F5FFF5',
    borderTopWidth: 1,
    borderTopColor: '#CBE5CB',
    paddingVertical: 8,
    paddingHorizontal: 16,
  },
  tabItem: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 8,
    borderRadius: 8,
  },
  activeTab: {
    backgroundColor: '#E7F6E7',
  },
  tabText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#6b8b6b',
    marginTop: 4,
  },
  activeTabText: {
    color: '#2E8B57',
  },
});


