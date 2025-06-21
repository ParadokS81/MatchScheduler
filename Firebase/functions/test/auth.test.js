// auth.test.js - Tests for auth module
// TODO: Implement tests according to Technical PRD Section 7

const test = require('firebase-functions-test')();

// Mock admin
const admin = require('firebase-admin');

// Create mock functions
const mockGet = jest.fn();
const mockSet = jest.fn();
const mockUpdate = jest.fn();
const mockDoc = jest.fn();
const mockCollection = jest.fn();
const mockTransaction = {
  get: jest.fn(),
  update: jest.fn()
};
const mockRunTransaction = jest.fn();

// Setup the mock returns
mockDoc.mockReturnValue({
  get: mockGet,
  set: mockSet,
  update: mockUpdate
});

mockCollection.mockReturnValue({
  doc: mockDoc
});

// Mock firestore
jest.spyOn(admin, 'firestore', 'get').mockReturnValue(() => ({
  collection: mockCollection,
  runTransaction: mockRunTransaction
}));

// Mock FieldValue
admin.firestore.FieldValue = {
  serverTimestamp: jest.fn(() => 'SERVER_TIMESTAMP')
};

// Now require the functions AFTER setting up mocks
const { createProfile, updateProfile } = require('../src/auth/profile');
const { HttpsError } = require('firebase-functions/v1/auth');

// Common test data
const mockUserData = {
  userId: 'test-user-id',
  displayName: 'Old Name',
  initials: 'OLD',
  teams: ['team1', 'team2'],
  discordUsername: 'olduser#1234'
};

const mockContext = {
  auth: {
    uid: 'test-user-id',
    token: {}
  }
};

describe('Auth Module', () => {
  it('should be implemented', () => {
    // TODO: Add tests
  });
});

