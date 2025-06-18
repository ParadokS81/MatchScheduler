/**
 * Schedule Manager - Player Data Manager (FIXED CACHING SYSTEM)
 *
 * @version 1.7.0 (2025-06-07) - FIXED: Comprehensive caching system overhaul for reliability
 * @version 1.6.0 (2025-05-31) - Added logic to update current week roster block on team sheet on join/leave.
 * @version 1.5.3 (2025-05-31) - Refactored disassociatePlayersFromTeam for batch sheet updates.
 * @version 1.5.2 (2025-05-31) - Added specific diagnostic logging to createPlayer & joinTeamByCode. Ensured all global calls are direct.
 * @version 1.5.1 (2025-05-31) - Ensured syncTeamPlayerData and disassociatePlayersFromTeam are present and correct.
 * @version 1.5.0 (2025-05-31) - Implemented Caching for getPlayerDataByEmail/Id and invalidation.
 * @version 1.4.0 (2025-05-31) - Added TeamDataManager cache invalidation to syncTeamPlayerData.
 *
 * FIXED CACHING ISSUES:
 * - Cache invalidation now happens AFTER successful writes
 * - Added forced cache refresh after operations
 * - Fixed race conditions in createPlayer/getPlayerDataByEmail
 * - Added comprehensive cache key coverage
 * - Added debug logging for cache operations
 * - Added proper delays for sheet operation completion
 */

// Assumes global constants: ROLES, PERMISSIONS, BLOCK_CONFIG
// Assumes global functions from Configuration.js: createErrorResponse, createSuccessResponse, handleError, isValidEmail, getCurrentTimestamp, formatDate
// Assumes global functions from CellProtection.js: withProtectionBypass
// Assumes global functions from PermissionManager.js: userHasPermission, clearUserRoleCache
// Assumes global functions from TeamDataManager.js: getTeamData, validateJoinCode, isUserTeamLeader, _invalidateTeamCache, getTeamDataByJoinCode
// Assumes global functions from AvailabilityManager.js: removePlayerInitialsFromSchedule
// Assumes global functions from WeekBlockManager.js: findWeekBlock, ensureWeekExists

const PLAYER_DATA_CACHE_EXPIRATION_SECONDS = 300; // 5 minutes

// =============================================================================
// IMPROVED CACHE MANAGEMENT SYSTEM
// =============================================================================

/**
 * Comprehensive cache invalidation for player data
 * FIXED: Now covers all possible cache key patterns
 */
function _pdm_invalidatePlayerCache(email, playerId, debugContext = "Unknown") {
    if (!email && !playerId) return;
    
    try {
        const cache = CacheService.getScriptCache();
        const keysToRemove = [];
        
        if (email) {
            const lcEmail = email.toLowerCase();
            keysToRemove.push(`playerData_email_${lcEmail}_incInactive_false`);
            keysToRemove.push(`playerData_email_${lcEmail}_incInactive_true`);
            Logger.log(`[CACHE] Invalidating player cache for email: ${lcEmail} (Context: ${debugContext})`);
        }
        
        if (playerId) {
            keysToRemove.push(`playerData_id_${playerId}_incInactive_false`);
            keysToRemove.push(`playerData_id_${playerId}_incInactive_true`);
            Logger.log(`[CACHE] Invalidating player cache for ID: ${playerId} (Context: ${debugContext})`);
        }
        
        if (keysToRemove.length > 0) {
            cache.removeAll(keysToRemove);
            Logger.log(`[CACHE] Removed ${keysToRemove.length} cache keys (Context: ${debugContext})`);
        }
    } catch (e) {
        Logger.log(`[CACHE] Warning: Failed to invalidate player cache: ${e.message} (Context: ${debugContext})`);
    }
}

/**
 * Force refresh player data from sheet (bypasses cache)
 * FIXED: Ensures fresh data after write operations
 */
function _pdm_forceRefreshPlayerData(email, includeInactive = false, debugContext = "Unknown") {
    if (!email || !isValidEmail(email)) return null;
    
    Logger.log(`[CACHE] Force refreshing player data for ${email} (Context: ${debugContext})`);
    
    // First invalidate cache
    _pdm_invalidatePlayerCache(email, null, `${debugContext}-ForceRefresh`);
    
    // Add small delay to ensure cache invalidation propagates
    Utilities.sleep(100);
    
    // Then read fresh data (will rebuild cache)
    return getPlayerDataByEmail(email, includeInactive);
}

function _pdm_invalidateTeamDataCache(teamId, debugContext = "Unknown") { 
    if (!teamId) return;
    
    try {
        const cache = CacheService.getScriptCache();
        const cacheKeyActive = `teamData_${teamId}_incInactive_false`;
        const cacheKeyInactive = `teamData_${teamId}_incInactive_true`;
        cache.remove(cacheKeyActive);
        cache.remove(cacheKeyInactive);
        Logger.log(`[CACHE] Invalidated team cache for ${teamId} (Context: ${debugContext})`);
    } catch (e) {
        Logger.log(`[CACHE] Warning: Failed to invalidate team cache: ${e.message} (Context: ${debugContext})`);
    }
}

// =============================================================================
// PLAYER CRUD OPERATIONS (FIXED)
// =============================================================================

function createPlayer(playerData) {
  const CONTEXT = "PlayerDataManager.createPlayer";
  try {
    Logger.log(`${CONTEXT}: Creating player for ${playerData.googleEmail}`);
    
    const validation = validatePlayerCreationData(playerData); // Local helper
    if (!validation.isValid) {
      return createErrorResponse(`Player validation failed: ${validation.errors.join(', ')}`, { errors: validation.errors });
    }
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const playersSheet = ss.getSheetByName(BLOCK_CONFIG.MASTER_SHEET.PLAYERS_SHEET);
    if (!playersSheet) return createErrorResponse("Players database not found.");

    const lcEmail = playerData.googleEmail.toLowerCase();
    const existingPlayerObj = getPlayerDataByEmail(lcEmail, true); // Uses cache

    if (existingPlayerObj) {
      if (existingPlayerObj.isActive) {
        Logger.log(`${CONTEXT}: Player ${lcEmail} already exists and is active`);
        return createErrorResponse(`Player with email ${lcEmail} already exists and is active.`);
      } else {
        // ... existing reactivation logic ...
        // For simplicity, we assume reactivation doesn't need to update discord name, but it could be added here.
        return createErrorResponse(`Player ${lcEmail} exists but is inactive. Manual reactivation needed or enhance this function.`);
      }
    }

    // Create new player
    Logger.log(`${CONTEXT}: Creating new player for ${lcEmail}`);
    const playerId = generatePlayerId(playerData.displayName); 
    const newPlayerRow = [];
    const pCols = BLOCK_CONFIG.MASTER_SHEET.PLAYERS_COLUMNS;
    newPlayerRow[pCols.PLAYER_ID] = playerId;
    newPlayerRow[pCols.GOOGLE_EMAIL] = lcEmail;
    newPlayerRow[pCols.DISPLAY_NAME] = playerData.displayName.trim();
    newPlayerRow[pCols.CREATED_DATE] = getCurrentTimestamp();
    newPlayerRow[pCols.LAST_SEEN] = getCurrentTimestamp();
    newPlayerRow[pCols.IS_ACTIVE] = true;
    for (let i = 1; i <= BLOCK_CONFIG.TEAM_SETTINGS.MAX_TEAMS_PER_PLAYER; i++) {
      newPlayerRow[pCols[`TEAM${i}_ID`]] = ""; newPlayerRow[pCols[`TEAM${i}_NAME`]] = ""; newPlayerRow[pCols[`TEAM${i}_DIVISION`]] = "";
      newPlayerRow[pCols[`TEAM${i}_INITIALS`]] = ""; newPlayerRow[pCols[`TEAM${i}_ROLE`]] = ""; newPlayerRow[pCols[`TEAM${i}_JOIN_DATE`]] = "";
    }
    // === START MODIFICATION ===
    newPlayerRow[pCols.DISCORD_USERNAME] = playerData.discordUsername || ""; // Add the discord username
    newPlayerRow[pCols.AVAILABILITY_TEMPLATE] = ""; // Ensure last column is defined
    // === END MODIFICATION ===

    const appendResult = withProtectionBypass(() => {
        playersSheet.appendRow(newPlayerRow);
        SpreadsheetApp.flush();
        return true;
    }, "Append New Player", BLOCK_CONFIG.MASTER_SHEET.PLAYERS_SHEET);

    if (!appendResult) {
        return createErrorResponse("Failed to append player data.");
    }
    
    Utilities.sleep(300);
    
    const createdPlayer = _pdm_forceRefreshPlayerData(lcEmail, true, `${CONTEXT}-Create`);
    
    if (createdPlayer) {
        Logger.log(`${CONTEXT}: Player "${playerData.displayName}" created and verified successfully`);
        return createSuccessResponse({ player: createdPlayer }, `Player "${playerData.displayName}" created.`);
    } else {
        Logger.log(`${CONTEXT}: ERROR - Player created but failed to retrieve from sheet`);
        return createErrorResponse("Player created but failed to retrieve from database. Please try again.");
    }
  } catch (e) { return handleError(e, CONTEXT); }
}

function getPlayerDataByEmail(email, includeInactive = false) {
  const CONTEXT = "PlayerDataManager.getPlayerDataByEmail";
  if (!email || !isValidEmail(email)) return null;
  const lcEmail = email.toLowerCase();
  const cache = CacheService.getScriptCache();
  const cacheKey = `playerData_email_${lcEmail}_incInactive_${includeInactive}`;
  
  try {
    // Check cache first
    const cached = cache.get(cacheKey);
    if (cached !== null) { 
        const cachedData = JSON.parse(cached);
        Logger.log(`[CACHE] Hit for player ${lcEmail} (includeInactive: ${includeInactive})`);
        return cachedData;
    }
    
    Logger.log(`[CACHE] Miss for player ${lcEmail} - reading from sheet`);
    
    const playersSheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(BLOCK_CONFIG.MASTER_SHEET.PLAYERS_SHEET);
    if (!playersSheet) { 
        Logger.log(`${CONTEXT}: Players sheet not found`);
        return null; 
    }
    
    const data = playersSheet.getDataRange().getValues();
    const pCols = BLOCK_CONFIG.MASTER_SHEET.PLAYERS_COLUMNS;
    
    for (let i = 1; i < data.length; i++) {
      const row = data[i];
      if (row[pCols.GOOGLE_EMAIL].toLowerCase() === lcEmail) {
        if (!includeInactive && !row[pCols.IS_ACTIVE]) {
            Logger.log(`[CACHE] Found inactive player ${lcEmail} but includeInactive=false`);
            cache.put(cacheKey, JSON.stringify(null), Math.floor(PLAYER_DATA_CACHE_EXPIRATION_SECONDS / 5));
            return null;
        }
        
        const playerObject = mapPlayerRowToObject(row, pCols);
        Logger.log(`[CACHE] Found player ${lcEmail}, caching result`);
        cache.put(cacheKey, JSON.stringify(playerObject), PLAYER_DATA_CACHE_EXPIRATION_SECONDS);
        return playerObject;
      }
    }
    
    Logger.log(`[CACHE] Player ${lcEmail} not found in sheet`);
    cache.put(cacheKey, JSON.stringify(null), Math.floor(PLAYER_DATA_CACHE_EXPIRATION_SECONDS / 5));
    return null;
  } catch (e) { 
    Logger.log(`Error in ${CONTEXT} for ${email}: ${e.message}`); 
    return null; 
  }
}

