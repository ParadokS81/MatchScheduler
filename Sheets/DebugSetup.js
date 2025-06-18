/**
 * Schedule Manager - Debug Setup & Reset Workflows
 * Split from Debug.js v2.2.0 (2025-06-07)
 * FIXED VERSION - Proper player-first batching for availability patterns
 * 
 * Purpose: Complete reset workflows, framework creation, test data population, nuclear functions
 * Dependencies: Calls core business logic functions from other project files
 */

// =============================================================================
// 🔄 STREAMLINED RESET & SETUP WORKFLOW
// =============================================================================

/**
 * Complete workflow: Delete everything, create framework, populate test data
 */
function resetComplete_allSteps() {
    const WORKFLOW_NAME = "COMPLETE RESET & SETUP WORKFLOW";
    Logger.log(`\n\n========== ${WORKFLOW_NAME} START ==========`);
    
    try {
        // Step 1: Nuclear cleanup
        Logger.log("--- Step 1/3: Deleting all data and sheets ---");
        const step1Result = resetStep1_deleteAllData();
        if (!step1Result.success) {
            Logger.log(`WORKFLOW ABORTED: Step 1 failed - ${step1Result.message}`);
            return { success: false, message: `Step 1 failed: ${step1Result.message}` };
        }
        
        // Step 2: Create basic framework
        Logger.log("--- Step 2/3: Creating basic framework ---");
        const step2Result = resetStep2_createFramework();
        if (!step2Result.success) {
            Logger.log(`WORKFLOW ABORTED: Step 2 failed - ${step2Result.message}`);
            return { success: false, message: `Step 2 failed: ${step2Result.message}` };
        }
        
        // Step 3: Populate test data
        Logger.log("--- Step 3/3: Populating multi-team test data ---");
        const step3Result = resetStep3_populateTestData();
        if (!step3Result.success) {
            Logger.log(`WORKFLOW ABORTED: Step 3 failed - ${step3Result.message}`);
            return { success: false, message: `Step 3 failed: ${step3Result.message}` };
        }
        
        // Final cleanup: Remove any temporary sheets that may have been created
        Logger.log("--- Final cleanup: Removing any temporary sheets ---");
        try {
            removeTemporarySheet(); // Global from MasterSheetManager.js
        } catch (e) {
            Logger.log(`Warning: Could not remove temporary sheet: ${e.message}`);
            // Don't fail the entire workflow for this
        }
        
        Logger.log(`========== ${WORKFLOW_NAME} COMPLETED SUCCESSFULLY ==========`);
        return { success: true, message: "Complete reset and setup workflow finished successfully!" };
        
    } catch (e) {
        const errorMsg = `Workflow exception: ${e.message}`;
        Logger.log(`========== ${WORKFLOW_NAME} FAILED: ${errorMsg} ==========`);
        return { success: false, message: errorMsg };
    }
}

/**
 * Step 1: Nuclear deletion of all data and sheets
 */
function resetStep1_deleteAllData() {
    const STEP_NAME = "STEP 1: DELETE ALL DATA & SHEETS";
    Logger.log(`\n--- STARTING: ${STEP_NAME} ---`);
    
    try {
        const cleanupResult = completeDataCleanup(); // Global from MasterSheetManager.js
        if (cleanupResult.success) {
            removeTemporarySheet(); // Global from MasterSheetManager.js
        }
        
        Logger.log(`--- ${STEP_NAME} COMPLETED ---`);
        return { success: true, message: "All data and sheets deleted successfully" };
        
    } catch (e) {
        const errorMsg = `Step 1 exception: ${e.message}`;
        Logger.log(`--- ${STEP_NAME} FAILED: ${errorMsg} ---`);
        return { success: false, message: errorMsg };
    }
}

/**
 * Step 2: Create basic framework (Teams/Players sheets, admin user) - Clean up sample teams
 */
