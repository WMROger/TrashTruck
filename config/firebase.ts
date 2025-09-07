// Firebase configuration with graceful fallback
import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getFunctions } from 'firebase/functions';
import { getStorage } from 'firebase/storage';

let app: any = null;
let db: any = null;
let functions: any = null;
let auth: any = null;
let storage: any = null;

try {
  console.log('Firebase: Starting initialization...');

  // Your Firebase configuration - Update these with your actual values
  const firebaseConfig = {
    apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY,
    authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN,
    projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID,
    storageBucket: process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
    appId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID 
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

  console.log('Firebase: Config validation passed, initializing app...');

  // Initialize Firebase
  app = initializeApp(firebaseConfig);
  console.log('Firebase: App initialized successfully');

  // Initialize Firestore
  db = getFirestore(app);
  console.log('Firebase: Firestore initialized successfully');

  // Initialize Functions
  functions = getFunctions(app);
  console.log('Firebase: Functions initialized successfully');

  // Initialize Storage with proper configuration for web
  storage = getStorage(app);
  console.log('Firebase: Storage initialized successfully');
  console.log('Firebase: Storage bucket:', storage._delegate?._host || 'Not available');

  // Initialize Authentication
  try {
    console.log('Firebase: Starting auth initialization...');
    
    // For now, use standard getAuth for web compatibility
    auth = getAuth(app);
    console.log('Firebase: Auth initialization completed with getAuth');
    
  } catch (e) {
    console.error('Firebase: Auth initialization error:', e);
    // If getAuth fails, try to create a minimal auth object
    auth = null;
  }

  // Verify that auth is properly initialized
  if (!auth) {
    console.error('Firebase: Auth is null - not properly initialized');
  } else if (typeof auth.signOut !== 'function') {
    console.error('Firebase: Auth missing signOut method - not properly initialized');
  } else if (typeof auth.currentUser !== 'undefined') {
    console.log('Firebase: Auth properly initialized with signOut and currentUser');
  } else {
    console.warn('Firebase: Auth may not be fully initialized');
  }

  console.log('Firebase: Initialization completed successfully');
  console.log('Firebase: Final auth object:', auth);
  if (auth) {
    console.log('Firebase: Auth methods available:', Object.getOwnPropertyNames(auth).filter(name => typeof auth[name] === 'function'));
  }
  
} catch (error: any) {
  console.error('Firebase: Initialization failed:', error.message);
  console.error('Firebase: Error stack:', error.stack);
  // Provide mock implementations
  app = null;
  db = null;
  functions = null;
  auth = null;
  storage = null;
}

// Export with fallbacks
export { auth, db, functions, storage };
export default app; 