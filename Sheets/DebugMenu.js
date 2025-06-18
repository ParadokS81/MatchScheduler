/**
 * Schedule Manager - Debug Menu & UI Layer
 * Split from Debug.js v2.2.0 (2025-06-07)
 * 
 * Purpose: Menu system, UI wrappers, basic utilities, and configuration
 * Dependencies: Calls functions from DebugSetup.gs, DebugData.gs, DebugTests.gs
 */

// =============================================================================
// ☢️ STREAMLINED MENU SETUP ☢️
// =============================================================================
function onOpen(e) {
  const ui = SpreadsheetApp.getUi();
  
  // Create Advanced Testing submenu
  const advancedTestingMenu = ui.createMenu('🧪 Advanced Testing')
      .addItem('▶️ Run All Individual Tests', 'menu_runAllSystemTests_Sequential')
      .addSeparator()
      .addItem('🧪 Team Creation & Join', 'menu_testScenario_TeamCreationAndJoin')
      .addItem('🧪 Leader Cannot Leave Team', 'menu_testScenario_LeaderCannotLeaveTeam')
      .addItem('🧪 Leader Handover', 'menu_testScenario_LeaderHandover')
      .addItem('🧪 Fixed Initials', 'menu_testScenario_FixedInitials')
      .addItem('🧪 Availability Management', 'menu_testScenario_AvailabilityManagement')
      .addItem('🧪 Player Leave & Deactivation', 'menu_testScenario_PlayerLeaveAndDeactivation')
      .addItem('🧪 Admin Functions & Team Archival', 'menu_testScenario_AdminFunctionsAndTeamArchival')
      .addItem('🧪 Scheduled Week Provisioning', 'menu_testScenario_ScheduledWeekProvisioning');

  // Main menu with streamlined setup
  ui.createMenu('🔴 Admin Debug Menu 🔴')
      .addItem('🔄 Complete Reset & Setup (All 3 Steps)', 'menu_resetComplete_allSteps')
      .addSeparator()
      .addItem('Step 1: 💥 Delete All Data & Sheets', 'menu_resetStep1_deleteAllData')
      .addItem('Step 2: 🏗️ Create Basic Framework', 'menu_resetStep2_createFramework')
      .addItem('Step 3: 🏟️ Populate Multi-Team Test Data', 'menu_resetStep3_populateTestData')
      .addSeparator()
      .addItem('🔍 Verify Test Data Integrity', 'menu_verifyTestDataOnly')
      .addItem('🧹 Clean Up Test Data Only', 'menu_cleanupTestDataOnly')
      .addItem('🔨 Rebuild Player Index', 'debug_rebuildPlayerIndex')
      .addItem('🔨 Rebuild Week Block Index', 'menu_rebuildWeekBlockIndex')
      .addSeparator()
      .addSubMenu(advancedTestingMenu)
      .addSeparator()
      .addItem('⚙️ Initialize Test Config Dates', 'menu_initializeTestConfigDates')
      .addItem('📊 List All Project Triggers (Logs)', 'menu_listAllProjectTriggers')
      .addToUi();
}

// =============================================================================
// 🎛️ MENU WRAPPER FUNCTIONS
// =============================================================================

// Main workflow wrappers (call functions from DebugSetup.gs)
function menu_resetComplete_allSteps() { runAndToast(resetComplete_allSteps, "Complete Reset & Setup"); }
function menu_resetStep1_deleteAllData() { runAndToast(resetStep1_deleteAllData, "Step 1: Delete All Data"); }
function menu_resetStep2_createFramework() { runAndToast(resetStep2_createFramework, "Step 2: Create Framework"); }
function menu_resetStep3_populateTestData() { runAndToast(resetStep3_populateTestData, "Step 3: Populate Test Data"); }

// Verification and cleanup wrappers (call functions from DebugData.gs)
function menu_verifyTestDataOnly() { runAndToast(verifyTestDataOnly, "Verify Test Data"); }
function menu_cleanupTestDataOnly() { runAndToast(comprehensiveCleanupOfTestData, "Clean Up Test Data"); }