function resetStep2_createFramework() {
    const STEP_NAME = "STEP 2: CREATE BASIC FRAMEWORK";
    Logger.log(`\n--- STARTING: ${STEP_NAME} ---`);
    
    try {
        // Create the master sheet structure (this creates Teams, Players sheets)
        const structureResult = createMasterSheetStructure(); // Global from MasterSheetManager.js
        if (!structureResult.success) {
            return { success: false, message: `Framework creation failed: ${structureResult.message}` };
        }

        // === START: ADDED MISSING INITIALIZATION STEP ===
        // This is the crucial step that was missing. It saves the unique spreadsheet ID
        // to the script's properties so the Favorites feature can work.
        const dbIdResult = initializeDatabaseId(); // Global from MasterSheetManager.js
        if (!dbIdResult.success) {
            // Log a warning but don't fail the entire process for this.
            Logger.log(`⚠️ WARNING: Could not initialize database ID. Message: ${dbIdResult.message}`);
        } else {
            Logger.log(`✅ Database ID initialized successfully.`);
        }
        // === END: ADDED MISSING INITIALIZATION STEP ===
        
        // Create admin user record
        const adminEmail = TEST_CONFIG.ADMIN_EMAIL;
        const adminPlayerResult = createPlayer({ googleEmail: adminEmail, displayName: "System Admin" }); // Global from PlayerDataManager.js
        if (!adminPlayerResult.success && !adminPlayerResult.message.includes("already exists")) {
            Logger.log(`Warning: Could not create admin player: ${adminPlayerResult.message}`);
        }
        
        Logger.log(`--- ${STEP_NAME} COMPLETED ---`);
        return { success: true, message: "Basic framework created successfully" };
        
    } catch (e) {
        const errorMsg = `Step 2 exception: ${e.message}`;
        Logger.log(`--- ${STEP_NAME} FAILED: ${errorMsg} ---`);
        return { success: false, message: errorMsg };
    }
}

// ===== UPDATED resetStep3_populateTestData WITH INDEX REBUILD =====

/**
 * Step 3: Populate test data. This version DELETES and RE-CREATES test users
 * and USES THE CORRECT SIGNATURE for joinTeamByCode.
 * NOW ALSO REBUILDS THE PLAYER_INDEX after populating data.
 */