function getPlayerDataById(playerId, includeInactive = false) {
  const CONTEXT = "PlayerDataManager.getPlayerDataById";
  if (!playerId || typeof playerId !== 'string' || playerId.trim() === "") return null;
  const cache = CacheService.getScriptCache();
  const cacheKey = `playerData_id_${playerId}_incInactive_${includeInactive}`;
  try {
    const cached = cache.get(cacheKey);
    if (cached !== null) { return JSON.parse(cached); }
    const playersSheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(BLOCK_CONFIG.MASTER_SHEET.PLAYERS_SHEET);
    if (!playersSheet) { return null; }
    const data = playersSheet.getDataRange().getValues();
    const pCols = BLOCK_CONFIG.MASTER_SHEET.PLAYERS_COLUMNS;
    for (let i = 1; i < data.length; i++) {
      const row = data[i];
      if (row[pCols.PLAYER_ID] === playerId) {
        if (!includeInactive && !row[pCols.IS_ACTIVE]) return null;
        const playerObject = mapPlayerRowToObject(row, pCols);
        cache.put(cacheKey, JSON.stringify(playerObject), PLAYER_DATA_CACHE_EXPIRATION_SECONDS);
        return playerObject;
      }
    }
    cache.put(cacheKey, JSON.stringify(null), Math.floor(PLAYER_DATA_CACHE_EXPIRATION_SECONDS / 5));
    return null;
  } catch (e) { Logger.log(`Error in ${CONTEXT} for ${playerId}: ${e.message}`); return null; }
}

function updatePlayer(googleEmail, updates, requestingUserEmail) {
  const CONTEXT = "PlayerDataManager.updatePlayer";
  try {
    // PHASE 1: Fast path for discord-only updates
    if (updates.discordUsername && !updates.displayName && Object.keys(updates).length === 1) {
      return updateDiscordUsernameOnly(googleEmail, updates.discordUsername, requestingUserEmail);
    }
    
    // Original logic for all other updates
    const playerToUpdateInitialState = getPlayerDataByEmail(googleEmail, true);
    if (!playerToUpdateInitialState) return createErrorResponse(`Player not found: ${googleEmail}`);

    const isAdmin = userHasPermission(requestingUserEmail, PERMISSIONS.MANAGE_ALL_PLAYERS);
    const isSelf = googleEmail.toLowerCase() === requestingUserEmail.toLowerCase();
    
    if (!isSelf && !isAdmin) {
        return createErrorResponse("Permission denied to update this player's profile.");
    }

    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const playersSheet = ss.getSheetByName(BLOCK_CONFIG.MASTER_SHEET.PLAYERS_SHEET);
    if (!playersSheet) return createErrorResponse("Players sheet not found.");
    
    const pCols = BLOCK_CONFIG.MASTER_SHEET.PLAYERS_COLUMNS;
    const playerRowData = findRow(playersSheet, pCols.GOOGLE_EMAIL, googleEmail.toLowerCase());
    if (playerRowData.rowIndex === -1) return createErrorResponse(`Player ${googleEmail} row not found for update.`);
    
    const rowIndexToUpdate = playerRowData.rowIndex + 1;
    let nameWasChanged = false;
    let discordWasChanged = false;

    const updatePerformed = withProtectionBypass(() => {
      let updatedFieldsCount = 0;
      if (isSelf && updates.hasOwnProperty('displayName')) {
          playersSheet.getRange(rowIndexToUpdate, pCols.DISPLAY_NAME + 1).setValue(updates.displayName.trim());
          nameWasChanged = true;
          updatedFieldsCount++;
      }
      
      if (isSelf && updates.hasOwnProperty('discordUsername')) {
          playersSheet.getRange(rowIndexToUpdate, pCols.DISCORD_USERNAME + 1).setValue(updates.discordUsername.trim());
          discordWasChanged = true;
          updatedFieldsCount++;
      }
      
      if (updates.hasOwnProperty('isActive') && isAdmin) {
        playersSheet.getRange(rowIndexToUpdate, pCols.IS_ACTIVE + 1).setValue(updates.isActive);
        updatedFieldsCount++;
      }
      
      if (updatedFieldsCount > 0) {
        playersSheet.getRange(rowIndexToUpdate, pCols.LAST_SEEN + 1).setValue(getCurrentTimestamp());
        SpreadsheetApp.flush();
      }
      return updatedFieldsCount > 0;
    }, "Update Player Profile", BLOCK_CONFIG.MASTER_SHEET.PLAYERS_SHEET);

    if (updatePerformed && updatePerformed.success === false) return updatePerformed;
    if (updatePerformed === false) {
        return createSuccessResponse({ noChanges: true }, "No changes were applied to the profile.");
    }
    
    _pdm_invalidatePlayerCache(googleEmail, playerToUpdateInitialState.playerId, `${CONTEXT}-Update`);
    
    // If name changed, sync teams (PHASE 2: using batch sync)
            if (nameWasChanged) {
            Logger.log(`${CONTEXT}: Display name changed for ${googleEmail}. Propagating changes to teams...`);
            const teamsToSync = [];
            
            // Log name change for each team the player is on
            if (playerToUpdateInitialState.team1.teamId) {
                teamsToSync.push(playerToUpdateInitialState.team1.teamId);
                _pdm_logRosterChange(playerToUpdateInitialState.team1.teamId, "NAME_CHANGED", {
                    oldName: playerToUpdateInitialState.displayName,
                    newName: updates.displayName
                });
            }
            if (playerToUpdateInitialState.team2.teamId) {
                teamsToSync.push(playerToUpdateInitialState.team2.teamId);
                _pdm_logRosterChange(playerToUpdateInitialState.team2.teamId, "NAME_CHANGED", {
                    oldName: playerToUpdateInitialState.displayName,
                    newName: updates.displayName
                });
            }
            
            if (teamsToSync.length > 0) {
                // PHASE 2: Use batch sync instead of individual syncs
                const syncResult = syncMultipleTeamsPlayerData(teamsToSync);
                if (!syncResult.success) {
                    Logger.log(`${CONTEXT}: Warning - Team sync failed: ${syncResult.message}`);
                }
            }
    }
    
    // Always update index if name or discord changed
    if (nameWasChanged || discordWasChanged) {
        _pdm_updatePlayerInIndex(playerToUpdateInitialState.playerId, {
            displayName: updates.displayName,
            discordUsername: updates.discordUsername
        });
    }
    
    Utilities.sleep(200);
    const updatedPlayer = _pdm_forceRefreshPlayerData(googleEmail, true, `${CONTEXT}-Update`);
        
    if (updatedPlayer) {
        return createSuccessResponse({ player: updatedPlayer }, "Player profile updated successfully.");
    } else {
        return createErrorResponse("Profile updated, but failed to retrieve the latest data.");
    }

  } catch (e) { return handleError(e, CONTEXT); }
}

function deactivatePlayer(playerGoogleEmail, requestingUserEmail) {
  const CONTEXT = "PlayerDataManager.deactivatePlayer";
  let playerToDeactivate = null;
  try {
    playerToDeactivate = getPlayerDataByEmail(playerGoogleEmail, true);
    if (!playerToDeactivate) return createErrorResponse(`Player not found: ${playerGoogleEmail}`);
    if (!playerToDeactivate.isActive) return createSuccessResponse({ player: playerToDeactivate }, `Player ${playerGoogleEmail} is already inactive.`);
    
    // === Track teams before deactivation ===
    const teamsToRemoveFrom = [];
    if (playerToDeactivate.team1.teamId) teamsToRemoveFrom.push(playerToDeactivate.team1.teamId);
    if (playerToDeactivate.team2.teamId) teamsToRemoveFrom.push(playerToDeactivate.team2.teamId);
    
    const isAdmin = userHasPermission(requestingUserEmail, PERMISSIONS.MANAGE_ALL_PLAYERS);
    const isSelf = playerGoogleEmail.toLowerCase() === requestingUserEmail.toLowerCase();
    if (!isAdmin && !isSelf) return createErrorResponse("Permission denied to deactivate this player account.");
    const updateResult = updatePlayer(playerGoogleEmail, { isActive: false }, requestingUserEmail);
    if (!updateResult.success) return createErrorResponse(`Failed to mark player as inactive: ${updateResult.message}`);
    
    // === Remove from index after successful deactivation ===
    if (updateResult.success) {
        for (const teamId of teamsToRemoveFrom) {
            _pdm_removeFromPlayerIndex(teamId, playerToDeactivate.playerId);
        }
    }
    
    return createSuccessResponse({ player: updateResult.player }, `Player ${playerGoogleEmail} has been deactivated.`);
  } catch (e) {
    if (playerToDeactivate) _pdm_invalidatePlayerCache(playerGoogleEmail, playerToDeactivate.playerId, `${CONTEXT}-Error`);
    return handleError(e, CONTEXT);
  }
}

/**
 * REPLACEMENT for joinTeamByCode
 * This version is corrected to use the new, more robust 'validateJoinCode' 
 * function instead of the old, deleted 'getTeamDataByJoinCode'.
 */
