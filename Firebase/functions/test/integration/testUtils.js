const admin = require('firebase-admin');
const functions = require('firebase-functions-test')();
const fetch = require('node-fetch');
const { createProfile: createProfileFn } = require('../../src/auth/profile');

// Initialize admin with emulator settings
process.env.FIRESTORE_EMULATOR_HOST = 'localhost:8080';
process.env.FIREBASE_AUTH_EMULATOR_HOST = 'localhost:9099';

if (!admin.apps.length) {
  admin.initializeApp({
    projectId: 'quakeworld-match-scheduler'
  });
}

const db = admin.firestore();
const auth = admin.auth();

// Wrap the createProfile function
const wrappedCreateProfile = functions.wrap(createProfileFn);

// Keep track of created test users for cleanup
const testUsers = new Set();

async function createTestUser(email, displayName, initials) {
  try {
    // Step 1: Create the user in the Auth Emulator
    const userRecord = await auth.createUser({
      email: `test-${Math.random().toString(36).substring(2)}@example.com`,
      password: 'password123',
      displayName: displayName
    });

    // Step 2: Create the corresponding profile in Firestore
    await wrappedCreateProfile({
      displayName: displayName,
      initials: initials
    }, { auth: { uid: userRecord.uid } });

    // Add user to the set for cleanup
    testUsers.add(userRecord.uid);

    return userRecord;
  } catch (error) {
    console.error(`Error creating complete test user for ${displayName}:`, error);
    throw error;
  }
}

async function cleanupTestData() {
  console.log('\n=== STARTING CLEANUP ===');
  console.log(`Time: ${new Date().toISOString()}`);
  
  try {
    // First, delete all test users from Auth emulator
    console.log(`\n1. AUTH CLEANUP: ${testUsers.size} users to delete`);
    
    let authDeleteCount = 0;
    for (const uid of testUsers) {
      try {
        await auth.deleteUser(uid);
        authDeleteCount++;
        console.log(`   ✓ Deleted auth user: ${uid}`);
      } catch (error) {
        console.warn(`   ✗ Failed to delete auth user ${uid}:`, error.message);
      }
    }
    console.log(`   Summary: Deleted ${authDeleteCount}/${testUsers.size} auth users`);
    testUsers.clear();

    // Also try to list and delete ALL users in auth emulator
    console.log('\n2. CHECKING FOR ORPHANED AUTH USERS...');
    try {
      const listResult = await auth.listUsers(1000);
      console.log(`   Found ${listResult.users.length} total users in Auth emulator`);
      
      for (const user of listResult.users) {
        try {
          await auth.deleteUser(user.uid);
          console.log(`   ✓ Deleted orphaned user: ${user.uid} (${user.email})`);
        } catch (error) {
          console.warn(`   ✗ Failed to delete orphaned user ${user.uid}:`, error.message);
        }
      }
    } catch (error) {
      console.warn('   Could not list auth users:', error.message);
    }

    // Clear all Firestore data using the emulator REST API
    console.log('\n3. FIRESTORE CLEANUP...');
    const projectId = 'quakeworld-match-scheduler';
    const firestoreHost = process.env.FIRESTORE_EMULATOR_HOST || 'localhost:8080';
    const url = `http://${firestoreHost}/emulator/v1/projects/${projectId}/databases/(default)/documents`;

    console.log(`   Clearing Firestore at: ${url}`);
    const response = await fetch(url, { method: 'DELETE' });
    
    if (!response.ok) {
      const errorBody = await response.text();
      console.error(`   ✗ Firestore clear failed: ${response.status} ${response.statusText}`);
      console.error(`   Error body: ${errorBody}`);
      throw new Error('Failed to clear Firestore emulator data');
    }
    
    console.log('   ✓ Firestore cleared successfully');
    console.log('\n=== CLEANUP COMPLETE ===\n');
    
  } catch (error) {
    console.error('\n!!! CLEANUP FAILED !!!');
    console.error('Error:', error);
    console.error('Stack:', error.stack);
    throw error;
  }
}

function getContext(user) {
  return {
    auth: {
      uid: user.uid,
      token: {
        email: user.email,
        name: user.displayName
      }
    }
  };
}

module.exports = {
  db,
  auth,
  test: functions,
  createTestUser,
  cleanupTestData,
  getContext,
  testUsers
}; 