/**
 * Schedule Manager - Permission Manager (Web App Edition - Refactored & Corrected)
 *
 * @version 1.1.2 (2025-06-07) - Added DEBUG_BYPASS_PERMISSIONS for testing
 * @version 1.1.1 (2025-05-30) - Corrected admin permission check in userHasPermission.
 *
 * Description: Centralized role-based permission system. Handles role detection, permission constants,
 * and authorization logic for the multi-team web application.
 *
 * CHANGELOG:
 * 1.1.2 - 2025-06-07 - Added DEBUG_BYPASS_PERMISSIONS property check for debug setup
 * 1.1.1 - 2025-05-30 - Corrected admin permission logic in userHasPermission to grant any defined permission. Added getCurrentUserEmail.
 * 1.1.0 - 2025-05-30 - Centralized ROLES, PERMISSIONS constants. Unified getUserRole and userHasPermission.
 * 1.0.0 - 2025-05-28 - Initial implementation with distributed permission logic.
 */

// BLOCK_CONFIG is from Configuration.js
// Utility functions (isValidEmail, etc.) are from Configuration.js
// PlayerDataManager functions (getUserTeams, getUserDisplayName, isPlayerOnTeam) are called directly.
// TeamDataManager functions (getTeamData, isUserTeamLeader) are called directly.


// =============================================================================
// ROLE & PERMISSION CONSTANTS (Centralized)
// =============================================================================

const ROLES = {
  ADMIN: "admin",
  TEAM_LEADER: "team_leader",
  PLAYER: "player",
  GUEST: "guest"
};

const PERMISSIONS = {
  // Admin exclusive
  MANAGE_SYSTEM_CONFIG: "manage_system_config",
  MANAGE_ALL_TEAMS: "manage_all_teams",
  MANAGE_ALL_PLAYERS: "manage_all_players",
  ASSIGN_TEAM_LEADER: "assign_team_leader",
  VIEW_SYSTEM_STATS: "view_system_stats",

  // Team Leader specific (Admins also get these implicitly or explicitly)
  EDIT_OWN_TEAM_DETAILS: "edit_own_team_details",
  REMOVE_PLAYER_FROM_OWN_TEAM: "remove_player_from_own_team",
  MANAGE_OWN_TEAM_LOGO: "manage_own_team_logo",

  // Player specific (Leaders & Admins also get these for relevant contexts)
  VIEW_TEAM_SCHEDULE: "view_team_schedule",
  UPDATE_OWN_AVAILABILITY: "update_own_availability",
  EDIT_OWN_PLAYER_PROFILE_FOR_TEAM: "edit_own_player_profile_for_team",
  LEAVE_TEAM: "leave_team",
   
  // General authenticated user / Guest actions
  CREATE_TEAM: "create_team", 
  JOIN_TEAM_WITH_CODE: "join_team_with_code",
  VIEW_PUBLIC_TEAMS: "view_public_teams", 
  GET_USER_CONTEXT: "get_user_context" 
};


// =============================================================================
// CORE AUTHENTICATION & ROLE DETECTION
// =============================================================================

/**
 * Gets the email of the current active user.
 * @return {string|null} The user's email or null if no active user or email.
 */
function getCurrentUserEmail() {
  try {
    const user = Session.getActiveUser();
    return user ? user.getEmail() : null;
  } catch (e) {
    Logger.log(`PermissionManager.getCurrentUserEmail: Could not retrieve active user email: ${e.message}`);
    return null; 
  }
}

/**
 * Gets current authenticated user object from Google Apps Script session.
 * @return {GoogleAppsScript.Base.User | null} Active user object or null.
 */
function getActiveUser() {
    try {
        const user = Session.getActiveUser();
        if (user && user.getEmail()) {
            return user;
        }
        // Logger.log("PermissionManager.getActiveUser: No active user session or email found.");
        return null;
    } catch (e) {
        Logger.log(`PermissionManager.getActiveUser: Error getting active user: ${e.message}`);
        return null;
    }
}

/**
 * Unified and enhanced role detection with caching.
 * @param {string} userEmail - User's Google email.
 * @return {string} User role (e.g., ROLES.ADMIN, ROLES.GUEST).
 */