function joinTeamByCode(userEmail, joinCode, playerInitialsInSlot) {
  const CONTEXT = "PlayerDataManager.joinTeamByCode (v_ValidateCode)";
  let player = null;
  try {
    Logger.log(`${CONTEXT}: ${userEmail} attempting to join team with code ${joinCode}`);
    
    if (!userHasPermission(userEmail, PERMISSIONS.JOIN_TEAM_WITH_CODE)) return createErrorResponse("Permission denied.");
    
    const initialPlayerObject = getPlayerDataByEmail(userEmail, true) || {};
    const displayNameForValidation = initialPlayerObject.displayName || userEmail.split('@')[0];
    if (!validatePlayerDisplayName(displayNameForValidation).isValid) return createErrorResponse(`Invalid player name on record: ${displayNameForValidation}`);
    if (!validatePlayerInitials(playerInitialsInSlot).isValid) return createErrorResponse(`Invalid initials: ${playerInitialsInSlot}`);
    
    // --- THIS IS THE CORRECTED LOGIC ---
    // Use the new, smarter validation function.
    const validationResult = validateJoinCode(joinCode);
    if (!validationResult.isValid) {
        // If validation fails (e.g., team full, code invalid), stop here.
        return createErrorResponse(validationResult.message);
    }
    // If validation succeeds, get the team data from the result.
    const teamData = validationResult.teamData;
    // --- END OF CORRECTION ---
    
    if (areInitialsInUseOnTeam(teamData.teamId, playerInitialsInSlot)) {
      return createErrorResponse(`The initials "${playerInitialsInSlot}" are already in use on team "${teamData.teamName}". Please choose different initials.`);
    }
    
    player = getPlayerDataByEmail(userEmail, true);
    if (!player) {
      const createResult = createPlayer({ googleEmail: userEmail, displayName: displayNameForValidation });
      if (!createResult.success) return createErrorResponse(`Failed to create player record: ${createResult.message}`);
      player = createResult.player;
    }
    
    if (!player.isActive) return createErrorResponse("Your player account is not active. Please contact an administrator.");
    if (player.team1.teamId === teamData.teamId || player.team2.teamId === teamData.teamId) {
      return createErrorResponse(`You are already on team "${teamData.teamName}".`);
    }

    let targetSlotKey = (!player.team1.teamId) ? "TEAM1" : (!player.team2.teamId) ? "TEAM2" : null;
    if (!targetSlotKey) return createErrorResponse("You must leave one of your current teams before joining another.");

    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const playersSheet = ss.getSheetByName(BLOCK_CONFIG.MASTER_SHEET.PLAYERS_SHEET);
    const pCols = BLOCK_CONFIG.MASTER_SHEET.PLAYERS_COLUMNS;
    const playerRowData = findRow(playersSheet, pCols.PLAYER_ID, player.playerId);
    if (playerRowData.rowIndex === -1) return createErrorResponse("Player record error during join.");
    
    const upperInitials = playerInitialsInSlot.toUpperCase();
    withProtectionBypass(() => {
      const rowIndexToUpdate = playerRowData.rowIndex + 1;
      playersSheet.getRange(rowIndexToUpdate, pCols[`${targetSlotKey}_ID`] + 1).setValue(teamData.teamId);
      playersSheet.getRange(rowIndexToUpdate, pCols[`${targetSlotKey}_INITIALS`] + 1).setValue(upperInitials);
      playersSheet.getRange(rowIndexToUpdate, pCols[`${targetSlotKey}_ROLE`] + 1).setValue(ROLES.PLAYER);
      playersSheet.getRange(rowIndexToUpdate, pCols[`${targetSlotKey}_JOIN_DATE`] + 1).setValue(getCurrentTimestamp());
      playersSheet.getRange(rowIndexToUpdate, pCols.LAST_SEEN + 1).setValue(getCurrentTimestamp());
    }, "Assign Player to Team Slot", BLOCK_CONFIG.MASTER_SHEET.PLAYERS_SHEET);

    syncTeamPlayerData(teamData.teamId);
    _pdm_addToPlayerIndex(teamData.teamId, player.playerId, player.displayName, upperInitials, ROLES.PLAYER, player.discordUsername || "");
    _pdm_logRosterChange(teamData.teamId, "JOINED", { 
        displayName: player.displayName, 
        initials: upperInitials, 
        email: userEmail 
    });

    _pdm_invalidatePlayerCache(userEmail, player.playerId, CONTEXT);
    return createSuccessResponse({ player: getPlayerDataByEmail(userEmail, true) }, `Successfully joined team "${teamData.teamName}".`);
    
  } catch (e) {
    if (player) _pdm_invalidatePlayerCache(userEmail, player.playerId, `${CONTEXT}-Error`);
    return handleError(e, CONTEXT);
  }
}

/**
 * REPLACEMENT for leaveTeam
 * This version re-introduces the missing 'isSelf' variable definition
 * to fix the 'isSelf is not defined' ReferenceError.
 */
function leaveTeam(userEmail, teamId, requestingUserEmail = null, isKick = false) {
  const CONTEXT = "PlayerDataManager.leaveTeam (v_Final_Sync)";
  let playerToLeave = null;
  try {
    // --- Permission Checks ---
    if (!isKick && !userHasPermission(userEmail, PERMISSIONS.LEAVE_TEAM)) {
      return createErrorResponse("Permission denied to leave team.");
    }
    playerToLeave = getPlayerDataByEmail(userEmail, true);
    if (!playerToLeave) return createErrorResponse(`Player not found: ${userEmail}`);
    
    // --- THIS SECTION IS NOW CORRECTED ---
    const isAdmin = userHasPermission(requestingUserEmail, PERMISSIONS.MANAGE_ALL_PLAYERS);
    // This line was missing:
    const isSelf = userEmail.toLowerCase() === (requestingUserEmail || "").toLowerCase(); 
    const isTeamLeader = isUserTeamLeader(requestingUserEmail, teamId);
    
    if (!isSelf && !isAdmin && !isTeamLeader) {
      return createErrorResponse("Permission denied to remove this player from team.");
    }
    // --- END OF CORRECTION ---
    
    let teamSlotKey = null;
    if (playerToLeave.team1.teamId === teamId) teamSlotKey = "TEAM1";
    else if (playerToLeave.team2.teamId === teamId) teamSlotKey = "TEAM2";
    if (!teamSlotKey) return createErrorResponse(`Player ${userEmail} is not on team ${teamId}.`);

    const teamData = getTeamData(teamId);
    if (!teamData) return createErrorResponse("Team not found.");
    
    if (playerToLeave[teamSlotKey.toLowerCase()].role === ROLES.TEAM_LEADER) {
        const allPlayersOnTeam = getAllPlayers(false, {teamId: teamId});
        if (allPlayersOnTeam.success && allPlayersOnTeam.players.length > 1) {
            return createErrorResponse("You cannot leave the team as you are the last leader with other members remaining. Please promote another player to leader first.");
        }
    }
    
    // --- Step 1: Update Source of Truth (Players Sheet) ---
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const playersSheet = ss.getSheetByName(BLOCK_CONFIG.MASTER_SHEET.PLAYERS_SHEET);
    const pCols = BLOCK_CONFIG.MASTER_SHEET.PLAYERS_COLUMNS;
    const playerRowData = findRow(playersSheet, pCols.PLAYER_ID, playerToLeave.playerId);
    if (playerRowData.rowIndex === -1) return createErrorResponse("Player record error during leave team.");

    withProtectionBypass(() => {
      const rowIndexToUpdate = playerRowData.rowIndex + 1;
      playersSheet.getRange(rowIndexToUpdate, pCols[`${teamSlotKey}_ID`] + 1, 1, 4).setValues([["", "", "", ""]]);
      playersSheet.getRange(rowIndexToUpdate, pCols.LAST_SEEN + 1).setValue(getCurrentTimestamp());
    }, "Player Leaves Team Slot", BLOCK_CONFIG.MASTER_SHEET.PLAYERS_SHEET);

    // --- Step 2: Cascade Updates to Caches & Copies ---
    syncTeamPlayerData(teamId);
    _pdm_removeFromPlayerIndex(teamId, playerToLeave.playerId);
    removePlayerInitialsFromSchedule(teamData.availabilitySheetName, playerToLeave[teamSlotKey.toLowerCase()].initials, true);
    _pdm_logRosterChange(teamId, "LEFT", { 
        displayName: playerToLeave.displayName, 
        initials: playerToLeave[teamSlotKey.toLowerCase()].initials, 
        email: userEmail 
    });
    
    // --- Step 3: Handle "Abandon Ship" Scenario ---
    const updatedTeamData = getTeamData(teamId, true);
    if (updatedTeamData && updatedTeamData.playerCount === 0) {
      Logger.log(`Last player (${userEmail}) left team ${teamId}. Archiving the now-empty team.`);
      archiveTeam(teamId, requestingUserEmail); 
    }
    
    _pdm_invalidatePlayerCache(userEmail, playerToLeave.playerId, CONTEXT);
    return createSuccessResponse({ player: getPlayerDataByEmail(userEmail, true) }, `Successfully left team "${teamData.teamName}".`);

  } catch (e) {
    if (playerToLeave) _pdm_invalidatePlayerCache(userEmail, playerToLeave.playerId, `${CONTEXT}-Error`);
    return handleError(e, CONTEXT);
  }
}

function disassociatePlayersFromTeam(teamId, reason = "Team Inactive") {
  const CONTEXT = "PlayerDataManager.disassociatePlayersFromTeam";
  try {
    if (!teamId) return createErrorResponse("Team ID required.");
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const playersSheet = ss.getSheetByName(BLOCK_CONFIG.MASTER_SHEET.PLAYERS_SHEET);
    if (!playersSheet) return createErrorResponse("Players sheet not found.");
    let playersSheetData = playersSheet.getDataRange().getValues(); 
    const pCols = BLOCK_CONFIG.MASTER_SHEET.PLAYERS_COLUMNS;
    let playersAffectedCount = 0;
    const affectedPlayerCacheInvalidationList = [];
    let modificationsMade = false;
    const currentTime = getCurrentTimestamp();
    for (let i = 1; i < playersSheetData.length; i++) {
      const playerRowArray = playersSheetData[i]; 
      let playerModifiedThisIteration = false;
      const originalEmail = playerRowArray[pCols.GOOGLE_EMAIL];
      const originalPlayerId = playerRowArray[pCols.PLAYER_ID];
      if (playerRowArray[pCols.TEAM1_ID] === teamId) {
        playerRowArray[pCols.TEAM1_ID] = ""; playerRowArray[pCols.TEAM1_NAME] = ""; playerRowArray[pCols.TEAM1_DIVISION] = "";
        playerRowArray[pCols.TEAM1_INITIALS] = ""; playerRowArray[pCols.TEAM1_ROLE] = ""; playerRowArray[pCols.TEAM1_JOIN_DATE] = "";
        playerModifiedThisIteration = true;
      }
      if (playerRowArray[pCols.TEAM2_ID] === teamId) {
        playerRowArray[pCols.TEAM2_ID] = ""; playerRowArray[pCols.TEAM2_NAME] = ""; playerRowArray[pCols.TEAM2_DIVISION] = "";
        playerRowArray[pCols.TEAM2_INITIALS] = ""; playerRowArray[pCols.TEAM2_ROLE] = ""; playerRowArray[pCols.TEAM2_JOIN_DATE] = "";
        playerModifiedThisIteration = true;
      }
      if (playerModifiedThisIteration) {
        playerRowArray[pCols.LAST_SEEN] = currentTime;
        modificationsMade = true;
        playersAffectedCount++;
        affectedPlayerCacheInvalidationList.push({ email: originalEmail, playerId: originalPlayerId });
      }
    }
    if (modificationsMade) {
      const disassociationResult = withProtectionBypass(() => {
        const dataToWrite = playersSheetData.slice(1); 
        if (dataToWrite.length > 0) {
            playersSheet.getRange(2, 1, dataToWrite.length, playersSheetData[0].length).setValues(dataToWrite);
        } else { 
            if (playersSheet.getLastRow() > 1) {
                 playersSheet.getRange(2, 1, playersSheet.getLastRow() -1 , playersSheetData[0].length).clearContent();
            }
        }
        SpreadsheetApp.flush(); // FIXED: Ensure write completes
        return true;
      }, "Disassociate Players Batch Update", BLOCK_CONFIG.MASTER_SHEET.PLAYERS_SHEET);
      if (!disassociationResult) {
        return createErrorResponse("Failed to update player records during disassociation batch operation.");
      }
      
      // FIXED: Cache invalidation after successful batch update
      affectedPlayerCacheInvalidationList.forEach(item => _pdm_invalidatePlayerCache(item.email, item.playerId, `${CONTEXT}-BatchDisassociate`));
      
      syncTeamPlayerData(teamId); 
    }
    return createSuccessResponse({ playersAffected: playersAffectedCount }, `${playersAffectedCount} players disassociated.`);
  } catch (e) { return handleError(e, CONTEXT); }
}

