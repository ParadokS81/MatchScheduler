/**
 * Schedule Manager - Web App Controller (Delta Sync Update)
 * 
 * @version 2.1.0 (2025-06-12) - Added delta sync controller endpoints
 * @version 2.0.0 (2025-06-10) - Previous version baseline
 * 
 * Description: Web app entry point with user-based routing.
 * Uses centralized ROLES/PERMISSIONS and functions from PermissionManager.js.
 * 
 * CHANGELOG:
 * 2.1.0 - 2025-06-12 - Added batchCheckForChanges, warmFavoriteTeamsCache, updated checkForScheduleUpdates.
 * 2.0.0 - 2025-06-10 - Previous version baseline
 */

// ROLES and PERMISSIONS are now global constants defined in PermissionManager.js

// =============================================================================
// MAIN WEB APP ENTRY POINTS
// =============================================================================

function doGet(e) {
  const CONTEXT = "WebAppController.doGet";
  try {
    const userContextData = getUserContext(); // This calls WebAppAPI.getUserContext()

    const template = HtmlService.createTemplateFromFile('index');
    // Make the userContextData available to the template using the specific name 'userContextFromServer'
    template.userContextFromServer = userContextData; 
    
    // Also pass necessary config items directly if not already part of userContextData.appClientConfig
    // This ensures BLOCK_CONFIG and ROLES are available for the scriptlets during server-side evaluation.
    template.BLOCK_CONFIG = BLOCK_CONFIG; // Make BLOCK_CONFIG available to the template
    template.ROLES = ROLES;               // Make ROLES available to the template

    const htmlOutput = template.evaluate()
      .setTitle(BLOCK_CONFIG.WEB_APP.TITLE || 'Schedule Manager')
      .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
    
    return htmlOutput;
    
  } catch (error) {
    Logger.log(`Error in ${CONTEXT}: ${error.message}\nStack: ${error.stack}`);
    // Return a user-friendly error page
    const errorTemplate = HtmlService.createTemplate(
      `<html>
         <body style="font-family: Arial, sans-serif; display: flex; justify-content: center; align-items: center; height: 100vh; margin: 0; background-color: #111827; color: #e5e7eb;">
           <div style="background-color: #1f2937; padding: 2rem; border-radius: 0.5rem; box-shadow: 0 10px 15px -3px rgba(0,0,0,0.1), 0 4px 6px -2px rgba(0,0,0,0.05);">
             <h1 style="font-size: 1.5rem; color: #38bdf8; margin-bottom: 1rem;">Application Error</h1>
             <p>Sorry, an unexpected error occurred while loading the application.</p>
             <p style="font-size: 0.875rem; color: #9ca3af; margin-top: 1.5rem;">Error details: ${error.message}</p>
             <p style="font-size: 0.875rem; color: #9ca3af;">Please try refreshing the page. If the issue persists, contact support.</p>
           </div>
         </body>
       </html>`
    );
    // Pass the error message to the error template (optional, for display)
    // errorTemplate.errorMessage = error.message; // Example if your template uses it
    return errorTemplate.evaluate()
                        .setTitle("Application Error")
                        .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
  }
}

function include(filename) {
  try {
    return HtmlService.createHtmlOutputFromFile(filename).getContent();
  } catch (e) {
    Logger.log(`Error including file ${filename}: ${e.message}`);
    return ``;
  }
}

// =============================================================================
// BACKEND API FUNCTIONS (Exposed to google.script.run via WebAppController)
// These now directly call the corresponding global functions (defined in WebAppAPI.js or other managers)
// =============================================================================

// --- User Context & Status ---
function getUserContextForTemplate() { // Called by doGet or directly by frontend if needed on init
    return getUserContext(); // DIRECT CALL to global function from WebAppAPI.js
}
function getMyTeams() {
    const activeUser = getActiveUser(); // Global from PermissionManager.js
    if(!activeUser) return [];
    return getUserTeams(activeUser.getEmail()); // DIRECT CALL to global function from PlayerDataManager.js
}

// FIXED: Renamed to prevent recursion
function handleGetUserStatus() { return getUserStatus(); } // DIRECT CALL to global function from WebAppAPI.js
function handleUpdateUserDisplayName(newDisplayName) { return updateUserDisplayName(newDisplayName); } // DIRECT CALL to global function from WebAppAPI.js
function handleRefreshUserSession() { return refreshUserSession(); } // DIRECT CALL to global function from WebAppAPI.js