function getUserRole(userEmail) {
  const CONTEXT = "PermissionManager.getUserRole";
  if (!userEmail || !isValidEmail(userEmail)) { 
    return ROLES.GUEST;
  }
  const lcUserEmail = userEmail.toLowerCase();

  const cachedRole = getCachedUserRole(lcUserEmail); // Local helper
  if (cachedRole) {
    return cachedRole;
  }
  
  let detectedRole = ROLES.GUEST; 

  if (BLOCK_CONFIG.ADMIN.ADMIN_USERS.map(admin => admin.toLowerCase()).includes(lcUserEmail)) {
    detectedRole = ROLES.ADMIN;
  } 
  else if (_pm_isTeamLeader(lcUserEmail)) { // Use prefixed internal helper
    detectedRole = ROLES.TEAM_LEADER;
  } 
  else if (_pm_isPlayer(lcUserEmail)) { // Use prefixed internal helper
    detectedRole = ROLES.PLAYER;
  }
  
  cacheUserRole(lcUserEmail, detectedRole); // Local helper
  Logger.log(`${CONTEXT}: Role for ${lcUserEmail} detected as: ${detectedRole} (now cached).`);
  return detectedRole;
}

// Internal helper: Checks if user is a leader of any active team
function _pm_isTeamLeader(lcUserEmail) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const teamsSheet = ss.getSheetByName(BLOCK_CONFIG.MASTER_SHEET.TEAMS_SHEET);
  if (!teamsSheet) return false;
  const teamsData = teamsSheet.getDataRange().getValues();
  const tCols = BLOCK_CONFIG.MASTER_SHEET.TEAMS_COLUMNS;
  for (let i = 1; i < teamsData.length; i++) {
    if (teamsData[i][tCols.IS_ACTIVE] && teamsData[i][tCols.LEADER_EMAIL].toLowerCase() === lcUserEmail) {
      return true;
    }
  }
  return false;
}

// Internal helper: Checks if user is an active player on any active team
function _pm_isPlayer(lcUserEmail) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const playersSheet = ss.getSheetByName(BLOCK_CONFIG.MASTER_SHEET.PLAYERS_SHEET);
  if (!playersSheet) return false;
  const playersData = playersSheet.getDataRange().getValues();
  const pCols = BLOCK_CONFIG.MASTER_SHEET.PLAYERS_COLUMNS;

  const teamsSheet = ss.getSheetByName(BLOCK_CONFIG.MASTER_SHEET.TEAMS_SHEET);
  if (!teamsSheet) return false; 
  const teamsData = teamsSheet.getDataRange().getValues();
  const tCols = BLOCK_CONFIG.MASTER_SHEET.TEAMS_COLUMNS;

  for (let i = 1; i < playersData.length; i++) {
    if (playersData[i][pCols.GOOGLE_EMAIL].toLowerCase() === lcUserEmail && playersData[i][pCols.IS_ACTIVE]) {
      const team1Id = playersData[i][pCols.TEAM1_ID];
      if (team1Id) {
        const team1 = teamsData.find(tRow => tRow[tCols.TEAM_ID] === team1Id && tRow[tCols.IS_ACTIVE]);
        if (team1) return true;
      }
      const team2Id = playersData[i][pCols.TEAM2_ID];
      if (team2Id) {
        const team2 = teamsData.find(tRow => tRow[tCols.TEAM_ID] === team2Id && tRow[tCols.IS_ACTIVE]);
        if (team2) return true;
      }
    }
  }
  return false;
}

// =============================================================================
// PERMISSION CHECKING & ENFORCEMENT
// =============================================================================

/**
 * Unified function to check if a user has a specific permission.
 * @param {string} userEmail - The user's email.
 * @param {string} requiredPermission - The permission string to check (from PERMISSIONS constants).
 * @param {string} [teamId] - Optional teamId if permission is team-specific.
 * @return {boolean} True if the user has the permission, false otherwise.
 */