function syncTeamPlayerData(teamId) {
  const CONTEXT = "PlayerDataManager.syncTeamPlayerData";
  try {
    if (!teamId) return createErrorResponse("Team ID required.");
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const playersSheet = ss.getSheetByName(BLOCK_CONFIG.MASTER_SHEET.PLAYERS_SHEET);
    const teamsSheet = ss.getSheetByName(BLOCK_CONFIG.MASTER_SHEET.TEAMS_SHEET);
    if (!playersSheet || !teamsSheet) return createErrorResponse("Players or Teams sheet not found for sync.");

    const playersData = playersSheet.getDataRange().getValues();
    const pCols = BLOCK_CONFIG.MASTER_SHEET.PLAYERS_COLUMNS;
    const teamPlayerDisplayNames = []; 
    const teamPlayerInitials = [];

    for (let i = 1; i < playersData.length; i++) {
      const row = playersData[i];
      if (row[pCols.IS_ACTIVE]) {
        // Simplified Logic: Always use the global DisplayName.
        if (row[pCols.TEAM1_ID] === teamId && row[pCols.TEAM1_INITIALS]) {
          teamPlayerDisplayNames.push(row[pCols.DISPLAY_NAME]); // Use global name
          teamPlayerInitials.push(row[pCols.TEAM1_INITIALS]);
        } else if (row[pCols.TEAM2_ID] === teamId && row[pCols.TEAM2_INITIALS]) {
          teamPlayerDisplayNames.push(row[pCols.DISPLAY_NAME]); // Use global name
          teamPlayerInitials.push(row[pCols.TEAM2_INITIALS]);
        }
      }
    }
    const teamsData = teamsSheet.getDataRange().getValues();
    const tCols = BLOCK_CONFIG.MASTER_SHEET.TEAMS_COLUMNS;
    const teamRowIndex = teamsData.slice(1).findIndex(row => row[tCols.TEAM_ID] === teamId);
    if (teamRowIndex === -1) return createErrorResponse(`Team ${teamId} not found in Teams sheet for sync.`);
    const teamSheetRowIndex = teamRowIndex + 2;

    const syncUpdateResult = withProtectionBypass(() => {
      teamsSheet.getRange(teamSheetRowIndex, tCols.PLAYER_COUNT + 1).setValue(teamPlayerDisplayNames.length);
      teamsSheet.getRange(teamSheetRowIndex, tCols.PLAYER_LIST + 1).setValue(teamPlayerDisplayNames.join(','));
      teamsSheet.getRange(teamSheetRowIndex, tCols.INITIALS_LIST + 1).setValue(teamPlayerInitials.join(','));
      teamsSheet.getRange(teamSheetRowIndex, tCols.LAST_ACTIVE + 1).setValue(getCurrentTimestamp());
      SpreadsheetApp.flush();
      return true;
    }, "Sync Team Player Data", BLOCK_CONFIG.MASTER_SHEET.TEAMS_SHEET);

    if (!syncUpdateResult) return createErrorResponse("Failed to sync team player data.");
    
    _pdm_invalidateTeamDataCache(teamId, `${CONTEXT}-Sync`);
    // This function call triggers the update to the SYSTEM_CACHE sheet as well.
    _cache_updateTeamData(teamId);
    
    return createSuccessResponse({ teamId: teamId, playerCount: teamPlayerDisplayNames.length, playerList: teamPlayerDisplayNames, initialsList: teamPlayerInitials }, `Data synced for team ${teamId}.`);
  } catch (e) { return handleError(e, CONTEXT); }
}



// =============================================================================
// AVAILABILITY TEMPLATE FUNCTIONS (EXISTING)
// =============================================================================

function saveAvailabilityTemplate(userEmail, templateData) {
  const CONTEXT = "PlayerDataManager.saveAvailabilityTemplate";
  try {
    const player = getPlayerDataByEmail(userEmail, true);
    if (!player) return createErrorResponse("Player not found.");
    
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const playersSheet = ss.getSheetByName(BLOCK_CONFIG.MASTER_SHEET.PLAYERS_SHEET);
    const pCols = BLOCK_CONFIG.MASTER_SHEET.PLAYERS_COLUMNS;
    
    const playerRowData = findRow(playersSheet, pCols.PLAYER_ID, player.playerId);
    if (playerRowData.rowIndex === -1) return createErrorResponse("Player record error.");
    
    const templateJson = JSON.stringify({
      cells: templateData.cells,
      savedFrom: templateData.savedFrom,
      lastUpdated: getCurrentTimestamp()
    });
    
    const updateResult = withProtectionBypass(() => {
      const rowIndex = playerRowData.rowIndex + 1;
      playersSheet.getRange(rowIndex, pCols.AVAILABILITY_TEMPLATE + 1).setValue(templateJson);
      playersSheet.getRange(rowIndex, pCols.LAST_SEEN + 1).setValue(getCurrentTimestamp());
      SpreadsheetApp.flush(); // FIXED: Ensure write completes
      return true;
    }, "Save Availability Template", BLOCK_CONFIG.MASTER_SHEET.PLAYERS_SHEET);
    
    if (!updateResult) return createErrorResponse("Failed to save template.");
    
    // FIXED: Cache invalidation after template save
    _pdm_invalidatePlayerCache(userEmail, player.playerId, `${CONTEXT}-SaveTemplate`);
    
    return createSuccessResponse({ template: templateData }, "Availability template saved!");
  } catch (e) {
    return handleError(e, CONTEXT);
  }
}

function loadAvailabilityTemplate(userEmail) {
  const CONTEXT = "PlayerDataManager.loadAvailabilityTemplate";
  try {
    const player = getPlayerDataByEmail(userEmail, true);
    if (!player) return createErrorResponse("Player not found.");
    
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const playersSheet = ss.getSheetByName(BLOCK_CONFIG.MASTER_SHEET.PLAYERS_SHEET);
    const pCols = BLOCK_CONFIG.MASTER_SHEET.PLAYERS_COLUMNS;
    
    const playerRowData = findRow(playersSheet, pCols.PLAYER_ID, player.playerId);
    if (playerRowData.rowIndex === -1) return createErrorResponse("Player record error.");
    
    const templateJson = playerRowData.rowData[pCols.AVAILABILITY_TEMPLATE];
    if (!templateJson || templateJson.trim() === "") {
      return createErrorResponse("No template saved.", { noTemplate: true });
    }
    
    try {
      const template = JSON.parse(templateJson);
      return createSuccessResponse({ template: template }, "Template loaded!");
    } catch (parseError) {
      return createErrorResponse("Template data corrupted. Please save a new template.");
    }
  } catch (e) {
    return handleError(e, CONTEXT);
  }
}

// =============================================================================
// USER CONTEXT & DATA RETRIEVAL FUNCTIONS (EXISTING)
// =============================================================================

/**
 * REPLACEMENT FUNCTION
 * This version correctly builds the roster for each team, ensuring the 'email' 
 * property is included for each player so the frontend buttons can function correctly.
 */
function getUserTeams(userEmail) {
  const CONTEXT = "PlayerDataManager.getUserTeams (v1.3 - Roster Email Fix)";
  if (!userEmail || !isValidEmail(userEmail)) {
    Logger.log(`${CONTEXT}: Invalid or missing userEmail.`);
    return [];
  }

  const player = getPlayerDataByEmail(userEmail, true); 
  const userAffiliations = [];

  if (player && player.isActive) {
    const processTeamSlot = (teamSlotData) => {
      if (teamSlotData && teamSlotData.teamId) {
        const actualTeamData = getTeamData(teamSlotData.teamId); 

        if (actualTeamData && actualTeamData.isActive) {
          
          // --- THIS IS THE CORRECTED LOGIC ---
          // Use the fast index to get a complete roster that includes emails.
          const rosterFromIndex = getTeamRosterFromIndex(actualTeamData.teamId);
          const completeRoster = rosterFromIndex.map(p => ({
              displayName: p.displayName,
              initials: p.initials,
              role: p.role,
              // We need to find the player's email from the main player record
              // since the index doesn't store it for privacy.
              // This is a small trade-off, but necessary.
              // Note: For now, we'll pass the email from the main player object.
              // A more advanced version might look up each player, but this is sufficient.
              email: getPlayerDataById(p.playerId)?.googleEmail || null 
          }));
          // --- END OF CORRECTION ---

          userAffiliations.push({
            teamId: actualTeamData.teamId,
            teamName: actualTeamData.teamName,
            division: actualTeamData.division,
            role: teamSlotData.role, 
            initials: teamSlotData.initials, 
            logoUrl: actualTeamData.logoUrl,
            joinDate: teamSlotData.joinDate,
            // Pass the complete roster with emails to the frontend
            roster: completeRoster 
          });
        }
      }
    };

    processTeamSlot(player.team1);
    processTeamSlot(player.team2);
  }

  userAffiliations.sort((a, b) => (a.teamName || "").localeCompare(b.teamName || ""));
  return userAffiliations;
}

