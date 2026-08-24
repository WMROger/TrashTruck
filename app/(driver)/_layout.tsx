import { useTheme } from '@/hooks/useTheme';
import { Tabs, useRouter } from 'expo-router';
import { collection, doc, getDoc, onSnapshot, query, where } from 'firebase/firestore';
import React, { useEffect, useState } from 'react';
import { Platform } from 'react-native';
import NetInfo from '@react-native-community/netinfo';

import { useAuthContext } from '@/components/AuthContext';
import { CustomTabBar } from '@/components/CustomTabBar';
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
  const [activeScheduleIds, setActiveScheduleIds] = useState<string[]>([]);
  const [routePolyline, setRoutePolyline] = useState<{ latitude: number; longitude: number }[]>([]);

  // Check if user has driver role
  useEffect(() => {
    if (!user || !db) {
      setIsAuthorized(false);
      setIsLoading(false);
      router.replace('/auth');
      return;
    }

    const userRef = doc(db, 'users', user.uid);
    const unsub = onSnapshot(userRef, (snap) => {
      if (snap.exists()) {
        const userData = snap.data();
        if (userData.role !== 'driver' && userData.role !== 'admin') {
          // Redirect non-driver users away from driver interface to home
          setIsAuthorized(false);
          setIsLoading(false);
          router.replace('/(tabs)/home');
          return;
        }
        if (userData.disabled === true || userData.status === 'disabled') {
          setIsAuthorized(false);
          setIsLoading(false);
          router.replace('/auth');
          return;
        }
        setAssignedTruckId(typeof userData.currentTruckId === 'string' ? userData.currentTruckId : null);
        setIsAuthorized(true);
      } else {
        setIsAuthorized(true);
      }
      setIsLoading(false);
    }, (error) => {
      if (error?.code !== 'permission-denied') {
        console.warn('DriverLayout: user profile listener error:', error);
      }
      setIsAuthorized(true);
      setIsLoading(false);
    });

    return () => unsub();
  }, [user?.uid, router]);

  useEffect(() => {
    if (!user?.uid || !db) return;
    const assignedQuery = query(collection(db, 'schedules'), where('assignedDriverId', '==', user.uid));
    const unsubscribeSchedules = onSnapshot(assignedQuery, snapshot => {
      const active = snapshot.docs.filter(schedule => ['pending', 'in-progress'].includes(String(schedule.data().status)));
      setActiveRouteCount(active.length);
      setActiveScheduleIds(active.map(schedule => schedule.id));
      const savedPolyline = active.find(schedule => Array.isArray(schedule.data().routeOptimization?.roadPolyline))?.data().routeOptimization?.roadPolyline || [];
      setRoutePolyline(savedPolyline.filter((point: any) => Number.isFinite(point?.latitude) && Number.isFinite(point?.longitude)));
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
      locationService.startTracking(user.uid, assignedTruckId, { activeScheduleIds, routePolyline });
    }
    return () => {
      if (user) {
        locationService.stopTracking(user.uid);
      }
    };
  }, [user, isLoading, isAuthorized, assignedTruckId, activeRouteCount, activeScheduleIds, routePolyline]);

  // Show loading while checking driver role
  if (isLoading || !isAuthorized) {
    return null; // Will redirect if needed
  }

  const activeColor = isDark ? '#86EFAC' : '#2E7D32'; 
  const inactiveColor = isDark ? '#9CA3AF' : '#757575';

  return (
    <Tabs
      initialRouteName="index"
      screenOptions={({ route, navigation }) => ({
        lazy: true,
        headerShown: false,
        tabBarActiveTintColor: activeColor,
        tabBarInactiveTintColor: inactiveColor,
        tabBarButton: (props) => {
          const state = navigation.getState();
          const currentRouteName = state.routes[state.index]?.name;
          const isFocused = currentRouteName === route.name;
          return <CustomTabBar {...props} isFocused={isFocused} />;
        },
        tabBarStyle: {
          backgroundColor: isDark ? '#1F2937' : '#FFFFFF',
          borderTopWidth: 1,
          borderTopColor: isDark ? '#111827' : '#E0E0E0',
          height: 80,
          paddingTop: 8,
          paddingBottom: Platform.OS === 'ios' ? 24 : 8,
        },
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: '600',
          marginTop: 2,
        },
      })}>
      <Tabs.Screen
        name="index"
        options={{
          title: 'Home',
          tabBarIcon: ({ color, size }) => (
            <MaterialIcons name="home" size={28} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="pages/DriverSchedulePage"
        options={{
          title: 'Schedule',
          tabBarIcon: ({ color, size }) => (
            <MaterialIcons name="event" size={28} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="pages/DriverHistoryPage"
        options={{
          title: 'History',
          tabBarIcon: ({ color, size }) => (
            <MaterialIcons name="history" size={28} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="inbox"
        options={{
          title: 'Inbox',
          tabBarIcon: ({ color, size }) => (
            <MaterialIcons name="notifications" size={28} color={color} />
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
          tabBarStyle: { display: 'none' },
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
