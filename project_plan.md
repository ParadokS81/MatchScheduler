# Project Plan: MatchScheduler v3 (Firebase)

This document outlines the planning and development approach for rebuilding the MatchScheduler project on the Firebase platform.

## Step 1: The "Why" (Core Purpose)

**Why are we making it?** To create a tool that simplifies finding match times for a community of players, removing the manual overhead and time-consuming nature of communicating availability over Discord.

**Who is it for?** Team leaders and players within a gaming community.

**What makes it valuable?** It saves time by providing a clear, centralized, and visual way to compare team availability, making it easy to identify when a potential match can be played.

## Step 2: User Stories (Roles & Actions)

### User Roles:
- **Player**: The base user role. Anyone who logs in is a Player.
- **Team Leader**: A Player who has created a team or been given the leader role. They have additional permissions.
- **Administrator**: A superuser who can manage all teams and players.

### User Stories (MVP):

#### As a Player (Base Role), I want to...
- ...log in to the application using my Discord or Google account.
- ...create a new team, which makes me the Team Leader of that team.
- ...join an existing team by providing a unique team code.
- ...leave any team I am a member of.
- ...set my availability on a weekly time-slot grid.
- ...see the combined availability grid for my team.
- ...use the "Compare Availability" tool to check my team's schedule against a list of other teams (e.g., favorites, all) and click on a matched timeslot to see which specific teams and players are available.
- ...view contact information (like a Discord username) for the leader of another team.

#### As a Team Leader (Additional Permissions), I want to...
- ...do everything a regular Player can do.
- ...remove any player from my team's roster.
- ...edit the team's logo/image URL.
- ...change the maximum number of players allowed on the team.
- ...transfer the "Team Leader" role to another player on the roster.

**(System Rule)**: If I leave the team and I am the last player, the team is automatically deleted.

## Step 3: Data Models (Firestore)

### `users` Collection:
- `userId` (from Firebase Auth)
- `displayName`
- `initials` (Exactly 3 characters, used for display on the grid)
- `discordId` (optional, but primary for contact)
- `discordUsername`
- `photoURL`
- `teams`: An array of teamIds the user belongs to (maximum 2 teams).

### `teams` Collection:
- `teamId` (auto-generated)
- `teamName`
- `teamLogoUrl` (optional)
- `leaderId` (references a user userId)
- `maxPlayers` (number)
- `joinCode` (a unique, shareable code)
- `divisions`: An array of strings (e.g., ["1", "2"] for teams in multiple divisions)
- `playerRoster`: An array of objects, e.g., `{ userId: "...", displayName: "...", initials: "..." }`

### `availability` Collection:
This collection will store aggregated availability data per team, per week, to make comparisons fast.

- **Document ID**: `{teamId}_{year}_{weekNumber}` (e.g., `alpha_team_2025_26`)
- **Fields**:
  - `teamId`
  - `year`
  - `weekNumber`
  - `availabilityGrid`: A data structure where each slot holds a list of initials of available players. Example: `{ "mon_0900": ["ABC", "XYZ"], "mon_1000": ["ABC", "DEF", "GHI"], ... }`

**Note:** Technical implementation details may evolve. See the Product Requirements Document (PRD) for current business logic and user-focused specifications.

## Step 4: Minimum Viable Product (MVP) Scope

**Note:** Technical implementation details may evolve. See the Product Requirements Document (PRD) for current business logic and user-focused specifications.

### NEED TO HAVE (Core MVP Features):
- User authentication with Discord and Google.
- Team creation, joining, and leaving functionality.
- A weekly grid interface for players to set their availability.
- A combined availability view for all team members.
- An "Availability Comparison" tool accessible to all players.
- A "Team Management" panel visible only to Team Leaders for roster and settings management.

### NICE TO HAVE (Post-MVP Features):
- A public "Browse Teams" page to see all teams in the system.
- Saving availability as a personal template.
- Direct in-app notifications or a messaging system (a significant expansion).
- Full match scheduling, tracking, and score reporting.

## Step 5: Simple Mockup / UI Flow

### Login Page: 
Buttons for "Login with Discord" and "Login with Google".

### Main Dashboard:
- If not on a team, show "Join a Team" and "Create a Team" buttons.
- If on a team, show the main Availability Grid view for the user's currently selected team.

### Availability Grid View (Standard for all Players):
- A 7-day week view with time slots showing the initials of available players.
- Users can click/drag to modify their own availability via the "Grid Selection" panel.
- The "Compare Availability" filters are visible to everyone to find potential match times.

### Team Management Panel (Visible to Team Leader Only):
- An expandable panel containing leader-specific actions: Logo URL, Max Players, Roster Management (kick/promote), and regenerating the Join Code.

### Modals:
- Create Team modal.
- Join Team modal (input for join code).

## Step 6: Scalability

**Will it need to scale?** Yes. The original Sheets version failed to scale. The design must support hundreds of players and teams without performance degradation.

**Architecture Choice**: Firestore is designed for this level of scale. The data model (especially the pre-aggregated availability collection) is chosen specifically to ensure that availability comparison queries remain fast, even with many users.

## Step 7: Project's Home

A web application served via Firebase Hosting. This makes it universally accessible on desktop and mobile browsers without requiring an installation.

## Step 8: The Stack

- **Backend**: Firebase (Firestore, Cloud Functions, Authentication).
- **Frontend**: HTML, CSS, and JavaScript.
- **Authentication**: Firebase Authentication with Discord and Google providers as primary options.

## Step 9: Development Process

### Project Skeleton: 
Use `firebase init` to set up the project structure (Hosting, Functions, Firestore).

### Database & Security: 
Set up the Firestore collections and write security rules to protect data (e.g., only team leaders can edit team settings, users can only edit their own availability).

### Backend (Cloud Functions):
- Create callable functions for `createTeam`, `joinTeam`, `leaveTeam`, `promoteLeader`, etc.
- Create a Firestore-triggered function that reacts to a user's individual availability document changing, and then updates the aggregated availability document for their team.

### Frontend Interface:
- Build the UI components (login, grid, modals, team management panel).
- Connect the frontend to the backend by calling the Cloud Functions.