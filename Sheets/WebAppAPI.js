/**
 * Schedule Manager - Web App API (Phase 1D Refactor)
 *
 * @version 1.3.0 (2025-06-12) - Added delta sync API endpoints for real-time updates
 * @version 1.2.0 (2025-06-10) - Added SSR endpoint foundation
 * @version 1.1.1 (2025-05-30) - Phase 1D Refactor (Permissions Updated)
 *
 * Description: Extended API functions for web app frontend.
 * Uses centralized ROLES/PERMISSIONS and functions from PermissionManager.js and PlayerDataManager.js.
 *
 * CHANGELOG:
 * 1.3.0 - 2025-06-12 - Added api_getScheduleChanges, api_batchCheckForChanges, api_warmCacheForTeams for delta sync.
 * 1.2.0 - 2025-06-10 - Added api_getPreRenderedScheduleGrids foundation for server-side rendering.
 * 1.1.1 - 2025-05-30 - Updated to use PermissionManager & PlayerDataManager for user context/permissions.
 * 1.1.0 - 2025-05-30 - Phase 1C: Added logo management endpoints and enhanced validation.
 * 1.0.0 - 2025-05-29 - Initial implementation.
 */

// ROLES and PERMISSIONS are now global constants defined in PermissionManager.js

// =============================================================================
// USER CONTEXT & STATUS APIS
// =============================================================================

/**
 * Gets user context for the frontend template.
 * This is typically called by WebAppController.doGet -> getUserContextForTemplate.
 * @return {Object|null} User context or null.
 */

// In WebAppAPI.js

function getUserContext() {
  const CONTEXT = "WebAppAPI.getUserContext";
  try {
    const activeUser = getActiveUser();
    if (!activeUser) {
      return getGuestUIContext();
    }
    const userEmail = activeUser.getEmail();
    const uiContext = getUserUIContext(userEmail); 

    // If the user is on at least one team, fetch the schedule for the first team.
    if (uiContext.teams && uiContext.teams.length > 0) {
        const activeTeamId = uiContext.teams[0].teamId;
        
        // --- THIS IS THE MODIFIED LOGIC ---
        // Calculate the start and end weeks to fetch all 4 weeks at once.
        const now = new Date();
        const futureDate = new Date();
        futureDate.setDate(now.getDate() + 21); // 3 weeks (0, 1, 2, 3) into the future

        const startYear = now.getFullYear();
        const startWeek = getISOWeekNumber(now); 
        const endYear = futureDate.getFullYear();
        const endWeek = getISOWeekNumber(futureDate);
        // --- END OF MODIFIED LOGIC ---

        // Get data for all 4 weeks in a single call
        const scheduleResult = getTeamScheduleRange(userEmail, activeTeamId, startYear, startWeek, endYear, endWeek);
        
        if (scheduleResult.success) {
            // Attach the full 4-week schedule data to the context object
            uiContext.schedule = scheduleResult;
        }
    }
    
    return uiContext;
  } catch (e) {
    Logger.log(`Error in ${CONTEXT}: ${e.message}`);
    return getGuestUIContext(); 
  }
}

/**
 * Gets user's current status and recommendations.
 * @return {Object} User status and recommendations.
 */
function getUserStatus() {
  const CONTEXT = "WebAppAPI.getUserStatus";
  try {
    const activeUser = PermissionManager.getActiveUser();
    if (!activeUser) {
      return createSuccessResponse({ // createSuccessResponse from Configuration.js
        isAuthenticated: false,
        recommendations: [
          "Log in with your Google account to get started.",
          "Join a team or create your own.",
          "Coordinate availability with your teammates."
        ]
      });
    }
    
    const userEmail = activeUser.getEmail();
    const context = PermissionManager.getUserUIContext(userEmail); // Use PermissionManager
    const recommendations = [];
    
    if (context.teams.length === 0) {
      if(context.canCreateTeams) recommendations.push("Create a new team and invite others.");
      if(context.canJoinTeams) recommendations.push("Join your first team using a join code.");
    } else if (context.teams.length < BLOCK_CONFIG.TEAM_SETTINGS.MAX_TEAMS_PER_PLAYER) {
      if(context.canJoinTeams) recommendations.push(`You can join up to ${BLOCK_CONFIG.TEAM_SETTINGS.MAX_TEAMS_PER_PLAYER} teams total.`);
      recommendations.push("Check your team's availability regularly.");
      if (context.isLeaderOfAnyTeam) {
        recommendations.push("Share your team's join code with new members.");
      }
    } else {
      recommendations.push(`You're in the maximum number of teams (${BLOCK_CONFIG.TEAM_SETTINGS.MAX_TEAMS_PER_PLAYER}).`);
      recommendations.push("Keep your availability updated for all your teams.");
    }
    
    return createSuccessResponse({
      isAuthenticated: true,
      user: {
        email: userEmail,
        displayName: context.displayName, // From PlayerDataManager via PermissionManager.getUserUIContext
        role: context.role
      },
      teams: context.teams, // From PlayerDataManager via PermissionManager.getUserUIContext
      teamCount: context.teams.length,
      isLeader: context.isLeaderOfAnyTeam,
      leaderTeams: context.teams.filter(team => team.role === ROLES.TEAM_LEADER), // ROLES from PermissionManager
      canJoinMoreTeams: !context.maxTeamsReached,
      recommendations: recommendations
    });
    
  } catch (e) {
    return handleError(e, CONTEXT); // from Configuration.js
  }
}

/**
 * Updates user's global display name.
 * @param {string} newDisplayName - New display name.
 * @return {Object} Update result.
 */
function updateUserDisplayName(newDisplayName) {
  const CONTEXT = "WebAppAPI.updateUserDisplayName";
  try {
    const activeUser = PermissionManager.getActiveUser();
    if (!activeUser) {
      return createErrorResponse("Authentication required.");
    }
    const userEmail = activeUser.getEmail();

    const validation = PlayerDataManager.validatePlayerDisplayName(newDisplayName); // Use PlayerDataManager's validation
    if (!validation.isValid) {
        return createErrorResponse(`Invalid display name: ${validation.errors.join(', ')}`);
    }
    
    // PlayerDataManager.updatePlayer handles permission for self-update of displayName
    const result = PlayerDataManager.updatePlayer(userEmail, { displayName: newDisplayName.trim() }, userEmail);
    
    if (result.success) {
      PermissionManager.clearUserRoleCache(userEmail); // Display name might affect UI context if fetched fresh
    }
    return result;
  } catch (e) {
    return handleError(e, CONTEXT);
  }
}

