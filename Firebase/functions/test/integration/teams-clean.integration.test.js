const { createTestUser, cleanupTestData, getContext, db, test } = require('./testUtils');

// Import ALL team functions
const { createTeam } = require('../../src/teams/create');
const { joinTeam } = require('../../src/teams/join');
const { leaveTeam } = require('../../src/teams/leave');
const { 
  removePlayer, 
  transferLeadership, 
  updateTeamSettings, 
  regenerateJoinCode 
} = require('../../src/teams/manage');

// Wrap functions
const wrappedCreateTeam = test.wrap(createTeam);
const wrappedJoinTeam = test.wrap(joinTeam);
const wrappedLeaveTeam = test.wrap(leaveTeam);
const wrappedRemovePlayer = test.wrap(removePlayer);
const wrappedTransferLeadership = test.wrap(transferLeadership);
const wrappedUpdateTeamSettings = test.wrap(updateTeamSettings);
const wrappedRegenerateJoinCode = test.wrap(regenerateJoinCode);

describe('Team Management - Clean Integration Tests', () => {
  // Test users
  let leader, member1, member2;
  
  beforeEach(async () => {
    await cleanupTestData();
    
    // Create test users with proper profiles
    leader = await createTestUser('leader@test.com', 'Team Leader', 'TLD');
    member1 = await createTestUser('member1@test.com', 'Member One', 'MO1');
    member2 = await createTestUser('member2@test.com', 'Member Two', 'MO2');
  });
  
  afterEach(async () => {
    await cleanupTestData();
  });
  
  afterAll(() => {
    test.cleanup();
  });

  describe('Team Creation', () => {
    it('should create a team with valid data', async () => {
      const result = await wrappedCreateTeam({
        teamName: 'Alpha Team',
        divisions: ['1']
      }, getContext(leader));
      
      expect(result.success).toBe(true);
      expect(result.data.teamId).toBeDefined();
      expect(result.data.joinCode).toMatch(/^[A-Z0-9]{6}$/);
      
      // Verify in database
      const teamDoc = await db.collection('teams').doc(result.data.teamId).get();
      expect(teamDoc.exists).toBe(true);
      expect(teamDoc.data().teamName).toBe('Alpha Team');
      expect(teamDoc.data().leaderId).toBe(leader.uid);
      expect(teamDoc.data().active).toBe(true); // Teams start active by default
    });
    
    it('should prevent duplicate team names', async () => {
      // Create first team
      await wrappedCreateTeam({
        teamName: 'Unique Team',
        divisions: ['1']
      }, getContext(leader));
      
      // Try to create duplicate
      await expect(
        wrappedCreateTeam({
          teamName: 'Unique Team',
          divisions: ['1']
        }, getContext(member1))
      ).rejects.toThrow('already exists');
    });
    
    it('should enforce 2 team limit per user', async () => {
      // Create two teams
      await wrappedCreateTeam({ teamName: 'Team 1', divisions: ['1'] }, getContext(leader));
      await wrappedCreateTeam({ teamName: 'Team 2', divisions: ['2'] }, getContext(leader));
      
      // Third should fail
      await expect(
        wrappedCreateTeam({ teamName: 'Team 3', divisions: ['3'] }, getContext(leader))
      ).rejects.toThrow('up to 2 teams');
    });
  });

  describe('Join Team', () => {
    it('should allow joining with valid code', async () => {
      const { data: { teamId, joinCode } } = await wrappedCreateTeam({
        teamName: 'Join Test',
        divisions: ['1']
      }, getContext(leader));
      
      const result = await wrappedJoinTeam({ joinCode }, getContext(member1));
      
      expect(result.success).toBe(true);
      expect(result.data.teamId).toBe(teamId);
      
      // Verify roster
      const teamDoc = await db.collection('teams').doc(teamId).get();
      expect(teamDoc.data().playerRoster).toHaveLength(2);
    });
    
    it('should reject invalid join codes', async () => {
      await expect(
        wrappedJoinTeam({ joinCode: 'BADCODE' }, getContext(member1))
      ).rejects.toThrow('Invalid join code');
    });
    
    it('should handle case-insensitive join codes', async () => {
      const { data: { joinCode } } = await wrappedCreateTeam({
        teamName: 'Case Test',
        divisions: ['1']
      }, getContext(leader));
      
      // Join with lowercase
      const result = await wrappedJoinTeam({ 
        joinCode: joinCode.toLowerCase() 
      }, getContext(member1));
      
      expect(result.success).toBe(true);
    });
  });

  describe('Leave Team - Core Business Logic', () => {
    // Test 1: Leader Guard
    it('should NOT allow a leader of a multi-person team to leave', async () => {
      // Create team with leader
      const { data: { teamId, joinCode } } = await wrappedCreateTeam({
        teamName: 'Leader Guard Test',
        divisions: ['1']
      }, getContext(leader));
      
      // Add another member
      await wrappedJoinTeam({ joinCode }, getContext(member1));
      
      // Leader tries to leave - should FAIL
      await expect(
        wrappedLeaveTeam({ teamId }, getContext(leader))
      ).rejects.toThrow('Team leader must transfer leadership before leaving');
    });
    
    // Test 2: Archive on Last Leave  
    it('SHOULD allow a leader of a single-person team to leave and archive', async () => {
      // Create team with ONLY leader
      const { data: { teamId } } = await wrappedCreateTeam({
        teamName: 'Solo Leader Test',
        divisions: ['1']
      }, getContext(leader));
      
      // Leader leaves - should SUCCEED
      const result = await wrappedLeaveTeam({ teamId }, getContext(leader));
      expect(result.success).toBe(true);
      
      // Verify team is archived
      const teamDoc = await db.collection('teams').doc(teamId).get();
      expect(teamDoc.data().active).toBe(false);
      expect(teamDoc.data().archived).toBe(true);
      expect(teamDoc.data().playerRoster).toHaveLength(0);
    });
    
    // Test 3: Post-Transfer Leave
    it('should allow a former leader to leave after transferring leadership', async () => {
      // Create team with leader and member
      const { data: { teamId, joinCode } } = await wrappedCreateTeam({
        teamName: 'Transfer Test',
        divisions: ['1']
      }, getContext(leader));
      
      await wrappedJoinTeam({ joinCode }, getContext(member1));
      
      // Transfer leadership
      await wrappedTransferLeadership({
        teamId,
        newLeaderId: member1.uid
      }, getContext(leader));
      
      // Former leader leaves - should SUCCEED
      const result = await wrappedLeaveTeam({ teamId }, getContext(leader));
      expect(result.success).toBe(true);
      
      // Verify roster
      const teamDoc = await db.collection('teams').doc(teamId).get();
      expect(teamDoc.data().playerRoster).toHaveLength(1);
      expect(teamDoc.data().leaderId).toBe(member1.uid);
    });
    
    // Bonus: Regular member can always leave
    it('should allow regular members to leave anytime', async () => {
      const { data: { teamId, joinCode } } = await wrappedCreateTeam({
        teamName: 'Member Leave Test',
        divisions: ['1']
      }, getContext(leader));
      
      await wrappedJoinTeam({ joinCode }, getContext(member1));
      
      // Member leaves - should SUCCEED
      const result = await wrappedLeaveTeam({ teamId }, getContext(member1));
      expect(result.success).toBe(true);
    });
  });

  describe('Team Management Functions', () => {
    it('should allow leader to remove players', async () => {
      const { data: { teamId, joinCode } } = await wrappedCreateTeam({
        teamName: 'Remove Test',
        divisions: ['1']
      }, getContext(leader));
      
      await wrappedJoinTeam({ joinCode }, getContext(member1));
      
      const result = await wrappedRemovePlayer({
        teamId,
        targetUserId: member1.uid
      }, getContext(leader));
      
      expect(result.success).toBe(true);
    });
    
    it('should allow leader to update team settings', async () => {
      const { data: { teamId } } = await wrappedCreateTeam({
        teamName: 'Settings Test',
        divisions: ['1']
      }, getContext(leader));
      
      const result = await wrappedUpdateTeamSettings({
        teamId,
        maxPlayers: 5,
        divisions: ['1', '2']
      }, getContext(leader));
      
      expect(result.success).toBe(true);
    });
    
    it('should allow leader to regenerate join code', async () => {
      const { data: { teamId, joinCode: oldCode } } = await wrappedCreateTeam({
        teamName: 'Regen Test',
        divisions: ['1']
      }, getContext(leader));
      
      const result = await wrappedRegenerateJoinCode({ teamId }, getContext(leader));
      
      expect(result.success).toBe(true);
      expect(result.data.joinCode).not.toBe(oldCode);
    });
  });
}); 