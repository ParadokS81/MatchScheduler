/**
 * Auth Service
 * Manages authentication state and user profiles
 */

import { auth, db, functions, isDevelopment } from '../config/firebase.js';
import { 
    GoogleAuthProvider,
    signInWithPopup,
    signOut as firebaseSignOut,
    onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { 
    httpsCallable 
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-functions.js";
import { 
    doc, 
    getDoc, 
    updateDoc 
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
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
    console.log('🔍 fetchUserProfile called for uid:', uid);
    try {
      // Use the pre-initialized db service
      console.log('📂 Getting user document from Firestore...');
      const userDocRef = doc(db, 'users', uid);
      const docSnap = await getDoc(userDocRef);
      console.log('📂 Document fetch result:', { exists: docSnap.exists(), id: docSnap.id });
      
      if (!docSnap.exists()) {
        console.log('❌ No profile found for user:', uid);
        return null;
      }

      const profile = docSnap.data();
      
      // DEFENSIVE HANDLING: Handle legacy array format or malformed data
      let teams = profile?.teams;
      let needsMigration = false;
      
      if (!teams) {
        // Handle null/undefined - use empty map
        teams = {};
      } else if (Array.isArray(teams)) {
        // MIGRATION: Convert legacy array format to map
        console.log('Migrating user teams from array to map format');
        const teamsMap = {};
        teams.forEach(teamId => {
          if (teamId && typeof teamId === 'string') {
            teamsMap[teamId] = true;
          }
        });
        teams = teamsMap;
        needsMigration = true;
      } else if (typeof teams !== 'object') {
        // Handle malformed data - reset to empty map
        console.warn('Invalid teams data format, resetting to empty map');
        teams = {};
        needsMigration = true;
      }

      // Get team IDs safely from map
      const teamIds = Object.keys(teams);

      // Fetch all teams in parallel
      const teamPromises = teamIds.map(async teamId => {
        try {
          const teamDocRef = doc(db, 'teams', teamId);
          const teamDocSnap = await getDoc(teamDocRef);
          if (!teamDocSnap.exists()) {
            console.warn(`Team ${teamId} not found - removing from user's teams`);
            // We'll handle cleanup of non-existent teams later
            return null;
          }
          
          const teamData = teamDocSnap.data();
          // Only include active teams where user is still in playerRoster
          if (!teamData.active) {
            console.warn(`Team ${teamId} is not active - skipping`);
            return null;
          }
          
          const userInRoster = teamData.playerRoster?.some(player => player.userId === uid);
          if (!userInRoster) {
            console.warn(`User ${uid} not in roster for team ${teamId} - data inconsistency detected`);
            return null;
          }

          return {
            id: teamDocSnap.id,
            ...teamData
          };
        } catch (error) {
          console.warn(`Failed to fetch team ${teamId}:`, error);
          return null;
        }
      });

      // Wait for all team fetches to complete
      const fetchedTeams = (await Promise.all(teamPromises))
        .filter(team => team !== null);

      // Check if we need to clean up the user's teams map or migrate data
      const validTeamIds = fetchedTeams.map(team => team.id);
      if (validTeamIds.length < teamIds.length || needsMigration) {
        console.log('Cleaning up invalid team references or migrating data...');
        try {
          const validTeamsMap = {};
          validTeamIds.forEach(teamId => {
            validTeamsMap[teamId] = true;
          });
          const userUpdateRef = doc(db, 'users', uid);
          await updateDoc(userUpdateRef, {
            teams: validTeamsMap
          });
          // Update the profile's teams map to match
          profile.teams = validTeamsMap;
        } catch (error) {
          console.warn('Failed to clean up invalid team references:', error);
          // Non-critical error, continue with auth flow
        }
      }

      return {
        uid,
        ...profile,
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
      // Use the pre-initialized db service
      const userRef = doc(db, 'users', uid);
      await updateDoc(userRef, {
        lastLogin: new Date().toISOString()
      });
    } catch (error) {
      console.warn('Could not update last login time:', error);
      // Non-critical error, don't throw
    }
  };

  /**
   * Debug logger that persists across page reloads
   */
  const debugLog = (message, data = null) => {
    const timestamp = new Date().toISOString();
    const logEntry = `[${timestamp}] ${message}`;
    console.log(logEntry, data || '');
    
    // Also store in localStorage for debugging
    try {
      const logs = JSON.parse(localStorage.getItem('authDebugLogs') || '[]');
      logs.push({ timestamp, message, data });
      // Keep only last 50 entries
      if (logs.length > 50) logs.splice(0, logs.length - 50);
      localStorage.setItem('authDebugLogs', JSON.stringify(logs));
    } catch (e) {
      // Ignore localStorage errors
    }
  };

  /**
   * View debug logs (call from console)
   */
  const viewDebugLogs = () => {
    try {
      const logs = JSON.parse(localStorage.getItem('authDebugLogs') || '[]');
      console.log('📋 Auth Debug Logs:');
      logs.forEach(log => {
        console.log(`${log.timestamp}: ${log.message}`, log.data || '');
      });
      return logs;
    } catch (e) {
      console.log('No debug logs found');
      return [];
    }
  };

  // Make viewDebugLogs available globally for debugging
  window.viewAuthDebugLogs = viewDebugLogs;

  /**
   * Handle auth state changes
   * @param {Object|null} firebaseUser - Firebase user object
   */
  const handleAuthStateChanged = async (firebaseUser) => {
    debugLog('🔄 AUTH STATE CHANGE - Start processing...');
    
    try {
              // Ensure State Service is ready
        debugLog('⏳ Waiting for state service...');
        await waitForStateService();
        debugLog('✅ State service ready');

        if (firebaseUser) {
          debugLog('👤 User signed in:', firebaseUser.email);
          debugLog('📋 User details:', {
            uid: firebaseUser.uid,
            email: firebaseUser.email,
            displayName: firebaseUser.displayName,
            photoURL: firebaseUser.photoURL
          });
        
        // Reset retry counter
        retryAttempts = 0;
        
        // Fetch user profile
        console.log('🔍 Fetching user profile...');
        const profile = await fetchUserProfile(firebaseUser.uid);
        console.log('📄 Profile fetched:', profile ? 'Profile exists' : 'No profile found');
        if (profile) {
          console.log('📄 Profile data:', profile);
        }
        
        // Update state with user info
        console.log('🔄 Updating user state...');
        stateService.setState('user', {
          uid: firebaseUser.uid,
          email: firebaseUser.email,
          displayName: firebaseUser.displayName,
          photoURL: firebaseUser.photoURL,
          profile // Might be null if profile doesn't exist
        });
        console.log('✅ User state updated');

        // Handle team selection
        const userTeamIds = profile?.teams ? Object.keys(profile.teams) : [];
        console.log('🏆 User teams:', userTeamIds);
        
        if (userTeamIds.length > 0) {
          // Get previously selected team from local storage if it exists
          const lastTeamId = localStorage.getItem(`lastTeam_${firebaseUser.uid}`);
          console.log('💾 Last team from storage:', lastTeamId);
          
          // Check if last team is still valid
          const lastTeamStillValid = userTeamIds.includes(lastTeamId);
          
          if (lastTeamStillValid) {
            // Restore last selected team
            console.log('✅ Restoring last team:', lastTeamId);
            stateService.setState('currentTeam', lastTeamId);
          } else if (userTeamIds.length === 1) {
            // Auto-select if user has exactly one team
            const teamId = userTeamIds[0];
            console.log('🎯 Auto-selecting single team:', teamId);
            stateService.setState('currentTeam', teamId);
            localStorage.setItem(`lastTeam_${firebaseUser.uid}`, teamId);
          } else {
            // Clear team selection if last team is invalid and user has multiple teams
            console.log('🚫 Clearing team selection (multiple teams, no valid last team)');
            stateService.setState('currentTeam', null);
            localStorage.removeItem(`lastTeam_${firebaseUser.uid}`);
          }
        } else {
          // No teams - clear selection and storage
          console.log('🚫 No teams - clearing team selection');
          stateService.setState('currentTeam', null);
          localStorage.removeItem(`lastTeam_${firebaseUser.uid}`);
        }

        // Update last login if profile exists
        if (profile) {
          console.log('⏰ Updating last login...');
          updateLastLogin(firebaseUser.uid).catch(console.warn);
        }
        
        console.log('✅ AUTH STATE CHANGE - Complete (signed in)');
      } else {
        console.log('👤 User signed out');
        // Clear user-related state and storage
        stateService.setState('user', null);
        stateService.setState('currentTeam', null);
        stateService.setState('favorites', []);
        console.log('✅ AUTH STATE CHANGE - Complete (signed out)');
      }
    } catch (error) {
      console.error('❌ ERROR in auth state change handler:', error);
      console.error('❌ Error stack:', error.stack);
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

    // Use the pre-initialized auth service
    if (!auth) {
      throw new Error('Auth service not available. Ensure firebase.js is loaded first.');
    }
    
    // Set up auth state listener
    unsubscribeAuthState = onAuthStateChanged(auth, handleAuthStateChanged);
    
    initialized = true;
    console.log('🔐 Auth service initialized');
  };

  /**
   * Sign in with Google
   * @returns {Promise<void>}
   */
  const signInWithGoogle = async () => {
    try {
      // Use the pre-initialized auth service
      const provider = new GoogleAuthProvider();
      provider.setCustomParameters({
        prompt: 'select_account'
      });
      
      // Try popup method instead of redirect to avoid domain issues
      debugLog('🚀 Starting Google sign-in with popup...');
      const result = await signInWithPopup(auth, provider);
      debugLog('✅ Sign-in popup completed:', result.user ? 'Success' : 'Failed');
      
      // Auth state listener will handle the rest
    } catch (error) {
      debugLog('❌ Google sign-in failed:', error.message);
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
      // Use the pre-initialized auth service
      await firebaseSignOut(auth);
      // Auth state listener will handle state cleanup
    } catch (error) {
      console.error('Sign-out failed:', error);
      throw new Error('Sign-out failed. Please try again.');
    }
  };

  /**
   * Create or update user profile using Cloud Functions
   * @param {Object} profileData - Profile data to save
   * @returns {Promise<Object>} Updated profile
   */
  const updateProfile = async (profileData) => {
    // Use the pre-initialized auth service
    const user = auth.currentUser;
    
    if (!user) {
      throw new Error('Must be signed in to update profile');
    }

    try {
      // Use the pre-initialized functions service
      
      // Check if profile exists to determine which function to call
      const existingProfile = await fetchUserProfile(user.uid);
      const functionName = existingProfile ? 'updateProfile' : 'createProfile';
      
      console.log(`AuthService: Calling ${functionName} with data:`, profileData);
      
      // Call the appropriate Cloud Function
      const functionRef = httpsCallable(functions, functionName);
      const result = await functionRef(profileData);
      
      if (result.data.success) {
        console.log('AuthService: Profile operation successful');
        
        // Use the data returned by the Cloud Function instead of fetching again
        // This avoids timing issues with Firestore eventual consistency
        const profileData = result.data.data;
        
        // Update state with the profile data from the function response
        stateService.setState('user', {
          uid: user.uid,
          email: user.email,
          displayName: user.displayName,
          photoURL: user.photoURL,
          profile: profileData
        });

        return profileData;
      } else {
        throw new Error(result.data.message || 'Profile operation failed');
      }
    } catch (error) {
      console.error('Profile update failed:', error);
      throw new Error(error.message || 'Failed to update profile');
    }
  };

  /**
   * Get current Firebase user
   * @returns {Object|null} Firebase user object
   */
  const getCurrentUser = () => {
    // Use the pre-initialized auth service
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
    // Use the pre-initialized auth service
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

      // Handle team selection after profile refresh (same logic as in handleAuthStateChanged)
      const userTeamIds = updatedProfile?.teams ? Object.keys(updatedProfile.teams) : [];
      console.log('🏆 User teams after refresh:', userTeamIds);
      
      if (userTeamIds.length > 0) {
        // Get current team selection
        const currentTeam = stateService.getState('currentTeam');
        
        // Get previously selected team from local storage if it exists
        const lastTeamId = localStorage.getItem(`lastTeam_${user.uid}`);
        console.log('💾 Last team from storage:', lastTeamId);
        
        // Check if current team is still valid
        const currentTeamStillValid = currentTeam && userTeamIds.includes(currentTeam);
        
        // Check if last team is still valid
        const lastTeamStillValid = userTeamIds.includes(lastTeamId);
        
        if (!currentTeamStillValid) {
          // Current team is not valid, need to select a new one
          if (lastTeamStillValid) {
            // Restore last selected team
            console.log('✅ Restoring last team after refresh:', lastTeamId);
            stateService.setState('currentTeam', lastTeamId);
          } else if (userTeamIds.length === 1) {
            // Auto-select if user has exactly one team
            const teamId = userTeamIds[0];
            console.log('🎯 Auto-selecting single team after refresh:', teamId);
            stateService.setState('currentTeam', teamId);
            localStorage.setItem(`lastTeam_${user.uid}`, teamId);
          } else {
            // If user has multiple teams and no valid selection, don't auto-select
            console.log('🚫 Multiple teams, no auto-selection after refresh');
            stateService.setState('currentTeam', null);
            localStorage.removeItem(`lastTeam_${user.uid}`);
          }
        }
      } else {
        // No teams available, clear selection
        console.log('🚫 No teams available after refresh');
        stateService.setState('currentTeam', null);
        localStorage.removeItem(`lastTeam_${user.uid}`);
      }

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

  /**
   * Get user ID from user object (single source of truth)
   * @param {Object} user - User object from state
   * @returns {string|null} User ID or null if not available
   */
  const getUserId = (user) => {
    // Primary: Use uid from Firebase Auth (always present when signed in)
    if (user?.uid) return user.uid;
    
    // Fallback: Use uid from profile (should match the above)
    if (user?.profile?.uid) return user.profile.uid;
    
    // No valid user ID found
    return null;
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
    getUserId,
    cleanup,
    refreshProfile,
    
    // Debug utilities (dev only)
    ...(isDevelopment() ? { viewDebugLogs } : {})
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
  getUserId,
  refreshProfile
} = AuthService; 