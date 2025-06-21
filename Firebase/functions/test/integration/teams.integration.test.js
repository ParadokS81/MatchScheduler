const { createTestUser, cleanupTestData, getContext, db, test } = require('./testUtils');

// Import and wrap the cloud functions
const createTeamFn = require('../../src/teams/create').createTeam;
const joinTeamFn = require('../../src/teams/join').joinTeam;
const leaveTeamFn = require('../../src/teams/leave').leaveTeam;
const { 
  removePlayer: removePlayerFn, 
  transferLeadership: transferLeadershipFn, 
  updateTeamSettings: updateTeamSettingsFn, 
  regenerateJoinCode: regenerateJoinCodeFn 
} = require('../../src/teams/manage');

// Wrap functions in test environment
const createTeam = test.wrap(createTeamFn);
const joinTeam = test.wrap(joinTeamFn);
const leaveTeam = test.wrap(leaveTeamFn);
const removePlayer = test.wrap(removePlayerFn);
const transferLeadership = test.wrap(transferLeadershipFn);
const updateTeamSettings = test.wrap(updateTeamSettingsFn);
const regenerateJoinCode = test.wrap(regenerateJoinCodeFn);

describe('Team Management Integration Tests', () => {
  let leader, member1, member2;
  
  // Increase timeout for integration tests
  jest.setTimeout(10000);
  
  beforeEach(async () => {
    await cleanupTestData();
    
    // Create test users with profiles
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
  
  describe('Team Lifecycle - Focused Tests', () => {
    it('should handle team creation and member joining', async () => {
      // Create team
      const createResult = await createTeam(
        {
          teamName: 'Test Team Alpha',
          divisions: ['1', '2']
        },
        getContext(leader)
      );
      
      expect(createResult.success).toBe(true);
      expect(createResult.data.joinCode).toMatch(/^[A-Z0-9]{6}$/);
      const { teamId, joinCode } = createResult.data;
      
      // Members join
      const joinResult1 = await joinTeam({ joinCode }, getContext(member1));
      expect(joinResult1.success).toBe(true);
      
      const joinResult2 = await joinTeam({ joinCode }, getContext(member2));
      expect(joinResult2.success).toBe(true);
      
      // Verify roster
      const teamDoc = await db.collection('teams').doc(teamId).get();
      expect(teamDoc.data().playerRoster).toHaveLength(3);
    });

    it('should handle team settings and player removal', async () => {
      // Create team with leader
      const createResult = await createTeam(
        {
          teamName: 'Test Team Beta',
          divisions: ['2']
        },
        getContext(leader)
      );
      
      const { teamId, joinCode } = createResult.data;
      
      // Member joins
      await joinTeam({ joinCode }, getContext(member1));
      
      // Update settings
      const updateResult = await updateTeamSettings(
        {
          teamId,
          maxPlayers: 5,
          teamLogoUrl: 'https://example.com/logo.png'
        },
        getContext(leader)
      );
      expect(updateResult.success).toBe(true);
      
      // Remove member
      const removeResult = await removePlayer(
        {
          teamId,
          targetUserId: member1.uid
        },
        getContext(leader)
      );
      expect(removeResult.success).toBe(true);
      
      // Verify removal
      const userDoc = await db.collection('users').doc(member1.uid).get();
      expect(userDoc.data().teams).not.toContain(teamId);
    });

    it('should handle leadership transfer', async () => {
      // Create team
      const createResult = await createTeam(
        {
          teamName: 'Test Team Gamma',
          divisions: ['3']
        },
        getContext(leader)
      );
      
      const { teamId, joinCode } = createResult.data;
      console.log('Created team:', teamId, 'with leader:', leader.uid);
      
      // Member joins
      await joinTeam({ joinCode }, getContext(member1));
      console.log('Member joined:', member1.uid);
      
      // Transfer leadership
      console.log('About to transfer leadership from', leader.uid, 'to', member1.uid);
      const transferResult = await transferLeadership(
        {
          teamId,
          newLeaderId: member1.uid
        },
        getContext(leader)
      );
      console.log('Transfer result:', transferResult);
      
      // Verify transfer in database
      const teamDoc = await db.collection('teams').doc(teamId).get();
      const teamData = teamDoc.data();
      console.log('Team data after transfer:', {
        teamId: teamId,
        leaderId: teamData.leaderId,
        expectedLeader: member1.uid,
        match: teamData.leaderId === member1.uid
      });
      
      expect(teamDoc.data().leaderId).toBe(member1.uid);
      
      // Verify new leader can perform leader actions
      const regenResult = await regenerateJoinCode(
        { teamId },
        getContext(member1)
      );
      expect(regenResult.success).toBe(true);
    });

    it('should archive team when last member leaves', async () => {
      // Create team with just leader
      const createResult = await createTeam(
        {
          teamName: 'Test Team Delta',
          divisions: ['1']
        },
        getContext(leader)
      );
      
      const { teamId, joinCode } = createResult.data;
      console.log('Created team:', teamId, 'with leader:', leader.uid);
      
      // Member joins
      await joinTeam({ joinCode }, getContext(member2));
      console.log('Member joined:', member2.uid);
      
      // Transfer to member2 so leader can leave
      console.log('About to transfer leadership from', leader.uid, 'to', member2.uid);
      const transferResult = await transferLeadership(
        { 
          teamId, 
          newLeaderId: member2.uid 
        }, 
        getContext(leader)
      );
      console.log('Transfer result:', transferResult);
      
      // Wait longer for transfer to complete
      await new Promise(resolve => setTimeout(resolve, 2000)); // Two second delay
      
      // Verify transfer completed and log details
      const teamAfterTransfer = await db.collection('teams').doc(teamId).get();
      const teamData = teamAfterTransfer.data();
      console.log('Team data after transfer:', {
        teamId,
        leaderId: teamData.leaderId,
        expectedLeader: member2.uid,
        match: teamData.leaderId === member2.uid,
        fullData: teamData
      });
      
      expect(teamAfterTransfer.exists).toBe(true);
      expect(teamData.leaderId).toBe(member2.uid);
      
      // Original leader can now leave
      console.log('Original leader attempting to leave...');
      const leaderLeaveResult = await leaveTeam({ teamId }, getContext(leader));
      console.log('Original leader leave result:', leaderLeaveResult);
      
      // Last member leaves - archives
      console.log('New leader (last member) attempting to leave...');
      const finalResult = await leaveTeam({ teamId }, getContext(member2));
      console.log('Final leave result:', finalResult);
      
      // Verify archived
      const archived = await db.collection('teams').doc(teamId).get();
      const archivedData = archived.data();
      console.log('Final team state:', archivedData);
      expect(archivedData.status).toBe('archived');
      expect(archivedData.playerRoster).toHaveLength(0);
    });
  });
  
  describe('Error Cases', () => {
    it('should prevent joining with invalid join code', async () => {
      await expect(
        joinTeam(
          { joinCode: 'INVALID' },
          getContext(member1)
        )
      ).rejects.toThrow('Invalid join code');
    });

    it('should prevent duplicate joins', async () => {
      const { data: { joinCode } } = await createTeam(
        { teamName: 'Dupe Test', divisions: ['1'] },
        getContext(leader)
      );

      await joinTeam({ joinCode }, getContext(member1));
      
      await expect(
        joinTeam({ joinCode }, getContext(member1))
      ).rejects.toThrow('Already a member of this team');
    });

    it('should prevent unauthorized leadership transfers', async () => {
      const { data: { teamId } } = await createTeam(
        { teamName: 'Auth Test', divisions: ['1'] },
        getContext(leader)
      );

      await expect(
        transferLeadership(
          { teamId, newLeaderId: member1.uid },
          getContext(member2)  // Non-leader attempting transfer
        )
      ).rejects.toThrow('New leader is not a member of team "Auth Test"');
    });
  });
  
  describe('Join Code Features', () => {
    it('should generate valid join codes', async () => {
      const result = await createTeam(
        { teamName: 'Code Test', divisions: ['1'] },
        getContext(leader)
      );
      
      expect(result.data.joinCode).toMatch(/^[A-Z0-9]{6}$/);
    });

    it('should allow regenerating join codes', async () => {
      const { data: { teamId, joinCode: originalCode } } = await createTeam(
        { teamName: 'Regen Test', divisions: ['1'] },
        getContext(leader)
      );

      const regenResult = await regenerateJoinCode({ teamId }, getContext(leader));
      expect(regenResult.success).toBe(true);
      expect(regenResult.data.joinCode).not.toBe(originalCode);
    });
  });
  
  describe('Data Consistency', () => {
    it('should maintain user-team relationship', async () => {
      const { data: { teamId, joinCode } } = await createTeam(
        { teamName: 'Consistency Test', divisions: ['1'] },
        getContext(leader)
      );

      await joinTeam({ joinCode }, getContext(member1));
      
      const userDoc = await db.collection('users').doc(member1.uid).get();
      expect(userDoc.data().teams).toContain(teamId);
    });

    it('should cleanup relationships on leave', async () => {
      const { data: { teamId, joinCode } } = await createTeam(
        { teamName: 'Cleanup Test', divisions: ['1'] },
        getContext(leader)
      );

      await joinTeam({ joinCode }, getContext(member1));
      await leaveTeam({ teamId }, getContext(member1));
      
      const userDoc = await db.collection('users').doc(member1.uid).get();
      const teamDoc = await db.collection('teams').doc(teamId).get();
      
      expect(userDoc.data().teams).not.toContain(teamId);
      expect(teamDoc.data().playerRoster.map(p => p.userId)).not.toContain(member1.uid);
    });
  });
}); 