// Individual test scenario wrappers (call functions from DebugTests.gs)
function menu_runAllSystemTests_Sequential() { runAndToast(runAllSystemTests_Sequential, "All System Tests (Sequential)"); }
function menu_testScenario_TeamCreationAndJoin() { runAndToast(testScenario_TeamCreationAndJoin, "Team Creation & Join Scenario"); }
function menu_testScenario_LeaderCannotLeaveTeam() { runAndToast(testScenario_LeaderCannotLeaveTeam, "Leader Cannot Leave Team Scenario"); }
function menu_testScenario_LeaderHandover() { runAndToast(testScenario_LeaderHandover, "Leader Handover Scenario"); }
function menu_testScenario_FixedInitials() { runAndToast(testScenario_FixedInitials, "Fixed Initials Scenario"); }
function menu_testScenario_AvailabilityManagement() { runAndToast(testScenario_AvailabilityManagement, "Availability Management Scenario"); }
function menu_testScenario_PlayerLeaveAndDeactivation() { runAndToast(testScenario_PlayerLeaveAndDeactivation, "Player Leave & Deactivation Scenario"); }
function menu_testScenario_AdminFunctionsAndTeamArchival() { runAndToast(testScenario_AdminFunctionsAndTeamArchival, "Admin Functions & Team Archival Scenario"); }
function menu_testScenario_ScheduledWeekProvisioning() { runAndToast(testScenario_ScheduledWeekProvisioning, "Scheduled Week Provisioning Scenario"); }

// Utility wrappers
function menu_initializeTestConfigDates() {
    initializeTestConfigDates(); 
    SpreadsheetApp.getActiveSpreadsheet().toast("Test configuration dates have been initialized/re-initialized.", "Test Config", 5);
}

function menu_listAllProjectTriggers() {
    if (typeof listAllProjectTriggers === 'function') {
        listAllProjectTriggers();
        SpreadsheetApp.getActiveSpreadsheet().toast("Project triggers listed in Execution Logs.", "Triggers Info", 5);
    } else {
        Logger.log("listAllProjectTriggers function not found (expected in ScheduledTasks.gs).");
        try { SpreadsheetApp.getUi().alert("Error", "Function to list triggers not found."); } catch(e){}
    }
}

/**
 * Menu handler for rebuilding week block index
 */
function menu_rebuildWeekBlockIndex() {
  runAndToast(rebuildWeekBlockIndex, "Rebuild Week Block Index");
}

// =============================================================================
// 🎛️ CORE UI HELPER FUNCTIONS
// =============================================================================

/**
 * Universal wrapper for running menu functions with toast notifications and error handling
 */
function runAndToast(funcToRun, name) {
    SpreadsheetApp.getActiveSpreadsheet().toast(`Running: ${name}... Please wait. Check Execution Logs for details.`, name, 7);
    try {
        const result = funcToRun(); 
        const message = result && result.message ? result.message : `${name} finished`;
        SpreadsheetApp.getActiveSpreadsheet().toast(message, `${name} Complete`, 7);
    } catch (e) {
        const errorMessage = `An error occurred while running '${name}'. Please check the execution logs for details.\n\nError: ${e.message}`;
        Logger.log(`ERROR during menu item execution of '${name}': ${e.message}\nFunction: ${(funcToRun && funcToRun.name) || 'anonymous'}\nStack: ${e.stack}`);
        try { SpreadsheetApp.getUi().alert("Execution Error", errorMessage, SpreadsheetApp.getUi().ButtonSet.OK); } 
        catch (uiError) { Logger.log(`Failed to show UI alert for error in ${name}: ${uiError.message}`); }
    }
}

/**
 * Organize sheet ordering: Teams, Players, then team sheets
 */
function organizeSheetOrdering() {
    Logger.log("Organizing sheet order...");
    
    try {
        const ss = SpreadsheetApp.getActiveSpreadsheet();
        const allSheets = ss.getSheets();
        
        // Find critical sheets
        const teamsSheet = ss.getSheetByName(BLOCK_CONFIG.MASTER_SHEET.TEAMS_SHEET);
        const playersSheet = ss.getSheetByName(BLOCK_CONFIG.MASTER_SHEET.PLAYERS_SHEET);
        
        if (!teamsSheet || !playersSheet) {
            Logger.log("Warning: Could not find Teams or Players sheet for ordering");
            return;
        }
        
        // Move Teams sheet to position 1 (index 0)
        ss.setActiveSheet(teamsSheet);
        ss.moveActiveSheet(1);
        
        // Move Players sheet to position 2 (index 1)  
        ss.setActiveSheet(playersSheet);
        ss.moveActiveSheet(2);
        
        // Find team sheets and order them alphabetically
        const teamSheets = allSheets.filter(sheet => 
            sheet.getName().startsWith('TEAM_') && 
            !sheet.getName().includes('Teams') && 
            !sheet.getName().includes('Players')
        );
        
        teamSheets.sort((a, b) => a.getName().localeCompare(b.getName()));
        
        // Move team sheets to positions 3, 4, 5, etc.
        for (let i = 0; i < teamSheets.length; i++) {
            ss.setActiveSheet(teamSheets[i]);
            ss.moveActiveSheet(3 + i); // Position 3, 4, 5...
        }
        
        Logger.log(`✅ Sheet ordering complete: Teams, Players, ${teamSheets.length} team sheets`);
        
    } catch (e) {
        Logger.log(`Error organizing sheet order: ${e.message}`);
    }
}

