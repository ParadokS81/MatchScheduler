/**
 * Schedule Manager - Cell Protection System (Web App Edition)
 *
 * @version 2.2.1 (2025-05-31) - Widened TEAM_TABS protected range for new roster block.
 * @version 2.2.0 (2025-05-29)
 *
 * Description: Database protection system for web app architecture
 * Architecture: Protection for Teams/Players sheets + Team tabs + Bypass system
 * Features: Auto-protection of new team tabs, role-based bypass, web app integration
 */

// Assumes global: BLOCK_CONFIG, getCurrentTimestamp, createErrorResponse, createSuccessResponse, getCurrentUserEmail

// =============================================================================
// PROTECTION CONFIGURATION
// =============================================================================

const PROTECTION_CONFIG = {
  // Master database sheets protection
  MASTER_SHEETS: {
    TEAMS: {
      PROTECTED_RANGE: "A:N", // Teams sheet: TeamID to LogoURL
      DESCRIPTION: "Schedule Manager - Teams Database (Web App Protected)"
    },
    PLAYERS: {
      PROTECTED_RANGE: "A:R", // Players sheet: PlayerID to Team2JoinDate
      DESCRIPTION: "Schedule Manager - Players Database (Web App Protected)"
    }
  },
  
  // Team tab protection (TEAM_DRAGONS, TEAM_PHOENIX, etc.)
  TEAM_TABS: {
    // Updated to cover new simplified roster block columns.
    // A-D for Meta/Time (4)
    // E-K for Mon-Sun Avail (7)
    // L for Roster JSON (merged cell) (1)
    // M for Weekly Changelog (merged cell) (1)
    // Total A-M is 13 columns.
    PROTECTED_RANGE: "A1:M50", 
    DESCRIPTION: "Schedule Manager - Team Availability Sheet (Web App Protected)"
  },
  
  // Protection settings
  SETTINGS: {
    AUTO_PROTECT_NEW_TEAMS: true,
    REMOVE_ALL_EDITORS: true,
    WARNING_ONLY: false,
    PROTECTION_MESSAGE: "This sheet is protected. Use the web application to make changes."
  }
};

// =============================================================================
// COMPLETE PROTECTION INSTALLATION
// =============================================================================

/**
 * Installs protection on all database sheets and team tabs
 * Main entry point for setting up the complete protection system
 * @return {Object} Installation result
 */
function installCompleteProtection() {
  try {
    Logger.log("=== INSTALLING COMPLETE WEB APP PROTECTION SYSTEM ===");
    
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const results = {
      success: true,
      masterSheetsProtected: 0,
      teamTabsProtected: 0,
      totalSheetsProtected: 0,
      errors: [],
      timestamp: getCurrentTimestamp() 
    };
    
    const masterResults = protectMasterDatabaseSheets(ss);
    results.masterSheetsProtected = masterResults.protectedCount;
    if (masterResults.errors.length > 0) {
      results.errors.push(...masterResults.errors);
    }
    
    const teamResults = protectAllTeamTabs(ss);
    results.teamTabsProtected = teamResults.protectedCount;
    if (teamResults.errors.length > 0) {
      results.errors.push(...teamResults.errors);
    }
    
    results.totalSheetsProtected = results.masterSheetsProtected + results.teamTabsProtected;
    results.success = results.errors.length === 0;
    
    if (results.success) {
      Logger.log(`✅ Protection system installed successfully: ${results.totalSheetsProtected} sheets protected`);
      results.message = `Protection installed on ${results.totalSheetsProtected} sheets (${results.masterSheetsProtected} database + ${results.teamTabsProtected} team tabs)`;
    } else {
      Logger.log(`⚠️ Protection system installed with ${results.errors.length} errors`);
      results.message = `Protection installed with ${results.errors.length} errors. Check logs for details.`;
    }
    
    return results;
    
  } catch (e) {
    Logger.log(`❌ Critical error installing protection system: ${e.message}`);
    return createErrorResponse(`Critical protection installation error: ${e.message}`);
  }
}

