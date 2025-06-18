/**
 * Schedule Manager - Master Sheet Database Manager (Clean Framework - No Sample Data)
 *
 * @version 1.5.0 (2025-06-07) - Removed all sample data creation for clean framework
 * @version 1.4.0 (2025-05-31) - Updated _msm_createTeamScheduleStructure for static Row 1 headers.
 * @version 1.3.2 (2025-05-30) - Corrected all inter-file function calls to be direct.
 *
 * Description: Creates and manages the centralized master spreadsheet database.
 * Now creates completely clean framework with no sample teams, players, or sheets.
 */

// ROLES is now a global constant defined in PermissionManager.js
// BLOCK_CONFIG is from Configuration.js
// TEST_CONFIG is from Debug.js (used for sample data emails)
// Utility functions like getCurrentTimestamp, createSuccessResponse, createErrorResponse,
// formatDate, getISOWeekNumber, getMondayFromWeekNumberAndYear, getCurrentCETDate are from Configuration.js
// Manager functions (e.g., syncTeamPlayerData from PlayerDataManager.js, createSingleWeekBlock from WeekBlockManager.js)
// are called directly, assuming they are globally available.

// =============================================================================
// MASTER SHEET CREATION ORCHESTRATION
// =============================================================================

function createMasterSheetStructure() {
  const CONTEXT = "MasterSheetManager.createMasterSheetStructure";
  try {
    Logger.log(`=== ${CONTEXT}: STARTING ===`);
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const results = { success: true, sheetsCreated: [], errors: [], timestamp: getCurrentTimestamp() };
    
    const steps = [
      { name: "Teams Sheet", func: () => _msm_createTeamsSheet(ss) }, 
      { name: "Players Sheet", func: () => _msm_createPlayersSheet(ss) },
      { name: "System Cache Sheet", func: () => _msm_createSystemCacheSheet(ss) },
      { name: "Week Block Index Sheet", func: () => _msm_createWeekBlockIndexSheet(ss) },
      { name: "Player Index Sheet", func: () => _msm_createPlayerIndexSheet(ss) },
      { name: "Master Sheet Properties", func: () => _msm_setupMasterSheetProperties() }
    ];

    for (const step of steps) {
      try {
        const stepResult = step.func();
        if (stepResult.success) {
          if (step.name.includes("Sheet") && stepResult.data && stepResult.data.sheetName) {
            results.sheetsCreated.push(stepResult.data.sheetName); 
          }
          if (step.name === "Master Sheet Properties") results.propertiesSet = true;
        } else {
          results.errors.push(`${step.name}: ${stepResult.message}`);
        }
      } catch (e) {
        results.errors.push(`${step.name} (Exception): ${e.message}`);
        Logger.log(`ERROR during ${CONTEXT} at step ${step.name}: ${e.message}\nStack: ${e.stack}`);
      }
    }
    results.success = results.errors.length === 0;
    results.message = results.success ? `Clean database framework created successfully! Sheets: ${results.sheetsCreated.join(", ")}.` : `Database created with ${results.errors.length} errors: ${results.errors.join('; ')}`;
    Logger.log(`${CONTEXT}: ${results.message}`);
    return results;
  } catch (e) {
    Logger.log(`❌ CRITICAL ERROR in ${CONTEXT}: ${e.message}\nStack: ${e.stack}`);
    return createErrorResponse(`Critical database creation error: ${e.message}`);
  }
}

// =============================================================================
// INDIVIDUAL SHEET CREATION FUNCTIONS (Prefixed _msm_ to avoid global conflicts)
// =============================================================================

function _msm_generateInternalJoinCode(teamName = '') {
    let baseCode = teamName ? teamName.replace(/[^A-Za-z]/g, '').substring(0, 4).toUpperCase() : 'TEAM';
    if (baseCode.length < 2) baseCode = 'TEAM';
    return baseCode + Math.floor(1000 + Math.random() * 9000);
}

