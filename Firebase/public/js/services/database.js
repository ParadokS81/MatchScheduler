/**
 * Database Service
 * Wraps Firebase Cloud Functions and Firestore operations
 * Provides real-time listeners and utility methods
 */

import { getDb, getFunctions } from '../config/firebase.js';

const DatabaseService = (() => {
  // Private variables
  let initialized = false;
  let db = null;
  let functions = null;
  
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
    if (!response.success) {
      throw new Error(response.message || 'Operation failed');
    }
    return response.data;
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
      db = getDb();
      functions = getFunctions();
      
      // Set up connection state monitoring
      const connRef = db.collection('_connection').doc('status');
      connRef.onSnapshot(() => {
        isOnline = true;
        notifyConnectionState(true);
      }, () => {
        isOnline = false;
        notifyConnectionState(false);
      });

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
      const result = await functions.httpsCallable('createProfile')(profileData);
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
      const result = await functions.httpsCallable('updateProfile')(profileData);
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
      const result = await functions.httpsCallable('createTeam')(teamData);
      return handleFunctionResponse(result.data);
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
      const result = await functions.httpsCallable('joinTeam')({ joinCode });
      return result.data;
    } catch (error) {
      console.error('Database Service: joinTeam failed:', error);
      throw new Error(error.message || 'Failed to join team');
    }
  };

  /**
   * Leave a team
   * @param {Object} params - Parameters containing teamId
   * @returns {Promise<Object>} Response with success, data, message
   */
  const leaveTeam = async ({ teamId }) => {
    ensureInitialized();
    try {
      const result = await functions.httpsCallable('leaveTeam')({ teamId });
      return result.data;
    } catch (error) {
      console.error('Database Service: leaveTeam failed:', error);
      throw new Error(error.message || 'Failed to leave team');
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
      const result = await functions.httpsCallable('removePlayer')({ teamId, targetUserId });
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
      const result = await functions.httpsCallable('updateTeamSettings')({ teamId, ...settings });
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
      const result = await functions.httpsCallable('regenerateJoinCode')({ teamId });
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
      const result = await functions.httpsCallable('transferLeadership')({ teamId, newLeaderId });
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
      const result = await functions.httpsCallable('updateAvailability')({ 
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
      unsubscribe = ref.onSnapshot(
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
    
    const unsubscribe = createResilientListener(
      db.collection('teams').doc(teamId),
      (doc) => {
        if (doc.exists) {
          callback({ id: doc.id, ...doc.data() });
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
    
    const unsubscribe = db.collection('teams').doc(teamId)
      .collection('availability').doc(weekId)
      .onSnapshot(
        (doc) => {
          callback(doc.exists ? doc.data() : null);
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
    
    const unsubscribe = db.collection('users').doc(userId)
      .onSnapshot(
        (doc) => {
          if (doc.exists) {
            callback({ id: doc.id, ...doc.data() });
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
      const snapshot = await db.collection('teams')
        .where('status', '==', 'active')
        .get();

      return snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
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
      const snapshot = await db.collection('teams')
        .where('division', '==', division)
        .where('status', '==', 'active')
        .get();

      return snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
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
      const doc = await db.collection('teams').doc(teamId).get();
      if (doc.exists) {
        return { id: doc.id, ...doc.data() };
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
      const userDoc = await db.collection('users').doc(userId).get();
      if (!userDoc.exists) return [];

      const teamIds = userDoc.data().teams || [];
      
      // Use Promise.allSettled for resilient parallel fetching
      const teamPromises = teamIds.map(teamId =>
        db.collection('teams').doc(teamId).get()
          .then(doc => ({
            status: 'fulfilled',
            value: doc.exists ? { id: doc.id, ...doc.data() } : null
          }))
          .catch(error => ({
            status: 'rejected',
            reason: error
          }))
      );

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
    // Cleanup
    cleanup
  };
})();

export default DatabaseService; 