function protectMasterDatabaseSheets(spreadsheet) {
  const results = { protectedCount: 0, errors: [], sheetsProcessed: [] };
  try {
    const teamsSheet = spreadsheet.getSheetByName(BLOCK_CONFIG.MASTER_SHEET.TEAMS_SHEET);
    if (teamsSheet) {
      const teamsSuccess = protectSheet(
        teamsSheet, 
        PROTECTION_CONFIG.MASTER_SHEETS.TEAMS.PROTECTED_RANGE,
        PROTECTION_CONFIG.MASTER_SHEETS.TEAMS.DESCRIPTION
      );
      results.sheetsProcessed.push({ name: BLOCK_CONFIG.MASTER_SHEET.TEAMS_SHEET, protected: teamsSuccess.success });
      if (teamsSuccess.success) results.protectedCount++;
      else results.errors.push(`Teams sheet: ${teamsSuccess.message}`);
    } else {
      results.errors.push("Teams sheet not found");
    }
    
    const playersSheet = spreadsheet.getSheetByName(BLOCK_CONFIG.MASTER_SHEET.PLAYERS_SHEET);
    if (playersSheet) {
      const playersSuccess = protectSheet(
        playersSheet,
        PROTECTION_CONFIG.MASTER_SHEETS.PLAYERS.PROTECTED_RANGE,
        PROTECTION_CONFIG.MASTER_SHEETS.PLAYERS.DESCRIPTION
      );
      results.sheetsProcessed.push({ name: BLOCK_CONFIG.MASTER_SHEET.PLAYERS_SHEET, protected: playersSuccess.success });
      if (playersSuccess.success) results.protectedCount++;
      else results.errors.push(`Players sheet: ${playersSuccess.message}`);
    } else {
      results.errors.push("Players sheet not found");
    }
  } catch (e) {
    results.errors.push(`Master sheets protection error: ${e.message}`);
  }
  return results;
}

function protectAllTeamTabs(spreadsheet) {
  const results = { protectedCount: 0, totalTeamTabs: 0, errors: [], tabsProcessed: [] };
  try {
    const sheets = spreadsheet.getSheets();
    const teamPrefix = BLOCK_CONFIG.MASTER_SHEET.TEAM_TAB_PREFIX;
    
    for (const sheet of sheets) {
      const sheetName = sheet.getName();
      if (sheetName.startsWith(teamPrefix)) {
        results.totalTeamTabs++;
        const success = protectSheet(
          sheet,
          PROTECTION_CONFIG.TEAM_TABS.PROTECTED_RANGE, // Uses updated wider range
          PROTECTION_CONFIG.TEAM_TABS.DESCRIPTION + ` (${sheetName})`
        );
        results.tabsProcessed.push({ name: sheetName, protected: success.success });
        if (success.success) results.protectedCount++;
        else results.errors.push(`Team tab ${sheetName}: ${success.message}`);
      }
    }
  } catch (e) {
    results.errors.push(`Team tabs protection error: ${e.message}`);
  }
  return results;
}

function protectSheet(sheet, rangeNotation, description) {
  try {
    removeSheetProtection(sheet); // Remove existing protection first
    
    const range = sheet.getRange(rangeNotation);
    const protection = range.protect();
    protection.setDescription(description);
    
    if (PROTECTION_CONFIG.SETTINGS.REMOVE_ALL_EDITORS) {
      protection.removeEditors(protection.getEditors());
    }
    protection.setWarningOnly(PROTECTION_CONFIG.SETTINGS.WARNING_ONLY);
    
    return createSuccessResponse({ sheetName: sheet.getName(), range: rangeNotation }, `Protection applied to ${sheet.getName()}`);
  } catch (e) {
    Logger.log(`❌ Error protecting sheet ${sheet.getName()}: ${e.message}`);
    return createErrorResponse(`Failed to protect sheet ${sheet.getName()}: ${e.message}`);
  }
}

function removeSheetProtection(sheet) {
  try {
    const protections = sheet.getProtections(SpreadsheetApp.ProtectionType.RANGE);
    let removedCount = 0;
    for (const protection of protections) {
      try { protection.remove(); removedCount++; } 
      catch (e) { Logger.log(`Could not remove a protection from ${sheet.getName()}: ${e.message}`); }
    }
    if (removedCount > 0) Logger.log(`Removed ${removedCount} existing protection(s) from ${sheet.getName()}`);
    return createSuccessResponse({ removedCount: removedCount }, `Removed ${removedCount} protections.`);
  } catch (e) {
    Logger.log(`Error removing protection from ${sheet.getName()}: ${e.message}`);
    return createErrorResponse(`Failed to remove protection from ${sheet.getName()}: ${e.message}`);
  }
}

