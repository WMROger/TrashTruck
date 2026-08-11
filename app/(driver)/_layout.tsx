import { useTheme } from '@/hooks/useTheme';
import { Tabs, useRouter } from 'expo-router';
import { collection, doc, getDoc, onSnapshot, query, where } from 'firebase/firestore';
import React, { useEffect, useState } from 'react';
import { Platform } from 'react-native';
import NetInfo from '@react-native-community/netinfo';

import { useAuthContext } from '@/components/AuthContext';
import { db } from '@/config/firebase';
import { MaterialIcons, Feather } from '@expo/vector-icons';

import { locationService } from '@/services/locationService';
import { syncOfflineDriverActions } from '@/services/driverOfflineQueue';

export default function DriverLayout() {
  const { user } = useAuthContext();
  const router = useRouter();
  const { theme } = useTheme();
  const isDark = theme === 'dark';
  const [isLoading, setIsLoading] = useState(true);
  const [isAuthorized, setIsAuthorized] = useState(false);
  const [assignedTruckId, setAssignedTruckId] = useState<string | null>(null);
  const [activeRouteCount, setActiveRouteCount] = useState(0);

  // Check if user has driver role
  useEffect(() => {
    const checkDriverRole = async () => {
      if (!user || !db) {
        setIsAuthorized(false);
        setIsLoading(false);
        router.replace('/driver-login');
        return;
      }

      try {
        const userRef = doc(db, 'users', user.uid);
        const userSnap = await getDoc(userRef);
        
        if (userSnap.exists()) {
          const userData = userSnap.data();
          if (userData.role !== 'driver' || userData.disabled === true || userData.status === 'disabled') {
            // Redirect non-driver users away from driver interface
            setIsAuthorized(false);
            router.replace('/');
            return;
          }
          setAssignedTruckId(typeof userData.currentTruckId === 'string' ? userData.currentTruckId : null);
          setIsAuthorized(true);
        } else {
          setIsAuthorized(false);
          router.replace('/driver-login');
          return;
        }
      } catch {
        setIsAuthorized(false);
        router.replace('/driver-login');
        return;
      }
      
      setIsLoading(false);
    };

    checkDriverRole();
  }, [user, router]);

  useEffect(() => {
    if (!user?.uid || !db) return;
    const assignedQuery = query(collection(db, 'schedules'), where('assignedDriverId', '==', user.uid));
    const unsubscribeSchedules = onSnapshot(assignedQuery, snapshot => {
      const active = snapshot.docs.filter(schedule => ['pending', 'in-progress'].includes(String(schedule.data().status))).length;
      setActiveRouteCount(active);
    });
    const unsubscribeNetwork = NetInfo.addEventListener(state => {
      if (state.isConnected && state.isInternetReachable !== false) syncOfflineDriverActions();
    });
    syncOfflineDriverActions();
    return () => {
      unsubscribeSchedules();
      unsubscribeNetwork();
    };
  }, [user?.uid]);

  // Start GPS Tracking
  useEffect(() => {
    if (user && !isLoading && isAuthorized && assignedTruckId && activeRouteCount > 0) {
      locationService.startTracking(user.uid, assignedTruckId);
    }
    return () => {
      if (user) {
        locationService.stopTracking(user.uid);
      }
    };
  }, [user, isLoading, isAuthorized, assignedTruckId, activeRouteCount]);

  // Show loading while checking driver role
  if (isLoading || !isAuthorized) {
    return null; // Will redirect if needed
  }

  const activeColor = isDark ? '#86EFAC' : '#4E6C50'; 
  const inactiveColor = isDark ? '#4B5563' : '#9CA3AF';

  return (
    <Tabs
      initialRouteName="index"
      screenOptions={{
        lazy: true,
        headerShown: false,
        tabBarActiveTintColor: activeColor,
        tabBarInactiveTintColor: inactiveColor,
        tabBarStyle: {
          backgroundColor: isDark ? '#1F2937' : '#FFFFFF',
          borderTopWidth: 1,
          borderTopColor: isDark ? '#111827' : '#F3F4F6',
          height: Platform.OS === 'ios' ? 85 : 65,
          paddingBottom: Platform.OS === 'ios' ? 25 : 10,
          paddingTop: 10,
        },
        tabBarLabelStyle: {
          fontSize: 10,
          fontWeight: '600',
          marginTop: 2,
        },
      }}>
      <Tabs.Screen
        name="index"
        options={{
          title: 'Home',
          tabBarIcon: ({ color, size }) => (
            <Feather name="home" size={24} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="pages/DriverSchedulePage"
        options={{
          title: 'Schedule',
          tabBarIcon: ({ color, size }) => (
            <Feather name="calendar" size={24} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="pages/DriverHistoryPage"
        options={{
          title: 'History',
          tabBarIcon: ({ color, size }) => (
            <MaterialIcons name="history" size={26} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="inbox"
        options={{
          title: 'Inbox',
          tabBarIcon: ({ color, size }) => (
            <Feather name="bell" size={24} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          href: null,
        }}
      />
      <Tabs.Screen
        name="edit-profile"
        options={{
          href: null,
        }}
      />
      <Tabs.Screen
        name="select-truck"
        options={{
          href: null,
        }}
      />
      <Tabs.Screen
        name="route-map"
        options={{
          href: null,
          tabBarStyle: { display: 'none' },
        }}
      />
    </Tabs>
  );
}
