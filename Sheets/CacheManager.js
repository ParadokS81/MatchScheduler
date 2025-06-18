/**
 * Schedule Manager - System Cache Manager
 * @version 1.0.0 (2025-06-08)
 *
 * Purpose: Manages the SYSTEM_CACHE sheet, which stores pre-computed/denormalized
 * data for fast frontend retrieval, such as full team rosters.
 */

/**
 * Updates the cached data for a specific team. This is the "slow" operation
 * that runs once after a roster change, so that frontend reads are fast.
 * @param {string} teamId The ID of the team to update.
 * @return {boolean} True if successful, false otherwise.
 */
function _cache_updateTeamData(teamId) {
  const CONTEXT = "CacheManager._cache_updateTeamData";
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const cacheSheet = ss.getSheetByName('SYSTEM_CACHE');
    if (!cacheSheet) {
      Logger.log(`${CONTEXT}: SYSTEM_CACHE sheet not found. Aborting.`);
      return false;
    }

    const teamData = getTeamData(teamId, true); // Include inactive in case we're caching an archival
    if (!teamData) {
      Logger.log(`${CONTEXT}: Could not find team data for ${teamId}. Aborting cache update.`);
      return false;
    }

    // === HANDOVER TASK: Replace slow roster lookup with cache-first logic (Phase 1B)
    // === CACHE-FIRST ROSTER LOOKUP ===
    let roster = [];

    // 1. Try cached players data first (fastest)
    try {
      const allPlayersResult = getAllPlayers(false, { teamId: teamId });
      if (allPlayersResult.success && allPlayersResult.players) {
        roster = allPlayersResult.players.map(player => {
          const teamData = player.team1.teamId === teamId ? player.team1 : player.team2;
          return {
            displayName: player.displayName,
            initials: teamData.initials,
            role: teamData.role,
            googleEmail: null, // Privacy: not storing email in cache
            discordUsername: player.discordUsername || null
          };
        });
        Logger.log(`${CONTEXT}: Used cached players data for team ${teamId} (${roster.length} players)`);
      } else {
        throw new Error("Cache miss or empty result");
      }
    } catch (cacheError) {
      // 2. Fallback to PLAYER_INDEX (fast sheet read)
      Logger.log(`${CONTEXT}: Cache miss for team ${teamId}, using PLAYER_INDEX fallback`);
      try {
        roster = getTeamRosterFromIndex(teamId).map(player => ({
          displayName: player.displayName,
          initials: player.initials,
          role: player.role,
          googleEmail: null, // Privacy: not storing email in cache
          discordUsername: player.discordUsername || null
        }));
        Logger.log(`${CONTEXT}: Used PLAYER_INDEX for team ${teamId} (${roster.length} players)`);
      } catch (indexError) {
        // 3. Last resort: slow full scan
        Logger.log(`${CONTEXT}: PLAYER_INDEX failed for team ${teamId}, using slow scan fallback`);
        const slowResult = getAllPlayers(false, { teamId: teamId });
        if (slowResult.success) {
          roster = slowResult.players.map(player => {
            const teamData = player.team1.teamId === teamId ? player.team1 : player.team2;
            return {
              displayName: player.displayName,
              initials: teamData.initials,
              role: teamData.role,
              googleEmail: null,
              discordUsername: player.discordUsername || null
            };
          });
          Logger.log(`${CONTEXT}: Used slow scan for team ${teamId} (${roster.length} players)`);
        }
      }
    }
    
    // Find the correct row in the cache sheet to update
    const teamIdsInData = cacheSheet.getRange('A2:A').getValues().flat();
    const rowIndex = teamIdsInData.indexOf(teamId);

    if (rowIndex !== -1) {
      const sheetRow = rowIndex + 2;
      // Update the lightweight data and the heavy RosterJSON
      cacheSheet.getRange(sheetRow, 2).setValue(teamData.teamName);
      cacheSheet.getRange(sheetRow, 3).setValue(teamData.division);
      cacheSheet.getRange(sheetRow, 4).setValue(teamData.logoUrl);
      cacheSheet.getRange(sheetRow, 5).setValue(teamData.isPublic);
      cacheSheet.getRange(sheetRow, 6).setValue(JSON.stringify(roster));
      Logger.log(`${CONTEXT}: Successfully updated cache for team ${teamId}.`);
      return true;
    } else {
      Logger.log(`${CONTEXT}: Could not find team ${teamId} in SYSTEM_CACHE sheet to update.`);
      return false;
    }
  } catch (e) {
    Logger.log(`Error in ${CONTEXT} for team ${teamId}: ${e.message}`);
    return false;
  }
}