describe('createProfile', () => {
  let wrapped;
  
  beforeAll(() => {
    wrapped = test.wrap(createProfile);
  });
  
  beforeEach(() => {
    jest.clearAllMocks();
    mockGet.mockReset();
    mockSet.mockReset();
    mockUpdate.mockReset();
    mockRunTransaction.mockImplementation(callback => callback(mockTransaction));
  });
  
  afterAll(() => {
    test.cleanup();
  });
  
  // 1. Successful profile creation with all fields
  it('should create a profile with all fields successfully', async () => {
    mockGet.mockResolvedValue({ exists: false });
    mockSet.mockResolvedValue();
    
    const data = {
      displayName: 'John Doe',
      initials: 'JDO',
      discordUsername: 'JohnD#1234'
    };
    
    const context = {
      auth: {
        uid: 'test-user-id',
        token: {
          picture: 'https://example.com/photo.jpg'
        }
      }
    };
    
    const result = await wrapped(data, context);
    
    expect(result).toEqual({
      success: true,
      data: expect.objectContaining({
        userId: 'test-user-id',
        displayName: 'John Doe',
        initials: 'JDO',
        discordUsername: 'JohnD#1234',
        photoURL: 'https://example.com/photo.jpg',
        teams: [],
        savedTemplates: {},
        createdAt: 'SERVER_TIMESTAMP'
      }),
      message: 'Profile created successfully'
    });
    
    expect(mockCollection).toHaveBeenCalledWith('users');
    expect(mockDoc).toHaveBeenCalledWith('test-user-id');
    expect(mockSet).toHaveBeenCalledWith(expect.objectContaining({
      userId: 'test-user-id',
      displayName: 'John Doe',
      initials: 'JDO',
      discordUsername: 'JohnD#1234',
      photoURL: 'https://example.com/photo.jpg',
      teams: [],
      savedTemplates: {},
      createdAt: 'SERVER_TIMESTAMP'
    }));
  });
  
  // 2. Successful profile creation without optional discordUsername
  it('should create a profile without discord username', async () => {
    mockGet.mockResolvedValueOnce({ exists: false });
    
    const data = {
      displayName: 'John Doe',
      initials: 'JDO'
    };
    
    const context = {
      auth: {
        uid: 'test-user-id',
        token: {}
      }
    };
    
    const result = await wrapped(data, context);
    
    expect(result.success).toBe(true);
    expect(result.data.discordUsername).toBeUndefined();
    expect(result.data.createdAt).toBe('SERVER_TIMESTAMP');
    expect(mockSet).toHaveBeenCalledWith(expect.not.objectContaining({
      discordUsername: expect.anything()
    }));
  });
  
  // 3. Unauthenticated user rejection
  it('should reject unauthenticated users', async () => {
    const data = {
      displayName: 'John Doe',
      initials: 'JDO'
    };
    
    await expect(wrapped(data, { auth: null }))
      .rejects
      .toThrow(new HttpsError('unauthenticated', 'User must be logged in'));
    
    expect(mockSet).not.toHaveBeenCalled();
  });
  
  // 4. Invalid display name tests
  describe('display name validation', () => {
    const context = {
      auth: {
        uid: 'test-user-id',
        token: {}
      }
    };
    
    it('should reject too short display name', async () => {
      const data = {
        displayName: 'J',
        initials: 'JDO'
      };
      
      await expect(wrapped(data, context))
        .rejects
        .toThrow(new HttpsError('invalid-argument', 'Display name must be 2-20 characters'));
      
      expect(mockSet).not.toHaveBeenCalled();
    });
    
    it('should reject too long display name', async () => {
      const data = {
        displayName: 'J'.repeat(21),
        initials: 'JDO'
      };
      
      await expect(wrapped(data, context))
        .rejects
        .toThrow(new HttpsError('invalid-argument', 'Display name must be 2-20 characters'));
      
      expect(mockSet).not.toHaveBeenCalled();
    });
    
    it('should reject display name with invalid characters', async () => {
      const data = {
        displayName: 'John@Doe',
        initials: 'JDO'
      };
      
      await expect(wrapped(data, context))
        .rejects
        .toThrow(new HttpsError('invalid-argument', 'Display name must be alphanumeric with spaces only'));
      
      expect(mockSet).not.toHaveBeenCalled();
    });
  });
  
  // 5. Invalid initials tests
  describe('initials validation', () => {
    const context = {
      auth: {
        uid: 'test-user-id',
        token: {}
      }
    };
    
    it('should reject wrong length initials', async () => {
      const data = {
        displayName: 'John Doe',
        initials: 'JD'
      };
      
      await expect(wrapped(data, context))
        .rejects
        .toThrow(new HttpsError('invalid-argument', 'Initials must be exactly 3 characters'));
      
      expect(mockSet).not.toHaveBeenCalled();
    });
    
    it('should reject missing initials', async () => {
      const data = {
        displayName: 'John Doe'
      };
      
      await expect(wrapped(data, context))
        .rejects
        .toThrow(new HttpsError('invalid-argument', 'Initials must be provided'));
      
      expect(mockSet).not.toHaveBeenCalled();
    });
  });
  
  // 6. Profile already exists error
  it('should reject if profile already exists', async () => {
    mockGet.mockResolvedValue({ exists: true });
    
    const data = {
      displayName: 'John Doe',
      initials: 'JDO'
    };
    
    await expect(wrapped(data, mockContext))
      .rejects
      .toThrow(new HttpsError('already-exists', 'Profile already exists'));
    
    expect(mockSet).not.toHaveBeenCalled();
  });
  
  // 7. Database error handling
  it('should handle database errors gracefully', async () => {
    mockGet.mockRejectedValueOnce(new Error('Database connection failed'));
    
    const data = {
      displayName: 'John Doe',
      initials: 'JDO'
    };
    
    const context = {
      auth: {
        uid: 'test-user-id',
        token: {}
      }
    };
    
    await expect(wrapped(data, context))
      .rejects
      .toThrow(new HttpsError('internal', 'Failed to create profile'));
    
    expect(mockSet).not.toHaveBeenCalled();
  });
});