function _msm_generateInternalSamplePlayerId(displayName = "Player") {
    const namePart = displayName ? displayName.substring(0, 4).toUpperCase().replace(/[^A-Z0-9]/g, '') : "SMPL";
    return `S_PLAYER_${namePart}_${Math.floor(Math.random()*10000)}`;
}

function _msm_generateInternalSampleTeamId(teamName = "Team") {
    const prefix = teamName ? teamName.substring(0, 4).toUpperCase().replace(/[^A-Z0-9]/g, '') : "TEAM";
    const finalPrefix = prefix || "TEAM";
    return `${BLOCK_CONFIG.MASTER_SHEET.TEAM_TAB_PREFIX}${finalPrefix}_${Utilities.getUuid().substring(0,6)}`;
}

function _msm_createSystemCacheSheet(spreadsheet) {
  const CONTEXT = "MasterSheetManager._msm_createSystemCacheSheet";
  try {
    const sheetName = 'SYSTEM_CACHE';
    Logger.log(`${CONTEXT}: Creating or clearing ${sheetName} sheet...`);
    let cacheSheet = spreadsheet.getSheetByName(sheetName);
    if (cacheSheet) {
      cacheSheet.clear();
    } else {
      cacheSheet = spreadsheet.insertSheet(sheetName);
    }

    const headers = ["TeamID", "TeamName", "Division", "LogoURL", "IsPublic", "RosterJSON"];
    cacheSheet.getRange(1, 1, 1, headers.length).setValues([headers]).setFontWeight('bold');
    cacheSheet.getRange('G1').setValue(new Date().toISOString()).setNote("Master Timestamp for Teams List");
    
    cacheSheet.hideSheet(); 
    
    Logger.log(`✅ ${CONTEXT}: ${sheetName} sheet created and hidden.`);
    return createSuccessResponse({ sheetName: sheetName });
  } catch (e) {
    return handleError(e, CONTEXT);
  }
}

/**
 * Creates the WEEK_BLOCK_INDEX sheet for fast week block lookups
 * @param {GoogleAppsScript.Spreadsheet.Spreadsheet} spreadsheet - The target spreadsheet
 * @returns {Object} Success/error response
 */
function _msm_createWeekBlockIndexSheet(spreadsheet) {
  const CONTEXT = "MasterSheetManager._msm_createWeekBlockIndexSheet";
  try {
    const sheetName = BLOCK_CONFIG.WEEK_BLOCK_INDEX.SHEET_NAME;
    Logger.log(`${CONTEXT}: Creating or clearing ${sheetName} sheet...`);
    
    // Check if sheet exists
    let indexSheet = spreadsheet.getSheetByName(sheetName);
    if (indexSheet) {
      // Clear existing content
      indexSheet.clear();
      Logger.log(`${CONTEXT}: Cleared existing ${sheetName} sheet`);
    } else {
      // Create new sheet
      indexSheet = spreadsheet.insertSheet(sheetName);
      Logger.log(`${CONTEXT}: Created new ${sheetName} sheet`);
    }
    
    // Set up headers
    const headers = ["TeamSheetName", "Year", "Week", "StartRow", "LastUpdated"];
    indexSheet.getRange(1, 1, 1, headers.length)
      .setValues([headers])
      .setFontWeight('bold')
      .setBackground('#f3f3f3');
    
    // Add rebuild timestamp in column F
    indexSheet.getRange('F1')
      .setValue(new Date().toISOString())
      .setNote("Last Full Rebuild Timestamp")
      .setFontWeight('normal')
      .setBackground('#e8f4f8');
    
    // Set column widths for better readability
    indexSheet.setColumnWidth(1, 200); // TeamSheetName
    indexSheet.setColumnWidth(2, 60);  // Year
    indexSheet.setColumnWidth(3, 60);  // Week
    indexSheet.setColumnWidth(4, 80);  // StartRow
    indexSheet.setColumnWidth(5, 150); // LastUpdated
    
    // Freeze header row
    indexSheet.setFrozenRows(1);
    
    // Hide sheet from users
    indexSheet.hideSheet();
    
    Logger.log(`✅ ${CONTEXT}: ${sheetName} sheet created, configured, and hidden.`);
    return createSuccessResponse({ 
      sheetName: sheetName,
      created: true 
    });
    
  } catch (e) {
    return handleError(e, CONTEXT);
  }
}