function getUserDisplayName(userEmail) {
  if (!userEmail || !isValidEmail(userEmail)) return userEmail || "Guest";
  const player = getPlayerDataByEmail(userEmail, true); 
  if (player && player.displayName && player.displayName.trim() !== "") {
    return player.displayName.trim();
  }
  return userEmail; 
}

function isPlayerOnTeam(userEmail, teamId) {
    if (!userEmail || !teamId) return false;
    const player = getPlayerDataByEmail(userEmail); 
    if (!player || !player.isActive) return false;
    const teamData = getTeamData(teamId);
    if(!teamData || !teamData.isActive) return false;
    return (player.team1.teamId === teamId) || (player.team2.teamId === teamId);
}

// =============================================================================
// PLAYER UTILITY & VALIDATION FUNCTIONS (EXISTING - Local Helpers)
// =============================================================================

function playerExists(googleEmail) {
  return !!getPlayerDataByEmail(googleEmail, true);
}

function generatePlayerId(displayName) {
  const prefix = displayName.substring(0, 5).toUpperCase().replace(/[^A-Z0-9]/g, '');
  return `PLAYER_${prefix || "USER"}_${Utilities.getUuid().substring(0, 8)}`;
}

function validatePlayerCreationData(playerData) {
  const errors = [];
  if (!playerData || typeof playerData !== 'object') { errors.push("Player data object is missing."); return { isValid: false, errors: errors };}
  if (!playerData.googleEmail || !isValidEmail(playerData.googleEmail)) errors.push("Valid Google Email is required.");
  if (!playerData.hasOwnProperty('displayName')) errors.push("Player display name property is missing.");
  else { 
    const nameValidation = validatePlayerDisplayName(playerData.displayName); 
    if(!nameValidation.isValid) errors.push(...nameValidation.errors); 
  }
  return { isValid: errors.length === 0, errors: errors };
}

function validatePlayerDisplayName(displayName) {
    const errors = []; 
    const minLength = 3; 
    const maxLength = BLOCK_CONFIG.TEAM_SETTINGS.MAX_PLAYER_DISPLAY_NAME_LENGTH;
    if (displayName === null || typeof displayName === 'undefined') errors.push("Display name is missing.");
    else if (typeof displayName !== 'string' || displayName.trim().length === 0) errors.push("Display name required.");
    else { 
        const trimmedName = displayName.trim(); 
        if (trimmedName.length < minLength) errors.push(`Display name at least ${minLength} characters.`);
        if (displayName.length > maxLength) errors.push(`Display name no more than ${maxLength} characters.`);
        if (/[^a-zA-Z0-9\s\-_'.()]/.test(trimmedName)) errors.push("Display name has invalid characters.");
    } 
    return { isValid: errors.length === 0, errors: errors };
}

function validatePlayerInitials(initials) {
    const errors = [];
    const exactLength = BLOCK_CONFIG.TEAM_SETTINGS.MAX_PLAYER_INITIALS_LENGTH; 
    if (!initials || typeof initials !== 'string' || initials.trim().length === 0) errors.push("Player initials required.");
    else {
        const trimmedInitials = initials.trim().toUpperCase();
        if (trimmedInitials.length !== exactLength) errors.push(`Initials must be ${exactLength} characters.`);
        if (!/^[A-Z0-9]+$/.test(trimmedInitials)) errors.push("Initials must be uppercase letters or numbers.");
    }
    return { isValid: errors.length === 0, errors: errors.map(err => `Initials: ${err}`) };
}

function validatePlayerUpdateData(updates, existingPlayerData) {
  const errors = [];
  if (updates.hasOwnProperty('displayName')) {
    const nameValidation = validatePlayerDisplayName(updates.displayName);
    if (!nameValidation.isValid) errors.push(...nameValidation.errors);
  }
  if (updates.hasOwnProperty('isActive') && typeof updates.isActive !== 'boolean') errors.push("IsActive must be true/false.");
  if (updates.hasOwnProperty('teamId') && updates.teamId && typeof updates.teamId !== 'string') errors.push("Target Team ID must be string.");
  if (updates.hasOwnProperty('initials')) {
      const initialsValidation = validatePlayerInitials(updates.initials);
      if(!initialsValidation.isValid) errors.push(...initialsValidation.errors);
  }
   if (updates.hasOwnProperty('playerNameInSlot')) {
      const nameInSlotValidation = validatePlayerDisplayName(updates.playerNameInSlot);
      if(!nameInSlotValidation.isValid) errors.push(...nameInSlotValidation.errors);
  }
  return { isValid: errors.length === 0, errors: errors };
}

function mapPlayerRowToObject(row, pCols) {
    if (!row || row.length === 0 || !pCols || Object.keys(pCols).length === 0) return {}; 
    const maxIndex = Math.max(...Object.values(pCols));
    if (row.length <= maxIndex) {
        // Return a default error object if the row is malformed or doesn't have enough columns
        return {
            playerId: "ERROR_MAPPING", googleEmail: "error@mapping.com", displayName: "Error Mapping Row",
            createdDate: "", lastSeen: "", isActive: false, discordUsername: null,
            team1: { teamId: null, initials: null, role: null, joinDate: null },
            team2: { teamId: null, initials: null, role: null, joinDate: null }
          };
    }
    // Maps the new, simplified schema
    return {
        playerId: row[pCols.PLAYER_ID],
        googleEmail: row[pCols.GOOGLE_EMAIL],
        displayName: row[pCols.DISPLAY_NAME],
        createdDate: row[pCols.CREATED_DATE],
        lastSeen: row[pCols.LAST_SEEN],
        isActive: row[pCols.IS_ACTIVE] === true,
        discordUsername: row[pCols.DISCORD_USERNAME] || null,
        team1: {
            teamId: row[pCols.TEAM1_ID] || null,
            initials: row[pCols.TEAM1_INITIALS] || null,
            role: row[pCols.TEAM1_ROLE] || null,
            joinDate: row[pCols.TEAM1_JOIN_DATE] || null
        },
        team2: {
            teamId: row[pCols.TEAM2_ID] || null,
            initials: row[pCols.TEAM2_INITIALS] || null,
            role: row[pCols.TEAM2_ROLE] || null,
            joinDate: row[pCols.TEAM2_JOIN_DATE] || null
        }
      };
}

function findRow(sheet, searchColIndex, searchValue) {
    const data = sheet.getDataRange().getValues();
    const searchValLower = typeof searchValue === 'string' ? searchValue.toLowerCase() : searchValue;
    for (let i = 1; i < data.length; i++) { 
        const cellValue = data[i][searchColIndex];
        const cellValComparable = typeof cellValue === 'string' ? cellValue.toLowerCase() : cellValue;
        if (cellValComparable === searchValLower) return { rowIndex: i, rowData: data[i] }; 
    }
    return { rowIndex: -1, rowData: null };
}

function getAllPlayers(includeInactive = false, options = {}) {
  const CONTEXT = "PlayerDataManager.getAllPlayers";
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const playersSheet = ss.getSheetByName(BLOCK_CONFIG.MASTER_SHEET.PLAYERS_SHEET);
    if (!playersSheet) return createErrorResponse("Players database not found.");
    const data = playersSheet.getDataRange().getValues();
    const pCols = BLOCK_CONFIG.MASTER_SHEET.PLAYERS_COLUMNS;
    const players = [];
    for (let i = 1; i < data.length; i++) { 
      const row = data[i];
      if (!includeInactive && !row[pCols.IS_ACTIVE]) continue;
      let matchesOptions = true;
      if (options.teamId) {
        if (row[pCols.TEAM1_ID] !== options.teamId && row[pCols.TEAM2_ID] !== options.teamId) matchesOptions = false;
      }
      if (matchesOptions) players.push(mapPlayerRowToObject(row, pCols));
    }
    players.sort((a, b) => (a.displayName || "").localeCompare(b.displayName || ""));
    return createSuccessResponse({ players: players, totalCount: players.length, filtersApplied: options }, `Retrieved ${players.length} players.`);
  } catch (e) { return handleError(e, CONTEXT); }
}

// ===== NEW FUNCTIONS TO ADD TO PlayerDataManager.js =====

/**
 * Rebuilds the entire PLAYER_INDEX from the Players sheet
 * This is a maintenance function that should be called:
 * - After major data migrations
 * - As a recovery mechanism if index gets corrupted
 * - Initially when setting up the index
 * 
 * @return {Object} Result with statistics about the rebuild
 */
function rebuildPlayerIndex() {
  const CONTEXT = "PlayerDataManager.rebuildPlayerIndex";
  try {
    Logger.log(`${CONTEXT}: Starting complete player index rebuild...`);
    
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const playersSheet = ss.getSheetByName(BLOCK_CONFIG.MASTER_SHEET.PLAYERS_SHEET);
    const indexSheet = ss.getSheetByName('PLAYER_INDEX');
    
    if (!playersSheet) {
      return createErrorResponse("Players sheet not found");
    }
    
    if (!indexSheet) {
      return createErrorResponse("PLAYER_INDEX sheet not found. Run master sheet setup first.");
    }
    
    // Clear existing index data (preserve headers)
    if (indexSheet.getLastRow() > 1) {
      indexSheet.getRange(2, 1, indexSheet.getLastRow() - 1, indexSheet.getLastColumn()).clear();
    }
    
    // Get all player data
    const playerData = playersSheet.getDataRange().getValues();
    const pCols = BLOCK_CONFIG.MASTER_SHEET.PLAYERS_COLUMNS;
    
    // Build index entries
    const indexEntries = [];
    let activePlayersProcessed = 0;
    let indexEntriesCreated = 0;
    
    // Skip header row
    for (let i = 1; i < playerData.length; i++) {
      const row = playerData[i];
      
      // Skip inactive players
      if (!row[pCols.IS_ACTIVE]) continue;
      
      activePlayersProcessed++;
      
      // Process Team 1
      if (row[pCols.TEAM1_ID]) {
        // Verify team is active
        const team1Data = getTeamData(row[pCols.TEAM1_ID], false); // Don't include inactive teams
        if (team1Data) {
          indexEntries.push([
            row[pCols.TEAM1_ID],                    // TeamID
            row[pCols.PLAYER_ID],                   // PlayerID
            row[pCols.DISPLAY_NAME],                // PlayerDisplayName
            row[pCols.TEAM1_INITIALS],              // PlayerInitials
            row[pCols.TEAM1_ROLE],                  // PlayerRole
            row[pCols.DISCORD_USERNAME] || ""       // PlayerDiscordUsername
          ]);
          indexEntriesCreated++;
        }
      }
      
      // Process Team 2
      if (row[pCols.TEAM2_ID]) {
        // Verify team is active
        const team2Data = getTeamData(row[pCols.TEAM2_ID], false); // Don't include inactive teams
        if (team2Data) {
          indexEntries.push([
            row[pCols.TEAM2_ID],                    // TeamID
            row[pCols.PLAYER_ID],                   // PlayerID
            row[pCols.DISPLAY_NAME],                // PlayerDisplayName
            row[pCols.TEAM2_INITIALS],              // PlayerInitials
            row[pCols.TEAM2_ROLE],                  // PlayerRole
            row[pCols.DISCORD_USERNAME] || ""       // PlayerDiscordUsername
          ]);
          indexEntriesCreated++;
        }
      }
    }
    
    // Write all entries to index in one batch operation
    if (indexEntries.length > 0) {
      const writeResult = withProtectionBypass(() => {
        indexSheet.getRange(2, 1, indexEntries.length, 6).setValues(indexEntries);
        // Update rebuild timestamp
        indexSheet.getRange('G1').setValue(new Date().toISOString());
        SpreadsheetApp.flush();
        return true;
      }, "Rebuild Player Index", 'PLAYER_INDEX');
      
      if (!writeResult) {
        return createErrorResponse("Failed to write index data");
      }
    }
    
    Logger.log(`✅ ${CONTEXT}: Index rebuild complete. Players: ${activePlayersProcessed}, Entries: ${indexEntriesCreated}`);
    
    return createSuccessResponse({
      playersProcessed: activePlayersProcessed,
      indexEntriesCreated: indexEntriesCreated,
      teamsRepresented: new Set(indexEntries.map(entry => entry[0])).size,
      timestamp: new Date().toISOString()
    }, `Player index rebuilt successfully: ${indexEntriesCreated} entries created`);
    
  } catch (e) {
    return handleError(e, CONTEXT);
  }
}

/**
 * Updates the PLAYER_INDEX when a player joins a team
 * @param {string} teamId The team being joined
 * @param {string} playerId The player's ID
 * @param {string} displayName The player's display name
 * @param {string} initials The player's initials for this team
 * @param {string} role The player's role in the team
 * @param {string} discordUsername The player's discord username (optional)
 */
function _pdm_addToPlayerIndex(teamId, playerId, displayName, initials, role, discordUsername = "") {
  const CONTEXT = "PlayerDataManager._pdm_addToPlayerIndex";
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const indexSheet = ss.getSheetByName('PLAYER_INDEX');
    
    if (!indexSheet) {
      Logger.log(`${CONTEXT}: Warning - PLAYER_INDEX sheet not found. Skipping index update.`);
      return;
    }
    
    const newEntry = [teamId, playerId, displayName, initials, role, discordUsername];
    
    withProtectionBypass(() => {
      indexSheet.appendRow(newEntry);
      SpreadsheetApp.flush();
    }, "Add to Player Index", 'PLAYER_INDEX');
    
    Logger.log(`${CONTEXT}: Added player ${displayName} (${initials}) to index for team ${teamId}`);
    
  } catch (e) {
    Logger.log(`${CONTEXT}: Error adding to index: ${e.message}`);
    // Don't throw - index update failure shouldn't break the main operation
  }
}

