/**
 * Schedule Manager - Configuration System (Web App Edition)
 *
 * @version 2.6.0 (2025-06-12) - Added CACHE config and CHANGE_TYPES for delta sync system
 * @version 2.5.1 (2025-06-10) - Added escapeHTML utility function
 * @version 2.5.0 (2025-05-30) - Phase 1D Major Refactor (Permissions Moved)
 *
 * Description: System-wide configuration for multi-team web application.
 * Core permission and role constants and logic have been moved to PermissionManager.js.
 * Core player data retrieval functions (getUserTeams, getUserDisplayName) moved to PlayerDataManager.js.
 *
 * CHANGELOG:
 * 2.6.0 - 2025-06-12 - Added CACHE config and CHANGE_TYPES for delta sync system
 * 2.5.1 - 2025-06-10 - Added escapeHTML utility function for server-side rendering security.
 * 2.5.0 - 2025-05-30 - Removed ROLES, PERMISSIONS constants, getUserRole, userHasPermission, getUserTeams, getUserDisplayName (moved to respective managers).
 * 2.4.0 - 2025-05-30 - Added ALLOWED_DIVISIONS, MAX_PLAYER_DISPLAY_NAME_LENGTH, MAX_PLAYER_INITIALS_LENGTH. Added MAX_WEEKS_PER_TEAM.
 * 2.3.0 - 2025-05-30 - Added LOGO_URL column to Teams schema, updated Drive configuration.
 */

// =============================================================================
// MASTER CONFIGURATION
// =============================================================================

