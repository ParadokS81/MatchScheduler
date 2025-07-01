// leave.js - Team leaving functionality
// TODO: Implement according to Technical PRD Section 4.3

const functions = require('firebase-functions');
const admin = require('firebase-admin');
const { FieldValue } = require("firebase-admin/firestore");
const { EVENT_TYPES, logPlayerMovementEvent, logTeamLifecycleEvent } = require('../utils/helpers');

exports.leaveTeam = functions.https.onCall(async (data, context) => {
  const db = admin.firestore();
  
  try {
    // 1. Check authentication
    if (!context.auth) {
      throw new functions.https.HttpsError('unauthenticated', 'You must be logged in to leave a team.');
    }

    const userId = context.auth.uid;
    const { teamId, archiveNote } = data;

    // 2. Validate teamId is provided
    if (!teamId || typeof teamId !== 'string') {
      throw new functions.https.HttpsError(
        'invalid-argument',
        'Team ID is required.'
      );
    }

    // 3. Validate archiveNote if provided
    let sanitizedArchiveNote = null;
    if (archiveNote !== undefined && archiveNote !== null) {
      if (typeof archiveNote !== 'string') {
        throw new functions.https.HttpsError(
          'invalid-argument',
          'Archive note must be a string.'
        );
      }
      
      // Max 200 characters
      if (archiveNote.length > 200) {
        throw new functions.https.HttpsError(
          'invalid-argument',
          'Archive note must be 200 characters or less.'
        );
      }
      
      // Sanitize dangerous characters
      sanitizedArchiveNote = archiveNote.replace(/[<>&"'/\\`${}()\[\]=+*#@%^|~]/g, '').trim();
      
      // Only allow letters, numbers, spaces, basic punctuation (.,!?'-)
      const allowedPattern = /^[a-zA-Z0-9\s.,!?'-]*$/;
      if (!allowedPattern.test(sanitizedArchiveNote)) {
        throw new functions.https.HttpsError(
          'invalid-argument',
          'Archive note contains invalid characters. Only letters, numbers, spaces, and basic punctuation are allowed.'
        );
      }
      
      // If after sanitization it's empty, set to null
      if (sanitizedArchiveNote === '') {
        sanitizedArchiveNote = null;
      }
    }

    // Get references
    const teamRef = db.collection('teams').doc(teamId);
    const userRef = db.collection('users').doc(userId);

    // 3. Get team data ONCE and do basic validation
    const teamDoc = await teamRef.get();
    if (!teamDoc.exists) {
      throw new functions.https.HttpsError(
        'not-found',
        'Team not found'
      );
    }
    
    const teamData = teamDoc.data();
    const teamName = teamData.teamName;

    // 5. Verify user is on the team roster (BEFORE transaction)
    if (!teamData.playerRoster || !teamData.playerRoster.some(player => player.userId === userId)) {
      throw new functions.https.HttpsError(
        'failed-precondition',
        `Not a member of team "${teamName}"`
      );
    }

    // 6. Use transaction for atomic updates and leadership check
    await db.runTransaction(async (transaction) => {
      // Get fresh team data inside transaction
      const freshTeamDoc = await transaction.get(teamRef);
      const freshTeamData = freshTeamDoc.data();

      // Check if user is the team leader using fresh data
      if (freshTeamData.leaderId === userId) {
        // If they are the leader, only allow leaving if they are the last member
        const currentMemberCount = freshTeamData.playerRoster ? freshTeamData.playerRoster.length : 0;
        const isLastMember = currentMemberCount === 1;
        if (!isLastMember) {
          throw new functions.https.HttpsError(
            'failed-precondition',
            'Team leader must transfer leadership before leaving'
          );
        }
      }

      // Find the player object to remove
      const playerToRemove = freshTeamData.playerRoster.find(player => player.userId === userId);
      if (!playerToRemove) {
        throw new functions.https.HttpsError(
          'failed-precondition',
          'Player not found in roster'
      );
      }

      const now = FieldValue.serverTimestamp();

      // Get current user data to update teams map (fetch once, use multiple times)
      const userDoc = await transaction.get(userRef);
      const userData = userDoc.data();
      const currentTeams = userData.teams || {};

      // Prepare team update - remove the member
      const teamUpdate = {
        playerRoster: FieldValue.arrayRemove(playerToRemove),
        lastActivityAt: now
      };

      // Check if team will be empty after removing this member
      const remainingMemberCount = freshTeamData.playerRoster ? freshTeamData.playerRoster.length - 1 : 0;

      // Archive permanently if empty
      if (remainingMemberCount === 0) {
        teamUpdate.active = false;
        teamUpdate.archived = true;  // Permanently archived - not recoverable
        teamUpdate.archivedAt = now;
        teamUpdate.archivedBy = userId;
        teamUpdate.archiveReason = 'lastMemberLeft';
        
        // Add archive note if provided
        if (sanitizedArchiveNote) {
          teamUpdate.archiveNote = sanitizedArchiveNote;
        }
        
        // Log team archived event
        await logTeamLifecycleEvent(db, transaction, EVENT_TYPES.TEAM_ARCHIVED, {
          teamId: teamRef.id,
          teamName: teamName,
          details: {
            reason: 'lastMemberLeft',
            finalMember: {
              displayName: userData.displayName,
              initials: userData.initials
            },
            archiveNote: sanitizedArchiveNote,
            archivedBy: userId
          }
        });
      }
      
      // Remove this team from the teams map
      const updatedTeams = { ...currentTeams };
      delete updatedTeams[teamId];

      // Log player left event
      await logPlayerMovementEvent(db, transaction, EVENT_TYPES.LEFT, {
        teamId: teamRef.id,
        teamName: teamName,
        userId,
        player: {
          displayName: userData.displayName,
          initials: userData.initials
        },
        details: {
          leaveMethod: 'voluntary',
          wasLastMember: remainingMemberCount === 0
        }
      });

      // Perform atomic updates
      transaction.update(teamRef, teamUpdate);
      transaction.update(userRef, {
        teams: updatedTeams,
        updatedAt: now
      });
    });

    // Return success response
    return {
      success: true,
      data: { teamId },
      message: `You have left ${teamName}`
    };

  } catch (error) {
    console.error('Error leaving team:', error);
    if (error instanceof functions.https.HttpsError) {
      throw error;
    }
    throw new functions.https.HttpsError('internal', 'An unexpected error occurred while leaving the team.');
  }
}); 