/**
 * Schedule Manager - Administrator Service (Web App Edition)
 *
 * @version 1.2.2 (2025-05-31) - Corrected use of withProtectionBypass to withMultiSheetBypass for multiple sheets.
 * @version 1.2.1 (2025-05-31) - Added PlayerDataManager cache invalidation.
 * @version 1.2.0 (2025-05-31) - Added TeamDataManager cache invalidation.
 * @version 1.1.0 (2025-05-31) - Refactored core_adminSetTeamLeader
 * @version 1.0.0 (2025-05-30) - Phase 1D
 *
 * Description: Handles administrator-only operations.
 * core_adminSetTeamLeader allows an Admin or current Team Leader to set/change team leader.
 */

// Assumes global constants: ROLES, PERMISSIONS, BLOCK_CONFIG
// Assumes global functions from Configuration.js: createErrorResponse, createSuccessResponse, isValidEmail, getCurrentTimestamp, handleError
// Assumes global functions from PermissionManager.js: userHasPermission, clearUserRoleCache
// Assumes global functions from TeamDataManager.js: isUserTeamLeader
// Assumes global functions from PlayerDataManager.js: getPlayerDataByEmail, _pdm_invalidatePlayerCache (if we make helper global or replicate logic)
// Assumes global function from CellProtection.js: withProtectionBypass, withMultiSheetBypass


// =============================================================================
// HELPER FUNCTIONS for core_adminSetTeamLeader
// =============================================================================

function _as_validateSetLeaderPermissionsAndInputs(teamId, newLeaderUserEmail, requestingUserEmail) {
  const isGlobalAdmin = userHasPermission(requestingUserEmail, PERMISSIONS.ASSIGN_TEAM_LEADER);
  const isCurrentLeaderOfThisTeam = isUserTeamLeader(requestingUserEmail, teamId);

  if (!isGlobalAdmin && !isCurrentLeaderOfThisTeam) {
    return createErrorResponse("Permission denied: You must be an Administrator or the current Team Leader of this team to perform this action.");
  }
  if (!teamId || !newLeaderUserEmail || !isValidEmail(newLeaderUserEmail)) {
    return createErrorResponse("Invalid input: Team ID and a valid new leader email are required.");
  }
  return { success: true };
}

function _as_getTeamAndLeaderDetails(teamId, newLeaderUserEmail, teamsSheet, playersSheet) {
  const tCols = BLOCK_CONFIG.MASTER_SHEET.TEAMS_COLUMNS;
  const pCols = BLOCK_CONFIG.MASTER_SHEET.PLAYERS_COLUMNS;

  const teamsData = teamsSheet.getDataRange().getValues();
  const teamRowIndex = teamsData.findIndex(row => row[tCols.TEAM_ID] === teamId && row[tCols.IS_ACTIVE]);

  if (teamRowIndex === -1) {
    return createErrorResponse(`Team not found or is inactive: ${teamId}`);
  }
  const currentTeamDataRow = teamsData[teamRowIndex];
  const oldLeaderEmailOnTeamsSheet = currentTeamDataRow[tCols.LEADER_EMAIL];

  const playersData = playersSheet.getDataRange().getValues();
  let newLeaderPlayerRowDataIndex = -1;
  let oldLeaderPlayerRowDataIndex = -1;
  let newLeaderCurrentTeamSlot = null;
  let oldLeaderPlayerCurrentTeamSlot = null;
  let newLeaderCurrentRoleInSlot = null;
  let newLeaderPlayerId = null; // To store Player ID for cache invalidation
  let oldLeaderPlayerId = null; // To store Player ID for cache invalidation


  for (let i = 1; i < playersData.length; i++) {
    const playerRow = playersData[i];
    const playerEmail = playerRow[pCols.GOOGLE_EMAIL];
    const playerIsActive = playerRow[pCols.IS_ACTIVE];

    if (playerEmail.toLowerCase() === newLeaderUserEmail.toLowerCase() && playerIsActive) {
      newLeaderPlayerRowDataIndex = i;
      newLeaderPlayerId = playerRow[pCols.PLAYER_ID]; // Get PlayerID
      if (playerRow[pCols.TEAM1_ID] === teamId) {
        newLeaderCurrentTeamSlot = 'TEAM1';
        newLeaderCurrentRoleInSlot = playerRow[pCols.TEAM1_ROLE];
      } else if (playerRow[pCols.TEAM2_ID] === teamId) {
        newLeaderCurrentTeamSlot = 'TEAM2';
        newLeaderCurrentRoleInSlot = playerRow[pCols.TEAM2_ROLE];
      }
    }
    if (oldLeaderEmailOnTeamsSheet && playerEmail.toLowerCase() === oldLeaderEmailOnTeamsSheet.toLowerCase() && playerIsActive) {
      oldLeaderPlayerRowDataIndex = i;
      oldLeaderPlayerId = playerRow[pCols.PLAYER_ID]; // Get PlayerID
      if (playerRow[pCols.TEAM1_ID] === teamId) oldLeaderPlayerCurrentTeamSlot = 'TEAM1';
      else if (playerRow[pCols.TEAM2_ID] === teamId) oldLeaderPlayerCurrentTeamSlot = 'TEAM2';
    }
  }

  if (newLeaderPlayerRowDataIndex === -1) {
    return createErrorResponse(`New leader candidate ${newLeaderUserEmail} not found in player records or is inactive.`);
  }
  if (!newLeaderCurrentTeamSlot) {
    return createErrorResponse(`New leader candidate ${newLeaderUserEmail} is not an active member of team ${teamId}.`);
  }

  return {
    success: true,
    teamSheetRow: teamRowIndex + 1,
    oldLeaderEmailOnTeamsSheet: oldLeaderEmailOnTeamsSheet,
    newLeaderPlayerSheetRow: newLeaderPlayerRowDataIndex + 1,
    newLeaderCurrentTeamSlot: newLeaderCurrentTeamSlot,
    newLeaderCurrentRoleInSlot: newLeaderCurrentRoleInSlot,
    newLeaderPlayerId: newLeaderPlayerId, // Pass Player ID
    oldLeaderPlayerSheetRow: oldLeaderPlayerRowDataIndex !== -1 ? oldLeaderPlayerRowDataIndex + 1 : -1,
    oldLeaderPlayerCurrentTeamSlot: oldLeaderPlayerCurrentTeamSlot,
    oldLeaderPlayerId: oldLeaderPlayerId // Pass Player ID
  };
}