function resetStep3_populateTestData() {
    const STEP_NAME = "STEP 3: POPULATE MULTI-TEAM TEST DATA";
    Logger.log(`\n--- STARTING: ${STEP_NAME} ---`);
    
    try {
        Logger.log("Performing definitive reset of test users...");
        _debug_deleteTestUsers();
        Utilities.sleep(500); 

        initializeTestConfigDates();
        
        const realAdmin = TEST_CONFIG.ADMIN_EMAIL;
        const realPlayer = TEST_CONFIG.PLAYER1_EMAIL;
        
        Logger.log("🔓 ENABLING DEBUG PERMISSION BYPASS FOR SETUP");
        PropertiesService.getDocumentProperties().setProperty('DEBUG_BYPASS_PERMISSIONS', 'true');
        
        Logger.log("Creating core test players to ensure they exist...");
        createPlayer({ googleEmail: realAdmin, displayName: "David Admin", discordUsername: "system_admin#0001" });
        createPlayer({ googleEmail: realPlayer, displayName: "MatchScheduler User", discordUsername: "ms_user#0002" });
        Utilities.sleep(500);

        const testTeamConfigs = [
            {
                name: "Alpha", division: "1", creatorEmail: realAdmin, creatorInitials: "DL",
                additionalMembers: [
                    { email: "alex.storm@testmail.com", name: "Alex Storm", initials: "AS" },
                    { email: "mike.thunder@testmail.com", name: "Mike Thunder", initials: "MT" },
                    { email: "sarah.lightning@testmail.com", name: "Sarah Lightning", initials: "SL" }
                ]
            },
            {
                name: "Beta", division: "1", creatorEmail: realAdmin, creatorInitials: "DB",
                additionalMembers: [
                    { email: realPlayer, name: "MatchScheduler Player", initials: "MS" },
                    { email: "emma.frost@testmail.com", name: "Emma Frost", initials: "EF" },
                    { email: "jack.steel@testmail.com", name: "Jack Steel", initials: "JS" }
                ]
            },
            {
                name: "Gamma", division: "1", creatorEmail: realPlayer, creatorInitials: "ML",
                additionalMembers: [
                    { email: "greg.garrison@testmail.com", name: "Greg Garrison", initials: "GG" },
                    { email: "nina.viper@testmail.com", name: "Nina Viper", initials: "NV" },
                    { email: "ryan.hawk@testmail.com", name: "Ryan Hawk", initials: "RH" },
                    { email: "zoe.phoenix@testmail.com", name: "Zoe Phoenix", initials: "ZP" }
                ]
            }
        ];

        const createdTeams = [];
        
        Logger.log("=== PHASE 1: Creating teams and setting up leaders correctly ===");
        for (const teamConfig of testTeamConfigs) {
             const teamCreationResult = createTeam({ teamName: teamConfig.name, division: teamConfig.division, leaderEmail: teamConfig.creatorEmail }, realAdmin);
             if(!teamCreationResult.success) { Logger.log(`Failed to create team ${teamConfig.name}: ${teamCreationResult.message}`); continue; }
             const newTeam = teamCreationResult.team;
             
             const leaderJoinResult = joinTeamByCode(teamConfig.creatorEmail, newTeam.joinCode, teamConfig.creatorInitials);

             if(!leaderJoinResult.success) { Logger.log(`Leader join issue for ${teamConfig.name}: ${leaderJoinResult.message}`); }
             const promoteResult = core_adminSetTeamLeader(newTeam.teamId, teamConfig.creatorEmail, realAdmin);
             if(promoteResult.success) { Logger.log(`✅ Leader ${teamConfig.creatorName || teamConfig.creatorEmail} promoted for ${teamConfig.name}.`); }
             else { Logger.log(`❌ Leader promotion FAILED for ${teamConfig.name}: ${promoteResult.message}`); }
             createdTeams.push({ ...teamConfig, teamId: newTeam.teamId, joinCode: newTeam.joinCode, sheetName: newTeam.availabilitySheetName, finalLeader: teamConfig.creatorEmail, fakeMembers: teamConfig.additionalMembers });
             Utilities.sleep(500);
        }
        
        Logger.log("=== PHASE 2: Adding additional members ===");
        for (const team of createdTeams) {
            for (const member of team.fakeMembers) {
                createPlayer({ googleEmail: member.email, displayName: member.name });
                
                const joinResult = joinTeamByCode(member.email, team.joinCode, member.initials);

                 if (joinResult.success) { Logger.log(`  ✅ ${member.name} (${member.initials}) joined ${team.name}`); }
                 else { Logger.log(`  ❌ ${member.name} join failed: ${joinResult.message}`); }
                Utilities.sleep(200);
            }
        }

        Logger.log("=== PHASE 3: Adding strategic availability patterns ===");
        generateStrategicAvailabilityPatterns(createdTeams);
        
        // === NEW PHASE: Rebuild Player Index ===
        Logger.log("=== PHASE 3.5: Rebuilding PLAYER_INDEX ===");
        const indexRebuildResult = rebuildPlayerIndex();
        if (indexRebuildResult.success) {
            Logger.log(`✅ Player index rebuilt: ${indexRebuildResult.indexEntriesCreated} entries created`);
        } else {
            Logger.log(`⚠️ Warning: Player index rebuild failed: ${indexRebuildResult.message}`);
            // Don't fail the entire reset for this - the index can be rebuilt manually later
        }
        
        Logger.log("=== PHASE 4: Organizing sheet order and verifying data ===");
        organizeSheetOrdering();
        
        const verificationResult = verifyTestDataCreation(createdTeams);
        if (!verificationResult.success) {
            Logger.log(`⚠️ Test data verification found issues: ${verificationResult.message}`);
        } else {
            Logger.log(`✅ Test data verification passed: ${verificationResult.message}`);
        }
        
        Logger.log(`--- ${STEP_NAME} COMPLETED ---`);
        
        return { success: true, message: "Multi-team test data populated successfully." };
        
    } catch (e) {
        const errorMsg = `Workflow exception: ${e.message}`;
        Logger.log(`--- ${STEP_NAME} FAILED: ${errorMsg} ---`);
        return { success: false, message: errorMsg };
        
    } finally {
        Logger.log("🔒 DISABLING DEBUG PERMISSION BYPASS");
        PropertiesService.getDocumentProperties().deleteProperty('DEBUG_BYPASS_PERMISSIONS');
    }
}

// ===== OPTIONAL: Add a verification function =====

/**
 * Verifies the PLAYER_INDEX is properly populated
 * Can be called after reset to ensure index is healthy
 */
