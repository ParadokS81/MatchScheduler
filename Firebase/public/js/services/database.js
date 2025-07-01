/**
 * Database Service
 * Wraps Firebase Cloud Functions and Firestore operations
 * Provides real-time listeners and utility methods
 */

import { db, functions, storage } from '../config/firebase.js';
import { 
    ref, 
    uploadBytes, 
    getDownloadURL 
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-storage.js";
import { 
    httpsCallable 
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-functions.js";
import { 
    enableNetwork, 
    disableNetwork,
    doc,
    getDoc,
    onSnapshot,
    query,
    collection,
    where,
    getDocs
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const DatabaseService = (() => {
  // Private variables
  let initialized = false;
  
  // Active subscriptions for cleanup
  const activeSubscriptions = new Map();
  const MAX_SUBSCRIPTIONS = 50; // Limit total active subscriptions

  // Connection state
  let isOnline = true;
  const connectionStateCallbacks = new Set();

  /**
   * Validate required parameters
   * @param {Object} params - Parameters to validate
   * @param {Array<string>} required - Required parameter names
   * @throws {Error} If validation fails
   */
  const validateParams = (params, required) => {
    if (!params || typeof params !== 'object') {
      throw new Error('Invalid parameters: Expected object');
    }
    
    for (const param of required) {
      if (params[param] === undefined || params[param] === null) {
        throw new Error(`Missing required parameter: ${param}`);
      }
    }
  };

  /**
   * Handle Cloud Function response
   * @param {Object} response - Function response
   * @returns {Object} Processed response data
   * @throws {Error} If response indicates failure
   */
  const handleFunctionResponse = (response) => {
    console.log('Handling function response:', response);
    
    // Check if response is already in the correct format
    if (response && typeof response === 'object' && 'success' in response) {
      if (!response.success) {
        throw new Error(response.message || 'Operation failed');
      }
      return response;
    }
    
    // If not, wrap it in our standard format
    return {
      success: true,
      data: response,
      message: 'Operation successful'
    };
  };

  /**
   * Initialize the service
   * @throws {Error} If initialization fails
   */
  const init = () => {
    if (initialized) {
      console.warn('Database Service already initialized');
      return;
    }

    try {
      // Firebase services are already initialized in firebase.js
      // Just verify they're available
      if (!db || !functions || !storage) {
        throw new Error('Firebase services not available. Ensure firebase.js is loaded first.');
      }
      
      // Set up connection state monitoring using Firestore's built-in network state
      enableNetwork(db).then(() => {
        isOnline = true;
        notifyConnectionState(true);
      }).catch(() => {
        isOnline = false;
        notifyConnectionState(false);
      });
      
      // Monitor network state changes (this is more reliable)
      // Note: In a real implementation, you'd want to use proper network state detection
      // For now, we'll assume online state after successful initialization
      isOnline = true;

      initialized = true;
      console.log('📦 Database Service initialized');
    } catch (error) {
      console.error('Database Service initialization failed:', error);
      throw new Error('Failed to initialize Database Service');
    }
  };

  /**
   * Notify subscribers of connection state changes
   * @param {boolean} online - Connection state
   */
  const notifyConnectionState = (online) => {
    connectionStateCallbacks.forEach(callback => {
      try {
        callback(online);
      } catch (error) {
        console.warn('Connection state callback error:', error);
      }
    });
  };

  /**
   * Subscribe to connection state changes
   * @param {Function} callback - Called with boolean online state
   * @returns {Function} Unsubscribe function
   */
  const onConnectionStateChange = (callback) => {
    connectionStateCallbacks.add(callback);
    // Immediately notify of current state
    callback(isOnline);
    
    return () => connectionStateCallbacks.delete(callback);
  };

  /**
   * Ensure service is initialized before operations
   * @throws {Error} If service not initialized
   */
  const ensureInitialized = () => {
    if (!initialized) {
      throw new Error('Database Service not initialized');
    }
  };

  /**
   * Track subscription for cleanup
   * @param {string} key - Subscription identifier
   * @param {Function} unsubscribe - Unsubscribe function
   * @throws {Error} If max subscriptions reached
   */
  const trackSubscription = (key, unsubscribe) => {
    if (activeSubscriptions.size >= MAX_SUBSCRIPTIONS) {
      unsubscribe(); // Clean up the new subscription
      throw new Error('Maximum number of active subscriptions reached');
    }

    // Clean up existing subscription if any
    if (activeSubscriptions.has(key)) {
      activeSubscriptions.get(key)();
    }
    activeSubscriptions.set(key, unsubscribe);
  };

  // Cloud Function Wrappers

  /**
   * Create a new user profile
   * @param {Object} profileData - Profile data
   * @returns {Promise<Object>} Processed response data
   */
  const createProfile = async (profileData) => {
    ensureInitialized();
    validateParams(profileData, ['displayName']);
    
    try {
      const createProfileFn = httpsCallable(functions, 'createProfile');
      const result = await createProfileFn(profileData);
      return handleFunctionResponse(result.data);
    } catch (error) {
      console.error('Database Service: createProfile failed:', error);
      throw new Error(error.message || 'Failed to create profile');
    }
  };

  /**
   * Update user profile
   * @param {Object} profileData - Updated profile data
   * @returns {Promise<Object>} Processed response data
   */
  const updateProfile = async (profileData) => {
    ensureInitialized();
    validateParams(profileData, ['displayName']);
    
    try {
      const updateProfileFn = httpsCallable(functions, 'updateProfile');
      const result = await updateProfileFn(profileData);
      return handleFunctionResponse(result.data);
    } catch (error) {
      console.error('Database Service: updateProfile failed:', error);
      throw new Error(error.message || 'Failed to update profile');
    }
  };

  /**
   * Create a new team
   * @param {Object} teamData - Team creation data
   * @returns {Promise<Object>} Processed response data
   */
  const createTeam = async (teamData) => {
    ensureInitialized();
    validateParams(teamData, ['teamName', 'divisions']);
    
    try {
      console.log('Creating team with data:', teamData);
      const createTeamFn = httpsCallable(functions, 'createTeam');
      const result = await createTeamFn(teamData);
      console.log('Raw team creation result:', result);
      
      const processedResponse = handleFunctionResponse(result.data);
      console.log('Processed team creation response:', processedResponse);
      
      return processedResponse;
    } catch (error) {
      console.error('Database Service: createTeam failed:', error);
      throw new Error(error.message || 'Failed to create team');
    }
  };

  /**
   * Join a team using join code
   * @param {Object} params - Parameters containing joinCode
   * @returns {Promise<Object>} Response with success, data, message
   */
  const joinTeam = async ({ joinCode }) => {
    ensureInitialized();
    try {
      const joinTeamFn = httpsCallable(functions, 'joinTeam');
      const result = await joinTeamFn({ joinCode });
      return result.data;
    } catch (error) {
      console.error('Database Service: joinTeam failed:', error);
      throw new Error(error.message || 'Failed to join team');
    }
  };

  /**
   * Leave a team
   * @param {Object} params - Parameters containing teamId and optional archiveNote
   * @returns {Promise<Object>} Response with success, data, message
   */
  const leaveTeam = async ({ teamId, archiveNote }) => {
    ensureInitialized();
    try {
      const params = { teamId };
      if (archiveNote !== undefined && archiveNote !== null && archiveNote !== '') {
        params.archiveNote = archiveNote;
      }
      const leaveTeamFn = httpsCallable(functions, 'leaveTeam');
      const result = await leaveTeamFn(params);
      return result.data;
    } catch (error) {
      console.error('Database Service: leaveTeam failed:', error);
      throw new Error(error.message || 'Failed to leave team');
    }
  };

  /**
   * Uploads a logo to the temporary storage path.
   * @param {Blob} fileBlob - The image file blob to upload.
   * @param {string} teamId - The ID of the team.
   * @param {string} userId - The ID of the user uploading the file.
   * @returns {Promise<string>} The full path of the uploaded file in Cloud Storage.
   */
  const uploadLogo = async (fileBlob, teamId, userId) => {
    ensureInitialized();
    if (!fileBlob || !teamId || !userId) {
      throw new Error("Missing required parameters for logo upload.");
    }

    // Use the pre-initialized storage service
    const uniqueFileName = `logo_${Date.now()}.png`;
    const storagePath = `logo-uploads/${teamId}/${userId}/${uniqueFileName}`;
    const storageRef = ref(storage, storagePath);

    console.log(`Uploading logo to: ${storagePath}`);

    try {
      const snapshot = await uploadBytes(storageRef, fileBlob);
      console.log('Upload successful!', snapshot);
      return snapshot.ref.fullPath; // Return the full path for the backend function to find.
    } catch (error) {
      console.error("Error uploading logo to Firebase Storage:", error);
      // Re-throw the error to be handled by the calling function.
      throw new Error("Failed to upload logo.");
    }
  };

  /**
   * Remove a player from a team
   * @param {Object} params - Parameters containing teamId and targetUserId
   * @returns {Promise<Object>} Response with success, data, message
   */
  const removePlayer = async ({ teamId, targetUserId }) => {
    ensureInitialized();
    try {
      const removePlayerFn = httpsCallable(functions, 'removePlayer');
      const result = await removePlayerFn({ teamId, targetUserId });
      return result.data;
    } catch (error) {
      console.error('Database Service: removePlayer failed:', error);
      throw new Error(error.message || 'Failed to remove player');
    }
  };

  /**
   * Update team settings
   * @param {Object} params - Parameters containing teamId and settings
   * @returns {Promise<Object>} Response with success, data, message
   */
  const updateTeamSettings = async ({ teamId, ...settings }) => {
    ensureInitialized();
    try {
      const updateTeamSettingsFn = httpsCallable(functions, 'updateTeamSettings');
      const result = await updateTeamSettingsFn({ teamId, ...settings });
      return result.data;
    } catch (error) {
      console.error('Database Service: updateTeamSettings failed:', error);
      throw new Error(error.message || 'Failed to update team settings');
    }
  };

  /**
   * Regenerate team join code
   * @param {Object} params - Parameters containing teamId
   * @returns {Promise<Object>} Response with success, data, message
   */
  const regenerateJoinCode = async ({ teamId }) => {
    ensureInitialized();
    try {
      const regenerateJoinCodeFn = httpsCallable(functions, 'regenerateJoinCode');
      const result = await regenerateJoinCodeFn({ teamId });
      return result.data;
    } catch (error) {
      console.error('Database Service: regenerateJoinCode failed:', error);
      throw new Error(error.message || 'Failed to regenerate join code');
    }
  };

  /**
   * Transfer team leadership
   * @param {Object} params - Parameters containing teamId and newLeaderId
   * @returns {Promise<Object>} Response with success, data, message
   */
  const transferLeadership = async ({ teamId, newLeaderId }) => {
    ensureInitialized();
    try {
      const transferLeadershipFn = httpsCallable(functions, 'transferLeadership');
      const result = await transferLeadershipFn({ teamId, newLeaderId });
      return result.data;
    } catch (error) {
      console.error('Database Service: transferLeadership failed:', error);
      throw new Error(error.message || 'Failed to transfer leadership');
    }
  };

  /**
   * Update availability
   * @param {Object} params - Parameters containing teamId, weekId, action, slots
   * @returns {Promise<Object>} Response with success, data, message
   */
  const updateAvailability = async ({ teamId, weekId, action, slots }) => {
    ensureInitialized();
    try {
      const updateAvailabilityFn = httpsCallable(functions, 'updateAvailability');
      const result = await updateAvailabilityFn({ 
        teamId, weekId, action, slots 
      });
      return result.data;
    } catch (error) {
      console.error('Database Service: updateAvailability failed:', error);
      throw new Error(error.message || 'Failed to update availability');
    }
  };

  // Real-time Listeners with Reconnection Logic

  /**
   * Create a resilient snapshot listener
   * @param {Object} ref - Firestore reference
   * @param {Function} onData - Data callback
   * @param {Function} onError - Error callback
   * @returns {Function} Unsubscribe function
   */
  const createResilientListener = (ref, onData, onError) => {
    let unsubscribe = null;
    let retryCount = 0;
    const MAX_RETRIES = 3;
    const RETRY_DELAY = 1000;

    const startListener = () => {
      unsubscribe = onSnapshot(
        ref,
        (snapshot) => {
          retryCount = 0; // Reset on successful update
          onData(snapshot);
        },
        (error) => {
          console.error('Subscription error:', error);
          onError(error);

          if (retryCount < MAX_RETRIES) {
            retryCount++;
            console.log(`Retrying subscription (attempt ${retryCount})...`);
            setTimeout(() => {
              if (unsubscribe) {
                unsubscribe();
                startListener();
              }
            }, RETRY_DELAY * retryCount);
          }
        }
      );
    };

    startListener();
    return () => unsubscribe && unsubscribe();
  };

  /**
   * Subscribe to team document changes
   * @param {string} teamId - Team ID to subscribe to
   * @param {Function} callback - Callback function(teamData, error)
   * @returns {Function} Unsubscribe function
   */
  const subscribeToTeam = (teamId, callback) => {
    ensureInitialized();
    validateParams({ teamId }, ['teamId']);
    
    const teamDocRef = doc(db, 'teams', teamId);
    const unsubscribe = createResilientListener(
      teamDocRef,
      (docSnap) => {
        if (docSnap.exists()) {
          callback({ id: docSnap.id, ...docSnap.data() });
        } else {
          callback(null);
        }
      },
      (error) => callback(null, error)
    );

    trackSubscription(`team_${teamId}`, unsubscribe);
    return unsubscribe;
  };

  /**
   * Subscribe to availability changes
   * @param {string} teamId - Team ID
   * @param {string} weekId - Week identifier
   * @param {Function} callback - Callback function(availabilityData, error)
   * @returns {Function} Unsubscribe function
   */
  const subscribeToAvailability = (teamId, weekId, callback) => {
    ensureInitialized();
    
    // PRD specifies top-level availability collection with compound document IDs
    // Document ID format: {teamId}_{weekId} (e.g., "team_abc123_2025-W26")
    const documentId = `${teamId}_${weekId}`;
    const availabilityDocRef = doc(db, 'availability', documentId);
    
    const unsubscribe = onSnapshot(
      availabilityDocRef,
      (docSnap) => {
        callback(docSnap.exists() ? docSnap.data() : null);
        },
        (error) => {
          console.error('Database Service: Availability subscription error:', error);
          callback(null, error);
        }
      );

    trackSubscription(`availability_${teamId}_${weekId}`, unsubscribe);
    return unsubscribe;
  };

  /**
   * Subscribe to user profile changes
   * @param {string} userId - User ID to subscribe to
   * @param {Function} callback - Callback function(userData, error)
   * @returns {Function} Unsubscribe function
   */
  const subscribeToUser = (userId, callback) => {
    ensureInitialized();
    
    const userDocRef = doc(db, 'users', userId);
    const unsubscribe = onSnapshot(
      userDocRef,
      (docSnap) => {
        if (docSnap.exists()) {
          callback({ id: docSnap.id, ...docSnap.data() });
          } else {
            callback(null);
          }
        },
        (error) => {
          console.error('Database Service: User subscription error:', error);
          callback(null, error);
        }
      );

    trackSubscription(`user_${userId}`, unsubscribe);
    return unsubscribe;
  };

  // Utility Query Methods

  /**
   * Get all active teams
   * @returns {Promise<Array>} Array of active team documents
   */
  const getAllActiveTeams = async () => {
    ensureInitialized();
    try {
      const teamsQuery = query(
        collection(db, 'teams'),
        where('active', '==', true)
      );
      const snapshot = await getDocs(teamsQuery);

      return snapshot.docs.map(docSnap => ({
        id: docSnap.id,
        ...docSnap.data()
      }));
    } catch (error) {
      console.error('Database Service: getAllActiveTeams failed:', error);
      throw new Error('Failed to fetch active teams');
    }
  };

  /**
   * Get teams by division
   * @param {string} division - Division name
   * @returns {Promise<Array>} Array of team documents
   */
  const getTeamsByDivision = async (division) => {
    ensureInitialized();
    try {
      const divisionQuery = query(
        collection(db, 'teams'),
        where('division', '==', division),
        where('active', '==', true)
      );
      const snapshot = await getDocs(divisionQuery);

      return snapshot.docs.map(docSnap => ({
        id: docSnap.id,
        ...docSnap.data()
      }));
    } catch (error) {
      console.error('Database Service: getTeamsByDivision failed:', error);
      throw new Error('Failed to fetch teams by division');
    }
  };

  /**
   * Get a single team by ID
   * @param {string} teamId - Team ID
   * @returns {Promise<Object|null>} Team document or null if not found
   */
  const getTeam = async (teamId) => {
    ensureInitialized();
    try {
      const teamDocRef = doc(db, 'teams', teamId);
      const docSnap = await getDoc(teamDocRef);
      if (docSnap.exists()) {
        return { id: docSnap.id, ...docSnap.data() };
      }
      return null;
    } catch (error) {
      console.error('Database Service: getTeam failed:', error);
      throw new Error('Failed to fetch team');
    }
  };

  /**
   * Get user's teams with resilient parallel fetching
   * @param {string} userId - User ID
   * @returns {Promise<Array>} Array of team documents
   */
  const getUserTeams = async (userId) => {
    ensureInitialized();
    validateParams({ userId }, ['userId']);

    try {
      const userDocRef = doc(db, 'users', userId);
      const userDocSnap = await getDoc(userDocRef);
      if (!userDocSnap.exists()) return [];

      const teams = userDocSnap.data().teams || {};
      const teamIds = Object.keys(teams);
      
      // Use Promise.allSettled for resilient parallel fetching
      const teamPromises = teamIds.map(teamId => {
        const teamDocRef = doc(db, 'teams', teamId);
        return getDoc(teamDocRef)
          .then(docSnap => ({
            status: 'fulfilled',
            value: docSnap.exists() ? { id: docSnap.id, ...docSnap.data() } : null
          }))
          .catch(error => ({
            status: 'rejected',
            reason: error
          }));
      });

      const results = await Promise.allSettled(teamPromises);
      
      // Log any failures but continue with successful fetches
      results.forEach((result, index) => {
        if (result.status === 'rejected') {
          console.warn(`Failed to fetch team ${teamIds[index]}:`, result.reason);
        }
      });

      // Return only successfully fetched, existing teams
      return results
        .filter(result => 
          result.status === 'fulfilled' && result.value !== null)
        .map(result => result.value);
    } catch (error) {
      console.error('Database Service: getUserTeams failed:', error);
      throw new Error('Failed to fetch user teams');
    }
  };

  /**
   * Get team data directly (no subscription)
   * @param {string} teamId - Team ID to fetch
   * @returns {Promise<Object>} Team data
   */
  const getTeamData = async (teamId) => {
    ensureInitialized();
    validateParams({ teamId }, ['teamId']);
    
    try {
      const teamDocRef = doc(db, 'teams', teamId);
      const docSnap = await getDoc(teamDocRef);
      
      if (docSnap.exists()) {
        return { id: docSnap.id, ...docSnap.data() };
      }
      return null;
    } catch (error) {
      console.error('Database Service: getTeamData failed:', error);
      throw new Error('Failed to get team data');
    }
  };

  /**
   * Clean up all active subscriptions
   */
  const cleanup = () => {
    for (const unsubscribe of activeSubscriptions.values()) {
      try {
        unsubscribe();
      } catch (error) {
        console.warn('Error during subscription cleanup:', error);
      }
    }
    activeSubscriptions.clear();
    connectionStateCallbacks.clear();
    console.log('📦 Database Service: Cleaned up subscriptions');
  };

  // Public API
  return {
    init,
    // Cloud Function Wrappers
    createProfile,
    updateProfile,
    createTeam,
    joinTeam,
    leaveTeam,
    uploadLogo,
    removePlayer,
    updateTeamSettings,
    regenerateJoinCode,
    transferLeadership,
    updateAvailability,
    // Real-time Listeners
    subscribeToTeam,
    subscribeToAvailability,
    subscribeToUser,
    // Connection State
    onConnectionStateChange,
    // Utility Methods
    getAllActiveTeams,
    getTeam,
    getTeamsByDivision,
    getUserTeams,
    getTeamData,
    // Cleanup
    cleanup
  };
})();

export default DatabaseService; 