function _msm_createPlayerIndexSheet(spreadsheet) {
  const CONTEXT = "MasterSheetManager._msm_createPlayerIndexSheet";
  try {
    const sheetName = 'PLAYER_INDEX';
    Logger.log(`${CONTEXT}: Creating or clearing ${sheetName} sheet...`);
    
    let indexSheet = spreadsheet.getSheetByName(sheetName);
    if (indexSheet) {
      indexSheet.clear();
    } else {
      indexSheet = spreadsheet.insertSheet(sheetName);
    }

    // Define headers - no GoogleEmail per privacy requirements
    const headers = ["TeamID", "PlayerID", "DisplayName", "PlayerInitials", "PlayerRole", "PlayerDiscordUsername"];
    indexSheet.getRange(1, 1, 1, headers.length).setValues([headers]).setFontWeight('bold');
    
    // Add timestamp for tracking
    indexSheet.getRange('G1').setValue(new Date().toISOString()).setNote("Last Full Rebuild Timestamp");
    
    // Hide the sheet from normal users
    indexSheet.hideSheet();
    
    Logger.log(`✅ ${CONTEXT}: ${sheetName} sheet created and hidden.`);
    return createSuccessResponse({ sheetName: sheetName });
  } catch (e) {
    return handleError(e, CONTEXT);
  }
}

function _msm_createTeamsSheet(spreadsheet) {
  const CONTEXT = "MasterSheetManager._msm_createTeamsSheet";
  try {
    Logger.log(`${CONTEXT}: Creating empty Teams sheet...`);
    let teamsSheet = spreadsheet.getSheetByName(BLOCK_CONFIG.MASTER_SHEET.TEAMS_SHEET);
    if (teamsSheet) { teamsSheet.clear(); } else { teamsSheet = spreadsheet.insertSheet(BLOCK_CONFIG.MASTER_SHEET.TEAMS_SHEET); }
    
    const tCols = BLOCK_CONFIG.MASTER_SHEET.TEAMS_COLUMNS;
    const finalHeaders = ["TeamID", "TeamName", "Division", "LeaderEmail", "JoinCode", "CreatedDate", "LastActive", "MaxPlayers", "IsActive", "IsPublic", "PlayerCount", "PlayerList", "InitialsList", "AvailabilitySheetName", "LogoURL", "LastUpdatedTimestamp"];
    if (finalHeaders.length !== Object.keys(tCols).length) { return createErrorResponse(`Header length mismatch in ${CONTEXT}.`); }

    teamsSheet.getRange(1, 1, 1, finalHeaders.length).setValues([finalHeaders]).setFontWeight('bold').setBackground(BLOCK_CONFIG.COLORS.PRIMARY).setFontColor('white');
    teamsSheet.setColumnWidth(tCols.TEAM_ID + 1, 200); 
    teamsSheet.setColumnWidth(tCols.TEAM_NAME + 1, 180);
    teamsSheet.setColumnWidth(tCols.LEADER_EMAIL + 1, 200);
    teamsSheet.setColumnWidth(tCols.PLAYER_LIST + 1, 250);
    teamsSheet.setColumnWidth(tCols.INITIALS_LIST + 1, 150);
    teamsSheet.setColumnWidth(tCols.AVAILABILITY_SHEET_NAME + 1, 200);
    teamsSheet.setColumnWidth(tCols.LOGO_URL + 1, 250);

    // NO SAMPLE TEAMS CREATED - Clean framework only
    
    Logger.log(`✅ ${CONTEXT}: Empty Teams sheet created successfully.`);
    return createSuccessResponse({ sheetName: BLOCK_CONFIG.MASTER_SHEET.TEAMS_SHEET });
  } catch (e) { return handleError(e, CONTEXT); } 
}

