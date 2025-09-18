import { Redirect } from 'expo-router';

export default function DriverTab() {
  // Ensure we land on the driver stack/screen correctly inside tabs
  return <Redirect href="/driver/index" />;
}