function updateMyProfile(profileData) {
    return apiUpdateMyProfile(profileData);
}

// --- Team Operations ---
function getPublicTeams() {
    const allTeamsResult = getAllTeams(true); // DIRECT CALL to global function from TeamDataManager.js
    if (!allTeamsResult.success) return [];
    return allTeamsResult.teams.filter(team => team.isPublic).map(team => ({
        teamId: team.teamId, teamName: team.teamName, division: team.division,
        playerCount: team.playerCount, maxPlayers: team.maxPlayers, logoUrl: team.logoUrl
    }));
}

function createNewTeam(teamData, creatorInitials, creatorDisplayNameForTeam) {
    const activeUser = getActiveUser(); // Global from PermissionManager.js
    if (!activeUser) return createErrorResponse("Authentication required."); // Global from Configuration.js
    const userEmail = activeUser.getEmail();

    if (!userHasPermission(userEmail, PERMISSIONS.CREATE_TEAM)){ // Global from PermissionManager.js
        return createErrorResponse("Permission denied to create a new team."); // Global from Configuration.js
    }

    const initialsValidation = validatePlayerInitials(creatorInitials); // Global from PlayerDataManager.js or Configuration.js
    if (!initialsValidation.isValid) {
        return createErrorResponse(`Invalid initials provided for new team: ${initialsValidation.errors.join(', ')}`);
    }
    const displayNameValidation = validatePlayerDisplayName(creatorDisplayNameForTeam); // Global from PlayerDataManager.js or Configuration.js
    if (!displayNameValidation.isValid) {
        return createErrorResponse(`Invalid display name provided for new team: ${displayNameValidation.errors.join(', ')}`);
    }

    const completeTeamData = { ...teamData, leaderEmail: userEmail };

    return createNewTeamAndAddLeader(completeTeamData, userEmail, creatorInitials, creatorDisplayNameForTeam); // DIRECT CALL to global function from WebAppAPI.js
}

function joinTeamWithCode(joinCode, initials) {
    const activeUser = getActiveUser(); // Global from PermissionManager.js
    if (!activeUser) {
        return createErrorResponse("Authentication required."); // Global from Configuration.js
    }
    const userEmail = activeUser.getEmail();
    
    // Call the updated PlayerDataManager function which no longer needs a display name passed from the client.
    const result = joinTeamByCode(userEmail, joinCode, initials); // DIRECT CALL to global function from PlayerDataManager.js
    
    if(result.success) {
        clearUserRoleCache(userEmail); // Global from PermissionManager.js
    }
    return result;
}


function kickPlayerAndRegenerateCode(teamId, playerToKickEmail) {
    const activeUser = getActiveUser();
    if (!activeUser) {
        return createErrorResponse("Authentication required.");
    }
    // This now correctly calls the renamed function in WebAppAPI.js
    return api_kickPlayerAndRegenerateCode(teamId, playerToKickEmail); 
}

// --- Availability ---
function getTeamSchedule(teamId, year, weekNumber) { return apiGetTeamSchedule(teamId, year, weekNumber); } // DIRECT CALL to global function from WebAppAPI.js
function updatePlayerAvailabilityForMultipleWeeks(teamId, action, weeklyPayloads) {
    const CONTEXT = "WebAppController.updatePlayerAvailabilityForMultipleWeeks";
    try {
        const activeUser = getActiveUser(); // From PermissionManager.js
        if (!activeUser) {
            return createErrorResponse("Authentication required."); //
        }
        const userEmail = activeUser.getEmail();

        // Delegate to the new service function in AvailabilityManager.js
        // This service function will handle the detailed logic including coordinate translation.
        return availabilityManager_updatePlayerAvailabilityForMultipleWeeks_SERVICE( //
            userEmail,
            teamId,
            action,
            weeklyPayloads
        );
    } catch (e) {
        Logger.log(`Error in ${CONTEXT}: ${e.message}\nStack: ${e.stack}`);
        return handleError(e, CONTEXT); //
    }
}

