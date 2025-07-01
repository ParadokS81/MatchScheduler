// modals.js - Modal components
// TODO: Implement according to Technical PRD Section 2.2

/**
 * Modals Component
 * Handles Create Team and Join Team modals with profile creation flow
 */

import AuthService from '../services/auth.js';
import StateService, { subscribe } from '../services/state.js';
import DatabaseService from '../services/database.js';

const Modals = (function() {
    let modalContainer;
    let currentModal = null;

    // Safe user ID extraction utility
    const getSafeUserId = (user) => {
        try {
            if (AuthService && typeof AuthService.getUserId === 'function') {
                return AuthService.getUserId(user);
            }
        } catch (error) {
            console.warn('Modals: AuthService.getUserId failed:', error);
        }
        
        // Fallback to direct extraction
        return user?.uid || user?.profile?.uid || null;
    };

    /**
     * Validate archive note text
     * @param {string} text - Text to validate
     * @returns {Object} { valid: boolean, error?: string, sanitized?: string }
     */
    function validateArchiveNote(text) {
        // Allow empty (it's optional)
        if (!text || text.trim() === '') {
            return { valid: true, sanitized: '' };
        }

        // Max 200 characters
        if (text.length > 200) {
            return { 
                valid: false, 
                error: 'Archive reason must be 200 characters or less' 
            };
        }

        // Only allow: letters, numbers, spaces, basic punctuation (.,!?'-)
        // Strip/prevent: < > & " ' / \ ` $ { } ( ) [ ] = + * # @ % ^ | ~
        const allowedPattern = /^[a-zA-Z0-9\s.,!?'-]+$/;
        const sanitized = text.replace(/[<>&"'/\\`${}()\[\]=+*#@%^|~]/g, '');
        
        if (!allowedPattern.test(sanitized)) {
            return { 
                valid: false, 
                error: 'Archive reason contains invalid characters. Only letters, numbers, spaces, and basic punctuation (.,!?\'-) are allowed.' 
            };
        }

        return { 
            valid: true, 
            sanitized: sanitized.trim() 
        };
    }

    /**
     * Initialize the modals component
     */
    function init() {
        modalContainer = document.getElementById('modal-container');
        if (!modalContainer) {
            console.warn('Modals: Modal container not found');
            return;
        }

        // Initialize services
        StateService.init();

        console.log('Modals: Component initialized');
    }

    /**
     * Show create team modal
     */
    function showCreateTeamModal() {
        const user = StateService.getState('user');
        if (!user) {
            console.warn('Modals: User not authenticated');
            return;
        }

        const hasProfile = !!user.profile;
        currentModal = 'create-team';

        const modalHTML = `
            <div class="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                <div class="bg-slate-800 rounded-lg shadow-xl max-w-md w-full max-h-[90vh] overflow-y-auto">
                    <div class="p-6">
                        <!-- Header -->
                        <div class="flex items-center justify-between mb-6">
                            <h2 class="text-xl font-bold text-slate-200">Create Team</h2>
                            <button class="cancel-modal text-slate-400 hover:text-slate-200 text-2xl leading-none">×</button>
                        </div>

                        <!-- Form -->
                        <form class="create-team-form space-y-4">
                            ${!hasProfile ? `
                                <!-- Profile Section -->
                                <div class="border-b border-slate-700 pb-4 mb-4">
                                    <h3 class="text-sm font-medium text-slate-300 mb-3">Create Your Profile</h3>
                                    
                                    <div class="space-y-3">
                                        <div>
                                            <label class="block text-sm text-slate-300 mb-1">Display Name *</label>
                                            <input type="text" name="displayName" required minlength="2" maxlength="20"
                                                   class="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                                   placeholder="Your display name">
                                            <div class="text-xs text-slate-400 mt-1">2-20 characters</div>
                                        </div>
                                        
                                        <div>
                                            <label class="block text-sm text-slate-300 mb-1">Initials *</label>
                                            <input type="text" name="initials" required minlength="3" maxlength="3"
                                                   class="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent uppercase"
                                                   placeholder="ABC" style="text-transform: uppercase;">
                                            <div class="text-xs text-slate-400 mt-1">Exactly 3 characters</div>
                                        </div>
                                    </div>
                                </div>
                            ` : ''}

                            <!-- Team Section -->
                            <div class="space-y-3">
                                <h3 class="text-sm font-medium text-slate-300">Team Details</h3>
                                
                                <div>
                                    <label class="block text-sm text-slate-300 mb-1">Team Name *</label>
                                    <input type="text" name="teamName" required minlength="3" maxlength="25"
                                           class="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                           placeholder="Your team name">
                                    <div class="text-xs text-slate-400 mt-1">3-25 characters</div>
                                </div>

                                <div>
                                    <label class="block text-sm text-slate-300 mb-2">Divisions * (select at least one)</label>
                                    <div class="space-y-2">
                                        <label class="flex items-center">
                                            <input type="checkbox" name="divisions" value="1" class="rounded bg-slate-700 border-slate-600 text-blue-600 focus:ring-blue-500 focus:ring-offset-0">
                                            <span class="ml-2 text-sm text-slate-300">Division 1</span>
                                        </label>
                                        <label class="flex items-center">
                                            <input type="checkbox" name="divisions" value="2" class="rounded bg-slate-700 border-slate-600 text-blue-600 focus:ring-blue-500 focus:ring-offset-0">
                                            <span class="ml-2 text-sm text-slate-300">Division 2</span>
                                        </label>
                                        <label class="flex items-center">
                                            <input type="checkbox" name="divisions" value="3" class="rounded bg-slate-700 border-slate-600 text-blue-600 focus:ring-blue-500 focus:ring-offset-0">
                                            <span class="ml-2 text-sm text-slate-300">Division 3</span>
                                        </label>
                                    </div>
                                </div>

                                <div>
                                    <label class="block text-sm text-slate-300 mb-1">Max Players *</label>
                                    <select name="maxPlayers" required
                                            class="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent">
                                        <option value="1">1 player</option>
                                        <option value="2">2 players</option>
                                        <option value="3">3 players</option>
                                        <option value="4">4 players</option>
                                        <option value="5" selected>5 players</option>
                                        <option value="6">6 players</option>
                                        <option value="7">7 players</option>
                                        <option value="8">8 players</option>
                                        <option value="9">9 players</option>
                                        <option value="10">10 players</option>
                                        <option value="11">11 players</option>
                                        <option value="12">12 players</option>
                                        <option value="13">13 players</option>
                                        <option value="14">14 players</option>
                                        <option value="15">15 players</option>
                                        <option value="16">16 players</option>
                                        <option value="17">17 players</option>
                                        <option value="18">18 players</option>
                                        <option value="19">19 players</option>
                                        <option value="20">20 players</option>
                                    </select>
                                    <div class="text-xs text-slate-400 mt-1">Team roster size limit</div>
                                </div>
                            </div>

                            <!-- Error Display -->
                            <div class="error-message hidden p-3 bg-red-900/50 border border-red-700 rounded-lg text-red-200 text-sm"></div>

                            <!-- Buttons -->
                            <div class="flex space-x-3 pt-4">
                                <button type="button" class="cancel-modal flex-1 px-4 py-2 bg-slate-600 hover:bg-slate-700 text-white rounded-lg transition-colors">
                                    Cancel
                                </button>
                                <button type="submit" class="submit-btn flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors">
                                    Create Team
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            </div>
        `;

        modalContainer.innerHTML = modalHTML;
        modalContainer.classList.remove('hidden');

        // Add event listeners
        setupModalEventListeners();
    }

    /**
     * Show join or create team choice modal
     */
    function showJoinCreateChoiceModal() {
        currentModal = 'join-create-choice';

        const modalHTML = `
            <div class="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                <div class="bg-slate-800 rounded-lg shadow-xl max-w-md w-full">
                    <div class="p-6">
                        <!-- Header -->
                        <div class="flex justify-end mb-4">
                            <button class="cancel-modal text-slate-400 hover:text-slate-200 text-2xl leading-none">×</button>
                        </div>

                        <!-- Content -->
                        <div class="mb-6">
                            <div class="flex space-x-3">
                                <button type="button" class="choice-join-team flex-1 px-4 py-4 bg-slate-700 hover:bg-slate-600 text-white rounded-lg transition-colors border border-slate-600 hover:border-slate-500">
                                    <div class="flex items-center justify-center space-x-2">
                                        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z"/>
                                        </svg>
                                        <div class="text-sm font-medium">Join Existing Team</div>
                                    </div>
                                </button>
                                
                                <button type="button" class="choice-create-team flex-1 px-4 py-4 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors">
                                    <div class="flex items-center justify-center space-x-2">
                                        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6"/>
                                        </svg>
                                        <div class="text-sm font-medium">Create New Team</div>
                                    </div>
                                </button>
                            </div>
                        </div>

                        <!-- Cancel Button -->
                        <div class="flex justify-center">
                            <button type="button" class="cancel-modal px-6 py-2 bg-slate-600 hover:bg-slate-700 text-white rounded-lg transition-colors">
                                Cancel
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        `;

        modalContainer.innerHTML = modalHTML;
        modalContainer.classList.remove('hidden');

        // Add event listeners
        setupJoinCreateChoiceEventListeners();
    }

    /**
     * Setup event listeners for join/create choice modal
     */
    function setupJoinCreateChoiceEventListeners() {
        const modal = modalContainer.querySelector('.fixed');
        if (!modal) return;

        // Cancel buttons and overlay click
        modal.addEventListener('click', (e) => {
            if (e.target.matches('.cancel-modal') || e.target === modal) {
                hideModal();
            }
        });

        // Join team choice
        modal.addEventListener('click', (e) => {
            if (e.target.matches('.choice-join-team') || e.target.closest('.choice-join-team')) {
                showJoinTeamModal();
            }
        });

        // Create team choice
        modal.addEventListener('click', (e) => {
            if (e.target.matches('.choice-create-team') || e.target.closest('.choice-create-team')) {
                showCreateTeamModal();
            }
        });
    }

    /**
     * Show join team modal
     */
    function showJoinTeamModal() {
        const user = StateService.getState('user');
        if (!user) {
            console.warn('Modals: User not authenticated');
            return;
        }

        const hasProfile = !!user.profile;
        currentModal = 'join-team';

        const modalHTML = `
            <div class="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                <div class="bg-slate-800 rounded-lg shadow-xl max-w-md w-full max-h-[90vh] overflow-y-auto">
                    <div class="p-6">
                        <!-- Header -->
                        <div class="flex items-center justify-between mb-6">
                            <h2 class="text-xl font-bold text-slate-200">Join Team</h2>
                            <button class="cancel-modal text-slate-400 hover:text-slate-200 text-2xl leading-none">×</button>
                        </div>

                        <!-- Form -->
                        <form class="join-team-form space-y-4">
                            ${!hasProfile ? `
                                <!-- Profile Section -->
                                <div class="border-b border-slate-700 pb-4 mb-4">
                                    <h3 class="text-sm font-medium text-slate-300 mb-3">Create Your Profile</h3>
                                    
                                    <div class="space-y-3">
                                        <div>
                                            <label class="block text-sm text-slate-300 mb-1">Display Name *</label>
                                            <input type="text" name="displayName" required minlength="2" maxlength="20"
                                                   class="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                                   placeholder="Your display name">
                                            <div class="text-xs text-slate-400 mt-1">2-20 characters</div>
                                        </div>
                                        
                                        <div>
                                            <label class="block text-sm text-slate-300 mb-1">Initials *</label>
                                            <input type="text" name="initials" required minlength="3" maxlength="3"
                                                   class="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent uppercase"
                                                   placeholder="ABC" style="text-transform: uppercase;">
                                            <div class="text-xs text-slate-400 mt-1">Exactly 3 characters</div>
                                        </div>
                                    </div>
                                </div>
                            ` : ''}

                            <!-- Join Code Section -->
                            <div class="space-y-3">
                                <h3 class="text-sm font-medium text-slate-300">Team Join Code</h3>
                                
                                <div>
                                    <label class="block text-sm text-slate-300 mb-1">Join Code *</label>
                                    <input type="text" name="joinCode" required minlength="6" maxlength="6"
                                           class="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent font-mono uppercase"
                                           placeholder="ABC123" style="text-transform: uppercase;">
                                    <div class="text-xs text-slate-400 mt-1">6 character team code</div>
                                </div>
                            </div>

                            <!-- Error Display -->
                            <div class="error-message hidden p-3 bg-red-900/50 border border-red-700 rounded-lg text-red-200 text-sm"></div>

                            <!-- Buttons -->
                            <div class="flex space-x-3 pt-4">
                                <button type="button" class="cancel-modal flex-1 px-4 py-2 bg-slate-600 hover:bg-slate-700 text-white rounded-lg transition-colors">
                                    Cancel
                                </button>
                                <button type="submit" class="submit-btn flex-1 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors">
                                    Join Team
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            </div>
        `;

        modalContainer.innerHTML = modalHTML;
        modalContainer.classList.remove('hidden');

        // Add event listeners
        setupModalEventListeners();
    }

    /**
     * Show transfer leadership modal
     */
    function showTransferLeadershipModal() {
        const teamData = StateService.getState('teamData');
        const user = StateService.getState('user');
        
        if (!teamData || !user) {
            console.warn('Modals: Missing team data or user');
            return;
        }

        const userId = AuthService.getUserId(user);
        
        // Filter out current leader from player roster
        const eligiblePlayers = teamData.playerRoster?.filter(player => player.userId !== userId) || [];
        
        if (eligiblePlayers.length === 0) {
            console.warn('Modals: No eligible players for leadership transfer');
            return;
        }

        currentModal = 'transfer-leadership';

        const modalHTML = `
            <div class="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                <div class="bg-slate-800 rounded-lg shadow-xl max-w-md w-full max-h-[90vh] overflow-y-auto">
                    <div class="p-6">
                        <!-- Header -->
                        <div class="flex items-center justify-between mb-6">
                            <h2 class="text-xl font-bold text-slate-200">Transfer Team Leadership</h2>
                            <button class="cancel-modal text-slate-400 hover:text-slate-200 text-2xl leading-none">×</button>
                        </div>

                        <!-- Player List -->
                        <div class="space-y-2 mb-6">
                            ${eligiblePlayers.map(player => `
                                <div class="player-row cursor-pointer py-2 px-3 bg-slate-700 hover:bg-slate-600 rounded transition-colors border border-slate-600 hover:border-slate-500"
                                     data-user-id="${player.userId}"
                                     data-display-name="${player.displayName}">
                                    <div class="flex items-center space-x-3">
                                        <!-- Avatar Placeholder -->
                                        <div class="w-6 h-6 rounded-full bg-slate-600 flex-shrink-0 flex items-center justify-center">
                                            <img src="/assets/images/default-team-logo.png" alt="Avatar" 
                                                 class="w-5 h-5 rounded-full object-cover opacity-60"
                                                 onerror="this.style.display='none'">
                                        </div>
                                        
                                        <!-- Player Info -->
                                        <div class="flex-1 min-w-0">
                                            <div class="text-slate-200 text-sm truncate">${player.displayName}</div>
                                        </div>
                                        
                                        <!-- Initials -->
                                        <div class="text-slate-400 font-mono text-sm">${player.initials}</div>
                                    </div>
                                </div>
                            `).join('')}
                        </div>

                        <!-- Error Display -->
                        <div class="error-message hidden p-3 bg-red-900/50 border border-red-700 rounded-lg text-red-200 text-sm mb-4"></div>

                        <!-- Cancel Button -->
                        <div class="flex justify-end">
                            <button type="button" class="cancel-modal px-4 py-2 bg-slate-600 hover:bg-slate-700 text-white rounded-lg transition-colors">
                                Cancel
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        `;

        modalContainer.innerHTML = modalHTML;
        modalContainer.classList.remove('hidden');

        // Add event listeners
        setupTransferLeadershipEventListeners();
    }

    /**
     * Show kick players modal
     */
    function showKickPlayersModal() {
        const teamData = StateService.getState('teamData');
        const user = StateService.getState('user');
        
        if (!teamData || !user) {
            console.warn('Modals: Missing team data or user');
            return;
        }

        const userId = AuthService.getUserId(user);
        
        // Filter out current leader from player roster (can't kick yourself)
        const kickablePlayers = teamData.playerRoster?.filter(player => player.userId !== userId) || [];
        
        if (kickablePlayers.length === 0) {
            console.warn('Modals: No kickable players found');
            return;
        }

        currentModal = 'kick-players';

        const modalHTML = `
            <div class="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                <div class="bg-slate-800 rounded-lg shadow-xl max-w-md w-full max-h-[90vh] overflow-y-auto">
                    <div class="p-6">
                        <!-- Header -->
                        <div class="flex items-center justify-between mb-6">
                            <div>
                                <h2 class="text-xl font-bold text-slate-200">Remove Players</h2>
                                <p class="text-sm text-slate-400 mt-1">Select players to remove from the team</p>
                            </div>
                            <button class="cancel-modal text-slate-400 hover:text-slate-200 text-2xl leading-none">×</button>
                        </div>

                        <!-- Player List -->
                        <div class="space-y-2 mb-6">
                            ${kickablePlayers.map(player => `
                                <div class="player-row cursor-pointer py-2 px-3 bg-slate-700 hover:bg-slate-600 rounded transition-colors border border-slate-600 hover:border-slate-500 player-selectable"
                                     data-user-id="${player.userId}"
                                     data-display-name="${player.displayName}">
                                    <div class="flex items-center space-x-3">
                                        <!-- Selection Indicator -->
                                        <div class="selection-indicator w-5 h-5 rounded border-2 border-slate-500 flex-shrink-0 flex items-center justify-center">
                                            <svg class="w-3 h-3 text-white hidden" fill="currentColor" viewBox="0 0 20 20">
                                                <path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd"></path>
                                            </svg>
                                        </div>
                                        
                                        <!-- Avatar Placeholder -->
                                        <div class="w-6 h-6 rounded-full bg-slate-600 flex-shrink-0 flex items-center justify-center">
                                            <img src="/assets/images/default-team-logo.png" alt="Avatar" 
                                                 class="w-5 h-5 rounded-full object-cover opacity-60"
                                                 onerror="this.style.display='none'">
                                        </div>
                                        
                                        <!-- Player Info -->
                                        <div class="flex-1 min-w-0">
                                            <div class="text-slate-200 text-sm truncate">${player.displayName}</div>
                                        </div>
                                        
                                        <!-- Initials -->
                                        <div class="text-slate-400 font-mono text-sm">${player.initials}</div>
                                    </div>
                                </div>
                            `).join('')}
                        </div>

                        <!-- Error Display -->
                        <div class="error-message hidden p-3 bg-red-900/50 border border-red-700 rounded-lg text-red-200 text-sm mb-4"></div>

                        <!-- Action Buttons -->
                        <div class="flex space-x-3">
                            <button type="button" class="cancel-modal flex-1 px-4 py-2 bg-slate-600 hover:bg-slate-700 text-white rounded-lg transition-colors">
                                Cancel
                            </button>
                            <button type="button" class="remove-players-btn flex-1 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors disabled:bg-slate-600 disabled:cursor-not-allowed" disabled>
                                Remove (0)
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        `;

        modalContainer.innerHTML = modalHTML;
        modalContainer.classList.remove('hidden');

        // Add event listeners
        setupKickPlayersEventListeners();
    }

    /**
     * Show leave team modal with role-based logic
     */
    function showLeaveTeamModal() {
        const user = StateService.getState('user');
        const teamData = StateService.getState('teamData');
        
        if (!user || !teamData) {
            console.warn('Modals: User or team data not available');
            return;
        }

        // Get user ID using safe extraction
        const userId = getSafeUserId(user);
        if (!userId) {
            console.warn('Modals: Could not get user ID');
            return;
        }

        // Check user role
        const isLeader = teamData.leaderId === userId;
        const isLastMember = teamData.playerRoster.length === 1;
        
        console.log('Leave team modal:', { isLeader, isLastMember, rosterCount: teamData.playerRoster.length });

        let modalHTML;
        
        if (!isLeader) {
            // Flow A: Regular Player
            modalHTML = createRegularPlayerLeaveModal(teamData.teamName);
            currentModal = 'leave-team-regular';
        } else if (isLeader && !isLastMember) {
            // Flow B: Leader (not last member)
            modalHTML = createLeaderCannotLeaveModal();
            currentModal = 'leave-team-leader-blocked';
        } else if (isLeader && isLastMember) {
            // Flow C: Leader (last member)
            modalHTML = createArchiveTeamModal(teamData.teamName);
            currentModal = 'leave-team-archive';
        }

        modalContainer.innerHTML = modalHTML;
        modalContainer.classList.remove('hidden');

        // Add event listeners based on modal type
        setupLeaveTeamEventListeners();
    }

    /**
     * Create regular player leave modal HTML
     * @param {string} teamName - Name of the team
     * @returns {string} Modal HTML
     */
    function createRegularPlayerLeaveModal(teamName) {
        return `
            <div class="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                <div class="bg-slate-800 rounded-lg shadow-xl max-w-md w-full">
                    <div class="p-6">
                        <!-- Header -->
                        <div class="flex items-center justify-between mb-6">
                            <h2 class="text-xl font-bold text-slate-200">Leave Team</h2>
                            <button class="cancel-modal text-slate-400 hover:text-slate-200 text-2xl leading-none">×</button>
                        </div>

                        <!-- Content -->
                        <div class="mb-6">
                            <p class="text-slate-300">Are you sure you want to leave <strong class="text-white">${teamName}</strong>?</p>
                        </div>

                        <!-- Buttons -->
                        <div class="flex space-x-3">
                            <button type="button" class="cancel-modal flex-1 px-4 py-2 bg-slate-600 hover:bg-slate-700 text-white rounded-lg transition-colors">
                                Cancel
                            </button>
                            <button type="button" class="confirm-leave-btn flex-1 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors">
                                Yes, Leave Team
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }

    /**
     * Create leader cannot leave modal HTML
     * @returns {string} Modal HTML
     */
    function createLeaderCannotLeaveModal() {
        return `
            <div class="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                <div class="bg-slate-800 rounded-lg shadow-xl max-w-md w-full">
                    <div class="p-6">
                        <!-- Header -->
                        <div class="flex items-center justify-between mb-6">
                            <h2 class="text-xl font-bold text-slate-200">Cannot Leave Team</h2>
                            <button class="cancel-modal text-slate-400 hover:text-slate-200 text-2xl leading-none">×</button>
                        </div>

                        <!-- Content -->
                        <div class="mb-6">
                            <p class="text-slate-300">You must transfer leadership before leaving the team.</p>
                        </div>

                        <!-- Button -->
                        <div class="flex justify-center">
                            <button type="button" class="cancel-modal px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors">
                                OK
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }

    /**
     * Create archive team modal HTML
     * @param {string} teamName - Name of the team
     * @returns {string} Modal HTML
     */
    function createArchiveTeamModal(teamName) {
        return `
            <div class="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                <div class="bg-slate-800 rounded-lg shadow-xl max-w-md w-full">
                    <div class="p-6">
                        <!-- Header -->
                        <div class="flex items-center justify-between mb-6">
                            <h2 class="text-xl font-bold text-slate-200">Archive Team</h2>
                            <button class="cancel-modal text-slate-400 hover:text-slate-200 text-2xl leading-none">×</button>
                        </div>

                        <!-- Content -->
                        <div class="mb-6">
                            <p class="text-slate-300 mb-4">You are the last member. Leaving will permanently archive <strong class="text-white">${teamName}</strong>.</p>
                            
                            <!-- Optional reason field -->
                            <div>
                                <label class="block text-sm text-slate-300 mb-2">Why are you archiving this team? (optional)</label>
                                <textarea id="archive-reason" maxlength="200" rows="3"
                                         class="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                                         placeholder="Optional reason for archiving..."></textarea>
                                
                                <!-- Error message -->
                                <div id="archive-error" class="hidden mt-2 p-2 bg-red-900/50 border border-red-700 rounded text-red-200 text-xs"></div>
                                
                                <div class="flex justify-between items-center mt-1">
                                    <div class="text-xs text-slate-500">This will help with future team management</div>
                                    <div id="char-counter" class="text-xs text-slate-400">0/200</div>
                                </div>
                            </div>
                        </div>

                        <!-- Buttons -->
                        <div class="flex space-x-3">
                            <button type="button" class="cancel-modal flex-1 px-4 py-2 bg-slate-600 hover:bg-slate-700 text-white rounded-lg transition-colors">
                                Cancel
                            </button>
                            <button type="button" class="confirm-archive-btn flex-1 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors">
                                Leave and Archive
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }

    /**
     * Setup event listeners for leave team modals
     */
    function setupLeaveTeamEventListeners() {
        const modal = modalContainer.querySelector('.fixed');
        if (!modal) return;

        // Cancel buttons
        modal.addEventListener('click', (e) => {
            if (e.target.matches('.cancel-modal') || e.target === modal) {
                hideModal();
            }
        });

        // Regular player leave confirmation
        const confirmLeaveBtn = modal.querySelector('.confirm-leave-btn');
        if (confirmLeaveBtn) {
            confirmLeaveBtn.addEventListener('click', handleRegularPlayerLeave);
        }

        // Archive team confirmation
        const confirmArchiveBtn = modal.querySelector('.confirm-archive-btn');
        if (confirmArchiveBtn) {
            confirmArchiveBtn.addEventListener('click', handleArchiveTeam);
        }

        // Character counter and validation for archive reason
        const reasonTextarea = modal.querySelector('#archive-reason');
        const charCounter = modal.querySelector('#char-counter');
        const errorDiv = modal.querySelector('#archive-error');
        const submitBtn = modal.querySelector('.confirm-archive-btn');
        
        if (reasonTextarea && charCounter) {
            reasonTextarea.addEventListener('input', () => {
                const text = reasonTextarea.value;
                const length = text.length;
                
                // Update character counter
                charCounter.textContent = `${length}/200`;
                
                // Update color based on length
                if (length > 180) {
                    charCounter.className = 'text-xs text-red-400';
                } else if (length > 150) {
                    charCounter.className = 'text-xs text-yellow-400';
                } else {
                    charCounter.className = 'text-xs text-slate-400';
                }
                
                // Validate text
                const validation = validateArchiveNote(text);
                
                if (validation.valid) {
                    // Hide error message
                    if (errorDiv) {
                        errorDiv.classList.add('hidden');
                    }
                    // Enable submit button
                    if (submitBtn) {
                        submitBtn.disabled = false;
                        submitBtn.classList.remove('opacity-50', 'cursor-not-allowed');
                    }
                    // Remove error styling from textarea
                    reasonTextarea.classList.remove('border-red-500');
                    reasonTextarea.classList.add('border-slate-600');
                } else {
                    // Show error message
                    if (errorDiv) {
                        errorDiv.textContent = validation.error;
                        errorDiv.classList.remove('hidden');
                    }
                    // Disable submit button
                    if (submitBtn) {
                        submitBtn.disabled = true;
                        submitBtn.classList.add('opacity-50', 'cursor-not-allowed');
                    }
                    // Add error styling to textarea
                    reasonTextarea.classList.remove('border-slate-600');
                    reasonTextarea.classList.add('border-red-500');
                }
            });
        }
    }

    /**
     * Handle regular player leaving team
     */
    async function handleRegularPlayerLeave() {
        const confirmBtn = modalContainer.querySelector('.confirm-leave-btn');
        const teamData = StateService.getState('teamData');
        
        if (!teamData) {
            console.error('No team data available');
            return;
        }

        try {
            setLoadingState(confirmBtn, true);
            
            console.log('Leaving team:', teamData.id);
            const result = await DatabaseService.leaveTeam({ teamId: teamData.id });
            
            if (result.success) {
                // Refresh user profile to update teams list
                await AuthService.refreshProfile();
                
                // Clear current team selection
                StateService.setState('currentTeam', null);
                StateService.setState('teamData', null);
                
                hideModal();
                console.log('Successfully left team');
            } else {
                throw new Error(result.message || 'Failed to leave team');
            }
        } catch (error) {
            console.error('Error leaving team:', error);
            // Show error in modal or as toast
            alert('Failed to leave team: ' + error.message);
        } finally {
            setLoadingState(confirmBtn, false);
        }
    }

    /**
     * Handle archiving team (leader leaving as last member)
     */
    async function handleArchiveTeam() {
        const confirmBtn = modalContainer.querySelector('.confirm-archive-btn');
        const reasonTextarea = modalContainer.querySelector('#archive-reason');
        const errorDiv = modalContainer.querySelector('#archive-error');
        const teamData = StateService.getState('teamData');
        
        if (!teamData) {
            console.error('No team data available');
            return;
        }

        // Validate before submission
        const reasonText = reasonTextarea ? reasonTextarea.value : '';
        const validation = validateArchiveNote(reasonText);
        
        if (!validation.valid) {
            // Show error and don't proceed
            if (errorDiv) {
                errorDiv.textContent = validation.error;
                errorDiv.classList.remove('hidden');
            }
            return;
        }

        try {
            setLoadingState(confirmBtn, true);
            
            const sanitizedReason = validation.sanitized;
            
            console.log('Archiving team:', teamData.id, 'Reason:', sanitizedReason);
            
            // Use the updated leaveTeam function with archiveNote parameter
            const result = await DatabaseService.leaveTeam({ 
                teamId: teamData.id,
                archiveNote: sanitizedReason 
            });
            
            if (result.success) {
                // Refresh user profile to update teams list
                await AuthService.refreshProfile();
                
                // Clear current team selection
                StateService.setState('currentTeam', null);
                StateService.setState('teamData', null);
                
                hideModal();
                console.log('Successfully archived team');
            } else {
                throw new Error(result.message || 'Failed to archive team');
            }
        } catch (error) {
            console.error('Error archiving team:', error);
            // Show error in modal or as toast
            alert('Failed to archive team: ' + error.message);
        } finally {
            setLoadingState(confirmBtn, false);
        }
    }

    /**
     * Show kick players confirmation
     */
    function showKickPlayersConfirmation(selectedPlayers) {
        const playerCount = selectedPlayers.length;
        const playerNames = selectedPlayers.map(p => p.displayName).join(', ');
        
        const modalHTML = `
            <div class="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                <div class="bg-slate-800 rounded-lg shadow-xl max-w-md w-full">
                    <div class="p-6">
                        <!-- Header -->
                        <div class="flex items-center justify-between mb-6">
                            <h2 class="text-xl font-bold text-slate-200">Confirm Removal</h2>
                        </div>

                        <!-- Confirmation Message -->
                        <div class="mb-6">
                            <p class="text-slate-300 text-center">
                                Remove ${playerCount} player${playerCount > 1 ? 's' : ''} from the team?
                            </p>
                            <div class="mt-3 p-3 bg-slate-700 rounded-lg">
                                <p class="text-sm text-slate-200 font-medium">${playerNames}</p>
                            </div>
                            <p class="text-sm text-slate-400 text-center mt-3">
                                This action cannot be undone. They will need to rejoin using the team code.
                            </p>
                        </div>

                        <!-- Error Display -->
                        <div class="error-message hidden p-3 bg-red-900/50 border border-red-700 rounded-lg text-red-200 text-sm mb-4"></div>

                        <!-- Buttons -->
                        <div class="flex space-x-3">
                            <button type="button" class="cancel-kick flex-1 px-4 py-2 bg-slate-600 hover:bg-slate-700 text-white rounded-lg transition-colors">
                                Cancel
                            </button>
                            <button type="button" class="confirm-kick flex-1 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors"
                                    data-selected-players='${JSON.stringify(selectedPlayers)}'>
                                Yes, Remove
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        `;

        modalContainer.innerHTML = modalHTML;
        
        // Add event listeners for confirmation modal
        setupKickConfirmationEventListeners();
    }

    /**
     * Show transfer leadership confirmation
     */
    function showTransferLeadershipConfirmation(targetUserId, targetDisplayName) {
        const modalHTML = `
            <div class="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                <div class="bg-slate-800 rounded-lg shadow-xl max-w-md w-full">
                    <div class="p-6">
                        <!-- Header -->
                        <div class="flex items-center justify-between mb-6">
                            <h2 class="text-xl font-bold text-slate-200">Confirm Transfer</h2>
                        </div>

                        <!-- Confirmation Message -->
                        <div class="mb-6">
                            <p class="text-slate-300 text-center">
                                Transfer leadership to <span class="font-semibold text-white">${targetDisplayName}</span>?
                            </p>
                            <p class="text-sm text-slate-400 text-center mt-2">
                                You will no longer be the team leader.
                            </p>
                        </div>

                        <!-- Error Display -->
                        <div class="error-message hidden p-3 bg-red-900/50 border border-red-700 rounded-lg text-red-200 text-sm mb-4"></div>

                        <!-- Buttons -->
                        <div class="flex space-x-3">
                            <button type="button" class="cancel-transfer flex-1 px-4 py-2 bg-slate-600 hover:bg-slate-700 text-white rounded-lg transition-colors">
                                Cancel
                            </button>
                            <button type="button" class="confirm-transfer flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
                                    data-target-user-id="${targetUserId}">
                                Yes, Transfer
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        `;

        modalContainer.innerHTML = modalHTML;
        
        // Add event listeners for confirmation modal
        setupTransferConfirmationEventListeners();
    }

    /**
     * Hide the current modal
     */
    function hideModal() {
        if (modalContainer) {
            modalContainer.classList.add('hidden');
            modalContainer.innerHTML = '';
        }
        currentModal = null;
    }

    /**
     * Setup event listeners for transfer leadership modal
     */
    function setupTransferLeadershipEventListeners() {
        if (!modalContainer) return;

        // Cancel buttons and overlay click
        modalContainer.addEventListener('click', (e) => {
            if (e.target.matches('.cancel-modal') || e.target === modalContainer.firstElementChild) {
                hideModal();
            }
        });

        // Player row clicks
        modalContainer.addEventListener('click', (e) => {
            const playerRow = e.target.closest('.player-row');
            if (playerRow) {
                const targetUserId = playerRow.dataset.userId;
                const targetDisplayName = playerRow.dataset.displayName;
                showTransferLeadershipConfirmation(targetUserId, targetDisplayName);
            }
        });
    }

    /**
     * Setup event listeners for transfer leadership confirmation modal
     */
    function setupTransferConfirmationEventListeners() {
        if (!modalContainer) return;

        // Cancel transfer
        modalContainer.addEventListener('click', (e) => {
            if (e.target.matches('.cancel-transfer')) {
                showTransferLeadershipModal(); // Go back to player selection
            }
        });

        // Confirm transfer
        modalContainer.addEventListener('click', (e) => {
            if (e.target.matches('.confirm-transfer')) {
                const targetUserId = e.target.dataset.targetUserId;
                handleTransferLeadership(targetUserId);
            }
        });
    }

    /**
     * Setup event listeners for kick players modal
     */
    function setupKickPlayersEventListeners() {
        if (!modalContainer) return;

        let selectedPlayers = [];

        // Cancel buttons and overlay click
        modalContainer.addEventListener('click', (e) => {
            if (e.target.matches('.cancel-modal') || e.target === modalContainer.firstElementChild) {
                hideModal();
            }
        });

        // Player selection toggle
        modalContainer.addEventListener('click', (e) => {
            const playerRow = e.target.closest('.player-selectable');
            if (playerRow) {
                const userId = playerRow.dataset.userId;
                const displayName = playerRow.dataset.displayName;
                
                // Toggle selection
                const isSelected = selectedPlayers.some(p => p.userId === userId);
                
                if (isSelected) {
                    // Remove from selection
                    selectedPlayers = selectedPlayers.filter(p => p.userId !== userId);
                    updatePlayerRowSelection(playerRow, false);
                } else {
                    // Add to selection
                    selectedPlayers.push({ userId, displayName });
                    updatePlayerRowSelection(playerRow, true);
                }
                
                updateRemoveButton(selectedPlayers);
            }
        });

        // Remove players button click
        modalContainer.addEventListener('click', (e) => {
            if (e.target.matches('.remove-players-btn') && selectedPlayers.length > 0) {
                showKickPlayersConfirmation(selectedPlayers);
            }
        });
    }

    /**
     * Update visual state of player row selection
     */
    function updatePlayerRowSelection(playerRow, isSelected) {
        const indicator = playerRow.querySelector('.selection-indicator');
        const checkmark = indicator.querySelector('svg');
        
        if (isSelected) {
            playerRow.classList.add('border-red-500', 'bg-red-900/20');
            playerRow.classList.remove('border-slate-600');
            indicator.classList.add('bg-red-600', 'border-red-500');
            indicator.classList.remove('border-slate-500');
            checkmark.classList.remove('hidden');
        } else {
            playerRow.classList.remove('border-red-500', 'bg-red-900/20');
            playerRow.classList.add('border-slate-600');
            indicator.classList.remove('bg-red-600', 'border-red-500');
            indicator.classList.add('border-slate-500');
            checkmark.classList.add('hidden');
        }
    }

    /**
     * Update remove button state and text
     */
    function updateRemoveButton(selectedPlayers) {
        const removeBtn = modalContainer.querySelector('.remove-players-btn');
        if (removeBtn) {
            const count = selectedPlayers.length;
            if (count === 0) {
                removeBtn.disabled = true;
                removeBtn.textContent = 'Remove (0)';
            } else {
                removeBtn.disabled = false;
                removeBtn.textContent = `Remove (${count})`;
            }
        }
    }

    /**
     * Setup event listeners for kick players confirmation modal
     */
    function setupKickConfirmationEventListeners() {
        if (!modalContainer) return;

        // Cancel kick
        modalContainer.addEventListener('click', (e) => {
            if (e.target.matches('.cancel-kick')) {
                showKickPlayersModal(); // Go back to player selection
            }
        });

        // Confirm kick
        modalContainer.addEventListener('click', (e) => {
            if (e.target.matches('.confirm-kick')) {
                const selectedPlayersData = JSON.parse(e.target.dataset.selectedPlayers);
                handleKickPlayers(selectedPlayersData);
            }
        });
    }

    /**
     * Handle the actual player removal
     */
    async function handleKickPlayers(selectedPlayers) {
        const teamData = StateService.getState('teamData');
        const errorDiv = modalContainer.querySelector('.error-message');
        const confirmBtn = modalContainer.querySelector('.confirm-kick');
        
        if (!teamData || !selectedPlayers || selectedPlayers.length === 0) {
            console.error('Modals: Missing team data or selected players');
            return;
        }

        try {
            // Show loading state
            setLoadingState(confirmBtn, true);
            hideError(errorDiv);

            console.log('Modals: Kicking players:', selectedPlayers);
            
            // Call the database service to remove each player
            for (const player of selectedPlayers) {
                await DatabaseService.removePlayer({
                    teamId: teamData.id,
                    targetUserId: player.userId
                });
            }

            console.log('Modals: Players kicked successfully');
            
            // Refresh team data to reflect changes
            try {
                const updatedTeamData = await DatabaseService.getTeam(teamData.id);
                if (updatedTeamData) {
                    StateService.setState('teamData', updatedTeamData);
                }
            } catch (refreshError) {
                console.warn('Modals: Failed to refresh team data after kick:', refreshError);
                // Non-critical error - kick succeeded, just refresh might have failed
            }
            
            // Close modal
            hideModal();
            
        } catch (error) {
            console.error('Modals: Kick players error:', error);
            showError(errorDiv, error.message || 'Failed to remove players. Please try again.');
        } finally {
            setLoadingState(confirmBtn, false);
        }
    }

    /**
     * Handle the actual leadership transfer
     */
    async function handleTransferLeadership(targetUserId) {
        const teamData = StateService.getState('teamData');
        const errorDiv = modalContainer.querySelector('.error-message');
        const confirmBtn = modalContainer.querySelector('.confirm-transfer');
        
        if (!teamData || !targetUserId) {
            console.error('Modals: Missing team data or target user ID');
            return;
        }

        try {
            // Show loading state
            setLoadingState(confirmBtn, true);
            hideError(errorDiv);

            console.log('Modals: Transferring leadership to:', targetUserId);
            
            // Call the database service to transfer leadership
            await DatabaseService.transferLeadership({
                teamId: teamData.id,
                newLeaderId: targetUserId
            });

            console.log('Modals: Leadership transferred successfully');
            
            // Refresh team data to reflect changes
            try {
                const updatedTeamData = await DatabaseService.getTeam(teamData.id);
                if (updatedTeamData) {
                    StateService.setState('teamData', updatedTeamData);
                }
            } catch (refreshError) {
                console.warn('Modals: Failed to refresh team data after transfer:', refreshError);
                // Non-critical error - leadership transfer succeeded, just refresh might have failed
            }
            
            // Close modal
            hideModal();
            
        } catch (error) {
            console.error('Modals: Transfer leadership error:', error);
            showError(errorDiv, error.message || 'Failed to transfer leadership. Please try again.');
        } finally {
            setLoadingState(confirmBtn, false);
        }
    }

    /**
     * Setup event listeners for the current modal
     */
    function setupModalEventListeners() {
        if (!modalContainer) return;

        // Cancel buttons and overlay click
        modalContainer.addEventListener('click', (e) => {
            if (e.target.matches('.cancel-modal') || e.target === modalContainer.firstElementChild) {
                hideModal();
            }
        });

        // Form submission
        const form = modalContainer.querySelector('form');
        if (form) {
            form.addEventListener('submit', handleFormSubmit);
        }

        // Auto-uppercase for initials and join code
        const initialsInput = modalContainer.querySelector('input[name="initials"]');
        const joinCodeInput = modalContainer.querySelector('input[name="joinCode"]');
        
        if (initialsInput) {
            initialsInput.addEventListener('input', (e) => {
                e.target.value = e.target.value.toUpperCase();
            });
        }
        
        if (joinCodeInput) {
            joinCodeInput.addEventListener('input', (e) => {
                e.target.value = e.target.value.toUpperCase();
            });
        }
    }

    /**
     * Handle form submission
     * @param {Event} e - Submit event
     */
    async function handleFormSubmit(e) {
        e.preventDefault();
        
        const form = e.target;
        const formData = new FormData(form);
        const submitBtn = form.querySelector('.submit-btn');
        const errorDiv = form.querySelector('.error-message');
        
        // Clear previous errors
        hideError(errorDiv);
        
        try {
            // Show loading state
            setLoadingState(submitBtn, true);
            
            // Validate form
            const validationError = validateForm(formData);
            if (validationError) {
                showError(errorDiv, validationError);
                return;
            }
            
            const user = StateService.getState('user');
            let profileData = null;
            
            // Create profile if needed
            if (!user.profile) {
                profileData = {
                    displayName: formData.get('displayName'),
                    initials: formData.get('initials')
                };
                
                console.log('Modals: Creating profile...');
                await AuthService.updateProfile(profileData);
            }
            
            // Handle team creation or joining
            if (currentModal === 'create-team') {
                await handleCreateTeam(formData);
            } else if (currentModal === 'join-team') {
                await handleJoinTeam(formData);
            }
            
            // Success - close modal
            hideModal();
            
        } catch (error) {
            console.error('Modals: Form submission error:', error);
            showError(errorDiv, error.message || 'An error occurred. Please try again.');
        } finally {
            setLoadingState(submitBtn, false);
        }
    }

    /**
     * Validate form data
     * @param {FormData} formData - Form data to validate
     * @returns {string|null} Error message or null if valid
     */
    function validateForm(formData) {
        const user = StateService.getState('user');
        
        // Profile validation if needed
        if (!user.profile) {
            const displayName = formData.get('displayName')?.trim();
            const initials = formData.get('initials')?.trim();
            
            if (!displayName || displayName.length < 2 || displayName.length > 20) {
                return 'Display name must be between 2 and 20 characters';
            }
            
            if (!initials || initials.length !== 3) {
                return 'Initials must be exactly 3 characters';
            }
        }
        
        // Team-specific validation
        if (currentModal === 'create-team') {
            const teamName = formData.get('teamName')?.trim();
            const divisions = formData.getAll('divisions');
            const maxPlayers = parseInt(formData.get('maxPlayers'));
            
            if (!teamName || teamName.length < 3 || teamName.length > 25) {
                return 'Team name must be between 3 and 25 characters';
            }
            
            if (divisions.length === 0) {
                return 'Please select at least one division';
            }

            if (isNaN(maxPlayers) || maxPlayers < 1 || maxPlayers > 20) {
                return 'Max players must be between 1 and 20';
            }
        } else if (currentModal === 'join-team') {
            const joinCode = formData.get('joinCode')?.trim();
            
            if (!joinCode || joinCode.length !== 6) {
                return 'Join code must be exactly 6 characters';
            }
        }
        
        return null;
    }

    /**
     * Handle team creation
     * @param {FormData} formData - Form data
     */
    async function handleCreateTeam(formData) {
        const teamData = {
            teamName: formData.get('teamName').trim(),
            divisions: formData.getAll('divisions').map(d => `Division ${d}`),
            maxPlayers: parseInt(formData.get('maxPlayers'))
        };

        // Check if user needs to create a profile
        const user = StateService.getState('user');
        if (!user.profile) {
            const displayName = formData.get('displayName')?.trim();
            const initials = formData.get('initials')?.trim();
            
            if (!displayName || !initials) {
                throw new Error('Display name and initials are required');
            }
            
            teamData.displayName = displayName;
            teamData.initials = initials;
            
            console.log('Modals: Creating team with profile...', teamData);
        }
        
        console.log('Modals: Creating team...', teamData);
        const result = await DatabaseService.createTeam(teamData);
        
        // Refresh user profile to get the updated teams list
        await AuthService.refreshProfile();
        
        // Set the newly created team as current team
        if (result.success && result.data && result.data.teamId) {
            StateService.setState('currentTeam', result.data.teamId);
            console.log('Modals: Set new team as current:', result.data.teamId);
        }
    }

    /**
     * Handle team joining
     * @param {FormData} formData - Form data
     */
    async function handleJoinTeam(formData) {
        const joinCode = formData.get('joinCode').trim();
        
        console.log('Modals: Joining team with code:', joinCode);
        const result = await DatabaseService.joinTeam({ joinCode });
        
        // Refresh user profile to get the updated teams list
        await AuthService.refreshProfile();
        
        // Set the newly joined team as current team if result contains teamId
        if (result && result.success && result.data && result.data.teamId) {
            StateService.setState('currentTeam', result.data.teamId);
            console.log('Modals: Set joined team as current:', result.data.teamId);
        }
    }

    /**
     * Show error message
     * @param {Element} errorDiv - Error display element
     * @param {string} message - Error message
     */
    function showError(errorDiv, message) {
        if (errorDiv) {
            errorDiv.textContent = message;
            errorDiv.classList.remove('hidden');
        }
    }

    /**
     * Hide error message
     * @param {Element} errorDiv - Error display element
     */
    function hideError(errorDiv) {
        if (errorDiv) {
            errorDiv.classList.add('hidden');
        }
    }

    /**
     * Set loading state for submit button
     * @param {Element} button - Submit button
     * @param {boolean} loading - Loading state
     */
    function setLoadingState(button, loading) {
        if (!button) return;
        
        if (loading) {
            button.disabled = true;
            button.innerHTML = `
                <div class="flex items-center justify-center">
                    <div class="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                    Processing...
                </div>
            `;
        } else {
            button.disabled = false;
            if (currentModal === 'create-team') {
                button.textContent = 'Create Team';
            } else if (currentModal === 'join-team') {
                button.textContent = 'Join Team';
            } else if (currentModal === 'transfer-leadership') {
                button.textContent = 'Yes, Transfer';
            } else if (currentModal === 'kick-players') {
                button.textContent = 'Yes, Remove';
            } else if (currentModal === 'leave-team-regular') {
                button.textContent = 'Yes, Leave Team';
            } else if (currentModal === 'leave-team-archive') {
                button.textContent = 'Leave and Archive';
            }
        }
    }

    // Public API
    return {
        init,
        showCreateTeamModal,
        showJoinTeamModal,
        showJoinCreateChoiceModal,
        showTransferLeadershipModal,
        showKickPlayersModal,
        showLeaveTeamModal,
        hideModal
    };
})();

export default Modals; 