/**
 * Removes a player from the PLAYER_INDEX when they leave a team
 * @param {string} teamId The team being left
 * @param {string} playerId The player's ID
 */
function _pdm_removeFromPlayerIndex(teamId, playerId) {
  const CONTEXT = "PlayerDataManager._pdm_removeFromPlayerIndex";
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const indexSheet = ss.getSheetByName('PLAYER_INDEX');
    
    if (!indexSheet) {
      Logger.log(`${CONTEXT}: Warning - PLAYER_INDEX sheet not found. Skipping index update.`);
      return;
    }
    
    // Find and remove the matching row
    const data = indexSheet.getDataRange().getValues();
    let rowToDelete = -1;
    
    // Start from row 1 to skip header
    for (let i = 1; i < data.length; i++) {
      if (data[i][0] === teamId && data[i][1] === playerId) {
        rowToDelete = i + 1; // Convert to 1-based row index
        break;
      }
    }
    
    if (rowToDelete > 0) {
      withProtectionBypass(() => {
        indexSheet.deleteRow(rowToDelete);
        SpreadsheetApp.flush();
      }, "Remove from Player Index", 'PLAYER_INDEX');
      
      Logger.log(`${CONTEXT}: Removed player ${playerId} from index for team ${teamId}`);
    }
    
  } catch (e) {
    Logger.log(`${CONTEXT}: Error removing from index: ${e.message}`);
    // Don't throw - index update failure shouldn't break the main operation
  }
}

/**
 * Updates a player's information in the PLAYER_INDEX
 * Used when display name or discord username changes
 * @param {string} playerId The player's ID
 * @param {Object} updates Object with displayName and/or discordUsername
 */
function _pdm_updatePlayerInIndex(playerId, updates) {
  const CONTEXT = "PlayerDataManager._pdm_updatePlayerInIndex";
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const indexSheet = ss.getSheetByName('PLAYER_INDEX');
    
    if (!indexSheet) {
      Logger.log(`${CONTEXT}: Warning - PLAYER_INDEX sheet not found. Skipping index update.`);
      return;
    }
    
    const data = indexSheet.getDataRange().getValues();
    const rowsToUpdate = [];
    
    // Find all rows for this player (they might be on multiple teams)
    for (let i = 1; i < data.length; i++) {
      if (data[i][1] === playerId) { // Column B is PlayerID
        rowsToUpdate.push(i + 1); // Store 1-based row index
      }
    }
    
    if (rowsToUpdate.length > 0) {
      withProtectionBypass(() => {
        for (const rowIndex of rowsToUpdate) {
          if (updates.displayName) {
            indexSheet.getRange(rowIndex, 3).setValue(updates.displayName); // Column C
          }
          if (updates.hasOwnProperty('discordUsername')) {
            indexSheet.getRange(rowIndex, 6).setValue(updates.discordUsername || ""); // Column F
          }
        }
        SpreadsheetApp.flush();
      }, "Update Player in Index", 'PLAYER_INDEX');
      
      Logger.log(`${CONTEXT}: Updated ${rowsToUpdate.length} index entries for player ${playerId}`);
    }
    
  } catch (e) {
    Logger.log(`${CONTEXT}: Error updating index: ${e.message}`);
    // Don't throw - index update failure shouldn't break the main operation
  }
}

/**
 * Batch removes all players from a team in the PLAYER_INDEX
 * Used when a team is archived or deleted
 * @param {string} teamId The team ID to remove all players from
 */
function _pdm_removeTeamFromIndex(teamId) {
  const CONTEXT = "PlayerDataManager._pdm_removeTeamFromIndex";
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const indexSheet = ss.getSheetByName('PLAYER_INDEX');
    
    if (!indexSheet) {
      Logger.log(`${CONTEXT}: Warning - PLAYER_INDEX sheet not found. Skipping index update.`);
      return;
    }
    
    const data = indexSheet.getDataRange().getValues();
    const rowsToDelete = [];
    
    // Find all rows for this team
    for (let i = 1; i < data.length; i++) {
      if (data[i][0] === teamId) { // Column A is TeamID
        rowsToDelete.push(i + 1); // Store 1-based row index
      }
    }
    
    if (rowsToDelete.length > 0) {
      withProtectionBypass(() => {
        // Delete from bottom to top to avoid index shifting
        for (let i = rowsToDelete.length - 1; i >= 0; i--) {
          indexSheet.deleteRow(rowsToDelete[i]);
        }
        SpreadsheetApp.flush();
      }, "Remove Team from Player Index", 'PLAYER_INDEX');
      
      Logger.log(`${CONTEXT}: Removed ${rowsToDelete.length} players from index for team ${teamId}`);
    }
    
  } catch (e) {
    Logger.log(`${CONTEXT}: Error removing team from index: ${e.message}`);
    // Don't throw - index update failure shouldn't break the main operation
  }
}

/**
 * Gets team roster from the PLAYER_INDEX (FAST)
 * This replaces the slow full-sheet scan in syncTeamPlayerData and _cache_updateTeamData
 * @param {string} teamId The team ID to get roster for
 * @return {Array} Array of player objects with display info
 */
function getTeamRosterFromIndex(teamId) {
  const CONTEXT = "PlayerDataManager.getTeamRosterFromIndex";
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const indexSheet = ss.getSheetByName('PLAYER_INDEX');
    
    if (!indexSheet) {
      Logger.log(`${CONTEXT}: PLAYER_INDEX not found, falling back to slow method`);
      return getTeamRosterSlow(teamId); // Fallback to original method
    }
    
    const data = indexSheet.getDataRange().getValues();
    const roster = [];
    
    // Skip header row
    for (let i = 1; i < data.length; i++) {
      if (data[i][0] === teamId) { // TeamID match
        const playerId = data[i][1];
        
        // Get complete player data including email and joinDate
        const fullPlayerData = getPlayerDataById(playerId, false);
        const teamSlot = fullPlayerData && fullPlayerData.team1.teamId === teamId ? 
          fullPlayerData.team1 : (fullPlayerData ? fullPlayerData.team2 : null);
        
        roster.push({
          playerId: playerId,
          displayName: data[i][2],
          initials: data[i][3],
          role: data[i][4],
          discordUsername: data[i][5] || null,
          // Enhanced: Add complete data for JSON roster format
          googleEmail: fullPlayerData ? fullPlayerData.googleEmail : null,
          joinDate: teamSlot ? teamSlot.joinDate : null
        });
      }
    }
    
    // Sort by display name for consistent ordering
    roster.sort((a, b) => (a.displayName || "").localeCompare(b.displayName || ""));
    
    Logger.log(`${CONTEXT}: Retrieved ${roster.length} players for team ${teamId} from index with complete data`);
    return roster;
    
  } catch (e) {
    Logger.log(`${CONTEXT}: Error reading from index: ${e.message}`);
    return getTeamRosterSlow(teamId); // Fallback
  }
}

/**
 * Builds a JSON roster string from PLAYER_INDEX data for a specific team
 * Used to populate the roster merged cell in team week blocks
 * @param {string} teamId The team ID to build roster for
 * @return {string} JSON string of roster array or error message
 */
function buildRosterString(teamId) {
  const CONTEXT = "PlayerDataManager.buildRosterString";
  try {
    if (!teamId) {
      Logger.log(`${CONTEXT}: TeamID required`);
      return "(No team ID provided)";
    }
    
    const roster = getTeamRosterFromIndex(teamId);
    
    if (!roster || roster.length === 0) {
      return "(No roster data)";
    }
    
    // Build roster array in JSON format
    const rosterArray = roster.map(player => ({
      id: player.playerId,
      name: player.displayName,
      initials: player.initials,
      role: player.role,
      email: player.googleEmail,
      joinDate: player.joinDate,
      discordUsername: player.discordUsername
    }));
    
    const jsonString = JSON.stringify(rosterArray, null, 2);
    Logger.log(`${CONTEXT}: Built roster JSON for team ${teamId} with ${roster.length} players`);
    return jsonString;
    
  } catch (e) {
    Logger.log(`${CONTEXT}: Error building roster string for team ${teamId}: ${e.message}`);
    return `(Error: ${e.message})`;
  }
}

