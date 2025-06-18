# Schedule Manager - Codebase Architecture

**Version:** 2.6.0 (Updated: 2025-06-10)  
**Project:** A Google Apps Script web application for managing QuakeWorld team schedules.  
**Architecture:** A deliberate, constraint-driven monolith optimized for the Google Apps Script platform.

---

## Recent Changes (v2.6.0)

- **LogoService.js → ImageService.js**: Renamed and expanded to handle all image operations, not just team logos
- **Added generic Drive image support**: New `imageService_getDriveImageAsBase64()` function for any Google Drive hosted images
- **Enhanced logo management**: Team logos and other images now use base64 proxy to bypass CORS issues
- **Discord help image**: Now embedded as base64 in Configuration.js for instant loading

---

## Key Data Flows

### 1. User Joins a Team

A high-level trace of what happens when a user clicks "Join Team" in the UI.

1.  **UI Event (`frontend/02c-team-ui.html`):** The `handleJoinTeamSubmit` function is triggered.
2.  **API Call (`frontend/02c-team-ui.html`):** It calls `google.script.run.joinTeamWithCode(joinCode, initials)`.
3.  **Controller (`WebAppController.js`):** The `joinTeamWithCode` function receives the call.
    * It retrieves the current user's email.
    * It calls the core logic in `PlayerDataManager.js`.
4.  **Business Logic (`PlayerDataManager.js`):** The `joinTeamByCode` function executes:
    * Validates the join code using `TeamDataManager.js`.
    * Checks if the player exists; if not, calls `createPlayer()`.
    * Finds an empty team slot for the player.
    * Updates the `Players` sheet with the new team ID and role.
    * Calls `syncTeamPlayerData()` to update the denormalized data on the `Teams` sheet.
    * Calls `_pdm_updateCurrentWeekRosterBlockOnTeamSheet()` to update the roster block on the team's specific schedule sheet.
5.  **Response:** A success or error object is returned to the frontend.

### 2. User Updates Availability

1.  **UI Event (`frontend/04-events.html`):** `handleAvailabilityUpdate('add' | 'remove')` is triggered by clicking "Add Me" or "Remove Me".
2.  **Payload Prep (`frontend/02d-schedule-availability.html`):**
    * `validateAvailabilityUpdate()` checks for a selected team and valid initials.
    * `prepareUpdatePayload()` groups the selected cells by week and creates a `weeklyPayloads` array.
3.  **API Call (`frontend/02d-schedule-availability.html`):** It calls `google.script.run.updatePlayerAvailabilityForMultipleWeeks(teamId, action, payload)`.
4.  **Controller (`WebAppController.js`):** `updatePlayerAvailabilityForMultipleWeeks` receives the call and passes it directly to the service function.
5.  **Business Logic (`AvailabilityManager.js`):** The `availabilityManager_updatePlayerAvailabilityForMultipleWeeks_SERVICE` function executes:
    * Checks user permissions.
    * Loops through each week in the payload.
    * Finds the correct week block on the team's sheet using `WeekBlockManager.js`.
    * Reads the relevant cell range, updates the initials, and writes the data back. This is wrapped in `withProtectionBypass` from `CellProtection.js`.
    * Invalidates the script cache for the modified week blocks.
6.  **Response:** A success or error object is returned to the frontend, which then shows a status message.

### 3. Image Loading (Team Logos & Drive Images)

1.  **UI Request (`frontend/02c-team-ui.html`):** 
    * For team logos: `loadTeamLogo()` or `batchLoadLogos()` is called
    * For generic images: `loadDriveImage()` is called
2.  **API Call:** Frontend calls `google.script.run.getTeamLogoAsBase64()` or `google.script.run.getDriveImageAsBase64()`
3.  **Controller (`WebAppController.js`):** Routes to appropriate ImageService function
4.  **Business Logic (`ImageService.js`):**
    * Extracts Google Drive file ID from URL
    * Fetches file using `DriveApp.getFileById()`
    * Converts to base64 using `Utilities.base64Encode()`
    * Returns base64 data with MIME type
5.  **Frontend Display:** Creates data URL and updates `<img>` src attribute
6.  **Caching:** Frontend caches base64 data in memory for subsequent displays

---

## Backend Files

### 📁 `Configuration.js`

