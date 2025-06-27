const functions = require('firebase-functions');
const admin = require('firebase-admin');

exports.debugFieldValue = functions.https.onCall(async (data, context) => {
  console.log('Type of admin.firestore:', typeof admin.firestore);
  console.log('Type of admin.firestore():', typeof admin.firestore());
  console.log('Keys of admin.firestore:', Object.keys(admin.firestore));
  console.log('admin.firestore.FieldValue exists?', !!admin.firestore.FieldValue);
  console.log('admin.firestore().FieldValue exists?', !!admin.firestore().FieldValue);
  
  try {
    const { FieldValue } = admin.firestore;
    console.log('Destructuring succeeded, FieldValue type:', typeof FieldValue);
  } catch (e) {
    console.log('Destructuring failed:', e.message);
  }
  
  return { debug: 'complete' };
}); 