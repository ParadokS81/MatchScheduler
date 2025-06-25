/**
 * Main Application Entry Point
 * Initializes the MatchScheduler application
 */

import App from './components/app.js';
import WeekNavigation from './components/weekNavigation.js';
import UserProfile from './components/userProfile.js';
import TeamInfo from './components/teamInfo.js';
import Modals from './components/modals.js';
import { AvailabilityGrid } from './components/availabilityGrid.js';

/**
 * Initialize UI components
 */
const initializeComponents = () => {
  // Initialize Week Navigation
  const weekNavigationContainer = document.getElementById('panel-top-center');
  if (weekNavigationContainer) {
    WeekNavigation.init(weekNavigationContainer);
  } else {
    console.error('Week Navigation container not found');
  }

  // Initialize User Profile
  UserProfile.init('panel-top-left');

  // Initialize Team Info
  TeamInfo.init('panel-middle-left');

  // Initialize Modals
  Modals.init();

  // Initialize Availability Grids
  AvailabilityGrid.init('availability-grid-week1');
  AvailabilityGrid.init('availability-grid-week2');
};

/**
 * Show error UI to user
 * @param {Error} error - Error that occurred
 * @param {boolean} isRecoverable - Whether the error is potentially recoverable
 */
const showErrorUI = (error, isRecoverable = true) => {
  document.body.innerHTML = `
    <div class="flex items-center justify-center h-screen bg-gray-900">
      <div class="text-center p-8 bg-gray-800 rounded-lg shadow-xl max-w-md">
        <svg class="w-16 h-16 text-red-500 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" 
            d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z">
          </path>
        </svg>
        <h1 class="text-2xl text-red-500 mb-4">Failed to Start Application</h1>
        <p class="text-gray-300 mb-6">${error.message}</p>
        ${isRecoverable ? `
          <button onclick="location.reload()" 
            class="mt-4 px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors duration-200">
            Try Again
          </button>
        ` : `
          <p class="text-yellow-400 text-sm">
            Please check your internet connection and try again later.
          </p>
        `}
      </div>
    </div>
  `;
};

/**
 * Show loading overlay
 */
const showLoadingOverlay = () => {
  const loadingOverlay = document.getElementById('loading-overlay');
  if (loadingOverlay) {
    loadingOverlay.classList.remove('hidden');
  }
};

/**
 * Hide loading overlay
 */
const hideLoadingOverlay = () => {
  const loadingOverlay = document.getElementById('loading-overlay');
  if (loadingOverlay) {
    loadingOverlay.classList.add('hidden');
  }
};

/**
 * Update auth status in navigation
 * @param {string} status - Status message to display
 */
const updateAuthStatus = (status) => {
  const authStatus = document.getElementById('auth-status');
  if (authStatus) {
    authStatus.textContent = status;
  }
};

// Wait for DOM to be fully loaded
document.addEventListener('DOMContentLoaded', async () => {
  // Show loading overlay (preserving original content)
  showLoadingOverlay();
  updateAuthStatus('Initializing...');

  try {
    console.log('Main: Starting application initialization...');
    
    // Set initialization timeout
    const initTimeout = setTimeout(() => {
      throw new Error('Application initialization timed out. Please check your connection.');
    }, 10000); // 10 second timeout

    // Initialize app
    await App.init();
    
    // Initialize UI components
    initializeComponents();
    
    // Clear timeout if initialization successful
    clearTimeout(initTimeout);
    
    // Hide loading overlay
    hideLoadingOverlay();
    updateAuthStatus('Ready');
    
    console.log('Main: Application initialized successfully');
  } catch (error) {
    console.error('Main: Failed to initialize application:', error);
    
    // Hide loading overlay before showing error
    hideLoadingOverlay();
    
    // Determine if error is potentially recoverable
    const isRecoverable = !(
      error.message.includes('Firebase not ready') ||
      error.message.includes('configuration missing') ||
      error.message.includes('invalid config')
    );
    
    showErrorUI(error, isRecoverable);
  }
});

// Global error handlers
window.addEventListener('unhandledrejection', event => {
  console.error('Unhandled promise rejection:', event.reason);
  // Only show error UI if it's not already showing
  if (!document.body.innerHTML.includes('Failed to Start Application')) {
    hideLoadingOverlay();
    showErrorUI(new Error('An unexpected error occurred. Please try again.'));
  }
});

window.addEventListener('error', event => {
  console.error('Global error:', event.error);
  // Only show error UI if it's not already showing
  if (!document.body.innerHTML.includes('Failed to Start Application')) {
    hideLoadingOverlay();
    showErrorUI(new Error('An unexpected error occurred. Please try again.'));
  }
});

// Optional: Add connection state handling
window.addEventListener('online', () => {
  console.log('Main: Connection restored');
  // Only reload if we're showing an error
  if (document.body.innerHTML.includes('Failed to Start Application')) {
    location.reload();
  }
});

window.addEventListener('offline', () => {
  console.log('Main: Connection lost');
  hideLoadingOverlay();
  showErrorUI(
    new Error('Lost internet connection. Please check your network.'),
    true
  );
}); 