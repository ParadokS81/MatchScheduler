// update.js - Availability update functionality
// TODO: Implement according to Technical PRD Section 5.1

const functions = require('firebase-functions');
const admin = require('firebase-admin');
const { FieldValue } = require("firebase-admin/firestore");
const { EVENT_TYPES, logTeamLifecycleEvent } = require('../utils/helpers');

// Constants
const MAX_SLOTS_PER_REQUEST = 154;  // Exactly 2 weeks (7 days × 11 slots × 2)
const VALID_HOURS = Array.from({ length: 6 }, (_, i) => i + 18); // 18:00-23:00
const VALID_MINUTES = [0, 30]; // Only allow :00 and :30

// Helper function to validate week format and range
const isValidWeek = (weekId) => {
  // Strict format check: YYYY-WXX (e.g., 2024-W01)
  if (!/^\d{4}-W(0[1-9]|[1-4][0-9]|5[0-3])$/.test(weekId)) {
    return false;
  }

  const [yearStr, weekStr] = weekId.split('-W');
  const year = parseInt(yearStr);
  const week = parseInt(weekStr);

  // Get current date in user's timezone (from request)
  const now = new Date();
  
  // Calculate current ISO week
  const currentDate = new Date(now.getTime());
  currentDate.setHours(0, 0, 0, 0);
  currentDate.setDate(currentDate.getDate() + 3 - (currentDate.getDay() + 6) % 7);
  const week1 = new Date(currentDate.getFullYear(), 0, 4);
  const currentWeek = Math.round(((currentDate - week1) / 86400000 - 3 + (week1.getDay() + 6) % 7) / 7);
  const currentYear = currentDate.getFullYear();

  // Validate week range
  if (year < currentYear) return false;
  if (year === currentYear && week < currentWeek) return false;
  if (year === currentYear && week > currentWeek + 3) return false;
  if (year > currentYear + 1) return false;

  return true;
};

// Helper function to validate time slot format and range
const isValidTimeSlot = (slot) => {
  const validDays = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];
  const [day, time] = slot.split('_');
  
  if (!validDays.includes(day)) return false;
  if (!/^\d{4}$/.test(time)) return false;
  
  const hours = parseInt(time.substring(0, 2));
  const minutes = parseInt(time.substring(2));
  
  return VALID_HOURS.includes(hours) && VALID_MINUTES.includes(minutes);
};