/**
 * Refreshes user session (clears caches) and returns fresh UI context.
 * @return {Object} Refresh result with new context.
 */
function refreshUserSession() {
  const CONTEXT = "WebAppAPI.refreshUserSession";
  try {
    const activeUser = PermissionManager.getActiveUser();
    if (!activeUser) {
      return createErrorResponse("Authentication required.");
    }
    const userEmail = activeUser.getEmail();
    
    PermissionManager.clearUserRoleCache(userEmail);
    // Optional: Clear other caches if they exist and are user-specific
    
    const freshContext = PermissionManager.getUserUIContext(userEmail);
    
    return createSuccessResponse({
      message: "Session refreshed successfully.",
      context: freshContext 
    });
    
  } catch (e) {
    return handleError(e, CONTEXT);
  }
}

/**
 * This is the "logic" function with the correct 'api_' prefix.
 */
function api_kickPlayerAndRegenerateCode(teamId, playerToKickEmail) {
  const CONTEXT = "WebAppAPI.kickPlayerAndRegenerateCode";
  try {
    const activeUser = getActiveUser();
    if (!activeUser) {
      return createErrorResponse("Authentication required.");
    }
    const leaderEmail = activeUser.getEmail();

    const kickResult = kickPlayerFromTeam(teamId, playerToKickEmail, leaderEmail);

    if (!kickResult.success) {
      return kickResult;
    }

    const regenResult = regenerateJoinCode(teamId, leaderEmail);

    if (!regenResult.success) {
      Logger.log(`CRITICAL: ${CONTEXT} - Player ${playerToKickEmail} was removed from ${teamId}, but failed to regenerate join code: ${regenResult.message}`);
      return createErrorResponse(`Player was removed, but a server error prevented join code regeneration. Please regenerate it manually.`);
    }

    return createSuccessResponse({
        newJoinCode: regenResult.newJoinCode
    }, `Player removed successfully. The new team join code is: ${regenResult.newJoinCode}`);

  } catch (e) {
    return handleError(e, CONTEXT);
  }
}

// Add this function to WebAppAPI.js
function api_getTeamData(teamId) {
  const CONTEXT = "WebAppAPI.api_getTeamData";
  try {
    const teamData = getTeamData(teamId); // This function already exists in TeamDataManager.js
    if (!teamData) {
      return createErrorResponse("Team not found.");
    }
    return createSuccessResponse({ team: teamData });
  } catch (e) {
    return handleError(e, CONTEXT);
  }
}

/**
 * Updates the current user's global profile (DisplayName and DiscordUsername).
 * @param {object} profileData An object containing displayName and/or discordUsername.
 * @return {object} The result of the update operation.
 */
function apiUpdateMyProfile(profileData) {
  const CONTEXT = "WebAppAPI.apiUpdateMyProfile";
  try {
    const activeUser = getActiveUser();
    if (!activeUser) {
      return createErrorResponse("Authentication required to update profile.");
    }
    const userEmail = activeUser.getEmail();

    // Validate incoming data
    if (!profileData || typeof profileData !== 'object') {
      return createErrorResponse("Invalid profile data provided.");
    }

    const updates = {};
    if (profileData.hasOwnProperty('displayName')) {
      const nameValidation = validatePlayerDisplayName(profileData.displayName);
      if (!nameValidation.isValid) {
        return createErrorResponse(`Invalid display name: ${nameValidation.errors.join(', ')}`);
      }
      updates.displayName = profileData.displayName;
    }

    if (profileData.hasOwnProperty('discordUsername')) {
      // Basic validation for Discord username (can be enhanced later if needed)
      if (typeof profileData.discordUsername !== 'string') {
        return createErrorResponse("Invalid Discord username format.");
      }
      updates.discordUsername = profileData.discordUsername;
    }

    if (Object.keys(updates).length === 0) {
      return createSuccessResponse({ noChanges: true }, "No new profile information was provided to update.");
    }

    // Call the core PlayerDataManager function to perform the update
    return updatePlayer(userEmail, updates, userEmail);

  } catch (e) {
    return handleError(e, CONTEXT);
  }
}

// =============================================================================
// TEAM RELATED APIS
// =============================================================================

/**
 * Validates join code before attempting to join, providing a team preview.
 * @param {string} joinCode - Join code to validate.
 * @return {Object} Validation result with team preview.
 */
function validateJoinCodeForPreview(joinCode) {
  const CONTEXT = "WebAppAPI.validateJoinCodeForPreview";
  try {
    if (!joinCode || joinCode.trim() === '') {
      return createErrorResponse("Join code is required.");
    }
    
    // TeamDataManager.validateJoinCode already checks for active, not full.
    const validationResult = TeamDataManager.validateJoinCode(joinCode.trim()); // From TeamDataManager.js
    
    if (validationResult.isValid) {
      const team = validationResult.teamData;
      return createSuccessResponse({
        isValid: true,
        teamData: { // Preview data
          teamName: team.teamName,
          division: team.division,
          currentPlayers: team.playerCount,
          maxPlayers: team.maxPlayers,
          spotsAvailable: team.maxPlayers - team.playerCount,
          logoUrl: team.logoUrl // Include logo for preview
        }
      }, `Found team: ${team.teamName}`);
    } else {
      return createErrorResponse(validationResult.message || "Invalid join code.", { isValid: false });
    }
  } catch (e) {
    return handleError(e, CONTEXT);
  }
}

/**
 * Gets detailed team information.
 * Requires user to be an admin or a member of the team.
 * @param {string} teamId - Team ID.
 * @return {Object} Detailed team information.
 */
