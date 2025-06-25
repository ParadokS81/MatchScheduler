/**
 * Week Navigation Component
 * Manages bi-weekly view navigation and date display
 */

import stateService from '../services/state.js';
import App from './app.js';

const WeekNavigation = (() => {
  // Private variables
  let initialized = false;
  let unsubscribeWeekOffset = null;
  let panel = null;

  /**
   * Calculate week information for both weeks
   * @param {number} offset - Week offset (0 or 1)
   * @returns {Array} Array of week information objects
   */
  const calculateWeeksInfo = (offset) => {
    const weeks = [];
    
    for (let i = 0; i < 2; i++) {
      const now = new Date();
      const targetDate = new Date(now);
      targetDate.setDate(now.getDate() + ((offset + i) * 7));

      const weekStart = new Date(targetDate);
      weekStart.setDate(targetDate.getDate() - targetDate.getDay());

      const weekEnd = new Date(weekStart);
      weekEnd.setDate(weekStart.getDate() + 6);

      const weekNumber = Math.floor((weekStart.getTime() - new Date(weekStart.getFullYear(), 0, 1).getTime()) / (7 * 24 * 60 * 60 * 1000)) + 1;

      const formatDate = (date) => date.toLocaleDateString('en-US', { 
        month: 'short', 
        day: 'numeric' 
      });

      weeks.push({
        weekNumber,
        dateRange: `${formatDate(weekStart)} - ${formatDate(weekEnd)}`
      });
    }

    return weeks;
  };

  /**
   * Attach event listeners to navigation buttons
   */
  const attachEventListeners = () => {
    const prevBtn = document.getElementById('prev-week-btn');
    const nextBtn = document.getElementById('next-week-btn');

    if (prevBtn) {
      prevBtn.addEventListener('click', () => App.requestWeekChange('prev'));
    }
    if (nextBtn) {
      nextBtn.addEventListener('click', () => App.requestWeekChange('next'));
    }
  };

  /**
   * Render the component
   */
  const render = () => {
    const offset = stateService.getState('weekOffset') || 0;
    const weekInfo = calculateWeeksInfo(offset);
    
    panel.innerHTML = `
      <div class="flex items-center justify-between">
        <button id="prev-week-btn" 
                class="px-3 py-1.5 bg-slate-700 hover:bg-slate-600 rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-slate-300 text-sm"
                ${offset === 0 ? 'disabled' : ''}>
          ← Prev
        </button>
        <div class="text-center flex-1 mx-4">
          <div class="text-sm font-medium text-slate-200">
            <span class="text-slate-300">Week ${weekInfo[0].weekNumber}:</span> 
            <span class="text-white">${weekInfo[0].dateRange}</span>
            <span class="mx-4 text-slate-600">|</span>
            <span class="text-slate-300">Week ${weekInfo[1].weekNumber}:</span> 
            <span class="text-white">${weekInfo[1].dateRange}</span>
          </div>
        </div>
        <button id="next-week-btn" 
                class="px-3 py-1.5 bg-slate-700 hover:bg-slate-600 rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-slate-300 text-sm"
                ${offset === 1 ? 'disabled' : ''}>
          Next →
        </button>
      </div>
    `;
    
    attachEventListeners();
  };

  /**
   * Initialize the component
   * @param {HTMLElement} container - Container element
   * @returns {Object} Public API
   */
  const init = (container) => {
    if (initialized) {
      console.warn('WeekNavigation: Already initialized');
      return;
    }

    if (!container) {
      throw new Error('WeekNavigation: Container element is required');
    }

    panel = container;

    // Subscribe to week offset changes
    unsubscribeWeekOffset = stateService.subscribe('weekOffset', () => {
      render();
    });

    // Initial render
    render();

    initialized = true;
    console.log('WeekNavigation: Initialized');
    return publicApi;
  };

  /**
   * Clean up the component
   */
  const cleanup = () => {
    if (unsubscribeWeekOffset) {
      unsubscribeWeekOffset();
      unsubscribeWeekOffset = null;
    }
    panel = null;
    initialized = false;
  };

  // Public API
  const publicApi = {
    init,
    cleanup
  };

  return publicApi;
})();

export default WeekNavigation; 