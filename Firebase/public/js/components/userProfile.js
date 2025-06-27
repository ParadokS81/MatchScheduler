// userProfile.js - User profile component
// TODO: Implement according to Technical PRD Section 3.5

import AuthService from '../services/auth.js';
import StateService, { subscribe } from '../services/state.js';

const UserProfile = (function() {
    let panel;

    function init(panelId) {
        panel = document.getElementById(panelId);
        if (!panel) return;

        // Initialize state service if not already initialized
        StateService.init();

        // Subscribe to user state changes
        subscribe('user', renderUserState);

        // Add event delegation for button clicks
        panel.addEventListener('click', handlePanelClick);
    }

    function handlePanelClick(event) {
        const target = event.target;
        if (target.matches('.sign-in-button')) {
            signIn();
        } else if (target.matches('.edit-profile-button')) {
            editProfile();
        }
    }

    function renderUserState(user) {
        if (!panel) return;

        // Guest State
if (!user) {
    panel.innerHTML = `
        <div class="panel-content flex items-center justify-center h-full">
            <button class="sign-in-button px-4 py-2 bg-primary hover:bg-primary/90 text-primary-foreground rounded-lg text-sm font-medium transition-colors">
                Sign in with Google
            </button>
        </div>
    `;
    return;
}

// Authenticated but no profile/team
if (!user.profile) {
    panel.innerHTML = `
        <div class="panel-content flex items-center justify-center h-full">
            <div class="text-sm text-muted-foreground">Welcome!</div>
        </div>
    `;
    return;
}

// User with profile
panel.innerHTML = `
    <div class="panel-content h-full flex flex-col justify-center">
        <div class="flex items-center justify-between">
            <div class="text-sm text-foreground">
                Welcome ${user.profile.displayName}
            </div>
            <button class="edit-profile-button text-primary hover:text-primary/80 transition-colors">
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                    <path d="m18.5 2.5 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                </svg>
            </button>
        </div>
    </div>
`;
    }

    function signIn() {
        AuthService.signInWithGoogle();
    }

    function editProfile() {
        // Minimal stub - actual implementation would be handled elsewhere
        console.log('Edit profile clicked');
    }

    // Public API
    return {
        init
    };
})();

export default UserProfile; 