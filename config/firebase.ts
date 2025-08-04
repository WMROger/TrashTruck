// Firebase configuration with graceful fallback
let app: any = null;
let db: any = null;
let functions: any = null;

try {
  const { initializeApp } = require('firebase/app');
  const { getFirestore } = require('firebase/firestore');
  const { getFunctions } = require('firebase/functions');

  // Your web app's Firebase configuration
  const firebaseConfig = {
    apiKey: "AIzaSyCI_dZWMCn1QbwAaZe9qkPi_lB5KG0iLks",
    authDomain: "trashtruck-swu-98ce9.firebaseapp.com",
    projectId: "trashtruck-swu-98ce9",
    storageBucket: "trashtruck-swu-98ce9.firebasestorage.app",
    messagingSenderId: "634173704158",
    appId: "1:634173704158:web:d7a0efc4fd1bd026283f4f"
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