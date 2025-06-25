// availabilityGrid.js - Availability grid component
// TODO: Implement according to Technical PRD Section 5.4

import StateService from '../services/state.js';
import DatabaseService from '../services/database.js';

const AvailabilityGrid = (() => {
    // Configuration for the grid structure
    const GRID_CONFIG = {
        slots: ['1800', '1830', '1900', '1930', '2000', '2030', '2100', '2130', '2200', '2230', '2300'],
        days: ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'],
        dayHeaders: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
    };

    // Track active grid instances
    const gridInstances = new Map();

    /**
     * Format time slot from 24-hour string to display format
     * @param {string} timeSlot - Time in format '1800'
     * @returns {string} - Formatted time '18:00'
     */
    function formatTimeSlot(timeSlot) {
        if (timeSlot.length !== 4) return timeSlot;
        const hours = timeSlot.substring(0, 2);
        const minutes = timeSlot.substring(2, 4);
        return `${hours}:${minutes}`;
    }

    /**
     * Generate time slots array from config
     * @param {Object} config - Grid configuration
     * @returns {Array} - Array of time slot strings
     */
    function generateTimeSlots(config) {
        return config.slots || [];
    }

    /**
     * Get cell element by slot identifier
     * @param {string} gridId - Grid container ID
     * @param {string} slotId - Slot identifier (e.g., 'mon_1800')
     * @returns {HTMLElement|null} - Cell element or null
     */
    function getCellBySlot(gridId, slotId) {
        const grid = document.getElementById(gridId);
        if (!grid) return null;
        return grid.querySelector(`[data-slot="${slotId}"]`);
    }

    /**
     * Calculate week ID based on current state
     * @param {string} gridId - Grid container ID
     * @returns {string} - Week identifier
     */
    function calculateWeekId(gridId) {
        const weekOffset = StateService.getState('weekOffset') || 0;
        
        // Determine which week this grid represents
        if (gridId.includes('week1')) {
            return `week_${weekOffset}`;
        } else if (gridId.includes('week2')) {
            return `week_${weekOffset + 1}`;
        }
        
        // Default to current week
        return `week_${weekOffset}`;
    }

    /**
     * Calculate the dates for the week headers
     * @param {string} gridId - Grid container ID
     * @returns {Array} - Array of date objects for the week
     */
    function calculateWeekDates(gridId) {
        const weekOffset = StateService.getState('weekOffset') || 0;
        const baseWeekOffset = gridId.includes('week2') ? weekOffset + 1 : weekOffset;
        
        // Start from a known Monday (using a reference date)
        const referenceDate = new Date('2024-06-17'); // Known Monday
        const startOfWeek = new Date(referenceDate);
        startOfWeek.setDate(referenceDate.getDate() + (baseWeekOffset * 7));
        
        const weekDates = [];
        for (let i = 0; i < 7; i++) {
            const date = new Date(startOfWeek);
            date.setDate(startOfWeek.getDate() + i);
            weekDates.push(date);
        }
        
        return weekDates;
    }

    /**
     * Format date for header display
     * @param {Date} date - Date object
     * @returns {string} - Formatted date like "16th"
     */
    function formatDateForHeader(date) {
        const day = date.getDate();
        const suffix = getDaySuffix(day);
        return `${day}${suffix}`;
    }

    /**
     * Get ordinal suffix for day number
     * @param {number} day - Day number
     * @returns {string} - Suffix like "st", "nd", "rd", "th"
     */
    function getDaySuffix(day) {
        if (day >= 11 && day <= 13) return 'th';
        switch (day % 10) {
            case 1: return 'st';
            case 2: return 'nd';
            case 3: return 'rd';
            default: return 'th';
        }
    }

    /**
     * Render the grid structure (called once on initialization)
     * @param {string} gridId - Grid container ID
     */
    function renderGridStructure(gridId) {
        const container = document.getElementById(gridId);
        if (!container) {
            console.error(`Grid container not found: ${gridId}`);
            return;
        }

        // Remove border styling from container and adjust background
        container.style.backgroundColor = 'transparent';
        container.style.overflow = 'hidden';

        // Calculate week dates
        const weekDates = calculateWeekDates(gridId);

        // Create table structure
        const table = document.createElement('table');
        table.className = 'w-full';
        table.style.backgroundColor = 'transparent';
        table.style.borderSpacing = '0.0625rem';
        table.style.borderCollapse = 'separate';
        
        // Create header row
        const headerRow = document.createElement('tr');
        
        // Empty cell for time column
        const timeHeaderCell = document.createElement('th');
        timeHeaderCell.style.cssText = `
            position: sticky;
            left: 0;
            background-color: #1e293b;
            border: none;
            border-radius: 0.25rem;
            padding: 0.25rem;
            font-size: 0.75rem;
            font-weight: 500;
            color: #cbd5e1;
            min-width: 3.75rem;
            text-align: center;
        `;
        timeHeaderCell.textContent = 'Time';
        headerRow.appendChild(timeHeaderCell);
        
        // Day header cells with dates
        GRID_CONFIG.dayHeaders.forEach((dayHeader, index) => {
            const dayCell = document.createElement('th');
            const dayKey = GRID_CONFIG.days[index];
            const isWeekend = dayKey === 'sat' || dayKey === 'sun';
            const dateStr = formatDateForHeader(weekDates[index]);
            
            dayCell.style.cssText = `
                background-color: #1e293b;
                border: none;
                border-radius: 0.25rem;
                padding: 0.25rem;
                font-size: 0.75rem;
                font-weight: 500;
                text-align: center;
                min-width: 5.625rem;
                color: ${isWeekend ? '#fbbf24' : '#cbd5e1'};
            `;
            dayCell.textContent = `${dayHeader} ${dateStr}`;
            headerRow.appendChild(dayCell);
        });
        
        table.appendChild(headerRow);

        // Create time slot rows
        const timeSlots = generateTimeSlots(GRID_CONFIG);
        timeSlots.forEach(slot => {
            const row = document.createElement('tr');
            
            // Time label cell
            const timeCell = document.createElement('td');
            timeCell.style.cssText = `
                position: sticky;
                left: 0;
                background-color: #1e293b;
                border: none;
                border-radius: 0.25rem;
                padding: 0.25rem;
                font-size: 0.75rem;
                font-weight: 500;
                color: #cbd5e1;
                text-align: center;
            `;
            timeCell.textContent = formatTimeSlot(slot);
            row.appendChild(timeCell);
            
            // Day cells
            GRID_CONFIG.days.forEach(day => {
                const cell = document.createElement('td');
                const slotId = `${day}_${slot}`;
                const isWeekend = day === 'sat' || day === 'sun';
                
                cell.style.cssText = `
                    border: none;
                    border-radius: 0.25rem;
                    padding: 0.25rem;
                    font-size: 0.75rem;
                    line-height: 1rem;
                    height: 2.2rem;
                    min-width: 5.625rem;
                    background-color: ${isWeekend ? '#1e293b' : '#334155'};
                    cursor: pointer;
                    transition: background-color 0.15s ease-in-out;
                `;
                
                // Add hover effect
                cell.addEventListener('mouseenter', () => {
                    cell.style.backgroundColor = isWeekend ? '#334155' : '#475569';
                });
                cell.addEventListener('mouseleave', () => {
                    cell.style.backgroundColor = isWeekend ? '#1e293b' : '#334155';
                });
                
                cell.setAttribute('data-slot', slotId);
                
                // Initialize with empty content
                cell.innerHTML = '';
                
                row.appendChild(cell);
            });
            
            table.appendChild(row);
        });

        // Clear container and add table
        container.innerHTML = '';
        container.appendChild(table);
        
        console.log(`Grid structure rendered for: ${gridId}`);
    }

    /**
     * Handle week offset changes
     * @param {string} gridId - Grid container ID
     */
    function handleWeekChange(gridId) {
        // When week changes, we need to resubscribe to the new week's data AND re-render headers
        renderGridStructure(gridId);
        const currentTeam = StateService.getState('currentTeam');
        if (currentTeam) {
            handleTeamChange(gridId, currentTeam);
        } else {
            clearAllCells(gridId);
        }
    }

    /**
     * Update cell contents based on availability data
     * @param {string} gridId - Grid container ID
     * @param {Object} availabilityData - Single week's availability data document
     */
    function updateCellContents(gridId, availabilityData) {
        if (!availabilityData) {
            // Clear all cells if no data for this week
            clearAllCells(gridId);
            return;
        }

        // Update each cell based on data
        GRID_CONFIG.days.forEach(day => {
            GRID_CONFIG.slots.forEach(slot => {
                const slotId = `${day}_${slot}`;
                const cell = getCellBySlot(gridId, slotId);
                
                if (cell) {
                    const slotData = availabilityData[day] && availabilityData[day][slot];
                    updateSingleCell(cell, slotData);
                }
            });
        });
    }

    /**
     * Update a single cell with availability data
     * @param {HTMLElement} cell - Cell element
     * @param {Array|undefined} slotData - Array of user data for this slot
     */
    function updateSingleCell(cell, slotData) {
        if (!slotData || slotData.length === 0) {
            cell.innerHTML = '';
            return;
        }

        // Extract initials and format them
        const initials = slotData.map(user => user.initials || '??').join(', ');
        const count = slotData.length;
        
        // Create content with proper styling
        const content = `
            <div style="text-align: center;">
                <div style="color: #e2e8f0; font-weight: 500; font-size: 0.70rem; line-height: 0.9rem;">${initials}</div>
                ${count > 3 ? `<div style="font-size: 0.65rem; color: #94a3b8;">+${count - 3}</div>` : ''}
            </div>
        `;
        
        cell.innerHTML = content;
    }

    /**
     * Clear all cells in a grid
     * @param {string} gridId - Grid container ID
     */
    function clearAllCells(gridId) {
        const grid = document.getElementById(gridId);
        if (!grid) return;

        const cells = grid.querySelectorAll('[data-slot]');
        cells.forEach(cell => {
            cell.innerHTML = '';
        });
    }

    /**
     * Handle team changes - subscribe to new team's availability data
     * @param {string} gridId - Grid container ID
     * @param {string} teamId - New team ID
     */
    function handleTeamChange(gridId, teamId) {
        const instance = gridInstances.get(gridId);
        if (!instance) return;

        // Unsubscribe from previous team's availability data
        if (instance.availabilityUnsubscribe) {
            instance.availabilityUnsubscribe();
            instance.availabilityUnsubscribe = null;
        }

        if (!teamId) {
            // No team selected, clear the grid
            clearAllCells(gridId);
            return;
        }

        // Subscribe to new team's availability data
        const weekId = calculateWeekId(gridId);
        try {
            instance.availabilityUnsubscribe = DatabaseService.subscribeToAvailability(
                teamId, 
                weekId, 
                (availabilityData, error) => {
                    if (error) {
                        console.error(`Availability subscription error for ${gridId}:`, error);
                        clearAllCells(gridId);
                        return;
                    }
                    updateCellContents(gridId, availabilityData);
                }
            );
        } catch (error) {
            console.error(`Failed to subscribe to availability for ${gridId}:`, error);
            clearAllCells(gridId);
        }
    }

    /**
     * Initialize a grid instance
     * @param {string} gridId - Grid container ID
     */
    function init(gridId) {
        console.log(`Initializing availability grid: ${gridId}`);
        
        // Check if container exists
        const container = document.getElementById(gridId);
        if (!container) {
            console.error(`Grid container not found: ${gridId}`);
            return;
        }

        // Render the grid structure
        renderGridStructure(gridId);

        // Set up state subscriptions for team and week changes
        const unsubscribeTeam = StateService.subscribe('currentTeam', (teamId) => {
            handleTeamChange(gridId, teamId);
        });

        const unsubscribeWeek = StateService.subscribe('weekOffset', () => {
            handleWeekChange(gridId);
        });

        // Store instance data
        gridInstances.set(gridId, {
            unsubscribeTeam,
            unsubscribeWeek,
            weekId: calculateWeekId(gridId),
            availabilityUnsubscribe: null
        });

        // Initial team load
        const currentTeam = StateService.getState('currentTeam');
        if (currentTeam) {
            handleTeamChange(gridId, currentTeam);
        }

        console.log(`Availability grid initialized: ${gridId}`);
    }

    /**
     * Destroy a grid instance
     * @param {string} gridId - Grid container ID
     */
    function destroy(gridId) {
        const instance = gridInstances.get(gridId);
        if (instance) {
            // Unsubscribe from state changes
            instance.unsubscribeTeam();
            instance.unsubscribeWeek();
            
            // Unsubscribe from availability data
            if (instance.availabilityUnsubscribe) {
                instance.availabilityUnsubscribe();
            }
            
            // Remove from instances map
            gridInstances.delete(gridId);
            
            console.log(`Availability grid destroyed: ${gridId}`);
        }
    }

    /**
     * Get grid configuration (for external use)
     * @returns {Object} - Grid configuration object
     */
    function getConfig() {
        return { ...GRID_CONFIG };
    }

    /**
     * Get current instances (for debugging)
     * @returns {Array} - Array of active grid IDs
     */
    function getActiveInstances() {
        return Array.from(gridInstances.keys());
    }

    // Public API
    return {
        init,
        destroy,
        getConfig,
        getActiveInstances,
        formatTimeSlot,
        generateTimeSlots,
        getCellBySlot
    };
})();

export { AvailabilityGrid }; 