// =============================================================================
// PROTECTION BYPASS SYSTEM
// =============================================================================
function withProtectionBypass(operation, operationName = "Database Operation", targetSheetName = null) {
  let protectedRanges = [];
  const currentUser = getCurrentUserEmail() || "System";
  // Logger.log(`🔓 Protection bypass: Starting "${operationName}" by ${currentUser}${targetSheetName ? ` on sheet ${targetSheetName}` : ''}`);

  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    let sheetsToProcess = [];
    
    if (targetSheetName) {
      const sheet = ss.getSheetByName(targetSheetName);
      if (sheet) sheetsToProcess = [sheet];
      else Logger.log(`⚠️ Target sheet ${targetSheetName} not found for protection bypass`);
    } else {
      try { sheetsToProcess = [ss.getActiveSheet()]; } 
      catch (e) {
        // Logger.log(`⚠️ No active sheet found, bypassing protection on default database sheets`);
        const teamsSheet = ss.getSheetByName(BLOCK_CONFIG.MASTER_SHEET.TEAMS_SHEET);
        const playersSheet = ss.getSheetByName(BLOCK_CONFIG.MASTER_SHEET.PLAYERS_SHEET);
        sheetsToProcess = [teamsSheet, playersSheet].filter(s => s !== null);
      }
    }
    
    for (const sheet of sheetsToProcess) {
      if (!sheet) continue;
      const protections = sheet.getProtections(SpreadsheetApp.ProtectionType.RANGE);
      for (const protection of protections) {
        try {
          protectedRanges.push({ sheet: sheet, range: protection.getRange().getA1Notation(), description: protection.getDescription() });
          protection.remove();
          // Logger.log(`🔓 Removed protection from ${sheet.getName()}: ${protection.getRange().getA1Notation()}`);
        } catch (e) { Logger.log(`⚠️ Failed to remove protection from ${sheet.getName()}: ${e.message}`); }
      }
    }

    const result = operation();
    // Logger.log(`✅ Protection bypass: Operation "${operationName}" completed successfully`);
    return result;

  } catch (e) {
    Logger.log(`❌ Protection bypass: Error in operation "${operationName}": ${e.message}`);
    throw e; 
  } finally {
    // Logger.log(`🔒 Protection bypass: Restoring ${protectedRanges.length} protection(s) after "${operationName}"`);
    for (const pr of protectedRanges) {
      try {
        const newProtection = pr.sheet.getRange(pr.range).protect();
        newProtection.setDescription(pr.description);
        if (PROTECTION_CONFIG.SETTINGS.REMOVE_ALL_EDITORS) newProtection.removeEditors(newProtection.getEditors());
        newProtection.setWarningOnly(PROTECTION_CONFIG.SETTINGS.WARNING_ONLY);
        // Logger.log(`🔒 Restored protection: ${pr.sheet.getName()}: ${pr.range}`);
      } catch (e) { Logger.log(`⚠️ Failed to restore protection on ${pr.sheet.getName()} for range ${pr.range}: ${e.message}`); }
    }
  }
}

function withMultiSheetBypass(operation, operationName, sheetNames = []) {
  let allProtectedRanges = [];
  // Logger.log(`🔓 Multi-sheet bypass: Starting "${operationName}" for sheets: ${sheetNames.join(', ')}`);
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    for (const sheetName of sheetNames) {
      const sheet = ss.getSheetByName(sheetName);
      if (!sheet) { Logger.log(`⚠️ Sheet ${sheetName} not found for multi-sheet bypass`); continue; }
      
      const protections = sheet.getProtections(SpreadsheetApp.ProtectionType.RANGE);
      for (const protection of protections) {
        try {
          allProtectedRanges.push({ sheet: sheet, range: protection.getRange().getA1Notation(), description: protection.getDescription() });
          protection.remove();
        } catch (e) { Logger.log(`Failed to remove protection from ${sheetName} for multi-bypass: ${e.message}`); }
      }
    }
    // if (allProtectedRanges.length > 0) Logger.log(`🔓 Multi-sheet bypass: Removed ${allProtectedRanges.length} protections for "${operationName}"`);
    
    const result = operation();
    return result;
  } catch (e) {
    Logger.log(`❌ Multi-sheet bypass error during "${operationName}": ${e.message}`);
    throw e;
  } finally {
    // Logger.log(`🔒 Multi-sheet bypass: Restoring ${allProtectedRanges.length} protection(s) after "${operationName}"`);
    for (const pr of allProtectedRanges) {
      try {
        const newProtection = pr.sheet.getRange(pr.range).protect();
        newProtection.setDescription(pr.description);
        if (PROTECTION_CONFIG.SETTINGS.REMOVE_ALL_EDITORS) newProtection.removeEditors(newProtection.getEditors());
        newProtection.setWarningOnly(PROTECTION_CONFIG.SETTINGS.WARNING_ONLY);
      } catch (e) { Logger.log(`Failed to restore multi-sheet protection on ${pr.sheet.getName()} for range ${pr.range}: ${e.message}`); }
    }
    // if (allProtectedRanges.length > 0) Logger.log(`🔒 Multi-sheet bypass: Restoration attempt finished for "${operationName}"`);
  }
}

