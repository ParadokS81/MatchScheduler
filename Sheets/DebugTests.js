/**
 * Schedule Manager - Debug Test Scenarios & Assertion Framework
 * Split from Debug.js v2.2.0 (2025-06-07)
 * 
 * Purpose: Individual test scenarios, assertion framework, and test orchestration
 * Dependencies: Uses TEST_CONFIG from DebugMenu.gs, verification functions from DebugData.gs
 */

// =============================================================================
// ASSERTION HELPER & TEST LOGGING
// =============================================================================
let totalChecksInScenario = 0; 
let passedChecksInScenario = 0; 
let failedChecksInScenario = 0;

function resetTestCounters() { 
    totalChecksInScenario = 0; 
    passedChecksInScenario = 0; 
    failedChecksInScenario = 0;
}

function _scenarioLog(message, isError = false) { 
    Logger.log((isError ? "❌ ERROR: " : "ℹ️ INFO: ") + message); 
}

function assert(condition, passMessage, failMessagePrefix = "Assertion Failed") {
  totalChecksInScenario++; 
  if (condition) { 
    Logger.log(`✅ PASS: ${passMessage}`); 
    passedChecksInScenario++; 
  } else { 
    Logger.log(`❌ FAIL: ${failMessagePrefix} - Details: ${passMessage}`); 
    failedChecksInScenario++; 
  } 
  return condition; 
}

function startScenario(scenarioName) {
    Logger.log(`\n\n=============== STARTING SCENARIO: ${scenarioName} ===============`);
    resetTestCounters(); 
    _scenarioLog(`Scenario: ${scenarioName} started at ${new Date().toLocaleTimeString()}`);
    if (!TEST_CONFIG.TEST_AVAILABILITY_YEAR) initializeTestConfigDates();
}

function logTestSummary(scenarioName) {
    const summary = `--- ${scenarioName} Summary: Total Checks: ${totalChecksInScenario}, Passed: ${passedChecksInScenario}, Failed: ${failedChecksInScenario} ---`;
    _scenarioLog(summary); 
    Logger.log(summary); 
    Logger.log(`=============== SCENARIO ${scenarioName} COMPLETE ===============`);
}

// =============================================================================
// MASTER TEST SCENARIO ORCHESTRATOR
// =============================================================================
function runAllSystemTests_Sequential() {
    const MASTER_SCENARIO_NAME = "MASTER SYSTEM TEST SUITE (SEQUENTIAL)";
    Logger.log(`\n\n========== ${MASTER_SCENARIO_NAME} START (${new Date().toLocaleString()}) ==========\n`);
    initializeTestConfigDates(); 
    startScenario("Initial Cleanup of ZZZ Test Entities (Pre-Suite)");
    comprehensiveCleanupOfTestData();
    logTestSummary("Initial Cleanup of ZZZ Test Entities (Pre-Suite)"); 
    testScenario_TeamCreationAndJoin();
    testScenario_AvailabilityManagement();
    testScenario_PlayerLeaveAndDeactivation();
    testScenario_AdminFunctionsAndTeamArchival();
    testScenario_ScheduledWeekProvisioning();
    Logger.log(`\n========== ${MASTER_SCENARIO_NAME} FINISHED (${new Date().toLocaleString()}) ==========\n`);
}

// =============================================================================
// INDIVIDUAL TEST SCENARIOS
// =============================================================================

function testScenario_TeamCreationAndJoin() {
  const SCENARIO_NAME = "SCENARIO: Team Creation & Player Join (with Auto-Leadership)";
  startScenario(SCENARIO_NAME);

  const admin = TEST_CONFIG.ADMIN_EMAIL;
  const p1 = { email: TEST_CONFIG.PLAYER1_EMAIL, name: TEST_CONFIG.PLAYER1_DISPLAY_NAME, initials: TEST_CONFIG.PLAYER1_INITIALS_TEAM_A };
  const p2 = { email: TEST_CONFIG.PLAYER2_EMAIL, name: TEST_CONFIG.PLAYER2_DISPLAY_NAME, initials: TEST_CONFIG.PLAYER2_INITIALS_TEAM_A };

  let teamA_id = null;
  let teamA_joinCode = null;

  _scenarioLog("Step 1.0: Ensuring Admin player record exists or is created.");
  createPlayer({ googleEmail: admin, displayName: "Test Admin Main" });

  _scenarioLog("Step 1.1: Ensuring Player 1 record exists or is created.");
  createPlayer({ googleEmail: p1.email, displayName: p1.name });

  _scenarioLog("Step 1.2: Ensuring Player 2 record exists or is created.");
  createPlayer({ googleEmail: p2.email, displayName: p2.name });

  verifyPlayerData(admin, { isActive: true });
  verifyPlayerData(p1.email, { displayName: p1.name, isActive: true });
  verifyPlayerData(p2.email, { displayName: p2.name, isActive: true });

  _scenarioLog(`Step 2: User ${admin} (acting as script runner/active user) creates Team A (${TEST_CONFIG.TEAM_A_NAME}) and becomes leader.`);

  const teamACreationDataFromFrontend = {
    teamName: TEST_CONFIG.TEAM_A_NAME,
    division: TEST_CONFIG.TEAM_A_DIVISION
  };
  const creatorInitialsForTeamA = "AL";
  const creatorDisplayNameForTeamA = "AdminLeader Test";

  let teamCreationResult = createNewTeam(teamACreationDataFromFrontend, creatorInitialsForTeamA, creatorDisplayNameForTeamA);

  if (assert(teamCreationResult.success && teamCreationResult.team, `Team ${TEST_CONFIG.TEAM_A_NAME} created and leader setup orchestrated. Join Code: ${teamCreationResult.team ? teamCreationResult.team.joinCode : 'N/A'}`)) {
    teamA_id = teamCreationResult.team.teamId;
    teamA_joinCode = teamCreationResult.team.joinCode;

    _scenarioLog(`Team A ID: ${teamA_id}, Join Code: ${teamA_joinCode}`);

    verifyTeamData(teamA_id, {
      teamName: TEST_CONFIG.TEAM_A_NAME,
      leaderEmail: admin,
      playerCount: 1,
      isActive: true,
      initialsList: [creatorInitialsForTeamA]
    });

    const adminPlayerData = getPlayerDataByEmail(admin, true);
    if (assert(adminPlayerData, `Admin player data for ${admin} should be found.`)) {
      let adminIsLeaderOfTeamA = false;
      let adminHasCorrectInitialsForTeamA = false;
      let actualRoleInSheet = "NOT_FOUND_IN_SLOTS";

      if (adminPlayerData.team1 && adminPlayerData.team1.teamId === teamA_id) {
        actualRoleInSheet = adminPlayerData.team1.role;
        adminIsLeaderOfTeamA = actualRoleInSheet === ROLES.TEAM_LEADER;
        adminHasCorrectInitialsForTeamA = adminPlayerData.team1.initials === creatorInitialsForTeamA;
      } else if (adminPlayerData.team2 && adminPlayerData.team2.teamId === teamA_id) {
        actualRoleInSheet = adminPlayerData.team2.role;
        adminIsLeaderOfTeamA = actualRoleInSheet === ROLES.TEAM_LEADER;
        adminHasCorrectInitialsForTeamA = adminPlayerData.team2.initials === creatorInitialsForTeamA;
      }
      Logger.log(`DEBUG: Admin Role Check - Expected Role: '${ROLES.TEAM_LEADER}', Actual Role in Sheet for Team ${teamA_id}: '${actualRoleInSheet}', Comparison Result: ${adminIsLeaderOfTeamA}`);

      assert(adminIsLeaderOfTeamA, `Admin ${admin} has role TEAM_LEADER in new team ${teamA_id}.`);
      assert(adminHasCorrectInitialsForTeamA, `Admin ${admin} has initials ${creatorInitialsForTeamA} in new team ${teamA_id}.`);
    }
  } else {
    logTestSummary(SCENARIO_NAME);
    Logger.log(`Critical failure in Step 2 (Team Creation/Leader Setup). Result: ${JSON.stringify(teamCreationResult)}. Aborting scenario.`);
    return;
  }

  _scenarioLog(`Step 3: Player 1 (${p1.email}) joins Team A (${teamA_id}) using code ${teamA_joinCode}.`);
  let p1JoinResult = joinTeamByCode(p1.email, teamA_joinCode, p1.name, p1.initials);

  if (assert(p1JoinResult.success, `Player 1 (${p1.email}) joined Team A as '${p1.initials}'. Message: ${p1JoinResult.message}`)) {
    verifyTeamData(teamA_id, { playerCount: 2, initialsList: [creatorInitialsForTeamA, p1.initials].sort() });
    const p1Data = getPlayerDataByEmail(p1.email, true);
    if(assert(p1Data, `Player 1 data for ${p1.email} found.`)){
        let p1IsPlayerInTeamA = false;
        let p1HasCorrectInitials = false;
         if (p1Data.team1 && p1Data.team1.teamId === teamA_id) {
            p1IsPlayerInTeamA = p1Data.team1.role === ROLES.PLAYER;
            p1HasCorrectInitials = p1Data.team1.initials === p1.initials;
        } else if (p1Data.team2 && p1Data.team2.teamId === teamA_id) {
            p1IsPlayerInTeamA = p1Data.team2.role === ROLES.PLAYER;
            p1HasCorrectInitials = p1Data.team2.initials === p1.initials;
        }
        assert(p1IsPlayerInTeamA, `Player 1 (${p1.email}) has role PLAYER in team ${teamA_id}.`);
        assert(p1HasCorrectInitials, `Player 1 (${p1.email}) has initials ${p1.initials} in team ${teamA_id}.`);
    }
  }

  _scenarioLog(`Step 4: Player 2 (${p2.email}) joins Team A.`);
  let p2JoinResult = joinTeamByCode(p2.email, teamA_joinCode, p2.name, p2.initials);

  if (assert(p2JoinResult.success, `Player 2 (${p2.email}) joined Team A as '${p2.initials}'. Message: ${p2JoinResult.message}`)) {
    verifyTeamData(teamA_id, { playerCount: 3, initialsList: [creatorInitialsForTeamA, p1.initials, p2.initials].sort() });
    const p2Data = getPlayerDataByEmail(p2.email, true);
     if(assert(p2Data, `Player 2 data for ${p2.email} found.`)){
        let p2IsPlayerInTeamA = false;
        let p2HasCorrectInitials = false;
         if (p2Data.team1 && p2Data.team1.teamId === teamA_id) {
            p2IsPlayerInTeamA = p2Data.team1.role === ROLES.PLAYER;
            p2HasCorrectInitials = p2Data.team1.initials === p2.initials;
        } else if (p2Data.team2 && p2Data.team2.teamId === teamA_id) {
            p2IsPlayerInTeamA = p2Data.team2.role === ROLES.PLAYER;
            p2HasCorrectInitials = p2Data.team2.initials === p2.initials;
        }
        assert(p2IsPlayerInTeamA, `Player 2 (${p2.email}) has role PLAYER in team ${teamA_id}.`);
        assert(p2HasCorrectInitials, `Player 2 (${p2.email}) has initials ${p2.initials} in team ${teamA_id}.`);
    }
  }

  _scenarioLog(`Step 5: Player 1 (${p1.email}) attempts to re-join Team A.`);
  let p1RejoinResult = joinTeamByCode(p1.email, teamA_joinCode, p1.name, p1.initials);
  assert(!p1RejoinResult.success && p1RejoinResult.message && p1RejoinResult.message.toLowerCase().includes("already member"), `Player 1 re-join attempt fails as expected. Message: ${p1RejoinResult.message}`);

  logTestSummary(SCENARIO_NAME);
}