const BLOCK_CONFIG = {
 
  // VERSION & METADATA
  VERSION: "2.6.0", // Updated version
  ARCHITECTURE: "WEB_APP",
  CREATED: "2025-05-30", 
  PHASE: "1D_REFACTOR_PERMISSIONS", // Reflecting current refactoring stage
  PROPERTY_KEYS: {
    DATABASE_ID: 'databaseId',
    USER_FAVORITES: 'userFavorites'
  },

  // === HANDOVER TASK: Add cache configuration constants (Phase 1A)
  CACHE: {
    DEFAULT_DURATION_SECONDS: 21600, // 6 hours
    PLAYER_DATA_DURATION: 21600,
    TEAM_DATA_DURATION: 21600,
    SCHEDULE_DATA_DURATION: 21600,
    USER_ROLE_DURATION: 21600,
    CELL_CHANGES_DURATION: 300 // 5 minutes for delta tracking
  },

  WEEK_BLOCK_INDEX: {
    SHEET_NAME: 'WEEK_BLOCK_INDEX',
    CACHE_TTL: 21600, // 6 hours in seconds
    CACHE_PREFIX: 'week_location_',
    VALIDATION_ERROR_THRESHOLD: 0.1, // 10% error rate triggers rebuild
    ACTIVE_WEEKS_WINDOW: 4, // Current week + 3 future weeks
    AUTO_REBUILD_ON_ERROR: true
  },

  CHANGE_TYPES: {
    AVAILABILITY: 'availability',
    ROSTER: 'roster',
    TEAM_SETTINGS: 'team_settings',
    PLAYER_PROFILE: 'player_profile',
    UNKNOWN: 'unknown'
  },

  // MASTER SHEET STRUCTURE - Database Schema
  MASTER_SHEET: {
    SPREADSHEET_ID: null, 
    TEAMS_SHEET: "Teams",
    PLAYERS_SHEET: "Players",
    TEAM_TAB_PREFIX: "TEAM_", 
   
    TEAMS_COLUMNS: {
      TEAM_ID: 0,
      TEAM_NAME: 1,
      DIVISION: 2,
      LEADER_EMAIL: 3,
      JOIN_CODE: 4,
      CREATED_DATE: 5,
      LAST_ACTIVE: 6,
      MAX_PLAYERS: 20,
      IS_ACTIVE: 8,
      IS_PUBLIC: 9,
      PLAYER_COUNT: 10,
      PLAYER_LIST: 11,
      INITIALS_LIST: 12,
      AVAILABILITY_SHEET_NAME: 13,
      LOGO_URL: 14,
      LAST_UPDATED_TIMESTAMP: 15
    },
   
    PLAYERS_COLUMNS: {
          PLAYER_ID: 0,
          GOOGLE_EMAIL: 1,
          DISPLAY_NAME: 2,
          CREATED_DATE: 3,
          LAST_SEEN: 4,
          IS_ACTIVE: 5,
          TEAM1_ID: 6,
          // TEAM1_NAME and TEAM1_DIVISION are removed
          TEAM1_INITIALS: 7,
          TEAM1_ROLE: 8,
          TEAM1_JOIN_DATE: 9,
          TEAM2_ID: 10,
          // TEAM2_NAME and TEAM2_DIVISION are removed
          TEAM2_INITIALS: 11,
          TEAM2_ROLE: 12,
          TEAM2_JOIN_DATE: 13,
          DISCORD_USERNAME: 14,
          AVAILABILITY_TEMPLATE: 15
        },
  },
 
  // ROLES & PERMISSIONS are NOW DEFINED in PermissionManager.js
 
  TEAM_SETTINGS: {
    MAX_TEAMS_PER_PLAYER: 2,
    MAX_PLAYERS_PER_TEAM: 20,
    MIN_TEAM_NAME_LENGTH: 3,
    MAX_TEAM_NAME_LENGTH: 50,
    MIN_JOIN_CODE_LENGTH: 6,
    MAX_JOIN_CODE_LENGTH: 10,
    AUTO_CREATE_TEAM_TAB: true,
    JOIN_CODE_PREFIX_LENGTH: 4,
    JOIN_CODE_SUFFIX_LENGTH: 4,
    ALLOWED_DIVISIONS: ["1", "2", "3"],
    MAX_PLAYER_DISPLAY_NAME_LENGTH: 50,
    MAX_PLAYER_INITIALS_LENGTH: 2,
    MAX_WEEKS_PER_TEAM: 4 
  },
 
  TIME: {
    DEFAULT_START: "18:00",
    DEFAULT_END: "23:00",
    INTERVAL_MINUTES: 30,
    TIMEZONE: "CET", 
    STANDARD_TIME_SLOTS: [
      "18:00", "18:30", "19:00", "19:30", "20:00",
      "20:30", "21:00", "21:30", "22:00", "22:30", "23:00"
    ]
  },
 
  LAYOUT: { 
    DAYS_PER_WEEK: 7,
    DAY_ABBREV: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"],
    METADATA_COLUMNS: { 
      YEAR: 0,  
      MONTH: 1, 
      WEEK: 2   
    },
    TIME_COLUMN: 3, 
    DAYS_START_COLUMN: 4, 
    STANDARD_TIME_SLOTS_COUNT: 11,
  },
 
  COLORS: { 
    PRIMARY: "#4285F4", 
    SECONDARY: "#34A853", 
    ACCENT: "#FBBC05",  
    WARNING: "#EA4335", 
    LIGHT_GRAY: "#F1F3F4",
    DARK_GRAY: "#202124",
    SHEET: { 
      WEEKEND: "#FFF2CC", 
      WEEKDAY: "#FFFFFF", 
      DAY_HEADER_BG: "#4A86E8", 
      DAY_HEADER_FG: "#FFFFFF",
      TIME_COLUMN_BG: "#F3F3F3", 
      METADATA_COLUMN_BG: "#EFEFEF", 
      ONE_PLAYER: "#FFCCE5", 
      TWO_TO_THREE_PLAYERS: "#FFFFCC", 
      FOUR_PLUS_PLAYERS: "#CCFFCC"
    }
  },
 
  WEB_APP: {
    TITLE: "Schedule Manager Pro",
    DEFAULT_TEAM_VIEW_WEEKS: 2, 
    API_ENDPOINT_PREFIX: "SM_API_",
    DISCORD_HELP_IMAGE_URL: "https://drive.google.com/uc?id=1a0ydLZEVfQpZyMxccvOI8Hw03gQfHseN"
  },
 
  ADMIN: {
    ADMIN_USERS: ["david.larsen.1981@gmail.com"], // IMPORTANT: Replace with actual admin emails
    SYSTEM_EMAIL: "david.larsen.1981@gmail.com" // For system-initiated actions if any
  },
 
  LOGO: {
    DRIVE_FOLDER_ID: "1V88TOH_9Dkj_2gy2Bw6WjXKJVozDxUDr", 
    MAX_FILE_SIZE_MB: 5,
    ALLOWED_TYPES: ["image/png", "image/jpeg", "image/gif", "image/webp"],
    ALLOWED_EXTENSIONS: ["png", "jpg", "jpeg", "gif", "webp"], 
    DEFAULT_LOGO_URL: "" 
  },

  // CellProtection related settings were in a PROTECTION_CONFIG in CellProtection.js.
  // If any of those need to be globally configurable, they could be moved here.
  // For now, assuming PROTECTION_CONFIG remains local to CellProtection.js
  SETTINGS: { // General system settings from old PROTECTION_CONFIG
      AUTO_PROTECT_NEW_TEAMS: true, // Used by TeamDataManager
      // REMOVE_ALL_EDITORS: true, // This was part of PROTECTION_CONFIG, keep in CellProtection.js
      // WARNING_ONLY: false, // This was part of PROTECTION_CONFIG, keep in CellProtection.js
      // PROTECTION_MESSAGE: "This sheet is protected. Use the web application to make changes." // Keep in CellProtection.js

      // NEW SETTING for color coding:
      APPLY_SHEET_COLOR_CODING: false // Turn off by default for performance
  }
};

