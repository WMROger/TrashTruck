import { useColorScheme } from 'react-native';
import { useState, useEffect } from 'react';
import { Colors } from '@/constants/Colors';

export function useTheme() {
  const systemColorScheme = useColorScheme();
  const [manualTheme, setManualTheme] = useState<'light' | 'dark' | 'system'>('system');
  
  // Determine the actual theme to use
  const getActualTheme = () => {
    if (manualTheme === 'system') {
      return systemColorScheme || 'light';
    }
    return manualTheme;
  };
  
  const actualTheme = getActualTheme();
  const isDark = actualTheme === 'dark';
  
  // Update manual theme when system theme changes (if using system)
  useEffect(() => {
    if (manualTheme === 'system') {
      // This will trigger a re-render when system theme changes
    }
  }, [systemColorScheme, manualTheme]);
  
  const toggleTheme = () => {
    if (manualTheme === 'system') {
      setManualTheme(isDark ? 'light' : 'dark');
    } else if (manualTheme === 'light') {
      setManualTheme('dark');
    } else {
      setManualTheme('light');
    }
  };
  
  const setTheme = (theme: 'light' | 'dark' | 'system') => {
    setManualTheme(theme);
  };
  
  return {
    colors: Colors[isDark ? 'dark' : 'light'],
    isDark,
    colorScheme: actualTheme,
    manualTheme,
    toggleTheme,
    setTheme,
  };
} 