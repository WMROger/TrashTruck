import { Tabs, useRouter } from 'expo-router';
import { doc, getDoc } from 'firebase/firestore';
import React, { useEffect, useState } from 'react';
import { Platform, StyleSheet } from 'react-native';

import { useAuthContext } from '@/components/AuthContext';
import { CustomTabBar } from '@/components/CustomTabBar';
import TabBarBackground from '@/components/ui/TabBarBackground';
import { db } from '@/config/firebase';
import { Colors } from '@/constants/Colors';
import { useTheme } from '@/hooks/useTheme';
import { MaterialIcons } from '@expo/vector-icons';

export default function DriverLayout() {
  const { theme } = useTheme();
  const { user } = useAuthContext();
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(true);
  const [role, setRole] = useState<string | null>(null);
  const [showAIChat, setShowAIChat] = useState(false);

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
          setRole(userData.role || null);
        }
      } catch (error) {
        // Error checking driver role
      }
      
      setIsLoading(false);
    };

    checkDriverRole();
  }, [user, router]);

  // Show loading while checking driver role
  if (isLoading) {
    return null; // Will redirect if needed
  }

  const colors = Colors[theme ?? 'light'];

  return (
    <>
      <Tabs
        initialRouteName="index"
        screenOptions={({ route, navigation }) => ({
          lazy: true,
          tabBarActiveTintColor: colors.surface,
          tabBarInactiveTintColor: 'rgba(255,255,255,0.6)',
          headerShown: false,
          tabBarButton: (props) => {
            const isFocused = navigation.getState().routes[navigation.getState().index].name === route.name;
            return <CustomTabBar {...props} isFocused={isFocused} />;
          },
          tabBarBackground: TabBarBackground,
          tabBarStyle: Platform.select({
            ios: {
              // Use a transparent background on iOS to show the blur effect
              position: 'absolute',
              backgroundColor: 'transparent',
              borderTopWidth: 0,
              height: 75,
              paddingTop: 5,
              paddingBottom: 5,
            },
            default: {
              backgroundColor: 'transparent',
              borderTopWidth: 0,
              height: 75,
              paddingTop: 5,
              paddingBottom: 5,
            },
          }),
        })}>
        <Tabs.Screen
          name="index"
          options={{
            title: 'Home',
            tabBarIcon: ({ focused, color, size }) => (
              <MaterialIcons 
                name="home" 
                size={28} 
                color={colors.surface}
              />
            ),
          }}
        />
        <Tabs.Screen
          name="pages/DriverSchedulePage"
          options={{
            title: 'Schedule',
            tabBarIcon: ({ focused, color, size }) => (
              <MaterialIcons 
                name="event" 
                size={28} 
                color={colors.surface}
              />
            ),
          }}
        />
        <Tabs.Screen
          name="pages/DriverHistoryPage"
          options={{
            title: 'History',
            tabBarIcon: ({ focused, color, size }) => (
              <MaterialIcons 
                name="history" 
                size={28} 
                color={colors.surface}
              />
            ),
          }}
        />
      </Tabs>

      
    </>
  );
}

const styles = StyleSheet.create({
  fabContainer: {
    position: 'absolute',
    bottom: 100,
    right: 20,
    zIndex: 1000,
  },
  fab: {
    width: 60,
    height: 60,
    borderRadius: 30,
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.3,
    shadowRadius: 4.65,
  },
  fabGradient: {
    width: 60,
    height: 60,
    borderRadius: 30,
    justifyContent: 'center',
    alignItems: 'center',
  },
  aiIcon: {
    width: 32,
    height: 32,
  },
});