function _as_performLeaderSheetUpdates(details, newLeaderUserEmail, teamsSheet, playersSheet) {
  const CONTEXT_HELPER = "AdministratorService._as_performLeaderSheetUpdates";
  const tCols = BLOCK_CONFIG.MASTER_SHEET.TEAMS_COLUMNS;
  const pCols = BLOCK_CONFIG.MASTER_SHEET.PLAYERS_COLUMNS;

  Logger.log(`${CONTEXT_HELPER}: Updating sheets. New Leader PlayerSheetRow: ${details.newLeaderPlayerSheetRow}, Slot: ${details.newLeaderCurrentTeamSlot}, RoleValue: '${ROLES.TEAM_LEADER}'`);

  // CORRECTED: Using withMultiSheetBypass as we are operating on multiple sheets (Teams and Players)
  const updateResult = withMultiSheetBypass(() => {
    const newLeaderRoleCell = playersSheet.getRange(details.newLeaderPlayerSheetRow, pCols[`${details.newLeaderCurrentTeamSlot}_ROLE`] + 1);
    newLeaderRoleCell.setValue(ROLES.TEAM_LEADER);

    if (details.oldLeaderEmailOnTeamsSheet &&
        details.oldLeaderPlayerSheetRow !== -1 &&
        details.oldLeaderPlayerCurrentTeamSlot &&
        details.oldLeaderEmailOnTeamsSheet.toLowerCase() !== newLeaderUserEmail.toLowerCase()) {
      const oldLeaderRoleCell = playersSheet.getRange(details.oldLeaderPlayerSheetRow, pCols[`${details.oldLeaderPlayerCurrentTeamSlot}_ROLE`] + 1);
      oldLeaderRoleCell.setValue(ROLES.PLAYER);
    } else if (details.oldLeaderEmailOnTeamsSheet && details.oldLeaderEmailOnTeamsSheet.toLowerCase() !== newLeaderUserEmail.toLowerCase()) {
      Logger.log(`${CONTEXT_HELPER}: Player record for former leader ${details.oldLeaderEmailOnTeamsSheet} not found or not on this team for role demotion.`);
    }

    teamsSheet.getRange(details.teamSheetRow, tCols.LEADER_EMAIL + 1).setValue(newLeaderUserEmail);
    teamsSheet.getRange(details.teamSheetRow, tCols.LAST_ACTIVE + 1).setValue(getCurrentTimestamp());
    Logger.log(`${CONTEXT_HELPER}: Updated LEADER_EMAIL for team (sheet row ${details.teamSheetRow}) to ${newLeaderUserEmail} in Teams sheet.`);
    return true;
  }, "Admin/Leader Set Team Leader Sheets", [BLOCK_CONFIG.MASTER_SHEET.TEAMS_SHEET, BLOCK_CONFIG.MASTER_SHEET.PLAYERS_SHEET]);

  if (!updateResult) { // withMultiSheetBypass typically throws an error on failure, or returns the operation's result.
                      // If operation returns false, this check is fine. If it throws, it's caught by core_adminSetTeamLeader's try-catch.
      return createErrorResponse("Failed to set team leader due to an issue with sheet protection bypass or sheet operations.");
  }
  Logger.log(`${CONTEXT_HELPER}: Sheet updates completed via bypass.`);
  return { success: true };
}

