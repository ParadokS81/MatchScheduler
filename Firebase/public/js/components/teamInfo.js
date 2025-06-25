/**
 * Team Info Component - Stage 2
 * Handles team display and management for the middle-left panel
 */

import AuthService from '../services/auth.js';
import StateService, { subscribe } from '../services/state.js';
import Modals from './modals.js';

const TeamInfo = (function() {
    let panel;

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

        // Add event delegation for button clicks
        panel.addEventListener('click', handlePanelClick);

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
        } else if (target.matches('.join-code')) {
            handleJoinCodeClick(target);
        }
    }

    /**
     * Handle user state changes
     * @param {Object|null} user - User state
     */
    function handleUserStateChange(user) {
        console.log('TeamInfo: User state changed', user ? 'signed in' : 'signed out');
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
     * Handle join code click (copy to clipboard)
     * @param {Element} target - The clicked join code element
     */
    function handleJoinCodeClick(target) {
        const joinCode = target.textContent.replace('Join Code: ', '');
        navigator.clipboard.writeText(joinCode).then(() => {
            console.log('TeamInfo: Join code copied to clipboard:', joinCode);
            // TODO: Show toast notification
        }).catch(err => {
            console.error('TeamInfo: Failed to copy join code:', err);
        });
    }

    /**
     * Render the component based on current state
     */
    function render() {
        if (!panel) return;

        const user = StateService.getState('user');
        const currentTeam = StateService.getState('currentTeam');
        const teamData = StateService.getState('teamData');

        // Show team management buttons if:
        // 1. User is not signed in (guest state), OR
        // 2. User is signed in but has no current team
        if (!user || (user && !currentTeam)) {
            renderTeamManagementButtons(user);
            return;
        }

        // Show team display if user has a team
        if (user && currentTeam && teamData) {
            renderTeamDisplay(teamData, user);
            return;
        }

        // Loading state when we have a team ID but no team data yet
        if (user && currentTeam && !teamData) {
            renderLoadingState();
            return;
        }
    }

    /**
     * Render loading state while team data is being fetched
     */
    function renderLoadingState() {
        panel.innerHTML = `
            <div class="panel-content">
                <div class="flex items-center justify-center py-8">
                    <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-400"></div>
                    <span class="ml-3 text-sm text-slate-300">Loading team...</span>
                </div>
            </div>
        `;
    }

    /**
     * Render team display
     * @param {Object} teamData - Full team data
     * @param {Object} user - Current user data
     */
    function renderTeamDisplay(teamData, user) {
        const roster = teamData.playerRoster || [];
        const playerCount = roster.length;
        const maxPlayers = teamData.maxPlayers || 10;
        const joinCode = teamData.joinCode || 'N/A';
        const logoUrl = teamData.teamLogoUrl || '/assets/images/default-team-logo.png';
        
        // Find team leader
        const leader = roster.find(player => player.role === 'leader');
        
        panel.innerHTML = `
            <div class="panel-content space-y-4">
                <!-- Team Header Button -->
                <div class="w-full bg-blue-600 hover:bg-blue-700 transition-colors rounded-lg p-3 cursor-pointer">
                    <h2 class="text-lg font-bold text-white text-center">${teamData.teamName}</h2>
                </div>

                <!-- Team Logo (Centered) -->
                <div class="flex justify-center">
                    <img src="${logoUrl}" alt="${teamData.teamName} logo" 
                         class="w-24 h-24 rounded-lg object-cover bg-slate-700"
                         onerror="this.src='/assets/images/default-team-logo.png'">
                </div>

                <!-- Join Code -->
                <div class="bg-slate-800 rounded-lg p-3">
                    <div class="text-xs text-slate-400 mb-1">Team Join Code</div>
                    <button class="join-code font-mono text-sm text-blue-400 hover:text-blue-300 cursor-pointer transition-colors">
                        Join Code: ${joinCode}
                    </button>
                    <div class="text-xs text-slate-500 mt-1">Click to copy</div>
                </div>

                <!-- Player Count -->
                <div class="flex justify-between items-center text-sm">
                    <span class="text-slate-300">Team Roster</span>
                    <span class="text-slate-400">${playerCount}/${maxPlayers} players</span>
                </div>

                <!-- Roster List -->
                <div class="space-y-2 max-h-40 overflow-y-auto">
                    ${roster.map(player => `
                        <div class="flex items-center justify-between py-2 px-3 bg-slate-800 rounded-lg">
                            <div class="flex items-center space-x-2">
                                <span class="text-sm text-slate-200">
                                    ${player.displayName}
                                    ${player.role === 'leader' ? '★' : ''}
                                </span>
                                <span class="text-xs text-slate-400">(${player.initials})</span>
                            </div>
                            <div class="flex items-center space-x-2">
                                ${player.userId === user.uid ? 
                                    '<span class="text-xs text-blue-400">You</span>' : 
                                    ''
                                }
                                ${player.role === 'leader' ? 
                                    '<span class="text-xs text-yellow-400">Leader</span>' : 
                                    '<span class="text-xs text-slate-500">Member</span>'
                                }
                            </div>
                        </div>
                    `).join('')}
                </div>

                ${roster.length === 0 ? `
                    <div class="text-center py-4">
                        <p class="text-sm text-slate-400">No players in roster</p>
                    </div>
                ` : ''}
            </div>
        `;
    }

    /**
     * Render team management buttons (for guests or users without teams)
     * @param {Object|null} user - Current user state
     */
    function renderTeamManagementButtons(user) {
        const isSignedIn = !!user;
        const headerText = isSignedIn ? "Team Management" : "Team Management";
        const subText = isSignedIn ? "Create or join a team to get started" : "Sign in to create or join a team";
        const buttonsDisabled = !isSignedIn;

        panel.innerHTML = `
            <div class="panel-content space-y-4">
                <div class="text-center mb-4">
                    <h2 class="text-sm font-medium text-slate-300 mb-2">${headerText}</h2>
                    <p class="text-xs text-slate-400">${subText}</p>
                </div>
                
                <div class="space-y-3">
                    <button class="create-team-button w-full px-4 py-3 ${buttonsDisabled ? 'bg-gray-600 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700'} text-white text-sm font-medium rounded-lg transition-colors duration-200 focus:outline-none ${!buttonsDisabled ? 'focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:ring-offset-slate-900' : ''}" ${buttonsDisabled ? 'disabled' : ''}>
                        Create a Team
                    </button>
                    
                    <button class="join-team-button w-full px-4 py-3 ${buttonsDisabled ? 'bg-gray-600 cursor-not-allowed' : 'bg-green-600 hover:bg-green-700'} text-white text-sm font-medium rounded-lg transition-colors duration-200 focus:outline-none ${!buttonsDisabled ? 'focus:ring-2 focus:ring-green-500 focus:ring-offset-2 focus:ring-offset-slate-900' : ''}" ${buttonsDisabled ? 'disabled' : ''}>
                        Join a Team
                    </button>
                </div>
                
                <div class="text-center mt-4">
                    <p class="text-xs text-slate-500">
                        Teams help organize matches and track availability
                    </p>
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