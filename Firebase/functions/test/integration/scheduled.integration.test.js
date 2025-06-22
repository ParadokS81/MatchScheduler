const { db, test, cleanupTestData } = require('./testUtils');
const { checkTeamActivity: checkTeamActivityFn } = require('../../src/scheduled/teamStatus');

// Wrap function in test environment
const checkTeamActivity = test.wrap(checkTeamActivityFn);

describe('Scheduled Function Tests', () => {
  beforeEach(async () => {
    await cleanupTestData();
  });

  afterAll(() => {
    test.cleanup();
  });

  it('should mark inactive teams after 14 days', async () => {
    const now = new Date();
    const fifteenDaysAgo = new Date(now.getTime() - (15 * 24 * 60 * 60 * 1000));
    
    // Create an active team with old activity
    await db.collection('teams').doc('old-team').set({
      teamId: 'old-team',
      teamName: 'Old Team',
      status: 'active',
      lastActivityAt: fifteenDaysAgo,
      joinCode: 'OLD123',
      joinCodeCreatedAt: now,
      playerRoster: [],
      divisions: ['1']
    });

    // Create a recently active team
    await db.collection('teams').doc('new-team').set({
      teamId: 'new-team',
      teamName: 'New Team', 
      status: 'active',
      lastActivityAt: now,
      joinCode: 'NEW123',
      joinCodeCreatedAt: now,
      playerRoster: [],
      divisions: ['1']
    });

    // Run the scheduled function
    await checkTeamActivity({ eventId: 'test-run' });

    // Check results
    const oldTeam = await db.collection('teams').doc('old-team').get();
    const newTeam = await db.collection('teams').doc('new-team').get();

    expect(oldTeam.data().status).toBe('inactive');
    expect(newTeam.data().status).toBe('active');
  });

  it('should regenerate old join codes', async () => {
    const now = new Date();
    const thirtyOneDaysAgo = new Date(now.getTime() - (31 * 24 * 60 * 60 * 1000));
    
    // Create team with old join code
    await db.collection('teams').doc('team-1').set({
      teamId: 'team-1',
      teamName: 'Team 1',
      status: 'active',
      lastActivityAt: now,
      joinCode: 'OLD456',
      joinCodeCreatedAt: thirtyOneDaysAgo,
      playerRoster: [],
      divisions: ['1']
    });

    // Run the scheduled function
    await checkTeamActivity({ eventId: 'test-run' });

    // Check join code was regenerated
    const team = await db.collection('teams').doc('team-1').get();
    expect(team.data().joinCode).not.toBe('OLD456');
    expect(team.data().joinCode).toMatch(/^[A-Z0-9]{6}$/);
  });
}); 