function _msm_createPlayersSheet(spreadsheet) {
  const CONTEXT = "MasterSheetManager._msm_createPlayersSheet";
  try {
    Logger.log(`${CONTEXT}: Creating empty Players sheet...`);
    let playersSheet = spreadsheet.getSheetByName(BLOCK_CONFIG.MASTER_SHEET.PLAYERS_SHEET);
    if (playersSheet) { playersSheet.clear(); } else { playersSheet = spreadsheet.insertSheet(BLOCK_CONFIG.MASTER_SHEET.PLAYERS_SHEET); }

    const pCols = BLOCK_CONFIG.MASTER_SHEET.PLAYERS_COLUMNS;
    // Updated headers to match the new simplified schema
    const finalPHeaders = [
        'PlayerID','GoogleEmail','DisplayName','CreatedDate','LastSeen','IsActive',
        'Team1ID','Team1Initials','Team1Role','Team1JoinDate',
        'Team2ID','Team2Initials','Team2Role','Team2JoinDate',
        'DiscordUsername','AvailabilityTemplate'
    ];
    if (finalPHeaders.length !== Object.keys(pCols).length) { 
        return createErrorResponse(`Header length mismatch in ${CONTEXT}. Expected ${Object.keys(pCols).length}, got ${finalPHeaders.length}.`); 
    }

    playersSheet.getRange(1, 1, 1, finalPHeaders.length).setValues([finalPHeaders]).setFontWeight('bold').setBackground(BLOCK_CONFIG.COLORS.SECONDARY).setFontColor('white');
    playersSheet.setColumnWidth(pCols.PLAYER_ID + 1, 200);
    playersSheet.setColumnWidth(pCols.GOOGLE_EMAIL + 1, 200);
    playersSheet.setColumnWidth(pCols.DISPLAY_NAME + 1, 180);
    playersSheet.setColumnWidth(pCols.DISCORD_USERNAME + 1, 180);

    Logger.log(`✅ ${CONTEXT}: Empty Players sheet created successfully with simplified schema.`);
    return createSuccessResponse({ sheetName: BLOCK_CONFIG.MASTER_SHEET.PLAYERS_SHEET });
  } catch (e) { return handleError(e, CONTEXT); }
}

function _msm_createSampleTeamTabs(spreadsheet) {
  const CONTEXT = "MasterSheetManager._msm_createSampleTeamTabs";
  try {
    Logger.log(`${CONTEXT}: Skipping sample team tabs - clean framework only...`);
    
    // NO SAMPLE TEAM TABS CREATED - Clean framework only
    
    Logger.log(`✅ ${CONTEXT}: No sample team tabs created (clean framework).`);
    return createSuccessResponse({ data: { tabsCreated: [] } }, "Clean framework - no sample team tabs created.");
  } catch (e) { return handleError(e, CONTEXT); }
}

function _msm_createTeamTab(spreadsheet, availabilitySheetName, teamName) {
  const CONTEXT = "MasterSheetManager._msm_createTeamTab";
  try {
    Logger.log(`${CONTEXT}: Processing team tab: ${availabilitySheetName} for ${teamName}`);
    let teamSheet = spreadsheet.getSheetByName(availabilitySheetName);
    if (teamSheet) { 
        // If sheet exists, clear it completely before rebuilding structure
        teamSheet.clear(); 
        teamSheet.clearConditionalFormatRules();
        // Ensure it's active for frozen row setting, though clear() might do this
        // spreadsheet.setActiveSheet(teamSheet); 
    } else { 
        teamSheet = spreadsheet.insertSheet(availabilitySheetName); 
        // spreadsheet.setActiveSheet(teamSheet);
    }
    return _msm_createTeamScheduleStructure(teamSheet, teamName); 
  } catch (e) { return handleError(e, CONTEXT); }
}

