import { useLocalSearchParams } from 'expo-router';
import React from 'react';
import PortalLoginForm from '@/components/admin/PortalLoginForm';

export default function AdminLoginPage() {
  const params = useLocalSearchParams<{ portal?: string }>();
  const isCicto = params.portal === 'cicto';

  return <PortalLoginForm portal={isCicto ? 'cicto' : 'cenro'} />;
}