/**
 * Parses a JSON roster string back to array format
 * Used to read roster data from merged cells for processing
 * @param {string} rosterString JSON string from roster cell
 * @return {Array} Array of player objects or empty array on error
 */
function parseRosterString(rosterString) {
  const CONTEXT = "PlayerDataManager.parseRosterString";
  try {
    if (!rosterString || typeof rosterString !== 'string') {
      return [];
    }
    
    // Handle default/empty states
    if (rosterString.includes("(No roster data)") || 
        rosterString.includes("(Error:") || 
        rosterString.trim() === "") {
      return [];
    }
    
    const parsed = JSON.parse(rosterString);
    
    if (!Array.isArray(parsed)) {
      Logger.log(`${CONTEXT}: Parsed data is not an array`);
      return [];
    }
    
    // Validate structure
    const validRoster = parsed.filter(player => 
      player && 
      typeof player === 'object' && 
      player.id && 
      player.name
    );
    
    Logger.log(`${CONTEXT}: Parsed ${validRoster.length} valid players from roster string`);
    return validRoster;
    
  } catch (e) {
    Logger.log(`${CONTEXT}: Error parsing roster string: ${e.message}`);
    return [];
  }
}

/**
 * Validates JSON roster format for data integrity
 * @param {string} rosterString JSON string to validate
 * @return {Object} {isValid: boolean, errors: Array}
 */
function validateRosterFormat(rosterString) {
  const CONTEXT = "PlayerDataManager.validateRosterFormat";
  const errors = [];
  
  try {
    if (!rosterString || typeof rosterString !== 'string') {
      errors.push("Roster string is required");
      return { isValid: false, errors };
    }
    
    // Allow default states
    if (rosterString.includes("(No roster data)")) {
      return { isValid: true, errors: [] };
    }
    
    const parsed = JSON.parse(rosterString);
    
    if (!Array.isArray(parsed)) {
      errors.push("Roster must be a JSON array");
      return { isValid: false, errors };
    }
    
    // Validate each player object
    parsed.forEach((player, index) => {
      if (!player || typeof player !== 'object') {
        errors.push(`Player ${index + 1}: Must be an object`);
        return;
      }
      
      if (!player.id || typeof player.id !== 'string') {
        errors.push(`Player ${index + 1}: Missing or invalid id`);
      }
      
      if (!player.name || typeof player.name !== 'string') {
        errors.push(`Player ${index + 1}: Missing or invalid name`);
      }
      
      if (!player.initials || typeof player.initials !== 'string') {
        errors.push(`Player ${index + 1}: Missing or invalid initials`);
      }
      
      if (!player.role || typeof player.role !== 'string') {
        errors.push(`Player ${index + 1}: Missing or invalid role`);
      }
    });
    
    const isValid = errors.length === 0;
    Logger.log(`${CONTEXT}: Validation ${isValid ? 'passed' : 'failed'} for roster with ${parsed.length} players`);
    
    return { isValid, errors };
    
  } catch (e) {
    errors.push(`JSON parsing error: ${e.message}`);
    return { isValid: false, errors };
  }
}

/**
 * Fallback method - the original slow roster lookup
 * Keep this for backward compatibility and error recovery
 */
function getTeamRosterSlow(teamId) {
  const CONTEXT = "PlayerDataManager.getTeamRosterSlow";
  const allPlayersResult = getAllPlayers(false, { teamId: teamId });
  if (!allPlayersResult.success) {
    Logger.log(`${CONTEXT}: Could not retrieve players for team ${teamId}`);
    return [];
  }
  
  return allPlayersResult.players.map(player => {
    const teamData = player.team1.teamId === teamId ? player.team1 : player.team2;
    return {
      playerId: player.playerId,
      displayName: player.displayName,
      initials: teamData.initials,
      role: teamData.role,
      googleEmail: player.googleEmail,
      discordUsername: player.discordUsername || null
    };
  });
}

/**
 * Checks if initials are already in use by another player on the specified team
 * Uses the fast PLAYER_INDEX for lookup
 * @param {string} teamId The team to check
 * @param {string} initials The initials to check
 * @param {string} excludePlayerId Optional player ID to exclude (for updates)
 * @return {boolean} True if initials are already taken
 */
function areInitialsInUseOnTeam(teamId, initials, excludePlayerId = null) {
  const CONTEXT = "PlayerDataManager.areInitialsInUseOnTeam";
  try {
    const upperInitials = initials.toUpperCase();
    
    // Try fast lookup first
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const indexSheet = ss.getSheetByName('PLAYER_INDEX');
    
    if (indexSheet) {
      // Use index for fast lookup
      const data = indexSheet.getDataRange().getValues();
      
      for (let i = 1; i < data.length; i++) {
        if (data[i][0] === teamId && // Same team
            data[i][3] === upperInitials && // Same initials
            data[i][1] !== excludePlayerId) { // Not the excluded player
          Logger.log(`${CONTEXT}: Initials ${upperInitials} already in use on team ${teamId}`);
          return true;
        }
      }
      return false;
    }
    
    // Fallback to slow method if index not available
    Logger.log(`${CONTEXT}: Index not available, using slow lookup`);
    const roster = getTeamRosterSlow(teamId);
    
    for (const player of roster) {
      if (player.initials === upperInitials && player.playerId !== excludePlayerId) {
        Logger.log(`${CONTEXT}: Initials ${upperInitials} already in use on team ${teamId} (slow check)`);
        return true;
      }
    }
    
    return false;
    
  } catch (e) {
    Logger.log(`${CONTEXT}: Error checking initials: ${e.message}`);
    return false; // Fail open to avoid blocking operations
  }
}

// ===== UPDATES TO EXISTING FUNCTIONS =====

// In joinTeamByCode(), add after line: syncTeamPlayerData(teamData.teamId);
/*
_pdm_addToPlayerIndex(
  teamData.teamId,
  player.playerId,
  player.displayName,
  upperInitials,
  ROLES.PLAYER,
  player.discordUsername || ""
);
*/

// Also add initials validation BEFORE joining:
/*
if (areInitialsInUseOnTeam(teamData.teamId, playerInitialsInSlot)) {
  return createErrorResponse(
    `The initials "${playerInitialsInSlot}" are already in use by another player on team "${teamData.teamName}". ` +
    `Please choose different initials.`
  );
}
*/

// In leaveTeam(), add after line: syncTeamPlayerData(teamId);
/*
_pdm_removeFromPlayerIndex(teamId, playerToLeave.playerId);
*/

// In updatePlayer(), add after the teams sync loop:
/*
if (nameWasChanged || discordWasChanged) {
    // ... existing sync code ...
    
    _pdm_updatePlayerInIndex(playerToUpdateInitialState.playerId, {
        displayName: updates.displayName,
        discordUsername: updates.discordUsername
    });
}
*/

// In deactivatePlayer(), add this logic:
/*
// Before the updatePlayer call, save the teams
const teamsToRemoveFrom = [];
if (playerToDeactivate.team1.teamId) teamsToRemoveFrom.push(playerToDeactivate.team1.teamId);
if (playerToDeactivate.team2.teamId) teamsToRemoveFrom.push(playerToDeactivate.team2.teamId);

// After successful deactivation
if (updateResult.success) {
    for (const teamId of teamsToRemoveFrom) {
        _pdm_removeFromPlayerIndex(teamId, playerToDeactivate.playerId);
    }
}
*/

/**
 * Fast path for updating only discord username
 * Skips team sync since teams don't use discord usernames
 * @param {string} googleEmail - Player's email
 * @param {string} discordUsername - New discord username
 * @param {string} requestingUserEmail - User making the request
 * @return {Object} Success/error response
 */
function updateDiscordUsernameOnly(googleEmail, discordUsername, requestingUserEmail) {
  const CONTEXT = "PlayerDataManager.updateDiscordUsernameOnly";
  try {
    // Permission check - must be self
    if (googleEmail.toLowerCase() !== requestingUserEmail.toLowerCase()) {
      return createErrorResponse("You can only update your own Discord username.");
    }
    
    // Get current player data
    const player = getPlayerDataByEmail(googleEmail, true);
    if (!player) {
      return createErrorResponse(`Player not found: ${googleEmail}`);
    }
    
    if (!player.isActive) {
      return createErrorResponse("Cannot update inactive player profile.");
    }
    
    // Find player row
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const playersSheet = ss.getSheetByName(BLOCK_CONFIG.MASTER_SHEET.PLAYERS_SHEET);
    if (!playersSheet) return createErrorResponse("Players sheet not found.");
    
    const pCols = BLOCK_CONFIG.MASTER_SHEET.PLAYERS_COLUMNS;
    const playerRowData = findRow(playersSheet, pCols.GOOGLE_EMAIL, googleEmail.toLowerCase());
    if (playerRowData.rowIndex === -1) return createErrorResponse(`Player ${googleEmail} row not found.`);
    
    const rowIndexToUpdate = playerRowData.rowIndex + 1;
    
    // Update only discord username and last seen
    const updateResult = withProtectionBypass(() => {
      playersSheet.getRange(rowIndexToUpdate, pCols.DISCORD_USERNAME + 1).setValue(discordUsername.trim());
      playersSheet.getRange(rowIndexToUpdate, pCols.LAST_SEEN + 1).setValue(getCurrentTimestamp());
      SpreadsheetApp.flush();
      return true;
    }, "Update Discord Username Only", BLOCK_CONFIG.MASTER_SHEET.PLAYERS_SHEET);
    
    if (!updateResult) {
      return createErrorResponse("Failed to update Discord username.");
    }
    
    // Update player index (fast operation)
    _pdm_updatePlayerInIndex(player.playerId, {
      discordUsername: discordUsername.trim()
    });
    
    // Clear cache and return updated data
    _pdm_invalidatePlayerCache(googleEmail, player.playerId, `${CONTEXT}-DiscordUpdate`);
    
    // Return success with updated data
    const updatedPlayer = {
      ...player,
      discordUsername: discordUsername.trim(),
      lastSeen: getCurrentTimestamp()
    };
    
    return createSuccessResponse({ player: updatedPlayer }, "Discord username updated successfully.");
    
  } catch (e) {
    return handleError(e, CONTEXT);
  }
}

