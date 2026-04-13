import { getTransitionConfig } from '@/utils/transitions';
import { Stack } from 'expo-router';
import React from 'react';

export default function DriverLayout() {
  return (
    <Stack
      screenOptions={getTransitionConfig('slideFromRight')}
    >
      <Stack.Screen 
        name="index" 
        options={{ 
          headerShown: false,
          title: 'Driver Dashboard',
          ...getTransitionConfig('slideFromRight'),
        }} 
      />
      <Stack.Screen 
        name="pages/DriverHomePage" 
        options={{ 
          headerShown: false,
          title: 'Driver Home',
          ...getTransitionConfig('slideFromRight'),
        }} 
      />
      <Stack.Screen 
        name="pages/DriverHistoryPage" 
        options={{ 
          headerShown: false,
          title: 'Driver History',
          ...getTransitionConfig('slideFromRight'),
        }} 
      />
      <Stack.Screen 
        name="pages/DriverSchedulePage" 
        options={{ 
          headerShown: false,
          title: 'Driver Schedule',
          ...getTransitionConfig('slideFromRight'),
        }} 
      />
      <Stack.Screen 
        name="pages/DriverProfilePage" 
        options={{ 
          headerShown: false,
          title: 'Driver Profile',
          ...getTransitionConfig('slideFromRight'),
        }} 
      />
    </Stack>
  );
}
