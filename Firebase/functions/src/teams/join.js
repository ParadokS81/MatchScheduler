// join.js - Team joining functionality
// TODO: Implement according to Technical PRD Section 4.2

const functions = require('firebase-functions');
const admin = require('firebase-admin');
const { FieldValue } = require("firebase-admin/firestore");
const { EVENT_TYPES, logPlayerMovementEvent } = require('../utils/helpers');

exports.joinTeam = functions.https.onCall(async (data, context) => {
  const db = admin.firestore();
  
  try {
    console.log('🔧 JOIN TEAM FUNCTION CALLED - NEW VERSION WITH PROFILE CREATION');
    console.log('📥 Received data:', { joinCode: data.joinCode, hasDisplayName: !!data.displayName, hasInitials: !!data.initials });
    
    // 1. Check authentication
    if (!context.auth) {
      throw new functions.https.HttpsError('unauthenticated', 'You must be logged in to join a team.');
    }

    const userId = context.auth.uid;
    const { joinCode, displayName, initials } = data;

    // Basic join code format validation
    if (!joinCode || typeof joinCode !== 'string') {
      throw new functions.https.HttpsError(
        'invalid-argument',
        'Invalid join code'  // Generic error for both format and non-existent codes
      );
    }

    // Get user reference for transaction
    const userRef = db.collection('users').doc(userId);

    // Initial user check - allow missing profile if profile data is provided
    const userDoc = await userRef.get();
    if (!userDoc.exists && (!displayName || !initials)) {
      throw new functions.https.HttpsError(
        'failed-precondition',
        'User profile is required to join a team. Please provide displayName and initials.'
      );
    }

    // Check user's team count outside transaction (optimization)
    // Even if this becomes stale, the transaction will still enforce atomicity
    const userData = userDoc.data();
    
    // DEFENSIVE: Ensure user data exists
    if (!userData) {
      throw new functions.https.HttpsError(
        'failed-precondition',
        'User profile data is invalid'
      );
    }
    
    // DEFENSIVE: Handle undefined or malformed teams data
    const teamCount = userData.teams && typeof userData.teams === 'object' && !Array.isArray(userData.teams)
      ? Object.keys(userData.teams).length 
      : 0;
    if (teamCount >= 2) {
      throw new functions.https.HttpsError(
        'failed-precondition',
        'Maximum 2 teams per user'
      );
    }

    // Use transaction for atomic updates
    const result = await db.runTransaction(async (transaction) => {
      // Get fresh user data inside transaction
      const freshUserDoc = await transaction.get(userRef);
      
      let freshUserData;
      
      // Handle profile creation if needed
      if (!freshUserDoc.exists) {
        // Validate profile data
        if (!displayName || typeof displayName !== 'string' || 
            displayName.trim().length < 2 || displayName.trim().length > 20) {
          throw new functions.https.HttpsError(
            'invalid-argument',
            'Display name must be between 2 and 20 characters'
          );
        }
        
        if (!initials || typeof initials !== 'string' || initials.trim().length !== 3) {
        throw new functions.https.HttpsError(
            'invalid-argument',
            'Initials must be exactly 3 characters'
          );
        }

        // Create new user profile
        const timestamp = FieldValue.serverTimestamp();
        freshUserData = {
          userId: userId,
          displayName: displayName.trim(),
          initials: initials.trim().toUpperCase(),
          teams: {},
          createdAt: timestamp
        };
        
        transaction.set(userRef, freshUserData);
      } else {
        freshUserData = freshUserDoc.data();
      
      // DEFENSIVE: Ensure user data is valid
      if (!freshUserData) {
        throw new functions.https.HttpsError(
          'failed-precondition',
          'User profile data is invalid'
        );
        }
      }

      // Double-check team count with fresh data - DEFENSIVE: Handle undefined teams
      const freshTeamCount = freshUserData.teams && typeof freshUserData.teams === 'object' && !Array.isArray(freshUserData.teams) 
        ? Object.keys(freshUserData.teams).length 
        : 0;
      if (freshTeamCount >= 2) {
        throw new functions.https.HttpsError(
          'failed-precondition',
          'Maximum 2 teams per user'
        );
      }

      // Query for team with matching join code
      console.log('🔍 Searching for team with joinCode:', joinCode.toUpperCase());
      const teamsQuery = await transaction.get(
        db.collection('teams')
          .where('joinCode', '==', joinCode.toUpperCase())
          .where('active', '==', true)
          .where('archived', '==', false)
      );

      console.log('📊 Teams query result:', { 
        empty: teamsQuery.empty, 
        size: teamsQuery.size,
        docs: teamsQuery.docs.map(doc => ({ id: doc.id, joinCode: doc.data().joinCode }))
      });

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
      if (teamData.playerRoster && teamData.playerRoster.some(player => player.userId === userId)) {
        throw new functions.https.HttpsError(
          'already-exists',
          'Already a member of this team'
        );
      }

      // Check if team is full using fresh data
      const currentMemberCount = teamData.playerRoster ? teamData.playerRoster.length : 0;
      if (currentMemberCount >= teamData.maxPlayers) {
        throw new functions.https.HttpsError(
          'failed-precondition',
          'Team is full'
        );
      }

      const now = FieldValue.serverTimestamp();

      // Create new player object
      const newPlayer = {
        userId: userId,
        displayName: freshUserData.displayName,
        initials: freshUserData.initials
      };

      // Update team document with new member
      transaction.update(teamDoc.ref, {
        playerRoster: FieldValue.arrayUnion(newPlayer),
        lastActivityAt: now
      });

      // Update user's teams map - DEFENSIVE: Ensure teams is a map, not array
      let currentTeams = freshUserData.teams || {};
      
      // MIGRATION: Handle legacy array format
      if (Array.isArray(currentTeams)) {
        console.log('Converting legacy teams array to map format for user:', userId);
        const teamsMap = {};
        currentTeams.forEach(teamId => {
          if (teamId && typeof teamId === 'string') {
            teamsMap[teamId] = true;
          }
        });
        currentTeams = teamsMap;
      } else if (typeof currentTeams !== 'object') {
        // Handle malformed data
        console.warn('Invalid teams data format, resetting to empty map for user:', userId);
        currentTeams = {};
      }
      
      const updatedTeams = { ...currentTeams, [teamDoc.id]: true };
      transaction.update(userRef, {
        teams: updatedTeams,
        updatedAt: now
      });

      // Log player joined event
      await logPlayerMovementEvent(db, transaction, EVENT_TYPES.JOINED, {
        teamId: teamDoc.id,
        teamName: teamData.teamName,
        userId,
        player: {
          displayName: freshUserData.displayName,
          initials: freshUserData.initials
        },
        details: {
          joinMethod: 'joinCode'
        }
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