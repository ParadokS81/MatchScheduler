/*
# Schedule Manager Web App Project

**Version:** 1.5.0 (as of 2025-05-31)  
**Authors:** Your Name, Claude AI, Gemini AI

## Project Overview & Purpose TEST!!!!

### What This Is
A **QuakeWorld 4v4 team scheduling tool** built specifically for the European QuakeWorld gaming community. This web application solves the critical problem of coordinating match times between teams when each team needs 4 players available simultaneously.

### The Problem It Solves
In competitive QuakeWorld 4v4, scheduling matches is notoriously difficult:
- Teams need exactly 4 players available at the same time
- Players often participate in both clan teams (permanent) and draft teams (seasonal)
- Finding overlapping availability windows between two teams is time-consuming
- Manual coordination via Discord/IRC is inefficient and discourages match scheduling

### The Solution
- **Visual availability grids** where players mark their availability with initials
- **Team comparison views** to quickly identify mutual availability windows
- **Dual team membership** support for clan + draft team participation
- **Streamlined UX** optimized for community adoption (success depends on active participation)

## Project Context & Scope

### Target Community
- **Primary Users:** European QuakeWorld 4v4 players (average age ~40)
- **Scale:** ~40 teams, few hundred players across tournaments and leagues
- **Usage Pattern:** Single community-wide deployment for maximum network effect
- **Distribution:** Via Discord community channels

### Platform Choice: Google Apps Script
This project is built on **Google Apps Script (GAS)** - a critical context for understanding architectural decisions:

- **Constraint-Driven Architecture:** Many design patterns reflect GAS limitations, not poor choices
- **No Build System:** Single HTML file with CDN resources is the correct approach
- **Sheets Integration:** Google Sheets as database leverages platform strengths
- **Rapid Deployment:** Zero infrastructure setup enables quick community rollout
- **Non-Technical Administration:** Familiar Google Workspace environment for maintenance

### Development Philosophy
- **AI-Assisted Development:** Built by a "vibe coder" using AI guidance for technical implementation
- **Community-First:** UX and adoption prioritized over enterprise architectural patterns  
- **Pragmatic Scope:** Interim solution until professional infrastructure is available
- **Maintainable Complexity:** Designed for sustainability by non-professional developers

## Architectural Context & Justifications

### Why These Patterns Make Sense Here

**Single HTML File (`index.html`)**
- ✅ **Correct for GAS:** No build system available; single file is the standard pattern
- ✅ **Rapid Iteration:** Changes deploy instantly without compilation steps
- ✅ **CDN Resources:** Tailwind Play CDN and Lucide icons are appropriate given no bundling
- ❌ **Common Misconception:** AIs often critique this as poor separation of concerns, but it's actually the optimal GAS pattern

**Global Function Namespace**
- ✅ **Platform Requirement:** GAS operates in a flat global namespace by design
- ✅ **Direct Calls:** `createTeam()` not `TeamDataManager.createTeam()` is the correct pattern
- ✅ **Performance:** No module loading overhead in server-side execution
- ❌ **Common Misconception:** Looks like poor modularization to traditional web developers

**Google Sheets as Database**
- ✅ **Scale-Appropriate:** Handles hundreds of players efficiently
- ✅ **Admin-Friendly:** Non-technical maintenance via familiar spreadsheet interface
- ✅ **Zero Infrastructure:** No database setup, backups, or scaling concerns
- ✅ **Community Transparency:** Admins can directly inspect/fix data issues
- ❌ **Common Misconception:** Often criticized as "not a real database" by enterprise-focused developers

**Monolithic Architecture**
- ✅ **Deployment Simplicity:** Single script deployment vs. microservices complexity
- ✅ **Community Scale:** 40 teams don't require enterprise scaling patterns
- ✅ **Maintenance Reality:** Easier for non-professional developer to maintain
- ❌ **Common Misconception:** Enterprise patterns aren't always better for community tools

### Success Metrics
- **Primary:** Community adoption rate (players actively filling availability grids)
- **Secondary:** Match scheduling frequency increase
- **Technical:** Smooth performance for concurrent community usage
- **Maintenance:** Sustainability by non-professional administrator

### Platform Constraints That Shape Design
- **No Build Process:** Influences frontend architecture decisions
- **GAS Execution Limits:** Shapes batch operation and caching strategies  
- **Single Spreadsheet:** Drives data modeling and sheet protection patterns
- **Server-Side Templates:** Affects client-server communication patterns
- **Deployment Model:** Influences permission and multi-tenancy approach

## Evolution & Future Path

### From Sheets-Only to Web Frontend
This project evolved from a **fully functional Sheets-only version** (see development screenshots) to the current web application:

**Original Version:**
- Individual team sheets with cross-sheet data exchange
- Manual sharing and permission management between teams
- Functional but required spreadsheet literacy from users

**Current Web Version:**
- Single spreadsheet database with web frontend
- Unified user management and permissions
- Improved UX encouraging community adoption
- Foundation for future professional infrastructure handoff

### Migration Strategy
- **Short-term:** Optimize current GAS implementation for community needs
- **Long-term:** Eventual migration to professional infrastructure by community developer
- **Transition:** Current implementation designed to validate features and usage patterns

## Core Features & Implementation Status

### Completed Features (~40% backend-frontend integration)
- ✅ User authentication and team management
- ✅ Dual team membership (clan + draft teams)
- ✅ Availability grid data structures
- ✅ Basic web interface foundation

### In Development
- 🔄 Frontend-backend connectivity
- 🔄 Availability grid interactions
- 🔄 Team comparison views
- 🔄 Mobile responsiveness optimization

### Planned Features
- 📋 Advanced filtering and match-finding algorithms
- 📋 Integration with community Discord
- 📋 Tournament/league specific views

---

## Technical Implementation Notes

> **Context:** The following technical patterns are specific to Google Apps Script constraints and community tool requirements. These patterns may seem unconventional to developers familiar with traditional web frameworks, but are optimal for this platform and use case.

### Google Apps Script Patterns

#### Global Namespace & Function Calls

**Why This Pattern:** Google Apps Script operates in a flat global namespace by design - there's no module system or import/export functionality.

**Implementation:**
- **Direct Calls:** `createTeam()` not `TeamDataManager.createTeam()` 
- **File Organization:** Logical separation into manager files (`PlayerDataManager.js`, `TeamDataManager.js`, etc.) for human readability
- **Function Naming:** Unique names across all files to prevent collisions
- **Helper Prefixes:** Internal functions prefixed by file (`_pdm_someHelper()`) to indicate scope

**Common Issues:**
- Attempting to use `ManagerName.functionName()` syntax causes `ReferenceError`s
- Function name collisions between files
- Confusion for developers coming from modular JavaScript environments

#### Centralized Configuration (`Configuration.js`)

**Why This Pattern:** Single source of truth for all constants, avoiding magic numbers and enabling easy adjustments for community needs.

**Key Components:**
- `BLOCK_CONFIG`: Sheet structure, layout constants, and community-specific settings
- Validation functions: Email, team names, player initials suited to gaming community
- Response builders: Consistent API response patterns for frontend integration
- Date/time utilities: European timezone handling and scheduling logic

#### Permission System (`PermissionManager.js`)

**Why This Pattern:** Role-based access control using Google account integration, appropriate for community tool security needs.

**Implementation:**
- `ROLES` and `PERMISSIONS`: Global constants defining community hierarchy (Admin, Team Leader, Player, Guest)
- `userHasPermission()`: Single function protecting all sensitive operations
- Google OAuth integration: Leverages existing Google accounts (no separate user management needed)

#### Data Persistence Strategy

**Why Google Sheets:** 
- **Community Scale:** Efficient for hundreds of players, thousands of schedule entries
- **Admin Accessibility:** Community administrators can directly view/edit data
- **Zero Infrastructure:** No database setup, maintenance, or scaling concerns
- **Backup Built-in:** Google Drive handles backup and version history
- **Transparency:** Community can audit data if needed

**Sheet Structure:**
- Teams sheet: Team metadata and configuration
- Players sheet: User accounts and team memberships  
- Team-specific tabs: Individual availability grids
- Protection system: Prevents accidental data corruption while allowing programmatic updates

#### Development & Debugging Patterns

**Test Environment:** `Debug.js` provides comprehensive testing scenarios
- Reset database state before testing to ensure clean scenarios
- Direct function calls for backend testing (bypasses frontend permission layers)
- Sample data generation for realistic community scenarios

**Error Handling:** Standardized response patterns for consistent frontend integration
- `createSuccessResponse()` and `createErrorResponse()` for API consistency
- Contextual error logging for debugging by non-professional administrator

---

## Frontend Architecture (`index.html`)

> **Context:** Single HTML file approach is correct for Google Apps Script deployment model. This pattern enables rapid iteration and zero-build deployment while maintaining good organization through component-like structure.

### Technology Stack Rationale

#### Tailwind CSS via Play CDN
**Why This Choice:**
- **No Build System:** GAS has no compilation step; CDN is the appropriate solution
- **Rapid Prototyping:** Perfect for iterative community feedback cycles
- **Performance Acceptable:** Community tool scale doesn't require enterprise optimization
- **Familiar Patterns:** Utility-first approach works well with single-file structure

**Implementation:**
```html
<script src="https://cdn.tailwindcss.com"></script>
<button class="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded">
  Click Me
</button>
```

**Trade-offs:**
- ✅ Zero configuration, instant styling
- ✅ Perfect for community tool development cycle  
- ❌ Larger than optimized build (acceptable for this scale)
- ❌ No custom configuration (default theme sufficient)

#### Shadcn/UI for Design Patterns
**Why This Choice:**
- **Visual Consistency:** High-quality component patterns without React dependency
- **Manual Implementation:** Analyze structure, implement with Tailwind classes
- **Community Appropriate:** Professional appearance builds trust and adoption

**Usage Pattern:**
1. Browse [Shadcn/UI components](https://ui.shadcn.com/)
2. Analyze HTML structure and Tailwind class usage
3. Manually implement similar structure in `index.html`
4. Adapt for gaming community aesthetics (dark themes, etc.)

#### Lucide Icons as Embedded SVGs
**Why This Choice:**
- **Performance:** Icons load with page, no additional requests
- **Customization:** Full control over styling with Tailwind classes
- **Scalability:** Vector graphics work across all device sizes

**Implementation:**
```html
<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" 
     fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" 
     stroke-linejoin="round" class="h-5 w-5 mr-2 lucide lucide-user">
  <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/>
  <circle cx="12" cy="7" r="4"/>
</svg>
```

### Community-Specific Frontend Considerations

#### Desktop-First Design
- **Primary Platform:** QuakeWorld players typically use desktop setups
- **Grid Interactions:** Availability grids require precision clicking
- **Information Density:** Multiple team comparisons need screen real estate

#### Mobile Responsive Enhancements  
- **Secondary Priority:** Some players may check schedules on mobile
- **Touch-Friendly:** Larger tap targets for grid interactions
- **Simplified Views:** Condensed information hierarchy for smaller screens

#### Gaming Community UX Patterns
- **Dark Theme:** Default preference for gaming community
- **Fast Interactions:** Minimal clicks to mark availability
- **Clear Feedback:** Immediate visual confirmation of actions
- **Familiar Terminology:** Use community-specific language and concepts
*/

// This file contains project context documentation for AI assistants.
// No executable code - purely for reference and project understanding.