/**
 * Sets up the structure for a team's availability sheet, including Row 1 static headers
 * and initial weekly blocks.
 * @param {GoogleAppsScript.Spreadsheet.Sheet} teamSheet The sheet for the team.
 * @param {string} teamName The name of the team.
 * @return {Object} Result of the operation.
 */
function _msm_createTeamScheduleStructure(teamSheet, teamName) { 
  const CONTEXT = "MasterSheetManager._msm_createTeamScheduleStructure (Static Row 1 Headers)";
  try {
    Logger.log(`[${CONTEXT}] Starting team schedule structure creation for ${teamName}...`);
    
    const indexEntries = []; // Collect entries for batch update
    
    teamSheet.clear(); // Full clear to ensure clean slate
    teamSheet.clearConditionalFormatRules();
    
    // --- Setup Row 1 Static Headers ---
    const headerRow = teamSheet.getRange(1, 1, 1, 13); // A-M (13 columns total)
    const headers = [];
    
    // A-D: Metadata columns
    headers[BLOCK_CONFIG.LAYOUT.METADATA_COLUMNS.YEAR] = "Year";
    headers[BLOCK_CONFIG.LAYOUT.METADATA_COLUMNS.MONTH] = "Month";
    headers[BLOCK_CONFIG.LAYOUT.METADATA_COLUMNS.WEEK] = "Week";
    headers[BLOCK_CONFIG.LAYOUT.TIME_COLUMN] = "Time";
    
    // E-K: Days of Week Headers
    const daysStartCol = BLOCK_CONFIG.LAYOUT.DAYS_START_COLUMN;
    for (let i = 0; i < BLOCK_CONFIG.LAYOUT.DAYS_PER_WEEK; i++) {
      headers[daysStartCol + i] = BLOCK_CONFIG.LAYOUT.DAY_ABBREV[i];
    }
    
    // L-M: Roster and Changelog Headers
    headers[11] = "Roster"; // Column L
    headers[12] = "Changelog"; // Column M
    
    headerRow.setValues([headers]);
    headerRow.setFontWeight('bold');
    headerRow.setBackground(BLOCK_CONFIG.COLORS.SHEET.DAY_HEADER_BG);
    headerRow.setFontColor(BLOCK_CONFIG.COLORS.SHEET.DAY_HEADER_FG);
    
    // Freeze Row 1 and first 4 columns
    teamSheet.setFrozenRows(1);
    teamSheet.setFrozenColumns(4);
    
    // Set column widths
    teamSheet.setColumnWidth(1, 60); // Year
    teamSheet.setColumnWidth(2, 60); // Month
    teamSheet.setColumnWidth(3, 60); // Week
    teamSheet.setColumnWidth(4, 80); // Time
    
    // Set day column widths (E-K)
    for (let i = 0; i < BLOCK_CONFIG.LAYOUT.DAYS_PER_WEEK; i++) {
      teamSheet.setColumnWidth(daysStartCol + i + 1, 100);
    }
    
    // Set roster and changelog column widths (L-M)
    teamSheet.setColumnWidth(12, 250); // Column L (Roster)
    teamSheet.setColumnWidth(13, 250); // Column M (Changelog)
    
    // Create initial week blocks
    const now = getCurrentCETDate();
    const currentWeek = getISOWeekNumber(now);
    const currentYear = now.getFullYear();
    let lastBlockEndY = 1; // Start after header row
    let blocksCreatedCount = 0;
    
    // Create blocks for current week + 3 future weeks
    for (let weekOffset = 0; weekOffset < BLOCK_CONFIG.WEEK_BLOCK_INDEX.ACTIVE_WEEKS_WINDOW; weekOffset++) {
      const weekToProcess = currentWeek + weekOffset;
      const yearToProcess = currentYear + Math.floor((weekToProcess - 1) / 52);
      const normalizedWeek = ((weekToProcess - 1) % 52) + 1;
      
      const nextBlockDataStartRow = lastBlockEndY + 1;
      
      const blockResult = createSingleWeekBlock(
        teamSheet, 
        nextBlockDataStartRow, 
        yearToProcess, 
        weekToProcess,
        true // skipIndexUpdate = true for batching
      );
      
      if (blockResult && blockResult.success && blockResult.endRow) {
        blocksCreatedCount++;
        lastBlockEndY = blockResult.endRow;
        
        // Collect for batch update
        indexEntries.push({
          sheetName: teamSheet.getName(),
          year: yearToProcess,
          weekNumber: weekToProcess,
          startRow: nextBlockDataStartRow
        });
      } else {
        Logger.log(`${CONTEXT}: Failed to create week block for week ${weekToProcess} of ${yearToProcess}`);
      }
    }
    
    // Batch update the index
    if (indexEntries.length > 0) {
      _batchUpdateWeekIndex(indexEntries);
      Logger.log(`${CONTEXT}: Batch indexed ${indexEntries.length} weeks for ${teamName}`);
    }
    
    // Add protection if configured
    if (BLOCK_CONFIG.SETTINGS.AUTO_PROTECT_NEW_TEAMS) {
      const protection = teamSheet.protect();
      protection.setDescription(`Protected team sheet for ${teamName}`);
      protection.removeEditors(protection.getEditors());
      protection.addEditor(Session.getEffectiveUser());
    }
    
    Logger.log(`✅ ${CONTEXT}: Created ${blocksCreatedCount} week blocks for ${teamName}`);
    return createSuccessResponse({
      sheetName: teamSheet.getName(),
      blocksCreated: blocksCreatedCount
    });
    
  } catch (e) {
    return handleError(e, CONTEXT);
  }
}


