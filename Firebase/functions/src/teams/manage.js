// manage.js - Team management functionality
// TODO: Implement according to Technical PRD Section 4.4

const functions = require('firebase-functions');
const admin = require('firebase-admin');
const { FieldValue } = require("firebase-admin/firestore");

/**
 * Removes a player from a team. Only the team leader can remove players.
 * Players cannot remove themselves (they should use leaveTeam instead).
 * 
 * @param {Object} data Request data
 * @param {string} data.teamId The ID of the team
 * @param {string} data.targetUserId The ID of the user to remove
 * @param {Object} context Functions context containing auth info
 * @returns {Promise<Object>} Success response with removed player info
 */
async function removePlayer(data, context) {
  const db = admin.firestore();
  
  // Check authentication
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'You must be logged in to remove a player.');
  }

  const { teamId, targetUserId } = data;
  const userId = context.auth.uid;

  // Validate required parameters
  if (!teamId || !targetUserId) {
    throw new functions.https.HttpsError('invalid-argument', 'Team ID and target user ID are required.');
  }

      // Prevent self-removal
    if (userId === targetUserId) {
      throw new functions.https.HttpsError('invalid-argument', 'Use leaveTeam to remove yourself.');
    }

  try {
    // Get references
    const teamRef = db.collection('teams').doc(teamId);
    const targetUserRef = db.collection('users').doc(targetUserId);
    const leaderRef = db.collection('users').doc(userId);

    // Initial checks outside transaction
    const [teamDoc, targetUserDoc, leaderDoc] = await Promise.all([
      teamRef.get(),
      targetUserRef.get(),
      leaderRef.get()
    ]);

    // Verify team exists (for better error message)
    if (!teamDoc.exists) {
      throw new functions.https.HttpsError('not-found', 'Team not found.');
    }

    // Verify leader has profile
    if (!leaderDoc.exists) {
      throw new functions.https.HttpsError('failed-precondition', 'You must complete your profile first.');
    }

    // Verify target user exists
    if (!targetUserDoc.exists) {
      throw new functions.https.HttpsError('not-found', 'Target user not found.');
    }

    const teamName = teamDoc.data().teamName;

    // Use transaction for atomic updates
    const result = await db.runTransaction(async (transaction) => {
      // Get fresh data inside transaction
      const [freshTeamDoc, freshTargetUserDoc] = await Promise.all([
        transaction.get(teamRef),
        transaction.get(targetUserRef)
      ]);

      const team = freshTeamDoc.data();

      // Verify team is active
      if (!team.active) {
        throw new functions.https.HttpsError('failed-precondition', 'Cannot modify an inactive team.');
      }

      // Verify caller is team leader using fresh data
      if (team.leaderId !== userId) {
        throw new functions.https.HttpsError('permission-denied', 'Only the team leader can remove players.');
      }

      // Find target player in roster using fresh data
      const targetPlayer = team.playerRoster.find(player => player.userId === targetUserId);
      if (!targetPlayer) {
        throw new functions.https.HttpsError('not-found', `User is not a member of team "${teamName}".`);
      }

      const now = FieldValue.serverTimestamp();

      // Get target user's current teams and remove this team
      const targetUserDoc = await transaction.get(targetUserRef);
      const targetUserData = targetUserDoc.data();
      const currentTeams = targetUserData.teams || {};
      const updatedUserTeams = { ...currentTeams };
      delete updatedUserTeams[teamId];

      // Update team document
      transaction.update(teamRef, {
        playerRoster: team.playerRoster.filter(player => player.userId !== targetUserId),
        lastActivityAt: now
      });

      // Update target user's teams map
      transaction.update(targetUserRef, {
        teams: updatedUserTeams,
        updatedAt: now
      });

      return {
        removedPlayer: targetPlayer.displayName,
        teamName: teamName
      };
    });

    return {
      success: true,
      data: {
        removedPlayer: result.removedPlayer,
        teamId: teamId
      },
      message: `${result.removedPlayer} has been removed from ${result.teamName}.`
    };

  } catch (error) {
    console.error('Error removing player:', error);
    if (error instanceof functions.https.HttpsError) {
      throw error;
    }
    throw new functions.https.HttpsError('internal', 'An unexpected error occurred while removing the player.');
  }
}

/**
 * Transfers team leadership to another team member.
 * Only the current team leader can transfer leadership.
 * 
 * @param {Object} data Request data
 * @param {string} data.teamId The ID of the team
 * @param {string} data.newLeaderId The ID of the user to make leader
 * @param {Object} context Functions context containing auth info
 * @returns {Promise<Object>} Success response with new leader info
 */
