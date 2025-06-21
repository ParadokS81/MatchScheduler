// teams.test.js - Tests for teams module
// TODO: Implement tests according to Technical PRD Section 7

const { createTeam } = require('../src/teams/create');
const { joinTeam } = require('../src/teams/join');
const { leaveTeam } = require('../src/teams/leave');

// Mock setup
const mockGet = jest.fn();
const mockSet = jest.fn();
const mockUpdate = jest.fn();
const mockWhere = jest.fn();
const mockCollection = jest.fn();
const mockDoc = jest.fn();

const mockTransaction = {
  get: jest.fn(),
  set: jest.fn(),
  update: jest.fn()
};

// Mock firebase-admin
jest.mock('firebase-admin', () => {
  // Create Firestore instance inside the mock factory
  const mockFirestore = {
    collection: mockCollection,
    runTransaction: jest.fn(async (callback) => {
      return await callback(mockTransaction);
    }),
    FieldValue: {
      serverTimestamp: () => 'SERVER_TIMESTAMP',
      arrayUnion: (...elements) => ({ __type: 'arrayUnion', elements }),
      arrayRemove: (...elements) => ({ __type: 'arrayRemove', elements })
    }
  };

  return {
    firestore: jest.fn(() => mockFirestore),
    initializeApp: jest.fn()
  };
});

// Mock firebase-functions
jest.mock('firebase-functions', () => ({
  https: {
    HttpsError: jest.fn((code, msg) => ({ code, msg })),
    onCall: (handler) => handler
  }
}));

// Helper functions for creating consistent test data
const mockUser = (overrides = {}) => ({
  uid: 'test-user-id',
  displayName: 'Test User',
  initials: 'TU',
  teams: [],
  ...overrides
});

const mockTeam = (overrides = {}) => ({
  teamId: 'test-team-id',
  teamName: 'Test Team',
  leaderId: 'test-user-id',
  joinCode: 'ABC123',
  status: 'active',
  maxPlayers: 10,
  divisions: ['1'],
  playerRoster: [],
  ...overrides
});

