// create.js - Team creation functionality
// TODO: Implement according to Technical PRD Section 4.1

console.log('=== CREATE.JS LOADING ===');
console.log('admin exists?', typeof require('firebase-admin') !== 'undefined');

const functions = require('firebase-functions');
const admin = require('firebase-admin');

console.log('admin loaded, apps length:', admin.apps?.length);
console.log('admin.firestore exists?', typeof admin.firestore === 'function');
console.log('admin.firestore.FieldValue exists immediately?', !!admin.firestore.FieldValue);

console.log('1. About to import FieldValue directly');
console.log('2. admin.firestore type:', typeof admin.firestore);
console.log('3. admin.firestore.FieldValue exists?', !!admin.firestore.FieldValue);

// Test Gemini's solution: Direct import instead of destructuring
const { FieldValue } = require("firebase-admin/firestore");

console.log('4. FieldValue imported successfully:', typeof FieldValue);
console.log('5. FieldValue.serverTimestamp exists?', !!FieldValue.serverTimestamp);

exports.createTeam = functions.https.onCall(async (data, context) => {
  const db = admin.firestore();
  
  try {
    // 1. Check authentication
    if (!context.auth) {
      throw new functions.https.HttpsError('unauthenticated', 'You must be logged in to create a team.');
    }

    const userId = context.auth.uid;
    const { teamName, divisions, maxPlayers } = data;

    // 2. Validate user has profile
    const userDoc = await db.collection('users').doc(userId).get();
    if (!userDoc.exists) {
      throw new functions.https.HttpsError(
        'failed-precondition',
        'You must complete your profile before creating a team.'
      );
    }
    const userData = userDoc.data();

    // 3. Check user's team count
    if (userData.teams && userData.teams.length >= 2) {
      throw new functions.https.HttpsError(
        'failed-precondition',
        'You can only be a member of up to 2 teams.'
      );
    }

    // 4 & 5. Validate team name
    if (!teamName || typeof teamName !== 'string' || 
        teamName.trim().length < 3 || teamName.trim().length > 25) {
      throw new functions.https.HttpsError(
        'invalid-argument',
        'Team name must be between 3 and 25 characters.'
      );
    }

    const nameRegex = /^[a-zA-Z0-9\s\-_]+$/;
    if (!nameRegex.test(teamName)) {
      throw new functions.https.HttpsError(
        'invalid-argument',
        'Team name can only contain letters, numbers, spaces, dashes, and underscores.'
      );
    }

    // 6. Validate divisions
    const validDivisions = ['1', '2', '3'];
    if (!Array.isArray(divisions) || divisions.length === 0 || 
        !divisions.every(div => validDivisions.includes(div))) {
      throw new functions.https.HttpsError(
        'invalid-argument',
        'You must select at least one valid division (1, 2, or 3).'
      );
    }

    // Move team creation and uniqueness check into transaction for better concurrency handling
    const result = await db.runTransaction(async (transaction) => {
      // Check team name uniqueness inside transaction
      const existingTeamQuery = await transaction.get(
        db.collection('teams')
          .where('teamName', '==', teamName.trim())
          .where('status', '==', 'active')
      );
      
      if (!existingTeamQuery.empty) {
        throw new functions.https.HttpsError(
          'already-exists',
          'A team with this name already exists.'
        );
      }

      // 8. Generate unique join code
      const joinCode = generateJoinCode();

      const teamRef = db.collection('teams').doc();
      
      console.log('6. About to call FieldValue.serverTimestamp()');
      console.log('7. FieldValue at runtime:', typeof FieldValue);
      console.log('8. FieldValue.serverTimestamp at runtime:', typeof FieldValue.serverTimestamp);
      
      const now = FieldValue.serverTimestamp();
      
      console.log('9. serverTimestamp() called successfully, result:', typeof now);

      // 9. Create team document with all required fields
      const teamData = {
        teamId: teamRef.id,
        teamName: teamName.trim(),
        leaderId: userId,
        maxPlayers: maxPlayers || 10,
        teamLogoUrl: null,
        divisions: divisions,
        joinCode: joinCode,
        joinCodeCreatedAt: now,
        status: 'active',
        createdAt: now,
        lastActivityAt: now,
        playerRoster: [{
          userId: userId,
          displayName: userData.displayName,
          initials: userData.initials,
          role: 'leader'
        }]
      };

      // Create team
      transaction.set(teamRef, teamData);

      // 11. Update user's teams array using proper Firebase method
      transaction.update(userDoc.ref, {
        teams: FieldValue.arrayUnion(teamRef.id),
        updatedAt: now
      });

      return {
        teamId: teamRef.id,
        teamName: teamData.teamName,
        joinCode: joinCode
      };
    });

    // 12. Return success response with proper message format
    return {
      success: true,
      data: result,
      message: `Team "${teamName.trim()}" created successfully!`
    };

  } catch (error) {
    // 14. Error handling with logging
    console.error('Error creating team:', error);
    if (error instanceof functions.https.HttpsError) {
      throw error;
    }
    throw new functions.https.HttpsError('internal', 'An unexpected error occurred while creating the team.');
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