// =============================================================================
// AUTO-PROTECTION FOR NEW TEAM SHEETS
// =============================================================================
function autoProtectNewTeamSheet(teamSheetName) { // Changed param to teamSheetName for clarity
  try {
    if (!PROTECTION_CONFIG.SETTINGS.AUTO_PROTECT_NEW_TEAMS) {
      return createSuccessResponse({ protected: false }, "Auto-protection disabled");
    }
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const teamSheet = ss.getSheetByName(teamSheetName); // Use the passed name
    
    if (!teamSheet) {
      return createErrorResponse(`Auto-protect: Team sheet ${teamSheetName} not found`);
    }
    
    const result = protectSheet( // protectSheet now returns a structured response
      teamSheet,
      PROTECTION_CONFIG.TEAM_TABS.PROTECTED_RANGE,
      PROTECTION_CONFIG.TEAM_TABS.DESCRIPTION + ` (${teamSheetName})`
    );
    
    if (result.success) {
      Logger.log(`✅ Auto-protection applied to new team sheet: ${teamSheetName}`);
      return createSuccessResponse({ teamId: teamSheetName, protected: true }, `Auto-protection applied to ${teamSheetName}`);
    } else {
      Logger.log(`❌ Auto-protection failed for team sheet: ${teamSheetName}: ${result.message}`);
      return result;
    }
  } catch (e) {
    return createErrorResponse(`Auto-protection error for ${teamSheetName}: ${e.message}`);
  }
}

function removeTeamSheetProtection(teamSheetName) { // Changed param
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const teamSheet = ss.getSheetByName(teamSheetName);
    if (!teamSheet) {
      return createErrorResponse(`Remove protection: Team sheet ${teamSheetName} not found`);
    }
    const result = removeSheetProtection(teamSheet); // removeSheetProtection returns structured response
    if (result.success) {
      Logger.log(`✅ Protection removed from team sheet: ${teamSheetName}`);
      return createSuccessResponse({ teamId: teamSheetName, removedCount: result.data.removedCount || 0 }, `Protection removed from ${teamSheetName}`);
    } else {
      return result; 
    }
  } catch (e) {
    return createErrorResponse(`Error removing protection from team sheet ${teamSheetName}: ${e.message}`);
  }
}

// =============================================================================
// PROTECTION STATUS & MONITORING (Assumed mostly unchanged unless structure altered)
// =============================================================================
function getCompleteProtectionStatus() {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheets = ss.getSheets();
    const status = {
      totalSheets: sheets.length, protectedSheets: 0, unprotectedSheets: 0,
      masterSheets: { teams: { exists: false, protected: false, ranges: 0 }, players: { exists: false, protected: false, ranges: 0 } },
      teamSheets: [], otherSheets: [], timestamp: getCurrentTimestamp()
    };
    for (const sheet of sheets) {
      const sheetName = sheet.getName();
      const protections = sheet.getProtections(SpreadsheetApp.ProtectionType.RANGE);
      const isProtected = protections.length > 0;
      if (isProtected) status.protectedSheets++; else status.unprotectedSheets++;
      const sheetInfo = { name: sheetName, protected: isProtected, protectionCount: protections.length, protectionDescriptions: protections.map(p => p.getDescription()) };
      if (sheetName === BLOCK_CONFIG.MASTER_SHEET.TEAMS_SHEET) status.masterSheets.teams = { exists: true, protected: isProtected, ranges: protections.length };
      else if (sheetName === BLOCK_CONFIG.MASTER_SHEET.PLAYERS_SHEET) status.masterSheets.players = { exists: true, protected: isProtected, ranges: protections.length };
      else if (sheetName.startsWith(BLOCK_CONFIG.MASTER_SHEET.TEAM_TAB_PREFIX)) status.teamSheets.push(sheetInfo);
      else status.otherSheets.push(sheetInfo);
    }
    status.summary = {
      masterSheetsProtected: (status.masterSheets.teams.protected ? 1 : 0) + (status.masterSheets.players.protected ? 1 : 0),
      teamTabsProtected: status.teamSheets.filter(t => t.protected).length,
      systemHealthy: status.masterSheets.teams.protected && status.masterSheets.players.protected
    };
    return status; // Not an API response, direct object
  } catch (e) {
    Logger.log(`❌ Error getting protection status: ${e.message}`);
    return { error: e.message, totalSheets: 0, protectedSheets: 0, timestamp: getCurrentTimestamp() };
  }
}