describe('Team Management Functions', () => {
  // Setup and teardown
  beforeEach(() => {
    jest.clearAllMocks();
    mockGet.mockReset();
    mockSet.mockReset();
    mockUpdate.mockReset();
    mockWhere.mockReset();
    mockCollection.mockReset();
    mockDoc.mockReset();
    mockTransaction.get.mockReset();
    mockTransaction.set.mockReset();
    mockTransaction.update.mockReset();

    // Setup collection/doc chain
    mockCollection.mockImplementation((collectionName) => {
      const collectionObj = {
        doc: mockDoc,
        where: mockWhere
      };
      return collectionObj;
    });

    mockDoc.mockImplementation((docId) => ({
      get: mockGet,
      set: mockSet,
      update: mockUpdate,
      id: docId || 'test-doc-id',
      path: `collection/${docId || 'test-doc-id'}`
    }));

    // Setup where chain
    mockWhere.mockImplementation((field, op, value) => ({
      where: mockWhere,
      get: () => Promise.resolve({ empty: true, docs: [] })
    }));

    // Setup default transaction.get response
    mockTransaction.get.mockImplementation((docRef) => {
      if (docRef.where) {
        // Handle query in transaction
        return Promise.resolve({
          empty: true,
          docs: []
        });
      }
      // Handle single doc get in transaction
      return Promise.resolve({
        exists: true,
        data: () => ({}),
        ref: docRef
      });
    });
  });

  describe('createTeam', () => {
    it('successfully creates team with valid data', async () => {
      const userData = mockUser();
      const context = { auth: { uid: userData.uid } };
      const data = {
        teamName: 'New Team',
        divisions: ['1', '2']
      };

      // Mock user lookup
      mockGet.mockResolvedValueOnce({
        exists: true,
        data: () => userData,
        ref: mockDoc(userData.uid)
      });

      // Mock team name uniqueness check
      mockWhere.mockImplementation((field, op, value) => ({
        where: mockWhere,
        get: () => Promise.resolve({ empty: true, docs: [] })
      }));

      // Mock transaction operations
      mockTransaction.get.mockImplementation((query) => {
        if (query.where) {
          // Handle team name/join code uniqueness checks
          return Promise.resolve({ empty: true, docs: [] });
        }
        return Promise.resolve({
          exists: true,
          data: () => userData,
          ref: mockDoc(userData.uid)
        });
      });

      const result = await createTeam(data, context);

      expect(result.success).toBe(true);
      expect(result.data).toHaveProperty('teamId');
      expect(result.data).toHaveProperty('teamName', 'New Team');
      expect(result.data).toHaveProperty('joinCode');
      
      // Verify collection/doc chain was called correctly
      expect(mockCollection).toHaveBeenCalledWith('teams');
      expect(mockCollection).toHaveBeenCalledWith('users');
      expect(mockDoc).toHaveBeenCalled();
      
      // Verify transaction operations
      expect(mockTransaction.set).toHaveBeenCalled();
      expect(mockTransaction.update).toHaveBeenCalled();
    });

    it('rejects unauthenticated user', async () => {
      const context = { auth: null };
      const data = { teamName: 'New Team', divisions: ['1'] };

      await expect(createTeam(data, context))
        .rejects
        .toMatchObject({
          code: 'unauthenticated'
        });
    });

    it('rejects user without profile', async () => {
      const context = { auth: { uid: 'test-user-id' } };
      const data = { teamName: 'New Team', divisions: ['1'] };

      mockGet.mockResolvedValueOnce({
        exists: false
      });

      await expect(createTeam(data, context))
        .rejects
        .toMatchObject({
          code: 'failed-precondition',
          msg: 'You must complete your profile before creating a team.'
        });
    });

    it('rejects user with 2 teams already', async () => {
      const userData = mockUser({ teams: ['team1', 'team2'] });
      const context = { auth: { uid: userData.uid } };
      const data = { teamName: 'New Team', divisions: ['1'] };

      mockGet.mockResolvedValueOnce({
        exists: true,
        data: () => userData
      });

      await expect(createTeam(data, context))
        .rejects
        .toMatchObject({
          code: 'failed-precondition',
          msg: 'You can only be a member of up to 2 teams.'
        });
    });

    it('validates team name length', async () => {
      const context = { auth: { uid: 'test-user-id' } };
      
      // Too short
      await expect(createTeam({ teamName: 'AB', divisions: ['1'] }, context))
        .rejects
        .toMatchObject({
          code: 'invalid-argument',
          msg: 'Team name must be between 3 and 25 characters.'
        });

      // Too long
      await expect(createTeam({ teamName: 'A'.repeat(26), divisions: ['1'] }, context))
        .rejects
        .toMatchObject({
          code: 'invalid-argument',
          msg: 'Team name must be between 3 and 25 characters.'
        });
    });

    it('validates team name characters', async () => {
      const context = { auth: { uid: 'test-user-id' } };
      const data = { teamName: 'Invalid@Name!', divisions: ['1'] };

      await expect(createTeam(data, context))
        .rejects
        .toMatchObject({
          code: 'invalid-argument',
          msg: 'Team name can only contain letters, numbers, spaces, dashes, and underscores.'
        });
    });

    it('validates divisions array', async () => {
      const context = { auth: { uid: 'test-user-id' } };
      
      // Empty array
      await expect(createTeam({ teamName: 'Valid Team', divisions: [] }, context))
        .rejects
        .toMatchObject({
          code: 'invalid-argument',
          msg: 'You must select at least one valid division (1, 2, or 3).'
        });

      // Invalid division
      await expect(createTeam({ teamName: 'Valid Team', divisions: ['4'] }, context))
        .rejects
        .toMatchObject({
          code: 'invalid-argument',
          msg: 'You must select at least one valid division (1, 2, or 3).'
        });
    });

    it('rejects duplicate team names', async () => {
      const userData = mockUser();
      const context = { auth: { uid: userData.uid } };
      const data = { teamName: 'Existing Team', divisions: ['1'] };

      mockGet.mockResolvedValueOnce({
        exists: true,
        data: () => userData
      });

      mockWhere.mockImplementation(() => ({
        where: mockWhere,
        get: () => Promise.resolve({
          empty: false,
          docs: [{ data: () => mockTeam() }]
        })
      }));

      await expect(createTeam(data, context))
        .rejects
        .toMatchObject({
          code: 'already-exists',
          msg: 'A team with this name already exists.'
        });
    });
  });

  describe('joinTeam', () => {
    it('successfully joins team with valid code', async () => {
      const userData = mockUser();
      const teamData = mockTeam();
      const context = { auth: { uid: userData.uid } };
      const data = { joinCode: teamData.joinCode };

      mockGet.mockResolvedValueOnce({
        exists: true,
        data: () => userData,
        ref: { id: userData.uid }
      });

      mockTransaction.get.mockImplementation((ref) => {
        if (ref.path?.includes('users')) {
          return Promise.resolve({
            exists: true,
            data: () => userData,
            ref: { id: userData.uid }
          });
        }
        return Promise.resolve({
          empty: false,
          docs: [{
            exists: true,
            data: () => teamData,
            ref: { id: teamData.teamId }
          }]
        });
      });

      const result = await joinTeam(data, context);

      expect(result.success).toBe(true);
      expect(result.data).toHaveProperty('teamId', teamData.teamId);
      expect(result.data).toHaveProperty('teamName', teamData.teamName);
      expect(mockTransaction.update).toHaveBeenCalledTimes(2);
    });

    it('rejects if team is full', async () => {
      const userData = mockUser();
      const fullTeam = mockTeam({
        playerRoster: Array(10).fill({ userId: 'other-user' })
      });
      const context = { auth: { uid: userData.uid } };
      const data = { joinCode: fullTeam.joinCode };

      mockGet.mockResolvedValueOnce({
        exists: true,
        data: () => userData
      });

      mockTransaction.get.mockImplementation((ref) => {
        if (ref.path?.includes('users')) {
          return Promise.resolve({
            exists: true,
            data: () => userData
          });
        }
        return Promise.resolve({
          empty: false,
          docs: [{
            exists: true,
            data: () => fullTeam
          }]
        });
      });

      await expect(joinTeam(data, context))
        .rejects
        .toMatchObject({
          code: 'failed-precondition',
          msg: 'Team is full'
        });
    });

    it('join code is case-insensitive', async () => {
      const userData = mockUser();
      const teamData = mockTeam();
      const context = { auth: { uid: userData.uid } };
      const data = { joinCode: teamData.joinCode.toLowerCase() };

      mockGet.mockResolvedValueOnce({
        exists: true,
        data: () => userData
      });

      mockTransaction.get.mockImplementation((ref) => {
        if (ref.path?.includes('users')) {
          return Promise.resolve({
            exists: true,
            data: () => userData
          });
        }
        return Promise.resolve({
          empty: false,
          docs: [{
            exists: true,
            data: () => teamData
          }]
        });
      });

      const result = await joinTeam(data, context);
      expect(result.success).toBe(true);
    });
  });

  describe('leaveTeam', () => {
    it('successfully leaves team as member', async () => {
      const userData = mockUser({ teams: ['test-team-id'] });
      const teamData = mockTeam({
        playerRoster: [
          { userId: userData.uid, displayName: userData.displayName },
          { userId: 'other-user', displayName: 'Other User' }
        ]
      });
      const context = { auth: { uid: userData.uid } };
      const data = { teamId: teamData.teamId };

      mockGet.mockResolvedValueOnce({
        exists: true,
        data: () => teamData
      });

      mockTransaction.get.mockResolvedValueOnce({
        exists: true,
        data: () => teamData,
        ref: { id: teamData.teamId }
      });

      const result = await leaveTeam(data, context);

      expect(result.success).toBe(true);
      expect(result.data).toHaveProperty('teamId', teamData.teamId);
      expect(mockTransaction.update).toHaveBeenCalledTimes(2);
    });

    it('prevents team leader from leaving', async () => {
      const userData = mockUser();
      const teamData = mockTeam({ leaderId: userData.uid });
      const context = { auth: { uid: userData.uid } };
      const data = { teamId: teamData.teamId };

      mockGet.mockResolvedValueOnce({
        exists: true,
        data: () => teamData
      });

      mockTransaction.get.mockResolvedValueOnce({
        exists: true,
        data: () => teamData
      });

      await expect(leaveTeam(data, context))
        .rejects
        .toMatchObject({
          code: 'failed-precondition',
          msg: 'Team leader must transfer leadership before leaving'
        });
    });

    it('archives team when last member leaves', async () => {
      const userData = mockUser({ teams: ['test-team-id'] });
      const teamData = mockTeam({
        playerRoster: [
          { userId: userData.uid, displayName: userData.displayName }
        ]
      });
      const context = { auth: { uid: userData.uid } };
      const data = { teamId: teamData.teamId };

      mockGet.mockResolvedValueOnce({
        exists: true,
        data: () => teamData
      });

      mockTransaction.get.mockResolvedValueOnce({
        exists: true,
        data: () => teamData,
        ref: { id: teamData.teamId }
      });

      await leaveTeam(data, context);

      expect(mockTransaction.update).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          status: 'archived'
        })
      );
    });
  });

  describe('Integration Tests', () => {
    it('full lifecycle: create → join → leave', async () => {
      // Setup test data
      const leaderData = mockUser();
      const memberData = mockUser({
        uid: 'member-id',
        displayName: 'Team Member'
      });
      const context = { auth: { uid: leaderData.uid } };
      const memberContext = { auth: { uid: memberData.uid } };

      // Mock user profile lookups
      mockGet.mockImplementation((ref) => {
        if (ref.id === leaderData.uid) {
          return Promise.resolve({
            exists: true,
            data: () => leaderData,
            ref: { id: leaderData.uid }
          });
        }
        if (ref.id === memberData.uid) {
          return Promise.resolve({
            exists: true,
            data: () => memberData,
            ref: { id: memberData.uid }
          });
        }
        return Promise.resolve({ exists: false });
      });

      // 1. Create Team
      const createResult = await createTeam({
        teamName: 'Integration Test Team',
        divisions: ['1']
      }, context);

      expect(createResult.success).toBe(true);
      const { teamId, joinCode } = createResult.data;

      // Setup team data for subsequent operations
      const teamData = mockTeam({
        teamId,
        teamName: 'Integration Test Team',
        joinCode,
        leaderId: leaderData.uid,
        playerRoster: [{
          userId: leaderData.uid,
          displayName: leaderData.displayName,
          initials: leaderData.initials
        }]
      });

      // Mock team lookups for join/leave operations
      mockTransaction.get.mockImplementation((ref) => {
        if (ref.path?.includes('teams')) {
          if (ref.path?.includes('where')) {
            return Promise.resolve({
              empty: false,
              docs: [{
                exists: true,
                data: () => teamData,
                ref: { id: teamId }
              }]
            });
          }
          return Promise.resolve({
            exists: true,
            data: () => teamData,
            ref: { id: teamId }
          });
        }
        if (ref.path?.includes('users')) {
          if (ref.id === memberData.uid) {
            return Promise.resolve({
              exists: true,
              data: () => memberData,
              ref: { id: memberData.uid }
            });
          }
        }
        return Promise.resolve({
          exists: true,
          data: () => ({}),
          ref: { id: 'unknown' }
        });
      });

      // 2. Member Joins Team
      const joinResult = await joinTeam({ joinCode }, memberContext);
      expect(joinResult.success).toBe(true);
      expect(joinResult.data.teamId).toBe(teamId);

      // 3. Member Leaves Team
      const leaveResult = await leaveTeam({ teamId }, memberContext);
      expect(leaveResult.success).toBe(true);
      expect(leaveResult.data.teamId).toBe(teamId);
    });

    it('enforces maximum 2 teams per user', async () => {
      const userData = mockUser({
        teams: ['team1', 'team2']
      });
      const context = { auth: { uid: userData.uid } };

      // Try to create a third team
      mockGet.mockResolvedValueOnce({
        exists: true,
        data: () => userData
      });

      await expect(createTeam({
        teamName: 'Third Team',
        divisions: ['1']
      }, context))
        .rejects
        .toMatchObject({
          code: 'failed-precondition',
          msg: 'You can only be a member of up to 2 teams.'
        });

      // Try to join a third team
      mockGet.mockResolvedValueOnce({
        exists: true,
        data: () => userData
      });

      await expect(joinTeam({
        joinCode: 'ABC123'
      }, context))
        .rejects
        .toMatchObject({
          code: 'failed-precondition',
          msg: 'Maximum 2 teams per user'
        });
    });
  });
}); 