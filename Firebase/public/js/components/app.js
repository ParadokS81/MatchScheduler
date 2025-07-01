/**
 * App Controller
 * Central orchestrator for the MatchScheduler application
 * Manages service initialization, state, and component coordination
 */

import { initializeFirebase } from '../config/firebase.js';
import stateService from '../services/state.js';
import authService from '../services/auth.js';
import databaseService from '../services/database.js';

// Expose services globally for debugging
window.AuthService = authService;
window.stateService = stateService;
window.databaseService = databaseService;

const App = (function() {
  // Private variables
  let initialized = false;
  let initializationAttempts = 0;
  const MAX_INIT_ATTEMPTS = 3;
  const INIT_RETRY_DELAY = 2000;

  // Subscription tracking and circuit breaker
  const subscriptionAttempts = new Map();
  const SUBSCRIPTION_LIMIT = 3;
  const SUBSCRIPTION_WINDOW = 60000; // 1 minute
  const SUBSCRIPTION_BACKOFF = 2000; // 2 seconds

  // Active subscriptions for cleanup
  const stateSubscriptions = new Set();
  const databaseSubscriptions = new Set();
  const activeTeamSubscriptions = new Map(); // Track active team subscriptions

  // Track current team subscription for cleanup during rapid changes
  let currentTeamUnsubscribe = null;
  let currentUserUnsubscribe = null;
  let currentSubscribedUserId = null; // Track which user we're subscribed to
  let titleUpdateTimeout = null;

  /**
   * Check if subscription attempts exceed limit
   * @param {string} key - Subscription key (teamId or userId)
   * @returns {boolean} - True if should throttle
   */
  const shouldThrottleSubscription = (key) => {
    const now = Date.now();
    const attempts = subscriptionAttempts.get(key) || [];
    
    // Clean up old attempts
    const recentAttempts = attempts.filter(time => now - time < SUBSCRIPTION_WINDOW);
    
    if (recentAttempts.length >= SUBSCRIPTION_LIMIT) {
      console.warn(`🚫 Throttling subscription for ${key} - too many attempts`);
      return true;
    }
    
    // Update attempts
    recentAttempts.push(now);
    subscriptionAttempts.set(key, recentAttempts);
    return false;
  };

  /**
   * Track state subscription for cleanup
   * @param {string} key - State key to subscribe to
   * @param {Function} callback - State change callback
   */
  const subscribeToState = (key, callback) => {
    const unsubscribe = stateService.subscribe(key, callback);
    stateSubscriptions.add(unsubscribe);
  };

  /**
   * Update UI elements with debouncing
   * @param {Object|null} team - Team data
   */
  const updateUIForTeam = (team) => {
    // Clear any pending update
    if (titleUpdateTimeout) {
      clearTimeout(titleUpdateTimeout);
    }

    // Debounce title update
    titleUpdateTimeout = setTimeout(() => {
      // Update title
      document.title = team ? `${team.name} - MatchScheduler` : 'MatchScheduler';
      
      // Update team name in header if element exists
      const teamNameElement = document.getElementById('team-name');
      if (teamNameElement) {
        teamNameElement.textContent = team ? team.name : '';
      }
      
      // Update team logo if element exists
      const teamLogoElement = document.getElementById('team-logo');
      if (teamLogoElement) {
        teamLogoElement.src = team?.logoUrl || '/assets/images/default-team-logo.png';
      }

      titleUpdateTimeout = null;
    }, 300); // 300ms debounce

    // Update any team-specific UI elements
    if (team) {
      console.log(`App: UI updated for team: ${team.teamName}`);
    } else {
      console.log('App: UI updated for no team');
    }
    
    // Update team switcher in header
    updateTeamSwitcher();
  };

  /**
   * Update team switcher buttons in header
   */
  const updateTeamSwitcher = async () => {
    const teamSwitcher = document.getElementById('team-switcher');
    if (!teamSwitcher) return;

    const user = stateService.getState('user');
    const currentTeam = stateService.getState('currentTeam');
    
    // DEFENSIVE: Safe team counting using helper function
    const teamCount = getTeamCount(user?.teams);
    if (!user || teamCount === 0) {
      // No teams - hide switcher
      teamSwitcher.innerHTML = '';
      return;
    }

    // Always show 2 button slots for consistency
    // DEFENSIVE: Safe team ID extraction using helper function
    const userTeams = getTeamIds(user.profile?.teams);
    const teamData = stateService.getState('teamData');
    
    // Get team names (use current team data if available, otherwise use ID)
    const getTeamButtonContent = (teamId, index) => {
      if (teamId === currentTeam && teamData) {
        return teamData.teamName;
      }
      return `Team ${index + 1}`;
    };

    const team1 = userTeams[0] || null;
    const team2 = userTeams[1] || null;

    teamSwitcher.innerHTML = `
      <div class="flex space-x-1">
        <!-- Team 1 Button -->
        <button class="team-switch-btn px-3 py-1 text-sm font-medium rounded-lg transition-colors min-w-[80px] ${
          team1 && team1 === currentTeam 
            ? 'bg-blue-600 text-white' 
            : team1 
              ? 'bg-slate-700 text-slate-300 hover:bg-slate-600 hover:text-white'
              : 'bg-slate-800 text-slate-500 cursor-not-allowed'
        }" ${team1 ? `data-team-id="${team1}"` : 'disabled'}>
          ${team1 ? getTeamButtonContent(team1, 0) : 'Team 1'}
        </button>
        
        <!-- Team 2 Button -->
        <button class="team-switch-btn px-3 py-1 text-sm font-medium rounded-lg transition-colors min-w-[80px] ${
          team2 && team2 === currentTeam 
            ? 'bg-blue-600 text-white' 
            : team2 
              ? 'bg-slate-700 text-slate-300 hover:bg-slate-600 hover:text-white'
              : 'bg-slate-800 text-slate-500 cursor-not-allowed'
        }" ${team2 ? `data-team-id="${team2}"` : 'disabled'}>
          ${team2 ? getTeamButtonContent(team2, 1) : 'Team 2'}
        </button>
      </div>
    `;

    // Add click handlers for team switching
    teamSwitcher.addEventListener('click', (e) => {
      if (e.target.matches('.team-switch-btn') && !e.target.disabled) {
        const teamId = e.target.dataset.teamId;
        if (teamId && teamId !== currentTeam) {
          stateService.setState('currentTeam', teamId);
        }
      }
    });
  };

  /**
   * Clean up current team subscription
   */
  const cleanupTeamSubscription = () => {
    console.log('🧹 Cleaning up team subscription');
    
    if (currentTeamUnsubscribe) {
      try {
        // Get the team ID from active subscriptions
        for (const [teamId, unsubscribe] of activeTeamSubscriptions.entries()) {
          if (unsubscribe === currentTeamUnsubscribe) {
            activeTeamSubscriptions.delete(teamId);
            console.log('🗑️ Removed subscription for team:', teamId);
            break;
          }
        }
        
        currentTeamUnsubscribe();
        databaseSubscriptions.delete(currentTeamUnsubscribe);
        console.log('✅ Team subscription cleanup complete');
      } catch (error) {
        console.warn('⚠️ Error cleaning up team subscription:', error);
      }
      currentTeamUnsubscribe = null;
    }

    // Clear any pending UI updates
    if (titleUpdateTimeout) {
      clearTimeout(titleUpdateTimeout);
      titleUpdateTimeout = null;
    }
  };

  /**
   * Clean up current user profile subscription
   */
  const cleanupUserSubscription = () => {
    if (currentUserUnsubscribe) {
      try {
        currentUserUnsubscribe();
        databaseSubscriptions.delete(currentUserUnsubscribe);
      } catch (error) {
        console.warn('App: Error cleaning up user subscription:', error);
      }
      currentUserUnsubscribe = null;
      currentSubscribedUserId = null;
    }
  };

  /**
   * Subscribe to team updates with retry logic
   * @param {string} teamId - Team ID to subscribe to
   * @returns {Promise<void>}
   */
  const subscribeToTeamUpdates = async (teamId) => {
    console.log('🔄 subscribeToTeamUpdates called for:', teamId);
    
    // Check if we're already subscribed to this team
    if (activeTeamSubscriptions.has(teamId)) {
        console.log('✋ Already subscribed to team:', teamId);
        return;
    }

    // Clean up existing subscription first
    cleanupTeamSubscription();

    let retryCount = 0;
    const maxRetries = 3;
    const retryDelay = 2000; // 2 seconds

    const attemptSubscription = async () => {
        try {
            // First try to get the initial team data
            console.log('📥 Fetching initial team data...');
            const teamData = await databaseService.getTeamData(teamId);
            
            if (!teamData) {
                throw new Error('Team data not found');
            }

            // Set initial team data
            console.log('✅ Initial team data received:', teamData);
            stateService.setState('teamData', teamData);
            
            // Now set up real-time subscription
            console.log('🔄 Setting up real-time subscription...');
            const unsubscribe = databaseService.subscribeToTeam(teamId, (updatedTeam, error) => {
                if (error) {
                    console.error('❌ Team subscription error:', error);
                    return;
                }
                
                if (!updatedTeam) {
                    console.warn('⚠️ Team update received but no data');
                    return;
                }
                
                console.log('📥 Team update received:', updatedTeam);
                stateService.setState('teamData', updatedTeam);
            });

            // Track subscription for cleanup
            activeTeamSubscriptions.set(teamId, unsubscribe);
            currentTeamUnsubscribe = unsubscribe;
            
            console.log('✅ Team subscription setup complete');
            
        } catch (error) {
            console.error('❌ Team subscription failed:', error);
            
            if (retryCount < maxRetries) {
                retryCount++;
                console.log(`🔄 Retrying subscription (${retryCount}/${maxRetries})...`);
                await new Promise(resolve => setTimeout(resolve, retryDelay));
                return attemptSubscription();
            } else {
                console.error('❌ Max retries reached, subscription failed');
                stateService.setState('teamData', null);
                throw error;
            }
        }
    };

    await attemptSubscription();
  };

  /**
   * Subscribe to user profile updates to detect team membership changes
   * @param {string} userId - User ID to subscribe to
   * @returns {Promise<void>}
   */
  const subscribeToUserUpdates = async (userId) => {
    console.log('🔗 Setting up user profile subscription for:', userId);
    
    // Prevent re-subscribing to the same user
    if (currentSubscribedUserId === userId && currentUserUnsubscribe) {
      console.log('🔄 Already subscribed to this user, skipping');
      return;
    }
    
    // Clean up existing subscription first
    cleanupUserSubscription();
    currentSubscribedUserId = userId;

    try {
      // Set up new subscription
      currentUserUnsubscribe = databaseService.subscribeToUser(userId, (userProfile, error) => {
        console.log('🔔 User profile subscription triggered:', { userId, error: !!error, hasProfile: !!userProfile });
        
        if (error) {
          console.error('App: User profile subscription error:', error);
          return;
        }

        if (!userProfile) {
          console.warn(`App: User profile ${userId} not found`);
          return;
        }

        console.log('👤 User profile data received:', {
          userId,
          teams: userProfile.teams,
          teamCount: Object.keys(userProfile.teams || {}).length
        });

        // Update user state with fresh profile data
        const currentUser = stateService.getState('user');
        const currentTeamId = stateService.getState('currentTeam');
        
        console.log('🔍 Current state before update:', {
          hasCurrentUser: !!currentUser,
          currentTeamId,
          userTeams: Object.keys(userProfile.teams || {})
        });
        
        if (currentUser) {
          // Only update user state if profile data has actually changed
          const currentProfile = currentUser.profile;
          const profileChanged = !currentProfile || 
            JSON.stringify(currentProfile.teams || {}) !== JSON.stringify(userProfile.teams || {});
          
          if (profileChanged) {
            stateService.setState('user', {
              ...currentUser,
              profile: userProfile
            });
            console.log('✅ User state updated with fresh profile');
          } else {
            console.log('🔄 Profile data unchanged, skipping state update');
          }

          // Check if current team is still valid
          const userTeamIds = Object.keys(userProfile.teams || {});
          
          console.log('🎯 Team validation:', {
            currentTeamId,
            userTeamIds,
            isTeamStillValid: currentTeamId ? userTeamIds.includes(currentTeamId) : 'no current team'
          });
          
          if (currentTeamId && !userTeamIds.includes(currentTeamId)) {
            // User was kicked from current team
            console.log(`🚨 User was removed from team ${currentTeamId}, clearing team selection`);
            stateService.setState('currentTeam', null);
            stateService.setState('teamData', null);
            
            // Show notification to user
            handleError(new Error('You have been removed from the team'));
            
            // Update team switcher to reflect change
            updateTeamSwitcher();
            
            console.log('🔄 Team selection cleared, UI should update to Join/Create state');
          } else {
            console.log('✅ Current team is still valid or no team selected');
          }
        } else {
          console.warn('⚠️ No current user in state, cannot update profile');
        }
      });

      // Track for cleanup
      databaseSubscriptions.add(currentUserUnsubscribe);
      console.log('✅ User profile subscription established successfully');

    } catch (error) {
      console.error('❌ App: Failed to subscribe to user updates:', error);
    }
  };

  /**
   * Set up state change subscriptions
   */
  const setupStateSubscriptions = () => {
    // User state changes
    subscribeToState('user', async (user) => {
      if (user) {
        console.log('App: User signed in, updating UI...');
        document.body.classList.add('authenticated');
        updateTeamSwitcher(); // Update team switcher when user signs in
        
        // Subscribe to user profile changes to detect team membership changes
        if (user.uid) {
          await subscribeToUserUpdates(user.uid);
        }
        
        refreshData();
      } else {
        console.log('App: User signed out, resetting UI...');
        document.body.classList.remove('authenticated');
        updateTeamSwitcher(); // Clear team switcher when user signs out
        cleanup(); // Clear all subscriptions
      }
    });

    // Current team changes
    subscribeToState('currentTeam', async (teamId, prevTeamId) => {
      console.log('🔄 Current team changed:', { from: prevTeamId, to: teamId });
      
      // Skip if team hasn't actually changed
      if (teamId === prevTeamId) {
        console.log('⏭️ Team ID unchanged, skipping subscription update');
        return;
      }

      // Clean up old subscription first
      cleanupTeamSubscription();
      
      // Clear team data immediately when switching teams
      stateService.setState('teamData', null);

      if (teamId) {
        try {
          // Set loading state
          stateService.setState('teamOperation', {
            status: 'loading',
            name: null,
            error: null,
            metadata: null
          });
          
          // Try to subscribe to new team
          await subscribeToTeamUpdates(teamId);
          
          // Reset week offset when team changes
          stateService.setState('weekOffset', 0);
          
          // Reset operation state
          stateService.setState('teamOperation', {
            status: 'idle',
            name: null,
            error: null,
            metadata: null
          });
          
        } catch (error) {
          console.error('❌ App: Failed to handle team change:', error);
          
          // Set error state
          stateService.setState('teamOperation', {
            status: 'error',
            name: null,
            error: error.message || 'Failed to load team data',
            metadata: null
          });
          
          // Clear team selection on error
          stateService.setState('currentTeam', null);
          stateService.setState('teamData', null);
        }
      }
    });

    // Team data changes
    subscribeToState('teamData', (team) => {
      updateUIForTeam(team);
    });

    // Week offset changes
    subscribeToState('weekOffset', (offset) => {
      console.log('App: Week offset changed:', offset);
      updateWeekDisplay(offset);
      refreshData();
    });
  };

  /**
   * Update week display based on offset
   * @param {number} offset - Week offset (0 or 1)
   */
  const updateWeekDisplay = (offset) => {
    console.log(`App: Updating week display for offset ${offset}`);
    
    // Calculate dates
    const now = new Date();
    const targetDate = new Date(now);
    targetDate.setDate(now.getDate() + (offset * 7));

    const weekStart = new Date(targetDate);
    weekStart.setDate(targetDate.getDate() - targetDate.getDay());

    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekStart.getDate() + 6);

    const formatDate = (date) => date.toLocaleDateString('en-US', { 
      month: 'short', 
      day: 'numeric' 
    });

    // Update week label if exists
    const weekLabel = document.getElementById('week-label');
    if (weekLabel) {
      weekLabel.textContent = `Week ${offset + 1}`;
    }

    // Update date range if exists
    const dateRange = document.getElementById('date-range');
    if (dateRange) {
      dateRange.textContent = `${formatDate(weekStart)} - ${formatDate(weekEnd)}`;
    }

    // Update navigation buttons if they exist
    const prevWeekBtn = document.getElementById('prev-week');
    const nextWeekBtn = document.getElementById('next-week');
    
    if (prevWeekBtn) {
      prevWeekBtn.disabled = offset === 0;
      prevWeekBtn.classList.toggle('opacity-50', offset === 0);
    }
    
    if (nextWeekBtn) {
      nextWeekBtn.disabled = offset === 1;
      nextWeekBtn.classList.toggle('opacity-50', offset === 1);
    }
  };

  /**
   * Handle application errors
   * @param {Error} error - Error to handle
   */
  const handleError = (error) => {
    console.error('App Error:', error);
    
    // Show error in UI if element exists
    const errorBanner = document.getElementById('error-banner');
    if (errorBanner) {
      errorBanner.textContent = error.message;
      errorBanner.classList.remove('hidden');
      setTimeout(() => {
        // Check if element still exists before hiding
        if (errorBanner && !errorBanner.classList.contains('hidden')) {
          errorBanner.classList.add('hidden');
        }
      }, 5000);
    }

    // Update connection status indicator if exists
    const connectionStatus = document.getElementById('connection-status');
    if (connectionStatus) {
      connectionStatus.classList.remove('bg-green-500');
      connectionStatus.classList.add('bg-red-500');
    }
  };

  /**
   * Clean up subscriptions and state
   */
  const cleanup = () => {
    // Clean up team subscription first
    cleanupTeamSubscription();
    
    // Clean up user profile subscription
    cleanupUserSubscription();

    // Clear state subscriptions
    stateSubscriptions.forEach(unsubscribe => {
      try {
        unsubscribe();
      } catch (error) {
        console.warn('App: Error during state unsubscribe:', error);
      }
    });
    stateSubscriptions.clear();

    // Clear remaining database subscriptions
    databaseSubscriptions.forEach(unsubscribe => {
      try {
        unsubscribe();
      } catch (error) {
        console.warn('App: Error during database unsubscribe:', error);
      }
    });
    databaseSubscriptions.clear();

    // Reset state
    stateService.setState('teamData', null);
    stateService.setState('weekOffset', 0);
  };

  /**
   * Initialize the application
   * @returns {Promise<void>}
   */
  const init = async () => {
    if (initialized) {
      console.warn('App: Already initialized');
      return;
    }

    console.log('App: Initializing...');

    try {
      // Initialize Firebase first
      await initializeFirebase();

      // Initialize services in order
      await stateService.init();
      console.log('App: State Service initialized');

      await authService.init();
      console.log('App: Auth Service initialized');

      await databaseService.init();
      console.log('App: Database Service initialized');

      // Set up state subscriptions
      setupStateSubscriptions();

      // Set up database connection monitoring
      const unsubscribe = databaseService.onConnectionStateChange((online) => {
        document.body.classList.toggle('offline', !online);
        if (!online) {
          handleError(new Error('Lost connection to server'));
        }
      });
      databaseSubscriptions.add(unsubscribe);

      // Initialize week display
      updateWeekDisplay(0);

      initialized = true;
      console.log('App: Initialization complete');
    } catch (error) {
      console.error('App: Initialization failed:', error);
      
      // Retry initialization if possible
      if (initializationAttempts < MAX_INIT_ATTEMPTS) {
        initializationAttempts++;
        console.log(`App: Retrying initialization (attempt ${initializationAttempts})...`);
        setTimeout(init, INIT_RETRY_DELAY);
      } else {
        handleError(new Error('Failed to initialize application'));
      }
    }
  };

  /**
   * Get current week offset
   * @returns {number} Current week offset (0 or 1)
   */
  const getCurrentWeekOffset = () => {
    return stateService.getState('weekOffset') || 0;
  };

  /**
   * Request week change
   * @param {'prev'|'next'} direction - Navigation direction
   */
  const requestWeekChange = (direction) => {
    if (!initialized) return;

    const currentOffset = getCurrentWeekOffset();
    const newOffset = direction === 'next' ? 
      Math.min(currentOffset + 1, 1) : 
      Math.max(currentOffset - 1, 0);

    if (newOffset !== currentOffset) {
      stateService.setState('weekOffset', newOffset);
    }
  };

  /**
   * Get current team
   * @returns {string|null} Current team ID
   */
  const getCurrentTeam = () => {
    return stateService.getState('currentTeam');
  };

  /**
   * Refresh current view data
   * @returns {Promise<void>}
   */
  const refreshData = async () => {
    if (!initialized) return;

    const teamId = getCurrentTeam();
    if (!teamId) return;

    try {
      const weekId = `week_${getCurrentWeekOffset()}`;
      
      // Subscribe to availability updates - let the availability grid component handle the data
      const unsubscribe = databaseService.subscribeToAvailability(
        teamId,
        weekId,
        (availability) => {
          // Availability data will be handled by the availability grid component
          // No need to store in global state
        }
      );
      databaseSubscriptions.add(unsubscribe);

    } catch (error) {
      console.error('App: Failed to refresh data:', error);
      handleError(error);
    }
  };

  // Helper functions for safe team operations
  const getTeamCount = (teams) => {
    if (!teams || typeof teams !== 'object' || Array.isArray(teams)) {
      return 0;
    }
    return Object.keys(teams).length;
  };

  const getTeamIds = (teams) => {
    if (!teams || typeof teams !== 'object' || Array.isArray(teams)) {
      return [];
    }
    return Object.keys(teams);
  };

  const isUserInTeam = (teams, teamId) => {
    if (!teams || typeof teams !== 'object' || Array.isArray(teams) || !teamId) {
      return false;
    }
    return teams[teamId] === true;
  };

  // Public API
  return {
    init,
    cleanup,
    getCurrentWeekOffset,
    requestWeekChange,
    getCurrentTeam,
    refreshData
  };
})();

export default App; 