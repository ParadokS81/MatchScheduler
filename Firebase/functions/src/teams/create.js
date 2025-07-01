// create.js - Team creation functionality
// TODO: Implement according to Technical PRD Section 4.1

console.log('=== CREATE.JS LOADING ===');
console.log('admin exists?', typeof require('firebase-admin') !== 'undefined');

const functions = require('firebase-functions');
const admin = require('firebase-admin');
const { FieldValue } = require('firebase-admin/firestore');
const { getCurrentWeekId, EVENT_TYPES, logTeamLifecycleEvent, logPlayerMovementEvent } = require('../utils/helpers');

// Initialize admin if not already initialized
if (!admin.apps.length) {
  admin.initializeApp();
}

console.log('admin loaded, apps length:', admin.apps?.length);
console.log('admin.firestore exists?', typeof admin.firestore === 'function');
console.log('admin.firestore.FieldValue exists immediately?', !!admin.firestore.FieldValue);

console.log('1. About to import FieldValue directly');
console.log('2. admin.firestore type:', typeof admin.firestore);
console.log('3. admin.firestore.FieldValue exists?', !!admin.firestore.FieldValue);

console.log('4. FieldValue imported successfully:', typeof FieldValue);
console.log('5. FieldValue.serverTimestamp exists?', !!FieldValue.serverTimestamp);

/**
 * Create a new team and add creator as owner
 */
exports.createTeam = functions.https.onCall(async (data, context) => {
  // Verify authentication
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'Must be signed in to create team');
  }

  const { 
    teamName,           // From Team Name field
    displayName,        // Optional: From Display Name field
    initials,          // Optional: From Initials field
    divisions = [],     // From Divisions checkboxes
    maxPlayers = 5     // From Max Players dropdown
  } = data;
  
  // Validate team name (3-25 characters)
  if (!teamName || typeof teamName !== 'string' || 
      teamName.trim().length < 3 || teamName.trim().length > 25) {
    throw new functions.https.HttpsError(
      'invalid-argument',
      'Team name must be between 3 and 25 characters'
    );
  }

  // Validate divisions (at least one selected)
  const validDivisions = ['Division 1', 'Division 2', 'Division 3'];
  if (!Array.isArray(divisions) || divisions.length === 0 || 
      !divisions.every(div => validDivisions.includes(div))) {
    throw new functions.https.HttpsError(
      'invalid-argument',
      'You must select at least one valid division'
    );
  }

  // Validate max players (between 1 and 20)
  const maxPlayersNum = parseInt(maxPlayers);
  if (isNaN(maxPlayersNum) || maxPlayersNum < 1 || maxPlayersNum > 20) {
    throw new functions.https.HttpsError(
      'invalid-argument',
      'Max players must be between 1 and 20'
    );
  }

  const db = admin.firestore();
  const userId = context.auth.uid;
  const timestamp = FieldValue.serverTimestamp();

  try {
    const result = await db.runTransaction(async (transaction) => {
      // Get user profile
      const userRef = db.collection('users').doc(userId);
      const userDoc = await transaction.get(userRef);
      
      // If profile data is provided, create/update user profile
      if (displayName && initials) {
        // Validate display name and initials
        if (typeof displayName !== 'string' || 
            displayName.trim().length < 2 || displayName.trim().length > 20) {
          throw new functions.https.HttpsError(
            'invalid-argument',
            'Display name must be between 2 and 20 characters'
          );
        }
        
        if (typeof initials !== 'string' || initials.trim().length !== 3) {
          throw new functions.https.HttpsError(
            'invalid-argument',
            'Initials must be exactly 3 characters'
          );
        }

        // Create or update user profile
        if (!userDoc.exists) {
          transaction.set(userRef, {
            displayName: displayName.trim(),
            initials: initials.trim().toUpperCase(),
            teams: {},
            createdAt: timestamp
          });
        } else {
          transaction.update(userRef, {
            displayName: displayName.trim(),
            initials: initials.trim().toUpperCase()
          });
        }
      } else if (!userDoc.exists) {
        // If no profile data provided and no profile exists, throw error
        throw new functions.https.HttpsError(
          'failed-precondition',
          'User profile is required to create a team'
        );
      }

      // Get user data (either existing or just created)
      const userData = userDoc.exists ? userDoc.data() : {
        displayName: displayName.trim(),
        initials: initials.trim().toUpperCase()
      };

      // Check if team name is already taken
      const existingTeamQuery = await transaction.get(
        db.collection('teams')
          .where('teamName', '==', teamName.trim())
          .where('active', '==', true)
      );
      
      if (!existingTeamQuery.empty) {
        throw new functions.https.HttpsError(
          'already-exists',
          'A team with this name already exists'
        );
      }

      // Create new team document
      const teamRef = db.collection('teams').doc();
      const teamData = {
        teamName: teamName.trim(),
        divisions,
        maxPlayers: maxPlayersNum,
        createdAt: timestamp,
        createdBy: userId,
        leaderId: userId,
        active: true,
        archived: false,
        joinCode: generateJoinCode(),
        playerRoster: [
          {
            userId: userId,
            displayName: userData.displayName,
            initials: userData.initials
          }
        ]
      };

      transaction.set(teamRef, teamData);

      // Create TEAM_CREATED event (team lifecycle - NO userId field)
      const teamCreatedEventId = await logTeamLifecycleEvent(db, transaction, EVENT_TYPES.TEAM_CREATED, {
        teamId: teamRef.id,
        teamName: teamName.trim(),
        details: {
          divisions,
          maxPlayers: maxPlayersNum,
          creator: {
            displayName: userData.displayName,
            initials: userData.initials
          }
        }
      });

      // Create JOINED event (player movement - WITH userId field)
      const playerJoinedEventId = await logPlayerMovementEvent(db, transaction, EVENT_TYPES.JOINED, {
        teamId: teamRef.id,
        teamName: teamName.trim(),
        userId,
        player: {
          displayName: userData.displayName,
          initials: userData.initials
        },
        details: {
          role: 'owner',
          isFounder: true
        }
      });

      // Update user's teams list
      transaction.update(userRef, {
        [`teams.${teamRef.id}`]: true
      });

      // Return success response with team ID
      return {
        teamId: teamRef.id,
        teamName: teamName.trim(),
        events: {
          teamCreated: teamCreatedEventId,
          playerJoined: playerJoinedEventId
        }
      };
    });

    // Return properly formatted response
    return {
      success: true,
      data: result,
      message: 'Team created successfully'
    };

  } catch (error) {
    console.error('Team creation failed:', error);
    throw new functions.https.HttpsError(
      'internal',
      error.message || 'Failed to create team'
    );
  }
});

// Helper function to generate unique join code
function generateJoinCode() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
} 