* **Type:** Utility/Configuration (Foundation)
* **Purpose:** Central repository for all system-wide configurations, constants, and stateless utility functions.
* **Key Components:**
    * `BLOCK_CONFIG`: The master configuration object for the entire application (sheet schemas, layouts, team settings).
    * Date/Time, Validation, and Response-building utility functions.
    * `handleError()`: Centralized error logging utility.
    * **NEW**: Discord help image stored as base64 in `BLOCK_CONFIG.WEB_APP.DISCORD_HELP_IMAGE_URL`
* **Used By:** Nearly all other `.js` files.

### 📁 `PermissionManager.js`

* **Type:** Manager (Security Core)
* **Purpose:** Centralized role detection, permission definition, and enforcement.
* **Key Components:**
    * `ROLES`, `PERMISSIONS`: Global constants defining all roles and permissions.
    * `getUserRole()`: Detects a user's role with caching.
    * `userHasPermission()`: Critical function for all security checks.
    * `getUserUIContext()`: Builds the complete user context object.
* **Dependencies (Calls):** `PlayerDataManager.js`, `TeamDataManager.js`.

### 📁 `WebAppController.js`

* **Type:** Controller (Primary Entry Point)
* **Purpose:** Main entry point for `google.script.run` calls from the frontend and for serving the main HTML page.
* **Key Functions:**
    * `doGet()`: Serves the `index.html` template and injects initial data (`userContextFromServer`, `BLOCK_CONFIG`, `ROLES`).
    * Functions exposed to the frontend, such as `createNewTeam`, `joinTeamWithCode`, and `updatePlayerAvailabilityForMultipleWeeks`.
    * **NEW**: `getDriveImageAsBase64()`, `getTeamLogoAsBase64()`, `getMultipleTeamLogosAsBase64()`
* **Dependencies (Calls):** `WebAppAPI.js`, `PlayerDataManager.js`, `AvailabilityManager.js`, `Administrator.js`, `ImageService.js`.

### 📁 `WebAppAPI.js`

* **Type:** Controller (API Service Layer)
* **Purpose:** Intermediate API layer that orchestrates complex business logic and prepares data for the frontend.
* **Key Functions:**
    * `getUserContext()`: Builds the initial user object.
    * `createNewTeamAndAddLeader()`: Orchestrates the multi-step team creation process.
    * `checkForScheduleUpdates()`: Handles the "smart-refresh" logic for the client.
* **Used By:** `WebAppController.js`.

### 📁 `TeamDataManager.js`

* **Type:** Manager (Core Business Logic)
* **Purpose:** All CRUD (Create, Read, Update, Delete) operations and business logic related to teams.
* **Key Functions:** `createTeam()`, `getTeamData()`, `archiveTeam()`, `validateJoinCode()`.
* **Caching:** Uses Script Cache for team data with keys like `teamData_TEAM_ID_incInactive_false`
* **Dependencies (Calls):** `PermissionManager.js`, `CellProtection.js`, `PlayerDataManager.js`, `MasterSheetManager.js`, `WeekBlockManager.js`.

### 📁 `PlayerDataManager.js`

* **Type:** Manager (Core Business Logic)
* **Purpose:** Manages all player data, profiles, team membership, and team-specific attributes.
* **Key Functions:** `createPlayer()`, `getPlayerDataByEmail()`, `joinTeamByCode()`, `leaveTeam()`, `syncTeamPlayerData()`.
* **Dependencies (Calls):** `PermissionManager.js`, `TeamDataManager.js`, `AvailabilityManager.js`, `CellProtection.js`.

### 📁 `AvailabilityManager.js`

* **Type:** Manager (Core Feature)
* **Purpose:** Manages all logic for reading and writing player availability on the schedule grids.
* **Key Functions:** 
    * `availabilityManager_updatePlayerAvailabilityForMultipleWeeks_SERVICE()`
    * `am_getTeamSchedule()`
    * `removePlayerInitialsFromSchedule()`
* **Caching:** Uses Script Cache for availability data with keys like `scheduleData_SHEETNAME_YEAR_WWEEK`
* **Dependencies (Calls):** `PermissionManager.js`, `PlayerDataManager.js`, `TeamDataManager.js`, `WeekBlockManager.js`, `CellProtection.js`.

### 📁 `WeekBlockManager.js`

* **Type:** Manager (Data Structure)
* **Purpose:** Manages the physical creation, discovery, and reading of the weekly data blocks on team sheets.
* **Key Functions:** `createSingleWeekBlock()`, `ensureWeekExists()`, `readWeekBlockData()`.
* **Dependencies (Calls):** `Configuration.js`.

### 📁 `Administrator.js`