function validateProtectionSystem() {
  try {
    const status = getCompleteProtectionStatus();
    const validation = { success: true, issues: [], warnings: [], recommendations: [] };
    if (!status.masterSheets.teams.exists) { validation.issues.push("Teams sheet not found"); validation.success = false; }
    else if (!status.masterSheets.teams.protected) { validation.issues.push("Teams sheet is not protected"); validation.success = false; }
    if (!status.masterSheets.players.exists) { validation.issues.push("Players sheet not found"); validation.success = false; }
    else if (!status.masterSheets.players.protected) { validation.issues.push("Players sheet is not protected"); validation.success = false; }
    const unprotectedTeamTabs = status.teamSheets.filter(t => !t.protected);
    if (unprotectedTeamTabs.length > 0) validation.warnings.push(`${unprotectedTeamTabs.length} team tab(s) are not protected: ${unprotectedTeamTabs.map(t => t.name).join(', ')}`);
    if (status.protectedSheets < status.totalSheets) validation.recommendations.push("Consider protecting all sheets for maximum security");
    if (validation.success) Logger.log(`✅ Protection system validation passed`);
    else Logger.log(`❌ Protection system validation failed: ${validation.issues.length} issues`);
    return validation; // Direct object
  } catch (e) {
    Logger.log(`❌ Error validating protection system: ${e.message}`);
    return { success: false, error: e.message, issues: [`Validation error: ${e.message}`] };
  }
}

// =============================================================================
// ADMIN FUNCTIONS
// =============================================================================
function setupCompleteProtection() {
  try {
    const result = installCompleteProtection();
    const ui = SpreadsheetApp.getUi(); // Try to get UI
    if (result.success) {
      const message = `✅ Protection System Installed Successfully!\n\n` +
                     `Database Protection: ${result.masterSheetsProtected}/2 master sheets\n` +
                     `Team Tabs Protection: ${result.teamTabsProtected} team sheets\n` +
                     `Total Protected: ${result.totalSheetsProtected} sheets\n\n` +
                     `All sheets are now protected from direct editing.\n` +
                     `The web application will handle all data modifications.`;
      try { ui.alert('Protection System Installed', message, ui.ButtonSet.OK); } catch (e) { Logger.log("UI not available for success alert."); }
    } else {
      const errorMessage = `❌ Protection Installation Issues\n\n` +
                          `Errors encountered: ${result.errors.length}\n` +
                          `Protected: ${result.totalSheetsProtected} sheets\n\n` +
                          `Check the execution log for detailed error information.`;
      try { ui.alert('Protection Installation Issues', errorMessage, ui.ButtonSet.OK); } catch (e) { Logger.log("UI not available for error alert."); }
    }
    return result; // Direct object
  } catch (e) {
    Logger.log(`❌ Error in protection setup: ${e.message}`);
    try { SpreadsheetApp.getUi().alert('Protection Setup Error', `Failed to install protection system:\n\n${e.message}`, SpreadsheetApp.getUi().ButtonSet.OK); } 
    catch (uiE) { Logger.log("UI not available for critical error alert."); }
    return createErrorResponse(`Protection setup failed: ${e.message}`);
  }
}

function removeAllProtection() {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheets = ss.getSheets();
    let totalRemoved = 0;
    const results = [];
    for (const sheet of sheets) {
      const result = removeSheetProtection(sheet); // This is the internal helper now
      results.push({ sheet: sheet.getName(), removed: result.success ? (result.data.removedCount || 0) : 0, message: result.message });
      if(result.success) totalRemoved += (result.data.removedCount || 0);
    }
    const message = `✅ All Protection Removed\n\n` +
                   `Attempted to remove protections. Total successful removals: ${totalRemoved} from ${sheets.length} sheets.\n\n` +
                   `⚠️ WARNING: All sheets might now be edited directly!\n` +
                   `Remember to reinstall protection when ready. Review logs if any sheet reported issues.`;
    try { SpreadsheetApp.getUi().alert('Protection Removed', message, SpreadsheetApp.getUi().ButtonSet.OK); } 
    catch (e) { Logger.log("UI not available for remove all protection alert."); }
    
    return createSuccessResponse({ totalRemoved: totalRemoved, sheetsProcessed: sheets.length, details: results }, 
                                 `Attempted to remove ${totalRemoved} protections from ${sheets.length} sheets.`);
  } catch (e) {
    Logger.log(`❌ Error removing all protection: ${e.message}`);
    try { SpreadsheetApp.getUi().alert('Error', `Failed to remove all protection:\n\n${e.message}`); } 
    catch (uiE) { Logger.log("UI not available for critical error on remove all."); }
    return createErrorResponse(`Failed to remove all protection: ${e.message}`);
  }
}