function testScenario_AvailabilityManagement() {
  const SCENARIO_NAME = "SCENARIO: Availability Management";
  startScenario(SCENARIO_NAME);
  const admin = TEST_CONFIG.ADMIN_EMAIL;
  const p1 = { email: TEST_CONFIG.PLAYER1_EMAIL, name: TEST_CONFIG.PLAYER1_DISPLAY_NAME, initials: TEST_CONFIG.PLAYER1_INITIALS_TEAM_A };
  let teamA_id = null;
  let teamA_sheetName = null;
  let teamAJoinCode = null;

  _scenarioLog("Step 0: Setup - Ensuring Team A and Player 1 exist and P1 is on it.");

  createPlayer({ googleEmail: admin, displayName: "Admin User for Avail Test" });
  createPlayer({ googleEmail: p1.email, displayName: p1.name });

  let teamsResult = getAllTeams(true);
  let teamDataArray;

  if (teamsResult.success) {
    teamDataArray = teamsResult.teams || [];
  } else {
    _scenarioLog(`Failed to get teams: ${teamsResult.message}`, true);
    logTestSummary(SCENARIO_NAME);
    return;
  }

  let foundTeamA = teamDataArray.find(t => t.teamName === TEST_CONFIG.TEAM_A_NAME && t.leaderEmail === admin);

  if (foundTeamA) {
    teamA_id = foundTeamA.teamId;
    teamA_sheetName = foundTeamA.availabilitySheetName;
    teamAJoinCode = foundTeamA.joinCode;
    _scenarioLog(`Using existing Team A (ID: ${teamA_id}, Name: ${foundTeamA.teamName}, Sheet: ${teamA_sheetName}).`);
    if (!isPlayerOnTeam(p1.email, teamA_id)) {
      _scenarioLog(`Player ${p1.email} not on Team A. Adding now...`);
      let joinP1Result = joinTeamByCode(p1.email, teamAJoinCode, p1.name, p1.initials);
      if (!assert(joinP1Result.success, `Player ${p1.email} joined existing Team A. Msg: ${joinP1Result.message}`)) {
        logTestSummary(SCENARIO_NAME); return;
      }
    } else {
      _scenarioLog(`Player ${p1.email} confirmed on Team A.`);
    }
  } else {
    _scenarioLog(`Team A ("${TEST_CONFIG.TEAM_A_NAME}" led by ${admin}) not found. Creating it now for the test.`);
    const teamCreationData = { teamName: TEST_CONFIG.TEAM_A_NAME, division: TEST_CONFIG.TEAM_A_DIVISION };
    let creationResult = createNewTeam(teamCreationData, "CA", "CreatorAvailTest");
    if (!assert(creationResult.success && creationResult.team, `Team "${TEST_CONFIG.TEAM_A_NAME}" created for avail test. Join Code: ${creationResult.team ? creationResult.team.joinCode : 'N/A'}`)) {
      logTestSummary(SCENARIO_NAME); return;
    }
    teamA_id = creationResult.team.teamId;
    teamA_sheetName = creationResult.team.availabilitySheetName;
    teamAJoinCode = creationResult.team.joinCode;

    _scenarioLog(`Team A created with ID: ${teamA_id}. Now adding P1 (${p1.email}) to it.`);
    let joinP1Result = joinTeamByCode(p1.email, teamAJoinCode, p1.name, p1.initials);
    if (!assert(joinP1Result.success, `Player ${p1.email} joined newly created Team A for avail test. Msg: ${joinP1Result.message}`)) {
      logTestSummary(SCENARIO_NAME); return;
    }
  }

  const teamSheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(teamA_sheetName);
  if (!assert(teamSheet, `Availability sheet ${teamA_sheetName} exists.`)) { logTestSummary(SCENARIO_NAME); return; }

  _scenarioLog("Step 1: Player 1 adds availability to current week.");
  let currentBlock = findWeekBlock(teamSheet, TEST_CONFIG.TEST_AVAILABILITY_YEAR, TEST_CONFIG.TEST_AVAILABILITY_CURRENT_WEEK);
   if (!currentBlock) {
      ensureWeekExists(teamSheet, TEST_CONFIG.TEST_AVAILABILITY_YEAR, TEST_CONFIG.TEST_AVAILABILITY_CURRENT_WEEK);
      currentBlock = findWeekBlock(teamSheet, TEST_CONFIG.TEST_AVAILABILITY_YEAR, TEST_CONFIG.TEST_AVAILABILITY_CURRENT_WEEK);
  }
  if (!assert(currentBlock, `Current week block exists for avail test.`)) { logTestSummary(SCENARIO_NAME); return; }

  const slot1 = { row: currentBlock.startRow + 1, col: BLOCK_CONFIG.LAYOUT.DAYS_START_COLUMN + 1 + 0 };
  const slot2 = { row: currentBlock.startRow + 2, col: BLOCK_CONFIG.LAYOUT.DAYS_START_COLUMN + 1 + 1 };

  let availResult = availabilityManager_updatePlayerAvailability_SERVICE(p1.email, teamA_id, "add", [slot1, slot2]);
  assert(availResult.success && availResult.cellsModified === 2, `P1 adds 2 slots. Msg: ${availResult.message}`);
  if(availResult.success && availResult.cellsModified === 2) verifyAvailability(teamA_sheetName, currentBlock.year, currentBlock.weekNumber, p1.initials, 2);

  _scenarioLog("Step 2: Player 1 removes one availability slot.");
  availResult = availabilityManager_updatePlayerAvailability_SERVICE(p1.email, teamA_id, "remove", [slot1]);
  assert(availResult.success && availResult.cellsModified === 1, `P1 removes 1 slot. Msg: ${availResult.message}`);
  if(availResult.success && availResult.cellsModified === 1) verifyAvailability(teamA_sheetName, currentBlock.year, currentBlock.weekNumber, p1.initials, 1);

  _scenarioLog("Step 3: Player 1 adds availability to a future week.");
  let nextBlock = findWeekBlock(teamSheet, TEST_CONFIG.TEST_AVAILABILITY_NEXT_WEEK_YEAR, TEST_CONFIG.TEST_AVAILABILITY_NEXT_WEEK);
  if (!nextBlock) {
      ensureWeekExists(teamSheet, TEST_CONFIG.TEST_AVAILABILITY_NEXT_WEEK_YEAR, TEST_CONFIG.TEST_AVAILABILITY_NEXT_WEEK);
      nextBlock = findWeekBlock(teamSheet, TEST_CONFIG.TEST_AVAILABILITY_NEXT_WEEK_YEAR, TEST_CONFIG.TEST_AVAILABILITY_NEXT_WEEK);
  }
  if (!assert(nextBlock, `Next week block exists for avail test.`)) { logTestSummary(SCENARIO_NAME); return; }

  const futureSlot = { row: nextBlock.startRow + 0, col: BLOCK_CONFIG.LAYOUT.DAYS_START_COLUMN + 1 + 2 };
  availResult = availabilityManager_updatePlayerAvailability_SERVICE(p1.email, teamA_id, "add", [futureSlot]);
  assert(availResult.success && availResult.cellsModified === 1, `P1 adds 1 future slot. Msg: ${availResult.message}`);
  if(availResult.success && availResult.cellsModified === 1) verifyAvailability(teamA_sheetName, nextBlock.year, nextBlock.weekNumber, p1.initials, "present");

  _scenarioLog("Step 4: Player 1 adds availability to a past week.");
  let pastBlock = findWeekBlock(teamSheet, TEST_CONFIG.TEST_AVAILABILITY_PAST_YEAR, TEST_CONFIG.TEST_AVAILABILITY_PAST_WEEK);
  if (!pastBlock) {
      ensureWeekExists(teamSheet, TEST_CONFIG.TEST_AVAILABILITY_PAST_YEAR, TEST_CONFIG.TEST_AVAILABILITY_PAST_WEEK);
      pastBlock = findWeekBlock(teamSheet, TEST_CONFIG.TEST_AVAILABILITY_PAST_YEAR, TEST_CONFIG.TEST_AVAILABILITY_PAST_WEEK);
  }
  if (pastBlock) {
    const pastSlot = {row: pastBlock.startRow, col: BLOCK_CONFIG.LAYOUT.DAYS_START_COLUMN + 1 + 0};
    availResult = availabilityManager_updatePlayerAvailability_SERVICE(p1.email, teamA_id, "add", [pastSlot]);
    assert(availResult.success && availResult.cellsModified === 1, `P1 added to past week. Msg: ${availResult.message}`);
    if(availResult.success && availResult.cellsModified === 1) verifyAvailability(teamA_sheetName, pastBlock.year, pastBlock.weekNumber, p1.initials, "present");
  } else { _scenarioLog(`Info: Past week block not found or could not be created. Skipping past availability add test.`); }

  _scenarioLog("Step 5: Cleanup (Rely on comprehensive cleanup for ZZZ Test Team Alpha).");
  logTestSummary(SCENARIO_NAME);
}