// =============================================================================
// TEST CONFIGURATION & DATA (Ensure emails are updated!)
// =============================================================================
const TEST_CONFIG = {
  ADMIN_EMAIL: "david.larsen.1981@gmail.com", 
  PLAYER1_EMAIL: "matchscheduler81@gmail.com",   
  PLAYER1_DISPLAY_NAME: "Test Player One (matchscheduler81)",
  PLAYER1_INITIALS_TEAM_A: "P1",
  PLAYER1_INITIALS_TEAM_B: "1P",
  PLAYER2_EMAIL: "paradoks@slackers.dk", 
  PLAYER2_DISPLAY_NAME: "Test Player Two (Admin)", 
  PLAYER2_INITIALS_TEAM_A: "P2",
  PLAYER2_INITIALS_TEAM_B: "2P",
  TEAM_A_NAME: "Team Alpha", TEAM_A_DIVISION: "1",
  TEAM_B_NAME: "Team Beta", TEAM_B_DIVISION: "2",
  TEAM_C_NAME: "Team Gamma", TEAM_C_DIVISION: "3",
  TEST_AVAILABILITY_YEAR: null, TEST_AVAILABILITY_CURRENT_WEEK: null, 
  TEST_AVAILABILITY_NEXT_WEEK: null, TEST_AVAILABILITY_NEXT_WEEK_YEAR: null,
  TEST_AVAILABILITY_PAST_WEEK: null, TEST_AVAILABILITY_PAST_YEAR: null
};

function initializeTestConfigDates() {
    const now = getCurrentCETDate(); 
    TEST_CONFIG.TEST_AVAILABILITY_YEAR = now.getFullYear();
    TEST_CONFIG.TEST_AVAILABILITY_CURRENT_WEEK = getISOWeekNumber(now);
    const nextWeekDate = new Date(now); 
    nextWeekDate.setDate(now.getDate() + 7);
    TEST_CONFIG.TEST_AVAILABILITY_NEXT_WEEK_YEAR = nextWeekDate.getFullYear();
    TEST_CONFIG.TEST_AVAILABILITY_NEXT_WEEK = getISOWeekNumber(nextWeekDate);
    const pastWeekDate = new Date(now); 
    pastWeekDate.setDate(now.getDate() - 7);
    TEST_CONFIG.TEST_AVAILABILITY_PAST_YEAR = pastWeekDate.getFullYear();
    TEST_CONFIG.TEST_AVAILABILITY_PAST_WEEK = getISOWeekNumber(pastWeekDate);
    Logger.log(`Test Config Dates Initialized: Current: ${TEST_CONFIG.TEST_AVAILABILITY_YEAR}-W${TEST_CONFIG.TEST_AVAILABILITY_CURRENT_WEEK}, Next: ${TEST_CONFIG.TEST_AVAILABILITY_NEXT_WEEK_YEAR}-W${TEST_CONFIG.TEST_AVAILABILITY_NEXT_WEEK}, Past: ${TEST_CONFIG.TEST_AVAILABILITY_PAST_YEAR}-W${TEST_CONFIG.TEST_AVAILABILITY_PAST_WEEK}`);
}

function debug_rebuildPlayerIndex() {
  const ui = SpreadsheetApp.getUi();
  const response = ui.alert(
    '🔨 Rebuild Player Index',
    'This will completely rebuild the PLAYER_INDEX from current data.\n\n' +
    'Use this if:\n' +
    '- Setting up the index for the first time\n' +
    '- The index appears corrupted\n' +
    '- After major data migrations\n\n' +
    'Continue?',
    ui.ButtonSet.YES_NO
  );
  
  if (response === ui.Button.YES) {
    ui.alert('Rebuilding...', 'Please wait while the index is rebuilt...', ui.ButtonSet.OK);
    
    const result = rebuildPlayerIndex();
    
    if (result.success) {
      ui.alert(
        '✅ Success',
        `Player index rebuilt successfully!\n\n` +
        `Players processed: ${result.data.playersProcessed}\n` +
        `Index entries created: ${result.data.indexEntriesCreated}\n` +
        `Teams represented: ${result.data.teamsRepresented}`,
        ui.ButtonSet.OK
      );
    } else {
      ui.alert('❌ Error', `Failed to rebuild index: ${result.message}`, ui.ButtonSet.OK);
    }
  }
}