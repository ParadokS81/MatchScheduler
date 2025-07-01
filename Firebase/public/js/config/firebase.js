/**
 * Firebase Configuration Module
 * Handles Firebase app initialization, service setup, and emulator configuration
 */

// Firebase App Configuration
const firebaseConfig = {
  apiKey: "AIzaSyAElazBT8eT13fT0wCO5K7z3-5D1z42ZBM",
  authDomain: "matchscheduler-dev.firebaseapp.com",
  projectId: "matchscheduler-dev",
  storageBucket: "matchscheduler-dev.firebasestorage.app",
  messagingSenderId: "340309534131",
  appId: "1:340309534131:web:77155fb67f95ec2816d7c6"
};

// Environment detection - more robust than just localhost
const isDevelopment = () => {
  const hostname = window.location.hostname;
  return hostname === 'localhost' || 
         hostname === '127.0.0.1' || 
         hostname.startsWith('192.168.') || 
         hostname.startsWith('10.') ||
         hostname.startsWith('100.') ||  // Tailscale range
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
      console.log('🔍 Current initialization state:', { 
        firebaseInitialized, 
        hasError: !!initializationError,
        promiseExists: !!initializationPromise 
      });
      
      // Check if Firebase SDK is loaded
      if (typeof firebase === 'undefined') {
        throw new Error('Firebase SDK not loaded. Make sure Firebase scripts are included before this module.');
      }

      // Initialize Firebase App if not already initialized
      console.log(`🔍 Checking Firebase apps: ${firebase.apps.length} existing apps`);
      if (firebase.apps.length > 0) {
        console.log(`📱 Using existing Firebase app: ${firebase.apps[0].name}`);
        app = firebase.apps[0];
      } else {
        console.log('📱 Creating new Firebase app...');
        app = firebase.initializeApp(firebaseConfig);
      }
      console.log(`✓ Firebase app initialized for project: ${firebaseConfig.projectId}`);

      // Initialize Services
      auth = firebase.auth();
      db = firebase.firestore();
      functions = firebase.functions(); // Initialize without region for emulator
      console.log('✓ Firebase services initialized');

      // Hybrid setup: Local functions, Live Auth & Firestore
      if (isDevelopment()) {
        // Use the current hostname to connect to emulator (works for localhost and Tailscale)
        const emulatorHost = window.location.hostname;
        
        console.log('🔧 Development environment - using HYBRID setup:');
        console.log(`  📱 Functions: Local emulator (${emulatorHost}:5001)`);
        console.log('  ☁️ Auth: Live Firebase');
        console.log('  ☁️ Firestore: Live Firebase');
        
        // Configure functions emulator BEFORE using functions
        functions.useEmulator(emulatorHost, 5001);
        console.log(`🔧 Functions emulator configured for ${emulatorHost}:5001`);
        
        // Test the configuration
        console.log(`🔍 Functions emulator URL should be: http://${emulatorHost}:5001/createTeam`);
        console.log('🌍 Functions region: europe-west10');
        
        console.log('✅ Hybrid configuration complete');
      } else {
        console.log('🚀 Production environment - using live Firebase services');
      }
      
      // Set auth persistence to LOCAL for all environments
      await auth.setPersistence(firebase.auth.Auth.Persistence.LOCAL);
      
      // Only enable Firestore persistence in full local development (not hybrid)
      // Hybrid setup (live Firestore + local functions) can cause persistence conflicts
      if (isDevelopment() && false) { // Disabled for hybrid setup
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