function getTeamSchedulesForDisplay(teamId, year1, week1, year2, week2) {
    const CONTEXT = "WebAppController.getTeamSchedulesForDisplay";
    try {
        const activeUser = getActiveUser(); // From PermissionManager.js
        if (!activeUser) {
            // If using createErrorResponse from Configuration.js
            return createErrorResponse("Authentication required."); //
            // Or, if you have a more specific way to return errors for non-authenticated users:
            // return { success: false, message: "Authentication required.", error: "User not authenticated." };
        }
        const userEmail = activeUser.getEmail();

        // Call AvailabilityManager.getTeamScheduleRange
        // This function expects startYear, startWeek, endYear, endWeek.
        // We assume year1, week1 is the earlier week and year2, week2 is the later week.
        // getTeamScheduleRange is assumed to be globally available from AvailabilityManager.js
        return getTeamScheduleRange(userEmail, teamId, year1, week1, year2, week2); //

    } catch (e) {
        Logger.log(`Error in ${CONTEXT} for team ${teamId}, weeks ${year1}-W${week1} & ${year2}-W${week2}: ${e.message}\nStack: ${e.stack}`);
        // If using handleError from Configuration.js
        return handleError(e, CONTEXT); //
        // Or a simple error structure:
        // return { success: false, message: `Error fetching schedule range: ${e.message}`, error: String(e) };
    }
}

// --- Server-Side Rendering (NEW) ---
function getPreRenderedScheduleGrids(teamId) {
    return api_getPreRenderedScheduleGrids(teamId); // DIRECT CALL to global function from WebAppAPI.js
}

// --- Availability Templates ---
function saveUserAvailabilityTemplate(templateData) {
    const activeUser = getActiveUser();
    if (!activeUser) return createErrorResponse("Authentication required.");
    
    return saveAvailabilityTemplate(activeUser.getEmail(), templateData);
}

function loadUserAvailabilityTemplate() {
    const activeUser = getActiveUser();
    if (!activeUser) return createErrorResponse("Authentication required.");
    
    return loadAvailabilityTemplate(activeUser.getEmail());
}

// --- Logo Management ---
function handleLogoUpload(teamId, base64Data, fileName, mimeType) { return uploadTeamLogo(teamId, base64Data, fileName, mimeType); } // DIRECT CALL to global function from WebAppAPI.js
function handleLogoUrlUpdate(teamId, logoUrl) { return updateTeamLogoFromUrl(teamId, logoUrl); } // DIRECT CALL to global function from WebAppAPI.js
function handleLogoDeletion(teamId) { return deleteTeamLogoById(teamId); } // DIRECT CALL to global function from WebAppAPI.js
function getTeamLogo(teamId) { return getTeamLogoInfo(teamId); } // DIRECT CALL to global function from WebAppAPI.js
function validateLogoUrl(logoUrl) { return validateLogoUrlForFrontend(logoUrl); } // DIRECT CALL to global function from WebAppAPI.js


// --- Admin Functions ---
function adminSetTeamLeader(teamId, newLeaderUserEmail) {
    const activeUser = getActiveUser(); // Global from PermissionManager.js
    if (!activeUser) {
        return createErrorResponse("Authentication required for admin actions."); // Global from Configuration.js
    }
    return core_adminSetTeamLeader(teamId, newLeaderUserEmail, activeUser.getEmail()); // DIRECT CALL to global function from Administrator.js (was already correct)
}


// --- Utilities ---
// FIXED: Renamed to prevent recursion
function handleGetSystemInfo() { return getSystemInfo(); } // DIRECT CALL to global function from WebAppAPI.js
function getSystemConfig() {
    return createSuccessResponse({ // Global from Configuration.js
        config: {
            maxTeamsPerPlayer: BLOCK_CONFIG.TEAM_SETTINGS.MAX_TEAMS_PER_PLAYER, // BLOCK_CONFIG from Configuration.js
            maxPlayersPerTeam: BLOCK_CONFIG.TEAM_SETTINGS.MAX_PLAYERS_PER_TEAM, // BLOCK_CONFIG from Configuration.js
            allowedDivisions: BLOCK_CONFIG.TEAM_SETTINGS.ALLOWED_DIVISIONS, // BLOCK_CONFIG from Configuration.js
            maxPlayerDisplayNameLength: BLOCK_CONFIG.TEAM_SETTINGS.MAX_PLAYER_DISPLAY_NAME_LENGTH, // BLOCK_CONFIG from Configuration.js
            maxPlayerInitialsLength: BLOCK_CONFIG.TEAM_SETTINGS.MAX_PLAYER_INITIALS_LENGTH, // BLOCK_CONFIG from Configuration.js
            logo: BLOCK_CONFIG.LOGO, // BLOCK_CONFIG from Configuration.js
            version: BLOCK_CONFIG.VERSION // BLOCK_CONFIG from Configuration.js
        }
    });
}

