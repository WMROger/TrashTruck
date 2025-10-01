// Web-specific app entry point
import { Platform } from 'react-native';

// Ensure Material Icons font is loaded on web
if (Platform.OS === 'web' && typeof window !== 'undefined') {
  // Check if Material Icons font is already loaded
  const checkAndLoadFont = () => {
    const existingLink = document.querySelector('link[href*="Material+Icons"]');
    
    if (!existingLink) {
      // Create Material Icons font link
      const materialIconsLink = document.createElement('link');
      materialIconsLink.rel = 'stylesheet';
      materialIconsLink.href = 'https://fonts.googleapis.com/icon?family=Material+Icons';
      materialIconsLink.crossOrigin = 'anonymous';
      document.head.appendChild(materialIconsLink);
    }

    // Also ensure we have fallback fonts
    const existingPoppins = document.querySelector('link[href*="Poppins"]');
    if (!existingPoppins) {
      const poppinsLink = document.createElement('link');
      poppinsLink.rel = 'preconnect';
      poppinsLink.href = 'https://fonts.googleapis.com';
      document.head.appendChild(poppinsLink);

      const poppinsLink2 = document.createElement('link');
      poppinsLink2.rel = 'preconnect';
      poppinsLink2.href = 'https://fonts.gstatic.com';
      poppinsLink2.crossOrigin = 'anonymous';
      document.head.appendChild(poppinsLink2);

      const poppinsFontLink = document.createElement('link');
      poppinsFontLink.rel = 'stylesheet';
      poppinsFontLink.href = 'https://fonts.googleapis.com/css2?family=Poppins:wght@300;400;500;600;700&display=swap';
      document.head.appendChild(poppinsFontLink);
    }
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', checkAndLoadFont);
  } else {
    checkAndLoadFont();
  }
}

// Export the default App component
export { default } from './_layout';