function getDetailedTeamInfo(teamId) {
  const CONTEXT = "WebAppAPI.getDetailedTeamInfo";
  try {
    const activeUser = PermissionManager.getActiveUser();
    if (!activeUser) return createErrorResponse("Authentication required.");
    const userEmail = activeUser.getEmail();

    // Permission: Admin or member of the team
    const isAdmin = PermissionManager.userHasPermission(userEmail, PERMISSIONS.MANAGE_ALL_TEAMS);
    const isMember = PlayerDataManager.isPlayerOnTeam(userEmail, teamId); // From PlayerDataManager.js

    if (!isAdmin && !isMember) {
      return createErrorResponse("Access denied: You must be an admin or a member of this team to view its detailed information.");
    }
    
    const teamData = TeamDataManager.getTeamData(teamId); // From TeamDataManager.js
    if (!teamData) {
      return createErrorResponse(`Team not found: ${teamId}`);
    }
    
    const teamPlayersResult = PlayerDataManager.getAllPlayers(false, { teamId: teamId }); // Get active players for this team
    const teamPlayers = teamPlayersResult.success ? teamPlayersResult.players : [];

    // Get user's role specifically within this team
    let userRoleInTeam = null;
    if(isMember) {
        const userTeams = PlayerDataManager.getUserTeams(userEmail);
        const membership = userTeams.find(t => t.teamId === teamId);
        if (membership) userRoleInTeam = membership.role;
    } else if (isAdmin) {
        userRoleInTeam = ROLES.ADMIN; // Admin context for this team
    }
    
    return createSuccessResponse({
      team: teamData, // Full team data object from getTeamData
      players: teamPlayers.map(player => ({ // Map to a simpler structure for frontend if needed
        displayName: player.displayName,
        // Get initials for this specific team from the player's team slots
        initials: player.team1.teamId === teamId ? player.team1.initials : (player.team2.teamId === teamId ? player.team2.initials : 'N/A'),
        roleInTeam: player.team1.teamId === teamId ? player.team1.role : (player.team2.teamId === teamId ? player.team2.role : 'N/A'),
        // joinedDate: player.team1.teamId === teamId ? player.team1.joinDate : (player.team2.teamId === teamId ? player.team2.joinDate : null)
      })),
      userRoleInTeam: userRoleInTeam
    });
    
  } catch (e) {
    return handleError(e, CONTEXT);
  }
}


/**
 * Player leaves a team.
 * @param {string} teamId - Team ID to leave.
 * @return {Object} Leave result.
 */
function leaveTeamById(teamId) { // This is the API function name from original user file
  const CONTEXT = "WebAppAPI.leaveTeamById";
  try {
    const activeUser = PermissionManager.getActiveUser();
    if (!activeUser) return createErrorResponse("Authentication required.");
    const userEmail = activeUser.getEmail();

    // PermissionManager.userHasPermission(userEmail, PERMISSIONS.LEAVE_TEAM, teamId) is checked within PlayerDataManager.leaveTeam
    const result = PlayerDataManager.leaveTeam(userEmail, teamId, userEmail); // Requesting user is self
    
    if (result.success) {
      PermissionManager.clearUserRoleCache(userEmail); // Team membership changed
    }
    return result;
  } catch (e) {
    return handleError(e, CONTEXT);
  }
}

/**
 * Kicks a player and regenerates the team join code in a single atomic action.
 * @param {string} teamId The ID of the team.
 * @param {string} playerToKickEmail The email of the player to be removed.
 * @return {Object} A success response containing the new join code, or an error response.
 */
function kickPlayerAndRegenerateCode(teamId, playerToKickEmail) {
  const CONTEXT = "WebAppAPI.kickPlayerAndRegenerateCode";
  try {
    const activeUser = getActiveUser();
    if (!activeUser) {
      return createErrorResponse("Authentication required.");
    }
    const leaderEmail = activeUser.getEmail();

    // Step 1: Kick the player. This function already contains all necessary permission checks.
    const kickResult = kickPlayerFromTeam(teamId, playerToKickEmail, leaderEmail);

    if (!kickResult.success) {
      // If the kick fails for any reason (e.g., permissions, player not on team), stop and return the error.
      return kickResult;
    }

    // Step 2: If the kick was successful, immediately regenerate the join code.
    const regenResult = regenerateJoinCode(teamId, leaderEmail);

    if (!regenResult.success) {
      // This is an edge case, but we should handle it. The player was kicked, but the code wasn't regenerated.
      Logger.log(`CRITICAL: ${CONTEXT} - Player ${playerToKickEmail} was removed from ${teamId}, but failed to regenerate join code: ${regenResult.message}`);
      return createErrorResponse(`Player was removed, but a server error prevented join code regeneration. Please regenerate it manually.`);
    }

    // Step 3: Return a combined success message with the new join code for the UI.
    return createSuccessResponse({
        newJoinCode: regenResult.newJoinCode
    }, `Player removed successfully. The new team join code is: ${regenResult.newJoinCode}`);

  } catch (e) {
    return handleError(e, CONTEXT);
  }
}

/**
 * Orchestrates creating a new team, adding the creator as the first player/leader,
 * and setting their role.
 * @param {Object} teamData - Basic team data (name, division). leaderEmail will be set to creator.
 * @param {string} creatorEmail - The email of the user creating the team.
 * @param {string} creatorInitials - The initials for the creator for this new team.
 * @param {string} creatorDisplayNameForTeam - The display name for the creator for this new team.
 * @return {Object} Result of the operation.
 */
// In WebAppAPI.js

/**
 * Orchestrates creating a new team, adding the creator as the first player/leader,
 * and setting their role.
 * @param {Object} teamData - Basic team data (name, division). leaderEmail will be set to creator.
 * @param {string} creatorEmail - The email of the user creating the team.
 * @param {string} creatorInitials - The initials for the creator for this new team.
 * @param {string} creatorDisplayNameForTeam - The display name for the creator for this new team.
 * @return {Object} Result of the operation.
 */
// In WebAppAPI.js

/**
 * Orchestrates creating a new team, adding the creator as the first player/leader,
 * and setting their role.
 * @param {Object} teamData - Basic team data (name, division). leaderEmail will be set to creator.
 * @param {string} creatorEmail - The email of the user creating the team.
 * @param {string} creatorInitials - The initials for the creator for this new team.
 * @param {string} creatorDisplayNameForTeam - The display name for the creator for this new team.
 * @return {Object} Result of the operation.
 */