// FIXED: Renamed to prevent recursion  
function handleLogFrontendError(errorMessage, context) { return logFrontendError(errorMessage, context); } // DIRECT CALL to global function from WebAppAPI.js

// FIXED: Renamed to prevent recursion
function handleCheckForScheduleUpdates(teamId, clientLastLoadTimestampMillis) {
  // Use enhanced delta sync version
  return checkForScheduleUpdates(teamId, clientLastLoadTimestampMillis);
}

// Add these functions to the WebAppController.js file

function getLightweightTeamList() {
    Logger.log("=== FRONTEND CALLED getLightweightTeamList ===");
    const result = apiGetLightweightTeamList();
    Logger.log("=== getLightweightTeamList result: " + JSON.stringify(result) + " ===");
    return result;
}

function getRosterForTeam(teamId) {
    return apiGetRosterForTeam(teamId);
}

function handleGetTeamsLastUpdateTime() {
    return getTeamsLastUpdateTime();
}

function toggleFavoriteTeam(teamId, isFavorite) {
    return apiToggleFavoriteTeam(teamId, isFavorite);
}

function debugGetLightweightTeamListDetailed() {
  const CONTEXT = "DEBUG.getLightweightTeamListDetailed";
  Logger.log(`=== ${CONTEXT}: Starting detailed debug ===`);
  
  try {
    // Step 1: Check spreadsheet
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    Logger.log(`${CONTEXT}: Got spreadsheet: ${ss.getName()}`);
    
    // Step 2: Check if SYSTEM_CACHE exists
    const cacheSheet = ss.getSheetByName('SYSTEM_CACHE');
    Logger.log(`${CONTEXT}: SYSTEM_CACHE exists: ${!!cacheSheet}`);
    
    if (!cacheSheet) {
      Logger.log(`${CONTEXT}: SYSTEM_CACHE not found. Available sheets: ${ss.getSheets().map(s => s.getName()).join(', ')}`);
      return createErrorResponse("System cache not found.");
    }
    
    // Step 3: Check last row
    const lastRow = cacheSheet.getLastRow();
    Logger.log(`${CONTEXT}: Last row in SYSTEM_CACHE: ${lastRow}`);
    
    if (lastRow < 2) {
      Logger.log(`${CONTEXT}: No data rows (lastRow < 2)`);
      return createSuccessResponse({ teams: [], timestamp: null }, "No teams in cache.");
    }
    
    // Step 4: Check range and data
    const rowsToRead = lastRow - 1;
    Logger.log(`${CONTEXT}: Reading ${rowsToRead} rows from A2:E${lastRow}`);
    
    const data = cacheSheet.getRange(2, 1, rowsToRead, 5).getValues(); // A:E
    Logger.log(`${CONTEXT}: Raw data length: ${data.length}`);
    
    if (data.length > 0) {
      Logger.log(`${CONTEXT}: First row sample: [${data[0].join(', ')}]`);
      Logger.log(`${CONTEXT}: Data types: [${data[0].map(v => typeof v).join(', ')}]`);
    }
    
    // Step 5: Map the data
    const teams = data.map((row, index) => {
      const team = {
        teamId: row[0], 
        teamName: row[1], 
        division: row[2], 
        logoUrl: row[3], 
        isPublic: row[4]
      };
      Logger.log(`${CONTEXT}: Row ${index}: teamId="${team.teamId}", teamName="${team.teamName}", isPublic=${team.isPublic}`);
      return team;
    });
    
    // Step 6: Filter for public teams
    const publicTeams = teams.filter(team => team.isPublic);
    Logger.log(`${CONTEXT}: Total teams: ${teams.length}, Public teams: ${publicTeams.length}`);
    
    // Step 7: Get timestamp
    const timestamp = cacheSheet.getRange('G1').getValue();
    Logger.log(`${CONTEXT}: Timestamp from G1: ${timestamp} (type: ${typeof timestamp})`);
    
    // Step 8: Create response
    const responseData = { teams: publicTeams, timestamp: timestamp };
    Logger.log(`${CONTEXT}: Response data before createSuccessResponse: ${JSON.stringify(responseData)}`);
    
    const finalResponse = createSuccessResponse(responseData);
    Logger.log(`${CONTEXT}: Final response: ${JSON.stringify(finalResponse)}`);
    
    return finalResponse;
    
  } catch (e) {
    Logger.log(`${CONTEXT}: Exception caught: ${e.message}`);
    Logger.log(`${CONTEXT}: Exception stack: ${e.stack}`);
    return handleError(e, CONTEXT);
  }
}

