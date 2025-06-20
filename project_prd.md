# Product Requirements Document: MatchScheduler

**Version:** 0.6  
**Status:** In Progress  
**Goal:** To provide a detailed, unambiguous specification for the development of the MatchScheduler application, primarily for AI-driven code generation.

## Table of Contents (MVP Features)

1. [User Authentication & Onboarding](#1-user-authentication--onboarding) (Completed)
2. [Team Management](#2-team-management) (In Progress)
3. [Availability Grid & User Interaction](#3-availability-grid--user-interaction)
4. [Availability Comparison Logic & UI](#4-availability-comparison-logic--ui)
5. [Data Models & Backend Logic](#5-data-models--backend-logic)
6. [Development & Testing Strategy](#6-development--testing-strategy)

## Design Notes

**Platform Focus:** This application is primarily designed for desktop usage. The complex grid interface and interaction patterns are optimized for mouse/keyboard input and larger screens. While the application will function on mobile browsers, a dedicated mobile-optimized interface is not part of the MVP scope.

## 1. User Authentication & Onboarding

This section details the user's journey from visiting the site to becoming a full participant.

### 1.1. Core Principles

**No Login Wall:** All users, including anonymous guests, are taken directly to the main dashboard upon visiting the site.

**Contextual Onboarding:** Profile creation and login prompts are integrated directly into the user's first action (e.g., creating or joining a team) rather than being a separate, upfront step.

### 1.2. User States & Dashboard Views

#### 1.2.1. Guest (Not Authenticated):
- Sees the dashboard in a read-only state.
- A persistent "Login / Sign Up" button is visible in the header.
- The "Team Info" panel shows [ Create a Team ] and [ Join a Team ] buttons. Clicking these will trigger the unified modal (see Section 2).

#### 1.2.2. Authenticated User (No Profile):
- Sees the dashboard in read-only mode
- Can browse team information (view rosters, leader info) but cannot use comparison features
- The header shows their user icon with a prompt to complete profile
- The "Team Info" panel shows [ Create a Team ] and [ Join a Team ] buttons, but clicking them will prompt for profile completion first
- Can access profile settings to create their profile voluntarily
- Future feature: Can access the Teams & Players Overview page

#### 1.2.3. Full User (Authenticated, Profiled, On a Team):
- Sees the full interactive dashboard.
- The "Team Info" panel displays their current team's details.
- **Multiple Team Support:** If the user belongs to multiple teams (up to 2), team switcher buttons appear at the top of the Team Info panel.
  - Each button shows the team name
  - Clicking a team button switches the entire dashboard context to that team
  - The availability grid, roster, and all team-specific information update to reflect the selected team
  - The currently selected team is visually highlighted

### 1.3. Profile Creation

A user can create their profile (containing their display name and initials) at any time after authentication.

**Profile Creation Triggers:**
1. **Voluntary:** User clicks their profile icon and fills out their information
2. **Required:** When attempting to create or join a team without a profile, the system prompts for profile creation as part of that flow

**Profile States:**
- **Authenticated without profile:** Can browse teams, view schedules (read-only), and access profile settings
- **Authenticated with profile:** Can perform all actions including creating/joining teams

This approach allows users to exist in the system with a nickname but without belonging to any team, enabling features like player directories or waiting lists.

**Note on Multiple Teams:** Users can be members of up to 2 teams simultaneously. When a user belongs to multiple teams, they can easily switch between team contexts using the team selector buttons in the dashboard.

## 2. Team Management

**Version:** 0.5  
**Status:** In Progress

This section details all user actions related to creating, joining, leaving, and managing teams. It builds directly on the "Contextual Onboarding" principles defined in Section 1.

### 2.1. Create Team (Finalized)

**User Story:** "As a Player, I want to create a new team, which makes me the Team Leader of that team."

**UI Trigger:** User clicks the [ Create a Team ] button.

**Modal States & UI Flow:**
- **State 1 (Guest):** Prompts for login, then transitions to State 2.
- **State 2 (Authenticated without Profile):** Modal prompts for Nickname, Initials, Team Name, and Division Selection.
- **State 3 (Authenticated with Profile):** Modal shows pre-filled Nickname and Initials from user's profile, prompts for Team Name and Division Selection. If user modifies the Nickname or Initials fields during team creation, their profile is updated with the new values.

**Rules & Logic:**
- **Division Selection:** Teams must select at least one division during creation. Multiple divisions can be selected via checkboxes. The available divisions are "1", "2", and "3". While teams can technically select any combination, adjacent divisions (1+2 or 2+3) are expected. Teams self-police their division placement as this is primarily for discovery/filtering purposes.
- **Validation:** Nickname (2-20 chars), Initials (exactly 3 chars), Team Name (3-25 chars). Allowed characters: a-z, A-Z, 0-9, space, -, _.
- **Uniqueness:** Team Name must be unique among all teams with status: 'active'.
- **Defaults:** New teams have maxPlayers of 10 and status: 'active'.
- **Join Code:** A 6-character alphanumeric joinCode is auto-generated by the backend upon successful creation.

**Backend Process:** Creates the user profile (if needed) and the team document in a single operation to ensure data consistency.

**Expected Outcome:** Modal closes, success notification is shown. The dashboard refreshes, and the new leader can see their auto-generated joinCode in the "Team Management" panel.

### 2.2. Join Team (Finalized)

**User Story:** "As a Player, I want to join an existing team by providing a unique team code."

**UI Trigger:** User clicks the [ Join a Team ] button.

**Modal States & UI Flow:**
- **State 1 (Guest):** Prompts for login, then transitions to State 2.
- **State 2 (Authenticated without Profile):** Modal prompts for Nickname, Initials, and Join Code.
- **State 3 (Authenticated with Profile):** Modal shows pre-filled Nickname and Initials from user's profile, prompts for Join Code. If user modifies the Nickname or Initials fields while joining, their profile is updated with the new values.

**Rules & Logic:**
- **Validation:** Join Code must be 6 characters long.
- **Backend Checks:** The system must verify the code is valid, the team isn't full and has a status: 'active', and the user isn't already a member.

**Backend Process:** Creates the user profile (if needed), then adds the user to the team's roster and the team to the user's profile in a single operation to ensure data consistency.

**Expected Outcome:** Modal closes, success notification ("Welcome to [Team Name]!"). The dashboard refreshes to show the user on the new team. 

**Error Cases:**
- "Team is full" - shown when team has reached maxPlayers
- "Invalid code" - shown for non-existent codes  
- "Already a member" - shown if user tries to rejoin the same team
- Errors are displayed within the modal, allowing the user to try again with a different code.

### 2.3. Leave Team

**User Story:** "As a Player, I want to leave a team I am a member of."

**UI Trigger:** User clicks a "Leave Team" button. This button could be located in the "Team Management" panel for a leader or next to their own name in the roster for a regular player. Clicking it should open a confirmation modal.

**UI Flow:**
- The confirmation modal will ask, "Are you sure you want to leave [Team Name]?".
- It will have two buttons: [ Cancel ] and [ Yes, Leave Team ].

**Rules & Logic:**
- **Team Leader Rule:** A user who is the leaderId of a team cannot use the "Leave Team" function. The system will show them a message instead: "You must transfer leadership to another player before you can leave the team."
- **Last Player Rule:** If the departing user is the last person on the playerRoster, the team will be archived.
- **Inactive Rule:** A separate, scheduled backend process will periodically check for teams that have had no activity (e.g., no availability updates in 30 days) and set their status to 'inactive'. This logic will be detailed in Section 5.

**Team Status States:**
- **Active:** Team appears in all team lists and can be selected for comparison.
- **Inactive:** Team does not appear in browse lists but remains visible (greyed out) in users' favorites. Team data is preserved.
- **Archived:** Team is effectively deleted but data is preserved in the database for historical purposes.

**Note on Edge Cases:** In the rare case where a team leader becomes permanently unavailable (e.g., deleted account), manual database intervention may be required to transfer leadership. Teams are expected to naturally dissolve if the leader is absent for extended periods.

**Backend Process:**
- The system verifies the user is a member of the team and is not the leader.
- It removes the user from the team's playerRoster.
- It removes the team from the user's list of teams.
- It checks the playerRoster size. If it is now 0, it updates the team document, setting status to 'archived'.

**Expected Outcome:**
- **On Success:** The modal closes. A notification appears ("You have left [Team Name]."). The dashboard refreshes. If this was the user's only team, their view reverts to the "Guest" state with the "Create Team" and "Join Team" buttons visible.
- **On Failure** (e.g., user is leader): An error message is displayed.

### 2.4.1. Remove a Player

**User Story:** "As a Team Leader, I want to remove players from my team's roster."

**UI Trigger:** In the team roster list, the leader clicks an 'X' icon next to a player's name.

**UI Flow:** A confirmation modal appears: "Are you sure you want to remove [Player Name] from the team?".

**Rules & Logic:** A leader cannot remove themselves using this function. They must use the "Leave Team" function which has its own rules.

**Backend Process:**
- Verifies the caller is the team leader.
- Removes the target user from the team's playerRoster.
- Removes the team from the target user's teams array.

**Expected Outcome:** The player is removed from the roster list in the UI, and a success notification is shown.

### 2.4.2. Edit Team Settings

**User Story:** "As a Team Leader, I want to change max players on the team", "...edit the team's logo", and "...change our team's division assignments."

**UI Trigger:** The leader interacts with input fields directly within the "Team Management" panel and clicks a [ Save Settings ] button.

#### Sub-Section: Max Players
**UI Flow:** A dropdown or number input to select the new maximum number of players.

**Rules & Logic:** The maxPlayers value cannot be set to a number lower than the team's current roster size.

#### Sub-Section: Division Management
**UI Flow:** A list of checkboxes showing all available divisions (e.g., Division 1, Division 2, Division 3).

**Rules & Logic:** 
- At least one division must be selected.
- Teams can belong to multiple divisions simultaneously.
- This accommodates teams that are on the border between skill levels.

#### Sub-Section: Logo Management
**UI Flow:**
The Team Management panel shows a contextual button based on logo status:
- If no logo exists: Shows [ Add Logo ] button
- If logo exists: Shows [ Update Logo ] or [ Change Logo ] button

**Logo Management Modal:**
Clicking the logo button opens a dedicated modal containing:
- A preview box (e.g., 150x150 pixels) displays the current team logo, or a placeholder if none exists
- Below the preview, there are two options:
  - A [ Select File ] button for uploads
  - A text input field for pasting an image URL
- Action buttons: [ Save ], [ Delete Logo ] (if logo exists), and [ Cancel ]

**User Guidance:** Text in the modal states: "Recommended: Square image (e.g., 256x256px), .png or .jpg format."

**File Upload Logic:**
- User can either:
  - Click [ Select File ] to browse and choose a local image
  - Drag and drop an image file directly onto the preview box
- The selected/dropped image is displayed in the preview box immediately
- The file is uploaded to cloud storage in the background
- The [ Save ] button becomes active upon successful upload

**URL Link Logic:**
- User pastes a URL into the text field
- The application attempts to load the image from the URL into the preview box
- The [ Save ] button becomes active if the image loads successfully

**Backend Process:** When [ Save ] is clicked, the system updates the team's logo URL with the new URL (either uploaded or externally provided).

**Expected Outcome:** Modal closes, success notification is shown. The team's logo updates throughout the application where displayed.

### 2.4.4. Regenerate Join Code

**User Story:** "As a Team Leader, I want to regenerate our join code to maintain team security."

**UI Trigger:** Leader clicks the "Regenerate" button next to the current join code in the Team Management panel.

**UI Flow:** 
- Clicking the button immediately generates a new code
- The old code is replaced with the new one in the UI

**Expected Outcome:** Old code becomes invalid immediately. New code is displayed to the leader. Any attempts to join with the old code will fail.

### 2.5. Update Player Profile

**User Story:** "As a Player, I want to update my global display name and initials."

**UI Trigger:** User clicks on their profile icon (top left), which opens the "Edit My Global Profile" modal.

**What can be edited:**
- **Display Name:** The user's name shown across all teams
- **Discord Username:** Optional contact information
- **Initials:** Exactly 3 characters used in availability grids (applies to all teams)

**Validation:**
- Display Name: 2-20 characters
- Initials: Exactly 3 characters (letters or numbers)
- Discord Username: Optional field for contact purposes

**UI Flow:**
1. Modal opens showing current values in editable text fields
2. User makes changes
3. User clicks [ Save Changes ] or [ Cancel ]
4. On save, validation is performed
5. If initials conflict with another player on the same team, user is prompted to choose different initials

**Important Notes:**
- A player has only ONE set of initials (exactly 3 characters) used across all their teams
- Initials must be unique within each team roster
- The system stores player IDs in availability data, not initials, so historical data remains linked to the correct player even after initial changes
- Future feature: Option to display avatars instead of initials in time slots

**Expected Outcome:** 
- Changes are saved immediately
- All team views reflect the updated display name
- Availability grids show the new initials for future entries
- Historical availability data remains unchanged but correctly linked via player ID

**User Story:** "As a Team Leader, I want to pass leader role to another player on roster."

**UI Trigger:** In the team roster list, the leader clicks a "Promote to Leader" icon (e.g., a star) next to another player's name.

**UI Flow:** A confirmation modal appears: "Make [Player Name] the new team leader? You will become a regular player."

**Backend Process:**
- Verifies the caller is the current team leader.
- Updates the team's leader to the target player.

**Expected Outcome:** The modal closes, a success notification appears. The roster UI updates to show the star icon next to the new leader. The previous leader's "Team Management" panel view is removed or updated to reflect their new regular player status.

## 3. Availability Grid & User Interaction

This section details the primary user interface of the application: the availability grid. It covers how the grid is displayed and how users interact with it to set their availability.

### 3.1. Grid Structure and Display

**User Story:** "As a Player, I want to see a clear weekly schedule where I can view my team's availability and find potential match times."

**UI Layout:**
- A single, primary grid will be the central component of the dashboard.
- **Columns:** 7 columns representing the days of the week (Mon, Tue, etc.). The current day should be visually highlighted.
- **Rows:** Rows representing 30-minute time slots from 18:00 to 23:00.

**Navigation:**
- The system manages a total of 4 weeks of availability (current week + 3 future weeks).
- The grid displays two weeks at a time (a "bi-weekly block").
- A [ < Prev ] and [ Next > ] button pair navigates between these blocks seamlessly.
- When viewing Weeks 1 & 2, the Prev button is disabled (preventing navigation to past weeks).
- When viewing Weeks 3 & 4, the Next button is disabled (preventing navigation beyond 4 weeks).
- A label clearly indicates the currently displayed weeks (e.g., "Weeks 25-26: Jun 16 - 29").
- **Dynamic Week Updates:** If the current real-world week advances while viewing, the displayed weeks automatically update to maintain the "current + 3 future" window. For example, if viewing weeks 3 & 4 (real weeks 23-24) and the week changes, the view updates to show the new weeks 3 & 4 (now real weeks 24-25).
- Note: While only 4 weeks are displayed for user interaction, all historical availability and roster data is preserved in the database for future analysis.

### 3.2. Grid Display Modes

The main grid has two distinct modes that the user can switch between using controls in the Grid Selection panel.

**Mode Toggle Location:** View mode controls are located at the top of the Grid Selection panel:
- [✓] Own Team - Shows your team's availability
- [ ] Compare - Shows matching times with selected opponents

#### Mode 1: Own Team View (Default)
**Purpose:** To show a clear, detailed view of the user's own team schedule.

**Display Logic:** Each cell displays the initials (or avatars) of all team members who are available at that time.

**Visuals:** The cell's background color could change based on the number of available players to provide a quick visual "heatmap" of the team's readiness.

**Real-time Updates:** This view updates in real-time when any teammate changes their availability, ensuring the team always sees the current state of their collective schedule.

#### Mode 2: Comparison View
**Purpose:** To find times when the user's team and potential opponents are both available.

**Display Logic:** This mode is driven by the opponent filters on the right-hand panel ("Your Team: 4+ players", "Opponent: 4+ players").

**Visuals:**
- The grid still shows the user's team information (either full initials or at minimum a number showing how many team members are available).
- A cell is visually highlighted (e.g., with a bright green background or border) only if the conditions for both the user's team AND the selected opponent(s) are met for that specific time slot.
- All non-matching cells remain visible but un-highlighted. This creates a clear map of potential match times while maintaining context of your own team's availability.
- Visual experimentation during frontend development will determine the optimal balance between showing team details and highlighting matches.

### 3.3. Data History & Archiving

**User Story:** "As an Administrator, I want to have a complete and accurate history of all team rosters and their availability over time."

#### 3.3.1. Availability Data Archiving:
**What is stored:** Historical availability data for each team is preserved indefinitely, organized by week. This data is never deleted, even if the team becomes inactive or archived, thus preserving the historical record.

#### 3.3.2. Roster History via Event Logging:
**Principle:** Instead of taking weekly snapshots of a team's roster, the system will log every roster change as a distinct event.

**Event Information:** Whenever a player joins or leaves a team, a new event record is created containing:
- `timestamp`: The exact date and time of the event.
- `playerId`: The ID of the player who was affected.
- `playerDisplayName`: The name of the player.
- `action`: A string, either 'JOINED' or 'LEFT'.

**Benefit:** This creates a permanent, queryable audit trail of all roster modifications. To reconstruct a historical roster for any point in time, the system can simply process these events sequentially up to that point.

### 3.4. Grid Interaction & Data Submission

**User Story:** "As a Player, I want to easily select time slots and mark myself as available or unavailable using powerful selection tools."

#### 3.4.1. Cell Selection Mechanism:
**Primary Interaction:** Users select time slots directly on their personal availability grid.

**Visual Feedback:** All cells currently in the user's selection will be visually highlighted with a distinct border or semi-transparent overlay.

**Scope of Selection:**
- **Cross-Week Selections:** The Click and Drag and Shift + Click methods will function seamlessly across the two weeks displayed in the bi-weekly block.
- **Single-Week Selections:** The Header Clicks method is localized to a single week.

**Selection Methods:**
- **Click and Drag:** The primary method. User holds the left mouse button and drags over a range of cells to select them.
- **Shift + Click (Rectangle Select):** User clicks a single cell to mark a starting corner. They then hold the Shift key and click another cell, which selects the entire rectangular area between the two points.
- **Ctrl/Cmd + Click (Additive Select):** User can hold Ctrl (or Cmd on Mac) to add or remove individual cells or new drag-selections to their existing selection without clearing it.
- **Header Clicks (Localized to a single week):**
  - Clicking on a day header (e.g., the "Mon" for the first visible week) will select that entire column of time slots for that specific week only.
  - Clicking on a time header (e.g., "19:00") will select that entire row of days for that specific week only.

#### 3.4.2. "Grid Selection" Action Panel:
This panel contains controls for view modes, grid actions, and templates.

**Panel Layout (top to bottom):**

**View Mode Section:**
- Radio buttons or toggle switches:
  - [✓] Own Team View
  - [ ] Comparison View

**Selection Actions:**
- **[ All ]:** Selects all cells in the visible bi-weekly block
- **[ Clear ]:** De-selects all currently selected cells
- **[ Add Me ]:** Sets the user as "available" for all currently selected cells
- **[ Remove Me ]:** Sets the user as "unavailable" for all currently selected cells

**Template Section:**
- **[ Save Template ]:** Saves the current selection pattern
- **[ Load Template ]:** Opens template loading options

**Important:** The Add Me and Remove Me buttons operate on the current selection. The selection is cleared after either action is performed.

#### 3.4.3. Data Submission Logic:
**Real-time Updates:** When a user clicks [ Add Me ] or [ Remove Me ], the application immediately sends the changes to the backend. There is no separate "Save" button for availability.

**Backend Process:** The system updates the user's individual availability data and automatically recalculates the team's aggregated availability to ensure the "Own Team View" is always current. All team members see the changes in real-time.

#### 3.4.4. Template Functionality

**User Story:** "As a Player, I want to save my schedule pattern as a template so I can apply it quickly to future weeks."

**Simplified Template System:**

**Save Template:**
- User selects desired time slots on the grid (empty slots they want to mark as available)
- User clicks [ Save Template ] button
- System saves only the currently selected cell pattern from the TOP week (Week 1 of the bi-weekly view)
- A simple modal asks for template name
- Template is saved to user's profile

**Load Template:**
- User clicks [ Load Template ] button
- A modal appears showing:
  - Dropdown list of saved templates
  - Checkboxes to choose target weeks:
    - [ ] Week X (top week)
    - [ ] Week Y (bottom week)
    - [ ] Both weeks
  - [ Apply ] and [ Cancel ] buttons
- When user clicks Apply:
  - The template pattern is loaded as a SELECTION on the grid (cells are highlighted)
  - User can modify the selection (add/remove cells)
  - User then clicks [ Add Me ] to confirm and save their availability

**Key Benefits:**
- Templates only deal with selection patterns, not actual availability data
- Users can review and modify before committing
- Simple one-template save system (no complex management)
- Works seamlessly with the existing grid selection mechanism

### 3.5. Data Specifications

#### 3.5.1. Time Slot Identification:
Each time slot will be identified by a unique string ID.

**Format:** `ddd_hhmm` (e.g., `mon_1800`, `tue_2230`, `sun_2300`).

This format is simple, human-readable, and easily sortable.

#### 3.5.2. Week Identification:
Weeks are identified using ISO week notation.

**Format:** `YYYY-WXX` (e.g., `2025-W26`).

#### 3.5.3. Availability Updates:
**What happens:** When a user clicks [ Add Me ] or [ Remove Me ], the system immediately updates their availability for the selected time slots. The team's combined availability view is automatically recalculated to reflect the changes.

#### 3.5.4. Template Storage:
**What is stored:** Users can save their availability patterns as named templates (e.g., "My Raid Night", "Weekend Games"). Each template contains a list of time slots using the format defined in 3.5.1.

## 4. Availability Comparison Logic & UI

This section details the logic and user interface for the "Comparison View" mode, which allows users to find potential match times between their team and others.

### 4.1. Comparison Filters & UI Controls

**User Story:** "As a Player, I want to filter the schedule to only show me a live, always-updated view of time slots where both my team and a potential opponent have enough players ready."

#### 4.1.1. UI Panel Location:
The controls for filtering will reside in the top-right panel of the dashboard.

#### 4.1.2. Player Count Filters:
- **Your Team Filter:** A number input to set the minimum required players for the user's team. Default: 4.
- **Opponent Team Filter:** A number input to set the minimum required players for the opponent team(s). Default: 4.

#### 4.1.3. Opponent Selection Panels:
**"Favorites" List:** Displays teams the user has starred.
- An "All" toggle button at the top of this list allows the user to quickly select/de-select all of their favorited teams at once.

**"Browse All Teams" List:** Displays all active teams. The header of this panel will be updated to include a search icon and a text input field (e.g., "Teams 🔍 [search...]"). Typing in this field will filter the list of teams in real-time. Includes a dropdown filter to further narrow the list by "Division". The text search will always take precedence and will search across all divisions, regardless of the dropdown's selection.

**Selection Behavior:** Users can select multiple teams from both lists. Selected teams are visually highlighted.

#### 4.1.4. Activating & Maintaining the Live Comparison:
**The [ Compare ] Button:** Located at the bottom of the Favorites panel, this button starts in a disabled/greyed out state. It becomes active only after the user has selected one or more opponent teams (player count filters are always set to their defaults or user-specified values). This placement keeps all comparison controls on the right side of the interface where users are already working.

**Visual Feedback:** The Compare button remains greyed out with a tooltip like "Select at least one team to compare" until teams are selected.

**Initial Grid Update:** Clicking the active button triggers the initial comparison logic and updates the main grid to show the highlighted match times.

**Establishing Real-time Listeners:** When the comparison is activated, the application establishes real-time listeners for the user's own team AND all selected opponent teams. This ensures the comparison view stays current as teams update their availability.

**Live Updates:** If any team's availability changes, the application automatically recalculates the comparison and updates the highlighted cells on the grid in real-time. No manual refresh is required.

**Ending the Listeners:** The real-time listeners are automatically disconnected when the user navigates away, switches back to "Own Team View", or closes the tab, ensuring efficient resource usage.

### 4.2. Match Details

**User Story:** "As a Player, when I find a match time, I want to see which teams are available and how to contact them."

**UI Behavior:** Clicking on a highlighted match time slot shows:
- List of matched teams
- Their available player roster for that time (showing initials)
- Team leader contact information (Discord username)
- Info icon (ℹ️) for viewing full team details

**Contact Flow:** Users can view the team leader's Discord username to arrange the match outside the application.

## 5. Data Models & Backend Logic

**Version:** 0.3  
**Status:** In Progress

This section defines the data structure and business logic for the application.

### 5.1. Data Models

This defines the structure for our main data collections.

#### 5.1.1. Users Collection
**Purpose:** Stores user profiles and preferences.

**Key Fields:**
- `userId`: Unique identifier
- `displayName`: User's display name
- `initials`: Exactly 3 characters (uniform across platform)
- `discordId`: Optional Discord identifier
- `discordUsername`: Optional Discord username
- `photoURL`: User's avatar/photo
- `teams`: Array of team IDs the user belongs to
- `savedTemplates`: Map of availability templates

#### 5.1.2. Teams Collection
**Purpose:** Stores team information and settings.

**Key Fields:**
- `teamId`: Auto-generated unique identifier
- `teamName`: Name of the team
- `teamLogoUrl`: Optional logo URL
- `leaderId`: References the team leader's userId
- `maxPlayers`: Maximum players allowed (default: 10)
- `joinCode`: Unique 6-character join code
- `divisions`: Array of division assignments (e.g., ["Division 1", "Division 2"])
- `status`: Current status ("active", "inactive", or "archived")
- `playerRoster`: Array of player objects containing userId, displayName, and initials
- `createdAt`: Timestamp of team creation
- `lastActivityAt`: Timestamp of last activity

#### 5.1.3. Availability Data
**Purpose:** Stores team availability organized by week.

**Organization:** Availability data is stored per team, per week using the format `2025-W26`.

**Structure:** For each week, the system stores a grid mapping where each time slot (using the `ddd_hhmm` format) contains an array of player initials who are available at that time.

### 5.2. Business Logic

#### 5.2.1. Team Status Management

**Active Teams:**
- Appear in all team lists
- Can be joined by new players
- Show up in comparison searches

**Inactive Teams:**
- Do not appear in browse lists
- Remain visible (greyed out) in users' favorites
- Can be reactivated by team activity
- All data is preserved

**Archived Teams:**
- Effectively deleted from user perspective
- Data is preserved for historical purposes
- Cannot be reactivated

#### 5.2.3. Team Reactivation
Teams automatically transition from 'inactive' to 'active' status when any team member sets their availability. This indicates intent to play and reactivates the team for matching purposes.

#### 5.2.4. Data Retention Policy
All historical data is retained indefinitely. This includes:
- Team availability history
- Roster change events
- Archived team data

Administrative tools may be developed to purge abandoned teams (e.g., teams created but never used, teams with no availability data) on a case-by-case basis.

#### 5.2.5. System Limits
- **Templates per user:** 1 saved grid template
- **Teams per system:** No hard limit (authentication serves as bot prevention)
- **Teams per user:** 2 teams maximum
- **Players per team:** Configurable per team (default 10)

#### 5.2.6. Scheduling Rules
- **Past availability:** Users cannot set availability in the past
- **Future availability:** Users can set availability up to 4 weeks in the future (configurable)
- **Dynamic week creation:** Week data is created on-demand when a user first accesses or adds availability to that week, allowing the future week limit to be expanded without pre-creating empty data

#### 5.2.7. Join Code Management
- **Expiration:** Join codes automatically expire after 30 days
- **Regeneration:** When a new code is generated (manually or due to expiration), the old code immediately becomes invalid
- **Uniqueness:** Each team has exactly one active join code at any time
- **Auto-renewal:** When a code expires, a new one is automatically generated and displayed to the team leader

#### 5.2.8. Player Removal Behavior
When a player leaves or is removed from a team:
- **Current and future weeks:** Their availability is immediately cleared
- **Past weeks:** Historical availability data is preserved for record-keeping
- **Roster events:** The removal is logged as an event with timestamp

#### 5.2.9. Team Lifecycle Rules
- **Zero active players:** Teams with no active players remain in 'inactive' status (not auto-archived)
- **Reactivation:** Any former member can reactivate an inactive team by setting availability
- **Leader absence:** Teams without active leaders require manual intervention or natural dissolution
- **Visibility:** Inactive teams don't appear in comparison lists but may be shown in overview pages with filters

#### 5.2.10. Favorites System
- **Own team exclusion:** Users cannot favorite their own team(s)
- **Browse exclusion:** User's own teams don't appear in "Browse All Teams" list
- **No limit:** Users can favorite unlimited teams (panel scrolls if needed)
- **Inactive teams:** Can be favorited and remain in favorites list (shown greyed out)

#### 5.2.11. Comparison Rules
- **No team limit:** Users can compare against unlimited opponents simultaneously
- **Performance consideration:** System monitors API usage for optimization opportunities
- **Practical usage:** Most users expected to compare against 1-5 teams

#### 5.2.12. Display Name Updates
- **Immediate propagation:** Name changes update everywhere in real-time
- **Current focus:** System always shows current names and initials
- **Historical consideration:** Future feature may track name history, but current implementation focuses on present data

#### 5.2.13. Division Management
- **Flexible changes:** Teams can modify their division assignments at any time
- **No restrictions:** Any combination of divisions allowed (self-policed by community)
- **Leader control:** Only team leaders can change division settings

### 5.3. System Configuration Management

**User Story:** "As an administrator, I want to be able to easily change system-wide rules without needing to edit or deploy new code."

#### 5.3.1. Configurable System Rules:
**Purpose:** Key system variables are stored as configuration data rather than hard-coded values.

**Example Configurable Fields:**
- `inactivePeriodDays`: Number of days before a team is marked inactive (e.g., 28)
- `defaultMaxPlayers`: Default maximum players per team (e.g., 10)
- `minTeamNameLength`: Minimum team name length (e.g., 3)
- `maxTeamNameLength`: Maximum team name length (e.g., 25)
- `joinCodeLength`: Length of join codes (e.g., 6)
- `maxWeeksInFuture`: Number of future weeks users can set availability (e.g., 4, but expandable)

#### 5.3.2. Administration (MVP):
For the MVP, system configuration will be managed directly through the database console. No dedicated admin UI panel is required for initial release.

**Administrator Role Purpose:** The administrator role exists primarily for system maintenance and monitoring, not as a user-facing feature. This includes:
- Monitoring system health and usage
- Adjusting system configuration values
- Managing inactive/problematic teams if necessary
- Accessing historical data for analysis

Note: The administrator role is intentionally not mentioned in the README as it's not part of the end-user experience.

## 6. Development & Testing Strategy

**Version:** 0.1  
**Status:** In Progress

This section outlines the strategy for testing and development of the application.

### 6.1. Core Principles

**Isolation:** All development and testing will be performed in a local, isolated environment, ensuring the live production database is never affected.

**Repeatability:** The testing environment must be able to be destroyed and recreated easily to ensure consistent and reliable test results.

### 6.2. Development Environment

**Local Development:** The application will use Firebase Local Emulator Suite for development, providing a complete local instance of all Firebase services.

**Benefits:** Developers can work offline, test dangerous operations safely, and maintain consistent test data across development cycles.

### 6.3. Test Data Management

**User Story:** "As a developer, I want to populate my test database with realistic sample data easily."

#### Test Data Requirements:
The system needs scripts to:
- Clear all existing test data
- Create a predefined set of test user accounts
- Create several test teams with realistic configurations
- Populate teams with members in various roles
- Generate realistic availability patterns across multiple weeks

**Execution:** Developers should be able to reset their entire test environment with a single command, resulting in a fresh, fully populated test database.

### 6.4. Development Workflow

1. Developer starts the local Firebase emulator
2. Runs the test data population script
3. Makes changes to the application
4. Tests features against consistent test data
5. Can reset and repeat as needed

## 7. Future Features (Post-MVP)

This section documents features that are not critical for MVP but would enhance the user experience.

### 7.1. Teams & Players Overview Page

**User Story:** "As any user, I want to see an overview of all teams and players in the system to understand the community and find potential teams to join."

**UI Concept:**
- Replaces the weekly grid view with a single large panel
- The week navigation header transforms into filter/view controls
- Displays comprehensive lists of teams and players

**Features:**
- **Team List:** Shows all active teams with:
  - Team name and logo
  - Division(s)
  - Current roster size
  - Leader name
  - "Looking for players" indicator if below max capacity
  
- **Player List:** Shows all registered players with:
  - Display name and initials
  - Teams they belong to (or "Looking for team" if none)
  - Discord contact (if public)
  
- **Filters:**
  - By division
  - By team size (has openings/full)
  - Players with/without teams
  - Search by name

**Access:** Available to all authenticated users, even those without profiles or teams

### 7.2. Discord Bot Integration

**Purpose:** Automated notifications and team management through Discord

**Potential Features:**
- Match found notifications
- Weekly availability reminders
- Team roster changes alerts
- Quick availability setting via Discord commands

### 7.3. Mobile Optimization

**Purpose:** Improve experience for mobile users

**Approach:**
- Responsive grid design for smaller screens
- Touch-optimized controls
- Simplified navigation for mobile
- Progressive Web App capabilities

### 7.4. Admin Panel

**Purpose:** System management and monitoring tools

**Features:**
- API usage statistics and monitoring
- User/team management interface
- System configuration without database access
- Batch operations for maintenance
- Activity analytics and reports