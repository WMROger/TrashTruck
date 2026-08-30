import React from 'react';
import { Redirect } from 'expo-router';
import { useAuthContext } from '@/components/AuthContext';
import { ActivityIndicator, View, Platform } from 'react-native';

export default function Index() {
  const { user, loading, isAuthenticated } = useAuthContext();

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#064E3B' }}>
        <ActivityIndicator size="large" color="#10B981" />
      </View>
    );
  }

  if (isAuthenticated && user) {
    const emailLower = (user.email || '').toLowerCase();
    if (
      emailLower.startsWith('admin@') ||
      emailLower.startsWith('cenro@') ||
      emailLower.includes('admin') ||
      emailLower.includes('cenro') ||
      emailLower.includes('coord')
    ) {
      return <Redirect href="/admin/dashboard" />;
    }
    if (emailLower.includes('cicto')) {
      return <Redirect href="/cicto/dashboard" />;
    }
    if (emailLower.includes('driver')) {
      return <Redirect href="/(driver)" />;
    }
    return <Redirect href="/(tabs)/home" />;
  }

  if (Platform.OS === 'web') {
    return <Redirect href="/cenro" />;
  }

  return <Redirect href="/splash" />;
} 