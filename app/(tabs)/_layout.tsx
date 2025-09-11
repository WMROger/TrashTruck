import { Tabs, useRouter } from 'expo-router';
import { doc, getDoc } from 'firebase/firestore';
import React, { useEffect, useState } from 'react';
import { Image, Platform } from 'react-native';

import { useAuthContext } from '@/components/AuthContext';
import { HapticTab } from '@/components/HapticTab';
import { IconSymbol } from '@/components/ui/IconSymbol';
import TabBarBackground from '@/components/ui/TabBarBackground';
import { db } from '@/config/firebase';
import { useTheme } from '@/hooks/useTheme';

export default function TabLayout() {
  const { theme } = useTheme();
  const { user } = useAuthContext();
  const router = useRouter();
  const [isAdmin, setIsAdmin] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  // Check if user has admin role and redirect if necessary
  useEffect(() => {
    const checkAdminRole = async () => {
      if (!user || !db) {
        setIsLoading(false);
        return;
      }

      try {
        const userRef = doc(db, 'users', user.uid);
        const userSnap = await getDoc(userRef);
        
        if (userSnap.exists()) {
          const userData = userSnap.data();
          if (userData.role === 'admin') {
            console.log('Tabs layout: Admin user detected, redirecting to admin dashboard');
            setIsAdmin(true);
            router.replace('/admin/dashboard');
            return;
          }
        }
        setIsAdmin(false);
      } catch (error) {
        console.error('Error checking admin role in tabs:', error);
        setIsAdmin(false);
      } finally {
        setIsLoading(false);
      }
    };

    checkAdminRole();
  }, [user, router]);

  // Show loading while checking admin role
  if (isLoading) {
    return null; // Will redirect to admin if needed
  }

  // Don't render tabs if user is admin (they'll be redirected)
  if (isAdmin) {
    return null;
  }

  return (
    <Tabs
      initialRouteName="home"
      screenOptions={{
        tabBarActiveTintColor: '#FFFFFF',
        tabBarInactiveTintColor: 'rgba(255,255,255,0.8)',
        headerShown: false,
        tabBarButton: HapticTab,
        tabBarBackground: TabBarBackground,
        tabBarStyle: Platform.select({
          ios: {
            // Use a transparent background on iOS to show the blur effect
            position: 'absolute',
            backgroundColor: 'transparent',
            borderTopWidth: 0,
          },
          default: {
            backgroundColor: 'transparent',
            borderTopWidth: 0,
          },
        }),
      }}>
      <Tabs.Screen
        name="home"
        options={{
          title: 'Home',
          tabBarIcon: ({ color }) => <IconSymbol size={28} name="house.fill" color={color} />,
        }}
      />
      <Tabs.Screen
        name="schedule"
        options={{
          title: 'Schedule',
          tabBarIcon: ({ color }) => <IconSymbol size={28} name="calendar" color={color} />,
        }}
      />
      <Tabs.Screen
        name="announcements"
        options={{
          title: 'Announcements',
          tabBarIcon: ({ color }) => (
            <Image
              source={require('../../assets/images/AnnouncementIcon.png')}
              style={{ width: 24, height: 24, tintColor: color }}
              resizeMode="contain"
            />
          ),
        }}
      />
      <Tabs.Screen
        name="feedback"
        options={{
          title: 'Feedback',
          tabBarIcon: ({ color }) => <IconSymbol size={28} name="hand.thumbsup" color={color} />,
        }}
      />
      <Tabs.Screen
        name="report"
        options={{
          title: 'Report',
          tabBarIcon: ({ color }) => (
            <Image
              source={require('../../assets/images/ReportIcon.png')}
              style={{ width: 24, height: 24, tintColor: color }}
              resizeMode="contain"
            />
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profile',
          tabBarIcon: ({ color }) => <IconSymbol size={28} name="person.circle.fill" color={color} />,
        }}
      />
    </Tabs>
  );
}