function userHasPermission(userEmail, requiredPermission, teamId = null) {
  const CONTEXT = "PermissionManager.userHasPermission";
  
  // 🔓 DEBUG BYPASS: Check if permissions are disabled for testing
  try {
    const debugBypass = PropertiesService.getDocumentProperties().getProperty('DEBUG_BYPASS_PERMISSIONS');
    if (debugBypass === 'true') {
      Logger.log(`${CONTEXT}: 🔓 DEBUG BYPASS ACTIVE - granting permission '${requiredPermission}' to ${userEmail}`);
      return true;
    }
  } catch (e) {
    // If property service fails, continue with normal permission checks
  }
  
  if (!userEmail || !requiredPermission) {
    Logger.log(`${CONTEXT}: Missing userEmail or requiredPermission.`);
    return false;
  }
  const userRole = getUserRole(userEmail); // Uses this file's unified, cached version

  if (userRole === ROLES.ADMIN) {
    let isDefinedPermission = false;
    for (const key in PERMISSIONS) {
      if (PERMISSIONS[key] === requiredPermission) {
        isDefinedPermission = true;
        break;
      }
    }
    if (isDefinedPermission) {
      // Logger.log(`${CONTEXT}: Admin ${userEmail} GRANTED defined permission '${requiredPermission}'.`);
      return true;
    } else {
      Logger.log(`${CONTEXT}: Admin ${userEmail} DENIED unrecognized/undefined permission string '${requiredPermission}'. This permission string may need to be added to the PERMISSIONS constant.`);
      return false;
    }
  }

  if (userRole === ROLES.TEAM_LEADER) {
    if (requiredPermission === PERMISSIONS.EDIT_OWN_TEAM_DETAILS ||
        requiredPermission === PERMISSIONS.MANAGE_OWN_TEAM_LOGO ||
        requiredPermission === PERMISSIONS.REMOVE_PLAYER_FROM_OWN_TEAM) {
      if (!teamId) {
          Logger.log(`${CONTEXT}: TeamID required for permission '${requiredPermission}' for leader ${userEmail}. Denied.`);
          return false; 
      }
      const teamData = getTeamData(teamId); // Global from TeamDataManager.js
      return teamData && teamData.isActive && teamData.leaderEmail.toLowerCase() === userEmail.toLowerCase();
    }
    if ([PERMISSIONS.VIEW_TEAM_SCHEDULE, PERMISSIONS.UPDATE_OWN_AVAILABILITY, 
         PERMISSIONS.EDIT_OWN_PLAYER_PROFILE_FOR_TEAM, PERMISSIONS.LEAVE_TEAM
        ].includes(requiredPermission)) {
      if (teamId) return isPlayerOnTeam(userEmail, teamId); // Global from PlayerDataManager.js
      return true; 
    }
  }

  if (userRole === ROLES.PLAYER) {
     if ([PERMISSIONS.VIEW_TEAM_SCHEDULE, PERMISSIONS.UPDATE_OWN_AVAILABILITY,
          PERMISSIONS.EDIT_OWN_PLAYER_PROFILE_FOR_TEAM, PERMISSIONS.LEAVE_TEAM
         ].includes(requiredPermission)) {
       if (teamId) return isPlayerOnTeam(userEmail, teamId); // Global from PlayerDataManager.js
       return true; 
     }
  }
  
  if ([ROLES.GUEST, ROLES.PLAYER, ROLES.TEAM_LEADER, ROLES.ADMIN].includes(userRole)) {
    if (requiredPermission === PERMISSIONS.GET_USER_CONTEXT || 
        requiredPermission === PERMISSIONS.VIEW_PUBLIC_TEAMS) {
        return true;
    }
    if (userRole !== ROLES.GUEST && 
        (requiredPermission === PERMISSIONS.CREATE_TEAM ||
         requiredPermission === PERMISSIONS.JOIN_TEAM_WITH_CODE)) {
        return true;
    }
  }
  
  // Logger.log(`${CONTEXT}: User ${userEmail} (Role: ${userRole}) denied permission '${requiredPermission}' (TeamContext: ${teamId || 'N/A'}).`);
  return false; 
}

function enforcePermission(userEmail, permission, teamId = null, operationName = "Operation") {
  if (!userHasPermission(userEmail, permission, teamId)) {
    const role = getUserRole(userEmail);
    const errorMessage = `Access Denied for ${operationName}: User ${userEmail} (Role: ${role}) lacks '${permission}'${teamId ? ` for team ${teamId}` : ''}.`;
    Logger.log(errorMessage);
    throw new Error(errorMessage); 
  }
}

