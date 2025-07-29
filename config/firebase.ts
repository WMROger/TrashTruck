// Firebase configuration with graceful fallback
let app: any = null;
let db: any = null;
let functions: any = null;

try {
  const { initializeApp } = require('firebase/app');
  const { getFirestore } = require('firebase/firestore');
  const { getFunctions } = require('firebase/functions');

  // Your Firebase configuration - Update these with your actual values
  const firebaseConfig = {
    apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY || "your-api-key",
    authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN || "your-project.firebaseapp.com",
    projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID || "your-project-id",
    storageBucket: process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET || "your-project.appspot.com",
    messagingSenderId: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || "your-sender-id",
    appId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID || "your-app-id"
  };

  // Initialize Firebase
  app = initializeApp(firebaseConfig);

  // Initialize Firestore
  db = getFirestore(app);

  // Initialize Functions
  functions = getFunctions(app);

  console.log('Firebase initialized successfully');
} catch (error: any) {
  console.log('Firebase not available, using mock mode:', error.message);
  // Provide mock implementations
  app = null;
  db = null;
  functions = null;
}

// Export with fallbacks
export { db, functions };
export default app; 