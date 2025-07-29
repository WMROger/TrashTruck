// n8n Configuration
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

export function getN8nWebhookUrl(): string {
  if (shouldUseCorsProxy()) {
    return getCorsProxyUrl() + N8N_CONFIG.WEBHOOK_URL;
  }
  return N8N_CONFIG.WEBHOOK_URL;
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