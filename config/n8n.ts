// n8n Configuration
import Constants from 'expo-constants';
import { Platform } from 'react-native';

export const N8N_CONFIG = {
  // Replace with your actual n8n webhook URL
  WEBHOOK_URL: process.env.EXPO_PUBLIC_N8N_WEBHOOK_URL || 'http://localhost:5678/webhook/a8735df2-a775-4ac0-b57f-6182ba0fedff',
  
  // Optional: Add authentication if needed
  API_KEY: process.env.EXPO_PUBLIC_N8N_API_KEY || '',
  
  // Request timeout in milliseconds
  TIMEOUT: 30000,
  
  // Maximum retry attempts
  MAX_RETRIES: 3,
  
  // Delay between retries in milliseconds
  RETRY_DELAY: 1000,
  
  // CORS Proxy URL (fallback for CORS issues)
  CORS_PROXY_URL: process.env.EXPO_PUBLIC_CORS_PROXY_URL || 'https://cors-anywhere.herokuapp.com/',
  
  // Use CORS proxy if direct calls fail
  USE_CORS_PROXY: process.env.EXPO_PUBLIC_USE_CORS_PROXY === 'true' || false,
};

function normalizeUrlForPlatform(url: string): string {
  if (typeof url !== 'string' || url.length === 0) return url;

  // Helper: replace host in a URL string
  const replaceHostname = (originalUrl: string, newHostname: string): string => {
    try {
      const parsed = new URL(originalUrl);
      // Preserve original port; only swap hostname/IP
      parsed.hostname = newHostname;
      return parsed.toString();
    } catch {
      return originalUrl;
    }
  };

  // If URL points to localhost/127.0.0.1 and we're on a native device, try use LAN IP
  const isLoopback = url.includes('://localhost') || url.includes('://127.0.0.1');
  const isNative = Platform.OS === 'ios' || Platform.OS === 'android';

  if (isLoopback && isNative) {
    // Try to derive LAN host from Expo dev server hostUri (e.g., 192.168.1.10:8081)
    const hostUri = (Constants?.expoConfig as any)?.hostUri || (Constants as any)?.hostUri;
    if (typeof hostUri === 'string' && hostUri.length > 0) {
      const hostPart = hostUri.split('/')[0]; // e.g., 192.168.1.6:8081 or 192.168.1.6
      const lanHostname = hostPart.split(':')[0]; // strip Metro port
      return replaceHostname(url, lanHostname);
    }
  }

  // Android emulator cannot reach host's localhost; use 10.0.2.2 for loopback
  if (Platform.OS === 'android') {
    let updated = url.replace('://localhost', '://10.0.2.2');
    updated = updated.replace('://192.168.1.5', '://10.0.2.2');
    return updated;
  }

  // iOS simulator can use localhost; physical devices will be handled by LAN IP above
  return url;
}

export function getN8nWebhookUrl(): string {
  if (shouldUseCorsProxy()) {
    return getCorsProxyUrl() + normalizeUrlForPlatform(N8N_CONFIG.WEBHOOK_URL);
  }
  return normalizeUrlForPlatform(N8N_CONFIG.WEBHOOK_URL);
}

export function isN8nConfigured(): boolean {
  // Simple check - if webhook URL is not the default localhost URL
  return N8N_CONFIG.WEBHOOK_URL !== 'http://localhost:5678/webhook/a8735df2-a775-4ac0-b57f-6182ba0fedff';
}

export function getCorsProxyUrl(): string {
  return N8N_CONFIG.CORS_PROXY_URL;
}

export function shouldUseCorsProxy(): boolean {
  return N8N_CONFIG.USE_CORS_PROXY;
} 