async function transferLeadership(data, context) {
  const db = admin.firestore();
  
  // Check authentication
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'You must be logged in to transfer team leadership.');
  }

  const { teamId, newLeaderId } = data;
  const userId = context.auth.uid;

  // Validate required parameters
  if (!teamId || !newLeaderId || typeof teamId !== 'string' || typeof newLeaderId !== 'string') {
    throw new functions.https.HttpsError('invalid-argument', 'Team ID and new leader ID are required.');
  }

  // Prevent self-transfer
  if (userId === newLeaderId) {
    throw new functions.https.HttpsError('failed-precondition', 'You are already the team leader.');
  }

  try {
    // Get references
    const teamRef = db.collection('teams').doc(teamId);
    const newLeaderRef = db.collection('users').doc(newLeaderId);
    const currentLeaderRef = db.collection('users').doc(userId);

    // Initial checks outside transaction
    const [teamDoc, newLeaderDoc, currentLeaderDoc] = await Promise.all([
      teamRef.get(),
      newLeaderRef.get(),
      currentLeaderRef.get()
    ]);

    // Verify team exists (for better error message)
    if (!teamDoc.exists) {
      throw new functions.https.HttpsError('not-found', 'Team not found.');
    }

    const teamData = teamDoc.data();
    const teamName = teamData.teamName;

    // Verify team is active outside transaction (for better error message)
    if (!teamData.active) {
      throw new functions.https.HttpsError('failed-precondition', `Cannot modify team "${teamName}" - it is not active.`);
    }

    // Verify current leader has profile
    if (!currentLeaderDoc.exists) {
      throw new functions.https.HttpsError('failed-precondition', 'You must complete your profile first.');
    }

    // Verify new leader exists and has profile
    if (!newLeaderDoc.exists) {
      throw new functions.https.HttpsError('not-found', 'New leader profile not found.');
    }

    const newLeaderData = newLeaderDoc.data();

    // Verify new leader has this team in their teams map
    if (!newLeaderData.teams || !newLeaderData.teams[teamId]) {
      throw new functions.https.HttpsError('failed-precondition', `New leader is not a member of team "${teamName}".`);
    }

    // Use transaction for atomic updates
    const result = await db.runTransaction(async (transaction) => {
      // Get fresh data inside transaction
      const [freshTeamDoc, freshNewLeaderDoc] = await Promise.all([
        transaction.get(teamRef),
        transaction.get(newLeaderRef)
      ]);

      const team = freshTeamDoc.data();
      const freshNewLeaderData = freshNewLeaderDoc.data();

      // Verify team is still active using fresh data
      if (!team.active) {
        throw new functions.https.HttpsError('failed-precondition', `Cannot modify team "${teamName}" - it is not active.`);
      }

      // Verify caller is still team leader using fresh data
      if (team.leaderId !== userId) {
        throw new functions.https.HttpsError('permission-denied', 'Only the current team leader can transfer leadership.');
      }

      // Verify playerRoster exists and is an array
      if (!Array.isArray(team.playerRoster)) {
        throw new functions.https.HttpsError('failed-precondition', 'Invalid team data - please contact support.');
      }

      // Find new leader in roster using fresh data
      const newLeader = team.playerRoster.find(player => player.userId === newLeaderId);
      if (!newLeader) {
        throw new functions.https.HttpsError('failed-precondition', `New leader must be a member of team "${teamName}".`);
      }

      // Verify new leader still has team in their map using fresh data
      if (!freshNewLeaderData.teams || !freshNewLeaderData.teams[teamId]) {
        throw new functions.https.HttpsError('failed-precondition', `New leader is no longer a member of team "${teamName}".`);
      }

      const now = FieldValue.serverTimestamp();

      // Update team document
      transaction.update(teamRef, {
        leaderId: newLeaderId,
        lastActivityAt: now
      });

      // Update both users' updatedAt timestamps
      transaction.update(newLeaderRef, {
        updatedAt: now
      });

      transaction.update(currentLeaderRef, {
        updatedAt: now
      });

      return {
        newLeader: newLeader.displayName,
        teamName: teamName
      };
    });

    return {
      success: true,
      data: {
        newLeader: result.newLeader,
        teamId: teamId
      },
      message: `${result.newLeader} is now the leader of ${result.teamName}.`
    };

  } catch (error) {
    console.error('Error transferring team leadership:', error);
    if (error instanceof functions.https.HttpsError) {
      throw error;
    }
    throw new functions.https.HttpsError('internal', 'An unexpected error occurred while transferring team leadership.');
  }
}

/**
 * Updates team settings like name, divisions, max players, etc.
 * Only the team leader can update settings.
 * 
 * @param {Object} data Request data
 * @param {string} data.teamId The ID of the team
 * @param {string} [data.teamName] Optional new team name
 * @param {string[]} [data.divisions] Optional new divisions array
 * @param {number} [data.maxPlayers] Optional new max players (5-10)
 * @param {string} [data.teamLogoUrl] Optional team logo URL
 * @param {Object} context Functions context containing auth info
 * @returns {Promise<Object>} Success response with updated team info
 */
