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
                <div class="panel-content">
                    <button class="sign-in-button px-4 py-2 bg-blue-500 hover:bg-blue-600 rounded-lg text-sm font-medium text-white">
                        Sign in with Google
                    </button>
                </div>
            `;
            return;
        }

        // Authenticated but no profile/team
        if (!user.profile) {
            panel.innerHTML = `
                <div class="panel-content">
                    <div class="text-sm text-slate-300">Welcome!</div>
                </div>
            `;
            return;
        }

        // User with profile
        const initials = user.profile.displayName
            .split(' ')
            .map(n => n[0])
            .join('')
            .toUpperCase();

        panel.innerHTML = `
            <div class="panel-content">
                <div class="flex items-center justify-between">
                    <div class="text-sm text-slate-300">
                        ${user.profile.displayName} <span class="text-slate-500">(${initials})</span>
                    </div>
                    <button class="edit-profile-button text-xs text-blue-400 hover:text-blue-300">
                        Edit Profile
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