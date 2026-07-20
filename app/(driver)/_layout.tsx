import { Tabs, useRouter } from 'expo-router';
import { doc, getDoc } from 'firebase/firestore';
import React, { useEffect, useState } from 'react';
import { Platform, StyleSheet } from 'react-native';

import { useAuthContext } from '@/components/AuthContext';
import { db } from '@/config/firebase';
import { MaterialIcons, Feather } from '@expo/vector-icons';

import { locationService } from '@/services/locationService';

export default function DriverLayout() {
  const { user } = useAuthContext();
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(true);

  // Check if user has driver role
  useEffect(() => {
    const checkDriverRole = async () => {
      if (!user || !db) {
        setIsLoading(false);
        return;
      }

      try {
        const userRef = doc(db, 'users', user.uid);
        const userSnap = await getDoc(userRef);
        
        if (userSnap.exists()) {
          const userData = userSnap.data();
          if (userData.role !== 'driver') {
            // Redirect non-driver users away from driver interface
            router.replace('/');
            return;
          }
        }
      } catch (error) {
        // Error checking driver role
      }
      
      setIsLoading(false);
    };

    checkDriverRole();
  }, [user, router]);

  // Start GPS Tracking
  useEffect(() => {
    if (user && !isLoading) {
      locationService.startTracking(user.uid, 'truck-1');
    }
    return () => {
      if (user) {
        locationService.stopTracking(user.uid);
      }
    };
  }, [user, isLoading]);

  // Show loading while checking driver role
  if (isLoading) {
    return null; // Will redirect if needed
  }

  const activeColor = '#4E6C50'; // Dark green
  const inactiveColor = '#9CA3AF'; // Gray

  return (
    <Tabs
      initialRouteName="index"
      screenOptions={{
        lazy: true,
        headerShown: false,
        tabBarActiveTintColor: activeColor,
        tabBarInactiveTintColor: inactiveColor,
        tabBarStyle: {
          backgroundColor: '#FFFFFF',
          borderTopWidth: 1,
          borderTopColor: '#F3F4F6',
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
    </Tabs>
  );
}
