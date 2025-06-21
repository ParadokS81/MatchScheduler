// availability.test.js - Tests for availability module
// TODO: Implement tests according to Technical PRD Section 7

const { createTestUser, cleanupTestData, getContext, db, test } = require('./integration/testUtils');
const { updateAvailability: updateAvailabilityFn } = require('../src/availability/update');
const { createTeam: createTeamFn } = require('../src/teams/create');
const { joinTeam: joinTeamFn } = require('../src/teams/join');

// Wrap functions in test environment
const updateAvailability = test.wrap(updateAvailabilityFn);
const createTeam = test.wrap(createTeamFn);
const joinTeam = test.wrap(joinTeamFn);

describe('Availability Management Tests', () => {
  let leader, member1, member2;
  let teamId, weekId;
  
  // Increase timeout for integration tests
  jest.setTimeout(10000);
  
  beforeEach(async () => {
    await cleanupTestData();
    
    // Create test users with profiles
    leader = await createTestUser('leader@test.com', 'Team Leader', 'TLD');
    member1 = await createTestUser('member1@test.com', 'Member One', 'MO1');
    member2 = await createTestUser('member2@test.com', 'Member Two', 'MO2');

    // Create team and add members
    const createResult = await createTeam(
      {
        teamName: 'Test Team Alpha',
        divisions: ['1']
      },
      getContext(leader)
    );
    
    teamId = createResult.data.teamId;
    await joinTeam({ joinCode: createResult.data.joinCode }, getContext(member1));
    await joinTeam({ joinCode: createResult.data.joinCode }, getContext(member2));

    // Set current week ID
    const now = new Date();
    const weekNum = Math.ceil((now - new Date(now.getFullYear(), 0, 1)) / 604800000);
    weekId = `${now.getFullYear()}-W${String(weekNum).padStart(2, '0')}`;
  });
  
  afterEach(async () => {
    await cleanupTestData();
  });
  
  afterAll(() => {
    test.cleanup();
  });

  describe('Input Validation', () => {
    it('should require authentication', async () => {
      await expect(
        updateAvailability({
          teamId,
          weekId,
          action: 'add',
          slots: ['mon_1900']
        }, {})  // Empty context = no auth
      ).rejects.toThrow('You must be logged in');
    });

    it('should validate week format', async () => {
      await expect(
        updateAvailability({
          teamId,
          weekId: 'invalid-week',
          action: 'add',
          slots: ['mon_1900']
        }, getContext(member1))
      ).rejects.toThrow('Invalid week ID');
    });

    it('should validate time slot format', async () => {
      await expect(
        updateAvailability({
          teamId,
          weekId,
          action: 'add',
          slots: ['invalid_time']
        }, getContext(member1))
      ).rejects.toThrow('valid time slots');
    });

    it('should require team membership', async () => {
      const nonMember = await createTestUser('nonmember@test.com', 'Non Member', 'NM');
      await expect(
        updateAvailability({
          teamId,
          weekId,
          action: 'add',
          slots: ['mon_1900']
        }, getContext(nonMember))
      ).rejects.toThrow('must be a team member');
    });
  });

  describe('Availability Updates', () => {
    it('should add availability correctly', async () => {
      const result = await updateAvailability({
        teamId,
        weekId,
        action: 'add',
        slots: ['mon_1900', 'tue_2000']
      }, getContext(member1));

      expect(result.success).toBe(true);

      const availabilityDoc = await db.collection('availability')
        .doc(`${teamId}_${weekId}`)
        .get();
      
      const data = availabilityDoc.data();
      expect(data.availabilityGrid['mon_1900']).toContain('MO1');
      expect(data.availabilityGrid['tue_2000']).toContain('MO1');
    });

    it('should remove availability correctly', async () => {
      // First add availability
      await updateAvailability({
        teamId,
        weekId,
        action: 'add',
        slots: ['mon_1900', 'tue_2000']
      }, getContext(member1));

      // Then remove one slot
      const result = await updateAvailability({
        teamId,
        weekId,
        action: 'remove',
        slots: ['mon_1900']
      }, getContext(member1));

      expect(result.success).toBe(true);

      const availabilityDoc = await db.collection('availability')
        .doc(`${teamId}_${weekId}`)
        .get();
      
      const data = availabilityDoc.data();
      expect(data.availabilityGrid['mon_1900']).not.toContain('MO1');
      expect(data.availabilityGrid['tue_2000']).toContain('MO1');
    });

    it('should handle multiple users availability', async () => {
      // Member 1 adds availability
      await updateAvailability({
        teamId,
        weekId,
        action: 'add',
        slots: ['mon_1900', 'tue_2000']
      }, getContext(member1));

      // Member 2 adds overlapping availability
      await updateAvailability({
        teamId,
        weekId,
        action: 'add',
        slots: ['mon_1900', 'wed_1800']
      }, getContext(member2));

      const availabilityDoc = await db.collection('availability')
        .doc(`${teamId}_${weekId}`)
        .get();
      
      const data = availabilityDoc.data();
      expect(data.availabilityGrid['mon_1900']).toContain('MO1');
      expect(data.availabilityGrid['mon_1900']).toContain('MO2');
      expect(data.availabilityGrid['tue_2000']).toContain('MO1');
      expect(data.availabilityGrid['wed_1800']).toContain('MO2');
    });

    it('should reactivate archived team', async () => {
      // Archive team first
      await db.collection('teams').doc(teamId).update({
        status: 'archived'
      });

      // Update availability
      await updateAvailability({
        teamId,
        weekId,
        action: 'add',
        slots: ['mon_1900']
      }, getContext(member1));

      const teamDoc = await db.collection('teams').doc(teamId).get();
      expect(teamDoc.data().status).toBe('active');
    });
  });
}); 