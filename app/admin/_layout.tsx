import { Stack } from 'expo-router';

export default function AdminLayout() {
  return (
    <Stack>
      <Stack.Screen
        name="index"
        options={{
          title: 'Admin Portal',
          headerShown: false,
        }}
      />
      <Stack.Screen
        name="login"
        options={{
          title: 'Admin Login',
          headerShown: false,
        }}
      />
      <Stack.Screen
        name="login-mobile-vertical"
        options={{
          title: 'Admin Login Mobile Vertical',
          headerShown: false,
        }}
      />
      <Stack.Screen
        name="login-desktop"
        options={{
          title: 'Admin Login Desktop',
          headerShown: false,
        }}
      />
      <Stack.Screen
        name="login-responsive"
        options={{
          title: 'Admin Login Responsive',
          headerShown: false,
        }}
      />
      <Stack.Screen
        name="dashboard"
        options={{
          title: 'Admin Dashboard',
          headerShown: false,
        }}
      />
    </Stack>
  );
} 