async function updateTeamSettings(data, context) {
  const db = admin.firestore();
  
  // Check authentication
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'You must be logged in to update team settings.');
  }

  const { teamId } = data;
  const userId = context.auth.uid;

  // Validate teamId
  if (!teamId || typeof teamId !== 'string') {
    throw new functions.https.HttpsError('invalid-argument', 'Team ID is required.');
  }

  // Normalize and validate input fields
  const updates = {};
  let hasUpdates = false;

  // Handle teamName
  if ('teamName' in data) {
    const teamName = data.teamName;
    updates.teamName = teamName;
    hasUpdates = true;
  }

  // Handle maxPlayers
  if ('maxPlayers' in data) {
    const maxPlayers = data.maxPlayers;
    if (!Number.isInteger(maxPlayers) || maxPlayers < 5 || maxPlayers > 10) {
      throw new functions.https.HttpsError('invalid-argument', 'Max players must be between 5 and 10.');
    }
    updates.maxPlayers = maxPlayers;
    hasUpdates = true;
  }

  // Handle divisions
  if ('divisions' in data) {
    const divisions = data.divisions;
    if (!Array.isArray(divisions) || divisions.length === 0) {
      throw new functions.https.HttpsError('invalid-argument', 'At least one division is required.');
    }

    // Validate and normalize divisions
    const validDivisions = ['1', '2', '3'];
    const uniqueDivisions = [...new Set(divisions)].sort();
    
    if (!uniqueDivisions.every(div => validDivisions.includes(div))) {
      throw new functions.https.HttpsError('invalid-argument', 'Invalid division value. Must be one of: 1, 2, 3');
    }

    updates.divisions = uniqueDivisions;
    hasUpdates = true;
  }

  // Handle teamLogoUrl
  if ('teamLogoUrl' in data) {
    const logoUrl = data.teamLogoUrl;

    // Allow null or empty string to remove logo
    if (logoUrl === null || logoUrl === '') {
      updates.teamLogoUrl = null;
      hasUpdates = true;
    } else if (typeof logoUrl === 'string') {
      try {
        const url = new URL(logoUrl.toLowerCase());
        if (url.protocol !== 'https:') {
          throw new functions.https.HttpsError('invalid-argument', 'Team logo URL must use HTTPS.');
        }
        // Additional URL validation
        if (!url.hostname || url.hostname === 'localhost' || url.hostname === '127.0.0.1') {
          throw new functions.https.HttpsError('invalid-argument', 'Invalid team logo URL.');
        }
        updates.teamLogoUrl = url.href; // Use normalized URL
        hasUpdates = true;
      } catch (error) {
        if (error instanceof functions.https.HttpsError) throw error;
        throw new functions.https.HttpsError('invalid-argument', 'Invalid team logo URL format.');
      }
    } else {
      throw new functions.https.HttpsError('invalid-argument', 'Team logo URL must be a string, empty string, or null.');
    }
  }

  // Check if any valid updates were provided
  if (!hasUpdates) {
    throw new functions.https.HttpsError('invalid-argument', 'No valid updates provided.');
  }

  try {
    // Get references
    const teamRef = db.collection('teams').doc(teamId);
    const leaderRef = db.collection('users').doc(userId);

    // Initial checks outside transaction
    const [teamDoc, leaderDoc] = await Promise.all([
      teamRef.get(),
      leaderRef.get()
    ]);

    // Verify team exists
    if (!teamDoc.exists) {
      throw new functions.https.HttpsError('not-found', 'Team not found.');
    }

    const teamData = teamDoc.data();
    const teamName = teamData.teamName;

    // Verify team is active
    if (!teamData.active) {
      throw new functions.https.HttpsError('failed-precondition', `Cannot modify team "${teamName}" - it is not active.`);
    }

    // Verify leader has profile
    if (!leaderDoc.exists) {
      throw new functions.https.HttpsError('failed-precondition', 'You must complete your profile first.');
    }

    // Pre-validate maxPlayers against current roster size outside transaction
    if (updates.maxPlayers !== undefined && teamData.playerRoster.length > updates.maxPlayers) {
      throw new functions.https.HttpsError(
        'failed-precondition',
        `Max players cannot be less than current roster size (${teamData.playerRoster.length}).`
      );
    }

    // Use transaction for atomic updates
    const result = await db.runTransaction(async (transaction) => {
      // Get fresh team data
      const freshTeamDoc = await transaction.get(teamRef);
      const team = freshTeamDoc.data();

      // Verify team is still active
      if (!team.active) {
        throw new functions.https.HttpsError('failed-precondition', `Cannot modify team "${teamName}" - it is not active.`);
      }

      // Verify caller is still team leader
      if (team.leaderId !== userId) {
        throw new functions.https.HttpsError('permission-denied', 'Only the team leader can update team settings.');
      }

      // Double-check maxPlayers with fresh data
      if (updates.maxPlayers !== undefined && team.playerRoster.length > updates.maxPlayers) {
        throw new functions.https.HttpsError(
          'failed-precondition',
          `Max players cannot be less than current roster size (${team.playerRoster.length}).`
        );
      }

      // Add timestamp to updates
      updates.lastActivityAt = FieldValue.serverTimestamp();

      // Update team document
      transaction.update(teamRef, updates);

      // Return only the updated fields (excluding lastActivityAt)
      const updatedFields = { ...updates };
      delete updatedFields.lastActivityAt;
      return updatedFields;
    });

    // Build success message with values
    const updateDetails = Object.entries(result)
      .map(([field, value]) => {
        switch (field) {
          case 'maxPlayers':
            return `maximum players to ${value}`;
          case 'divisions':
            return `divisions to ${value.join(', ')}`;
          case 'teamLogoUrl':
            return value === null ? 'removed team logo' : 'updated team logo';
          default:
            return field;
        }
      })
      .join(', ');

    return {
      success: true,
      data: result,
      message: `Successfully ${updateDetails} for team "${teamName}".`
    };

  } catch (error) {
    console.error('Error updating team settings:', error);
    if (error instanceof functions.https.HttpsError) {
      throw error;
    }
    throw new functions.https.HttpsError('internal', 'An unexpected error occurred while updating team settings.');
  }
}

