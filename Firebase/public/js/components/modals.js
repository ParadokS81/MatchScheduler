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
                                        <option value="5">5 players</option>
                                        <option value="6">6 players</option>
                                        <option value="7">7 players</option>
                                        <option value="8">8 players</option>
                                        <option value="9">9 players</option>
                                        <option value="10" selected>10 players</option>
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
                return 'Display name must be 2-20 characters';
            }
            
            if (!initials || initials.length !== 3) {
                return 'Initials must be exactly 3 characters';
            }
        }
        
        // Team-specific validation
        if (currentModal === 'create-team') {
            const teamName = formData.get('teamName')?.trim();
            const divisions = formData.getAll('divisions');
            
            if (!teamName || teamName.length < 3 || teamName.length > 25) {
                return 'Team name must be 3-25 characters';
            }
            
            if (divisions.length === 0) {
                return 'Please select at least one division';
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
            divisions: formData.getAll('divisions').map(d => d.toString()),
            maxPlayers: parseInt(formData.get('maxPlayers'))
        };
        
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
        await DatabaseService.joinTeam(joinCode);
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
            }
        }
    }

    // Public API
    return {
        init,
        showCreateTeamModal,
        showJoinTeamModal,
        hideModal
    };
})();

export default Modals; 