function testScenario_PlayerLeaveAndDeactivation() {
  const SCENARIO_NAME = "SCENARIO: Player Leave & Deactivation";
  startScenario(SCENARIO_NAME);
  const admin = TEST_CONFIG.ADMIN_EMAIL;
  const p1 = { email: TEST_CONFIG.PLAYER1_EMAIL, name: TEST_CONFIG.PLAYER1_DISPLAY_NAME, initials: TEST_CONFIG.PLAYER1_INITIALS_TEAM_A };
  let teamA_id = null;
  let teamA_sheetName = null;
  let teamAJoinCode = null;

  _scenarioLog("Step 0: Setup verification - Find or Create Team A and ensure P1 is on it.");

  createPlayer({ googleEmail: admin, displayName: "Admin User for Deactivation Test" });
  createPlayer({ googleEmail: p1.email, displayName: p1.name });

  let teamsResult = getAllTeams(true);
  let teamDataArray;

  if (teamsResult.success) {
    teamDataArray = teamsResult.teams || [];
  } else {
    _scenarioLog(`Failed to get teams: ${teamsResult.message}`, true);
    logTestSummary(SCENARIO_NAME);
    return;
  }

  let foundTeamA = teamDataArray.find(t => t.teamName === TEST_CONFIG.TEAM_A_NAME && t.leaderEmail === admin);

  if (foundTeamA) {
    teamA_id = foundTeamA.teamId;
    teamA_sheetName = foundTeamA.availabilitySheetName;
    teamAJoinCode = foundTeamA.joinCode;
    _scenarioLog(`Using existing Team A (ID: ${teamA_id}, Name: ${foundTeamA.teamName}, Sheet: ${teamA_sheetName}).`);
    if (!isPlayerOnTeam(p1.email, teamA_id)) {
      _scenarioLog(`Player ${p1.email} not on Team A. Adding now...`);
      let joinP1Result = joinTeamByCode(p1.email, teamAJoinCode, p1.name, p1.initials);
      if (!assert(joinP1Result.success, `Player ${p1.email} joined existing Team A. Msg: ${joinP1Result.message}`)) {
        logTestSummary(SCENARIO_NAME); return;
      }
    } else {
      _scenarioLog(`Player ${p1.email} confirmed on Team A.`);
    }
  } else {
    _scenarioLog(`Team A ("${TEST_CONFIG.TEAM_A_NAME}" led by ${admin}) not found. Creating it now for the test.`);
    const teamCreationData = { teamName: TEST_CONFIG.TEAM_A_NAME, division: TEST_CONFIG.TEAM_A_DIVISION };
    let creationResult = createNewTeam(teamCreationData, "CA", "TeamACreator");
    if (!assert(creationResult.success && creationResult.team, `Team "${TEST_CONFIG.TEAM_A_NAME}" created for test. Join Code: ${creationResult.team ? creationResult.team.joinCode : 'N/A'}`)) {
      logTestSummary(SCENARIO_NAME); return;
    }
    teamA_id = creationResult.team.teamId;
    teamA_sheetName = creationResult.team.availabilitySheetName;
    teamAJoinCode = creationResult.team.joinCode;

    _scenarioLog(`Team A created with ID: ${teamA_id}. Now adding P1 (${p1.email}) to it.`);
    let joinP1Result = joinTeamByCode(p1.email, teamAJoinCode, p1.name, p1.initials);
    if (!assert(joinP1Result.success, `Player ${p1.email} joined newly created Team A for test. Msg: ${joinP1Result.message}`)) {
      logTestSummary(SCENARIO_NAME); return;
    }
  }

  const teamSheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(teamA_sheetName);
  if (!assert(teamSheet, `Availability sheet ${teamA_sheetName} for Team A exists.`)) {
    logTestSummary(SCENARIO_NAME); return;
  }

  let currentBlock = findWeekBlock(teamSheet, TEST_CONFIG.TEST_AVAILABILITY_YEAR, TEST_CONFIG.TEST_AVAILABILITY_CURRENT_WEEK);
  if (!currentBlock) {
      ensureWeekExists(teamSheet, TEST_CONFIG.TEST_AVAILABILITY_YEAR, TEST_CONFIG.TEST_AVAILABILITY_CURRENT_WEEK);
      currentBlock = findWeekBlock(teamSheet, TEST_CONFIG.TEST_AVAILABILITY_YEAR, TEST_CONFIG.TEST_AVAILABILITY_CURRENT_WEEK);
  }
  if (assert(currentBlock, "Current week block exists or was created for Team A.")) {
    const slot1 = { row: currentBlock.startRow + 1, col: BLOCK_CONFIG.LAYOUT.DAYS_START_COLUMN + 1 + 0 };
    availabilityManager_updatePlayerAvailability_SERVICE(p1.email, teamA_id, "add", [slot1]);
    _scenarioLog(`Added sample availability for ${p1.email} on Team A for testing clear.`);
    verifyAvailability(teamA_sheetName, currentBlock.year, currentBlock.weekNumber, p1.initials, "present");
  } else {
    _scenarioLog("Could not find/create current week block for Team A. Skipping availability add for clear test.", true);
  }

  let pastBlock = findWeekBlock(teamSheet, TEST_CONFIG.TEST_AVAILABILITY_PAST_YEAR, TEST_CONFIG.TEST_AVAILABILITY_PAST_WEEK);
  if (!pastBlock) {
      ensureWeekExists(teamSheet, TEST_CONFIG.TEST_AVAILABILITY_PAST_YEAR, TEST_CONFIG.TEST_AVAILABILITY_PAST_WEEK);
      pastBlock = findWeekBlock(teamSheet, TEST_CONFIG.TEST_AVAILABILITY_PAST_YEAR, TEST_CONFIG.TEST_AVAILABILITY_PAST_WEEK);
  }
  if (pastBlock) {
    const pastSlot = {row: pastBlock.startRow, col: BLOCK_CONFIG.LAYOUT.DAYS_START_COLUMN + 1 + 0};
    availabilityManager_updatePlayerAvailability_SERVICE(p1.email, teamA_id, "add", [pastSlot]);
    _scenarioLog(`Added sample past availability for ${p1.email} on Team A.`);
    verifyAvailability(teamA_sheetName, pastBlock.year, pastBlock.weekNumber, p1.initials, "present");
  }

  _scenarioLog(`Step 1: Player 1 (${p1.email}) leaves Team A (${teamA_id}).`);
  let leaveP1Result = leaveTeam(p1.email, teamA_id, p1.email);

  assert(leaveP1Result.success, `P1 leaves Team A. Msg: ${leaveP1Result.message}`);
  if(leaveP1Result.success) {
      const p1TeamsPostLeave = getUserTeams(p1.email);
      assert(!p1TeamsPostLeave.find(t=>t.teamId === teamA_id), `P1 no longer listed on Team A via getUserTeams. Found: ${JSON.stringify(p1TeamsPostLeave)}`);
      
      const updatedTeamAData = getTeamData(teamA_id);
      if(assert(updatedTeamAData, `Team A data still exists after P1 leaves.`)){
          assert(updatedTeamAData.playerList.indexOf(p1.name) === -1, `P1 name removed from Team A playerList. Current list: ${updatedTeamAData.playerList.join(', ')}`);
          assert(updatedTeamAData.initialsList.indexOf(p1.initials) === -1 || updatedTeamAData.initialsList.filter(i => i === p1.initials).length === 0 , `P1 initials removed/reduced from Team A initialsList. Current list: ${updatedTeamAData.initialsList.join(', ')}`);
      }
      _scenarioLog("Step 1.1: Verifying P1 availability cleared (current/future), kept (past).");
      verifyAvailability(teamA_sheetName, TEST_CONFIG.TEST_AVAILABILITY_YEAR, TEST_CONFIG.TEST_AVAILABILITY_CURRENT_WEEK, p1.initials, "absent");
      verifyAvailability(teamA_sheetName, TEST_CONFIG.TEST_AVAILABILITY_NEXT_WEEK_YEAR, TEST_CONFIG.TEST_AVAILABILITY_NEXT_WEEK, p1.initials, "absent");
      if(pastBlock) verifyAvailability(teamA_sheetName, TEST_CONFIG.TEST_AVAILABILITY_PAST_YEAR, TEST_CONFIG.TEST_AVAILABILITY_PAST_WEEK, p1.initials, "present");
  }

  _scenarioLog(`Step 2: Re-add Player 1 (${p1.email}) to Team A (${teamA_id}) for deactivation test.`);
  if (!teamAJoinCode) {
      const teamARecheck = getTeamData(teamA_id);
      if (teamARecheck) teamAJoinCode = teamARecheck.joinCode;
  }
  if (!assert(teamAJoinCode, `Join code for Team A (${teamA_id}) is available: ${teamAJoinCode}`)) {
      logTestSummary(SCENARIO_NAME); return;
  }

  let rejoinP1Result = joinTeamByCode(p1.email, teamAJoinCode, p1.name, p1.initials);
  assert(rejoinP1Result.success, `P1 re-joined Team A. Msg: ${rejoinP1Result.message}`);

  if (currentBlock) {
      const slot1ReAdd = { row: currentBlock.startRow + 1, col: BLOCK_CONFIG.LAYOUT.DAYS_START_COLUMN + 1 + 0 };
      availabilityManager_updatePlayerAvailability_SERVICE(p1.email, teamA_id, "add", [slot1ReAdd]);
      _scenarioLog(`Re-added sample availability for ${p1.email} on Team A for deactivation test.`);
      verifyAvailability(teamA_sheetName, currentBlock.year, currentBlock.weekNumber, p1.initials, "present");
  }

  _scenarioLog(`Step 3: Admin (${admin}) deactivates Player 1 (${p1.email}).`);
  let deactivateP1Result = deactivatePlayer(p1.email, admin);

  assert(deactivateP1Result.success, `Admin deactivates P1. Msg: ${deactivateP1Result.message}`);
  if (deactivateP1Result.success) {
      verifyPlayerData(p1.email, { isActive: false });
      const p1TeamsPostDeactivation = getUserTeams(p1.email);
      assert(!p1TeamsPostDeactivation.find(t=>t.teamId === teamA_id), `P1 no longer listed on Team A via getUserTeams after deactivation. Found: ${JSON.stringify(p1TeamsPostDeactivation)}`);

      _scenarioLog("Step 3.1: Verifying P1 availability cleared again after deactivation (current/future), kept (past).");
      verifyAvailability(teamA_sheetName, TEST_CONFIG.TEST_AVAILABILITY_YEAR, TEST_CONFIG.TEST_AVAILABILITY_CURRENT_WEEK, p1.initials, "absent");
      verifyAvailability(teamA_sheetName, TEST_CONFIG.TEST_AVAILABILITY_NEXT_WEEK_YEAR, TEST_CONFIG.TEST_AVAILABILITY_NEXT_WEEK, p1.initials, "absent");
      if(pastBlock) verifyAvailability(teamA_sheetName, TEST_CONFIG.TEST_AVAILABILITY_PAST_YEAR, TEST_CONFIG.TEST_AVAILABILITY_PAST_WEEK, p1.initials, "present");
  }

  _scenarioLog(`Step 4: Cleanup (No specific team archive here, rely on comprehensive cleanup or ensure ZZZ Test Team Alpha is handled).`);
  logTestSummary(SCENARIO_NAME);
}