// =============================================================================
// GENERIC UTILITY FUNCTIONS (Retained in Configuration.js)
// =============================================================================

function getCurrentTimestamp() {
  return new Date().toISOString();
}

function getCurrentCETDate() {
  return new Date(); 
}

function formatDate(date, format = "YYYY-MM-DD") {
  if (!(date instanceof Date) || isNaN(date.valueOf())) {
    Logger.log(`FormatDate: Invalid date received: ${date}`);
    return ""; 
  }
  const year = date.getFullYear();
  const month = date.getMonth() + 1;
  const day = date.getDate();
 
  if (format === "YYYY-MM-DD") {
    return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  } else if (format === "DD/MM/YYYY") {
    return `${String(day).padStart(2, '0')}/${String(month).padStart(2, '0')}/${year}`;
  } else if (format === "MMMM") {
    const monthNames = ["January", "February", "March", "April", "May", "June", 
                        "July", "August", "September", "October", "November", "December"];
    return monthNames[date.getMonth()];
  } else if (format === "DD/MM") { // New format for day headers
    return `${String(day).padStart(2, '0')}/${String(month).padStart(2, '0')}`;
  } else if (format === "YYYYMMDD") {
    return `${year}${String(month).padStart(2, '0')}${String(day).padStart(2, '0')}`;
  }
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

function getMondayOfWeek(inputDate) {
  const date = inputDate ? new Date(inputDate.valueOf()) : getCurrentCETDate();
  const dayOfWeek = date.getDay(); 
  const diff = date.getDate() - dayOfWeek + (dayOfWeek === 0 ? -6 : 1);
  const monday = new Date(date.setDate(diff));
  monday.setHours(0, 0, 0, 0); 
  return monday;
}

function getISOWeekNumber(dateInput) {
  const date = dateInput ? new Date(dateInput.valueOf()) : getCurrentCETDate();
  date.setHours(0, 0, 0, 0);
  date.setDate(date.getDate() + 3 - (date.getDay() + 6) % 7);
  const week1 = new Date(date.getFullYear(), 0, 4);
  return 1 + Math.round(((date.getTime() - week1.getTime()) / 86400000 - 3 + (week1.getDay() + 6) % 7) / 7);
}

function getMondayFromWeekNumberAndYear(year, weekNumber) {
  const jan4 = new Date(year, 0, 4);
  jan4.setHours(0,0,0,0);
  const jan4DayOfWeek = (jan4.getDay() + 6) % 7; 
  const mondayOfWeek1 = new Date(jan4);
  mondayOfWeek1.setDate(jan4.getDate() - jan4DayOfWeek);
  const targetMonday = new Date(mondayOfWeek1);
  targetMonday.setDate(mondayOfWeek1.getDate() + (weekNumber - 1) * 7);
  targetMonday.setHours(0,0,0,0); 
  return targetMonday; 
}

// =============================================================================
// GENERIC VALIDATION UTILITIES (Retained in Configuration.js)
// =============================================================================

/**
 * Escapes HTML special characters in a string to prevent XSS.
 * @param {string} text The string to escape.
 * @return {string} The escaped string.
 */
function escapeHTML(text) {
  if (text === null || typeof text === 'undefined') return '';
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;');
}

function validateTeamName(teamName) {
  const errors = [];
  const minLength = BLOCK_CONFIG.TEAM_SETTINGS.MIN_TEAM_NAME_LENGTH;
  const maxLength = BLOCK_CONFIG.TEAM_SETTINGS.MAX_TEAM_NAME_LENGTH;
  if (!teamName || typeof teamName !== 'string' || teamName.trim().length === 0) {
    errors.push("Team name is required.");
  } else {
    const trimmedName = teamName.trim();
    if (trimmedName.length < minLength) errors.push(`Team name must be at least ${minLength} characters.`);
    if (trimmedName.length > maxLength) errors.push(`Team name must be no more than ${maxLength} characters.`);
    if (/[^a-zA-Z0-9\s\-_&().']/.test(trimmedName)) errors.push("Team name contains invalid characters.");
  }
  return { isValid: errors.length === 0, errors: errors };
}

function isValidEmail(email) {
  if (!email || typeof email !== 'string') return false;
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email.trim());
}


function isValidInitials(initials) { // Validates format only
  if (!initials || typeof initials !== 'string') return false;
  const exactLength = BLOCK_CONFIG.TEAM_SETTINGS.MAX_PLAYER_INITIALS_LENGTH; // From Configuration.js
  const trimmedInitials = initials.trim().toUpperCase(); // Added to ensure we test the processed version

  if (trimmedInitials.length !== exactLength) return false; // Check length first

  // CORRECTED REGEX: Allow uppercase letters OR numbers
  const initialsRegex = new RegExp(`^[A-Z0-9]{${exactLength}}$`);
  return initialsRegex.test(trimmedInitials); // Test the trimmed, uppercased version
}

function isValidJoinCodeFormat(joinCode) {
  if (!joinCode || typeof joinCode !== 'string') return false;
  const minLength = BLOCK_CONFIG.TEAM_SETTINGS.MIN_JOIN_CODE_LENGTH;
  const maxLength = BLOCK_CONFIG.TEAM_SETTINGS.MAX_JOIN_CODE_LENGTH;
  const code = joinCode.trim().toUpperCase();
  const joinCodeRegex = /^[A-Z0-9]+$/; 
  return code.length >= minLength && code.length <= maxLength && joinCodeRegex.test(code);
}

function validateLogoFile(blob) {
  const errors = [];
  if (!blob) {
    errors.push("No file provided.");
    return { isValid: false, errors: errors };
  }
  const maxSizeBytes = BLOCK_CONFIG.LOGO.MAX_FILE_SIZE_MB * 1024 * 1024;
  const allowedTypes = BLOCK_CONFIG.LOGO.ALLOWED_TYPES;
  if (blob.getBytes().length > maxSizeBytes) errors.push(`File size exceeds ${BLOCK_CONFIG.LOGO.MAX_FILE_SIZE_MB}MB.`);
  if (!allowedTypes.includes(blob.getContentType())) errors.push(`Invalid file type: ${blob.getContentType()}.`);
  return { isValid: errors.length === 0, errors: errors };
}

function validateLogoUrl(url) {
  const errors = [];
  if (url === null || typeof url === 'undefined' || url.trim() === '') {
      return { isValid: true, errors: [] }; 
  }
  if (typeof url !== 'string') {
    errors.push("Logo URL must be a string.");
    return { isValid: false, errors: errors };
  }
  try {
    new URL(url); 
    if (!url.toLowerCase().startsWith("http://") && !url.toLowerCase().startsWith("https://")) {
      errors.push("Logo URL must start with http:// or https://.");
    }
  } catch (e) {
    errors.push("Invalid URL format.");
  }
  return { isValid: errors.length === 0, errors: errors };
}

function validateLogoUrlAccess(url) {
  const validationResult = validateLogoUrl(url);
  if (!validationResult.isValid) return { isAccessible: false, message: validationResult.errors.join(' ') };
  if (url.trim() === '') return {isAccessible: true, message: "Empty URL."};
  try {
    const response = UrlFetchApp.fetch(url, { muteHttpExceptions: true, method: 'HEAD' });
    const responseCode = response.getResponseCode();
    const contentType = response.getHeaders()['Content-Type'] || response.getHeaders()['content-type'] || '';
    if (responseCode === 200) {
      return { isAccessible: true, message: "URL accessible.", isImage: contentType.toLowerCase().startsWith('image/') };
    } else {
      return { isAccessible: false, message: `URL not accessible. Status: ${responseCode}.` };
    }
  } catch (e) {
    return { isAccessible: false, message: `Error accessing URL: ${e.message}` };
  }
}

// =============================================================================
// GENERIC RESPONSE HANDLERS (Retained in Configuration.js)
// =============================================================================
function handleError(error, context = "Unknown") {
  const fileName = error.fileName || "N/A";
  const lineNumber = error.lineNumber || "N/A";
  const errorMessage = `${context}: ${error.message} (File: ${fileName}, Line: ${lineNumber})`;
  Logger.log(`ERROR - ${errorMessage}\nStack: ${error.stack || "No stack available"}`);
  return {
    success: false,
    message: `Operation failed in ${context}. ${error.message}`,
    error: errorMessage,
    timestamp: getCurrentTimestamp()
  };
}

function safeExecute(fn, context) {
  try {
    return fn();
  } catch (e) {
    return handleError(e, context);
  }
}

function createSuccessResponse(data = {}, message = "Operation successful") {
  return {
    success: true,
    message: message,
    timestamp: getCurrentTimestamp(),
    ...data 
  };
}

function createErrorResponse(message, details = {}) {
  return {
    success: false,
    message: message,
    timestamp: getCurrentTimestamp(),
    ...details 
  };
}

function clearMyTestAdminRoleCache() {
  try {
    // Call the global function directly, assuming it's defined in PermissionManager.js
    clearUserRoleCache("david.larsen.1981@gmail.com"); 
    Logger.log("Attempted to clear role cache for david.larsen.1981@gmail.com. Check PermissionManager logs for confirmation if any.");
    SpreadsheetApp.getActiveSpreadsheet().toast("Attempted to clear admin role cache.", "Cache Cleared", 5);
  } catch (e) {
    Logger.log(`Error in clearMyTestAdminRoleCache: ${e.message}. This might happen if PermissionManager.js or clearUserRoleCache isn't loaded/defined yet.`);
    SpreadsheetApp.getUi().alert("Error", `Could not clear cache: ${e.message}. Ensure PermissionManager.js is saved and the function exists.`);
  }
}

// Add this function to your Configuration.js for debugging cache issues
function clearAllCaches() {
  const CONTEXT = "Configuration.clearAllCaches";
  try {
    // Clear script cache
    const scriptCache = CacheService.getScriptCache();
    if (scriptCache) {
      // Get all cache keys that start with common prefixes
      const cacheKeyPrefixes = ['scheduleData_', 'userRole_', 'teamData_'];
      
      // Note: Apps Script doesn't provide a way to list all keys,
      // so you'll need to clear specific keys or use cache.removeAll()
      // if you want to clear everything
      
      Logger.log(`${CONTEXT}: Attempting to clear all caches`);
      
      // Clear all cache (nuclear option - use carefully)
      // scriptCache.removeAll();
      
      // Or clear specific patterns if you know the keys
      // Example: Remove user role caches for all known users
      const adminUsers = BLOCK_CONFIG.ADMIN.ADMIN_USERS || [];
      adminUsers.forEach(email => {
        const userRoleKey = `userRole_${email}`;
        scriptCache.remove(userRoleKey);
        Logger.log(`${CONTEXT}: Cleared cache for key: ${userRoleKey}`);
      });
      
      Logger.log(`${CONTEXT}: Cache clearing completed`);
      return createSuccessResponse({}, "Caches cleared successfully");
    }
    
    return createErrorResponse("Cache service not available");
  } catch (e) {
    Logger.log(`Error in ${CONTEXT}: ${e.message}`);
    return handleError(e, CONTEXT);
  }
}

// Function to clear specific team schedule caches
function clearTeamScheduleCache(teamId) {
  const CONTEXT = "Configuration.clearTeamScheduleCache";
  try {
    const cache = CacheService.getScriptCache();
    if (!cache) return createErrorResponse("Cache service not available");
    
    const teamData = getTeamData(teamId);
    if (!teamData) return createErrorResponse(`Team ${teamId} not found`);
    
    const sheetName = teamData.availabilitySheetName;
    if (!sheetName) return createErrorResponse("No sheet name found for team");
    
    // Clear cache for multiple weeks (you may need to adjust the range)
    const currentYear = new Date().getFullYear();
    const ranges = [
      { year: currentYear - 1, weeks: Array.from({length: 52}, (_, i) => i + 1) },
      { year: currentYear, weeks: Array.from({length: 52}, (_, i) => i + 1) },
      { year: currentYear + 1, weeks: Array.from({length: 52}, (_, i) => i + 1) }
    ];
    
    let clearedCount = 0;
    ranges.forEach(range => {
      range.weeks.forEach(week => {
        const cacheKey = `scheduleData_${sheetName}_${range.year}_W${week}`;
        cache.remove(cacheKey);
        clearedCount++;
      });
    });
    
    Logger.log(`${CONTEXT}: Cleared ${clearedCount} cache entries for team ${teamId}`);
    return createSuccessResponse({ clearedEntries: clearedCount }, `Cleared ${clearedCount} cache entries`);
    
  } catch (e) {
    return handleError(e, CONTEXT);
  }
}

/**
 * Gets the four-week block (current + 3 future) for client-side caching.
 * @return {Array<Object>} An array of four week objects, e.g., [{year: 2025, week: 24}, ...].
 */
function getAllAvailableWeeks() {
    const now = new Date();
    const weeks = [];
    for (let i = 0; i < 4; i++) {
        const weekDate = new Date(now);
        weekDate.setDate(now.getDate() + (i * 7));
        weeks.push({
            year: weekDate.getFullYear(),
            week: getISOWeekNumber(weekDate)
        });
    }
    return weeks;
}

// === HANDOVER TASK: Add delta sync helper functions (Phase 1A)

/**
 * Formats change details for user-friendly display
 * @param {string} changeType - The type of change (from CHANGE_TYPES)
 * @param {Object} changeDetails - The change details object
 * @param {string} changedByEmail - Email of user who made the change
 * @return {string} Formatted message for display
 */
function formatChangeMessage(changeType, changeDetails, changedByEmail) {
  if (!changeType || !BLOCK_CONFIG.CHANGE_TYPES[changeType]) {
    Logger.log(`Invalid change type provided: ${changeType}`);
    return 'Changes were made to the team';
  }

  const shortName = changedByEmail ? getShortNameFromEmail(changedByEmail) : 'Someone';
  
  try {
    switch (changeType) {
      case BLOCK_CONFIG.CHANGE_TYPES.AVAILABILITY:
        const cellCount = changeDetails?.cellsModified || 'some';
        return `${shortName} updated ${cellCount} availability slots`;
        
      case BLOCK_CONFIG.CHANGE_TYPES.ROSTER:
        if (changeDetails?.action === 'player_joined') {
          return `${changeDetails.playerName || 'A player'} joined the team`;
        } else if (changeDetails?.action === 'player_left') {
          return `${changeDetails.playerName || 'A player'} left the team`;
        } else if (changeDetails?.action === 'player_deactivated') {
          return `${changeDetails.playerName || 'A player'} was deactivated`;
        }
        return `${shortName} updated the roster`;
        
      case BLOCK_CONFIG.CHANGE_TYPES.TEAM_SETTINGS:
        if (changeDetails?.settingType) {
          return `${shortName} updated ${changeDetails.settingType} settings`;
        }
        return `${shortName} updated team settings`;
        
      case BLOCK_CONFIG.CHANGE_TYPES.PLAYER_PROFILE:
        const profilePlayer = changeDetails?.playerName || 'A player';
        const fieldType = changeDetails?.fieldType ? ` (${changeDetails.fieldType})` : '';
        return `${profilePlayer} updated their profile${fieldType}`;
        
      case BLOCK_CONFIG.CHANGE_TYPES.UNKNOWN:
        return `${shortName} made changes to the team`;
        
      default:
        Logger.log(`Unhandled change type: ${changeType}`);
        return `${shortName} made changes to the team`;
    }
  } catch (e) {
    Logger.log(`Error formatting change message: ${e.message}`);
    return 'Changes were made to the team';
  }
}

/**
 * Determines if a change requires immediate UI update
 * @param {string} changeType - The type of change (from CHANGE_TYPES)
 * @param {boolean} isOwnChange - Whether current user made the change
 * @param {string} currentView - Current UI view context (optional)
 * @return {boolean} Whether to update immediately
 */
function requiresImmediateUpdate(changeType, isOwnChange, currentView = null) {
  // Own availability changes don't need refresh (optimistic update handled it)
  if (isOwnChange && changeType === BLOCK_CONFIG.CHANGE_TYPES.AVAILABILITY) {
    return false;
  }
  
  // Own profile changes don't need immediate refresh
  if (isOwnChange && changeType === BLOCK_CONFIG.CHANGE_TYPES.PLAYER_PROFILE) {
    return false;
  }
  
  // All roster changes should trigger updates (affects team display)
  if (changeType === BLOCK_CONFIG.CHANGE_TYPES.ROSTER) {
    return true;
  }
  
  // Team settings always require update
  if (changeType === BLOCK_CONFIG.CHANGE_TYPES.TEAM_SETTINGS) {
    return true;
  }
  
  // Default: update for others' changes
  return !isOwnChange;
}

/**
 * Extracts short name from email address for display
 * @param {string} email - Full email address
 * @return {string} Short display name
 */
function getShortNameFromEmail(email) {
  if (!email || typeof email !== 'string') return 'Someone';
  
  // Extract name part before @ symbol
  const namePart = email.split('@')[0];
  
  // Split on common separators and take first two parts
  const parts = namePart.split(/[._-]/);
  
  if (parts.length >= 2) {
    // First name + last initial (e.g., "john.doe" -> "John D.")
    const firstName = parts[0].charAt(0).toUpperCase() + parts[0].slice(1).toLowerCase();
    const lastInitial = parts[1].charAt(0).toUpperCase();
    return `${firstName} ${lastInitial}.`;
  } else {
    // Just capitalize the single part
    return namePart.charAt(0).toUpperCase() + namePart.slice(1).toLowerCase();
  }
}