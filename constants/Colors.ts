/**
 * Below are the colors that are used in the app. The colors are defined in the light and dark mode.
 * There are many other ways to style your app. For example, [Nativewind](https://www.nativewind.dev/), [Tamagui](https://tamagui.dev/), [unistyles](https://reactnativeunistyles.vercel.app), etc.
 */

const tintColorLight = '#5B7C67'; // TrashTrack green
const tintColorDark = '#A9D6B5'; // Lighter green for dark mode

export const Colors = {
  light: {
    text: '#11181C',
    background: '#fff',
    tint: tintColorLight,
    icon: '#687076',
    tabIconDefault: '#687076',
    tabIconSelected: tintColorLight,
    // TrashTrack specific colors
    primary: '#5B7C67',
    primaryLight: '#A9D6B5',
    secondary: '#E8F5E8',
    surface: '#FFFFFF',
    surfaceVariant: '#F8F9FA',
    border: '#E0E0E0',
    textPrimary: '#333333',
    textSecondary: '#666666',
    textTertiary: '#999999',
    success: '#4CAF50',
    warning: '#FF9800',
    error: '#F44336',
    chatUserBubble: '#5B7C67',
    chatUserText: '#FFFFFF',
    chatAIBubble: '#F8F9FA',
    chatAIText: '#333333',
    chatAIBorder: '#5B7C67',
  },
  dark: {
    text: '#ECEDEE',
    background: '#151718',
    tint: tintColorDark,
    icon: '#9BA1A6',
    tabIconDefault: '#9BA1A6',
    tabIconSelected: tintColorDark,
    // TrashTrack specific colors
    primary: '#A9D6B5',
    primaryLight: '#5B7C67',
    secondary: '#2A3A2E',
    surface: '#1E1E1E',
    surfaceVariant: '#2A2A2A',
    border: '#404040',
    textPrimary: '#FFFFFF',
    textSecondary: '#CCCCCC',
    textTertiary: '#999999',
    success: '#66BB6A',
    warning: '#FFB74D',
    error: '#EF5350',
    chatUserBubble: '#A9D6B5',
    chatUserText: '#1E1E1E',
    chatAIBubble: '#2A2A2A',
    chatAIText: '#FFFFFF',
    chatAIBorder: '#A9D6B5',
  },
};