function debugWhatFunctionIsCalled() {
    Logger.log("=== FRONTEND CALLED debugWhatFunctionIsCalled ===");
    return { 
        success: true, 
        message: "This is debugWhatFunctionIsCalled", 
        functionName: "debugWhatFunctionIsCalled",
        teams: [{ test: "data" }]
    };
}

function debugAvailableFunctions() {
    Logger.log("=== DEBUGGING AVAILABLE FUNCTIONS ===");
    
    // List some known working functions
    const functions = {
        getTeamSchedulesForDisplay: typeof getTeamSchedulesForDisplay,
        getLightweightTeamList: typeof getLightweightTeamList,
        apiGetLightweightTeamList: typeof apiGetLightweightTeamList,
        createNewTeam: typeof createNewTeam,
        getPublicTeams: typeof getPublicTeams
    };
    
    Logger.log("Function availability:", JSON.stringify(functions));
    return { success: true, functions: functions };
}

// --- Generic Drive Image Function (NEW) ---
function getDriveImageAsBase64(driveUrl) {
  return imageService_getDriveImageAsBase64(driveUrl);
}

// --- Logo Base64 Functions ---
function getTeamLogoAsBase64(teamId) {
  return imageService_getTeamLogoAsBase64(teamId);
}

function getMultipleTeamLogosAsBase64(teamIds) {
  return imageService_getMultipleTeamLogosAsBase64(teamIds);
}

// === HANDOVER TASK: Add delta sync controller endpoints (Phase 2A)

// =============================================================================
// DELTA SYNC CONTROLLER ENDPOINTS
// =============================================================================

/**
 * Batch check multiple teams for changes - used for dashboard views
 * @param {Array<Object>} teamChecks - Array of {teamId, lastTimestamp} objects
 * @return {Object} Batch results showing which teams have changes
 */
function batchCheckForChanges(teamChecks) {
  return api_batchCheckForChanges(teamChecks);
}

/**
 * Pre-warm cache for user's favorite teams to improve performance
 * @param {Array<string>} teamIds - Array of team IDs to pre-cache
 * @return {Object} Results of cache warming operation
 */
function warmFavoriteTeamsCache(teamIds) {
  return api_warmCacheForTeams(teamIds);
}

/**
 * Check for schedule updates since last load
 * @param {string} teamId - Team to check
 * @param {number} clientLastLoadTimestamp - Client's last known timestamp
 * @return {Object} Change information
 */
/**
 * Check for schedule updates since last load. Now calls the detailed delta API.
 * @param {string} teamId - Team to check for changes
 * @param {number} clientLastLoadTimestamp - Client's last known timestamp (milliseconds)
 * @return {Object} Detailed change information from delta API
 */
function checkForScheduleUpdates(teamId, clientLastLoadTimestamp) {
  // Direct passthrough to the new, more powerful delta API function
  return api_getScheduleChanges(teamId, clientLastLoadTimestamp);
}

/**
 * Batch check multiple teams for changes
 * @param {Array<Object>} teamChecks - Array of {teamId, lastTimestamp}
 * @return {Object} Batch results
 */
function batchCheckForChanges(teamChecks) {
  return api_batchCheckForChanges(teamChecks);
}

/**
 * Warm cache for favorite teams
 * @param {Array<string>} teamIds - Team IDs to pre-cache
 * @return {Object} Warming results
 */
function warmFavoriteTeamsCache(teamIds) {
  return api_warmCacheForTeams(teamIds);
}

/**
 * Get roster for a specific team (fast index lookup)
 * @param {string} teamId - Team ID
 * @return {Object} Roster data
 */
function getRosterForTeam(teamId) {
  const CONTEXT = "WebAppController.getRosterForTeam";
  try {
    const activeUser = getActiveUser();
    if (!activeUser) return createErrorResponse("Authentication required.");
    
    const userEmail = activeUser.getEmail();
    
    // Check permissions - must be team member or admin
    const isAdmin = userHasPermission(userEmail, PERMISSIONS.MANAGE_ALL_TEAMS);
    const isMember = isPlayerOnTeam(userEmail, teamId);
    
    if (!isAdmin && !isMember) {
      return createErrorResponse("Permission denied to view team roster.");
    }
    
    const roster = getTeamRosterFromIndex(teamId);
    return createSuccessResponse({ roster: roster });
    
  } catch (e) {
    return handleError(e, CONTEXT);
  }
}

