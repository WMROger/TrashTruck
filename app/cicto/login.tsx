import React from 'react';
import { Redirect } from 'expo-router';
import { useAuthContext } from '@/components/AuthContext';
import PortalLoginForm from '@/components/admin/PortalLoginForm';
import { ActivityIndicator, View } from 'react-native';

export default function CictoLoginPage() {
  const { user, loading, isAuthenticated } = useAuthContext();

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#064E3B' }}>
        <ActivityIndicator size="large" color="#10B981" />
      </View>
    );
  }

  if (isAuthenticated && user) {
    return <Redirect href="/cicto/dashboard" />;
  }

  return <PortalLoginForm portal="cicto" />;
}
