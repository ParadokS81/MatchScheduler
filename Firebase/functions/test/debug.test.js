const admin = require('firebase-admin');

describe('Debug admin.firestore', () => {
  it('should show admin.firestore structure', () => {
    console.log('In test - Type of admin.firestore:', typeof admin.firestore);
    console.log('In test - admin.firestore.FieldValue exists?', !!admin.firestore.FieldValue);
    
    try {
      const { FieldValue } = admin.firestore;
      console.log('In test - Destructuring succeeded');
    } catch (e) {
      console.log('In test - Destructuring failed:', e.message);
    }
  });
}); 