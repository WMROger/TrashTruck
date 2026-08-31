import React from 'react';
import { Redirect } from 'expo-router';
import { useAuthContext } from '@/components/AuthContext';
import PortalLoginForm from '@/components/admin/PortalLoginForm';
import { ActivityIndicator, View } from 'react-native';

export default function CenroLoginPage() {
  const { loading } = useAuthContext();

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#064E3B' }}>
        <ActivityIndicator size="large" color="#10B981" />
      </View>
    );
  }

  return <PortalLoginForm portal="cenro" />;
}