// =============================================================================
// PROPERTIES & VALIDATION
// =============================================================================
function _msm_setupMasterSheetProperties() {
  const CONTEXT = "MasterSheetManager._msm_setupMasterSheetProperties";
  try {
    const docProps = PropertiesService.getDocumentProperties();
    docProps.setProperties({
        SCHEMA_VERSION: BLOCK_CONFIG.VERSION,
        SETUP_DATE: getCurrentTimestamp(),
        LAST_MAINTENANCE: getCurrentTimestamp()
    });
    Logger.log(`✅ ${CONTEXT}: Document properties configured.`);
    return createSuccessResponse({}, "Document properties configured.");
  } catch (e) { return handleError(e, CONTEXT); }
}

function _msm_validateMasterSheetStructure() {
  const CONTEXT = "MasterSheetManager._msm_validateMasterSheetStructure";
  try {
    Logger.log(`${CONTEXT}: Validating master sheet structure...`);
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const results = { success: true, issues: [], sheetsFound: [], teamTabsInfo: [] };
    const requiredSheets = [
        BLOCK_CONFIG.MASTER_SHEET.TEAMS_SHEET,
        BLOCK_CONFIG.MASTER_SHEET.PLAYERS_SHEET
    ];
    const allSheets = ss.getSheets();
    const allSheetNames = allSheets.map(s => s.getName());

    requiredSheets.forEach(sheetName => {
        if (allSheetNames.includes(sheetName)) {
            results.sheetsFound.push(sheetName);
        } else {
            results.issues.push(`Required sheet missing: ${sheetName}`);
            results.success = false;
        }
    });
    
    allSheets.forEach(sheet => {
      if (sheet.getName().startsWith(BLOCK_CONFIG.MASTER_SHEET.TEAM_TAB_PREFIX)) {
        const blocks = _scanSheetForAllWeekBlocks(sheet); 
        const firstBlockInfo = blocks.length > 0 ? validateBlockStructure(sheet, blocks[0].startRow) : {isValid: null, errors: ["No blocks found for validation"]};
        results.teamTabsInfo.push({
            name: sheet.getName(),
            blockCount: blocks.length,
            firstBlockValid: firstBlockInfo.isValid,
            firstBlockErrors: firstBlockInfo.errors
        });
        if (!firstBlockInfo.isValid && blocks.length > 0) results.success = false; // Consider it an issue if first block is invalid
      }
    });

    results.message = results.success ? "Master sheet structure appears valid." : `Validation issues found: ${results.issues.join('; ')}`;
    Logger.log(`${CONTEXT}: ${results.message}`);
    return createSuccessResponse(results, results.message);
  } catch (e) { return handleError(e, CONTEXT); }
}