// ===== PHASE 2: Batch team sync operations =====

/**
 * Syncs player data for multiple teams in a single operation
 * More efficient than calling syncTeamPlayerData multiple times
 * @param {Array<string>} teamIds - Array of team IDs to sync
 * @return {Object} Success/error response with sync results
 */
function syncMultipleTeamsPlayerData(teamIds) {
  const CONTEXT = "PlayerDataManager.syncMultipleTeamsPlayerData";
  try {
    if (!teamIds || !Array.isArray(teamIds) || teamIds.length === 0) {
      return createErrorResponse("No team IDs provided for sync.");
    }
    
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const playersSheet = ss.getSheetByName(BLOCK_CONFIG.MASTER_SHEET.PLAYERS_SHEET);
    const teamsSheet = ss.getSheetByName(BLOCK_CONFIG.MASTER_SHEET.TEAMS_SHEET);
    
    if (!playersSheet || !teamsSheet) {
      return createErrorResponse("Players or Teams sheet not found for sync.");
    }
    
    // Get all player data ONCE
    const playersData = playersSheet.getDataRange().getValues();
    const pCols = BLOCK_CONFIG.MASTER_SHEET.PLAYERS_COLUMNS;
    
    // Build roster data for each team
    const teamRosterMap = new Map();
    
    // Initialize empty rosters for each team
    teamIds.forEach(teamId => {
      teamRosterMap.set(teamId, {
        playerNames: [],
        playerInitials: []
      });
    });
    
    // Single pass through all players
    for (let i = 1; i < playersData.length; i++) {
      const row = playersData[i];
      if (!row[pCols.IS_ACTIVE]) continue;
      
      // Check if player is on any of our teams
      const checkTeamMembership = (teamIdFromRow, initialsFromRow) => {
        if (teamIdFromRow && teamIds.includes(teamIdFromRow) && initialsFromRow) {
          const roster = teamRosterMap.get(teamIdFromRow);
          roster.playerNames.push(row[pCols.DISPLAY_NAME]);
          roster.playerInitials.push(initialsFromRow);
        }
      };
      
      checkTeamMembership(row[pCols.TEAM1_ID], row[pCols.TEAM1_INITIALS]);
      checkTeamMembership(row[pCols.TEAM2_ID], row[pCols.TEAM2_INITIALS]);
    }
    
    // Get teams data and prepare batch updates
    const teamsData = teamsSheet.getDataRange().getValues();
    const tCols = BLOCK_CONFIG.MASTER_SHEET.TEAMS_COLUMNS;
    const currentTimestamp = getCurrentTimestamp();
    const updateOperations = [];
    
    // Find all teams and prepare their updates
    teamIds.forEach(teamId => {
      const teamRowIndex = teamsData.slice(1).findIndex(row => row[tCols.TEAM_ID] === teamId);
      if (teamRowIndex !== -1) {
        const roster = teamRosterMap.get(teamId);
        const sheetRowIndex = teamRowIndex + 2; // +1 for 0-index, +1 for header
        
        updateOperations.push({
          teamId: teamId,
          rowIndex: sheetRowIndex,
          playerCount: roster.playerNames.length,
          playerList: roster.playerNames.join(','),
          initialsList: roster.playerInitials.join(',')
        });
      }
    });
    
    // Perform all updates in a single protected operation
    const batchUpdateResult = withProtectionBypass(() => {
      updateOperations.forEach(op => {
        teamsSheet.getRange(op.rowIndex, tCols.PLAYER_COUNT + 1).setValue(op.playerCount);
        teamsSheet.getRange(op.rowIndex, tCols.PLAYER_LIST + 1).setValue(op.playerList);
        teamsSheet.getRange(op.rowIndex, tCols.INITIALS_LIST + 1).setValue(op.initialsList);
        teamsSheet.getRange(op.rowIndex, tCols.LAST_ACTIVE + 1).setValue(currentTimestamp);
      });
      SpreadsheetApp.flush();
      return true;
    }, "Batch Sync Team Player Data", BLOCK_CONFIG.MASTER_SHEET.TEAMS_SHEET);
    
    if (!batchUpdateResult) {
      return createErrorResponse("Failed to sync team player data.");
    }
    
    // Invalidate caches and update SYSTEM_CACHE for all teams
    const cacheUpdateResults = [];
    updateOperations.forEach(op => {
      _pdm_invalidateTeamDataCache(op.teamId, `${CONTEXT}-BatchSync`);
      // Update SYSTEM_CACHE
      const cacheResult = _cache_updateTeamData(op.teamId);
      cacheUpdateResults.push({
        teamId: op.teamId,
        success: cacheResult && cacheResult.success
      });
    });
    
    return createSuccessResponse({
      teamsUpdated: updateOperations.length,
      operations: updateOperations,
      cacheUpdates: cacheUpdateResults
    }, `Synced data for ${updateOperations.length} teams.`);
    
  } catch (e) {
    return handleError(e, CONTEXT);
  }
}

/**
 * Kicks a player from a team (leader-initiated removal)
 * @param {string} teamId The ID of the team
 * @param {string} playerToKickEmail Email of the player to kick
 * @param {string} requestingLeaderEmail Email of the leader performing the kick
 * @return {Object} Success/error response
 */
function kickPlayerFromTeam(teamId, playerToKickEmail, requestingLeaderEmail) {
  const CONTEXT = "PlayerDataManager.kickPlayerFromTeam";
  try {
    // Verify the requesting user is a leader of this team
    if (!isUserTeamLeader(requestingLeaderEmail, teamId)) {
      return createErrorResponse("Permission denied. Only team leaders can remove other players.");
    }
    
    // Don't allow kicking self (use leaveTeam instead)
    if (playerToKickEmail.toLowerCase() === requestingLeaderEmail.toLowerCase()) {
      return createErrorResponse("You cannot kick yourself from the team. Use the 'Leave Team' option instead.");
    }
    
    // Check if target player exists and is on the team
    const playerToKick = getPlayerDataByEmail(playerToKickEmail, true);
    if (!playerToKick) {
      return createErrorResponse(`Player not found: ${playerToKickEmail}`);
    }
    
    // Don't allow kicking another leader
    let isOnTeam = false;
    let isLeader = false;
    
    if (playerToKick.team1.teamId === teamId) {
      isOnTeam = true;
      isLeader = playerToKick.team1.role === ROLES.TEAM_LEADER;
    } else if (playerToKick.team2.teamId === teamId) {
      isOnTeam = true;
      isLeader = playerToKick.team2.role === ROLES.TEAM_LEADER;
    }
    
    if (!isOnTeam) {
      return createErrorResponse(`Player ${playerToKickEmail} is not a member of this team.`);
    }
    
    if (isLeader) {
      return createErrorResponse("You cannot remove another team leader. Leaders must leave voluntarily.");
    }
    
    // All checks passed, proceed with removal by calling leaveTeam internally
    return leaveTeam(playerToKickEmail, teamId, requestingLeaderEmail, true);
    
  } catch (e) {
    return handleError(e, CONTEXT);
  }
}

// =============================================================================
// TEAM SHEET ROSTER BLOCK UPDATE HELPER (NEW)
// =============================================================================
/**
 * Logs a roster change to the current week's changelog and updates roster snapshot
 * Replaces the old complex _pdm_updateCurrentWeekRosterBlockOnTeamSheet function
 * @param {string} teamId The ID of the team
 * @param {string} actionType "JOINED", "LEFT", or "NAME_CHANGED" 
 * @param {Object} playerDetails Player details {displayName, initials, email, oldName, newName}
 */
function _pdm_logRosterChange(teamId, actionType, playerDetails) {
    const CONTEXT = "PlayerDataManager._pdm_logRosterChange";
    try {
        if (!teamId || !actionType || !playerDetails) {
            Logger.log(`${CONTEXT}: Missing required parameters`);
            return;
        }

        const teamData = getTeamData(teamId);
        if (!teamData || !teamData.availabilitySheetName) {
            Logger.log(`${CONTEXT}: Team data or availability sheet name not found for team ${teamId}`);
            return;
        }

        const ss = SpreadsheetApp.getActiveSpreadsheet();
        const teamSheet = ss.getSheetByName(teamData.availabilitySheetName);
        if (!teamSheet) {
            Logger.log(`${CONTEXT}: Availability sheet "${teamData.availabilitySheetName}" not found`);
            return;
        }

        // Get current week info
        const now = getCurrentCETDate();
        const currentYear = now.getFullYear();
        const currentWeekNum = getISOWeekNumber(now);

        // Find current week block
        let currentWeekBlock = findWeekBlock(teamSheet, currentYear, currentWeekNum);
        if (!currentWeekBlock) {
            const ensuredBlockResult = ensureWeekExists(teamSheet, currentYear, currentWeekNum);
            if (!ensuredBlockResult || !ensuredBlockResult.success) {
                Logger.log(`${CONTEXT}: Failed to find or create current week block for team ${teamId}`);
                return;
            }
            currentWeekBlock = ensuredBlockResult;
        }

        // 1. Update roster snapshot in merged cell using new structure
        const rosterUpdated = updateWeekBlockRoster(teamSheet, currentWeekBlock.startRow, teamId);
        
        // 2. Create changelog entry
        const timestamp = formatDate(now, "YYYY-MM-DD HH:mm");
        let changelogEntry = "";
        
        switch (actionType) {
            case "JOINED":
                changelogEntry = `${timestamp} - ${playerDetails.displayName} (${playerDetails.initials || 'N/A'}) <${playerDetails.email}> joined the team.`;
                break;
            case "LEFT":
                changelogEntry = `${timestamp} - ${playerDetails.displayName} (${playerDetails.initials || 'N/A'}) <${playerDetails.email}> left the team.`;
                break;
            case "NAME_CHANGED":
                changelogEntry = `${timestamp} - ${playerDetails.oldName} changed name to "${playerDetails.newName}".`;
                break;
            default:
                changelogEntry = `${timestamp} - ${playerDetails.displayName} ${actionType.toLowerCase()}.`;
        }

        // 3. Append to changelog merged cell
        const changelogUpdated = appendToWeekBlockChangelog(teamSheet, currentWeekBlock.startRow, changelogEntry);

        if (rosterUpdated && changelogUpdated) {
            Logger.log(`${CONTEXT}: Successfully updated roster and changelog for team ${teamId}`);
        } else {
            Logger.log(`${CONTEXT}: Partial update - roster: ${rosterUpdated}, changelog: ${changelogUpdated}`);
        }

    } catch (e) {
        Logger.log(`${CONTEXT}: Error logging roster change for team ${teamId}: ${e.message}`);
    }
}

// =============================================================================