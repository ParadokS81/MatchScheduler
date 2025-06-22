const { db } = require('./testUtils');

describe('Basic Emulator Connection Test', () => {
  it('should connect to Firestore and write a document', async () => {
    // Set a timeout to prevent false failures, just in case.
    jest.setTimeout(10000); 
    
    const testDocRef = db.collection('test-connection').doc('test-doc');
    
    // 1. Write to the database
    await testDocRef.set({ status: 'ok' });
    
    // 2. Read the data back
    const doc = await testDocRef.get();
    
    // 3. Check if it worked
    expect(doc.exists).toBe(true);
    expect(doc.data().status).toBe('ok');
  });
}); 