* **Type:** Manager (Admin Functions)
* **Purpose:** Houses high-privilege operations, currently focused on team leadership management.
* **Key Functions:** `core_adminSetTeamLeader()`.
* **Dependencies (Calls):** `PermissionManager.js`, `TeamDataManager.js`, `PlayerDataManager.js`, `CellProtection.js`.

### 📁 `ImageService.js` (formerly LogoService.js)

* **Type:** Service (Image Handling)
* **Purpose:** Handles all image operations including team logos and generic Google Drive images. Provides base64 conversion to bypass CORS issues.
* **Key Functions:**
    * `uploadLogoFile()`: Handles base64 file uploads for team logos
    * `fetchAndSaveTeamLogo()`: Downloads and saves logos from URLs
    * `imageService_getTeamLogoAsBase64()`: Converts team logo to base64
    * `imageService_getMultipleTeamLogosAsBase64()`: Batch conversion for performance
    * `imageService_getDriveImageAsBase64()`: **NEW** - Generic Drive image to base64 conversion
* **Dependencies (Calls):** `Configuration.js`, `TeamDataManager.js`.

### 📁 Other Backend Services

* **`CellProtection.js`:** Manages sheet protection and the critical `withProtectionBypass()` function for safe data writing.
* **`MasterSheetManager.js`:** Handles the one-time setup and teardown of the database sheets.
* **`ScheduledTasks.js`:** Manages automated background tasks, like provisioning new week blocks for teams.
* **`CacheManager.js`:** Manages the `SYSTEM_CACHE` sheet for pre-computed data like team rosters.

---

## Frontend Files (`/frontend`)

* **Type:** UI/UX
* **Purpose:** The complete user interface and all client-side logic.
* **Key Architectural Patterns:**
    * **Modular Structure:** `index.html` assembles the UI from partial files using `<?!= include(...) ?>`.
    * **Ordered Scripts:** Client-side JavaScript is loaded in a specific, numbered sequence to ensure dependencies are met, with `04-events.html` loading last to bind all event handlers to the fully-rendered DOM.
    * **Client-Side State:** Global JS variables (`userContext`, `currentActiveTeamId`, `weekCache`, etc.) are initialized in `01-init.html` and hold the application's state.
* **Key Files:**
    * `index.html`: The main template that includes all other parts.
    * `01-head-content.html`: Contains all CSS and `<head>` elements.
    * `02-body-structure.html`: Defines the application's static DOM layout.
    * `01-init.html`: Initializes all global JavaScript variables. **Must load first.**
    * `02a-cache-navigation.html`: Handles the client-side week cache and `Next`/`Prev` week navigation.
    * `02b-grid-selection.html`: Logic for selecting cells on the availability grids.
    * `02c-team-ui.html`: Handles switching between teams, populating the user panel, and the initial "Join/Create Team" forms. **NEW**: Contains logo management functions (`loadTeamLogo()`, `batchLoadLogos()`, `loadDriveImage()`)
    * `02d-schedule-availability.html`: Renders the availability grids and handles the client-side part of updating availability.
    * `03-templates.html`: Client-side logic for saving/loading availability templates.
    * `04-events.html`: Attaches all DOM event listeners (e.g., `addEventListener`). **Must load last.**

---

## Caching Architecture

### Three-Layer Cache System

1. **Script Cache (6 hours max)**
   - Team data: `teamData_{teamId}_incInactive_{boolean}`
   - Availability data: `scheduleData_{sheetName}_{year}_W{week}`
   - User roles: `userRole_{email}`
   - Used for frequently accessed, medium-volatility data

2. **SYSTEM_CACHE Sheet (permanent)**
   - Team metadata (ID, name, division, logo URL, isPublic)
   - Team rosters as JSON (RosterJSON column)
   - Pre-computed data for expensive "join" operations
   - Updated when roster changes occur

3. **Client-side Memory Cache (session)**
   - Week cache for navigation without server calls
   - Logo cache (Map of teamId → base64 data)
   - Selected cells for grid interactions
   - Cleared on page refresh

---

## Project Configuration

* **`appsscript.json`:** The manifest file. The `webapp` settings which set `executeAs` to `USER_DEPLOYING` and `access` to `ANYONE` are critical for the application to function correctly.
* **`README.js`:** High-level project documentation explaining the "why" behind the design choices.
* **Debug Suite (`/Debug*.js`):** A comprehensive testing suite for developers, accessible via a spreadsheet menu.