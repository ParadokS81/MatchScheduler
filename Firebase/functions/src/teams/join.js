// join.js - Team joining functionality
// TODO: Implement according to Technical PRD Section 4.2

const functions = require('firebase-functions');
const admin = require('firebase-admin');

exports.joinTeam = functions.https.onCall(async (data, context) => {
  const db = admin.firestore();
  
  try {
    // 1. Check authentication
    if (!context.auth) {
      throw new functions.https.HttpsError('unauthenticated', 'You must be logged in to join a team.');
    }

    const userId = context.auth.uid;
    const { joinCode } = data;

    // Basic join code format validation
    if (!joinCode || typeof joinCode !== 'string') {
      throw new functions.https.HttpsError(
        'invalid-argument',
        'Invalid join code'  // Generic error for both format and non-existent codes
      );
    }

    // Get user reference for transaction
    const userRef = db.collection('users').doc(userId);

    // Initial user check - just verify existence
    const userDoc = await userRef.get();
    if (!userDoc.exists) {
      throw new functions.https.HttpsError(
        'failed-precondition',
        'User profile not found'
      );
    }

    // Check user's team count outside transaction (optimization)
    // Even if this becomes stale, the transaction will still enforce atomicity
    const userData = userDoc.data();
    if (userData.teams && userData.teams.length >= 2) {
      throw new functions.https.HttpsError(
        'failed-precondition',
        'Maximum 2 teams per user'
      );
    }

    // Use transaction for atomic updates
    const result = await db.runTransaction(async (transaction) => {
      // Get fresh user data inside transaction
      const freshUserDoc = await transaction.get(userRef);
      const freshUserData = freshUserDoc.data();

      // Double-check team count with fresh data
      if (freshUserData.teams && freshUserData.teams.length >= 2) {
        throw new functions.https.HttpsError(
          'failed-precondition',
          'Maximum 2 teams per user'
        );
      }

      // Query for team with matching join code
      const teamsQuery = await transaction.get(
        db.collection('teams')
          .where('joinCode', '==', joinCode.toUpperCase())
          .where('status', '==', 'active')
      );

      // Check if team exists with valid join code
      if (teamsQuery.empty) {
        throw new functions.https.HttpsError(
          'not-found',
          'Invalid join code'  // Generic error for security
        );
      }

      const teamDoc = teamsQuery.docs[0];
      const teamData = teamDoc.data();

      // Check if user is already on the team
      if (teamData.playerRoster.some(player => player.userId === userId)) {
        throw new functions.https.HttpsError(
          'already-exists',
          'Already a member of this team'
        );
      }

      // Check if team is full using fresh data
      if (teamData.playerRoster.length >= teamData.maxPlayers) {
        throw new functions.https.HttpsError(
          'failed-precondition',
          'Team is full'
        );
      }

      const now = admin.firestore.FieldValue.serverTimestamp();

      // Create new player object with fresh user data
      const newPlayer = {
        userId: userId,
        displayName: freshUserData.displayName,
        initials: freshUserData.initials
      };

      // Update team document
      transaction.update(teamDoc.ref, {
        playerRoster: admin.firestore.FieldValue.arrayUnion(newPlayer),
        lastActivityAt: now
      });

      // Update user's teams array - arrayUnion prevents duplicates
      transaction.update(userRef, {
        teams: admin.firestore.FieldValue.arrayUnion(teamDoc.id),
        updatedAt: now
      });

      return {
        teamId: teamDoc.id,
        teamName: teamData.teamName
      };
    });

    return {
      success: true,
      data: result,
      message: `Welcome to ${result.teamName}!`
    };

  } catch (error) {
    console.error('Error joining team:', error);
    if (error instanceof functions.https.HttpsError) {
      throw error;
    }
    throw new functions.https.HttpsError('internal', 'An unexpected error occurred while joining the team.');
  }
}); 