function createNewTeamAndAddLeader(teamData, creatorEmail, creatorInitials, creatorDisplayNameForTeam) {
    const CONTEXT = "WebAppAPI.createNewTeamAndAddLeader";
    try {
        const teamCreationResult = createTeam(teamData, creatorEmail); // Global from TeamDataManager.js
        if (!teamCreationResult.success || !teamCreationResult.team) {
            Logger.log(`${CONTEXT}: Team creation failed: ${teamCreationResult.message}`);
            return teamCreationResult;
        }
        const newTeam = teamCreationResult.team;
        const teamId = newTeam.teamId;
        const joinCode = newTeam.joinCode;

        Logger.log(`${CONTEXT}: Team ${teamId} created. Adding ${creatorEmail} as leader.`);

        const joinResult = joinTeamByCode(creatorEmail, joinCode, creatorDisplayNameForTeam, creatorInitials); // Global from PlayerDataManager.js
        if (!joinResult.success) {
            Logger.log(`${CONTEXT}: Failed to add creator ${creatorEmail} to new team ${teamId} after creation: ${joinResult.message}.`);
            archiveTeam(teamId, BLOCK_CONFIG.ADMIN.SYSTEM_EMAIL); // Global from TeamDataManager.js
            return createErrorResponse(`Failed to set up leader for new team: ${joinResult.message}. The team creation was rolled back.`); // Global
        }
        Logger.log(`${CONTEXT}: Creator ${creatorEmail} added to team ${teamId} player records.`);

        // UPDATED CALL to RENAMED function
        const setLeaderRoleResult = core_adminSetTeamLeader(teamId, creatorEmail, BLOCK_CONFIG.ADMIN.SYSTEM_EMAIL); // Calls renamed function from Administrator.js
        if (!setLeaderRoleResult.success) {
            Logger.log(`${CONTEXT}: Failed to set role for leader ${creatorEmail} for team ${teamId}: ${setLeaderRoleResult.message}.`);
            return createErrorResponse(`Team created and you've joined, but failed to finalize leader role: ${setLeaderRoleResult.message}.`); // Global
        }
        Logger.log(`${CONTEXT}: Role for ${creatorEmail} set to TEAM_LEADER for team ${teamId}.`);

        clearUserRoleCache(creatorEmail); // Global from PermissionManager.js

        return createSuccessResponse({ // Global
            team: newTeam,
            leaderSetup: "Successfully created team and assigned you as leader."
        }, `Team "${newTeam.teamName}" created! You are the leader. Join Code: ${joinCode}`);

    } catch (e) {
        Logger.log(`CRITICAL ERROR in ${CONTEXT}: ${e.message}\nStack: ${e.stack}`);
        return handleError(e, CONTEXT); // Global
    }
}

// =============================================================================
// LOGO MANAGEMENT APIS (Retained, ensure permissions are checked)
// =============================================================================

function uploadTeamLogo(teamId, base64Data, fileName, mimeType) {
  const CONTEXT = "WebAppAPI.uploadTeamLogo";
  try {
    const activeUser = PermissionManager.getActiveUser();
    if (!activeUser) return createErrorResponse("Authentication required.");
    const userEmail = activeUser.getEmail();

    // Permission: Admin or Leader of this specific team
    const canManageLogo = PermissionManager.userHasPermission(userEmail, PERMISSIONS.MANAGE_OWN_TEAM_LOGO, teamId) ||
                          PermissionManager.userHasPermission(userEmail, PERMISSIONS.MANAGE_ALL_TEAMS);
    if (!canManageLogo) {
      return createErrorResponse("Permission denied to upload logo for this team.");
    }
    
    // Logger.log(`${CONTEXT}: Uploading logo for team ${teamId} by ${userEmail}`);
    return LogoService.uploadLogoFile(base64Data, fileName, mimeType, teamId); // from LogoService.js
  } catch (e) {
    return handleError(e, CONTEXT);
  }
}

function updateTeamLogoFromUrl(teamId, logoUrl) {
  const CONTEXT = "WebAppAPI.updateTeamLogoFromUrl";
  try {
    const activeUser = PermissionManager.getActiveUser();
    if (!activeUser) return createErrorResponse("Authentication required.");
    const userEmail = activeUser.getEmail();

    const canManageLogo = PermissionManager.userHasPermission(userEmail, PERMISSIONS.MANAGE_OWN_TEAM_LOGO, teamId) ||
                          PermissionManager.userHasPermission(userEmail, PERMISSIONS.MANAGE_ALL_TEAMS);
    if (!canManageLogo) {
      return createErrorResponse("Permission denied to update logo for this team.");
    }
    
    // Logger.log(`${CONTEXT}: Updating logo from URL for team ${teamId} by ${userEmail}`);
    if (logoUrl && logoUrl.trim()) {
      return LogoService.fetchAndSaveTeamLogo(logoUrl, teamId);
    } else { // Clear logo
      return LogoService.updateTeamLogoUrl(teamId, ""); 
    }
  } catch (e) {
    return handleError(e, CONTEXT);
  }
}

function deleteTeamLogoById(teamId) { // This is the API function name from original user file
  const CONTEXT = "WebAppAPI.deleteTeamLogoById";
  try {
    const activeUser = PermissionManager.getActiveUser();
    if (!activeUser) return createErrorResponse("Authentication required.");
    const userEmail = activeUser.getEmail();

    const canManageLogo = PermissionManager.userHasPermission(userEmail, PERMISSIONS.MANAGE_OWN_TEAM_LOGO, teamId) ||
                          PermissionManager.userHasPermission(userEmail, PERMISSIONS.MANAGE_ALL_TEAMS);
    if (!canManageLogo) {
      return createErrorResponse("Permission denied to delete logo for this team.");
    }
    // Logger.log(`${CONTEXT}: Deleting logo for team ${teamId} by ${userEmail}`);
    return LogoService.deleteTeamLogo(teamId);
  } catch (e) {
    return handleError(e, CONTEXT);
  }
}

function getTeamLogoInfo(teamId) { // This is the API function name from original user file
  const CONTEXT = "WebAppAPI.getTeamLogoInfo";
  try {
    // Publicly viewable or requires team membership/admin? Assume viewable if team is viewable.
    // For simplicity, basic read access for logo URL if team can be identified.
    // More complex permission (like VIEW_TEAM_SCHEDULE) could be added if needed.
    const activeUser = PermissionManager.getActiveUser(); // Check if user is authenticated for consistency
    if (!activeUser) return createErrorResponse("Authentication required to view team details.");

    const logoResult = LogoService.getTeamLogoUrl(teamId);
    if (!logoResult.success) return logoResult;

    // For frontend convenience, generate simple HTML (optional)
    // const htmlResult = LogoService.generateLogoHtml(teamId, { width: "50px", height: "50px", class: "team-logo-preview" });

    return createSuccessResponse({
      teamId: teamId,
      teamName: logoResult.teamName, // getTeamLogoUrl now returns this
      logoUrl: logoResult.logoUrl,
      hasLogo: logoResult.hasLogo,
      // logoHtml: htmlResult.success ? htmlResult.html : `<div class='logo-placeholder'>No Logo</div>`
    });
  } catch (e) {
    return handleError(e, CONTEXT);
  }
}

