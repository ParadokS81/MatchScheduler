// profile.js - User profile management functions
// TODO: Implement according to Technical PRD Section 3.1

const functions = require('firebase-functions');
const admin = require('firebase-admin');
const { FieldValue } = require("firebase-admin/firestore");

/**
 * Creates a new user profile after authentication
 * @param {Object} data - Profile data
 * @param {string} data.displayName - User's display name (2-20 characters)
 * @param {string} data.initials - User's initials (exactly 3 characters)
 * @param {string} [data.discordUsername] - Optional Discord username
 */
exports.createProfile = functions.https.onCall(async (data, context) => {
  const db = admin.firestore();
  
  // Verify authentication
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'User must be logged in');
  }
  
  const userId = context.auth.uid;
  const { displayName, initials, discordUsername } = data;
  
  // Validate display name
  if (!displayName || typeof displayName !== 'string') {
    throw new functions.https.HttpsError('invalid-argument', 'Display name must be provided');
  }
  
  const trimmedDisplayName = displayName.trim();
  if (trimmedDisplayName.length < 2 || trimmedDisplayName.length > 20) {
    throw new functions.https.HttpsError('invalid-argument', 'Display name must be 2-20 characters');
  }
  
  const validDisplayNameRegex = /^[a-zA-Z0-9\s]+$/;
  if (!validDisplayNameRegex.test(trimmedDisplayName)) {
    throw new functions.https.HttpsError('invalid-argument', 'Display name must be alphanumeric with spaces only');
  }
  
  // Validate initials
  if (!initials || typeof initials !== 'string') {
    throw new functions.https.HttpsError('invalid-argument', 'Initials must be provided');
  }
  
  if (initials.length !== 3) {
    throw new functions.https.HttpsError('invalid-argument', 'Initials must be exactly 3 characters');
  }
  
  // Validate optional discord username if provided
  if (discordUsername !== undefined && (typeof discordUsername !== 'string' || !discordUsername.trim())) {
    throw new functions.https.HttpsError('invalid-argument', 'Discord username if provided must be a non-empty string');
  }
  
  try {
    // Check if profile already exists
    const existingProfile = await db.collection('users').doc(userId).get();
    if (existingProfile.exists) {
      throw new functions.https.HttpsError('already-exists', 'Profile already exists');
    }
    
    // Create profile
    const profileData = {
      userId: userId,
      displayName: trimmedDisplayName,
      initials: initials.toUpperCase(),
      createdAt: FieldValue.serverTimestamp(),
      teams: [],
      savedTemplates: {}
    };
    
    // Add optional fields
    if (discordUsername) {
      profileData.discordUsername = discordUsername.trim();
    }
    
    // Get photo URL from auth provider
    const picture = context.auth?.token?.picture;
    if (picture) {
      profileData.photoURL = picture;
    }
    
    // Save to Firestore
    await db.collection('users').doc(userId).set(profileData);
    
    console.log(`Profile created successfully for user ${userId}`);
    
    return {
      success: true,
      data: profileData,
      message: 'Profile created successfully'
    };
    
  } catch (error) {
    console.error('Create profile error:', error);
    if (error instanceof functions.https.HttpsError) {
      throw error;
    }
    throw new functions.https.HttpsError('internal', 'Failed to create profile');
  }
});

/**
 * Updates an existing user profile and associated team rosters
 * @param {Object} data - Profile update data
 * @param {string} [data.displayName] - Optional: User's display name (2-20 characters, alphanumeric with spaces)
 * @param {string} [data.initials] - Optional: User's initials (exactly 3 characters, alphanumeric)
 * @param {string|null} [data.discordUsername] - Optional: Discord username (null to remove)
 * @throws {functions.https.HttpsError} On validation failure or team roster conflicts
 */
