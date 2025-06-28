const { initializeTestEnvironment, assertSucceeds, assertFails } = require('@firebase/rules-unit-testing');
const { readFileSync } = require('fs');

describe('Debug Rules Evaluation', () => {
  let testEnv;
  let db;

  beforeAll(async () => {
    // Initialize test environment with actual rules
    testEnv = await initializeTestEnvironment({
      projectId: 'quakeworld-match-scheduler',
      firestore: {
        rules: readFileSync('../firestore.rules', 'utf8')
      }
    });
    
    db = testEnv.unauthenticatedContext().firestore();
  });

  afterAll(async () => {
    await testEnv.cleanup();
  });

  it('should debug user update rule evaluation', async () => {
    const testUserId = 'debug-user-123';
    
    console.log('Creating user document...');
    // Create user document first
    await db.collection('users').doc(testUserId).set({
      userId: testUserId,
      displayName: 'Debug User',
      initials: 'DBG',
      teams: [],
      createdAt: new Date()
    });

    console.log('Waiting for document to persist...');
    await new Promise(resolve => setTimeout(resolve, 1000));

    // Verify document exists
    const snapshot = await db.collection('users').doc(testUserId).get();
    console.log('Document exists:', snapshot.exists);
    if (snapshot.exists) {
      console.log('Document data:', snapshot.data());
    }

    // Now try authenticated update
    const authenticatedDb = testEnv.authenticatedContext(testUserId).firestore();
    
    console.log('Attempting authenticated update...');
    try {
      await assertSucceeds(
        authenticatedDb.collection('users').doc(testUserId).update({
          displayName: 'Updated Debug User'
        })
      );
      console.log('✅ User update succeeded');
    } catch (error) {
      console.log('❌ User update failed:', error.message);
      console.log('Error code:', error.code);
      console.log('Full error details:', JSON.stringify(error, null, 2));
    }
  });

  it('should debug team update rule evaluation', async () => {
    const leaderId = 'debug-leader-123';
    const teamId = 'debug-team-123';
    
    console.log('Creating user document...');
    // Create user document first
    await db.collection('users').doc(leaderId).set({
      userId: leaderId,
      displayName: 'Debug Leader',
      initials: 'DL',
      teams: [teamId],
      createdAt: new Date()
    });

    console.log('Creating team document...');
    // Create team document
    await db.collection('teams').doc(teamId).set({
      teamId: teamId,
      teamName: 'Debug Team',
      leaderId: leaderId,
      playerRoster: [{
        userId: leaderId,
        displayName: 'Debug Leader',
        initials: 'DL'
      }],
      maxPlayers: 4,
      active: true,
      createdAt: new Date()
    });

    console.log('Waiting for documents to persist...');
    await new Promise(resolve => setTimeout(resolve, 1000));

    // Verify documents exist
    const userSnapshot = await db.collection('users').doc(leaderId).get();
    const teamSnapshot = await db.collection('teams').doc(teamId).get();
    console.log('User document exists:', userSnapshot.exists);
    console.log('Team document exists:', teamSnapshot.exists);
    
    if (teamSnapshot.exists) {
      console.log('Team data:', teamSnapshot.data());
    }

    // Now try authenticated update
    const authenticatedDb = testEnv.authenticatedContext(leaderId).firestore();
    
    console.log('Attempting authenticated team update...');
    try {
      await assertSucceeds(
        authenticatedDb.collection('teams').doc(teamId).update({
          teamName: 'Updated Debug Team'
        })
      );
      console.log('✅ Team update succeeded');
    } catch (error) {
      console.log('❌ Team update failed:', error.message);
      console.log('Error code:', error.code);
      console.log('Full error details:', JSON.stringify(error, null, 2));
    }
  });

  it('should debug rule access patterns', async () => {
    const testUserId = 'access-test-123';
    
    console.log('Testing direct admin access...');
    // Create with admin access
    await db.collection('users').doc(testUserId).set({
      userId: testUserId,
      displayName: 'Access Test User',
      initials: 'ATU',
      teams: [],
      createdAt: new Date()
    });

    // Wait and verify
    await new Promise(resolve => setTimeout(resolve, 500));
    const adminSnapshot = await db.collection('users').doc(testUserId).get();
    console.log('Admin can read:', adminSnapshot.exists);

    console.log('Testing authenticated access...');
    const authenticatedDb = testEnv.authenticatedContext(testUserId).firestore();
    
    try {
      const authSnapshot = await authenticatedDb.collection('users').doc(testUserId).get();
      console.log('Authenticated can read:', authSnapshot.exists);
      
      if (authSnapshot.exists) {
        console.log('Authenticated read data:', authSnapshot.data());
      }
    } catch (error) {
      console.log('❌ Authenticated read failed:', error.message);
    }

    console.log('Testing update with proper setup...');
    try {
      await assertSucceeds(
        authenticatedDb.collection('users').doc(testUserId).update({
          displayName: 'Updated Access Test User'
        })
      );
      console.log('✅ Update with proper setup succeeded');
    } catch (error) {
      console.log('❌ Update with proper setup failed:', error.message);
      console.log('Error details:', error);
    }
  });
}); 