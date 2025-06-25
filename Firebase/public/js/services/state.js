/**
 * State Service
 * Manages application-wide state with subscription pattern
 */

const StateService = (() => {
  // Private state object with default values
  const state = {
    user: null,              // Current user profile from Firestore
    currentTeam: null,       // Active team ID (string)
    teamData: null,          // Currently viewed team's full data
    weekOffset: 0,           // For week navigation (0 or 1)
    favorites: [],           // Array of favorited team IDs
    filters: {
      yourTeamPlayers: 4,    // Default minimum players
      opponentPlayers: 4,    // Default minimum players
      selectedOpponents: []  // Array of selected team IDs for comparison
    }
  };

  // Store for subscribers, organized by state key
  const subscribers = {
    user: new Set(),
    currentTeam: new Set(),
    teamData: new Set(),
    weekOffset: new Set(),
    favorites: new Set(),
    filters: new Set()
  };

  // Valid state keys for validation
  const validStateKeys = new Set(Object.keys(state));

  // Initialization state
  let initialized = false;

  // Type validation rules
  const typeValidators = {
    user: (value) => value === null || typeof value === 'object',
    currentTeam: (value) => value === null || typeof value === 'string',
    teamData: (value) => value === null || (typeof value === 'object' && value.id),
    weekOffset: (value) => typeof value === 'number' && (value === 0 || value === 1),
    favorites: (value) => Array.isArray(value) && value.every(id => typeof id === 'string'),
    filters: (value) => typeof value === 'object' && value !== null
  };

  /**
   * Deep clone objects/arrays with circular reference handling
   * @param {*} value - Value to clone
   * @param {WeakMap} seen - Map of seen objects for circular reference detection
   * @returns {*} Cloned value
   */
  const deepClone = (value, seen = new WeakMap()) => {
    // Handle null, undefined, and primitives
    if (value === null || typeof value !== 'object') {
      return value;
    }

    // Handle circular references
    if (seen.has(value)) {
      return seen.get(value);
    }

    // Handle Date objects
    if (value instanceof Date) {
      return new Date(value);
    }

    // Handle Array objects
    if (Array.isArray(value)) {
      const cloneArr = [];
      seen.set(value, cloneArr);
      value.forEach((item, index) => {
        cloneArr[index] = deepClone(item, seen);
      });
      return cloneArr;
    }

    // Handle plain objects
    const cloneObj = Object.create(Object.getPrototypeOf(value));
    seen.set(value, cloneObj);
    
    Object.entries(value).forEach(([key, val]) => {
      if (Object.prototype.hasOwnProperty.call(value, key)) {
        cloneObj[key] = deepClone(val, seen);
      }
    });

    return cloneObj;
  };

  /**
   * Validate state key and value type
   * @param {string} key - State key to validate
   * @param {*} value - Value to validate
   * @throws {Error} If key or value is invalid
   */
  const validateStateKeyAndValue = (key, value) => {
    // Validate key exists
    if (!validStateKeys.has(key)) {
      throw new Error(`Invalid state key: ${key}. Valid keys are: ${Array.from(validStateKeys).join(', ')}`);
    }

    // Skip type validation for null/undefined if allowed
    if (value === null && (key === 'user' || key === 'currentTeam')) {
      return;
    }

    // Validate value type
    if (!typeValidators[key](value)) {
      throw new Error(`Invalid value type for ${key}. Expected ${getExpectedType(key)}, got ${typeof value}`);
    }
  };

  /**
   * Get expected type description for error messages
   * @param {string} key - State key
   * @returns {string} Type description
   */
  const getExpectedType = (key) => {
    switch (key) {
      case 'user': return 'object or null';
      case 'currentTeam': return 'string or null';
      case 'teamData': return 'team object or null';
      case 'weekOffset': return 'number (0 or 1)';
      case 'favorites': return 'array of strings';
      case 'filters': return 'object';
      default: return 'unknown';
    }
  };

  /**
   * Validate and normalize filters object
   * @param {Object} filters - Filters to validate
   * @returns {Object} Normalized filters
   * @throws {Error} If filters are invalid
   */
  const validateAndNormalizeFilters = (filters) => {
    if (!filters || typeof filters !== 'object') {
      throw new Error('Filters must be an object');
    }

    const normalized = { ...state.filters }; // Start with current defaults

    // Validate and normalize yourTeamPlayers
    if ('yourTeamPlayers' in filters) {
      const value = Number(filters.yourTeamPlayers);
      if (isNaN(value) || value < 1) {
        throw new Error('yourTeamPlayers must be a positive number');
      }
      normalized.yourTeamPlayers = value;
    }

    // Validate and normalize opponentPlayers
    if ('opponentPlayers' in filters) {
      const value = Number(filters.opponentPlayers);
      if (isNaN(value) || value < 1) {
        throw new Error('opponentPlayers must be a positive number');
      }
      normalized.opponentPlayers = value;
    }

    // Validate and normalize selectedOpponents
    if ('selectedOpponents' in filters) {
      if (!Array.isArray(filters.selectedOpponents)) {
        throw new Error('selectedOpponents must be an array');
      }
      if (!filters.selectedOpponents.every(id => typeof id === 'string')) {
        throw new Error('selectedOpponents must be an array of strings');
      }
      normalized.selectedOpponents = [...filters.selectedOpponents];
    }

    return normalized;
  };

  // Queue for batching state updates
  let updateQueue = new Map();
  let updateScheduled = false;

  /**
   * Process queued state updates
   */
  const processUpdateQueue = () => {
    updateScheduled = false;
    const updates = new Map(updateQueue);
    updateQueue.clear();

    // Apply all queued updates
    updates.forEach((value, key) => {
      try {
        if (key === 'filters') {
          state[key] = validateAndNormalizeFilters(value);
        } else {
          state[key] = deepClone(value);
        }
        notifySubscribers(key, state[key]);
      } catch (error) {
        console.error(`Error processing state update for ${key}:`, error);
      }
    });
  };

  /**
   * Notify subscribers of state changes
   * @param {string} key - State key that changed
   * @param {*} value - New value
   */
  const notifySubscribers = (key, value) => {
    const clonedValue = deepClone(value);
    const subscriberErrors = [];

    subscribers[key].forEach(callback => {
      try {
        callback(clonedValue);
      } catch (error) {
        subscriberErrors.push({ callback, error });
        console.error(`Error in state subscriber callback for ${key}:`, error);
      }
    });

    // Clean up subscribers that errored consistently
    subscriberErrors.forEach(({ callback, error }) => {
      if (error.message.includes('Maximum call stack size exceeded')) {
        subscribers[key].delete(callback);
        console.warn(`Removed recursive subscriber for ${key} to prevent infinite loop`);
      }
    });
  };

  /**
   * Initialize the service
   */
  const init = () => {
    if (initialized) {
      console.warn('StateService already initialized');
      return publicApi;
    }
    
    initialized = true;
    console.log('🔄 StateService Initialized');
    return publicApi;
  };

  /**
   * Get current state value
   * @param {string} key - State key to get
   * @returns {*} Current state value
   */
  const getState = (key) => {
    validateStateKeyAndValue(key, state[key]);
    return deepClone(state[key]);
  };

  /**
   * Set state value and notify subscribers
   * @param {string} key - State key to set
   * @param {*} value - New value
   */
  const setState = (key, value) => {
    validateStateKeyAndValue(key, value);
    
    // Queue the update
    updateQueue.set(key, value);

    // Schedule processing if not already scheduled
    if (!updateScheduled) {
      updateScheduled = true;
      queueMicrotask(processUpdateQueue);
    }
  };

  /**
   * Subscribe to state changes
   * @param {string} key - State key to subscribe to
   * @param {Function} callback - Callback function
   * @returns {Function} Unsubscribe function
   */
  const subscribe = (key, callback) => {
    validateStateKeyAndValue(key, state[key]);
    
    if (typeof callback !== 'function') {
      throw new Error('Callback must be a function');
    }

    // Prevent duplicate subscriptions
    if (subscribers[key].has(callback)) {
      console.warn(`Duplicate subscription prevented for ${key}`);
      return () => subscribers[key].delete(callback);
    }

    // Limit subscribers per key (arbitrary limit of 100 for safety)
    if (subscribers[key].size >= 100) {
      throw new Error(`Maximum subscriber limit reached for ${key}`);
    }

    subscribers[key].add(callback);

    // Immediate notification with current state
    try {
      callback(deepClone(state[key]));
    } catch (error) {
      console.error(`Error in initial state callback for ${key}:`, error);
      subscribers[key].delete(callback); // Auto-remove erroring subscriber
      throw error; // Re-throw to notify caller
    }

    return () => {
      subscribers[key].delete(callback);
      // Optional: Cleanup if no subscribers left
      if (subscribers[key].size === 0) {
        console.log(`No more subscribers for ${key}`);
      }
    };
  };

  /**
   * Reset state to defaults
   */
  const reset = () => {
    const defaultState = deepClone(state); // Clone initial state structure
    Object.keys(defaultState).forEach(key => {
      setState(key, defaultState[key]);
    });
    console.log('🔄 State reset to defaults');
  };

  /**
   * Get entire state object (for debugging)
   * @returns {Object} Deep clone of entire state
   */
  const getDebugState = () => {
    return deepClone(state);
  };

  /**
   * Get subscriber count for debugging
   * @returns {Object} Subscriber counts by state key
   */
  const getDebugSubscriberCount = () => {
    const counts = {};
    Object.entries(subscribers).forEach(([key, set]) => {
      counts[key] = set.size;
    });
    return counts;
  };

  /**
   * Check if service is initialized
   * @returns {boolean} Whether service is initialized
   */
  const isReady = () => {
    return initialized;
  };

  // Public API
  const publicApi = {
    init,
    getState,
    setState,
    subscribe,
    reset,
    getDebugState,
    getDebugSubscriberCount,
    isReady
  };

  return publicApi;
})();

// Export the service instance
export default StateService;

// Export individual methods for convenience
export const {
  getState,
  setState,
  subscribe,
  reset,
  isReady
} = StateService; 