describe('updateProfile', () => {
  let wrapped;
  
  beforeAll(() => {
    wrapped = test.wrap(updateProfile);
  });
  
  beforeEach(() => {
    jest.clearAllMocks();
    mockGet.mockReset();
    mockSet.mockReset();
    mockUpdate.mockReset();
    mockTransaction.get.mockReset();
    mockTransaction.update.mockReset();
    
    // Default implementation for runTransaction
    mockRunTransaction.mockImplementation(async (callback) => {
      return await callback(mockTransaction);
    });
    
    // Setup default mock for transaction.get to return proper structure
    mockTransaction.get.mockImplementation(() => Promise.resolve({
      exists: true,
      data: () => ({
        teamName: 'Default Team',
        playerRoster: []
      })
    }));
  });
  
  afterAll(() => {
    test.cleanup();
  });
  
  // 1. Successful update of display name only
  it('should update display name only', async () => {
    const mockRef = { id: 'test-user-id' };
    mockGet.mockResolvedValue({
      exists: true,
      data: () => mockUserData,
      ref: mockRef
    });

    // Mock team data with empty roster (no conflicts needed for display name)
    mockTransaction.get.mockResolvedValue({
      exists: true,
      data: () => ({
        teamName: 'Team 1',
        playerRoster: []  // Empty array but defined
      }),
      ref: { id: 'team1' }
    });
    
    mockTransaction.update.mockResolvedValue();
    
    const data = {
      displayName: 'New Name'
    };
    
    const result = await wrapped(data, mockContext);
    
    expect(result).toEqual({
      success: true,
      data: {
        displayName: 'New Name',
        updatedAt: 'SERVER_TIMESTAMP'
      },
      message: 'Profile updated successfully'
    });
    
    expect(mockTransaction.update).toHaveBeenCalledWith(
      mockRef,
      expect.objectContaining({
        displayName: 'New Name',
        updatedAt: 'SERVER_TIMESTAMP'
      })
    );
  });
  
  // 2. Successful update of initials
  it('should update initials when no conflicts exist', async () => {
    const mockRef = { id: 'test-user-id' };
    mockGet.mockResolvedValue({
      exists: true,
      data: () => mockUserData,
      ref: mockRef
    });

    // Mock the collection calls for conflict checking
    mockCollection.mockImplementation((collectionName) => {
      if (collectionName === 'teams') {
        return {
          doc: jest.fn((teamId) => ({
            get: jest.fn().mockResolvedValue({
              exists: true,
              data: () => ({
                teamName: teamId === 'team1' ? 'Team 1' : 'Team 2',
                playerRoster: [
                  { userId: 'test-user-id', displayName: 'Old Name', initials: 'OLD' },
                  { userId: 'other-user', displayName: 'Other User', initials: 'OTH' }
                ]
              })
            })
          }))
        };
      }
      return { doc: mockDoc };
    });

    mockTransaction.update.mockResolvedValue();
    
    const data = {
      initials: 'NEW'
    };
    
    const result = await wrapped(data, mockContext);
    
    expect(result.success).toBe(true);
    expect(result.data.initials).toBe('NEW');
    expect(mockTransaction.update).toHaveBeenCalled();
  });
  
  // 3. Successful update of multiple fields
  it('should update multiple fields simultaneously', async () => {
    const mockRef = { id: 'test-user-id' };
    mockGet.mockResolvedValue({
      exists: true,
      data: () => mockUserData,
      ref: mockRef
    });

    // Mock the regular collection('teams') calls for conflict checking
    mockCollection.mockImplementation((collectionName) => {
      if (collectionName === 'teams') {
        return {
          doc: jest.fn((teamId) => ({
            get: jest.fn().mockResolvedValue({
              exists: true,
              data: () => ({
                teamName: teamId === 'team1' ? 'Team 1' : 'Team 2',
                playerRoster: [
                  { userId: 'test-user-id', displayName: 'Old Name', initials: 'OLD' },
                  { userId: 'other-user', displayName: 'Other User', initials: teamId === 'team1' ? 'OTH' : 'XYZ' }
                ]
              })
            })
          }))
        };
      }
      return { doc: mockDoc };
    });

    const mockTeam1Ref = { id: 'team1' };
    const mockTeam2Ref = { id: 'team2' };
    
    mockTransaction.get
      .mockResolvedValueOnce({
        exists: true,
        data: () => ({
          teamName: 'Team 1',
          playerRoster: [
            { userId: 'test-user-id', displayName: 'Old Name', initials: 'OLD' },
            { userId: 'other-user', displayName: 'Other User', initials: 'OTH' }
          ]
        }),
        ref: mockTeam1Ref
      })
      .mockResolvedValueOnce({
        exists: true,
        data: () => ({
          teamName: 'Team 2',
          playerRoster: [
            { userId: 'test-user-id', displayName: 'Old Name', initials: 'OLD' },
            { userId: 'other-user', displayName: 'Other User', initials: 'XYZ' }
          ]
        }),
        ref: mockTeam2Ref
      });

    mockTransaction.update.mockResolvedValue();
    
    const data = {
      displayName: 'New Name',
      initials: 'NEW',
      discordUsername: 'newuser#5678'
    };
    
    const result = await wrapped(data, mockContext);
    
    expect(result).toEqual({
      success: true,
      data: {
        displayName: 'New Name',
        initials: 'NEW',
        discordUsername: 'newuser#5678',
        updatedAt: 'SERVER_TIMESTAMP'
      },
      message: 'Profile updated successfully'
    });

    // Verify profile update
    expect(mockTransaction.update).toHaveBeenCalledWith(
      mockRef,
      expect.objectContaining({
        displayName: 'New Name',
        initials: 'NEW',
        discordUsername: 'newuser#5678',
        updatedAt: 'SERVER_TIMESTAMP'
      })
    );

    // Verify team roster updates
    expect(mockTransaction.update).toHaveBeenCalledWith(
      expect.objectContaining({ get: expect.any(Function) }),
      expect.objectContaining({
        playerRoster: [
          { userId: 'test-user-id', displayName: 'New Name', initials: 'NEW' },
          { userId: 'other-user', displayName: 'Other User', initials: 'OTH' }
        ],
        updatedAt: 'SERVER_TIMESTAMP'
      })
    );

    expect(mockTransaction.update).toHaveBeenCalledWith(
      expect.objectContaining({ get: expect.any(Function) }),
      expect.objectContaining({
        playerRoster: [
          { userId: 'test-user-id', displayName: 'New Name', initials: 'NEW' },
          { userId: 'other-user', displayName: 'Other User', initials: 'XYZ' }
        ],
        updatedAt: 'SERVER_TIMESTAMP'
      })
    );
  });
  
  // Validation Tests (4-8)
  describe('validation', () => {
    beforeEach(() => {
      // Setup valid profile for all validation tests
      mockGet.mockResolvedValue({
        exists: true,
        data: () => mockUserData,
        ref: { id: 'test-user-id' }
      });

      // Setup default team data for initials validation
      mockTransaction.get.mockResolvedValue({
        exists: true,
        data: () => ({
          teamName: 'Team 1',
          playerRoster: [
            { userId: 'test-user-id', displayName: 'Old Name', initials: 'OLD' },
            { userId: 'other-user', displayName: 'Other User', initials: 'OTH' }
          ]
        }),
        ref: { id: 'team1' }
      });
    });

    it('should reject too short display name', async () => {
      await expect(wrapped({ displayName: 'A' }, mockContext))
        .rejects
        .toThrow(new HttpsError('invalid-argument', 'Display name must be 2-20 characters'));
      
      expect(mockRunTransaction).not.toHaveBeenCalled();
    });

    it('should reject too long display name', async () => {
      await expect(wrapped({ displayName: 'A'.repeat(21) }, mockContext))
        .rejects
        .toThrow(new HttpsError('invalid-argument', 'Display name must be 2-20 characters'));
      
      expect(mockRunTransaction).not.toHaveBeenCalled();
    });

    it('should reject display name with invalid characters', async () => {
      await expect(wrapped({ displayName: 'Test@User' }, mockContext))
        .rejects
        .toThrow(new HttpsError('invalid-argument', 'Display name must be alphanumeric with spaces only'));
      
      expect(mockRunTransaction).not.toHaveBeenCalled();
    });

    it('should reject wrong length initials', async () => {
      await expect(wrapped({ initials: 'AB' }, mockContext))
        .rejects
        .toThrow(new HttpsError('invalid-argument', 'Initials must be exactly 3 characters'));
      
      expect(mockRunTransaction).not.toHaveBeenCalled();
    });

    it('should reject non-alphanumeric initials', async () => {
      await expect(wrapped({ initials: 'A@#' }, mockContext))
        .rejects
        .toThrow(new HttpsError('invalid-argument', 'Initials must be alphanumeric'));
      
      expect(mockRunTransaction).not.toHaveBeenCalled();
    });
  });
  
  // 9. Initials conflict test
  it('should reject when initials conflict within a team', async () => {
    const mockRef = { id: 'test-user-id' };
    mockGet.mockResolvedValue({
      exists: true,
      data: () => mockUserData,
      ref: mockRef
    });

    // Mock the regular collection('teams') calls for conflict checking
    mockCollection.mockImplementation((collectionName) => {
      if (collectionName === 'teams') {
        return {
          doc: jest.fn((teamId) => ({
            get: jest.fn().mockResolvedValue({
              exists: true,
              data: () => ({
                teamName: teamId === 'team1' ? 'Team 1' : 'Team 2',
                playerRoster: [
                  { userId: 'test-user-id', displayName: 'Old Name', initials: 'OLD' },
                  { userId: 'other-user', displayName: 'Other User', initials: 'NEW' }  // Conflict in both teams
                ]
              })
            })
          }))
        };
      }
      return { doc: mockDoc };
    });

    const mockTeam1Ref = { id: 'team1' };
    const mockTeam2Ref = { id: 'team2' };

    mockTransaction.get
      .mockResolvedValueOnce({
        exists: true,
        data: () => ({
          teamName: 'Team 1',
          playerRoster: [
            { userId: 'test-user-id', displayName: 'Old Name', initials: 'OLD' },
            { userId: 'other-user', displayName: 'Other User', initials: 'OTH' }
          ]
        }),
        ref: mockTeam1Ref
      })
      .mockResolvedValueOnce({
        exists: true,
        data: () => ({
          teamName: 'Team 2',
          playerRoster: [
            { userId: 'test-user-id', displayName: 'Old Name', initials: 'OLD' },
            { userId: 'other-user', displayName: 'Other User', initials: 'OTH' }
          ]
        }),
        ref: mockTeam2Ref
      });

    const data = {
      initials: 'NEW'  // Trying to use initials that another player has
    };

    await expect(wrapped(data, mockContext))
      .rejects
      .toThrow(new HttpsError('already-exists', 'Initials "NEW" already taken by another player on team Team 1'));

    expect(mockTransaction.update).not.toHaveBeenCalled();
  });
  
  // 10. Team roster updates
  it('should update team rosters when name/initials change', async () => {
    const mockRef = { id: 'test-user-id' };
    mockGet.mockResolvedValue({
      exists: true,
      data: () => mockUserData,
      ref: mockRef
    });

    // Mock the regular collection('teams') calls for conflict checking
    mockCollection.mockImplementation((collectionName) => {
      if (collectionName === 'teams') {
        return {
          doc: jest.fn((teamId) => ({
            get: jest.fn().mockResolvedValue({
              exists: true,
              data: () => ({
                teamName: teamId === 'team1' ? 'Team 1' : 'Team 2',
                playerRoster: [
                  { userId: 'test-user-id', displayName: 'Old Name', initials: 'OLD' },
                  { userId: 'other-user', displayName: 'Other User', initials: teamId === 'team1' ? 'OTH' : 'XYZ' }
                ]
              })
            })
          }))
        };
      }
      return { doc: mockDoc };
    });

    const mockTeam1Ref = { id: 'team1' };
    const mockTeam2Ref = { id: 'team2' };

    mockTransaction.get
      .mockResolvedValueOnce({
        exists: true,
        data: () => ({
          teamName: 'Team 1',
          playerRoster: [
            { userId: 'test-user-id', displayName: 'Old Name', initials: 'OLD' },
            { userId: 'other-user', displayName: 'Other User', initials: 'OTH' }
          ]
        }),
        ref: mockTeam1Ref
      })
      .mockResolvedValueOnce({
        exists: true,
        data: () => ({
          teamName: 'Team 2',
          playerRoster: [
            { userId: 'test-user-id', displayName: 'Old Name', initials: 'OLD' },
            { userId: 'other-user', displayName: 'Other User', initials: 'XYZ' }
          ]
        }),
        ref: mockTeam2Ref
      });

    mockTransaction.update.mockResolvedValue();

    const data = {
      displayName: 'New Name',
      initials: 'NEW'
    };

    await wrapped(data, mockContext);

    // Verify profile update
    expect(mockTransaction.update).toHaveBeenCalledWith(
      mockRef,
      expect.objectContaining({
        displayName: 'New Name',
        initials: 'NEW',
        updatedAt: 'SERVER_TIMESTAMP'
      })
    );

    // Verify team roster updates
    expect(mockTransaction.update).toHaveBeenCalledWith(
      expect.objectContaining({ get: expect.any(Function) }),
      expect.objectContaining({
        playerRoster: [
          { userId: 'test-user-id', displayName: 'New Name', initials: 'NEW' },
          { userId: 'other-user', displayName: 'Other User', initials: 'OTH' }
        ],
        updatedAt: 'SERVER_TIMESTAMP'
      })
    );

    expect(mockTransaction.update).toHaveBeenCalledWith(
      expect.objectContaining({ get: expect.any(Function) }),
      expect.objectContaining({
        playerRoster: [
          { userId: 'test-user-id', displayName: 'New Name', initials: 'NEW' },
          { userId: 'other-user', displayName: 'Other User', initials: 'XYZ' }
        ],
        updatedAt: 'SERVER_TIMESTAMP'
      })
    );
  });
}); 