function testScenario_AdminFunctionsAndTeamArchival(){
    const SCENARIO_NAME = "SCENARIO: Admin Functions & Team Archival/Deletion";
    startScenario(SCENARIO_NAME);
    const admin = TEST_CONFIG.ADMIN_EMAIL;
    const p1 = { email: TEST_CONFIG.PLAYER1_EMAIL, name: TEST_CONFIG.PLAYER1_DISPLAY_NAME, initials: TEST_CONFIG.PLAYER1_INITIALS_TEAM_B };
    const p2 = { email: TEST_CONFIG.PLAYER2_EMAIL, name: TEST_CONFIG.PLAYER2_DISPLAY_NAME, initials: TEST_CONFIG.PLAYER2_INITIALS_TEAM_B };
    let teamB_id, teamB_joinCode;

    _scenarioLog("Step 1: Setup Team B with P1 as leader, P2 as member.");
    const teamBCreationData = {teamName: TEST_CONFIG.TEAM_B_NAME, division: TEST_CONFIG.TEAM_B_DIVISION, leaderEmail: p1.email};
    let result = createTeam(teamBCreationData, admin);
    if(!assert(result.success && result.team, `Admin creates ${TEST_CONFIG.TEAM_B_NAME}.`)) { logTestSummary(SCENARIO_NAME); return; }
    teamB_id = result.team.teamId; teamB_joinCode = result.team.joinCode;

    createPlayer({googleEmail:p1.email, displayName: p1.name});
    joinTeamByCode(p1.email, teamB_joinCode, p1.name, p1.initials);
    adminSetTeamLeader(teamB_id, p1.email, admin);

    createPlayer({googleEmail:p2.email, displayName: p2.name});
    joinTeamByCode(p2.email, teamB_joinCode, p2.name, p2.initials);

    verifyTeamData(teamB_id, {leaderEmail: p1.email, playerCount: 2});
    verifyPlayerData(p1.email, {roleInTeam: ROLES.TEAM_LEADER}, {teamId: teamB_id});
    verifyPlayerData(p2.email, {roleInTeam: ROLES.PLAYER}, {teamId: teamB_id});

  _scenarioLog(`Step 2: Admin (${admin}) changes leader of Team B (${teamB_id}) from ${p1.email} to ${p2.email}.`);
  let resultOfLeaderChange = core_adminSetTeamLeader(teamB_id, p2.email, admin);

  assert(
    resultOfLeaderChange.success,
    `Admin changes leader of Team B to ${p2.email}. Old leader was: ${resultOfLeaderChange.oldLeader !== undefined ? resultOfLeaderChange.oldLeader : 'N/A_PROPERTY_MISSING'}`
  );

  if(resultOfLeaderChange.success) {
      verifyTeamData(teamB_id, { leaderEmail: p2.email });
      const p1Data = getPlayerDataByEmail(p1.email, true);
      if (assert(p1Data, `Player data for former leader ${p1.email} found.`)) {
          let p1RoleCorrect = false;
          if (p1Data.team1 && p1Data.team1.teamId === teamB_id) p1RoleCorrect = p1Data.team1.role === ROLES.PLAYER;
          else if (p1Data.team2 && p1Data.team2.teamId === teamB_id) p1RoleCorrect = p1Data.team2.role === ROLES.PLAYER;
          assert(p1RoleCorrect, `Former leader ${p1.email} is now PLAYER in team ${teamB_id}.`);
      }

      const p2Data = getPlayerDataByEmail(p2.email, true);
      if (assert(p2Data, `Player data for new leader ${p2.email} found.`)) {
          let p2RoleCorrect = false;
          if (p2Data.team1 && p2Data.team1.teamId === teamB_id) p2RoleCorrect = p2Data.team1.role === ROLES.TEAM_LEADER;
          else if (p2Data.team2 && p2Data.team2.teamId === teamB_id) p2RoleCorrect = p2Data.team2.role === ROLES.TEAM_LEADER;
          assert(p2RoleCorrect, `New leader ${p2.email} is now TEAM_LEADER in team ${teamB_id}.`);
      }
  } else {
      _scenarioLog(`Leader change failed for Team B. Result: ${JSON.stringify(resultOfLeaderChange)}`, true);
  }

  _scenarioLog(`Step 3: Admin (${admin}) archives Team B (${teamB_id}).`);
  let archiveResult = archiveTeam(teamB_id, admin);

  assert(
    archiveResult.success && archiveResult.archivedSheetName,
    `Admin archives Team B. Archived sheet name: ${archiveResult.archivedSheetName !== undefined ? archiveResult.archivedSheetName : 'N/A_PROPERTY_MISSING'}.`
  );

  if(archiveResult.success){
    verifyTeamData(teamB_id, { isActive: false, availabilitySheetName: archiveResult.archivedSheetName });
    const teamDataAfterArchive = getTeamData(teamB_id, true);
    if(teamDataAfterArchive){
        assert(teamDataAfterArchive.playerCount === 0, `Player count for archived team ${teamB_id} is 0.`);
        assert(teamDataAfterArchive.playerList.length === 0, `Player list for archived team ${teamB_id} is empty.`);
        assert(teamDataAfterArchive.initialsList.length === 0, `Initials list for archived team ${teamB_id} is empty.`);
    }
  } else {
    _scenarioLog(`Archiving Team B failed. Result: ${JSON.stringify(archiveResult)}`, true);
  }

  _scenarioLog(`Step 4: Admin (${admin}) hard-deletes archived Team B (${teamB_id}).`);
  if (archiveResult.success) {
      let hardDeleteResult = hardDeleteArchivedTeam(teamB_id, admin);
      assert(hardDeleteResult.success, `Admin hard-deletes Team B. Message: ${hardDeleteResult.message}`);
      if(hardDeleteResult.success) {
          assert(getTeamData(teamB_id, true) === null, `Team B (${teamB_id}) successfully removed from Teams sheet after hard delete.`);
          const deletedSheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(archiveResult.archivedSheetName);
          assert(deletedSheet === null, `Archived sheet ${archiveResult.archivedSheetName} successfully deleted.`);
      }
  } else {
      _scenarioLog("Skipping hard delete because team archival failed or team was not inactive.");
  }

  logTestSummary(SCENARIO_NAME);
}

