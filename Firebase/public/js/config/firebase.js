/**
 * Firebase Configuration Module
 * Handles Firebase app initialization, service setup, and emulator configuration
 * Uses Firebase v9+ modular SDK
 */

// Import Firebase v9+ modular SDK
import { initializeApp, getApps, getApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getAuth, setPersistence, browserLocalPersistence } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { getFirestore, enableIndexedDbPersistence } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { getFunctions, connectFunctionsEmulator } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-functions.js";
import { getStorage } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-storage.js";

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

// Service references - initialized once and exported
let app = null;
let auth = null;
let db = null;
let functions = null;
let storage = null;

/**
 * Initialize Firebase services with error handling using v9+ modular SDK
 */
const initializeFirebase = async () => {
  // Return existing promise if initialization is in progress
  if (initializationPromise) {
    return initializationPromise;
  }

  // Return existing services if already initialized
  if (firebaseInitialized) {
    return { app, auth, db, functions, storage };
  }

  initializationPromise = (async () => {
    try {
      console.log('🔥 Initializing Firebase with v9+ modular SDK...');
      console.log('🔍 Current initialization state:', { 
        firebaseInitialized, 
        hasError: !!initializationError,
        promiseExists: !!initializationPromise 
      });

      // Initialize Firebase App if not already initialized
      const existingApps = getApps();
      console.log(`🔍 Checking Firebase apps: ${existingApps.length} existing apps`);
      
      if (existingApps.length > 0) {
        console.log(`📱 Using existing Firebase app: ${existingApps[0].name}`);
        app = getApp();
      } else {
        console.log('📱 Creating new Firebase app...');
        app = initializeApp(firebaseConfig);
      }
      console.log(`✓ Firebase app initialized for project: ${firebaseConfig.projectId}`);

      // Initialize ALL services immediately after app initialization
      auth = getAuth(app);
      db = getFirestore(app);
      functions = getFunctions(app);
      storage = getStorage(app);
      console.log('✓ All Firebase services initialized (Auth, Firestore, Functions, Storage)');

      // Hybrid setup: Local functions, Live Auth & Firestore
      if (isDevelopment()) {
        // Use the current hostname to connect to emulator (works for localhost and Tailscale)
        const emulatorHost = window.location.hostname;
        
        console.log('🔧 Development environment - using HYBRID setup:');
        console.log(`  📱 Functions: Local emulator (${emulatorHost}:5001)`);
        console.log('  ☁️ Auth: Live Firebase');
        console.log('  ☁️ Firestore: Live Firebase');
        console.log('  ☁️ Storage: Live Firebase');
        
        // Configure functions emulator BEFORE using functions
        connectFunctionsEmulator(functions, emulatorHost, 5001);
        console.log(`🔧 Functions emulator configured for ${emulatorHost}:5001`);
        
        console.log('✅ Hybrid configuration complete');
      } else {
        console.log('🚀 Production environment - using live Firebase services');
      }
      
      // Set auth persistence to LOCAL for all environments
      await setPersistence(auth, browserLocalPersistence);
      
      // Only enable Firestore persistence in full local development (not hybrid)
      // Hybrid setup (live Firestore + local functions) can cause persistence conflicts
      if (isDevelopment() && false) { // Disabled for hybrid setup
        await enableIndexedDbPersistence(db, { synchronizeTabs: true }).catch((err) => {
          if (err.code === 'failed-precondition') {
            console.warn('Multiple tabs open, persistence can only be enabled in one tab at a time.');
          } else if (err.code === 'unimplemented') {
            console.warn('Browser doesn\'t support persistence.');
          }
        });
      }

      firebaseInitialized = true;
      console.log('✅ Firebase initialization complete');
      
      return { app, auth, db, functions, storage };
      
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
  
  return { app, auth, db, functions, storage };
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

// Individual service getters - these return the initialized instances
const getAppInstance = () => {
  if (!firebaseInitialized) {
    throw new Error('Firebase not initialized. Call initializeFirebase() first.');
  }
  return app;
};

const getAuthInstance = () => {
  if (!firebaseInitialized) {
    throw new Error('Firebase not initialized. Call initializeFirebase() first.');
  }
  return auth;
};

const getDbInstance = () => {
  if (!firebaseInitialized) {
    throw new Error('Firebase not initialized. Call initializeFirebase() first.');
  }
  return db;
};

const getFunctionsInstance = () => {
  if (!firebaseInitialized) {
    throw new Error('Firebase not initialized. Call initializeFirebase() first.');
  }
  return functions;
};

const getStorageInstance = () => {
  if (!firebaseInitialized) {
    throw new Error('Firebase not initialized. Call initializeFirebase() first.');
  }
  return storage;
};

// Initialize Firebase immediately when this module is loaded
console.log('🔥 Starting Firebase initialization...');
initializeFirebase().catch(error => {
  console.error('❌ Failed to initialize Firebase:', error);
});

// Export initialized services and utilities
export {
  // Pre-initialized service instances (available after initializeFirebase completes)
  app,
  auth, 
  db,
  functions,
  storage,
  
  // Main services
  getFirebaseServices,
  initializeFirebase,
  
  // Utility functions
  isFirebaseReady,
  getInitializationStatus,
  isDevelopment,
  
  // Individual service getters (with error checking)
  getAppInstance,
  getAuthInstance,
  getDbInstance,
  getFunctionsInstance,
  getStorageInstance
}; 