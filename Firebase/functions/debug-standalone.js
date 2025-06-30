const admin = require('firebase-admin');

// Initialize admin first
admin.initializeApp({
  projectId: 'matchscheduler-dev'
});

console.log('=== STANDALONE DEBUG ===');
console.log('Type of admin.firestore:', typeof admin.firestore);
console.log('Type of admin.firestore():', typeof admin.firestore());
console.log('Keys of admin.firestore:', Object.keys(admin.firestore));
console.log('admin.firestore.FieldValue exists?', !!admin.firestore.FieldValue);
console.log('admin.firestore().FieldValue exists?', !!admin.firestore().FieldValue);

try {
  const { FieldValue } = admin.firestore;
  console.log('Destructuring succeeded, FieldValue type:', typeof FieldValue);
  console.log('FieldValue:', FieldValue);
} catch (e) {
  console.log('Destructuring failed:', e.message);
}

// Also check if FieldValue is available through the Firestore instance
const db = admin.firestore();
console.log('\n=== Checking Firestore instance ===');
console.log('db.FieldValue exists?', !!db.FieldValue);
console.log('Type of admin.firestore.FieldValue:', typeof admin.firestore.FieldValue);
console.log('Type of admin.firestore().FieldValue:', typeof admin.firestore().FieldValue); 