function testScenario_ScheduledWeekProvisioning() {
    const SCENARIO_NAME = "SCENARIO: Scheduled Task - Future Week Provisioning";
    startScenario(SCENARIO_NAME);
    const admin = TEST_CONFIG.ADMIN_EMAIL;
    let teamC_id, teamC_sheetName;

    _scenarioLog("Step 1: Setup Team C.");
    const teamCCreationData = { teamName: TEST_CONFIG.TEAM_C_NAME, division: TEST_CONFIG.TEAM_C_DIVISION, leaderEmail: admin };
    let result = createTeam(teamCCreationData, admin);
    if (!assert(result.success && result.team, `Admin creates ${TEST_CONFIG.TEAM_C_NAME}.`)) { logTestSummary(SCENARIO_NAME); return; }
    teamC_id = result.team.teamId; teamC_sheetName = result.team.availabilitySheetName;
    
    _scenarioLog("Step 2: Manually calling ensureFutureWeekBlocksForAllActiveTeams().");
    ensureFutureWeekBlocksForAllActiveTeams();
    
    _scenarioLog("Step 3: Verifying Team C's availability sheet.");
    const teamCSheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(teamC_sheetName);
    if (assert(teamCSheet, `Sheet ${teamC_sheetName} exists.`)) {
        const blocks = _scanSheetForAllWeekBlocks(teamCSheet);
        const expectedMinBlockCount = BLOCK_CONFIG.TEAM_SETTINGS.MAX_WEEKS_PER_TEAM || 4;
        assert(blocks.length >= expectedMinBlockCount, `Team C has at least ${expectedMinBlockCount} blocks (Found: ${blocks.length}).`);
        if (blocks.length > 0) { /* ... more detailed block checks ... */ }
    }
    logTestSummary(SCENARIO_NAME);
}

