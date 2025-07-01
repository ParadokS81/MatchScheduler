/**
 * Team Info Component - Stage 2
 * Handles team display and management for the middle-left panel
 */

import AuthService from '../services/auth.js';
import StateService, { subscribe } from '../services/state.js';
import Modals from './modals.js';

const TeamInfo = (function() {
    let panel = null;
    let initialized = false;

    // State subscriptions
    const stateSubscriptions = new Set();

    // Team name cache to avoid repeated fetches
    const teamNameCache = new Map();

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

    // Safe user ID extraction utility
    const getSafeUserId = (user) => {
        try {
            if (AuthService && typeof AuthService.getUserId === 'function') {
                return AuthService.getUserId(user);
            }
        } catch (error) {
            console.warn('TeamInfo: AuthService.getUserId failed:', error);
        }
        
        // Fallback to direct extraction
        return user?.uid || user?.profile?.uid || null;
    };

    /**
     * Initialize the component
     * @param {string} panelId - ID of the panel element to render into
     */
    function init(panelId) {
        panel = document.getElementById(panelId);
        if (!panel) {
            console.warn(`TeamInfo: Panel with ID '${panelId}' not found`);
            return;
        }

        // Initialize state service if not already initialized
        StateService.init();

        // Subscribe to state changes
        subscribe('user', handleUserStateChange);
        subscribe('currentTeam', handleTeamStateChange);
        subscribe('teamData', handleTeamDataChange);
        subscribe('teamOperation', handleTeamOperationChange);

        // Add event delegation for button clicks and form changes
        panel.addEventListener('click', handlePanelClick);
        panel.addEventListener('change', handlePanelChange);

        // Initial render
        render();
    }

    /**
     * Handle panel click events using event delegation
     * @param {Event} event - Click event
     */
    function handlePanelClick(event) {
        const target = event.target;
        
        if (target.matches('.create-team-button')) {
            handleCreateTeamClick();
        } else if (target.matches('.join-team-button')) {
            handleJoinTeamClick();
        } else if (target.matches('.join-create-team-button')) {
            handleJoinCreateTeamClick();
        } else if (target.matches('.team-switch-btn')) {
            handleTeamSwitchClick(target);
        } else if (target.matches('#team-management-toggle') || target.closest('#team-management-toggle')) {
            handleDrawerToggle();
        } else if (target.matches('.copy-join-code-btn') || target.closest('.copy-join-code-btn')) {
            handleCopyJoinCodeClick();
        } else if (target.matches('.regenerate-join-code-btn')) {
            handleRegenerateJoinCodeClick();
        } else if (target.matches('.transfer-leadership-btn')) {
            handleTransferLeadershipClick();
        } else if (target.matches('.kick-players-btn')) {
            handleKickPlayersClick();
        } else if (target.matches('.leave-team-btn')) {
            handleLeaveTeamClick();
        } else if (target.matches('#manage-logo-btn')) {
            handleManageLogoClick();
        }
    }

    /**
     * Handle panel change events using event delegation
     * @param {Event} event - Change event
     */
    function handlePanelChange(event) {
        const target = event.target;
        
        if (target.matches('.max-players-select')) {
            handleMaxPlayersChange(target);
        }
    }

    /**
     * Handle user state changes
     * @param {Object|null} user - User state
     */
    function handleUserStateChange(user) {
        console.log('TeamInfo: User state changed', user ? 'signed in' : 'signed out');
        
        // Preload team names when user signs in
        if (user && user.profile && user.profile.teams) {
            const teamIds = getTeamIds(user.profile.teams);
            preloadTeamNames(teamIds);
        }
        
        render();
    }

    /**
     * Handle current team state changes
     * @param {string|null} teamId - Current team ID
     */
    function handleTeamStateChange(teamId) {
        console.log('TeamInfo: Current team changed', teamId);
        render();
    }

    /**
     * Handle team data state changes
     * @param {Object|null} teamData - Full team data
     */
    function handleTeamDataChange(teamData) {
        console.log('TeamInfo: Team data changed', teamData?.teamName || 'no team');
        
        // Cache the team name when we receive team data
        if (teamData && teamData.id && teamData.teamName) {
            teamNameCache.set(teamData.id, teamData.teamName);
        }
        
        render();
    }

    /**
     * Handle team operation state changes
     * @param {Object|null} teamOperation - Team operation state
     */
    function handleTeamOperationChange(teamOperation) {
        console.log('TeamInfo: Team operation changed', teamOperation?.status || 'no operation');
        render();
    }

    /**
     * Handle create team button click
     */
    function handleCreateTeamClick() {
        console.log('TeamInfo: Create Team button clicked');
        Modals.showCreateTeamModal();
    }

    /**
     * Handle join team button click
     */
    function handleJoinTeamClick() {
        console.log('TeamInfo: Join Team button clicked');
        Modals.showJoinTeamModal();
    }

    /**
     * Handle join/create team button click (for second team slot)
     */
    function handleJoinCreateTeamClick() {
        console.log('TeamInfo: Join/Create Team button clicked');
        Modals.showJoinCreateChoiceModal();
    }

    /**
     * Handle team switch button click
     * @param {Element} target - The clicked team button
     */
    function handleTeamSwitchClick(target) {
        const teamId = target.dataset.teamId;
        if (teamId && teamId !== StateService.getState('currentTeam')) {
            console.log('TeamInfo: Switching to team:', teamId);
            StateService.setState('currentTeam', teamId);
        }
    }

    /**
     * Handle drawer toggle click
     */
    function handleDrawerToggle() {
        const drawer = panel.querySelector('#team-management-drawer');
        const arrow = panel.querySelector('#team-management-arrow');
        
        if (!drawer || !arrow) return;
        
        const isOpen = drawer.classList.contains('drawer-open');
        
        if (isOpen) {
            // Close drawer
            drawer.classList.remove('drawer-open');
            drawer.classList.add('drawer-closed');
            arrow.style.transform = 'rotate(0deg)';
        } else {
            // Open drawer
            drawer.classList.remove('drawer-closed');
            drawer.classList.add('drawer-open');
            arrow.style.transform = 'rotate(180deg)';
        }
    }

    /**
     * Handle copy join code button click
     */
    async function handleCopyJoinCodeClick() {
        const teamData = StateService.getState('teamData');
        if (!teamData || !teamData.joinCode) {
            console.warn('TeamInfo: No join code available to copy');
            return;
        }

        try {
            await navigator.clipboard.writeText(teamData.joinCode);
            showToast('Join code copied to clipboard!', 'success');
        } catch (error) {
            console.warn('TeamInfo: Failed to copy join code:', error);
            // Fallback for browsers that don't support clipboard API
            fallbackCopyToClipboard(teamData.joinCode);
        }
    }

    /**
     * Handle regenerate join code button click
     */
    async function handleRegenerateJoinCodeClick() {
        const teamData = StateService.getState('teamData');
        if (!teamData) {
            console.warn('TeamInfo: No team data available');
            return;
        }

        try {
            // Import database service dynamically
            const { default: DatabaseService } = await import('../services/database.js');
            
            showToast('Regenerating join code...', 'info');
            
            await DatabaseService.regenerateJoinCode({ teamId: teamData.id });
            showToast('Join code regenerated successfully!', 'success');
        } catch (error) {
            console.error('TeamInfo: Failed to regenerate join code:', error);
            showToast('Failed to regenerate join code. Please try again.', 'error');
        }
    }

    /**
     * Handle max players dropdown change
     */
    async function handleMaxPlayersChange(selectElement) {
        const teamData = StateService.getState('teamData');
        if (!teamData) {
            console.warn('TeamInfo: No team data available');
            return;
        }

        const newMaxPlayers = parseInt(selectElement.value);
        const errorDiv = panel.querySelector('.max-players-error');
        
        // Clear any previous error
        if (errorDiv) {
            errorDiv.style.display = 'none';
            errorDiv.textContent = '';
        }

        try {
            console.log('TeamInfo: Updating max players to:', newMaxPlayers);
            
            // Import database service dynamically
            const { default: DatabaseService } = await import('../services/database.js');
            
            await DatabaseService.updateTeamSettings({ 
                teamId: teamData.id, 
                maxPlayers: newMaxPlayers 
            });
            
            console.log('TeamInfo: Max players updated successfully');
        } catch (error) {
            console.error('TeamInfo: Failed to update max players:', error);
            
            // Show error message
            if (errorDiv) {
                errorDiv.textContent = 'Failed to update max players. Please try again.';
                errorDiv.style.display = 'block';
            }
            
            // Revert dropdown to original value
            selectElement.value = teamData.maxPlayers;
        }
    }

    /**
     * Handle transfer leadership button click
     */
    function handleTransferLeadershipClick() {
        const teamData = StateService.getState('teamData');
        console.log('TeamInfo: Transfer Leadership clicked for team:', teamData?.teamName);
        console.log('TeamInfo: Current leader:', teamData?.leaderId);
        console.log('TeamInfo: Available players:', teamData?.playerRoster);
        
        // Show transfer leadership modal
        Modals.showTransferLeadershipModal();
    }

    /**
     * Handle kick players button click
     */
    function handleKickPlayersClick() {
        const teamData = StateService.getState('teamData');
        console.log('TeamInfo: Kick Players clicked for team:', teamData?.teamName);
        console.log('TeamInfo: Current roster:', teamData?.playerRoster);
        
        // Show kick players modal
        Modals.showKickPlayersModal();
    }

    /**
     * Handle leave team button click
     */
    function handleLeaveTeamClick() {
        const teamData = StateService.getState('teamData');
        const user = StateService.getState('user');
        
        const userId = getSafeUserId(user);
        
        console.log('TeamInfo: Leave Team clicked');
        console.log('TeamInfo: Team:', teamData?.teamName);
        console.log('TeamInfo: User leaving:', userId);
        console.log('TeamInfo: Is leader:', teamData?.leaderId === userId);
        
        // Show leave team modal with role-based logic
        Modals.showLeaveTeamModal();
    }

    /**
     * Handle manage logo button click
     */
    function handleManageLogoClick() {
        const teamData = StateService.getState('teamData');
        const user = StateService.getState('user');
        
        console.log('TeamInfo: Manage Logo clicked');
        console.log('TeamInfo: Team:', teamData?.teamName);
        console.log('TeamInfo: User:', getSafeUserId(user));
        
        Modals.showLogoManager();
    }

    /**
     * Fallback method to copy text to clipboard
     * @param {string} text - Text to copy
     */
    function fallbackCopyToClipboard(text) {
        const textArea = document.createElement('textarea');
        textArea.value = text;
        textArea.style.position = 'fixed';
        textArea.style.left = '-999999px';
        textArea.style.top = '-999999px';
        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();
        
        try {
            document.execCommand('copy');
            showToast('Join code copied to clipboard!', 'success');
        } catch (error) {
            console.warn('TeamInfo: Fallback copy failed:', error);
            showToast('Failed to copy join code', 'error');
        } finally {
            document.body.removeChild(textArea);
        }
    }

    /**
     * Show toast notification
     * @param {string} message - Message to show
     * @param {string} type - Type of toast (success, error, info)
     */
    function showToast(message, type = 'info') {
        // Create toast element
        const toast = document.createElement('div');
        toast.className = `fixed top-4 right-4 z-50 px-4 py-2 rounded-lg text-white text-sm font-medium transition-opacity duration-300 ${
            type === 'success' ? 'bg-green-600' :
            type === 'error' ? 'bg-red-600' :
            'bg-blue-600'
        }`;
        toast.textContent = message;
        
        // Add to page
        document.body.appendChild(toast);
        
        // Remove after 3 seconds
        setTimeout(() => {
            toast.style.opacity = '0';
            setTimeout(() => {
                if (document.body.contains(toast)) {
                    document.body.removeChild(toast);
                }
            }, 300);
        }, 3000);
    }

    /**
     * Fetch and cache team name
     * @param {string} teamId - Team ID to fetch name for
     * @returns {Promise<string>} Team name
     */
    async function fetchAndCacheTeamName(teamId) {
        // Handle both string IDs and team objects
        let actualTeamId;
        if (typeof teamId === 'string') {
            actualTeamId = teamId;
        } else if (teamId && teamId.id) {
            actualTeamId = teamId.id;
        } else {
            console.warn('TeamInfo: Invalid teamId passed to fetchAndCacheTeamName:', teamId);
            return 'Unknown Team';
        }
        
        // Validate actualTeamId is a proper string
        if (!actualTeamId || typeof actualTeamId !== 'string' || actualTeamId.trim() === '') {
            console.warn('TeamInfo: Empty or invalid actualTeamId:', actualTeamId);
            return 'Unknown Team';
        }
        
        // Check cache first
        if (teamNameCache.has(actualTeamId)) {
            const cachedName = teamNameCache.get(actualTeamId);
            // Ensure cached name is valid
            if (cachedName && cachedName !== 'undefined' && cachedName.trim() !== '') {
                return cachedName;
            } else {
                // Remove invalid cached name
                teamNameCache.delete(actualTeamId);
            }
        }
        
        try {
            console.log('TeamInfo: Fetching team name for:', actualTeamId);
            // Import database service dynamically to avoid circular dependencies
            const { default: DatabaseService } = await import('../services/database.js');
            const teamDoc = await DatabaseService.getTeam(actualTeamId);
            
            if (teamDoc && teamDoc.teamName && teamDoc.teamName.trim() !== '') {
                console.log('TeamInfo: Got team name:', teamDoc.teamName, 'for team:', actualTeamId);
                teamNameCache.set(actualTeamId, teamDoc.teamName);
                return teamDoc.teamName;
            } else {
                // Fallback if team not found or has no name
                const fallbackName = `Team ${actualTeamId.slice(-4)}`;
                console.log('TeamInfo: Using fallback name:', fallbackName, 'for team:', actualTeamId);
                teamNameCache.set(actualTeamId, fallbackName);
                return fallbackName;
            }
        } catch (error) {
            console.warn('TeamInfo: Failed to fetch team name for', actualTeamId, error);
            const fallbackName = `Team ${actualTeamId.slice(-4)}`;
            console.log('TeamInfo: Using error fallback name:', fallbackName, 'for team:', actualTeamId);
            teamNameCache.set(actualTeamId, fallbackName);
            return fallbackName;
        }
    }

    /**
     * Preload team names for user's teams
     * @param {Array} teamIds - Array of team IDs to preload
     */
    async function preloadTeamNames(teamIds) {
        if (!teamIds || teamIds.length === 0) return;
        
        // Filter out any invalid team IDs and convert objects to strings
        const validTeamIds = teamIds
            .map(teamId => typeof teamId === 'string' ? teamId : (teamId && teamId.id ? teamId.id : null))
            .filter(teamId => teamId !== null);
        
        if (validTeamIds.length === 0) return;
        
        try {
            const promises = validTeamIds.map(teamId => fetchAndCacheTeamName(teamId));
            await Promise.all(promises);
            
            // Re-render after caching names
            render();
        } catch (error) {
            console.warn('TeamInfo: Error preloading team names:', error);
        }
    }

    /**
     * Render the component based on current state
     */
    function render() {
        if (!panel) return;

        const user = StateService.getState('user');
        const currentTeam = StateService.getState('currentTeam');
        const teamData = StateService.getState('teamData');
        const teamOperation = StateService.getState('teamOperation');

        // If no user, show guest state
        if (!user) {
            panel.innerHTML = renderGuestState();
            return;
        }

        // Check if user has any teams
        const userTeams = getTeamIds(user.profile?.teams);
        const hasTeams = userTeams.length > 0;

        // If user has no teams at all, show the no teams state
        if (!hasTeams) {
            renderNoTeamsState();
            return;
        }

        // Start building panel content for users with teams
        let content = '<div class="panel-content relative">';

        // Always render team switcher if user has teams
        content += renderTeamSwitcherLayout(user, currentTeam, teamData);

        // Determine main content based on state
        if (!currentTeam) {
            // User has teams but no team selected
            content += renderNoTeamSelected();
        } else if (teamOperation.status !== 'idle' && teamOperation.status !== 'error') {
            // Show loading state during operations
            content += `
                <div class="flex flex-col items-center justify-center p-4">
                    <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
                    <p class="mt-2 text-sm text-slate-300">
                        ${teamOperation.status === 'creating' 
                            ? `Creating ${teamOperation.name}...`
                            : teamOperation.status === 'joining'
                                ? 'Joining team...'
                                : 'Processing...'}
                    </p>
                </div>
            `;
        } else if (!teamData) {
            // Team selected but data not loaded
            content += renderLoadingState();
        } else {
            // Normal team content
            content += renderTeamContent(teamData, user);
        }

        content += '</div>';
        panel.innerHTML = content;

        // Preload team names in the background if we have teams
        if (hasTeams) {
            preloadTeamNames(userTeams).catch(error => {
                console.warn('Failed to preload team names:', error);
            });
        }
    }

    /**
     * Render guest state (not signed in)
     */
    function renderGuestState() {
        panel.innerHTML = `
            <div class="panel-content">
                <div class="text-center space-y-4">
                    <h2 class="text-sm font-medium text-slate-300">Team Management</h2>
                    <p class="text-xs text-slate-400">Sign in to create or join a team</p>
                    
                    <div class="space-y-3">
                        <button class="create-team-button w-full px-4 py-2 bg-gray-600 cursor-not-allowed text-white text-sm font-medium rounded-lg" disabled>
                            Create a Team
                        </button>
                        
                        <button class="join-team-button w-full px-4 py-2 bg-gray-600 cursor-not-allowed text-white text-sm font-medium rounded-lg" disabled>
                            Join a Team
                        </button>
                    </div>
                    
                    <p class="text-xs text-slate-500">
                        Teams help organize matches and track availability
                    </p>
                </div>
            </div>
        `;
    }

    /**
     * Render team switcher layout for signed-in users
     * @param {Object} user - Current user data
     * @param {string|null} currentTeam - Current team ID
     * @param {Object|null} teamData - Current team data
     */
    function renderTeamSwitcherLayout(user, currentTeam, teamData) {
        const userTeams = getTeamIds(user.profile?.teams);
        const team1 = userTeams[0] || null;
        const team2 = userTeams[1] || null;
        
        // Get team operation state
        const teamOperation = StateService.getState('teamOperation');
        
        // Get display state for a team button
        const getTeamDisplayState = (teamId) => {
            if (!teamId) return { text: 'No Team', loading: false };
            
            const isCurrentTeam = teamId === currentTeam;
            
            // Handle team operation states
            if (teamOperation.status !== 'idle') {
                // If we're creating/joining and this is the affected team
                if (isCurrentTeam) {
                    switch (teamOperation.status) {
                        case 'creating':
                            return {
                                text: `${teamOperation.name} (Creating...)`,
                                loading: true
                            };
                        case 'joining':
                            return {
                                text: 'Joining Team...',
                                loading: true
                            };
                        case 'error':
                            return {
                                text: teamOperation.name || 'Error',
                                error: true
                            };
                    }
                }
            }
            
            // For the current team, use teamData if available
            if (isCurrentTeam) {
                return {
                    text: teamData?.teamName || 'Loading...',
                    loading: !teamData
                };
            }
            
            // For other teams, use cache or loading state
            return {
                text: teamNameCache.get(teamId) || 'Loading...',
                loading: !teamNameCache.has(teamId)
            };
        };
        
        // Get states for both team buttons
        const team1State = getTeamDisplayState(team1);
        const team2State = getTeamDisplayState(team2);
        
        // Determine if buttons should be disabled
        const isDisabled = teamOperation.status === 'creating' || teamOperation.status === 'joining';
        
        return `
                <div class="flex space-x-1 mb-3">
                <!-- Team 1 Button -->
                <button class="team-switch-btn px-3 py-1 text-sm font-medium rounded-lg transition-colors min-w-[80px] 
                    ${team1 === currentTeam ? 'bg-blue-600 text-white' : 'bg-slate-700 text-slate-300 hover:bg-slate-600'}
                    ${team1State.loading ? 'animate-pulse' : ''}
                    ${team1State.error ? 'bg-red-600' : ''}
                    ${!team1 ? 'bg-slate-800 text-slate-500 cursor-not-allowed' : ''}"
                    ${!team1 || isDisabled ? 'disabled' : ''}
                    data-team-id="${team1 || ''}"
                >
                    ${team1State.text}
                    ${team1State.loading ? '<span class="loading-spinner ml-1"></span>' : ''}
                    </button>
                    
                <!-- Team 2 Button -->
                <button class="team-switch-btn px-3 py-1 text-sm font-medium rounded-lg transition-colors min-w-[80px]
                    ${team2 === currentTeam ? 'bg-blue-600 text-white' : 'bg-slate-700 text-slate-300 hover:bg-slate-600'}
                    ${team2State.loading ? 'animate-pulse' : ''}
                    ${team2State.error ? 'bg-red-600' : ''}
                    ${!team2 ? 'bg-slate-800 text-slate-500 cursor-not-allowed' : ''}"
                    ${!team2 || isDisabled ? 'disabled' : ''}
                    data-team-id="${team2 || ''}"
                >
                    ${team2State.text}
                    ${team2State.loading ? '<span class="loading-spinner ml-1"></span>' : ''}
                    </button>
                </div>

            ${teamOperation.status === 'error' ? `
                <div class="text-red-500 text-sm mb-3">
                    ${teamOperation.error}
            </div>
            ` : ''}
        `;
    }

    /**
     * Render team content when a team is selected
     * @param {Object} teamData - Team data
     * @param {Object} user - Current user data
     */
    function renderTeamContent(teamData, user) {
        // Ensure we have complete team data before rendering
        if (!teamData || !teamData.teamName || !teamData.id) {
            console.log('TeamInfo: Waiting for team data...', { teamData: !!teamData, teamName: teamData?.teamName, id: teamData?.id });
            return `
                <div class="flex items-center justify-center py-8">
                    <div class="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-400"></div>
                    <span class="ml-3 text-sm text-slate-300">Loading team data...</span>
                </div>
            `;
        }
        
        // Use playerRoster array directly
        const roster = teamData.playerRoster || [];
        
        const logoUrl = teamData.teamLogoUrl || '/assets/images/default-team-logo.png';
        
        return `
            <!-- Team Logo - Takes more vertical space -->
            <div class="flex justify-center items-center mb-3" style="height: 45%;">
                <img src="${logoUrl}" alt="${teamData.teamName} logo" 
                     class="max-w-full max-h-full rounded-lg object-cover bg-slate-700 border border-slate-600"
                     style="width: auto; height: auto; max-width: 100%; max-height: 100%;"
                     onerror="this.src='/assets/images/default-team-logo.png'">
            </div>

            <!-- Roster List - Takes remaining space -->
            <div class="flex-1 overflow-y-auto" style="height: 40%;">
                <div class="space-y-1">
                    ${roster.map(player => `
                        <div class="flex items-center space-x-2 py-1 px-2 bg-slate-800 rounded text-xs">
                            <!-- Avatar Placeholder -->
                            <div class="w-4 h-4 rounded-full bg-slate-600 flex-shrink-0 flex items-center justify-center">
                                <img src="/assets/images/default-team-logo.png" alt="Avatar" 
                                     class="w-3 h-3 rounded-full object-cover opacity-60"
                                     onerror="this.style.display='none'">
                            </div>
                            
                            <!-- Player Info -->
                            <div class="flex-1 min-w-0">
                                <div class="text-slate-200 truncate">${player.displayName}</div>
                            </div>
                            
                            <!-- Initials -->
                            <div class="text-slate-400 font-mono">${player.initials}</div>
                        </div>
                    `).join('')}
                </div>
                
                ${roster.length === 0 ? `
                    <div class="text-center py-4">
                        <p class="text-xs text-slate-400">No players in roster</p>
                    </div>
                ` : ''}
            </div>

            <!-- Team Management Drawer -->
            <div id="team-management-drawer" class="absolute left-0 right-0 bottom-0 bg-slate-800 border border-slate-600 rounded-t-lg drawer-closed transition-transform duration-300 ease-out z-30 overflow-hidden"
                 style="top: 2.5rem;">
                
                <!-- Drawer Header (Always Visible) -->
                <button id="team-management-toggle" class="w-full h-8 bg-slate-700/50 hover:bg-slate-700 text-slate-300 hover:text-sky-300 flex items-center justify-between px-3 border-b border-slate-600 transition-colors">
                    <span class="text-sm font-medium">Team Management</span>
                    <svg id="team-management-arrow" xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="transition-transform duration-300">
                        <path d="m18 15-6-6-6 6"/>
                    </svg>
                </button>
                
                <!-- Drawer Content -->
                <div class="p-4 overflow-y-auto" style="height: calc(100% - 32px); display: flex; flex-direction: column;">
                    ${renderTeamManagementContent(teamData, user)}
                </div>
            </div>
        `;
    }

    /**
     * Render team management drawer content
     * @param {Object} teamData - Current team data
     * @param {Object} user - Current user data
     * @returns {string} HTML content for the drawer
     */
    function renderTeamManagementContent(teamData, user) {
        // Debug logging
        console.log('TeamInfo: renderTeamManagementContent called');
        console.log('TeamInfo: teamData:', teamData);
        console.log('TeamInfo: user:', user);
        
        if (!teamData || !user) {
            console.log('TeamInfo: Missing teamData or user');
            return `
                <div class="text-center py-8">
                    <p class="text-sm text-slate-400">No team selected</p>
                    <p class="text-xs text-slate-500">Debug: teamData=${!!teamData}, user=${!!user}</p>
                </div>
            `;
        }

        // Get user ID using safe accessor
        const userId = getSafeUserId(user);
        
        const isTeamLeader = teamData.leaderId === userId;
        
        console.log('TeamInfo: isTeamLeader check:', {
            teamLeaderId: teamData.leaderId,
            'resolved userId': userId,
            isTeamLeader
        });
        
        if (!isTeamLeader) {
            // Team member content
            return `
                <!-- Join Code Section - Read Only -->
                <div style="display: flex; align-items: center; gap: 0.375rem; margin-bottom: 0.75rem;">
                    <span style="font-size: 0.875rem; font-weight: 500; color: rgb(203 213 225); min-width: 5rem;">Join Code</span>
                    <div style="width: 5rem; background-color: rgb(51 65 85); border-radius: 0.25rem; padding: 0.25rem 0.5rem; font-size: 0.875rem; font-family: ui-monospace, SFMono-Regular, 'SF Mono', Consolas, 'Liberation Mono', Menlo, monospace; color: rgb(226 232 240); border: 1px solid rgb(75 85 99); text-align: center; height: 1.75rem; display: flex; align-items: center; justify-content: center;">
                        ${teamData.joinCode || 'Loading...'}
                    </div>
                    <button class="copy-join-code-btn" 
                            style="padding: 0.25rem; background-color: rgb(75 85 99); border-radius: 0.25rem; color: rgb(203 213 225); border: none; cursor: pointer; transition: background-color 0.2s; width: 1.75rem; height: 1.75rem; display: flex; align-items: center; justify-content: center;"
                            onmouseover="this.style.backgroundColor='rgb(107 114 128)'"
                            onmouseout="this.style.backgroundColor='rgb(75 85 99)'"
                            title="Copy join code">
                        <svg xmlns="http://www.w3.org/2000/svg" width="0.75rem" height="0.75rem" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                            <rect width="14" height="14" x="8" y="8" rx="2" ry="2"/>
                            <path d="m4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/>
                        </svg>
                    </button>
                </div>

                <!-- Max Players Section - Read Only -->
                <div style="display: flex; align-items: center; gap: 0.375rem; margin-bottom: 0.75rem;">
                    <span style="font-size: 0.875rem; font-weight: 500; color: rgb(203 213 225); min-width: 5rem;">Max Players</span>
                    <div style="width: 4rem; background-color: rgb(51 65 85); border-radius: 0.25rem; padding: 0.25rem 0.5rem; font-size: 0.875rem; color: rgb(226 232 240); border: 1px solid rgb(75 85 99); height: 1.75rem; display: flex; align-items: center; justify-content: center; text-align: center;">
                        ${teamData.maxPlayers || '0'}
                    </div>
                </div>

                <!-- Team Action Buttons - Leave Team only for members -->
                <div style="display: flex; flex-direction: column; gap: 0.375rem; margin-top: auto;">
                    <button class="leave-team-btn" 
                            style="width: 100%; padding: 0.375rem 0.75rem; background-color: rgb(239 68 68); border-radius: 0.25rem; color: white; border: none; cursor: pointer; font-size: 0.75rem; font-weight: 500; transition: background-color 0.2s; height: 1.75rem; display: flex; align-items: center; justify-content: center;"
                            onmouseover="this.style.backgroundColor='rgb(220 38 38)'"
                            onmouseout="this.style.backgroundColor='rgb(239 68 68)'"
                            title="Leave this team">
                        Leave Team
                    </button>
                </div>
            `;
        }

        // Team leader content
        return `
            <!-- Join Code Section - Single Line -->
            <div style="display: flex; align-items: center; gap: 0.375rem; margin-bottom: 0.75rem;">
                <span style="font-size: 0.875rem; font-weight: 500; color: rgb(203 213 225); min-width: 5rem;">Join Code</span>
                <div style="width: 5rem; background-color: rgb(51 65 85); border-radius: 0.25rem; padding: 0.25rem 0.5rem; font-size: 0.875rem; font-family: ui-monospace, SFMono-Regular, 'SF Mono', Consolas, 'Liberation Mono', Menlo, monospace; color: rgb(226 232 240); border: 1px solid rgb(75 85 99); text-align: center; height: 1.75rem; display: flex; align-items: center; justify-content: center;">
                        ${teamData.joinCode || 'Loading...'}
                    </div>
                <button class="copy-join-code-btn" 
                        style="padding: 0.25rem; background-color: rgb(75 85 99); border-radius: 0.25rem; color: rgb(203 213 225); border: none; cursor: pointer; transition: background-color 0.2s; width: 1.75rem; height: 1.75rem; display: flex; align-items: center; justify-content: center;"
                        onmouseover="this.style.backgroundColor='rgb(107 114 128)'"
                        onmouseout="this.style.backgroundColor='rgb(75 85 99)'"
                            title="Copy join code">
                    <svg xmlns="http://www.w3.org/2000/svg" width="0.75rem" height="0.75rem" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                            <rect width="14" height="14" x="8" y="8" rx="2" ry="2"/>
                            <path d="m4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/>
                        </svg>
                    </button>
                <button class="regenerate-join-code-btn" 
                        style="padding: 0.25rem; background-color: rgb(234 88 12); border-radius: 0.25rem; color: white; border: none; cursor: pointer; transition: background-color 0.2s; width: 1.75rem; height: 1.75rem; display: flex; align-items: center; justify-content: center;"
                        onmouseover="this.style.backgroundColor='rgb(194 65 12)'"
                        onmouseout="this.style.backgroundColor='rgb(234 88 12)'"
                        title="Regenerate join code">
                    <svg xmlns="http://www.w3.org/2000/svg" width="0.75rem" height="0.75rem" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8"/>
                        <path d="M21 3v5h-5"/>
                        <path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16"/>
                        <path d="M3 21v-5h5"/>
                    </svg>
                    </button>
                </div>

            <!-- Max Players Section - Single Line -->
            <div style="display: flex; align-items: center; gap: 0.375rem; margin-bottom: 0.75rem;">
                <span style="font-size: 0.875rem; font-weight: 500; color: rgb(203 213 225); min-width: 5rem;">Max Players</span>
                <select class="max-players-select" 
                        style="width: 4rem; background-color: rgb(51 65 85); border-radius: 0.25rem; padding: 0.25rem 0.5rem; font-size: 0.875rem; color: rgb(226 232 240); border: 1px solid rgb(75 85 99); height: 1.75rem; cursor: pointer;">
                    ${Array.from({length: 20}, (_, i) => i + 1).map(num => 
                        `<option value="${num}" ${teamData.maxPlayers === num ? 'selected' : ''}>${num}</option>`
                    ).join('')}
                </select>
                <div class="max-players-error" style="font-size: 0.75rem; color: rgb(239 68 68); display: none;"></div>
            </div>

            <!-- Logo Management Section -->
            <div id="logo-management-section" style="margin: 1rem 0; display: flex; justify-content: center;">
                <div style="width: 5rem; height: 5rem; background-color: rgb(51 65 85); border-radius: 0.375rem; border: 1px solid rgb(75 85 99); display: flex; align-items: center; justify-content: center;">
                    <svg style="width: 2rem; height: 2rem; color: rgb(148 163 184);" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"/>
                    </svg>
                </div>
            </div>

            <!-- Team Action Buttons - Logo Manager + Team Management -->
            <div style="display: flex; flex-direction: column; gap: 0.375rem; margin-top: auto;">
                <button id="manage-logo-btn" style="width: 100%; padding: 0.375rem 0.75rem; background-color: rgb(75 85 99); border-radius: 0.25rem; color: white; border: none; cursor: pointer; font-size: 0.75rem; font-weight: 500; transition: background-color 0.2s; height: 1.75rem; display: flex; align-items: center; justify-content: center;"
                        onmouseover="this.style.backgroundColor='rgb(100 116 139)'"
                        onmouseout="this.style.backgroundColor='rgb(75 85 99)'"
                        title="Open logo management modal">
                    Manage Logo
                </button>
                <button class="transfer-leadership-btn" 
                        style="width: 100%; padding: 0.375rem 0.75rem; background-color: rgb(59 130 246); border-radius: 0.25rem; color: white; border: none; cursor: pointer; font-size: 0.75rem; font-weight: 500; transition: background-color 0.2s; height: 1.75rem; display: flex; align-items: center; justify-content: center;"
                        onmouseover="this.style.backgroundColor='rgb(37 99 235)'"
                        onmouseout="this.style.backgroundColor='rgb(59 130 246)'"
                        title="Transfer team leadership to another player">
                    Transfer Leadership
                </button>
                <button class="kick-players-btn" 
                        style="width: 100%; padding: 0.375rem 0.75rem; background-color: rgb(234 88 12); border-radius: 0.25rem; color: white; border: none; cursor: pointer; font-size: 0.75rem; font-weight: 500; transition: background-color 0.2s; height: 1.75rem; display: flex; align-items: center; justify-content: center;"
                        onmouseover="this.style.backgroundColor='rgb(194 65 12)'"
                        onmouseout="this.style.backgroundColor='rgb(234 88 12)'"
                        title="Remove players from team">
                    Kick Players
                </button>
                <button class="leave-team-btn" 
                        style="width: 100%; padding: 0.375rem 0.75rem; background-color: rgb(239 68 68); border-radius: 0.25rem; color: white; border: none; cursor: pointer; font-size: 0.75rem; font-weight: 500; transition: background-color 0.2s; height: 1.75rem; display: flex; align-items: center; justify-content: center;"
                        onmouseover="this.style.backgroundColor='rgb(220 38 38)'"
                        onmouseout="this.style.backgroundColor='rgb(239 68 68)'"
                        title="Leave this team">
                    Leave Team
                </button>
            </div>
        `;
    }

    /**
     * Render state when user has no teams
     */
    function renderNoTeamsState() {
        panel.innerHTML = `
            <div class="panel-content">
                <div class="text-center space-y-4">
                    <h2 class="text-sm font-medium text-slate-300">Team Management</h2>
                    <p class="text-xs text-slate-400">You're not part of any teams yet</p>
                    
                    <div class="space-y-3">
                        <button class="create-team-button w-full px-4 py-2 bg-primary hover:bg-primary/90 text-white text-sm font-medium rounded-lg transition-colors">
                            Create a Team
                        </button>
                        
                        <button class="join-team-button w-full px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white text-sm font-medium rounded-lg transition-colors">
                            Join a Team
                        </button>
                    </div>
                    
                    <p class="text-xs text-slate-500">
                        Teams help organize matches and track availability
                    </p>
                </div>
            </div>
        `;
    }

    /**
     * Render state when no team is selected (this should rarely be shown now)
     */
    function renderNoTeamSelected() {
        return `
            <div class="flex-1 flex items-center justify-center">
                <div class="text-center space-y-3">
                    <div class="w-16 h-16 mx-auto bg-slate-700 rounded-lg flex items-center justify-center">
                        <svg class="w-8 h-8 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"/>
                        </svg>
                    </div>
                    <p class="text-sm text-slate-400">Select a team to view roster</p>
                </div>
            </div>
        `;
    }

    /**
     * Render loading state while team data is being fetched
     */
    function renderLoadingState() {
        panel.innerHTML = `
            <div class="panel-content">
                <div class="flex items-center justify-center py-8">
                    <div class="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-400"></div>
                    <span class="ml-3 text-sm text-slate-300">Loading team...</span>
                </div>
            </div>
        `;
    }

    // Public API
    return {
        init
    };
})();

export default TeamInfo; 