// Firebase configuration with graceful fallback
let app: any = null;
let db: any = null;
let functions: any = null;

try {
  const { initializeApp } = require('firebase/app');
  const { getFirestore } = require('firebase/firestore');
  const { getFunctions } = require('firebase/functions');

  // Your Firebase configuration
  const firebaseConfig = {
    apiKey: "your-api-key",
    authDomain: "your-project.firebaseapp.com",
    projectId: "your-project-id",
    storageBucket: "your-project.appspot.com",
    messagingSenderId: "your-sender-id",
    appId: "your-app-id"
  };

  // Initialize Firebase
  app = initializeApp(firebaseConfig);

  // Initialize Firestore
  db = getFirestore(app);

  // Initialize Functions
  functions = getFunctions(app);

  console.log('Firebase initialized successfully');
} catch (error) {
  console.log('Firebase not available, using mock mode:', error.message);
  // Provide mock implementations
  app = null;
  db = null;
  functions = null;
}

// Export with fallbacks
export { db, functions };
export default app; 