function testScenario_LeaderCannotLeaveTeam() {
  const SCENARIO_NAME = "SCENARIO: Leader Cannot Leave Team";
  startScenario(SCENARIO_NAME);

  const scriptRunnerAdminEmail = TEST_CONFIG.ADMIN_EMAIL;
  const intendedTestLeaderEmail = TEST_CONFIG.PLAYER2_EMAIL;
  const intendedTestLeaderInitials = TEST_CONFIG.PLAYER2_INITIALS_TEAM_A || "L2";
  const intendedTestLeaderDisplayName = TEST_CONFIG.PLAYER2_DISPLAY_NAME || "Test Leader P2";

  const testTeamName = "ZZZ Test Team LeaderLeave";
  let testTeamId = null;
  let testTeamJoinCode = null;

  _scenarioLog(`Step 1: Setup - Create a new team. Initial leader will be script runner: ${scriptRunnerAdminEmail}.`);
  const teamCreationData = { teamName: testTeamName, division: "1" };
  let creationResult = createNewTeam(teamCreationData, "SA", "Script Admin");

  if (!assert(creationResult.success && creationResult.team, `Team "${testTeamName}" created with ${scriptRunnerAdminEmail} as initial leader. Join Code: ${creationResult.team ? creationResult.team.joinCode : 'N/A'}`)) {
    logTestSummary(SCENARIO_NAME); return;
  }
  testTeamId = creationResult.team.teamId;
  testTeamJoinCode = creationResult.team.joinCode;
  _scenarioLog(`Team ID for LeaderLeaveTest: ${testTeamId}, Join Code: ${testTeamJoinCode}`);

  _scenarioLog(`Step 1b: Intended leader (${intendedTestLeaderEmail}) joins the team as a regular player first.`);
  createPlayer({ googleEmail: intendedTestLeaderEmail, displayName: intendedTestLeaderDisplayName });
  let p2JoinResult = joinTeamByCode(intendedTestLeaderEmail, testTeamJoinCode, intendedTestLeaderDisplayName, intendedTestLeaderInitials);

  if (!assert(p2JoinResult.success, `Intended leader ${intendedTestLeaderEmail} joined team ${testTeamId} as a player. Msg: ${p2JoinResult.message}`)) {
    logTestSummary(SCENARIO_NAME); return;
  }

  _scenarioLog(`Step 1c: Script runner (${scriptRunnerAdminEmail}) promotes ${intendedTestLeaderEmail} to leader of team ${testTeamId}.`);
  let promoteResult = core_adminSetTeamLeader(testTeamId, intendedTestLeaderEmail, scriptRunnerAdminEmail);

  if (!assert(promoteResult.success, `Leadership of team ${testTeamId} transferred to ${intendedTestLeaderEmail}. Msg: ${promoteResult.message}`)) {
    logTestSummary(SCENARIO_NAME); return;
  }

  verifyTeamData(testTeamId, { leaderEmail: intendedTestLeaderEmail });
  const leaderPlayerData = getPlayerDataByEmail(intendedTestLeaderEmail, true);
  if (assert(leaderPlayerData, `Player data found for new leader ${intendedTestLeaderEmail}.`)) {
    let isLeader = false;
    if (leaderPlayerData.team1 && leaderPlayerData.team1.teamId === testTeamId) isLeader = leaderPlayerData.team1.role === ROLES.TEAM_LEADER;
    else if (leaderPlayerData.team2 && leaderPlayerData.team2.teamId === testTeamId) isLeader = leaderPlayerData.team2.role === ROLES.TEAM_LEADER;
    assert(isLeader, `User ${intendedTestLeaderEmail} is now TEAM_LEADER of team ${testTeamId}.`);
  } else {
    logTestSummary(SCENARIO_NAME); return;
  }

  const scriptRunnerData = getPlayerDataByEmail(scriptRunnerAdminEmail, true);
  if(scriptRunnerData){
      let runnerRoleCorrect = false;
      if(scriptRunnerData.team1 && scriptRunnerData.team1.teamId === testTeamId) runnerRoleCorrect = scriptRunnerData.team1.role === ROLES.PLAYER;
      else if(scriptRunnerData.team2 && scriptRunnerData.team2.teamId === testTeamId) runnerRoleCorrect = scriptRunnerData.team2.role === ROLES.PLAYER;
      else if (!scriptRunnerData.team1.teamId && !scriptRunnerData.team2.teamId && scriptRunnerData.team1.teamId !== testTeamId && scriptRunnerData.team2.teamId !== testTeamId) runnerRoleCorrect = true;
      assert(runnerRoleCorrect, `Former leader ${scriptRunnerAdminEmail} is now PLAYER (or no longer leader) on team ${testTeamId}.`);
  }

  _scenarioLog(`Step 2: Leader (${intendedTestLeaderEmail}) attempts to leave team ${testTeamId}. This should fail.`);
  let leaveResult = leaveTeam(intendedTestLeaderEmail, testTeamId, intendedTestLeaderEmail);

  assert(
    leaveResult.success === false &&
    leaveResult.message &&
    leaveResult.message.toLowerCase().includes("team leaders cannot leave their team"),
    `Leader ${intendedTestLeaderEmail} leave attempt correctly failed. Message: ${leaveResult.message}`
  );

  _scenarioLog(`Step 3: Verify leader ${intendedTestLeaderEmail} is still the leader and member of team ${testTeamId}.`);
  verifyTeamData(testTeamId, { leaderEmail: intendedTestLeaderEmail });

  const leaderPlayerDataAfter = getPlayerDataByEmail(intendedTestLeaderEmail, true);
  if (assert(leaderPlayerDataAfter, `Player data for ${intendedTestLeaderEmail} still found after leave attempt.`)) {
    let isStillLeader = false;
    let isStillMember = false;
    if (leaderPlayerDataAfter.team1 && leaderPlayerDataAfter.team1.teamId === testTeamId) {
      isStillLeader = leaderPlayerDataAfter.team1.role === ROLES.TEAM_LEADER;
      isStillMember = true;
    } else if (leaderPlayerDataAfter.team2 && leaderPlayerDataAfter.team2.teamId === testTeamId) {
      isStillLeader = leaderPlayerDataAfter.team2.role === ROLES.TEAM_LEADER;
      isStillMember = true;
    }
    assert(isStillLeader, `User ${intendedTestLeaderEmail} is STILL TEAM_LEADER of team ${testTeamId}.`);
    assert(isStillMember, `User ${intendedTestLeaderEmail} is STILL a member of team ${testTeamId}.`);
  }

  _scenarioLog(`Step 4: Cleanup - Script runner (${scriptRunnerAdminEmail}) archives team ${testTeamId}`);
  if (testTeamId) {
    let archiveResult = archiveTeam(testTeamId, scriptRunnerAdminEmail);
    assert(archiveResult.success, `Test team ${testTeamId} archived for cleanup by admin. Message: ${archiveResult.message}`);
  }

  logTestSummary(SCENARIO_NAME);
}

