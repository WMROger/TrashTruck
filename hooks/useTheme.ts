import { useColorScheme } from 'react-native';
import { create } from 'zustand';

interface ThemeStore {
  theme: 'light' | 'dark' | 'system';
  setTheme: (theme: 'light' | 'dark' | 'system') => void;
}

export const useThemeStore = create<ThemeStore>((set) => ({
  theme: 'light', // Changed from 'system' to 'light' as default
  setTheme: (theme) => set({ theme }),
}));

export function useTheme() {
  const systemColorScheme = useColorScheme();
  const { theme, setTheme } = useThemeStore();
  
  // Determine the actual theme to use - prioritize user choice over system
  const actualTheme = theme === 'system' ? (systemColorScheme ?? 'light') : theme;
  
  return {
    theme: actualTheme,
    setTheme,
    isSystem: theme === 'system',
  };
} 