exports.updateAvailability = functions.https.onCall(async (data, context) => {
  const db = admin.firestore();
  
  try {
    // 1. Authentication check
    if (!context.auth) {
      throw new functions.https.HttpsError(
        'unauthenticated',
        'You must be logged in to update availability.'
      );
    }

    const userId = context.auth.uid;
    const { teamId, weekId, action, slots } = data;

    // 2. Input validation
    if (!teamId || typeof teamId !== 'string') {
      throw new functions.https.HttpsError(
        'invalid-argument',
        'Team ID is required.'
      );
    }

    if (!weekId || !isValidWeek(weekId)) {
      throw new functions.https.HttpsError(
        'invalid-argument',
        'Invalid week ID. Must be current or future week (up to 3 weeks ahead).'
      );
    }

    if (!action || !['add', 'remove'].includes(action)) {
      throw new functions.https.HttpsError(
        'invalid-argument',
        'Action must be either "add" or "remove".'
      );
    }

    if (!Array.isArray(slots) || slots.length === 0) {
      throw new functions.https.HttpsError(
        'invalid-argument',
        'Slots must be a non-empty array of time slots.'
      );
    }

    if (slots.length > MAX_SLOTS_PER_REQUEST) {
      throw new functions.https.HttpsError(
        'invalid-argument',
        `Cannot update more than ${MAX_SLOTS_PER_REQUEST} slots at once.`
      );
    }

    if (!slots.every(isValidTimeSlot)) {
      throw new functions.https.HttpsError(
        'invalid-argument',
        'Slots must be a non-empty array of valid time slots (format: ddd_hhmm).'
      );
    }

    // Get references
    const teamRef = db.collection('teams').doc(teamId);
    const userRef = db.collection('users').doc(userId);
    const availabilityRef = db.collection('availability').doc(`${teamId}_${weekId}`);

    // 3. Use transaction for atomic updates
    return await db.runTransaction(async (transaction) => {
      // Get fresh data inside transaction
      const [teamDoc, userDoc] = await Promise.all([
        transaction.get(teamRef),
        transaction.get(userRef)
      ]);

      // Validate team and user existence
      if (!teamDoc.exists) {
        throw new functions.https.HttpsError('not-found', 'Team not found.');
      }

      if (!userDoc.exists) {
        throw new functions.https.HttpsError('not-found', 'User profile not found.');
      }

      const teamData = teamDoc.data();
      const userData = userDoc.data();

      // Verify user is team member and get current initials
      const userRosterEntry = teamData.playerRoster.find(player => player.userId === userId);
      if (!userRosterEntry) {
        throw new functions.https.HttpsError(
          'permission-denied',
          'You must be a team member to update availability.'
        );
      }

      // Get or create availability document
      const availabilityDoc = await transaction.get(availabilityRef);
      let availabilityData = availabilityDoc.exists ? availabilityDoc.data() : {
        teamId,
        weekId,
        year: parseInt(weekId.split('-W')[0]),
        weekNumber: parseInt(weekId.split('-W')[1]),
        availabilityGrid: {},
        lastUpdatedAt: FieldValue.serverTimestamp(),
        lastUpdatedBy: userId
      };

      // Update availability grid with current initials
      const currentInitials = userRosterEntry.initials;
      slots.forEach(slot => {
        if (!availabilityData.availabilityGrid[slot]) {
          availabilityData.availabilityGrid[slot] = [];
        }

        let slotArray = availabilityData.availabilityGrid[slot];

        // Remove any old initials for this user (in case they changed)
        slotArray = slotArray.filter(initials => {
          const rosterEntry = teamData.playerRoster.find(p => p.initials === initials);
          return rosterEntry && rosterEntry.userId !== userId;
        });

        if (action === 'add' && !slotArray.includes(currentInitials)) {
          slotArray.push(currentInitials);
          // Sort for consistent display
          slotArray.sort();
        }

        availabilityData.availabilityGrid[slot] = slotArray;
      });

      // Update timestamps
      const now = FieldValue.serverTimestamp();
      availabilityData.lastUpdatedAt = now;
      availabilityData.lastUpdatedBy = userId;

      // Prepare team update
      const teamUpdate = {
        lastActivityAt: now
      };

      // Reactivate team if it's inactive (but not if permanently archived)
      if (!teamData.active && !teamData.archived) {
        teamUpdate.active = true;  // Silent reactivation from inactive state
        
        // Log team reactivation event
        await logTeamLifecycleEvent(db, transaction, EVENT_TYPES.TEAM_ACTIVE, {
          teamId: teamId,
          teamName: teamData.teamName,
          details: {
            reactivatedBy: {
              displayName: userData.displayName,
              initials: userData.initials
            },
            reactivationTrigger: 'availabilityUpdate',
            weekId: weekId
          }
        });
      }

      // Perform atomic updates
      transaction.set(availabilityRef, availabilityData);
      transaction.update(teamRef, teamUpdate);
      transaction.update(userRef, { lastActivityAt: now });

      return {
        success: true,
        data: { 
          teamId, 
          weekId,
          updatedSlots: slots.length
        },
        message: `Availability ${action === 'add' ? 'added to' : 'removed from'} ${slots.length} time slot(s).`
      };
    });

  } catch (error) {
    console.error('Error updating availability:', error);
    if (error instanceof functions.https.HttpsError) {
      throw error;
    }
    throw new functions.https.HttpsError('internal', 'An unexpected error occurred while updating availability.');
  }
}); 