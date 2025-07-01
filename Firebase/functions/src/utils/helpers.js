/**
 * Shared helper functions for Cloud Functions
 */

/**
 * Calculate ISO week number for a given date
 * Handles year boundaries correctly
 * @param {Date} date - Date to calculate week number for
 * @returns {number} ISO week number (1-53)
 */
function getISOWeek(date) {
  // Create copy of date to avoid modifying input
  const targetDate = new Date(date.getTime());
  
  // Set to midnight to normalize time
  targetDate.setHours(0, 0, 0, 0);
  
  // Move to Thursday in current week (technical ISO week starts on Monday)
  targetDate.setDate(targetDate.getDate() + 3 - (targetDate.getDay() + 6) % 7);
  
  // Get first week of year (contains Jan 4th)
  const week1 = new Date(targetDate.getFullYear(), 0, 4);
  
  // Calculate week number
  const weekNum = Math.round(((targetDate - week1) / 86400000 - 3 + (week1.getDay() + 6) % 7) / 7);
  
  // Handle edge cases
  if (weekNum === 0) {
    // If week 0, it's the last week of previous year
    const lastWeek = new Date(date.getFullYear() - 1, 11, 28); // Dec 28 is always in last week
    return getISOWeek(lastWeek);
  } else if (weekNum === 53 && new Date(date.getFullYear(), 11, 28).getDay() !== 4) {
    // If week 53 but Dec 28 is not a Thursday, it's week 1 of next year
    return 1;
  }
  
  return weekNum;
}

/**
 * Get current ISO week identifier in format "YYYY-WXX"
 * @returns {string} Week identifier (e.g., "2025-W26")
 */
function getCurrentWeekId() {
  const now = new Date();
  const weekNum = getISOWeek(now);
  
  // Handle year boundary - if it's week 1 and December, use next year
  const year = now.getMonth() === 11 && weekNum === 1 
    ? now.getFullYear() + 1 
    : now.getFullYear();
  
  // Pad week number with leading zero if needed
  const paddedWeek = weekNum.toString().padStart(2, '0');
  
  return `${year}-W${paddedWeek}`;
}

/**
 * Generate a readable event ID for roster events
 * Format: YYYYMMDD-HHMM-teamname-eventtype_XXXX
 * Example: 20250630-2051-slackers-team_created_X7Y9
 * 
 * @param {string} teamName - Name of the team
 * @param {string} eventType - Type of event (e.g., 'team_created', 'player_joined')
 * @returns {string} Human-readable unique event identifier
 */
function generateEventId(teamName, eventType) {
  // Get current date and format as YYYYMMDD-HHMM
  const date = new Date();
  const formattedDate = date.toISOString()
    .slice(0, 16)
    .replace('T', '-')
    .replace(/:/g, '')
    .replace(/-/g, '');
  
  // Clean team name (lowercase, no spaces, max 20 chars)
  const cleanTeamName = teamName.toLowerCase()
    .replace(/[^a-z0-9-]/g, '_') // Replace any non-alphanumeric chars with underscore
    .replace(/_+/g, '_')         // Replace multiple underscores with single
    .replace(/^_|_$/g, '')       // Remove leading/trailing underscores
    .slice(0, 20);               // Limit length
  
  // Clean event type (lowercase, underscores)
  const cleanEventType = eventType.toLowerCase()
    .replace(/[^a-z0-9-]/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '');
  
  // Generate short unique suffix (4 chars)
  const uniqueSuffix = Math.random().toString(36).substr(2, 4).toUpperCase();
  
  return `${formattedDate}-${cleanTeamName}-${cleanEventType}_${uniqueSuffix}`;
}

/**
 * Event type constants for improved event logging system
 */
const EVENT_TYPES = {
  // Team Lifecycle Events
  TEAM_CREATED: 'TEAM_CREATED',
  TEAM_INACTIVE: 'TEAM_INACTIVE', 
  TEAM_ACTIVE: 'TEAM_ACTIVE',
  TEAM_ARCHIVED: 'TEAM_ARCHIVED',
  
  // Player Movement Events
  JOINED: 'JOINED',
  LEFT: 'LEFT',
  KICKED: 'KICKED',
  TRANSFERRED_LEADERSHIP: 'TRANSFERRED_LEADERSHIP'
};

/**
 * Log a team lifecycle event
 * @param {Object} db - Firestore database instance
 * @param {Object} transaction - Firestore transaction (optional)
 * @param {string} eventType - Event type from EVENT_TYPES
 * @param {Object} eventData - Event data
 * @param {string} eventData.teamId - Team ID
 * @param {string} eventData.teamName - Team name
 * @param {string} eventData.userId - User ID (optional for some events)
 * @param {Object} eventData.details - Additional event details
 * @returns {string} Generated event ID
 */
async function logTeamLifecycleEvent(db, transaction, eventType, eventData) {
  const { FieldValue } = require('firebase-admin/firestore');
  const eventId = generateEventId(eventData.teamName, eventType);
  const timestamp = FieldValue.serverTimestamp();
  
  const eventDoc = {
    eventId,
    teamId: eventData.teamId,
    teamName: eventData.teamName,
    type: eventType,
    category: 'TEAM_LIFECYCLE',
    timestamp,
    details: eventData.details || {}
  };
  
  // Add userId if provided
  if (eventData.userId) {
    eventDoc.userId = eventData.userId;
  }
  
  const eventRef = db.collection('eventLog').doc(eventId);
  
  if (transaction) {
    transaction.set(eventRef, eventDoc);
  } else {
    await eventRef.set(eventDoc);
  }
  
  return eventId;
}

/**
 * Log a player movement event
 * @param {Object} db - Firestore database instance
 * @param {Object} transaction - Firestore transaction (optional)
 * @param {string} eventType - Event type from EVENT_TYPES
 * @param {Object} eventData - Event data
 * @param {string} eventData.teamId - Team ID
 * @param {string} eventData.teamName - Team name
 * @param {string} eventData.userId - User ID
 * @param {Object} eventData.player - Player details
 * @param {Object} eventData.details - Additional event details
 * @returns {string} Generated event ID
 */
async function logPlayerMovementEvent(db, transaction, eventType, eventData) {
  const { FieldValue } = require('firebase-admin/firestore');
  const eventId = generateEventId(eventData.teamName, eventType);
  const timestamp = FieldValue.serverTimestamp();
  
  const eventDoc = {
    eventId,
    teamId: eventData.teamId,
    teamName: eventData.teamName,
    type: eventType,
    category: 'PLAYER_MOVEMENT',
    userId: eventData.userId,
    timestamp,
    player: {
      displayName: eventData.player.displayName,
      initials: eventData.player.initials
    },
    details: eventData.details || {}
  };
  
  const eventRef = db.collection('eventLog').doc(eventId);
  
  if (transaction) {
    transaction.set(eventRef, eventDoc);
  } else {
    await eventRef.set(eventDoc);
  }
  
  return eventId;
}

module.exports = {
  getISOWeek,
  getCurrentWeekId,
  generateEventId,
  EVENT_TYPES,
  logTeamLifecycleEvent,
  logPlayerMovementEvent
}; 