exports.updateProfile = functions.https.onCall(async (data, context) => {
  const db = admin.firestore();
  
  // Verify authentication
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'User must be logged in');
  }
  
  const userId = context.auth.uid;
  const { displayName, initials, discordUsername } = data;
  
  // Must update at least one field
  if (!displayName && !initials && discordUsername === undefined) {
    throw new functions.https.HttpsError('invalid-argument', 'No updates provided');
  }
  
  try {
    // Get user profile
    const userDoc = await db.collection('users').doc(userId).get();
    if (!userDoc.exists) {
      throw new functions.https.HttpsError('not-found', 'Profile not found');
    }
    
    const userData = userDoc.data();
    const updates = {};
    
    // Validate display name if provided
    if (displayName !== undefined) {
      if (typeof displayName !== 'string' || !displayName.trim()) {
        throw new functions.https.HttpsError('invalid-argument', 'Display name must be a non-empty string');
      }
      
      const trimmedDisplayName = displayName.trim();
      if (trimmedDisplayName.length < 2 || trimmedDisplayName.length > 20) {
        throw new functions.https.HttpsError('invalid-argument', 'Display name must be 2-20 characters');
      }
      
      const validDisplayNameRegex = /^[a-zA-Z0-9\s]+$/;
      if (!validDisplayNameRegex.test(trimmedDisplayName)) {
        throw new functions.https.HttpsError('invalid-argument', 'Display name must be alphanumeric with spaces only');
      }
      
      updates.displayName = trimmedDisplayName;
    }
    
    // Validate initials if provided
    if (initials !== undefined) {
      if (typeof initials !== 'string' || !initials.trim()) {
        throw new functions.https.HttpsError('invalid-argument', 'Initials must be a non-empty string');
      }
      
      if (initials.length !== 3) {
        throw new functions.https.HttpsError('invalid-argument', 'Initials must be exactly 3 characters');
      }
      
      const validInitialsRegex = /^[A-Z0-9]{3}$/;
      if (!validInitialsRegex.test(initials.toUpperCase())) {
        throw new functions.https.HttpsError('invalid-argument', 'Initials must be alphanumeric');
      }
      
      const newInitials = initials.toUpperCase();
      
      // Check for conflicts within user's teams
      if (userData.teams && userData.teams.length > 0) {
        const teamChecks = userData.teams.map(async teamId => {
          const teamDoc = await db.collection('teams').doc(teamId).get();
          if (teamDoc.exists) {
            const teamData = teamDoc.data();
            const conflict = teamData.playerRoster.some(
              p => p.initials === newInitials && p.userId !== userId
            );
            if (conflict) {
              throw new functions.https.HttpsError(
                'already-exists',
                `Initials "${newInitials}" already taken by another player on team ${teamData.teamName}`
              );
            }
          }
        });
        
        // Wait for all team checks to complete
        await Promise.all(teamChecks);
      }
      
      updates.initials = newInitials;
    }
    
    // Handle discord username
    if (discordUsername !== undefined) {
      if (discordUsername !== null && (typeof discordUsername !== 'string' || !discordUsername.trim())) {
        throw new functions.https.HttpsError('invalid-argument', 'Discord username must be a non-empty string or null');
      }
      updates.discordUsername = discordUsername ? discordUsername.trim() : null;
    }
    
    // Add update timestamp
    updates.updatedAt = FieldValue.serverTimestamp();
    
    // Update profile and all team rosters in transaction
    await db.runTransaction(async (transaction) => {
      // Update user profile
      transaction.update(userDoc.ref, updates);
      
      // Update team rosters if display name or initials changed
      if ((updates.displayName || updates.initials) && userData.teams) {
        const teamUpdates = userData.teams.map(async teamId => {
          const teamRef = db.collection('teams').doc(teamId);
          const teamDoc = await transaction.get(teamRef);
          
          if (teamDoc.exists) {
            const teamData = teamDoc.data();
            const updatedRoster = teamData.playerRoster.map(player => {
              if (player.userId === userId) {
                return {
                  ...player, // Preserve other player data
                  displayName: updates.displayName || player.displayName,
                  initials: updates.initials || player.initials
                };
              }
              return player;
            });
            
            transaction.update(teamRef, { 
              playerRoster: updatedRoster,
              updatedAt: FieldValue.serverTimestamp()
            });
          }
        });
        
        await Promise.all(teamUpdates);
      }
    });
    
    console.log(`Profile updated successfully for user ${userId}`, updates);
    
    return {
      success: true,
      data: updates,
      message: 'Profile updated successfully'
    };
    
  } catch (error) {
    console.error('Update profile error:', error);
    if (error instanceof functions.https.HttpsError) {
      throw error;
    }
    throw new functions.https.HttpsError('internal', 'Failed to update profile');
  }
}); 