// =============================================================================
// UI CONTEXT & AUTHORIZATION HELPERS
// =============================================================================
function getUserUIContext(userEmail) {
  const CONTEXT = "PermissionManager.getUserUIContext";
  try {
    if (!userEmail) return getGuestUIContext(); 

    const activeUser = getActiveUser(); 
    if (!activeUser || activeUser.getEmail().toLowerCase() !== userEmail.toLowerCase()) {
        return getGuestUIContext();
    }
    
    const role = getUserRole(userEmail); 
    const teams = getUserTeams(userEmail);
    const displayName = getUserDisplayName(userEmail);
    const playerData = getPlayerDataByEmail(userEmail);
    
    // === START: ADDED FAVORITES LOGIC ===
    let favorites = [];
    try {
        const scriptDbId = PropertiesService.getScriptProperties().getProperty(BLOCK_CONFIG.PROPERTY_KEYS.DATABASE_ID);
        const userFavoritesRaw = PropertiesService.getUserProperties().getProperty(BLOCK_CONFIG.PROPERTY_KEYS.USER_FAVORITES);

        if (userFavoritesRaw) {
            const userFavoritesParsed = JSON.parse(userFavoritesRaw);
            // Relevancy Check: Ensure favorites are for this specific database instance
            if (userFavoritesParsed.databaseId === scriptDbId) {
                favorites = userFavoritesParsed.teams || [];
            } else {
                // Stale favorites from a different database, clear them
                PropertiesService.getUserProperties().deleteProperty(BLOCK_CONFIG.PROPERTY_KEYS.USER_FAVORITES);
            }
        }
    } catch (e) {
        Logger.log(`Error reading user favorites for ${userEmail}: ${e.message}`);
        favorites = []; // Default to empty list on error
    }
    // === END: ADDED FAVORITES LOGIC ===

    const context = {
      isAuthenticated: role !== ROLES.GUEST,
      userEmail: userEmail,
      displayName: displayName,
      discordUsername: playerData ? playerData.discordUsername : null,
      role: role,
      teams: teams || [], 
      favorites: favorites, // <-- ADDED
      canCreateTeams: userHasPermission(userEmail, PERMISSIONS.CREATE_TEAM),
      canJoinTeams: userHasPermission(userEmail, PERMISSIONS.JOIN_TEAM_WITH_CODE),
      canViewSystemStats: userHasPermission(userEmail, PERMISSIONS.VIEW_SYSTEM_STATS), 
      canManageAllTeams: userHasPermission(userEmail, PERMISSIONS.MANAGE_ALL_TEAMS),
      isLeaderOfAnyTeam: teams.some(team => team.role === ROLES.TEAM_LEADER),
      maxTeamsReached: teams.length >= BLOCK_CONFIG.TEAM_SETTINGS.MAX_TEAMS_PER_PLAYER
    };
    return context;
  } catch (e) {
    Logger.log(`Error in ${CONTEXT} for ${userEmail}: ${e.message}`);
    return getGuestUIContext(); 
  }
}

function getGuestUIContext() {
  return {
    isAuthenticated: false, userEmail: null, displayName: "Guest", role: ROLES.GUEST, teams: [],
    canCreateTeams: userHasPermission(null, PERMISSIONS.CREATE_TEAM), 
    canJoinTeams: userHasPermission(null, PERMISSIONS.JOIN_TEAM_WITH_CODE),
    canViewSystemStats: false, canManageAllTeams: false, isLeaderOfAnyTeam: false, maxTeamsReached: true
  };
}

function authorizeAvailabilityUpdate(userEmail, teamId) {
    if (userHasPermission(userEmail, PERMISSIONS.MANAGE_ALL_TEAMS)) { 
        return { hasPermission: true, reason: "Admin access." };
    }
    if (userHasPermission(userEmail, PERMISSIONS.UPDATE_OWN_AVAILABILITY, teamId)) {
        if (isPlayerOnTeam(userEmail, teamId)) { // Global from PlayerDataManager.js
             return { hasPermission: true, reason: "Team member access." };
        } else {
            return { hasPermission: false, reason: "Not a member of this team."};
        }
    }
    return { hasPermission: false, reason: "No permission to update availability for this team." };
}

// =============================================================================
// CACHING & PERFORMANCE
// =============================================================================
function cacheUserRole(userEmail, role) {
  try {
    const cache = CacheService.getScriptCache();
    if (cache) {
        const cacheKey = `user_role_${userEmail.toLowerCase()}`;
        cache.put(cacheKey, role, 300); 
    }
  } catch (e) { Logger.log(`PermissionManager.cacheUserRole: Error caching role for ${userEmail}: ${e.message}`); }
}

function getCachedUserRole(userEmail) {
  try {
    const cache = CacheService.getScriptCache();
    if (cache) {
        const cacheKey = `user_role_${userEmail.toLowerCase()}`;
        return cache.get(cacheKey);
    }
    return null;
  } catch (e) { Logger.log(`PermissionManager.getCachedUserRole: Error getting cached role for ${userEmail}: ${e.message}`); return null; }
}

function clearUserRoleCache(userEmail) {
  try {
    const cache = CacheService.getScriptCache();
    if (cache) {
        const cacheKey = `user_role_${userEmail.toLowerCase()}`;
        cache.remove(cacheKey);
        Logger.log(`PermissionManager.clearUserRoleCache: Cleared role cache for ${userEmail}`);
    }
  } catch (e) { Logger.log(`PermissionManager.clearUserRoleCache: Error clearing cache for ${userEmail}: ${e.message}`); }
}