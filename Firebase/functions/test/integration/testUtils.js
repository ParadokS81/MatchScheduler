const admin = require('firebase-admin');
const functions = require('firebase-functions-test')();
const fetch = require('node-fetch');
const { createProfile: createProfileFn } = require('../../src/auth/profile');

// Initialize admin with live Firebase settings
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.applicationDefault(),
    projectId: process.env.FIREBASE_PROJECT_ID
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

    // Clear all Firestore collections (live Firebase)
    console.log('\n3. FIRESTORE CLEANUP...');
    
    // Delete all documents in main collections
    const collections = ['users', 'teams', 'availability'];
    let totalDeleted = 0;
    
    for (const collectionName of collections) {
      console.log(`   Cleaning collection: ${collectionName}`);
      const snapshot = await db.collection(collectionName).get();
      
      if (!snapshot.empty) {
        const batch = db.batch();
        snapshot.docs.forEach(doc => {
          batch.delete(doc.ref);
        });
        
        await batch.commit();
        console.log(`   ✓ Deleted ${snapshot.docs.length} documents from ${collectionName}`);
        totalDeleted += snapshot.docs.length;
      } else {
        console.log(`   ✓ Collection ${collectionName} already empty`);
      }
    }
    
    console.log(`   ✓ Firestore cleanup complete - ${totalDeleted} documents deleted`);
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