function initializeDatabaseId() {
  const CONTEXT = "MasterSheetManager.initializeDatabaseId";
  try {
    const dbId = SpreadsheetApp.getActiveSpreadsheet().getId();
    const dbIdKey = BLOCK_CONFIG.PROPERTY_KEYS.DATABASE_ID;
    
    PropertiesService.getScriptProperties().setProperty(dbIdKey, dbId);
    
    Logger.log(`${CONTEXT}: Set new Database ID in ScriptProperties: ${dbId}`);
    return createSuccessResponse({ databaseId: dbId }, "Database ID initialized successfully.");
  } catch(e) {
    Logger.log(`CRITICAL WARNING in ${CONTEXT}: Could not set Database ID in ScriptProperties. Error: ${e.message}`);
    return handleError(e, CONTEXT);
  }
}

// =============================================================================
// DATA CLEANUP & RESET FUNCTIONS (Core utilities for database state management)
// =============================================================================
function completeDataCleanup() {
  const CONTEXT = "MasterSheetManager.completeDataCleanup";
  const results = { 
    success: true, sheetsDeleted: [], propertiesCleared: 0, errors: [], message: "Cleanup initiated.",
    timestamp: getCurrentTimestamp() 
  };
  try {
    Logger.log(`=== ${CONTEXT}: PERFORMING COMPLETE DATA CLEANUP ===`);
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const initialSheets = ss.getSheets();
    let keepFirstSheet = null;

    if (initialSheets.length > 0) {
        keepFirstSheet = initialSheets[0];
        for (let i = initialSheets.length - 1; i >= 0; i--) { 
            if (initialSheets[i].getSheetId() !== keepFirstSheet.getSheetId()) {
                const sheetName = initialSheets[i].getName();
                try { ss.deleteSheet(initialSheets[i]); results.sheetsDeleted.push(sheetName); } 
                catch (e) { results.errors.push(`Failed to delete sheet '${sheetName}': ${e.message}`); }
            }
        }
        try {
            keepFirstSheet.clearContents().clearFormats().setName('Temporary');
        } catch (e) { results.errors.push(`Failed to clear/rename remaining sheet: ${e.message}`);}
    } else {
        try { ss.insertSheet('Temporary'); } 
        catch(e) { results.errors.push(`Failed to insert 'Temporary' sheet: ${e.message}`);}
    }
    try {
      const docProps = PropertiesService.getDocumentProperties();
      const docKeys = docProps.getKeys();
      if (docKeys.length > 0) { docProps.deleteAllProperties(); results.propertiesCleared += docKeys.length; }
    } catch (e) { results.errors.push(`Failed to clear Document Properties: ${e.message}`); }
    try {
      const scriptProps = PropertiesService.getScriptProperties();
      const scriptKeys = scriptProps.getKeys();
      if (scriptKeys.length > 0) { scriptProps.deleteAllProperties(); results.propertiesCleared += scriptKeys.length; }
    } catch (e) { results.errors.push(`Failed to clear Script Properties: ${e.message}`); }
    try { CacheService.getScriptCache().removeAll( CacheService.getScriptCache().getAll(docProps.getKeys().concat(scriptProps.getKeys())).map(k=>k)); } // Attempt to clear by known patterns if possible
    catch (e) { Logger.log(`⚠️ ${CONTEXT}: Cache clear warning: ${e.message}`); }

    results.success = results.errors.length === 0;
    results.message = results.success ? 
      `Cleanup successful: ${results.sheetsDeleted.length} other sheets deleted/cleared, ${results.propertiesCleared} properties cleared.` : 
      `Cleanup completed with ${results.errors.length} errors: ${results.errors.join('; ')}`;
    Logger.log(`${CONTEXT}: ${results.message}`);
    return results;
  } catch (e) { 
    const criticalErrorMsg = `Critical unhandled error in data cleanup: ${e.message}`;
    results.success = false; results.errors.push(criticalErrorMsg); results.message = criticalErrorMsg; 
    Logger.log(`❌❌ CRITICAL UNHANDLED error in ${CONTEXT} (outer catch): ${e.message}\nStack: ${e.stack}`);
    return results; 
  }
}

