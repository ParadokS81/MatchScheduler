const { db, auth, test, cleanupTestData, testUsers } = require('./testUtils');
const { createProfile: createProfileFn, updateProfile: updateProfileFn } = require('../../src/auth/profile');

// Wrap functions in test environment
const createProfile = test.wrap(createProfileFn);
const updateProfile = test.wrap(updateProfileFn);

describe('Auth/Profile Integration Tests', () => {
  let testUser;
  
  beforeEach(async () => {
    await cleanupTestData();

    // Create auth user without profile - use unique UID each time
    testUser = await auth.createUser({
      uid: `test-user-${Date.now()}-${Math.random().toString(36).substring(2)}`,
      email: `test-${Date.now()}@example.com`
    });
    
    // Track this user for cleanup
    testUsers.add(testUser.uid);
  });
  
  afterEach(async () => {
    await cleanupTestData();
  });

  afterAll(async () => {
    await cleanupTestData();
    test.cleanup();
  });

  describe('createProfile', () => {
    it('should create profile with all fields', async () => {
      const result = await createProfile({
        displayName: 'Test User',
        initials: 'TST',
        discordUsername: 'TestUser#1234'
      }, {
        auth: {
          uid: testUser.uid,
          token: { picture: 'https://example.com/photo.jpg' }
        }
      });

      expect(result.success).toBe(true);
      expect(result.data.displayName).toBe('Test User');
      expect(result.data.initials).toBe('TST');
      
      // Verify in database
      const doc = await db.collection('users').doc(testUser.uid).get();
      expect(doc.exists).toBe(true);
      expect(doc.data().displayName).toBe('Test User');
      expect(doc.data().discordUsername).toBe('TestUser#1234');
      expect(doc.data().photoURL).toBe('https://example.com/photo.jpg');
    });

    it('should create profile without optional fields', async () => {
      const result = await createProfile({
        displayName: 'Test User',
        initials: 'TST'
      }, {
        auth: { uid: testUser.uid, token: {} }
      });

      expect(result.success).toBe(true);
      expect(result.data.discordUsername).toBeUndefined();
      expect(result.data.photoURL).toBeUndefined();
    });

    it('should reject duplicate profile creation', async () => {
      // Create first profile
      await createProfile({
        displayName: 'Test User',
        initials: 'TST'
      }, {
        auth: { uid: testUser.uid, token: {} }
      });

      // Try to create again
      await expect(
        createProfile({
          displayName: 'Test User 2',
          initials: 'TS2'
        }, {
          auth: { uid: testUser.uid, token: {} }
        })
      ).rejects.toThrow('Profile already exists');
    });

    it('should validate display name', async () => {
      await expect(
        createProfile({
          displayName: 'A', // Too short
          initials: 'TST'
        }, {
          auth: { uid: testUser.uid, token: {} }
        })
      ).rejects.toThrow('Display name must be 2-20 characters');

      await expect(
        createProfile({
          displayName: 'Test User!@#', // Invalid characters
          initials: 'TST'
        }, {
          auth: { uid: testUser.uid, token: {} }
        })
      ).rejects.toThrow('Display name must be alphanumeric with spaces only');
    });

    it('should validate initials', async () => {
      await expect(
        createProfile({
          displayName: 'Test User',
          initials: 'TS' // Too short
        }, {
          auth: { uid: testUser.uid, token: {} }
        })
      ).rejects.toThrow('Initials must be exactly 3 characters');
    });
  });

  describe('updateProfile', () => {
    beforeEach(async () => {
      // Create a profile to update
      await db.collection('users').doc(testUser.uid).set({
        userId: testUser.uid,
        displayName: 'Original Name',
        initials: 'ORI',
        teams: [],
        createdAt: new Date()
      });
    });

    it('should update display name only', async () => {
      const result = await updateProfile({
        displayName: 'New Name'
      }, {
        auth: { uid: testUser.uid }
      });

      expect(result.success).toBe(true);
      expect(result.data.displayName).toBe('New Name');
      
      const doc = await db.collection('users').doc(testUser.uid).get();
      expect(doc.data().displayName).toBe('New Name');
      expect(doc.data().initials).toBe('ORI'); // Unchanged
    });

    it('should update multiple fields', async () => {
      const result = await updateProfile({
        displayName: 'New Name',
        initials: 'NEW',
        discordUsername: 'NewUser#5678'
      }, {
        auth: { uid: testUser.uid }
      });

      expect(result.success).toBe(true);
      expect(result.data.displayName).toBe('New Name');
      expect(result.data.initials).toBe('NEW');
      expect(result.data.discordUsername).toBe('NewUser#5678');
    });

    it('should reject if no updates provided', async () => {
      await expect(
        updateProfile({}, {
          auth: { uid: testUser.uid }
        })
      ).rejects.toThrow('No updates provided');
    });

    it('should handle initials conflicts in teams', async () => {
      // Create a team with another user
      const otherTeamId = 'test-team-123';
      await db.collection('teams').doc(otherTeamId).set({
        teamId: otherTeamId,
        teamName: 'Test Team',
        playerRoster: [
          {
            userId: 'other-user',
            displayName: 'Other User',
            initials: 'NEW' // Conflicting initials
          },
          {
            userId: testUser.uid,
            displayName: 'Original Name',
            initials: 'ORI'
          }
        ]
      });

      // Update user's teams array
      await db.collection('users').doc(testUser.uid).update({
        teams: [otherTeamId]
      });

      // Try to update to conflicting initials
      await expect(
        updateProfile({
          initials: 'NEW'
        }, {
          auth: { uid: testUser.uid }
        })
      ).rejects.toThrow('already taken by another player');
    });
  });
}); 