// === HANDOVER TASK: Add admin cache management functions (Phase 2A)

// =============================================================================
// CACHE MANAGEMENT ENDPOINTS
// =============================================================================

/**
 * Invalidate all caches for a specific team
 * Admin only function for troubleshooting
 * @param {string} teamId - Team ID to clear caches for
 * @return {Object} Clear result
 */
function adminClearTeamCaches(teamId) {
  const CONTEXT = "WebAppController.adminClearTeamCaches";
  try {
    const activeUser = getActiveUser();
    if (!activeUser) return createErrorResponse("Authentication required.");
    
    const userEmail = activeUser.getEmail();
    if (!userHasPermission(userEmail, PERMISSIONS.MANAGE_ALL_TEAMS)) {
      return createErrorResponse("Admin permission required.");
    }
    
    // Clear multiple cache types
    const cache = CacheService.getScriptCache();
    const keysToRemove = [
      `teamData_${teamId}_incInactive_true`,
      `teamData_${teamId}_incInactive_false`,
      `teamMeta_${teamId}`
    ];
    
    // Get team data for sheet name
    const teamData = getTeamData(teamId);
    if (teamData && teamData.availabilitySheetName) {
      // Clear schedule caches for this team
      for (let year = 2024; year <= 2026; year++) {
        for (let week = 1; week <= 53; week++) {
          keysToRemove.push(`scheduleData_${teamData.availabilitySheetName}_${year}_W${week}`);
        }
      }
      
      // Clear cell changes
      keysToRemove.push(`cellChanges_${teamId}_${teamData.availabilitySheetName}`);
    }
    
    cache.removeAll(keysToRemove);
    
    return createSuccessResponse({
      teamId: teamId,
      keysCleared: keysToRemove.length
    }, `Cleared ${keysToRemove.length} cache entries for team ${teamId}`);
    
  } catch (e) {
    return handleError(e, CONTEXT);
  }
}

/**
 * Force rebuild player index
 * Admin only function for maintenance
 * @return {Object} Rebuild result
 */
function adminRebuildPlayerIndex() {
  const CONTEXT = "WebAppController.adminRebuildPlayerIndex";
  try {
    const activeUser = getActiveUser();
    if (!activeUser) return createErrorResponse("Authentication required.");
    
    const userEmail = activeUser.getEmail();
    if (!userHasPermission(userEmail, PERMISSIONS.MANAGE_ALL_PLAYERS)) {
      return createErrorResponse("Admin permission required to rebuild player index.");
    }
    
    Logger.log(`${CONTEXT}: Admin ${userEmail} initiated player index rebuild`);
    
    const result = rebuildPlayerIndex();
    
    if (result.success) {
      // Show success message
      SpreadsheetApp.getActiveSpreadsheet().toast(
        `Index rebuilt: ${result.indexEntriesCreated} entries created`,
        'Player Index Rebuilt',
        10
      );
    }
    
    return result;
    
  } catch (e) {
    return handleError(e, CONTEXT);
  }
}

// Add this function to WebAppController.js
function handleGetTeamData(teamId) { // The public name can be simpler
    return api_getTeamData(teamId);
}

/**
 * NEW FUNCTION for WebAppController.js
 * This is the public entry point that your frontend UI calls.
 * Its only job is to receive the request and pass it to the backend API logic.
 */
function handleKickPlayerAndRegenerateCode(teamId, playerToKickEmail) {
  const activeUser = getActiveUser();
  if (!activeUser) {
    return createErrorResponse("Authentication required.");
  }
  
  // This securely calls the function in WebAppAPI.js that does the actual work.
  return api_kickPlayerAndRegenerateCode(teamId, playerToKickEmail);
}

function getScheduleForTeam(teamId) {
    return api_getScheduleForTeam(teamId);
}

/**
 * Returns the BLOCK_CONFIG object to the client.
 * This is used for dynamic client-side configuration.
 */
function getSystemConfigForClient() {
  const CONTEXT = "WebAppController.getSystemConfigForClient";
  try {
    // BLOCK_CONFIG is a global constant defined in Configuration.js
    return createSuccessResponse({ config: BLOCK_CONFIG }); 
  } catch (e) {
    return handleError(e, CONTEXT);
  }
}

function getScheduleForTeam(teamId) {
    return api_getScheduleForTeam(teamId);
}