function verifyPlayerIndex() {
    const CONTEXT = "DebugSetup.verifyPlayerIndex";
    try {
        const ss = SpreadsheetApp.getActiveSpreadsheet();
        const indexSheet = ss.getSheetByName('PLAYER_INDEX');
        
        if (!indexSheet) {
            return { success: false, message: "PLAYER_INDEX sheet not found" };
        }
        
        const data = indexSheet.getDataRange().getValues();
        const rowCount = data.length - 1; // Minus header
        
        // Get unique teams and players
        const uniqueTeams = new Set();
        const uniquePlayers = new Set();
        
        for (let i = 1; i < data.length; i++) {
            uniqueTeams.add(data[i][0]); // TeamID
            uniquePlayers.add(data[i][1]); // PlayerID
        }
        
        Logger.log(`${CONTEXT}: Index contains ${rowCount} entries, ${uniquePlayers.size} unique players across ${uniqueTeams.size} teams`);
        
        // Compare with actual data
        const playersSheet = ss.getSheetByName(BLOCK_CONFIG.MASTER_SHEET.PLAYERS_SHEET);
        const playerData = playersSheet.getDataRange().getValues();
        let expectedEntries = 0;
        
        for (let i = 1; i < playerData.length; i++) {
            const row = playerData[i];
            const pCols = BLOCK_CONFIG.MASTER_SHEET.PLAYERS_COLUMNS;
            
            if (row[pCols.IS_ACTIVE]) {
                if (row[pCols.TEAM1_ID]) expectedEntries++;
                if (row[pCols.TEAM2_ID]) expectedEntries++;
            }
        }
        
        const isHealthy = rowCount === expectedEntries;
        
        return {
            success: isHealthy,
            message: isHealthy ? 
                `Index is healthy: ${rowCount} entries match expected ${expectedEntries}` :
                `Index mismatch: ${rowCount} entries but expected ${expectedEntries}`,
            stats: {
                indexEntries: rowCount,
                expectedEntries: expectedEntries,
                uniquePlayers: uniquePlayers.size,
                uniqueTeams: uniqueTeams.size
            }
        };
        
    } catch (e) {
        return { success: false, message: `Error verifying index: ${e.message}` };
    }
}

// =============================================================================
// STRATEGIC AVAILABILITY PATTERN GENERATION (PLAYER-FIRST BATCHING) - FIXED!
// =============================================================================

/**
 * Generate strategic availability patterns.
 * This version is updated to look for simple team names like "Alpha", not "Team Alpha".
 */
function generateStrategicAvailabilityPatterns(createdTeams) {
    Logger.log("Generating strategic availability patterns (multi-team player safe)...");
    
    // UPDATED: This now uses the simple names "Alpha", "Beta", etc. to match our new config.
    const strategicSlots = [
        { name: "Tuesday 22:00-23:00", day: 1, timeSlots: [2, 3], teams: ["ALL"] },
        { name: "Thursday 22:00-23:00", day: 3, timeSlots: [2, 3], teams: ["ALL"] },
        { name: "Friday 22:00-23:00", day: 4, timeSlots: [2, 3], teams: ["Alpha", "Beta"] },
        { name: "Sunday 21:00-22:00", day: 6, timeSlots: [1, 2], teams: ["Beta", "Gamma"] },
        { name: "Wednesday 21:00-22:00", day: 2, timeSlots: [1, 2], teams: ["Alpha", "Gamma"] }
    ];
    
    const weeksToGenerate = [
        { year: TEST_CONFIG.TEST_AVAILABILITY_YEAR, week: TEST_CONFIG.TEST_AVAILABILITY_CURRENT_WEEK },
        { year: TEST_CONFIG.TEST_AVAILABILITY_NEXT_WEEK_YEAR, week: TEST_CONFIG.TEST_AVAILABILITY_NEXT_WEEK }
    ];
    
    for (const weekData of weeksToGenerate) {
        Logger.log(`  Processing week ${weekData.year}-W${weekData.week}...`);
        
        const playerTeamAvailabilityMap = new Map();
        
        for (const slot of strategicSlots) {
            const teamsForThisSlot = createdTeams.filter(team => {
                if (slot.teams.includes("ALL")) return true;
                // The check now correctly compares simple names (e.g., "Alpha" === "Alpha")
                return slot.teams.some(targetTeam => team.name === targetTeam);
            });
            
            for (const team of teamsForThisSlot) {
                const allMembers = [
                    { email: team.creatorEmail, initials: team.creatorInitials, name: team.creatorName },
                    ...team.fakeMembers
                ];
                
                for (const member of allMembers) {
                    if (!playerTeamAvailabilityMap.has(member.email)) {
                        playerTeamAvailabilityMap.set(member.email, new Map());
                    }
                    const playerTeams = playerTeamAvailabilityMap.get(member.email);
                    
                    if (!playerTeams.has(team.teamId)) {
                        playerTeams.set(team.teamId, {
                            initials: member.initials,
                            selections: []
                        });
                    }
                    
                    const teamAvailability = playerTeams.get(team.teamId);
                    for (const timeSlot of slot.timeSlots) {
                        teamAvailability.selections.push({
                            visualRow: timeSlot,
                            visualCol: slot.day
                        });
                    }
                }
            }
        }
        
        Logger.log(`    Making batch calls for ${playerTeamAvailabilityMap.size} unique players...`);
        
        for (const [email, teamsMap] of playerTeamAvailabilityMap) {
            for (const [teamId, availabilityData] of teamsMap) {
                if (availabilityData.selections.length > 0) {
                    const weeklyPayload = [{
                        year: weekData.year,
                        weekNumber: weekData.week,
                        selections: availabilityData.selections
                    }];
                    
                    const batchResult = availabilityManager_updatePlayerAvailabilityForMultipleWeeks_SERVICE(
                        email, 
                        teamId, 
                        "add", 
                        weeklyPayload
                    );
                    
                    if (batchResult.success) {
                        Logger.log(`      ✅ ${availabilityData.initials} on Team ${teamId}: +${availabilityData.selections.length} slots added.`);
                    } else {
                        Logger.log(`      ❌ ${availabilityData.initials} on Team ${teamId} batch update failed: ${batchResult.message}`);
                    }
                    Utilities.sleep(100);
                }
            }
        }
    }
    
    Logger.log("✅ Strategic availability pattern generation complete!");
}