function validateLogoUrlForFrontend(logoUrl) { // This is the API function name from original user file
    const CONTEXT = "WebAppAPI.validateLogoUrlForFrontend";
    try {
        // No specific user permission needed for mere validation of a URL format/accessibility
        const result = validateLogoUrlAccess(logoUrl); // from Configuration.js
        return createSuccessResponse(result); // Wrap result for consistent API response
    } catch (e) {
        return handleError(e, CONTEXT);
    }
}


// =============================================================================
// AVAILABILITY APIS (Retained, ensure permissions)
// =============================================================================

/**
 * Gets team availability schedule.
 * User must be a member of the team or an admin.
 * @param {string} teamId - Team ID.
 * @param {number} [year] - Optional year.
 * @param {number} [weekNumber] - Optional week number.
 * @return {Object} Team availability data or error.
 */
function apiGetTeamSchedule(teamId, year, weekNumber) {
  const CONTEXT = "WebAppAPI.apiGetTeamSchedule"; 
  try {
    const activeUser = getActiveUser(); 
    if (!activeUser) {
      return createErrorResponse("Authentication required.");
    }
    // CORRECTED: Call the uniquely named function from AvailabilityManager.js
    return am_getTeamSchedule(activeUser.getEmail(), teamId, year, weekNumber); 
  } catch (e) {
    return handleError(e, CONTEXT);
  }
}

/**
 * Updates player's availability for a team.
 * @param {string} teamId - Team ID.
 * @param {string} action - "add" or "remove".
 * @param {Object[]} timeSlots - Array of {row, col} objects.
 * @return {Object} Update result.
 */

// function updatePlayerAvailability(teamId, action, timeSlots) { // OLD NAME & CALL
function updatePlayerAvailability_API(teamId, action, timeSlots) { // NEW NAME
  const CONTEXT = "WebAppAPI.updatePlayerAvailability_API"; // Update context
  try {
    const activeUser = getActiveUser(); // Assumes global from PermissionManager.js
    if (!activeUser) return createErrorResponse("Authentication required."); // Assumes global

    // CORRECTED CALL to renamed service function
    return availabilityManager_updatePlayerAvailability_SERVICE(activeUser.getEmail(), teamId, action, timeSlots);
  } catch (e) {
    return handleError(e, CONTEXT); // Assumes global
  }
}

// =============================================================================
// SERVER-SIDE RENDERING APIS
// =============================================================================

/**
 * Gets pre-rendered HTML for the schedule grids for a given team.
 * This version renders all weeks in the 4-week cache to support instant client-side navigation.
 * @param {string} teamId The ID of the team to render.
 * @return {Object} An object containing the HTML strings and the raw data for caching.
 */
function api_getPreRenderedScheduleGrids(teamId) {
    const CONTEXT = "WebAppAPI.api_getPreRenderedScheduleGrids";
    try {
        const activeUser = getActiveUser();
        if (!activeUser) {
            return createErrorResponse("Authentication required.");
        }
        const userEmail = activeUser.getEmail();

        // Fetch all 4 weeks of data to populate the client's cache.
        const allWeeksToFetch = getAllAvailableWeeks();
        if (allWeeksToFetch.length < 4) {
            return createErrorResponse("Could not calculate the required 4-week range.");
        }
        const firstWeek = allWeeksToFetch[0];
        const lastWeek = allWeeksToFetch[3];

        const scheduleDataResult = getTeamScheduleRange(userEmail, teamId, firstWeek.year, firstWeek.week, lastWeek.year, lastWeek.week);

        if (!scheduleDataResult.success) {
            return scheduleDataResult; // Pass the error through
        }
        
        const scheduleData = scheduleDataResult;
        
        // --- HTML Generation ---
        // Render HTML for all weeks fetched.
        const renderedWeeksHTML = {};
        if (scheduleData.weeks && scheduleData.weeks.length > 0) {
            scheduleData.weeks.forEach((weekData, index) => {
                
                // --- FIX START ---
                // Determine the correct STATIC grid container ID based on the week's position.
                // Weeks at index 0 (Week 1) and 2 (Week 3) go into the top grid container.
                // Weeks at index 1 (Week 2) and 3 (Week 4) go into the bottom grid container.
                const containerId = (index === 0 || index === 2) ? 'week1' : 'week2';
                // --- FIX END ---

                if (weekData && !weekData.error) {
                    const weekKey = `${weekData.year}-W${weekData.weekNumber}`;
                    // Pass the correct static containerId to the HTML generator
                    renderedWeeksHTML[weekKey] = _api_generateGridHTML(containerId, weekData);
                }
            });
        }

        return createSuccessResponse({
            renderedWeeksHTML: renderedWeeksHTML,
            scheduleData: scheduleData // The raw data for client-side caching
        }, "Schedule grids rendered successfully.");

    } catch (e) {
        return handleError(e, CONTEXT);
    }
}

/**
 * Generates the full HTML for a single week's availability grid, including the header and body.
 * This is a private helper function for the server-side rendering API.
 * @param {string} gridId The ID for this grid ('week1' or 'week2').
 * @param {Object} scheduleDataForWeek The schedule data object for a single week, from readWeekBlockData.
 * @return {string} The complete HTML string for the table's thead and tbody.
 */