// =============================================================================
// ADMIN TEAM MANAGEMENT FUNCTIONS
// =============================================================================

// ===== COMPLETE REPLACEMENT FOR core_adminSetTeamLeader in Administrator.js =====

function core_adminSetTeamLeader(teamId, newLeaderEmail, requestingUserEmail) {
  const CONTEXT = "Administrator.core_adminSetTeamLeader";
  try {
    // Permission check - allow both admins and current team leaders
    const isGlobalAdmin = userHasPermission(requestingUserEmail, PERMISSIONS.MANAGE_ALL_TEAMS);
    const isCurrentLeader = isUserTeamLeader(requestingUserEmail, teamId);

    // The user can proceed if they are a global admin OR the current leader of this specific team
    if (!isGlobalAdmin && !isCurrentLeader) {
      return createErrorResponse("Permission denied: You must be an Administrator or the current Team Leader to perform this action.");
    }
    
    // Validate inputs
    if (!teamId || !newLeaderEmail) {
      return createErrorResponse("Team ID and new leader email are required.");
    }
    
    if (!isValidEmail(newLeaderEmail)) {
      return createErrorResponse("Invalid email address format.");
    }
    
    // Get team data
    const teamData = getTeamData(teamId, true);
    if (!teamData) {
      return createErrorResponse(`Team not found: ${teamId}`);
    }
    
    if (!teamData.isActive) {
      return createErrorResponse("Cannot set leader for inactive team.");
    }
    
    // Get target player data
    const targetPlayer = getPlayerDataByEmail(newLeaderEmail, true);
    if (!targetPlayer) {
      return createErrorResponse(`Player not found: ${newLeaderEmail}`);
    }
    
    if (!targetPlayer.isActive) {
      return createErrorResponse("Cannot set inactive player as team leader.");
    }
    
    // Check if player is on the team
    let targetSlotKey = null;
    if (targetPlayer.team1.teamId === teamId) {
      targetSlotKey = 'TEAM1';
    } else if (targetPlayer.team2.teamId === teamId) {
      targetSlotKey = 'TEAM2';
    }
    
    if (!targetSlotKey) {
      return createErrorResponse(`Player ${newLeaderEmail} is not a member of team ${teamData.teamName}.`);
    }
    
    // Update operations
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    
    // 1. Update Teams sheet
    const teamsUpdateResult = withProtectionBypass(() => {
      const teamsSheet = ss.getSheetByName(BLOCK_CONFIG.MASTER_SHEET.TEAMS_SHEET);
      const tCols = BLOCK_CONFIG.MASTER_SHEET.TEAMS_COLUMNS;
      const teamRowData = findRow(teamsSheet, tCols.TEAM_ID, teamId);
      
      if (teamRowData.rowIndex === -1) {
        throw new Error("Team row not found");
      }
      
      teamsSheet.getRange(teamRowData.rowIndex + 1, tCols.LEADER_EMAIL + 1).setValue(newLeaderEmail.toLowerCase());
      teamsSheet.getRange(teamRowData.rowIndex + 1, tCols.LAST_ACTIVE + 1).setValue(getCurrentTimestamp());
      SpreadsheetApp.flush();
      return true;
    }, "Update Team Leader Email", BLOCK_CONFIG.MASTER_SHEET.TEAMS_SHEET);
    
    if (!teamsUpdateResult) {
      return createErrorResponse("Failed to update team leader in Teams sheet.");
    }
    
    // 2. Update Players sheet - set new leader role
    const playersUpdateResult = withProtectionBypass(() => {
      const playersSheet = ss.getSheetByName(BLOCK_CONFIG.MASTER_SHEET.PLAYERS_SHEET);
      const pCols = BLOCK_CONFIG.MASTER_SHEET.PLAYERS_COLUMNS;
      const targetPlayerRowData = findRow(playersSheet, pCols.PLAYER_ID, targetPlayer.playerId);
      
      if (targetPlayerRowData.rowIndex === -1) {
        throw new Error("Player row not found");
      }
      
      const targetPlayerRowIndex = targetPlayerRowData.rowIndex;
      playersSheet.getRange(targetPlayerRowIndex + 1, pCols[`${targetSlotKey}_ROLE`] + 1).setValue(ROLES.TEAM_LEADER);
      playersSheet.getRange(targetPlayerRowIndex + 1, pCols.LAST_SEEN + 1).setValue(getCurrentTimestamp());
      
      // === NEW: Update role in PLAYER_INDEX ===
      const indexSheet = ss.getSheetByName('PLAYER_INDEX');
      if (indexSheet) {
        const indexData = indexSheet.getDataRange().getValues();
        for (let i = 1; i < indexData.length; i++) {
          if (indexData[i][0] === teamId && indexData[i][1] === targetPlayer.playerId) {
            indexSheet.getRange(i + 1, 5).setValue(ROLES.TEAM_LEADER); // Column E is Role
            break;
          }
        }
      }
      
      SpreadsheetApp.flush();
      return true;
    }, "Update Player Role to Leader", BLOCK_CONFIG.MASTER_SHEET.PLAYERS_SHEET);
    
    if (!playersUpdateResult) {
      return createErrorResponse("Failed to update player role.");
    }
    
    // 3. Remove leader role from previous leader(s)
    const removeOldLeadersResult = withProtectionBypass(() => {
      const playersSheet = ss.getSheetByName(BLOCK_CONFIG.MASTER_SHEET.PLAYERS_SHEET);
      const pCols = BLOCK_CONFIG.MASTER_SHEET.PLAYERS_COLUMNS;
      const allPlayersData = playersSheet.getDataRange().getValues();
      
      for (let i = 1; i < allPlayersData.length; i++) {
        const row = allPlayersData[i];
        const playerEmail = row[pCols.GOOGLE_EMAIL];
        
        // Skip the new leader
        if (playerEmail.toLowerCase() === newLeaderEmail.toLowerCase()) continue;
        
        // Check both team slots
        let updated = false;
        if (row[pCols.TEAM1_ID] === teamId && row[pCols.TEAM1_ROLE] === ROLES.TEAM_LEADER) {
          playersSheet.getRange(i + 1, pCols.TEAM1_ROLE + 1).setValue(ROLES.PLAYER);
          updated = true;
          
          // === NEW: Update index for demoted leader ===
          const demotedPlayerId = row[pCols.PLAYER_ID];
          const indexSheet = ss.getSheetByName('PLAYER_INDEX');
          if (indexSheet) {
            const indexData = indexSheet.getDataRange().getValues();
            for (let j = 1; j < indexData.length; j++) {
              if (indexData[j][0] === teamId && indexData[j][1] === demotedPlayerId) {
                indexSheet.getRange(j + 1, 5).setValue(ROLES.PLAYER); // Column E is Role
                break;
              }
            }
          }
        }
        
        if (row[pCols.TEAM2_ID] === teamId && row[pCols.TEAM2_ROLE] === ROLES.TEAM_LEADER) {
          playersSheet.getRange(i + 1, pCols.TEAM2_ROLE + 1).setValue(ROLES.PLAYER);
          updated = true;
          
          // === NEW: Update index for demoted leader ===
          const demotedPlayerId = row[pCols.PLAYER_ID];
          const indexSheet = ss.getSheetByName('PLAYER_INDEX');
          if (indexSheet) {
            const indexData = indexSheet.getDataRange().getValues();
            for (let j = 1; j < indexData.length; j++) {
              if (indexData[j][0] === teamId && indexData[j][1] === demotedPlayerId) {
                indexSheet.getRange(j + 1, 5).setValue(ROLES.PLAYER); // Column E is Role
                break;
              }
            }
          }
        }
        
        if (updated) {
          playersSheet.getRange(i + 1, pCols.LAST_SEEN + 1).setValue(getCurrentTimestamp());
        }
      }
      
      SpreadsheetApp.flush();
      return true;
    }, "Remove Old Leader Roles", BLOCK_CONFIG.MASTER_SHEET.PLAYERS_SHEET);
    
    if (!removeOldLeadersResult) {
      Logger.log(`${CONTEXT}: Warning - Failed to remove old leader roles, but continuing.`);
    }
    
    // Clear caches
    _invalidateTeamCache(teamId);
    _pdm_invalidatePlayerCache(newLeaderEmail, targetPlayer.playerId, `${CONTEXT}-NewLeader`);
    clearUserRoleCache(newLeaderEmail);
    
    // Update team roster display
    syncTeamPlayerData(teamId);
    
    Logger.log(`${CONTEXT}: Successfully set ${newLeaderEmail} as leader of team ${teamData.teamName}`);
    
    return createSuccessResponse({
      teamId: teamId,
      teamName: teamData.teamName,
      newLeader: {
        email: newLeaderEmail,
        displayName: targetPlayer.displayName,
        role: ROLES.TEAM_LEADER
      }
    }, `${targetPlayer.displayName} is now the leader of ${teamData.teamName}.`);
    
  } catch (e) {
    return handleError(e, CONTEXT);
  }
}