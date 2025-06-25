/**
 * Firebase Configuration Module
 * Handles Firebase app initialization, service setup, and emulator configuration
 */

// Firebase App Configuration
const firebaseConfig = {
  apiKey: "AIzaSyAy7k2ivo3x0LBLM0GKG6-AAaKfP8-snbs",
  authDomain: "quakeworld-match-scheduler.firebaseapp.com",
  projectId: "quakeworld-match-scheduler",
  storageBucket: "quakeworld-match-scheduler.appspot.com",
  messagingSenderId: "697734297374",
  appId: "1:697734297374:web:40a0310889774e56a87b0f"
};

// Environment detection - more robust than just localhost
const isDevelopment = () => {
  const hostname = window.location.hostname;
  return hostname === 'localhost' || 
         hostname === '127.0.0.1' || 
         hostname.startsWith('192.168.') || 
         hostname.startsWith('10.') ||
         hostname.includes('.local');
};

// Firebase initialization state
let firebaseInitialized = false;
let initializationError = null;
let initializationPromise = null;

// Service references
let app = null;
let auth = null;
let db = null;
let functions = null;

/**
 * Initialize Firebase services with error handling
 */
const initializeFirebase = async () => {
  // Return existing promise if initialization is in progress
  if (initializationPromise) {
    return initializationPromise;
  }

  // Return existing services if already initialized
  if (firebaseInitialized) {
    return { app, auth, db, functions };
  }

  initializationPromise = (async () => {
    try {
      console.log('🔥 Initializing Firebase...');
      
      // Check if Firebase SDK is loaded
      if (typeof firebase === 'undefined') {
        throw new Error('Firebase SDK not loaded. Make sure Firebase scripts are included before this module.');
      }

      // Initialize Firebase App if not already initialized
      app = firebase.apps.length ? firebase.apps[0] : firebase.initializeApp(firebaseConfig);
      console.log(`✓ Firebase app initialized for project: ${firebaseConfig.projectId}`);

      // Initialize Services
      auth = firebase.auth();
      db = firebase.firestore();
      functions = firebase.functions();
      console.log('✓ Firebase services initialized');

      // Configure emulators in development
      if (isDevelopment()) {
        console.log('🔧 Development environment detected - configuring emulators...');
        
        // Configure emulators BEFORE setting persistence
        auth.useEmulator('http://127.0.0.1:9099', { disableWarnings: true });
        db.useEmulator('127.0.0.1', 8080);
        functions.useEmulator('127.0.0.1', 5001);
        
        // Set auth persistence to LOCAL for development
        await auth.setPersistence(firebase.auth.Auth.Persistence.LOCAL);
        
        // Enable offline persistence for Firestore
        await db.enablePersistence({ synchronizeTabs: true }).catch((err) => {
          if (err.code === 'failed-precondition') {
            console.warn('Multiple tabs open, persistence can only be enabled in one tab at a time.');
          } else if (err.code === 'unimplemented') {
            console.warn('Browser doesn\'t support persistence.');
          }
        });
        
        console.log('✓ Emulators configured');
      } else {
        console.log('🚀 Production environment detected');
        // Enable offline persistence for Firestore in production
        await db.enablePersistence({ synchronizeTabs: true }).catch((err) => {
          if (err.code === 'failed-precondition') {
            console.warn('Multiple tabs open, persistence can only be enabled in one tab at a time.');
          } else if (err.code === 'unimplemented') {
            console.warn('Browser doesn\'t support persistence.');
          }
        });
      }

      firebaseInitialized = true;
      console.log('✅ Firebase initialization complete');
      
      return { app, auth, db, functions };
      
    } catch (error) {
      initializationError = error;
      console.error('❌ Firebase initialization failed:', error);
      throw error;
    } finally {
      initializationPromise = null;
    }
  })();

  return initializationPromise;
};

/**
 * Get Firebase services (lazy initialization)
 */
const getFirebaseServices = async () => {
  if (!firebaseInitialized && !initializationError) {
    await initializeFirebase();
  }
  
  if (initializationError) {
    throw initializationError;
  }
  
  return { app, auth, db, functions };
};

/**
 * Check if Firebase is ready
 */
const isFirebaseReady = () => firebaseInitialized && !initializationError;

/**
 * Get initialization status
 */
const getInitializationStatus = () => ({
  initialized: firebaseInitialized,
  error: initializationError,
  environment: isDevelopment() ? 'development' : 'production'
});

// Individual service getters (for convenience)
const getApp = () => app;
const getAuth = () => auth;
const getDb = () => db;
const getFunctions = () => functions;

// Export services and utilities
export {
  // Main services
  getFirebaseServices,
  initializeFirebase,
  
  // Utility functions
  isFirebaseReady,
  getInitializationStatus,
  isDevelopment,
  
  // Individual service getters
  getApp,
  getAuth,
  getDb,
  getFunctions
}; 