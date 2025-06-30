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

  // Active subscriptions for cleanup
  const stateSubscriptions = new Set();
  const databaseSubscriptions = new Set();

  // Track current team subscription for cleanup during rapid changes
  let currentTeamUnsubscribe = null;
  let titleUpdateTimeout = null;

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
    if (currentTeamUnsubscribe) {
      try {
        currentTeamUnsubscribe();
        databaseSubscriptions.delete(currentTeamUnsubscribe);
      } catch (error) {
        console.warn('App: Error cleaning up team subscription:', error);
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
   * Subscribe to team updates with debouncing for rapid changes
   * @param {string} teamId - Team ID to subscribe to
   * @returns {Promise<void>}
   */
  const subscribeToTeamUpdates = async (teamId) => {
    // Clean up existing subscription first
    cleanupTeamSubscription();

    try {
      // Set up new subscription
      currentTeamUnsubscribe = databaseService.subscribeToTeam(teamId, (team, error) => {
        if (error) {
          console.error('App: Team subscription error:', error);
          handleError(new Error('Lost connection to team data'));
          return;
        }

        if (!team) {
          // Team was deleted
          console.warn(`App: Team ${teamId} was deleted`);
          stateService.setState('teamData', null);
          stateService.setState('currentTeam', null);
          handleError(new Error('Team has been deleted'));
          return;
        }

        // Update team data in state
        stateService.setState('teamData', team);
      });

      // Track for cleanup
      databaseSubscriptions.add(currentTeamUnsubscribe);

    } catch (error) {
      console.error('App: Failed to subscribe to team updates:', error);
      handleError(new Error('Failed to load team data'));
      stateService.setState('teamData', null);
    }
  };

  /**
   * Set up state change subscriptions
   */
  const setupStateSubscriptions = () => {
    // User state changes
    subscribeToState('user', (user) => {
      if (user) {
        console.log('App: User signed in, updating UI...');
        document.body.classList.add('authenticated');
        updateTeamSwitcher(); // Update team switcher when user signs in
        refreshData();
      } else {
        console.log('App: User signed out, resetting UI...');
        document.body.classList.remove('authenticated');
        updateTeamSwitcher(); // Clear team switcher when user signs out
        cleanup(); // Clear all subscriptions
      }
    });

    // Current team changes
    subscribeToState('currentTeam', async (teamId) => {
      console.log('App: Current team changed:', teamId);
      if (teamId) {
        try {
          await subscribeToTeamUpdates(teamId);
          
          // Reset week offset when team changes
          stateService.setState('weekOffset', 0);
          
          await refreshData();
        } catch (error) {
          console.error('App: Failed to handle team change:', error);
          handleError(error);
        }
      } else {
        cleanupTeamSubscription();
        stateService.setState('teamData', null);
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