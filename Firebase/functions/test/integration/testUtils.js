const admin = require('firebase-admin');
const test = require('firebase-functions-test')();

// Initialize admin with emulator settings
process.env.FIRESTORE_EMULATOR_HOST = 'localhost:8080';
process.env.FIREBASE_AUTH_EMULATOR_HOST = 'localhost:9099';

if (!admin.apps.length) {
  admin.initializeApp({
    projectId: 'test-project'
  });
}

const db = admin.firestore();
const auth = admin.auth();

// Helper to create test users with profiles
async function createTestUser(email, displayName, initials) {
  // Create auth user
  const userRecord = await auth.createUser({
    email,
    password: 'testpass123',
    displayName: displayName || email.split('@')[0]
  });
  
  // Create user profile in Firestore
  await db.collection('users').doc(userRecord.uid).set({
    userId: userRecord.uid,
    displayName: displayName || email.split('@')[0],
    initials: initials || 'TST',
    teams: [],
    createdAt: admin.firestore.FieldValue.serverTimestamp()
  });
  
  return userRecord;
}

// Helper to clean up all test data
async function cleanupTestData() {
  // Delete all users from Auth
  try {
    const listUsersResult = await auth.listUsers();
    const deletePromises = listUsersResult.users.map(user => 
      auth.deleteUser(user.uid).catch(() => {})
    );
    await Promise.all(deletePromises);
  } catch (error) {
    console.log('Error cleaning auth users:', error.message);
  }
  
  // Delete all documents from Firestore collections
  const collections = ['users', 'teams', 'availability'];
  
  for (const collectionName of collections) {
    try {
      const snapshot = await db.collection(collectionName).get();
      const batch = db.batch();
      snapshot.docs.forEach(doc => batch.delete(doc.ref));
      if (!snapshot.empty) {
        await batch.commit();
      }
    } catch (error) {
      console.log(`Error cleaning ${collectionName}:`, error.message);
    }
  }
}

// Helper to get auth context for a user
function getContext(userRecord) {
  return {
    auth: {
      uid: userRecord.uid,
      token: {
        email: userRecord.email
      }
    }
  };
}

module.exports = {
  admin,
  db,
  auth,
  test,
  createTestUser,
  cleanupTestData,
  getContext
}; 