function _api_generateGridHTML(gridId, scheduleDataForWeek) {
  if (!scheduleDataForWeek || scheduleDataForWeek.error) {
    return `<thead><tr><th class="p-4 text-red-400">Error</th></tr></thead><tbody><tr><td class="p-4 text-red-400">Error loading data for this week.</td></tr></tbody>`;
  }

  // --- Generate Header (thead) ---
  const monday = getMondayFromWeekNumberAndYear(scheduleDataForWeek.year, scheduleDataForWeek.weekNumber);
  let headerHtml = '<thead><tr>';
  headerHtml += '<th class="time-label p-1 w-16 sm:w-20 text-xs font-medium text-slate-400 text-center sticky left-0 bg-slate-800 z-10">Time</th>';
  
  for (let i = 0; i < 7; i++) {
    const dayDate = new Date(monday);
    dayDate.setDate(monday.getDate() + i);
    const dayName = BLOCK_CONFIG.LAYOUT.DAY_ABBREV[i];
    const dateString = `${dayDate.getDate()}`; // Just the number, e.g., "19"
    
    // Add ordinal suffix (st, nd, rd, th)
    let suffix = 'th';
    if (dateString.endsWith('1') && !dateString.endsWith('11')) suffix = 'st';
    else if (dateString.endsWith('2') && !dateString.endsWith('12')) suffix = 'nd';
    else if (dateString.endsWith('3') && !dateString.endsWith('13')) suffix = 'rd';

    const isWeekend = i >= 5;
    const headerTextColor = isWeekend ? 'text-amber-400' : 'text-sky-400';
    
    headerHtml += `<th class="day-header-full p-1 text-xs font-medium ${headerTextColor} text-center bg-slate-700/50 rounded-t-sm cursor-pointer hover:bg-slate-600/50" onclick="selectDayColumn(${i}, '${gridId}')">${dayName} ${dateString}${suffix}</th>`;
  }
  headerHtml += '</tr></thead>';

  // --- Generate Body (tbody) ---
  let bodyHtml = `<tbody id="availability-grid-body-${gridId}">`;
  const timeSlots = scheduleDataForWeek.timeSlots || [];
  
  timeSlots.forEach((time, timeIndex) => {
    bodyHtml += '<tr>';
    bodyHtml += `<td class="time-label p-1 text-xs text-slate-400 text-center font-mono whitespace-nowrap sticky left-0 bg-slate-800 z-10 rounded-l-sm cursor-pointer hover:bg-slate-700" onclick="selectTimeRow(${timeIndex}, '${gridId}')">${time}</td>`;

    if (scheduleDataForWeek.availability && scheduleDataForWeek.availability[timeIndex] && scheduleDataForWeek.availability[timeIndex].days) {
      scheduleDataForWeek.availability[timeIndex].days.forEach((dayData, dayIndex) => {
        const isWeekend = dayIndex >= 5;
        const cellBg = isWeekend ? 'bg-slate-700/30 hover:bg-slate-600/50' : 'bg-slate-700/10 hover:bg-slate-700/30';
        const cellText = (dayData.initials && dayData.initials.length > 0) ? dayData.initials.join(', ') : '';
        const escapedCellText = escapeHTML(cellText); // Use the security utility

        bodyHtml += `<td class="availability-cell ${cellBg} cursor-pointer rounded-sm h-9 sm:h-10 border border-slate-700/50 align-middle${dayIndex === 6 ? ' rounded-r-sm' : ''}" onclick="handleCellClick(${timeIndex}, ${dayIndex}, '${gridId}')"><div class="leading-tight">${escapedCellText}</div></td>`;
      });
    } else {
      // Fallback for malformed data
      for (let i = 0; i < 7; i++) {
        const isWeekend = i >= 5;
        const cellBg = isWeekend ? 'bg-slate-700/30 hover:bg-slate-600/50' : 'bg-slate-700/10 hover:bg-slate-700/30';
        bodyHtml += `<td class="availability-cell ${cellBg} cursor-pointer rounded-sm h-9 sm:h-10 border border-slate-700/50 align-middle${i === 6 ? ' rounded-r-sm' : ''}" onclick="handleCellClick(${timeIndex}, ${i}, '${gridId}')"><div class="leading-tight"></div></td>`;
      }
    }
    bodyHtml += '</tr>';
  });

  bodyHtml += '</tbody>';

  return headerHtml + bodyHtml;
}

// =============================================================================
// UTILITY APIS (Retained, ensure permissions if needed)
// =============================================================================
function getSystemInfo() { // This is the API function name from original user file
  const CONTEXT = "WebAppAPI.getSystemInfo";
  try {
    const activeUser = PermissionManager.getActiveUser();
    const userContext = activeUser ? PermissionManager.getUserUIContext(activeUser.getEmail()) : null;
    
    return createSuccessResponse({
      timestamp: new Date().toISOString(),
      user: userContext ? {
        email: userContext.userEmail,
        role: userContext.role,
        teamCount: userContext.teams.length
      } : { role: ROLES.GUEST }, // ROLES from PermissionManager
      config: { // Expose only safe, relevant config to frontend
        maxTeamsPerPlayer: BLOCK_CONFIG.TEAM_SETTINGS.MAX_TEAMS_PER_PLAYER,
        maxPlayersPerTeam: BLOCK_CONFIG.TEAM_SETTINGS.MAX_PLAYERS_PER_TEAM,
        allowedDivisions: BLOCK_CONFIG.TEAM_SETTINGS.ALLOWED_DIVISIONS,
        version: BLOCK_CONFIG.VERSION,
        logoConfig: {
          maxFileSizeMB: BLOCK_CONFIG.LOGO.MAX_FILE_SIZE_MB,
          allowedTypes: BLOCK_CONFIG.LOGO.ALLOWED_TYPES
        }
      }
    });
  } catch (e) {
    return handleError(e, CONTEXT);
  }
}

// Placeholder for frontend to log client-side errors to server logs
function logFrontendError(errorMessage, errorContext = "FrontendClient") {
    Logger.log(`CLIENT_SIDE_ERROR [${errorContext}]: ${errorMessage}`);
    return createSuccessResponse({}, "Error logged.");
}

// In WebAppAPI.js (add this new function)

// In WebAppAPI.js
function checkForScheduleUpdates(teamId, clientLastLoadTimestampMillis) {
  // Use enhanced version if available
  if (typeof checkForScheduleUpdatesEnhanced === 'function') {
    return checkForScheduleUpdatesEnhanced(teamId, clientLastLoadTimestampMillis);
  }
  
  const CONTEXT = "WebAppAPI.checkForScheduleUpdates";
  try {
    if (!teamId) {
      Logger.log(`[${CONTEXT}] Error: Team ID required.`);
      return { success: false, hasChanged: false, error: "Team ID required." };
    }
    
    const teamData = getTeamData(teamId, true);
    if (!teamData) {
      Logger.log(`[${CONTEXT}] Error: Team ${teamId} not found.`);
      return { success: false, hasChanged: false, error: `Team ${teamId} not found.` };
    }

    const serverLastActiveTimestamp = new Date(teamData.lastActive).getTime();

    if (clientLastLoadTimestampMillis === null || typeof clientLastLoadTimestampMillis === 'undefined') {
      Logger.log(`[${CONTEXT}] Client has no last load timestamp for team ${teamId}. Assuming change.`);
      return { success: true, hasChanged: true, serverTimestamp: serverLastActiveTimestamp };
    }

    if (serverLastActiveTimestamp > clientLastLoadTimestampMillis) {
      Logger.log(`[${CONTEXT}] Team ${teamId} HAS changed. Server: ${serverLastActiveTimestamp}, Client: ${clientLastLoadTimestampMillis}`);
      return { success: true, hasChanged: true, serverTimestamp: serverLastActiveTimestamp };
    } else {
      Logger.log(`[${CONTEXT}] Team ${teamId} has NOT changed. Server: ${serverLastActiveTimestamp}, Client: ${clientLastLoadTimestampMillis}`);
      return { success: true, hasChanged: false, serverTimestamp: serverLastActiveTimestamp };
    }

  } catch (e) {
    Logger.log(`Error in ${CONTEXT} for team ${teamId}: ${e.message}`);
    return { success: false, hasChanged: false, error: `Error checking for updates: ${e.message}` };
  }
}