function testScenario_LeaderHandover() {
  const SCENARIO_NAME = "SCENARIO: Team Leader Handover by Current Leader";
  startScenario(SCENARIO_NAME);

  const scriptRunnerAdmin = TEST_CONFIG.ADMIN_EMAIL;
  const initialLeaderEmail = TEST_CONFIG.PLAYER1_EMAIL;
  const initialLeaderInitials = TEST_CONFIG.PLAYER1_INITIALS_TEAM_A || "L1";
  const initialLeaderName = TEST_CONFIG.PLAYER1_DISPLAY_NAME || "Test Leader P1";

  const newLeaderEmail = TEST_CONFIG.PLAYER2_EMAIL;
  const newLeaderInitials = TEST_CONFIG.PLAYER2_INITIALS_TEAM_A || "L2";
  const newLeaderName = TEST_CONFIG.PLAYER2_DISPLAY_NAME || "Test Leader P2";

  const testTeamName = "ZZZ Test Leader Handover";
  let testTeamId = null;
  let testTeamJoinCode = null;

  _scenarioLog(`Step 1: Script Runner (${scriptRunnerAdmin}) creates team "${testTeamName}".`);
  const teamCreationData = { teamName: testTeamName, division: "1" };
  let creationResult = createNewTeam(teamCreationData, "SA", "ScriptAdmin");

  if (!assert(creationResult.success && creationResult.team, `Team "${testTeamName}" created. Initial leader: ${scriptRunnerAdmin}. Join Code: ${creationResult.team ? creationResult.team.joinCode : 'N/A'}`)) {
    logTestSummary(SCENARIO_NAME); return;
  }
  testTeamId = creationResult.team.teamId;
  testTeamJoinCode = creationResult.team.joinCode;
  _scenarioLog(`Team ID for Handover Test: ${testTeamId}`);

  _scenarioLog(`Step 2a: ${initialLeaderEmail} (future initial leader) joins team ${testTeamId}.`);
  createPlayer({ googleEmail: initialLeaderEmail, displayName: initialLeaderName });
  let p1JoinResult = joinTeamByCode(initialLeaderEmail, testTeamJoinCode, initialLeaderName, initialLeaderInitials);
  assert(p1JoinResult.success, `${initialLeaderEmail} joined team. Msg: ${p1JoinResult.message}`);

  _scenarioLog(`Step 2b: ${newLeaderEmail} (future new leader) joins team ${testTeamId}.`);
  createPlayer({ googleEmail: newLeaderEmail, displayName: newLeaderName });
  let p2JoinResult = joinTeamByCode(newLeaderEmail, testTeamJoinCode, newLeaderName, newLeaderInitials);
  assert(p2JoinResult.success, `${newLeaderEmail} joined team. Msg: ${p2JoinResult.message}`);

  verifyTeamData(testTeamId, { leaderEmail: scriptRunnerAdmin, playerCount: 3 });

  _scenarioLog(`Step 3: Script Runner (${scriptRunnerAdmin}) promotes ${initialLeaderEmail} to leader of team ${testTeamId}.`);
  let promoteP1Result = core_adminSetTeamLeader(testTeamId, initialLeaderEmail, scriptRunnerAdmin);
  if (!assert(promoteP1Result.success, `Promotion of ${initialLeaderEmail} to leader. Msg: ${promoteP1Result.message}`)) {
    logTestSummary(SCENARIO_NAME); return;
  }
  verifyTeamData(testTeamId, { leaderEmail: initialLeaderEmail });
  _scenarioLog(`${initialLeaderEmail} is now confirmed leader of ${testTeamId}.`);

  _scenarioLog(`Step 4: Current Leader (${initialLeaderEmail}) attempts to hand over leadership to ${newLeaderEmail}.`);
  let handoverResult = core_adminSetTeamLeader(testTeamId, newLeaderEmail, initialLeaderEmail);

  assert(handoverResult.success, `Leadership handover from ${initialLeaderEmail} to ${newLeaderEmail}. Msg: ${handoverResult.message}`);
  if (!handoverResult.success) {
      logTestSummary(SCENARIO_NAME); return;
  }

  _scenarioLog(`Step 5: Verifying new leadership and roles.`);
  verifyTeamData(testTeamId, { leaderEmail: newLeaderEmail });

  const newLeaderData = getPlayerDataByEmail(newLeaderEmail, true);
  if (assert(newLeaderData, `Player data for new leader ${newLeaderEmail} found.`)) {
    let isNewLeaderRoleCorrect = false;
    if (newLeaderData.team1 && newLeaderData.team1.teamId === testTeamId) isNewLeaderRoleCorrect = newLeaderData.team1.role === ROLES.TEAM_LEADER;
    else if (newLeaderData.team2 && newLeaderData.team2.teamId === testTeamId) isNewLeaderRoleCorrect = newLeaderData.team2.role === ROLES.TEAM_LEADER;
    assert(isNewLeaderRoleCorrect, `${newLeaderEmail} is now TEAM_LEADER of team ${testTeamId} in Players sheet.`);
  }

  const formerLeaderData = getPlayerDataByEmail(initialLeaderEmail, true);
  if (assert(formerLeaderData, `Player data for former leader ${initialLeaderEmail} found.`)) {
    let isFormerLeaderRoleCorrect = false;
    if (formerLeaderData.team1 && formerLeaderData.team1.teamId === testTeamId) isFormerLeaderRoleCorrect = formerLeaderData.team1.role === ROLES.PLAYER;
    else if (formerLeaderData.team2 && formerLeaderData.team2.teamId === testTeamId) isFormerLeaderRoleCorrect = formerLeaderData.team2.role === ROLES.PLAYER;
    assert(isFormerLeaderRoleCorrect, `${initialLeaderEmail} is now PLAYER in team ${testTeamId} in Players sheet.`);
  }

  _scenarioLog(`Step 6: Cleanup - Script runner (${scriptRunnerAdmin}) archives team ${testTeamId}`);
  if (testTeamId) {
    let archiveResult = archiveTeam(testTeamId, scriptRunnerAdmin);
    assert(archiveResult.success, `Test team ${testTeamId} archived for cleanup. Message: ${archiveResult.message}`);
  }

  logTestSummary(SCENARIO_NAME);
}