// Helper function to generate unique join code
function generateJoinCode() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

/**
 * Regenerates a team's join code.
 * Only the team leader can regenerate the join code.
 * 
 * @param {Object} data Request data
 * @param {string} data.teamId The ID of the team
 * @param {Object} context Functions context containing auth info
 * @returns {Promise<Object>} Success response with new join code
 */
async function regenerateJoinCode(data, context) {
  const db = admin.firestore();
  
  // Check authentication
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'You must be logged in to regenerate join code.');
  }

  const { teamId } = data;
  const userId = context.auth.uid;

  // Validate teamId
  if (!teamId || typeof teamId !== 'string') {
    throw new functions.https.HttpsError('invalid-argument', 'Team ID is required.');
  }

  try {
    // Get references
    const teamRef = db.collection('teams').doc(teamId);
    const leaderRef = db.collection('users').doc(userId);

    // Initial checks outside transaction
    const [teamDoc, leaderDoc] = await Promise.all([
      teamRef.get(),
      leaderRef.get()
    ]);

    // Verify team exists
    if (!teamDoc.exists) {
      throw new functions.https.HttpsError('not-found', 'Team not found.');
    }

    const teamData = teamDoc.data();
    const teamName = teamData.teamName;

    // Verify team is active
    if (!teamData.active) {
      throw new functions.https.HttpsError('failed-precondition', `Cannot modify team "${teamName}" - it is not active.`);
    }

    // Verify leader has profile
    if (!leaderDoc.exists) {
      throw new functions.https.HttpsError('failed-precondition', 'You must complete your profile first.');
    }

    // Use transaction for atomic updates
    const result = await db.runTransaction(async (transaction) => {
      // Get fresh team data
      const freshTeamDoc = await transaction.get(teamRef);
      const team = freshTeamDoc.data();

      // Verify team is still active
      if (!team.active) {
        throw new functions.https.HttpsError('failed-precondition', `Cannot modify team "${teamName}" - it is not active.`);
      }

      // Verify caller is still team leader
      if (team.leaderId !== userId) {
        throw new functions.https.HttpsError('permission-denied', 'Only the team leader can regenerate the join code.');
      }

      const now = FieldValue.serverTimestamp();
      const newCode = generateJoinCode();

      // Update team document
      transaction.update(teamRef, {
        joinCode: newCode,
        joinCodeCreatedAt: now,
        lastActivityAt: now
      });

      return {
        joinCode: newCode
      };
    });

    return {
      success: true,
      data: result,
      message: `Join code regenerated for team "${teamName}".`
    };

  } catch (error) {
    console.error('Error regenerating join code:', error);
    if (error instanceof functions.https.HttpsError) {
      throw error;
    }
    throw new functions.https.HttpsError('internal', 'An unexpected error occurred while regenerating join code.');
  }
}

module.exports = {
  removePlayer: functions.https.onCall(removePlayer),
  transferLeadership: functions.https.onCall(transferLeadership),
  updateTeamSettings: functions.https.onCall(updateTeamSettings),
  regenerateJoinCode: functions.https.onCall(regenerateJoinCode)
}; 