// =============================================================================
// UTILITY GENERATORS FOR TEST DATA (FIXED)
// =============================================================================

/**
 * FIXED: Simple team ID generator - NO PREFIXES (business logic adds them)
 */
function generateSimpleTeamId(teamName, index) {
    const cleanName = teamName.replace(/[^A-Za-z0-9]/g, '').toUpperCase();
    
    // Extract meaningful prefix from team name (no TEAM_ prefix)
    let prefix;
    if (cleanName.startsWith("TEAM")) {
        // "TEAMALPHA" → "ALPH"
        prefix = cleanName.substring(4, 8) || "UNTD";
    } else {
        // "ALPHA" → "ALPH"  
        prefix = cleanName.substring(0, 4) || "UNTD";
    }
    
    const suffix = String(index).padStart(2, '0') + Math.random().toString(36).substring(2, 6).toUpperCase();
    
    // Return WITHOUT any TEAM_ prefix - let business logic add prefixes
    return `${prefix}_${suffix}`; // Returns "ALPH_00A1B2C3" for "Team Alpha"
}

/**
 * Simple join code generator 
 */
function generateSimpleJoinCode(teamName, index) {
    const cleanName = teamName.replace(/[^A-Za-z0-9]/g, '').toUpperCase();
    let prefix;
    if (cleanName.startsWith("TEAM")) {
        prefix = cleanName.substring(4, 7) || "UNT";
    } else {
        prefix = cleanName.substring(0, 3) || "UNT";
    }
    const suffix = String(index + 100); // Start at 100 to avoid single digits
    return `${prefix}${suffix}`;
}

