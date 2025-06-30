// leave.js - Team leaving functionality
// TODO: Implement according to Technical PRD Section 4.3

const functions = require('firebase-functions');
const admin = require('firebase-admin');
const { FieldValue } = require("firebase-admin/firestore");

exports.leaveTeam = functions.https.onCall(async (data, context) => {
  const db = admin.firestore();
  
  try {
    // 1. Check authentication
    if (!context.auth) {
      throw new functions.https.HttpsError('unauthenticated', 'You must be logged in to leave a team.');
    }

    const userId = context.auth.uid;
    const { teamId } = data;

    // 2. Validate teamId is provided
    if (!teamId || typeof teamId !== 'string') {
      throw new functions.https.HttpsError(
        'invalid-argument',
        'Team ID is required.'
      );
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
    if (!teamData.playerRoster.some(player => player.userId === userId)) {
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
        const isLastMember = freshTeamData.playerRoster.length === 1;
        if (!isLastMember) {
          throw new functions.https.HttpsError(
            'failed-precondition',
            'Team leader must transfer leadership before leaving'
          );
        }
      }

      // Calculate new roster
      const newRoster = freshTeamData.playerRoster.filter(
        player => player.userId !== userId
      );

      const now = FieldValue.serverTimestamp();

      // Prepare team update
      const teamUpdate = {
        playerRoster: newRoster,
        lastActivityAt: now
      };

      // Archive permanently if empty
      if (newRoster.length === 0) {
        teamUpdate.active = false;
        teamUpdate.archived = true;  // Permanently archived - not recoverable
      }

      // Get current user data to update teams map
      const userDoc = await transaction.get(userRef);
      const userData = userDoc.data();
      const currentTeams = userData.teams || {};
      
      // Remove this team from the teams map
      const updatedTeams = { ...currentTeams };
      delete updatedTeams[teamId];

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