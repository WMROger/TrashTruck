import React, { createContext, useContext, useEffect, useState } from 'react';
import { Platform, useColorScheme } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

type Theme = 'light' | 'dark';

const THEME_STORAGE_KEY = 'trashtrack_theme_preference';

interface ThemeContextType {
  theme: Theme;
  setTheme: (theme: Theme) => void;
  toggleSystem: () => void;
  isSystem: boolean;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const systemColorScheme = useColorScheme();
  const [theme, setThemeState] = useState<Theme>('light');
  const [isSystem, setIsSystem] = useState(false);

  // Initialize theme from AsyncStorage (and localStorage on Web)
  useEffect(() => {
    let isMounted = true;

    async function loadSavedTheme() {
      try {
        let savedTheme: string | null = null;

        // Try reading from AsyncStorage first
        savedTheme = await AsyncStorage.getItem(THEME_STORAGE_KEY);

        // Fallback to localStorage on Web if not found in AsyncStorage
        if (!savedTheme && Platform.OS === 'web' && typeof window !== 'undefined') {
          savedTheme = localStorage.getItem('theme') || localStorage.getItem(THEME_STORAGE_KEY);
        }

        if (isMounted) {
          if (savedTheme === 'light' || savedTheme === 'dark') {
            setThemeState(savedTheme as Theme);
            setIsSystem(false);
          } else if (savedTheme === 'system') {
            setIsSystem(true);
            if (systemColorScheme) {
              setThemeState(systemColorScheme);
            }
          } else if (systemColorScheme) {
            setThemeState(systemColorScheme);
            setIsSystem(true);
          }
        }
      } catch (error) {
        console.log('Error loading theme preference:', error);
      }
    }

    loadSavedTheme();

    return () => {
      isMounted = false;
    };
  }, [systemColorScheme]);

  const setTheme = (newTheme: Theme) => {
    setThemeState(newTheme);
    setIsSystem(false);

    // Save to AsyncStorage (works on iOS, Android, and Web)
    AsyncStorage.setItem(THEME_STORAGE_KEY, newTheme).catch((e) =>
      console.log('Could not save theme to AsyncStorage:', e)
    );

    // Also save to localStorage on web platform
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      try {
        localStorage.setItem('theme', newTheme);
        localStorage.setItem(THEME_STORAGE_KEY, newTheme);
      } catch {}
    }
  };

  const toggleSystem = () => {
    if (isSystem) {
      setIsSystem(false);
      AsyncStorage.setItem(THEME_STORAGE_KEY, theme).catch(() => {});
    } else {
      setIsSystem(true);
      if (systemColorScheme) {
        setThemeState(systemColorScheme);
      }
      AsyncStorage.setItem(THEME_STORAGE_KEY, 'system').catch(() => {});
    }
  };

  // Determine the actual theme to use
  const currentTheme = isSystem ? (systemColorScheme ?? 'light') : theme;

  const value = {
    theme: currentTheme,
    setTheme,
    toggleSystem,
    isSystem,
  };

  return (
    <ThemeContext.Provider value={value}>
      {children}
    </ThemeContext.Provider>
  );
}

// Theme hook with proper state management
export function useTheme() {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
}
