/**
 * Auth Service
 * Manages authentication state and user profiles
 */

import { getAuth, getDb } from '../config/firebase.js';
import { isDevelopment } from '../config/firebase.js';
import stateService from './state.js';

const AuthService = (() => {
  // Private variables
  let initialized = false;
  let unsubscribeAuthState = null;
  let retryAttempts = 0;
  const MAX_RETRY_ATTEMPTS = 3;
  const RETRY_DELAY_MS = 1000;

  /**
   * Generate initials from display name
   * @param {string} displayName - User's display name
   * @returns {string} Two-letter initials
   */
  const generateInitials = (displayName) => {
    if (!displayName) return '??';
    
    const words = displayName.trim().split(/\s+/);
    if (words.length >= 2) {
      return (words[0][0] + words[1][0]).toUpperCase();
    }
    return (words[0][0] + (words[0][1] || '')).toUpperCase();
  };

  /**
   * Wait for State Service to be ready
   * @returns {Promise<void>}
   */
  const waitForStateService = async () => {
    let attempts = 0;
    while (attempts < 5) {
      if (stateService.isReady?.()) {
        return;
      }
      await new Promise(resolve => setTimeout(resolve, 100));
      attempts++;
    }
    throw new Error('State Service not ready');
  };

  /**
   * Fetch user profile with retry logic
   * @param {string} uid - Firebase user ID
   * @returns {Promise<Object|null>} User profile or null if not found
   */
  const fetchUserProfile = async (uid) => {
    try {
      const db = getDb();
      const doc = await db.collection('users').doc(uid).get();
      
      if (!doc.exists) {
        console.log('No profile found for user:', uid);
        return null;
      }

      const profile = doc.data();
      const teamIds = profile?.teams || [];

      // Fetch all teams in parallel
      const teamPromises = teamIds.map(async teamId => {
        try {
          const teamDoc = await db.collection('teams').doc(teamId).get();
          if (!teamDoc.exists) {
            console.warn(`Team ${teamId} not found - removing from user's teams`);
            // We'll handle cleanup of non-existent teams later
            return null;
          }
          
          const teamData = teamDoc.data();
          // Only include active teams where user is still in playerRoster
          if (teamData.status !== 'active') {
            console.warn(`Team ${teamId} is not active - skipping`);
            return null;
          }
          
          const userInRoster = teamData.playerRoster?.some(player => player.userId === uid);
          if (!userInRoster) {
            console.warn(`User ${uid} not in roster for team ${teamId} - data inconsistency detected`);
            return null;
          }

          return {
            id: teamDoc.id,
            ...teamData
          };
        } catch (error) {
          console.warn(`Failed to fetch team ${teamId}:`, error);
          return null;
        }
      });

      // Wait for all team fetches to complete
      const teams = (await Promise.all(teamPromises))
        .filter(team => team !== null);

      // Check if we need to clean up the user's teams array
      const validTeamIds = teams.map(team => team.id);
      if (validTeamIds.length < teamIds.length) {
        console.log('Cleaning up invalid team references...');
        try {
          await db.collection('users').doc(uid).update({
            teams: validTeamIds
          });
          // Update the profile's teams array to match
          profile.teams = validTeamIds;
        } catch (error) {
          console.warn('Failed to clean up invalid team references:', error);
          // Non-critical error, continue with auth flow
        }
      }

      return {
        uid,
        ...profile,
        teams,
        lastLogin: new Date().toISOString()
      };
    } catch (error) {
      console.error('Error fetching user profile:', error);
      
      // Retry on network errors
      if (error.code === 'unavailable' && retryAttempts < MAX_RETRY_ATTEMPTS) {
        retryAttempts++;
        console.log(`Retrying profile fetch (attempt ${retryAttempts})...`);
        await new Promise(resolve => setTimeout(resolve, RETRY_DELAY_MS));
        return fetchUserProfile(uid);
      }

      throw new Error('Failed to fetch user profile');
    }
  };

  /**
   * Update user's last login timestamp
   * @param {string} uid - Firebase user ID
   */
  const updateLastLogin = async (uid) => {
    try {
      const db = getDb();
      await db.collection('users').doc(uid).update({
        lastLogin: new Date().toISOString()
      });
    } catch (error) {
      console.warn('Could not update last login time:', error);
      // Non-critical error, don't throw
    }
  };

  /**
   * Handle auth state changes
   * @param {Object|null} firebaseUser - Firebase user object
   */
  const handleAuthStateChanged = async (firebaseUser) => {
    try {
      // Ensure State Service is ready
      await waitForStateService();

      if (firebaseUser) {
        console.log('👤 User signed in:', firebaseUser.email);
        
        // Reset retry counter
        retryAttempts = 0;
        
        // Fetch user profile
        const profile = await fetchUserProfile(firebaseUser.uid);
        
        // Update state with user info
        stateService.setState('user', {
          uid: firebaseUser.uid,
          email: firebaseUser.email,
          displayName: firebaseUser.displayName,
          photoURL: firebaseUser.photoURL,
          profile // Might be null if profile doesn't exist
        });

        // Handle team selection
        if (profile?.teams?.length > 0) {
          // Get previously selected team from local storage if it exists
          const lastTeamId = localStorage.getItem(`lastTeam_${firebaseUser.uid}`);
          
          // Check if last team is still valid
          const lastTeamStillValid = profile.teams.some(team => team.id === lastTeamId);
          
          if (lastTeamStillValid) {
            // Restore last selected team
            stateService.setState('currentTeam', lastTeamId);
          } else if (profile.teams.length === 1) {
            // Auto-select if user has exactly one team
            const teamId = profile.teams[0].id;
            stateService.setState('currentTeam', teamId);
            localStorage.setItem(`lastTeam_${firebaseUser.uid}`, teamId);
          } else {
            // Clear team selection if last team is invalid and user has multiple teams
            stateService.setState('currentTeam', null);
            localStorage.removeItem(`lastTeam_${firebaseUser.uid}`);
          }
        } else {
          // No teams - clear selection and storage
          stateService.setState('currentTeam', null);
          localStorage.removeItem(`lastTeam_${firebaseUser.uid}`);
        }

        // Update last login if profile exists
        if (profile) {
          updateLastLogin(firebaseUser.uid).catch(console.warn);
        }
      } else {
        console.log('👤 User signed out');
        // Clear user-related state and storage
        stateService.setState('user', null);
        stateService.setState('currentTeam', null);
        stateService.setState('favorites', []);
      }
    } catch (error) {
      console.error('Error in auth state change handler:', error);
      // Reset state on error but don't sign out - let Firebase auth state persist
      stateService.setState('user', null);
      stateService.setState('currentTeam', null);
      stateService.setState('favorites', []);
    }
  };

  /**
   * Initialize auth service and set up listeners
   */
  const init = () => {
    if (initialized) {
      console.warn('Auth service already initialized');
      return;
    }

    const auth = getAuth();
    
    // Set up auth state listener
    unsubscribeAuthState = auth.onAuthStateChanged(handleAuthStateChanged);
    
    initialized = true;
    console.log('🔐 Auth service initialized');
  };

  /**
   * Sign in with Google
   * @returns {Promise<void>}
   */
  const signInWithGoogle = async () => {
    try {
      const auth = getAuth();
      const provider = new firebase.auth.GoogleAuthProvider();
      provider.setCustomParameters({
        prompt: 'select_account'
      });
      
      // Always use signInWithRedirect for consistency between emulator and production
      await auth.signInWithRedirect(provider);
      
      // Auth state listener will handle the rest
    } catch (error) {
      console.error('Google sign-in failed:', error);
      throw new Error('Sign-in failed. Please try again.');
    }
  };

  /**
   * Sign out current user
   * @returns {Promise<void>}
   */
  const signOut = async () => {
    try {
      const auth = getAuth();
      await auth.signOut();
      // Auth state listener will handle state cleanup
    } catch (error) {
      console.error('Sign-out failed:', error);
      throw new Error('Sign-out failed. Please try again.');
    }
  };

  /**
   * Create or update user profile
   * @param {Object} profileData - Profile data to save
   * @returns {Promise<Object>} Updated profile
   */
  const updateProfile = async (profileData) => {
    const auth = getAuth();
    const user = auth.currentUser;
    
    if (!user) {
      throw new Error('Must be signed in to update profile');
    }

    try {
      const db = getDb();
      const profileRef = db.collection('users').doc(user.uid);
      
      // Ensure required fields
      const now = new Date().toISOString();
      const profile = {
        ...profileData,
        displayName: profileData.displayName || user.displayName,
        initials: profileData.initials || generateInitials(profileData.displayName || user.displayName),
        updatedAt: now,
        teams: profileData.teams || [],
      };

      // Add createdAt only if it's a new profile
      const doc = await profileRef.get();
      if (!doc.exists) {
        profile.createdAt = now;
      }

      // Merge with existing data
      await profileRef.set(profile, { merge: true });

      // Fetch and return updated profile
      const updatedProfile = await fetchUserProfile(user.uid);
      
      // Update state
      stateService.setState('user', {
        uid: user.uid,
        email: user.email,
        displayName: user.displayName,
        photoURL: user.photoURL,
        profile: updatedProfile
      });

      return updatedProfile;
    } catch (error) {
      console.error('Profile update failed:', error);
      throw new Error('Failed to update profile');
    }
  };

  /**
   * Get current Firebase user
   * @returns {Object|null} Firebase user object
   */
  const getCurrentUser = () => {
    const auth = getAuth();
    return auth.currentUser;
  };

  /**
   * Get user profile from state
   * @returns {Object|null} User profile
   */
  const getUserProfile = () => {
    const user = stateService.getState('user');
    return user?.profile || null;
  };

  /**
   * Refresh current user's profile from database
   * @returns {Promise<Object|null>} Updated profile or null if not authenticated
   */
  const refreshProfile = async () => {
    const auth = getAuth();
    const user = auth.currentUser;
    
    if (!user) {
      console.warn('Cannot refresh profile: user not authenticated');
      return null;
    }

    try {
      console.log('AuthService: Refreshing user profile...');
      const updatedProfile = await fetchUserProfile(user.uid);
      
      // Update state with refreshed profile
      stateService.setState('user', {
        uid: user.uid,
        email: user.email,
        displayName: user.displayName,
        photoURL: user.photoURL,
        profile: updatedProfile
      });

      console.log('AuthService: Profile refreshed successfully');
      return updatedProfile;
    } catch (error) {
      console.error('AuthService: Failed to refresh profile:', error);
      throw new Error('Failed to refresh profile');
    }
  };

  /**
   * Check if user is authenticated
   * @returns {boolean} True if user is signed in
   */
  const isAuthenticated = () => {
    return getCurrentUser() !== null;
  };

  /**
   * Check if user has created profile
   * @returns {boolean} True if user has profile
   */
  const hasProfile = () => {
    return getUserProfile() !== null;
  };

  /**
   * Clean up service
   */
  const cleanup = () => {
    if (unsubscribeAuthState) {
      unsubscribeAuthState();
      unsubscribeAuthState = null;
    }
    initialized = false;
    retryAttempts = 0;
  };

  // Public API
  return {
    init,
    signInWithGoogle,
    signOut,
    updateProfile,
    getCurrentUser,
    getUserProfile,
    isAuthenticated,
    hasProfile,
    cleanup,
    refreshProfile
  };
})();

// Export the service instance
export default AuthService;

// Export individual methods for convenience
export const {
  signInWithGoogle,
  signOut,
  updateProfile,
  getCurrentUser,
  getUserProfile,
  isAuthenticated,
  hasProfile,
  refreshProfile
} = AuthService; 