function testScenario_FixedInitials() {
  const SCENARIO_NAME = "SCENARIO: Fixed Initials After First Set";
  startScenario(SCENARIO_NAME);

  const scriptRunnerAdmin = TEST_CONFIG.ADMIN_EMAIL;
  const testPlayerEmail = TEST_CONFIG.PLAYER1_EMAIL;
  const testPlayerName = TEST_CONFIG.PLAYER1_DISPLAY_NAME;
  const initialSetInitials = "S1";
  const attemptedChangeInitials = "S2";

  const testTeamName = "ZZZ Test FixedInitials";
  let testTeamId = null;
  let testTeamJoinCode = null;

  _scenarioLog(`Step 1: Setup - ${scriptRunnerAdmin} creates team "${testTeamName}".`);
  const teamCreationData = { teamName: testTeamName, division: "1" };
  let creationResult = createNewTeam(teamCreationData, "CA", "CreatorAdmin");

  if (!assert(creationResult.success && creationResult.team, `Team "${testTeamName}" created. Join Code: ${creationResult.team ? creationResult.team.joinCode : 'N/A'}`)) {
    logTestSummary(SCENARIO_NAME); return;
  }
  testTeamId = creationResult.team.teamId;
  testTeamJoinCode = creationResult.team.joinCode;
  _scenarioLog(`Team ID for FixedInitials Test: ${testTeamId}`);

  _scenarioLog(`Step 1b: ${testPlayerEmail} joins team ${testTeamId} with initials "${initialSetInitials}".`);
  createPlayer({ googleEmail: testPlayerEmail, displayName: testPlayerName });
  let joinResult = joinTeamByCode(testPlayerEmail, testTeamJoinCode, testPlayerName, initialSetInitials);

  if (!assert(joinResult.success, `${testPlayerEmail} joined team with initials "${initialSetInitials}". Msg: ${joinResult.message}`)) {
    logTestSummary(SCENARIO_NAME); return;
  }

  let playerData = getPlayerDataByEmail(testPlayerEmail, true);
  let p1InitialsCorrect = false;
  if (playerData) {
    if (playerData.team1 && playerData.team1.teamId === testTeamId) p1InitialsCorrect = playerData.team1.initials === initialSetInitials;
    else if (playerData.team2 && playerData.team2.teamId === testTeamId) p1InitialsCorrect = playerData.team2.initials === initialSetInitials;
  }
  assert(p1InitialsCorrect, `${testPlayerEmail} has initials "${initialSetInitials}" set for team ${testTeamId}.`);

  _scenarioLog(`Step 2: ${testPlayerEmail} attempts to change their own initials to "${attemptedChangeInitials}" for team ${testTeamId}. This should be logged as denied/skipped.`);
  let selfUpdateResult = updatePlayer(testPlayerEmail, { initials: attemptedChangeInitials, teamId: testTeamId }, testPlayerEmail);

  assert(selfUpdateResult.success, `Call to updatePlayer by self for initials change processed (may or may not change initials). Msg: ${selfUpdateResult.message}`);

  playerData = getPlayerDataByEmail(testPlayerEmail, true);
  p1InitialsCorrect = false;
  if (playerData) {
    if (playerData.team1 && playerData.team1.teamId === testTeamId) p1InitialsCorrect = playerData.team1.initials === initialSetInitials;
    else if (playerData.team2 && playerData.team2.teamId === testTeamId) p1InitialsCorrect = playerData.team2.initials === initialSetInitials;
  }
  assert(p1InitialsCorrect, `VERIFY SELF-CHANGE: ${testPlayerEmail}'s initials for team ${testTeamId} remain "${initialSetInitials}" (not changed to "${attemptedChangeInitials}").`);

  _scenarioLog(`Step 3: Admin (${scriptRunnerAdmin}) attempts to change ${testPlayerEmail}'s initials to "${attemptedChangeInitials}" for team ${testTeamId}. This should be logged as denied/skipped.`);
  let adminUpdateResult = updatePlayer(testPlayerEmail, { initials: attemptedChangeInitials, teamId: testTeamId }, scriptRunnerAdmin);

  assert(adminUpdateResult.success, `Call to updatePlayer by admin for initials change processed. Msg: ${adminUpdateResult.message}`);

  playerData = getPlayerDataByEmail(testPlayerEmail, true);
  p1InitialsCorrect = false;
  if (playerData) {
    if (playerData.team1 && playerData.team1.teamId === testTeamId) p1InitialsCorrect = playerData.team1.initials === initialSetInitials;
    else if (playerData.team2 && playerData.team2.teamId === testTeamId) p1InitialsCorrect = playerData.team2.initials === initialSetInitials;
  }
  assert(p1InitialsCorrect, `VERIFY ADMIN-CHANGE: ${testPlayerEmail}'s initials for team ${testTeamId} STILL remain "${initialSetInitials}" (not changed by admin).`);

  _scenarioLog(`Step 4: Cleanup - Admin (${scriptRunnerAdmin}) archives team ${testTeamId}`);
  if (testTeamId) {
    let archiveResult = archiveTeam(testTeamId, scriptRunnerAdmin);
    assert(archiveResult.success, `Test team ${testTeamId} archived for cleanup. Message: ${archiveResult.message}`);
  }

  logTestSummary(SCENARIO_NAME);
}

// Debug function to test data flow
function debugTestUserContext() {
  const CONTEXT = "DEBUG.testUserContext";
  
  try {
    // Test 1: Check if getUserContext works
    console.log("=== TEST 1: Getting User Context ===");
    const context = getUserContext();
    console.log("User authenticated:", context.isAuthenticated);
    console.log("User email:", context.userEmail);
    console.log("Number of teams:", context.teams ? context.teams.length : 0);
    
    // Test 2: Check if schedule data is included
    console.log("\n=== TEST 2: Schedule Data ===");
    if (context.schedule) {
      console.log("Schedule exists:", !!context.schedule);
      console.log("Schedule success:", context.schedule.success);
      console.log("Number of weeks:", context.schedule.weeks ? context.schedule.weeks.length : 0);
      
      if (context.schedule.weeks && context.schedule.weeks.length > 0) {
        console.log("\nWeek details:");
        context.schedule.weeks.forEach((week, index) => {
          console.log(`Week ${index + 1}: ${week.year}-W${week.weekNumber}`);
        });
      }
    } else {
      console.log("NO SCHEDULE DATA FOUND!");
    }
    
    // Test 3: Check the template rendering
    console.log("\n=== TEST 3: Template Data ===");
    const template = HtmlService.createTemplateFromFile('index');
    template.userContextFromServer = context;
    template.BLOCK_CONFIG = BLOCK_CONFIG;
    template.ROLES = ROLES;
    
    // Check if the template can access the data
    const templateOutput = template.evaluate().getContent();
    const hasUserContext = templateOutput.includes('window.userContextFromServer');
    const hasScheduleData = templateOutput.includes('"weeks":[');
    
    console.log("Template includes userContext:", hasUserContext);
    console.log("Template includes schedule data:", hasScheduleData);
    
    // Test 4: Return summary
    return {
      userAuthenticated: context.isAuthenticated,
      userEmail: context.userEmail,
      teamsCount: context.teams ? context.teams.length : 0,
      scheduleExists: !!context.schedule,
      weeksCount: context.schedule && context.schedule.weeks ? context.schedule.weeks.length : 0,
      templateRendersData: hasUserContext && hasScheduleData
    };
    
  } catch (e) {
    console.error(`Error in ${CONTEXT}:`, e.message);
    console.error("Stack trace:", e.stack);
    return {
      error: e.message,
      stack: e.stack
    };
  }
}

// Also add this simpler test
function debugCheckScheduleInContext() {
  const context = getUserContext();
  
  console.log("=== SCHEDULE CHECK ===");
  console.log("1. Context has schedule?", !!context.schedule);
  console.log("2. Schedule has weeks?", !!(context.schedule && context.schedule.weeks));
  console.log("3. Number of weeks:", context.schedule && context.schedule.weeks ? context.schedule.weeks.length : 0);
  
  if (context.schedule && context.schedule.weeks && context.schedule.weeks.length > 0) {
    console.log("4. First week data:");
    const firstWeek = context.schedule.weeks[0];
    console.log("   - Year:", firstWeek.year);
    console.log("   - Week:", firstWeek.weekNumber);
    console.log("   - Has availability?", !!firstWeek.availability);
  }
  
  return context.schedule ? "Schedule found!" : "No schedule!";
}

/**
 * Tests the new week block structure with merged cells
 */
function testWeekBlockStructure() {
  const CONTEXT = "DebugTests.testWeekBlockStructure";
  try {
    // Create test sheet
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    let testSheet = ss.getSheetByName("TEAM_TEST_SHEET");
    if (!testSheet) {
      testSheet = ss.insertSheet("TEAM_TEST_SHEET");
    }
    
    // Test creating a week block with new structure
    const result = createSingleWeekBlock(testSheet, 50, 2025, 25);
    console.log("Week block created:", result.success);
    
    // Test roster update
    const rosterUpdated = updateWeekBlockRoster(testSheet, 50, "TEAM_TEST_123");
    console.log("Roster updated:", rosterUpdated);
    
    // Test changelog append
    const changelogUpdated = appendToWeekBlockChangelog(testSheet, 50, "Test entry");
    console.log("Changelog updated:", changelogUpdated);
    
    // Test reading roster data
    const rosterData = getWeekBlockRosterData(testSheet, 50);
    console.log("Roster data retrieved:", rosterData.length, "players");
    
    return { success: true, message: "Week block structure tests completed" };
    
  } catch (e) {
    console.error(`${CONTEXT} Error:`, e.message);
    return { success: false, error: e.message };
  }
}