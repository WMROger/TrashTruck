// Firebase configuration with graceful fallback
let app: any = null;
let db: any = null;
let functions: any = null;
let auth: any = null;

try {
  const { initializeApp } = require('firebase/app');
  const { getFirestore } = require('firebase/firestore');
  const { getFunctions } = require('firebase/functions');
  const { getAuth } = require('firebase/auth');

  // Your Firebase configuration - Update these with your actual values
  const firebaseConfig = {
    apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY || "your-api-key",
    authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN || "your-project.firebaseapp.com",
    projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID || "your-project-id",
    storageBucket: process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET || "your-project.appspot.com",
    messagingSenderId: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || "your-sender-id",
    appId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID || "your-app-id"
  };

  // Debug: Log environment variables (without exposing sensitive data)
  console.log('Firebase Config Check:');
  console.log('API Key exists:', !!process.env.EXPO_PUBLIC_FIREBASE_API_KEY);
  console.log('Auth Domain exists:', !!process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN);
  console.log('Project ID exists:', !!process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID);
  console.log('Storage Bucket exists:', !!process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET);
  console.log('Messaging Sender ID exists:', !!process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID);
  console.log('App ID exists:', !!process.env.EXPO_PUBLIC_FIREBASE_APP_ID);

  // Check if we have the minimum required config
  if (!process.env.EXPO_PUBLIC_FIREBASE_API_KEY || 
      !process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN || 
      !process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID) {
    throw new Error('Missing required Firebase environment variables');
  }

  // Initialize Firebase
  app = initializeApp(firebaseConfig);

  // Initialize Firestore
  db = getFirestore(app);

  // Initialize Functions
  functions = getFunctions(app);

  // Initialize Authentication
  auth = getAuth(app);

  // Verify that auth is properly initialized
  if (!auth || typeof auth.signInWithRedirect !== 'function') {
    console.warn('Firebase Auth not properly initialized, some features may not work');
  }

  console.log('Firebase initialized successfully');
} catch (error: any) {
  console.log('Firebase not available, using mock mode:', error.message);
  // Provide mock implementations
  app = null;
  db = null;
  functions = null;
  auth = null;
}

// Export with fallbacks
export { auth, db, functions };
export default app; 