function removeTemporarySheet() {
    const CONTEXT = "MasterSheetManager.removeTemporarySheet";
    try {
        const ss = SpreadsheetApp.getActiveSpreadsheet();
        const tempSheet = ss.getSheetByName('Temporary');
        if (tempSheet && ss.getSheets().length > 1) { // Only delete if it's not the last sheet
            ss.deleteSheet(tempSheet);
            Logger.log(`${CONTEXT}: Temporary sheet removed.`);
            return createSuccessResponse({}, "Temporary sheet removed.");
        } else if (tempSheet) {
            Logger.log(`${CONTEXT}: Temporary sheet is the only sheet, not removed.`);
            return createSuccessResponse({notRemoved: true}, "Temporary sheet is the only sheet, not removed.");
        }
        return createSuccessResponse({notFound: true}, "Temporary sheet not found.");
    } catch (e) {
        return handleError(e, CONTEXT);
    }
}

function setupFreshDatabase() {
  const CONTEXT = "MasterSheetManager.setupFreshDatabase";
  try {
    Logger.log(`=== ${CONTEXT}: STARTING FRESH DATABASE SETUP ===`);
    
    const cleanupResult = completeDataCleanup(); 
    if (!cleanupResult || !cleanupResult.success) { 
        const errMessage = `CRITICAL FAILURE: completeDataCleanup failed: ${cleanupResult.message}`;
        Logger.log(`❌ ${CONTEXT}: ${errMessage}`);
        return createErrorResponse(errMessage, {rawResult: cleanupResult}); 
    }
    
    const createResult = createMasterSheetStructure(); 
    if (!createResult.success) {
      return createErrorResponse(`Database creation failed: ${createResult.message}`, createResult);
    }
    
    // === START MODIFICATION ===
    // Call our new, dedicated function to set the database ID.
    const dbIdResult = initializeDatabaseId();
    if (!dbIdResult.success) {
      // Log a warning but don't halt the entire process
      Logger.log(`⚠️ WARNING: Could not initialize database ID. Message: ${dbIdResult.message}`);
    }
    // === END MODIFICATION ===

    removeTemporarySheet(); 
    
    let protectionResult = { success: true, message: "CellProtection not found/called." };
    if (typeof installCompleteProtection === 'function') { 
        protectionResult = installCompleteProtection();
        if (!protectionResult.success) Logger.log(`⚠️ ${CONTEXT}: Protection installation issues: ${protectionResult.message}`);
    }

    Logger.log(`✅ ${CONTEXT}: Clean database framework setup completed.`);
    return createSuccessResponse({
      cleanup: cleanupResult, 
      creation: createResult, 
      protection: protectionResult,
      summary: `Cleanup: ${cleanupResult.success}, Creation: ${createResult.success}, Protection: ${protectionResult.success}`
    }, "Clean database framework setup completed.");
    
  } catch (e) { return handleError(e, CONTEXT); }
}