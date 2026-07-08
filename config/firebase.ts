// Firebase configuration — handles hot-reload / lazy-bundling re-evaluation
import { getApp, getApps, initializeApp } from 'firebase/app';
import { browserLocalPersistence, getAuth, initializeAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getFunctions } from 'firebase/functions';
import { getStorage } from 'firebase/storage';
import { Platform } from 'react-native';

// ─── 1. Validate env vars ──────────────────────────────────────────────────
const {
  EXPO_PUBLIC_FIREBASE_API_KEY: apiKey,
  EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN: authDomain,
  EXPO_PUBLIC_FIREBASE_PROJECT_ID: projectId,
  EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET: storageBucket,
  EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID: messagingSenderId,
  EXPO_PUBLIC_FIREBASE_APP_ID: appId,
} = process.env;

console.log('Firebase Config Check:');
console.log('  apiKey:', !!apiKey);
console.log('  authDomain:', !!authDomain);
console.log('  projectId:', !!projectId);
console.log('  storageBucket:', !!storageBucket);
console.log('  messagingSenderId:', !!messagingSenderId);
console.log('  appId:', !!appId);

let app: any = null;
let db: any = null;
let functions: any = null;
let auth: any = null;
let storage: any = null;

  const firebaseConfig = {
    apiKey: apiKey || 'AIzaSyCI_dZWMCn1QbwAaZe9qkPi_lB5KG0iLks',
    authDomain: authDomain || 'trashtruck-swu-98ce9.firebaseapp.com',
    projectId: projectId || 'trashtruck-swu-98ce9',
    storageBucket: storageBucket || 'trashtruck-swu-98ce9.firebasestorage.app',
    messagingSenderId: messagingSenderId || '634173704158',
    appId: appId || '1:634173704158:web:d7a0efc4fd1bd026283f4f',
  };

  // ─── 2. App ───────────────────────────────────────────────────────────────
  // getApps().length > 0 means the module was already evaluated (lazy-bundle
  // or hot-reload). Calling initializeApp again would throw "already exists".
  try {
    app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();
    console.log('Firebase: App ready');
  } catch (e: any) {
    console.error('Firebase: App initialization error:', e.message);
  }

  // ─── 3. Firestore ─────────────────────────────────────────────────────────
  if (app) {
    try {
      db = getFirestore(app);
      console.log('Firebase: Firestore ready');
    } catch (e: any) {
      console.error('Firebase: Firestore error:', e.message);
    }
  }

  // ─── 4. Functions ─────────────────────────────────────────────────────────
  if (app) {
    try {
      functions = getFunctions(app, 'us-central1');
      console.log('Firebase: Functions ready');
    } catch (e: any) {
      console.error('Firebase: Functions error:', e.message);
    }
  }

  // ─── 5. Storage ───────────────────────────────────────────────────────────
  if (app) {
    try {
      storage = getStorage(app);
      console.log('Firebase: Storage ready');
    } catch (e: any) {
      console.error('Firebase: Storage error:', e.message);
    }
  }

  // ─── 6. Auth ──────────────────────────────────────────────────────────────
  // Web  → initializeAuth + browserLocalPersistence (explicit, no AsyncStorage)
  // Native → getAuth (Firebase SDK automatically uses AsyncStorage on native)
  //
  // NOTE: firebase/auth/react-native was REMOVED in Firebase v9+. Do NOT import
  // getReactNativePersistence — it does not exist in firebase v12. The default
  // getAuth() on native already uses the correct AsyncStorage persistence.
  if (app) {
    try {
      if (Platform.OS === 'web') {
        try {
          auth = initializeAuth(app, { persistence: browserLocalPersistence });
          console.log('Firebase: Auth ready (web / browserLocalPersistence)');
        } catch (e: any) {
          // "auth/already-initialized" → module re-evaluated, reuse existing instance
          if (
            e?.code === 'auth/already-initialized' ||
            String(e?.message).includes('already')
          ) {
            auth = getAuth(app);
            console.log('Firebase: Auth ready (web / getAuth — already initialized)');
          } else {
            throw e;
          }
        }
      } else {
        // Native: getAuth uses AsyncStorage persistence by default in Firebase v9+
        auth = getAuth(app);
        console.log('Firebase: Auth ready (native / getAuth)');
      }
    } catch (e: any) {
      console.error('Firebase: Auth initialization failed:', e.message);
      auth = null;
    }
  }

  console.log('Firebase: Initialization complete. auth:', auth ? 'OK' : 'NULL');

export { auth, db, functions, storage };
export default app;