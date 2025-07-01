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
 * Generate a unique event ID for roster events
 * Combines timestamp and random string for uniqueness
 * @returns {string} Unique event identifier
 */
function generateEventId() {
  // Convert current timestamp to base36 string
  const timestamp = Date.now().toString(36);
  
  // Add random suffix for additional uniqueness
  const randomSuffix = Math.random().toString(36).substr(2);
  
  return `${timestamp}-${randomSuffix}`;
}

module.exports = {
  getISOWeek,
  getCurrentWeekId,
  generateEventId
}; 