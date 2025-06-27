// availabilityGrid.js - Availability grid component with theme-compliant styling
import StateService from '../services/state.js';
import DatabaseService from '../services/database.js';

const AvailabilityGrid = (() => {
    // Configuration
    const GRID_CONFIG = {
        slots: ['1800', '1830', '1900', '1930', '2000', '2030', '2100', '2130', '2200', '2230', '2300'],
        days: ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'],
        dayNames: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
        maxVisibleInitials: 3
    };

    // Track active grid instances
    const gridInstances = new Map();
    
    // Tooltip element (shared across all grids)
    let tooltipElement = null;

    /**
     * Initialize tooltip element if not exists
     */
    function initTooltip() {
        if (!tooltipElement) {
            tooltipElement = document.createElement('div');
            tooltipElement.className = 'absolute z-50 bg-popover text-popover-foreground border border-border rounded-md shadow-lg p-2 text-xs hidden pointer-events-none';
            document.body.appendChild(tooltipElement);
        }
    }

    /**
     * Show tooltip with player list
     */
    function showTooltip(event, players) {
        if (!tooltipElement || players.length <= GRID_CONFIG.maxVisibleInitials) return;
        
        const allInitials = players.join(', ');
        tooltipElement.textContent = allInitials;
        tooltipElement.classList.remove('hidden');
        
        // Position tooltip above the cell
        const rect = event.target.getBoundingClientRect();
        tooltipElement.style.left = `${rect.left + rect.width / 2}px`;
        tooltipElement.style.top = `${rect.top - 10}px`;
        tooltipElement.style.transform = 'translate(-50%, -100%)';
    }

    /**
     * Hide tooltip
     */
    function hideTooltip() {
        if (tooltipElement) {
            tooltipElement.classList.add('hidden');
        }
    }

    /**
     * Format time for display
     */
    function formatTime(timeStr) {
        return `${timeStr.slice(0, 2)}:${timeStr.slice(2)}`;
    }

    /**
     * Get day suffix
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
     * Calculate week dates
     */
    function calculateWeekDates(weekOffset) {
        const today = new Date();
        const currentDay = today.getDay();
        const diff = currentDay === 0 ? -6 : 1 - currentDay; // Adjust to Monday
        
        const monday = new Date(today);
        monday.setDate(today.getDate() + diff + (weekOffset * 7));
        
        const dates = [];
        for (let i = 0; i < 7; i++) {
            const date = new Date(monday);
            date.setDate(monday.getDate() + i);
            dates.push(date);
        }
        
        return dates;
    }

    /**
     * Check if date is today
     */
    function isToday(date) {
        const today = new Date();
        return date.toDateString() === today.toDateString();
    }

    /**
     * Create grid structure
     */
    function createGridStructure(gridId) {
        const container = document.getElementById(gridId);
        if (!container) return;

        // Clear container and apply base styles
        container.innerHTML = '';
        container.className = 'w-full h-full overflow-auto';

        // Create grid wrapper
        const gridWrapper = document.createElement('div');
        gridWrapper.className = 'w-full h-full p-2';

        // Create CSS Grid container
        const grid = document.createElement('div');
        grid.className = 'grid grid-cols-8 gap-px bg-background w-full h-full';
        // Let CSS Grid handle the columns naturally with fr units
        grid.style.gridTemplateColumns = '0.8fr repeat(7, 1fr)';

        // Calculate which week this grid represents
        const weekOffset = StateService.getState('weekOffset') || 0;
        const gridWeekOffset = gridId.includes('week2') ? weekOffset + 1 : weekOffset;
        const weekDates = calculateWeekDates(gridWeekOffset);

        // Create header row
        // Time header (top-left corner)
        const timeHeader = document.createElement('div');
        timeHeader.className = 'sticky left-0 z-20 bg-card px-2 py-1 text-xs font-medium text-muted-foreground text-center flex items-center justify-center';
        timeHeader.textContent = 'Time';
        grid.appendChild(timeHeader);

        // Day headers
        GRID_CONFIG.dayNames.forEach((dayName, index) => {
            const date = weekDates[index];
            const dayNum = date.getDate();
            const isCurrentDay = isToday(date);
            const isWeekend = index >= 5;
            
            const dayHeader = document.createElement('div');
            dayHeader.className = `
                sticky top-0 z-10 bg-muted px-2 py-1 text-xs font-medium flex items-center justify-center
                ${isWeekend ? 'text-accent-foreground' : 'text-muted-foreground'}
                ${isCurrentDay ? 'bg-accent' : ''}
            `;
            dayHeader.textContent = `${dayName} ${dayNum}${getDaySuffix(dayNum)}`;
            grid.appendChild(dayHeader);
        });

        // Create time slots
        GRID_CONFIG.slots.forEach(slot => {
            // Time label
            const timeLabel = document.createElement('div');
            timeLabel.className = 'sticky left-0 z-10 bg-muted px-2 py-1 text-xs font-medium text-muted-foreground text-center flex items-center justify-center';
            timeLabel.textContent = formatTime(slot);
            grid.appendChild(timeLabel);

            // Day cells
            GRID_CONFIG.days.forEach((day, dayIndex) => {
                const isCurrentDay = isToday(weekDates[dayIndex]);
                const isWeekend = dayIndex >= 5;
                
                const cell = document.createElement('div');
                cell.className = `
                    px-2 py-1 flex items-center justify-center
                    cursor-pointer transition-colors hover:bg-accent/20
                    ${isWeekend ? 'bg-muted' : 'bg-card'}  // Remove the /50
                    ${isCurrentDay ? 'bg-accent/5' : ''}
                `;
                cell.dataset.slot = `${day}_${slot}`;
                cell.dataset.day = day;
                cell.dataset.time = slot;
                
                // Create content container
                const content = document.createElement('div');
                content.className = 'text-xs text-center';
                cell.appendChild(content);
                
                grid.appendChild(cell);
            });
        });

        gridWrapper.appendChild(grid);
        container.appendChild(gridWrapper);
    }

    /**
     * Update cell content
     */
    function updateCell(cell, players) {
        const content = cell.querySelector('div');
        if (!content) return;

        if (!players || players.length === 0) {
            content.innerHTML = '';
            cell.removeEventListener('mouseenter', cell._tooltipHandler);
            cell.removeEventListener('mouseleave', hideTooltip);
            return;
        }

        // Display logic
        const visiblePlayers = players.slice(0, GRID_CONFIG.maxVisibleInitials);
        const remainingCount = players.length - GRID_CONFIG.maxVisibleInitials;
        
        let html = `<div class="text-foreground font-medium">${visiblePlayers.join(', ')}</div>`;
        
        if (remainingCount > 0) {
            html += `<div class="text-muted-foreground text-[0.65rem]">+${remainingCount}</div>`;
            
            // Add tooltip handlers
            cell._tooltipHandler = (e) => showTooltip(e, players);
            cell.addEventListener('mouseenter', cell._tooltipHandler);
            cell.addEventListener('mouseleave', hideTooltip);
        } else {
            // Remove tooltip handlers if not needed
            cell.removeEventListener('mouseenter', cell._tooltipHandler);
            cell.removeEventListener('mouseleave', hideTooltip);
        }
        
        content.innerHTML = html;
    }

    /**
     * Update grid with availability data
     */
    function updateGridData(gridId, availabilityData) {
        const container = document.getElementById(gridId);
        if (!container) return;

        // Clear all cells first
        const cells = container.querySelectorAll('[data-slot]');
        cells.forEach(cell => updateCell(cell, []));

        if (!availabilityData || !availabilityData.availabilityGrid) return;

        // Update cells with data
        Object.entries(availabilityData.availabilityGrid).forEach(([slotId, players]) => {
            const cell = container.querySelector(`[data-slot="${slotId}"]`);
            if (cell && players && players.length > 0) {
                updateCell(cell, players);
            }
        });
    }

    /**
     * Handle team change
     */
    function handleTeamChange(gridId, teamId) {
        const instance = gridInstances.get(gridId);
        if (!instance) return;

        // Unsubscribe from previous data
        if (instance.unsubscribeAvailability) {
            instance.unsubscribeAvailability();
            instance.unsubscribeAvailability = null;
        }

        if (!teamId) {
            updateGridData(gridId, null);
            return;
        }

        // Calculate week ID
        const weekOffset = StateService.getState('weekOffset') || 0;
        const gridWeekOffset = gridId.includes('week2') ? weekOffset + 1 : weekOffset;
        
        // Get current week number
        const now = new Date();
        const startOfYear = new Date(now.getFullYear(), 0, 1);
        const days = Math.floor((now - startOfYear) / (24 * 60 * 60 * 1000));
        const currentWeek = Math.ceil((days + startOfYear.getDay() + 1) / 7);
        const targetWeek = currentWeek + gridWeekOffset;
        const weekId = `${now.getFullYear()}-W${targetWeek.toString().padStart(2, '0')}`;

        // Subscribe to availability data
        instance.unsubscribeAvailability = DatabaseService.subscribeToAvailability(
            teamId,
            weekId,
            (data) => updateGridData(gridId, data)
        );
    }

    /**
     * Handle week offset change
     */
    function handleWeekChange(gridId) {
        // Recreate grid structure with new dates
        createGridStructure(gridId);
        
        // Resubscribe to data
        const currentTeam = StateService.getState('currentTeam');
        if (currentTeam) {
            handleTeamChange(gridId, currentTeam);
        }
    }

    /**
     * Initialize grid
     */
    function init(gridId) {
        console.log(`Initializing availability grid: ${gridId}`);
        
        // Initialize tooltip if needed
        initTooltip();
        
        // Create grid structure
        createGridStructure(gridId);
        
        // Subscribe to state changes
        const unsubscribeTeam = StateService.subscribe('currentTeam', (teamId) => {
            handleTeamChange(gridId, teamId);
        });
        
        const unsubscribeWeek = StateService.subscribe('weekOffset', () => {
            handleWeekChange(gridId);
        });
        
        // Store instance
        gridInstances.set(gridId, {
            unsubscribeTeam,
            unsubscribeWeek,
            unsubscribeAvailability: null
        });
        
        // Load initial data
        const currentTeam = StateService.getState('currentTeam');
        if (currentTeam) {
            handleTeamChange(gridId, currentTeam);
        }
    }

    /**
     * Destroy grid instance
     */
    function destroy(gridId) {
        const instance = gridInstances.get(gridId);
        if (!instance) return;
        
        // Cleanup subscriptions
        instance.unsubscribeTeam();
        instance.unsubscribeWeek();
        if (instance.unsubscribeAvailability) {
            instance.unsubscribeAvailability();
        }
        
        gridInstances.delete(gridId);
        
        // Remove tooltip if no more grids
        if (gridInstances.size === 0 && tooltipElement) {
            tooltipElement.remove();
            tooltipElement = null;
        }
    }

    // Public API
    return {
        init,
        destroy,
        getConfig: () => ({ ...GRID_CONFIG })
    };
})();

export { AvailabilityGrid };