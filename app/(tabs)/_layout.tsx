import { LinearGradient } from 'expo-linear-gradient';
import { Tabs, useRouter } from 'expo-router';
import { doc, getDoc } from 'firebase/firestore';
import React, { useEffect, useState } from 'react';
import { Image, Platform, StyleSheet, TouchableOpacity, View } from 'react-native';

import AIChatModal from '@/components/AIChatModal';
import { useAuthContext } from '@/components/AuthContext';
import { CustomTabBar } from '@/components/CustomTabBar';
import TabBarBackground from '@/components/ui/TabBarBackground';
import { db } from '@/config/firebase';
import { Colors } from '@/constants/Colors';
import { useTheme } from '@/hooks/useTheme';
import { MaterialIcons } from '@expo/vector-icons';

export default function TabLayout() {
  const { theme } = useTheme();
  const { user } = useAuthContext();
  const router = useRouter();
  const [isAdmin, setIsAdmin] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [role, setRole] = useState<string | null>(null);
  const [showAIChat, setShowAIChat] = useState(false);

  // Check if user has non-resident role and redirect if necessary
  useEffect(() => {
    const checkRole = async () => {
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
            setIsAdmin(true);
            router.replace('/admin/dashboard' as any);
            return;
          }
          if (userData.role === 'cicto') {
            router.replace('/cicto/dashboard' as any);
            return;
          }
          setRole(userData.role || null);
        }
        setIsAdmin(false);
      } catch (error) {
        console.error('Error checking role in tabs:', error);
        setIsAdmin(false);
      } finally {
        setIsLoading(false);
      }
    };

    checkRole();
  }, [user, router]);

  // Show loading while checking admin role
  if (isLoading) {
    return null; // Will redirect to admin if needed
  }

  // Don't render tabs if user is admin (they'll be redirected)
  if (isAdmin) {
    return null;
  }

  const colors = Colors[theme ?? 'light'];

  return (
    <>
      <Tabs
        initialRouteName="home"
        screenOptions={({ route, navigation }) => ({
          lazy: true,
          tabBarActiveTintColor: '#2E7D32',
          tabBarInactiveTintColor: '#757575',
          headerShown: false,
          tabBarButton: (props) => {
            const isFocused = navigation.getState().routes[navigation.getState().index].name === route.name;
            const isProtruding = route.name === 'report';
            return <CustomTabBar {...props} isFocused={isFocused} isProtruding={isProtruding} />;
          },
          tabBarStyle: {
            backgroundColor: '#FFFFFF',
            borderTopWidth: 1,
            borderTopColor: '#E0E0E0',
            height: 80,
            paddingTop: 8,
            paddingBottom: Platform.OS === 'ios' ? 24 : 8,
          },
        })}>
        <Tabs.Screen
          name="home"
          options={{
            title: 'Home',
            tabBarIcon: ({ focused, color, size }) => (
              <MaterialIcons 
                name="home" 
                size={28} 
                color={color}
              />
            ),
          }}
        />
        <Tabs.Screen
          name="schedule"
          options={{
            title: 'Schedule',
            tabBarIcon: ({ focused, color, size }) => (
              <MaterialIcons 
                name="event" 
                size={28} 
                color={color}
              />
            ),
          }}
        />
        <Tabs.Screen
          name="report"
          options={{
            title: 'Report',
            tabBarIcon: ({ focused, color, size }) => (
              <MaterialIcons 
                name="camera-alt" 
                size={32} 
                color={color}
              />
            ),
          }}
        />
        <Tabs.Screen
          name="announcements"
          options={{
            title: 'Alerts',
            tabBarIcon: ({ focused, color, size }) => (
              <MaterialIcons 
                name="campaign" 
                size={28} 
                color={color}
              />
            ),
          }}
        />
        <Tabs.Screen
          name="profile"
          options={{
            title: 'Profile',
            tabBarIcon: ({ focused, color, size }) => (
              <MaterialIcons 
                name="person" 
                size={28} 
                color={color}
              />
            ),
          }}
        />
      </Tabs>

      {/* Floating AI Chat Button */}
      <View style={styles.fabContainer}>
        <TouchableOpacity 
          style={styles.fab}
          onPress={() => setShowAIChat(true)}
          activeOpacity={0.8}
        >
          <LinearGradient
            colors={['#73946B', '#242E21']}
            style={styles.fabGradient}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
          >
            <Image 
              source={require('../../assets/images/AIChatBot.png')}
              style={styles.aiIcon}
              resizeMode="contain"
            />
          </LinearGradient>
        </TouchableOpacity>
      </View>

      {/* AI Chat Modal */}
      <AIChatModal 
        visible={showAIChat} 
        onClose={() => setShowAIChat(false)} 
      />
    </>
  );
}

const styles = StyleSheet.create({
  fabContainer: {
    position: 'absolute',
    bottom: 90, // Position above the tab bar
    right: 20,
    zIndex: 1000,
  },
  fab: {
    width: 56,
    height: 56,
    borderRadius: 28,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 8,
    overflow: 'hidden',
  },
  fabGradient: {
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
  },
  aiIcon: {
    width: 28,
    height: 28,
    tintColor: '#FFFFFF',
  },
});
