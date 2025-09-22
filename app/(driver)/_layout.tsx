import { Stack } from 'expo-router';
import React from 'react';

export default function DriverLayout() {
  return (
    <Stack>
      <Stack.Screen 
        name="index" 
        options={{ 
          headerShown: false,
          title: 'Driver Dashboard'
        }} 
      />
      <Stack.Screen 
        name="pages/DriverHomePage" 
        options={{ 
          headerShown: false,
          title: 'Driver Home'
        }} 
      />
      <Stack.Screen 
        name="pages/DriverHistoryPage" 
        options={{ 
          headerShown: false,
          title: 'Driver History'
        }} 
      />
      <Stack.Screen 
        name="pages/DriverSchedulePage" 
        options={{ 
          headerShown: false,
          title: 'Driver Schedule'
        }} 
      />
      <Stack.Screen 
        name="pages/DriverProfilePage" 
        options={{ 
          headerShown: false,
          title: 'Driver Profile'
        }} 
      />
    </Stack>
  );
}
