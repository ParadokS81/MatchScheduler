# Frontend Development Philosophy & Guidelines

## Project Overview

This is a Google Apps Script web application for managing sports team availability and scheduling. The frontend uses vanilla JavaScript with a modular architecture, Tailwind CSS for styling, and integrates with Google Sheets as the backend database.

## Core Architecture Philosophy

### 1. Modular Component System

- **Components** = UI elements that manage specific sections of the interface
- **Services** = Shared business logic and state management
- **App Controller** = Central orchestrator for component communication
- Each module uses the Revealing Module Pattern for clean encapsulation

### 2. Separation of Concerns

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│    App.js       │     │    Services     │     │   Components    │
│  (Coordinator)  │◄──►│ (Shared Logic)  │◄──►│  (UI Elements)  │
│                 │     │                 │     │                 │
│ - Central State │     │ - GridSelection │     │ - UserProfile   │
│ - Data Flow     │     │ - Templates     │     │ - WeekNav       │
│ - Initialization│     │ - Backend Calls │     │ - Filters, etc. │
└─────────────────┘     └─────────────────┘     └─────────────────┘
```

### 3. HTML-First Approach

- Static HTML structure in `02-body-structure.html` provides the foundation
- JavaScript components enhance existing HTML rather than generate it
- Every interactive element must have a unique `id` for JavaScript access
- Styling is done purely with Tailwind CSS utility classes

## Development Guidelines

### File Organization

```
frontend2/
│
├── 01-head-content.html        # Document head, meta tags, CSS links
├── 02-body-structure.html      # Static HTML structure with IDs
├── 03-modals.html              # Modal dialog structures
├── 04-scripts.html             # Script includes and initialization
│
├── components/                 # UI component modules
│   ├── UserProfile.js
│   ├── WeekNavigation.js
│   ├── MatchFilters.js
│   ├── TeamInfo.js
│   ├── AvailabilityGrid.js
│   ├── FavoritesList.js
│   ├── GridTools.js
│   └── BrowseTeams.js
│
├── services/                   # Shared business logic
│   ├── GridSelectionService.js
│   └── TemplateService.js
│
└── main/
    └── App.js                  # Central application controller
```

### Component Development Pattern

Every component should follow this structure:

```javascript
const ComponentName = (function() {
    // Private variables
    let _panel, _elements;
    
    // Private methods
    function _handleEvent() {
        // Event handling logic
    }
    
    // Public API
    function init(panelId) {
        _panel = document.getElementById(panelId);
        if (!_panel) return;
        
        // Find sub-elements
        _elements = _panel.querySelector('#specific-element');
        
        // Attach event listeners
        _elements.addEventListener('click', _handleEvent);
        
        console.log("ComponentName Component Initialized.");
    }
    
    function update(data) {
        // Update UI with new data
    }
    
    return { init, update };
})();
```

### Service Development Pattern

Services manage shared state and business logic:

```javascript
const ServiceName = (function() {
    // Private state
    let _sharedData = {};
    
    function init() {
        console.log("ServiceName Initialized.");
    }
    
    function performAction(data) {
        // Business logic here
        // May interact with google.script.run for backend calls
    }
    
    return { init, performAction };
})();
```

## UI Development Standards

### Styling Approach

- **Tailwind CSS Only** - No custom CSS files
- **Component-Based Styling** - Style elements in the HTML where they're defined
- **Responsive Design** - Use Tailwind's responsive prefixes (sm:, md:, lg:)
- **Design System** - Follow Shadcn/UI patterns for professional appearance

### Shadcn/UI Integration

- **Don't** install Shadcn/UI (this isn't a React project)
- **Do** reference their patterns: Visit [shadcn/ui components](https://ui.shadcn.com/) for inspiration
- Copy HTML structure and Tailwind classes from their examples
- Adapt to vanilla JavaScript by implementing the behavior manually

### Icon Usage (Lucide)

1. Go to [Lucide Icons](https://lucide.dev/) website
2. Find the desired icon
3. Click "Copy SVG"
4. Paste directly into HTML
5. Style with Tailwind: `class="h-5 w-5 text-blue-500"`

### Required Element IDs

Every HTML element that JavaScript needs to interact with must have an ID:

```html
<!-- Grid panels (already defined) -->
<div id="grid-cell-top-left">
    <!-- User profile elements -->
    <span id="user-profile-display-name"></span>
    <button id="edit-profile-btn"></button>