// =============================================================================
// ☢️ NUCLEAR & TARGETED CLEANUP FUNCTIONS ☢️
// These call core logic from MasterSheetManager.js directly by function name
// =============================================================================
function DANGEROUS_NUKE_ALL_DATA_AND_SHEETS(forceNoUiConfirm = false) {
  let confirmed = forceNoUiConfirm;
  if (!forceNoUiConfirm) {
    try {
      const ui = SpreadsheetApp.getUi();
      const response = ui.alert( "☢️☢️☢️ NUCLEAR DELETION WARNING ☢️☢️☢️", "You are about to trigger a COMPLETE WIPE of ALL SHEETS (except one) and ALL STORED PROPERTIES in this spreadsheet. This CANNOT BE UNDONE.\n\nAre you absolutely sure?", ui.ButtonSet.YES_NO);
      if (response === ui.Button.YES) confirmed = true;
      else { Logger.log("☢️ NUCLEAR DELETION ABORTED BY USER via UI prompt. ☢️"); ui.alert("Nuclear deletion aborted by user."); return { success: false, message: "Nuclear deletion aborted by user." }; }
    } catch (e) { Logger.log(`CRITICAL: UI for DANGEROUS_NUKE_ALL_DATA_AND_SHEETS confirmation failed (Error: ${e.message}). ABORTING DELETION as 'forceNoUiConfirm' was not true.`); try {SpreadsheetApp.getActiveSpreadsheet().toast("Nuclear deletion ABORTED: UI failed. Not forced.", "CRITICAL ERROR", 10);} catch(e){} return { success: false, message: "Nuclear deletion aborted: UI confirmation failed and not forced." }; }
  }
  if (!confirmed) { Logger.log("☢️ NUCLEAR DELETION ABORTED (not confirmed or UI issue without force). ☢️"); return { success: false, message: "Nuclear deletion aborted." }; }

  if (forceNoUiConfirm) Logger.log("☢️☢️☢️ Proceeding with NUCLEAR DELETION due to 'forceNoUiConfirm=true'. THIS IS USUALLY AN INTERNAL CALL. ☢️☢️☢️");
  Logger.log("☢️☢️☢️ Debug.js: Calling global completeDataCleanup & removeTemporarySheet... ☢️☢️☢️");
  try {
    const cleanupResult = completeDataCleanup(); // Global call
    if (cleanupResult.success) { removeTemporarySheet(); } // Global call
    Logger.log(`☢️☢️☢️ NUCLEAR DELETION PROCESS COMPLETED. Status: ${cleanupResult.message} ☢️☢️☢️`);
    try { SpreadsheetApp.getUi().alert("☢️ SUCCESS ☢️", `Nuclear deletion process completed. Status: ${cleanupResult.message}`, SpreadsheetApp.getUi().ButtonSet.OK); } catch(e) {/*ignore if UI fails post-op*/}
    return cleanupResult;
  } catch (e) {
    Logger.log(`☢️☢️☢️ NUCLEAR DELETION FAILED: Error calling cleanup functions: ${e.message} \nStack: ${e.stack}☢️☢️☢️`);
    try { SpreadsheetApp.getUi().alert("☢️ ERROR ☢️", `Nuclear deletion FAILED: ${e.message}`, SpreadsheetApp.getUi().ButtonSet.OK); } catch(ui_e) {/*ignore*/}
    return { success: false, message: `Nuclear deletion failed: ${e.message}` };
  }
}

/**
 * A specific helper to DELETE test users before repopulating.
 * This is a more definitive reset than clearing cells to avoid race conditions.
 */
function _debug_deleteTestUsers() {
  const CONTEXT = "DebugSetup._debug_deleteTestUsers";
  try {
    const testUsers = [TEST_CONFIG.ADMIN_EMAIL, TEST_CONFIG.PLAYER1_EMAIL];
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const playersSheet = ss.getSheetByName(BLOCK_CONFIG.MASTER_SHEET.PLAYERS_SHEET);
    if (!playersSheet || playersSheet.getLastRow() < 2) {
        Logger.log(`${CONTEXT}: Players sheet not found or is empty. Nothing to delete.`);
        return;
    }

    const pCols = BLOCK_CONFIG.MASTER_SHEET.PLAYERS_COLUMNS;
    const data = playersSheet.getDataRange().getValues();
    const rowsToDelete = [];
    
    // Find all rows that match our test users
    for (let i = 1; i < data.length; i++) {
      const userEmail = data[i][pCols.GOOGLE_EMAIL];
      if (testUsers.includes(userEmail)) {
        rowsToDelete.push(i + 1); // Add the actual sheet row number to our list
      }
    }

    if (rowsToDelete.length > 0) {
        withProtectionBypass(() => {
          // Delete rows from the bottom up to avoid shifting indices
          for (let i = rowsToDelete.length - 1; i >= 0; i--) {
            const rowIndex = rowsToDelete[i];
            Logger.log(`${CONTEXT}: Deleting row ${rowIndex} for a test user.`);
            playersSheet.deleteRow(rowIndex);
          }
          SpreadsheetApp.flush(); // Ensure writes are committed
        }, "Delete Test User Rows", BLOCK_CONFIG.MASTER_SHEET.PLAYERS_SHEET);
    }
    
    // Invalidate caches for good measure
    testUsers.forEach(email => _pdm_invalidatePlayerCache(email, null, CONTEXT));

  } catch (e) {
    Logger.log(`Error in ${CONTEXT}: ${e.message}`);
  }
}