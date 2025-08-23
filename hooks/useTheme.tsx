import React, { createContext, useContext, useEffect, useState } from 'react';
import { useColorScheme } from 'react-native';

type Theme = 'light' | 'dark';

interface ThemeContextType {
  theme: Theme;
  setTheme: (theme: Theme) => void;
  toggleSystem: () => void;
  isSystem: boolean;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const systemColorScheme = useColorScheme();
  const [theme, setThemeState] = useState<Theme>('light'); // Default to light
  const [isSystem, setIsSystem] = useState(true);

  // Initialize theme from localStorage on web, or default to light
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const savedTheme = localStorage.getItem('theme');
      if (savedTheme === 'light' || savedTheme === 'dark') {
        setThemeState(savedTheme);
        setIsSystem(false);
      } else if (systemColorScheme) {
        setThemeState(systemColorScheme);
        setIsSystem(true);
      }
    }
  }, [systemColorScheme]);

  const setTheme = (newTheme: Theme) => {
    console.log('ThemeProvider - Setting theme to:', newTheme);
    setThemeState(newTheme);
    setIsSystem(false);
    
    // Save to localStorage on web
    if (typeof window !== 'undefined') {
      localStorage.setItem('theme', newTheme);
    }
  };

  const toggleSystem = () => {
    console.log('ThemeProvider - Toggling system theme');
    if (isSystem) {
      // If currently using system, switch to current theme
      setIsSystem(false);
    } else {
      // If not using system, switch back to system
      setIsSystem(true);
      if (systemColorScheme) {
        setThemeState(systemColorScheme);
      }
    }
  };

  // Determine the actual theme to use
  const currentTheme = isSystem ? (systemColorScheme ?? 'light') : theme;
  
  // Debug: Log theme changes
  useEffect(() => {
    console.log('ThemeProvider - Theme changed to:', currentTheme, 'isSystem:', isSystem);
  }, [currentTheme, isSystem]);

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