</div>

<!-- Interactive elements need IDs -->
<button id="prev-week-btn">Previous</button>
<select id="division-filter-select"></select>
<div id="availability-grid-week1"></div>
```

## Data Flow Architecture

### Initialization Sequence

1. HTML loads completely
2. DOMContentLoaded event fires
3. App.init() runs
4. Services initialize first (GridSelectionService, TemplateService)
5. UI Components initialize with their panel IDs
6. Backend data fetching begins
7. Components render with initial data

### Communication Patterns

**Component → App → Component**

```javascript
// Component requests action
App.requestWeekChange('next');

// App coordinates the change
function requestWeekChange(direction) {
    // Update internal state
    // Get new data
    // Tell components to update
    WeekNavigation.updateDisplay(newWeekInfo);
    AvailabilityGrid.render('grid-week1', newHTML);
}
```

**Component → Service → Component**

```javascript
// Component uses service
GridSelectionService.add('cell-mon-9am');

// Other components can read service state
const selection = GridSelectionService.getSelection();
```

## Backend Integration

### Google Apps Script Patterns

```javascript
// Calling backend functions
google.script.run
    .withSuccessHandler(handleSuccess)
    .withFailureHandler(handleError)
    .backendFunctionName(parameters);

// Handle responses
function handleSuccess(data) {
    // Update UI with server response
}
```

### Data Caching Strategy

- Cache frequently accessed data in App.js private variables
- Minimize server calls by intelligent caching
- Refresh cache when data changes (user actions, week navigation)

## Error Handling & Debugging

### Console Logging Standards

- Every component logs initialization: `console.log("ComponentName Component Initialized.")`
- Log important state changes and user actions
- Use descriptive log messages for debugging

### Error Prevention

Always check if elements exist before using them:

```javascript
const element = document.getElementById('some-id');
if (!element) {
    console.error('Element #some-id not found!');
    return;
}
```

### Development Workflow

1. Open browser developer tools
2. Check console for initialization messages
3. Verify all components load without errors
4. Test component interactions step by step
5. Use console.log strategically to track data flow

## Performance Considerations

### Efficient DOM Manipulation

- Cache element references in component init
- Minimize DOM queries during runtime
- Batch DOM updates when possible

### Event Handling

- Use event delegation for dynamic content
- Remove event listeners when components are destroyed
- Avoid memory leaks with proper cleanup

## Future Development Guidelines

### Adding New Components

1. Create new file in `components/` directory
2. Follow the component pattern template
3. Add script include to `04-scripts.html`
4. Initialize in App.js with appropriate panel ID
5. Add required HTML structure and IDs to `02-body-structure.html`

### Extending Services

- Keep services focused on single responsibilities
- Maintain clean public APIs
- Handle all error cases internally
- Document any Google Apps Script dependencies

### UI Enhancements

- Always start with Tailwind utility classes
- Reference Shadcn/UI for complex component patterns
- Ensure accessibility with proper ARIA labels
- Test on mobile devices using responsive design

## Testing Strategy

### Manual Testing Checklist

- [ ] All console initialization messages appear
- [ ] No JavaScript errors in console
- [ ] All buttons and interactions work
- [ ] Data loads and displays correctly
- [ ] Week navigation functions properly
- [ ] Grid selection state management works
- [ ] Backend integration functions (when implemented)

### Browser Compatibility

- **Primary target**: Modern Chrome (Google Workspace environment)
- **Secondary**: Firefox, Safari, Edge
- Mobile responsive design for tablet/phone access

This philosophy ensures maintainable, scalable code that integrates well with Google Apps Script while providing a professional user experience.