function apiGetLightweightTeamList() {
  const CONTEXT = "WebAppAPI.apiGetLightweightTeamList";
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const cacheSheet = ss.getSheetByName('SYSTEM_CACHE');
    if (!cacheSheet) return createErrorResponse("System cache not found.");

    const lastRow = cacheSheet.getLastRow();
    if (lastRow < 2) {
      return createSuccessResponse({ teams: [], timestamp: null }, "No teams in cache.");
    }
    
    const data = cacheSheet.getRange(2, 1, lastRow - 1, 6).getValues(); // A:F (including RosterJSON)
    const teams = data.map(row => {
      // Parse roster JSON to find leader
      let leaderName = 'Unknown Leader';
      try {
        const rosterJson = row[5]; // Column F - RosterJSON
        if (rosterJson) {
          const roster = JSON.parse(rosterJson);
          const leader = roster.find(player => player.role === 'team_leader');
          if (leader) {
            leaderName = leader.displayName;
          }
        }
      } catch (e) {
        Logger.log(`${CONTEXT}: Error parsing roster for team ${row[0]}: ${e.message}`);
      }
      
      return {
        teamId: row[0], 
        teamName: row[1], 
        division: row[2], 
        logoUrl: row[3], 
        isPublic: row[4],
        leaderName: leaderName  // Add leader name
      };
    }).filter(team => team.isPublic);

    const timestamp = cacheSheet.getRange('G1').getValue();
    return createSuccessResponse({ teams: teams, timestamp: timestamp });
  } catch (e) {
    return handleError(e, CONTEXT);
  }
}

function apiGetRosterForTeam(teamId) {
  const CONTEXT = "WebAppAPI.apiGetRosterForTeam";
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const cacheSheet = ss.getSheetByName('SYSTEM_CACHE');
    if (!cacheSheet) return createErrorResponse("System cache not found.");
    
    const teamIdsInData = cacheSheet.getRange('A2:A').getValues().flat();
    const rowIndex = teamIdsInData.indexOf(teamId);

    if (rowIndex === -1) return createErrorResponse("Team not found in cache.");

    const rosterJson = cacheSheet.getRange(rowIndex + 2, 6).getValue();
    const roster = JSON.parse(rosterJson || '[]');
    
    return createSuccessResponse({ roster: roster });

  } catch (e) {
    return handleError(e, CONTEXT);
  }
}

function getTeamsLastUpdateTime() {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const cacheSheet = ss.getSheetByName('SYSTEM_CACHE');
    if (!cacheSheet) return null;
    return cacheSheet.getRange('G1').getValue();
  } catch (e) {
    return null;
  }
}

function apiToggleFavoriteTeam(teamId, isFavorite) {
  const CONTEXT = "WebAppAPI.apiToggleFavoriteTeam";
  try {
    const activeUser = getActiveUser();
    if (!activeUser) return createErrorResponse("Authentication required.");

    const scriptDbId = PropertiesService.getScriptProperties().getProperty(BLOCK_CONFIG.PROPERTY_KEYS.DATABASE_ID);
    if (!scriptDbId) return createErrorResponse("Database ID not configured. Cannot save favorites.");
    
    const userProperties = PropertiesService.getUserProperties();
    const userFavoritesRaw = userProperties.getProperty(BLOCK_CONFIG.PROPERTY_KEYS.USER_FAVORITES);
    
    let favoritesData = { databaseId: scriptDbId, teams: [] };
    if (userFavoritesRaw) {
        const parsed = JSON.parse(userFavoritesRaw);
        if (parsed.databaseId === scriptDbId) {
            favoritesData = parsed;
        }
    }

    const favoriteSet = new Set(favoritesData.teams || []);
    if (isFavorite) {
      favoriteSet.add(teamId);
    } else {
      favoriteSet.delete(teamId);
    }
    favoritesData.teams = Array.from(favoriteSet);

    userProperties.setProperty(BLOCK_CONFIG.PROPERTY_KEYS.USER_FAVORITES, JSON.stringify(favoritesData));

    return createSuccessResponse({ favorites: favoritesData.teams }, `Favorites updated.`);

  } catch (e) {
    return handleError(e, CONTEXT);
  }
}

// === HANDOVER TASK: Implement delta sync API endpoints (Phase 2A)

// =============================================================================
// DELTA SYNC API ENDPOINTS
// =============================================================================

/**
 * Gets schedule changes since a given timestamp
 * Returns only what changed to enable delta updates in frontend
 * @param {string} teamId - The team to check
 * @param {number} sinceTimestamp - Client's last known timestamp (milliseconds)
 * @return {Object} Change information with delta data
 */
function api_getScheduleChanges(teamId, sinceTimestamp) {
  const CONTEXT = "WebAppAPI.api_getScheduleChanges";
  try {
    const activeUser = getActiveUser();
    if (!activeUser) return createErrorResponse("Authentication required.");
    
    // Validate inputs
    if (!teamId) {
      return createErrorResponse("Team ID required.");
    }
    
    // Get team metadata to check if there are changes
    const metadata = _cache_getTeamMetadata(teamId);
    if (!metadata || metadata.lastActive <= sinceTimestamp) {
      return createSuccessResponse({
        hasChanges: false,
        serverTimestamp: metadata ? metadata.lastActive : new Date().getTime(),
        metadata: metadata
      });
    }
    
    // Get team data for sheet name and roster info
    const teamData = getTeamData(teamId);
    if (!teamData) {
      return createErrorResponse("Team not found.");
    }
    
    // Determine what type of changes occurred
    const changeType = metadata.lastUpdateType;
    const isOwnChange = metadata.lastUpdatedBy === activeUser.getEmail();
    
    // Build response based on change type
    const response = {
      hasChanges: true,
      changeType: changeType,
      changedBy: metadata.lastUpdatedBy,
      isOwnChange: isOwnChange,
      serverTimestamp: metadata.lastActive,
      version: metadata.version
    };
    
    switch (changeType) {
      case BLOCK_CONFIG.CHANGE_TYPES.AVAILABILITY:
        if (teamData.availabilitySheetName) {
          const cellChanges = _cache_getCellChanges(teamId, teamData.availabilitySheetName);
          if (cellChanges && cellChanges.timestamp > sinceTimestamp) {
            response.changes = cellChanges;
          }
        }
        break;
        
      case BLOCK_CONFIG.CHANGE_TYPES.ROSTER:
        response.rosterChange = metadata.changeDetails;
        response.roster = getTeamRosterFromIndex(teamId);
        break;
        
      case BLOCK_CONFIG.CHANGE_TYPES.TEAM_SETTINGS:
        response.settingsChanged = metadata.changeDetails.updates;
        break;
        
      case BLOCK_CONFIG.CHANGE_TYPES.PLAYER_PROFILE:
        response.profileChange = metadata.changeDetails;
        break;
    }
    
    return createSuccessResponse(response);
    
  } catch (e) {
    return handleError(e, CONTEXT);
  }
}

