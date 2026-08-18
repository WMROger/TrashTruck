import { useLocalSearchParams } from 'expo-router';
import React from 'react';
import PortalLoginForm from '@/components/admin/PortalLoginForm';

export default function AdminLoginPage() {
  const params = useLocalSearchParams<{ portal?: string }>();
  const isDict = params.portal === 'dict';

  return <PortalLoginForm portal={isDict ? 'dict' : 'cenro'} />;
}