/**
 * Batch check for changes across multiple teams
 * Useful for checking favorites or all user's teams at once
 * @param {Array<Object>} teamChecks - Array of {teamId, lastTimestamp} objects
 * @return {Object} Summary of which teams have changes
 */
function api_batchCheckForChanges(teamChecks) {
  const CONTEXT = "WebAppAPI.api_batchCheckForChanges";
  try {
    const activeUser = getActiveUser();
    if (!activeUser) return createErrorResponse("Authentication required.");
    
    if (!Array.isArray(teamChecks) || teamChecks.length === 0) {
      return createErrorResponse("Team checks array required.");
    }
    
    const results = [];
    
    for (const check of teamChecks) {
      if (!check.teamId) continue;
      
      const metadata = _cache_getTeamMetadata(check.teamId);
      const hasChanges = metadata && metadata.lastActive > (check.lastTimestamp || 0);
      
      results.push({
        teamId: check.teamId,
        hasChanges: hasChanges,
        changeType: hasChanges ? metadata.lastUpdateType : null,
        serverTimestamp: metadata ? metadata.lastActive : null
      });
    }
    
    return createSuccessResponse({
      checks: results,
      checkedCount: results.length,
      changedCount: results.filter(r => r.hasChanges).length
    });
    
  } catch (e) {
    return handleError(e, CONTEXT);
  }
}

/**
 * Pre-caches data for favorite teams
 * Called on login to warm the cache
 * @param {Array<string>} teamIds - Array of team IDs to pre-cache
 * @return {Object} Cache warming results
 */
function api_warmCacheForTeams(teamIds) {
  const CONTEXT = "WebAppAPI.api_warmCacheForTeams";
  try {
    const activeUser = getActiveUser();
    if (!activeUser) return createErrorResponse("Authentication required.");
    
    if (!Array.isArray(teamIds) || teamIds.length === 0) {
      return createSuccessResponse({ warmedCount: 0 }, "No teams to warm.");
    }
    
    const results = [];
    const userEmail = activeUser.getEmail();
    
    for (const teamId of teamIds) {
      try {
        const teamData = getTeamData(teamId);
        if (teamData) {
          const roster = getTeamRosterFromIndex(teamId);
          const now = getCurrentCETDate();
          const year = now.getFullYear();
          const week = getISOWeekNumber(now);
          const scheduleResult = am_getTeamSchedule(userEmail, teamId, year, week);
          
          results.push({
            teamId: teamId,
            success: true,
            cached: ['teamData', 'roster', 'schedule']
          });
        } else {
          results.push({ teamId: teamId, success: false, reason: 'Team not found' });
        }
      } catch (e) {
        results.push({ teamId: teamId, success: false, reason: e.message });
      }
    }
    
    return createSuccessResponse({
      results: results,
      warmedCount: results.filter(r => r.success).length,
      totalRequested: teamIds.length
    }, `Warmed cache for ${results.filter(r => r.success).length} teams`);
    
  } catch (e) {
    return handleError(e, CONTEXT);
  }
}

/**
 * Enhanced checkForScheduleUpdates with delta sync support
 * @param {string} teamId - Team to check
 * @param {number} clientLastLoadTimestamp - Client's last known timestamp
 * @return {Object} Enhanced change information
 */
function checkForScheduleUpdatesEnhanced(teamId, clientLastLoadTimestamp) {
  const CONTEXT = "WebAppAPI.checkForScheduleUpdatesEnhanced";
  try {
    if (!teamId) {
      return createErrorResponse("Team ID required.");
    }
    
    // Use the new delta sync API
    const deltaResult = api_getScheduleChanges(teamId, clientLastLoadTimestamp);
    
    if (!deltaResult.success) {
      return deltaResult;
    }
    
    // If no changes, return simple response
    if (!deltaResult.hasChanges) {
      return createSuccessResponse({
        hasChanged: false,
        serverTimestamp: deltaResult.serverTimestamp
      });
    }
    
    // Format response for existing frontend compatibility
    const response = {
      hasChanged: true,
      serverTimestamp: deltaResult.serverTimestamp,
      changeType: deltaResult.changeType,
      changedBy: deltaResult.changedBy,
      isOwnChange: deltaResult.isOwnChange
    };
    
    // Add change-specific data
    if (deltaResult.changes) {
      response.changes = deltaResult.changes;
    }
    if (deltaResult.rosterChange) {
      response.rosterChange = deltaResult.rosterChange;
    }
    
    return createSuccessResponse(response);
    
  } catch (e) {
    return handleError(e, CONTEXT);
  }
}

/**
 * NEW FUNCTION
 * Gets the 4-week schedule data for a single, specific team.
 */
function api_getScheduleForTeam(teamId) {
  const CONTEXT = "WebAppAPI.api_getScheduleForTeam";
  try {
    const activeUser = getActiveUser();
    if (!activeUser) return createErrorResponse("Authentication required.");

    const allWeeksToFetch = getAllAvailableWeeks();
    const firstWeek = allWeeksToFetch[0];
    const lastWeek = allWeeksToFetch[3];

    // This reuses our existing robust logic to get a schedule range
    const scheduleResult = getTeamScheduleRange(activeUser.getEmail(), teamId, firstWeek.year, firstWeek.week, lastWeek.year, lastWeek.week);

    return scheduleResult; // Return the whole success/error object
  } catch (e) {
    return handleError(e, CONTEXT);
  }
}