# Technical PRD - MatchScheduler Firebase Implementation

**Version:** 1.0  
**Purpose:** Complete implementation guide for AI coding assistant (Cursor with Claude 3.5 Sonnet)  
**Target:** Firebase platform with vanilla JavaScript frontend

## Table of Contents
1. [Project Setup & Configuration](#1-project-setup--configuration)
2. [Firestore Database Schema](#2-firestore-database-schema)
3. [Firebase Security Rules](#3-firebase-security-rules)
4. [Cloud Functions Specification](#4-cloud-functions-specification)
5. [Authentication Implementation](#5-authentication-implementation)
6. [Frontend Architecture](#6-frontend-architecture)
7. [Core Features Implementation Order](#7-core-features-implementation-order)
8. [UI Components Specification](#8-ui-components-specification)
9. [Error Handling & Edge Cases](#9-error-handling--edge-cases)
10. [Testing & Deployment](#10-testing--deployment)

---

## 1. Project Setup & Configuration

### 1.1 Initial Setup Commands
Execute these commands in order:

```bash
# Create project directory
mkdir matchscheduler-firebase
cd matchscheduler-firebase

# Initialize Firebase project
firebase init

# When prompted, select:
# - Firestore (for database)
# - Functions (for backend logic)
# - Hosting (for web app)
# - Emulators (for local development)
```

### 1.2 Project File Structure
Create this exact directory structure:

```
matchscheduler-firebase/
├── .firebaserc                   # Firebase project configuration
├── firebase.json                 # Firebase services configuration
├── firestore.rules              # Security rules
├── firestore.indexes.json       # Database indexes
├── functions/
│   ├── package.json
│   ├── .env                     # Environment variables
│   └── src/
│       ├── index.js             # Main functions entry
│       ├── auth/                # Authentication functions
│       │   └── profile.js
│       ├── teams/               # Team management functions
│       │   ├── create.js
│       │   ├── join.js
│       │   ├── leave.js
│       │   └── manage.js
│       ├── availability/        # Availability functions
│       │   └── update.js
│       └── scheduled/           # Scheduled functions
│           └── teamStatus.js
├── public/                      # Frontend files
│   ├── index.html
│   ├── css/
│   │   └── styles.css          # Tailwind output
│   ├── js/
│   │   ├── config/
│   │   │   └── firebase.js     # Firebase configuration
│   │   ├── services/           # Shared business logic
│   │   │   ├── auth.js
│   │   │   ├── database.js
│   │   │   └── state.js
│   │   ├── components/         # UI components
│   │   │   ├── grid.js
│   │   │   ├── teamInfo.js
│   │   │   ├── modals.js
│   │   │   └── filters.js
│   │   └── main.js            # Application entry point
│   └── assets/
│       └── images/
└── package.json                # Root package.json for scripts
```

### 1.3 Dependencies

#### Root package.json
```json
{
  "name": "matchscheduler-firebase",
  "version": "1.0.0",
  "scripts": {
    "serve": "firebase emulators:start",
    "deploy": "firebase deploy",
    "build-css": "tailwindcss -i ./public/css/input.css -o ./public/css/styles.css --watch"
  },
  "devDependencies": {
    "tailwindcss": "^3.4.0"
  }
}
```

#### functions/package.json
```json
{
  "name": "matchscheduler-functions",
  "engines": {
    "node": "20"
  },
  "dependencies": {
    "firebase-admin": "^12.0.0",
    "firebase-functions": "^5.0.0"
  }
}
```

### 1.4 Environment Configuration

#### functions/.env
```
# Add any API keys or configuration here
# Currently none required for MVP
```

#### public/js/config/firebase.js
```javascript
// Firebase configuration - will be filled after project creation
const firebaseConfig = {
  apiKey: "YOUR_API_KEY",
  authDomain: "YOUR_AUTH_DOMAIN",
  projectId: "YOUR_PROJECT_ID",
  storageBucket: "YOUR_STORAGE_BUCKET",
  messagingSenderId: "YOUR_MESSAGING_SENDER_ID",
  appId: "YOUR_APP_ID"
};
```

---

## 2. Firestore Database Schema

### 2.1 Collections Overview
The database uses three main collections:
- `users` - User profiles and preferences
- `teams` - Team information and settings
- `availability` - Team availability data by week

### 2.2 Users Collection

#### Document ID Pattern: `{userId}` (from Firebase Auth)

#### Document Structure:
```javascript
{
  // Required fields (set on profile creation)
  userId: "auth_abc123",              // String: Firebase Auth UID
  displayName: "John Doe",            // String: 2-20 characters
  initials: "JD",                     // String: Exactly 3 characters
  createdAt: Timestamp,               // Timestamp: Profile creation date
  
  // Optional fields
  discordUsername: "JohnDoe#1234",    // String: Discord username
  photoURL: "https://...",            // String: User avatar URL
  
  // System fields
  teams: ["team_id_1", "team_id_2"], // Array: Max 2 team IDs
  lastActivityAt: Timestamp,          // Timestamp: Last availability update
  
  // User preferences
  savedTemplates: {                   // Map: Saved availability templates
    "default": {
      name: "My Usual Schedule",
      slots: ["mon_1900", "mon_2000", "tue_1900"]
    }
  }
}
```

#### Sample Document:
```javascript
// Document ID: "auth_user123"
{
  userId: "auth_user123",
  displayName: "Alex Storm",
  initials: "AS",
  createdAt: Timestamp("2025-01-15T10:00:00Z"),
  discordUsername: "AlexStorm#4567",
  photoURL: null,
  teams: ["team_alpha"],
  lastActivityAt: Timestamp("2025-01-20T15:30:00Z"),
  savedTemplates: {
    "default": {
      name: "Weeknight Games",
      slots: ["tue_1900", "tue_1930", "tue_2000", "thu_1900", "thu_1930", "thu_2000"]
    }
  }
}
```

### 2.3 Teams Collection

#### Document ID Pattern: Auto-generated by Firestore

#### Document Structure:
```javascript
{
  // Core fields
  teamId: "auto_generated_id",       // String: Firestore auto ID
  teamName: "Alpha Squad",            // String: 3-25 characters
  leaderId: "auth_user123",           // String: User ID of team leader
  
  // Team settings
  maxPlayers: 10,                     // Number: Maximum roster size
  teamLogoUrl: "https://...",         // String: Optional team logo
  divisions: ["1", "2"],              // Array: Division assignments
  joinCode: "ABC123",                 // String: 6-character join code
  joinCodeCreatedAt: Timestamp,       // Timestamp: When code was generated
  
  // Status tracking
  status: "active",                   // String: "active", "inactive", or "archived"
  createdAt: Timestamp,               // Timestamp: Team creation date
  lastActivityAt: Timestamp,          // Timestamp: Last availability update
  
  // Roster (denormalized for performance)
  playerRoster: [                     // Array: Current team members
    {
      userId: "auth_user123",
      displayName: "Alex Storm",
      initials: "AS"
    },
    {
      userId: "auth_user456",
      displayName: "David Lee",
      initials: "DL"
    }
  ]
}
```

#### Sample Document:
```javascript
// Document ID: "team_abc123xyz"
{
  teamId: "team_abc123xyz",
  teamName: "Alpha Squad",
  leaderId: "auth_user123",
  maxPlayers: 10,
  teamLogoUrl: null,
  divisions: ["2"],
  joinCode: "ALPHA1",
  joinCodeCreatedAt: Timestamp("2025-01-15T10:00:00Z"),
  status: "active",
  createdAt: Timestamp("2025-01-15T10:00:00Z"),
  lastActivityAt: Timestamp("2025-01-20T15:30:00Z"),
  playerRoster: [
    {
      userId: "auth_user123",
      displayName: "Alex Storm",
      initials: "AS"
    },
    {
      userId: "auth_user456", 
      displayName: "David Lee",
      initials: "DL"
    }
  ]
}
```

### 2.4 Availability Collection

#### Document ID Pattern: `{teamId}_{year}-W{weekNumber}` (e.g., "team_abc123_2025-W26")

#### Document Structure:
```javascript
{
  teamId: "team_abc123xyz",          // String: Reference to team
  weekId: "2025-W26",                // String: ISO week format
  year: 2025,                        // Number: For queries
  weekNumber: 26,                    // Number: For queries
  
  // Availability grid - maps time slots to available players
  availabilityGrid: {
    // Format: "ddd_hhmm": ["initials1", "initials2", ...]
    "mon_1800": ["AS", "DL", "MT"],
    "mon_1830": ["AS", "DL"],
    "mon_1900": ["AS", "DL", "MT", "PA"],
    "mon_1930": ["AS", "DL", "MT", "PA"],
    // ... continues for all time slots
    "sun_2300": ["AS"]
  },
  
  // Metadata
  lastUpdatedAt: Timestamp,          // Timestamp: Last modification
  lastUpdatedBy: "auth_user123"     // String: User who last updated
}
```

#### Time Slot Format:
- Days: `mon`, `tue`, `wed`, `thu`, `fri`, `sat`, `sun`
- Times: `1800`, `1830`, `1900`, `1930`, `2000`, `2030`, `2100`, `2130`, `2200`, `2230`, `2300`
- Full slot ID example: `wed_2030` (Wednesday at 8:30 PM)

### 2.5 Additional Collections (Future)

#### Roster Events Collection (for history tracking)
```javascript
// Document ID: Auto-generated
{
  teamId: "team_abc123xyz",
  timestamp: Timestamp,
  eventType: "JOINED",              // "JOINED" or "LEFT"
  userId: "auth_user789",
  displayName: "Mike Thunder",
  metadata: {}                      // Additional event data if needed
}
```

---

## 3. Firebase Security Rules

### 3.1 Firestore Security Rules File

Create `firestore.rules` with these exact rules:

```javascript
rules_version = '2';

service cloud.firestore {
  match /databases/{database}/documents {
    
    // Helper functions
    function isAuthenticated() {
      return request.auth != null;
    }
    
    function hasProfile() {
      return isAuthenticated() && 
        exists(/databases/$(database)/documents/users/$(request.auth.uid));
    }
    
    function isTeamMember(teamId) {
      return hasProfile() && 
        teamId in get(/databases/$(database)/documents/users/$(request.auth.uid)).data.teams;
    }
    
    function isTeamLeader(teamId) {
      return hasProfile() && 
        get(/databases/$(database)/documents/teams/$(teamId)).data.leaderId == request.auth.uid;
    }
    
    // Users collection rules
    match /users/{userId} {
      // Anyone authenticated can read user profiles (for team rosters)
      allow read: if isAuthenticated();
      
      // Users can only create their own profile
      allow create: if isAuthenticated() && 
        request.auth.uid == userId &&
        request.resource.data.keys().hasAll(['displayName', 'initials', 'userId', 'createdAt']) &&
        request.resource.data.displayName.size() >= 2 &&
        request.resource.data.displayName.size() <= 20 &&
        request.resource.data.initials.size() == 3;
      
      // Users can only update their own profile
      allow update: if isAuthenticated() && 
        request.auth.uid == userId &&
        request.resource.data.userId == userId && // Can't change userId
        request.resource.data.teams.size() <= 2;   // Max 2 teams
      
      // No deletion allowed
      allow delete: if false;
    }
    
    // Teams collection rules
    match /teams/{teamId} {
      // Anyone authenticated can read active teams (for browsing)
      allow read: if isAuthenticated() && 
        (resource.data.status == 'active' || isTeamMember(teamId));
      
      // Creating teams handled by Cloud Function only
      allow create: if false;
      
      // Team updates
      allow update: if isTeamLeader(teamId) &&
        // Can't change these fields
        request.resource.data.teamId == resource.data.teamId &&
        request.resource.data.createdAt == resource.data.createdAt &&
        request.resource.data.leaderId == resource.data.leaderId && // Use transfer function
        // Validate other fields
        request.resource.data.maxPlayers >= resource.data.playerRoster.size() &&
        request.resource.data.divisions.size() >= 1;
      
      // No direct deletion (use archive status)
      allow delete: if false;
    }
    
    // Availability collection rules  
    match /availability/{documentId} {
      // Parse the compound document ID
      // Format: teamId_year-WweekNumber
      
      // Anyone authenticated can read (for comparisons)
      allow read: if isAuthenticated();
      
      // Team members can update their team's availability
      allow write: if hasProfile() && 
        // Extract teamId from document ID (everything before the last underscore)
        isTeamMember(documentId.split('_')[0]) &&
        // Validate the grid only contains valid initials from team roster
        request.resource.data.keys().hasAll(['teamId', 'weekId', 'availabilityGrid']);
      
      // No deletion of availability documents
      allow delete: if false;
    }
  }
}
```

### 3.2 Security Rules Testing Checklist

Test these scenarios in the Firebase console:

1. **User Profile Creation**
   - ✅ Authenticated user can create their own profile
   - ❌ User cannot create profile for another user
   - ❌ User cannot create profile without required fields

2. **Team Browsing**
   - ✅ Any authenticated user can see active teams
   - ✅ Team members can see their inactive team
   - ❌ Non-members cannot see inactive teams

3. **Availability Updates**
   - ✅ Team members can update their team's availability
   - ❌ Non-members cannot update availability
   - ❌ Cannot delete availability documents

---

## 4. Cloud Functions Specification

### 4.1 Function Organization

All functions are callable HTTPS functions unless specified otherwise. Each function validates input, performs the operation, and returns standardized responses.

### 4.2 Response Format

All functions return this standard format:
```javascript
// Success
{
  success: true,
  data: { /* relevant data */ },
  message: "Operation completed successfully"
}

// Error
{
  success: false,
  error: "ERROR_CODE",
  message: "Human-readable error message"
}
```

### 4.3 Team Management Functions

#### 4.3.1 createTeam

**File:** `functions/src/teams/create.js`

**Input Parameters:**
```javascript
{
  teamName: "Alpha Squad",        // String: 3-25 characters
  divisions: ["1", "2"]          // Array: At least one division
}
```

**Validation:**
- User must be authenticated
- User must have a profile
- User can be on maximum 2 teams
- Team name must be unique among active teams
- Team name: 3-25 characters, alphanumeric + spaces + dash + underscore
- At least one division must be selected

**Process:**
1. Validate all inputs
2. Check if team name is already taken (status = 'active')
3. Generate unique 6-character join code
4. Create team document with user as leader
5. Add team ID to user's teams array
6. Return team data with join code

**Implementation:**
```javascript
const functions = require('firebase-functions');
const admin = require('firebase-admin');
const db = admin.firestore();

exports.createTeam = functions.https.onCall(async (data, context) => {
  // Check authentication
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'User must be logged in');
  }
  
  const userId = context.auth.uid;
  const { teamName, divisions } = data;
  
  // Validate inputs
  if (!teamName || teamName.length < 3 || teamName.length > 25) {
    throw new functions.https.HttpsError('invalid-argument', 'Team name must be 3-25 characters');
  }
  
  if (!divisions || !Array.isArray(divisions) || divisions.length === 0) {
    throw new functions.https.HttpsError('invalid-argument', 'At least one division required');
  }
  
  // Validate team name format
  const validNameRegex = /^[a-zA-Z0-9\s\-_]+$/;
  if (!validNameRegex.test(teamName)) {
    throw new functions.https.HttpsError('invalid-argument', 'Team name contains invalid characters');
  }
  
  try {
    // Get user profile
    const userDoc = await db.collection('users').doc(userId).get();
    if (!userDoc.exists) {
      throw new functions.https.HttpsError('failed-precondition', 'User profile not found');
    }
    
    const userData = userDoc.data();
    
    // Check team limit
    if (userData.teams && userData.teams.length >= 2) {
      throw new functions.https.HttpsError('failed-precondition', 'Maximum 2 teams per user');
    }
    
    // Check if team name exists
    const existingTeams = await db.collection('teams')
      .where('teamName', '==', teamName)
      .where('status', '==', 'active')
      .get();
    
    if (!existingTeams.empty) {
      throw new functions.https.HttpsError('already-exists', 'Team name already taken');
    }
    
    // Generate unique join code
    const joinCode = generateJoinCode();
    
    // Create team document
    const teamRef = db.collection('teams').doc();
    const now = admin.firestore.FieldValue.serverTimestamp();
    
    const teamData = {
      teamId: teamRef.id,
      teamName: teamName.trim(),
      leaderId: userId,
      maxPlayers: 10,
      teamLogoUrl: null,
      divisions: divisions,
      joinCode: joinCode,
      joinCodeCreatedAt: now,
      status: 'active',
      createdAt: now,
      lastActivityAt: now,
      playerRoster: [{
        userId: userId,
        displayName: userData.displayName,
        initials: userData.initials
      }]
    };
    
    // Use transaction to ensure consistency
    await db.runTransaction(async (transaction) => {
      // Create team
      transaction.set(teamRef, teamData);
      
      // Update user's teams array
      transaction.update(db.collection('users').doc(userId), {
        teams: admin.firestore.FieldValue.arrayUnion(teamRef.id)
      });
    });
    
    return {
      success: true,
      data: {
        teamId: teamRef.id,
        teamName: teamData.teamName,
        joinCode: joinCode
      },
      message: `Team "${teamName}" created successfully!`
    };
    
  } catch (error) {
    console.error('Create team error:', error);
    throw new functions.https.HttpsError('internal', 'Failed to create team');
  }
});

// Helper function to generate unique join code
function generateJoinCode() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}
```

#### 4.3.2 joinTeam

**File:** `functions/src/teams/join.js`

**Input Parameters:**
```javascript
{
  joinCode: "ABC123"              // String: 6-character code
}
```

**Validation:**
- User must be authenticated
- User must have a profile  
- User can be on maximum 2 teams
- Join code must exist and be valid
- Team must be active and not full
- User must not already be on the team

**Process:**
1. Validate join code format
2. Find team by join code
3. Check all conditions
4. Add user to team roster
5. Add team to user's teams array
6. Update last activity timestamp

**Implementation:**
```javascript
exports.joinTeam = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'User must be logged in');
  }
  
  const userId = context.auth.uid;
  const { joinCode } = data;
  
  // Validate join code
  if (!joinCode || joinCode.length !== 6) {
    throw new functions.https.HttpsError('invalid-argument', 'Invalid join code format');
  }
  
  try {
    // Get user profile
    const userDoc = await db.collection('users').doc(userId).get();
    if (!userDoc.exists) {
      throw new functions.https.HttpsError('failed-precondition', 'User profile not found');
    }
    
    const userData = userDoc.data();
    
    // Check team limit
    if (userData.teams && userData.teams.length >= 2) {
      throw new functions.https.HttpsError('failed-precondition', 'Maximum 2 teams per user');
    }
    
    // Find team by join code
    const teamsQuery = await db.collection('teams')
      .where('joinCode', '==', joinCode.toUpperCase())
      .where('status', '==', 'active')
      .limit(1)
      .get();
    
    if (teamsQuery.empty) {
      throw new functions.https.HttpsError('not-found', 'Invalid or expired join code');
    }
    
    const teamDoc = teamsQuery.docs[0];
    const teamData = teamDoc.data();
    const teamId = teamDoc.id;
    
    // Check if user already on team
    if (userData.teams && userData.teams.includes(teamId)) {
      throw new functions.https.HttpsError('already-exists', 'Already a member of this team');
    }
    
    // Check if team is full
    if (teamData.playerRoster.length >= teamData.maxPlayers) {
      throw new functions.https.HttpsError('failed-precondition', 'Team is full');
    }
    
    // Add user to team using transaction
    await db.runTransaction(async (transaction) => {
      // Add to team roster
      transaction.update(teamDoc.ref, {
        playerRoster: admin.firestore.FieldValue.arrayUnion({
          userId: userId,
          displayName: userData.displayName,
          initials: userData.initials
        }),
        lastActivityAt: admin.firestore.FieldValue.serverTimestamp()
      });
      
      // Add team to user's teams
      transaction.update(db.collection('users').doc(userId), {
        teams: admin.firestore.FieldValue.arrayUnion(teamId)
      });
    });
    
    return {
      success: true,
      data: {
        teamId: teamId,
        teamName: teamData.teamName
      },
      message: `Welcome to ${teamData.teamName}!`
    };
    
  } catch (error) {
    console.error('Join team error:', error);
    if (error instanceof functions.https.HttpsError) {
      throw error;
    }
    throw new functions.https.HttpsError('internal', 'Failed to join team');
  }
});
```

#### 4.3.3 leaveTeam

**File:** `functions/src/teams/leave.js`

**Input Parameters:**
```javascript
{
  teamId: "team_abc123"           // String: Team document ID
}
```

**Validation:**
- User must be authenticated
- User must be a member of the team
- User cannot be the team leader (must transfer first)

**Process:**
1. Verify user is team member
2. Check if user is leader
3. Remove user from roster
4. Remove team from user's teams
5. If last member, archive team

**Implementation:**
```javascript
exports.leaveTeam = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'User must be logged in');
  }
  
  const userId = context.auth.uid;
  const { teamId } = data;
  
  if (!teamId) {
    throw new functions.https.HttpsError('invalid-argument', 'Team ID required');
  }
  
  try {
    const teamDoc = await db.collection('teams').doc(teamId).get();
    if (!teamDoc.exists) {
      throw new functions.https.HttpsError('not-found', 'Team not found');
    }
    
    const teamData = teamDoc.data();
    
    // Check if user is team leader
    if (teamData.leaderId === userId) {
      throw new functions.https.HttpsError(
        'failed-precondition', 
        'Team leader must transfer leadership before leaving'
      );
    }
    
    // Check if user is on team
    const userOnTeam = teamData.playerRoster.some(p => p.userId === userId);
    if (!userOnTeam) {
      throw new functions.https.HttpsError('not-found', 'Not a member of this team');
    }
    
    // Remove user from team
    await db.runTransaction(async (transaction) => {
      // Get fresh team data in transaction
      const freshTeamDoc = await transaction.get(teamDoc.ref);
      const freshTeamData = freshTeamDoc.data();
      
      // Filter out the leaving user
      const newRoster = freshTeamData.playerRoster.filter(p => p.userId !== userId);
      
      // Update team
      const updateData = {
        playerRoster: newRoster,
        lastActivityAt: admin.firestore.FieldValue.serverTimestamp()
      };
      
      // If no players left, archive team
      if (newRoster.length === 0) {
        updateData.status = 'archived';
      }
      
      transaction.update(teamDoc.ref, updateData);
      
      // Remove team from user's teams
      transaction.update(db.collection('users').doc(userId), {
        teams: admin.firestore.FieldValue.arrayRemove(teamId)
      });
    });
    
    return {
      success: true,
      data: { teamId },
      message: `You have left ${teamData.teamName}`
    };
    
  } catch (error) {
    console.error('Leave team error:', error);
    if (error instanceof functions.https.HttpsError) {
      throw error;
    }
    throw new functions.https.HttpsError('internal', 'Failed to leave team');
  }
});
```

### 4.4 Availability Update Function

#### 4.4.1 updateAvailability

**File:** `functions/src/availability/update.js`

**Input Parameters:**
```javascript
{
  teamId: "team_abc123",          // String: Team ID
  weekId: "2025-W26",             // String: ISO week format
  action: "add",                  // String: "add" or "remove"
  slots: ["mon_1900", "mon_2000"] // Array: Time slot IDs
}
```

**Validation:**
- User must be authenticated
- User must be a team member
- Week must be current or future (up to 4 weeks)
- Slots must be valid format

**Process:**
1. Validate user is team member
2. Get or create availability document
3. Add/remove user's initials from specified slots
4. Update team's last activity timestamp

**Implementation:**
```javascript
exports.updateAvailability = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'User must be logged in');
  }
  
  const userId = context.auth.uid;
  const { teamId, weekId, action, slots } = data;
  
  // Validate inputs
  if (!teamId || !weekId || !action || !slots) {
    throw new functions.https.HttpsError('invalid-argument', 'Missing required parameters');
  }
  
  if (!['add', 'remove'].includes(action)) {
    throw new functions.https.HttpsError('invalid-argument', 'Action must be "add" or "remove"');
  }
  
  if (!Array.isArray(slots) || slots.length === 0) {
    throw new functions.https.HttpsError('invalid-argument', 'Slots must be a non-empty array');
  }
  
  // Validate week format (YYYY-WXX)
  const weekRegex = /^\d{4}-W\d{2}$/;
  if (!weekRegex.test(weekId)) {
    throw new functions.https.HttpsError('invalid-argument', 'Invalid week format');
  }
  
  try {
    // Get user data
    const userDoc = await db.collection('users').doc(userId).get();
    if (!userDoc.exists) {
      throw new functions.https.HttpsError('failed-precondition', 'User profile not found');
    }
    
    const userData = userDoc.data();
    
    // Verify user is on team
    if (!userData.teams || !userData.teams.includes(teamId)) {
      throw new functions.https.HttpsError('permission-denied', 'Not a member of this team');
    }
    
    const userInitials = userData.initials;
    const availabilityId = `${teamId}_${weekId}`;
    
    // Parse week info
    const [year, weekNum] = weekId.split('-W');
    
    await db.runTransaction(async (transaction) => {
      const availRef = db.collection('availability').doc(availabilityId);
      const availDoc = await transaction.get(availRef);
      
      let availData;
      if (!availDoc.exists) {
        // Create new availability document
        availData = {
          teamId: teamId,
          weekId: weekId,
          year: parseInt(year),
          weekNumber: parseInt(weekNum),
          availabilityGrid: {},
          lastUpdatedAt: admin.firestore.FieldValue.serverTimestamp(),
          lastUpdatedBy: userId
        };
      } else {
        availData = availDoc.data();
      }
      
      // Update slots
      slots.forEach(slot => {
        if (!availData.availabilityGrid[slot]) {
          availData.availabilityGrid[slot] = [];
        }
        
        if (action === 'add') {
          // Add initials if not already present
          if (!availData.availabilityGrid[slot].includes(userInitials)) {
            availData.availabilityGrid[slot].push(userInitials);
          }
        } else {
          // Remove initials
          availData.availabilityGrid[slot] = availData.availabilityGrid[slot]
            .filter(initials => initials !== userInitials);
          
          // Remove empty slots
          if (availData.availabilityGrid[slot].length === 0) {
            delete availData.availabilityGrid[slot];
          }
        }
      });
      
      // Update availability document
      availData.lastUpdatedAt = admin.firestore.FieldValue.serverTimestamp();
      availData.lastUpdatedBy = userId;
      
      if (availDoc.exists) {
        transaction.update(availRef, availData);
      } else {
        transaction.set(availRef, availData);
      }
      
      // Update team's last activity
      transaction.update(db.collection('teams').doc(teamId), {
        lastActivityAt: admin.firestore.FieldValue.serverTimestamp(),
        status: 'active' // Reactivate if inactive
      });
      
      // Update user's last activity
      transaction.update(db.collection('users').doc(userId), {
        lastActivityAt: admin.firestore.FieldValue.serverTimestamp()
      });
    });
    
    return {
      success: true,
      data: { 
        teamId,
        weekId,
        action,
        slotsUpdated: slots.length 
      },
      message: 'Availability updated successfully'
    };
    
  } catch (error) {
    console.error('Update availability error:', error);
    if (error instanceof functions.https.HttpsError) {
      throw error;
    }
    throw new functions.https.HttpsError('internal', 'Failed to update availability');
  }
});
```

### 4.5 Scheduled Functions

#### 4.5.1 checkTeamActivity

**File:** `functions/src/scheduled/teamStatus.js`

**Schedule:** Runs daily at 2:00 AM

**Purpose:** 
- Mark teams as inactive if no availability updates in 14 days
- Regenerate expired join codes (30+ days old)

**Implementation:**
```javascript
exports.checkTeamActivity = functions.pubsub
  .schedule('0 2 * * *')  // Daily at 2 AM
  .timeZone('UTC')
  .onRun(async (context) => {
    const now = admin.firestore.Timestamp.now();
    const twoWeeksAgo = new admin.firestore.Timestamp(
      now.seconds - (14 * 24 * 60 * 60), 
      now.nanoseconds
    );
    const thirtyDaysAgo = new admin.firestore.Timestamp(
      now.seconds - (30 * 24 * 60 * 60),
      now.nanoseconds
    );
    
    try {
      // Find active teams with no recent activity
      const inactiveTeams = await db.collection('teams')
        .where('status', '==', 'active')
        .where('lastActivityAt', '<', twoWeeksAgo)
        .get();
      
      // Find teams with expired join codes
      const expiredCodeTeams = await db.collection('teams')
        .where('status', '==', 'active')
        .where('joinCodeCreatedAt', '<', thirtyDaysAgo)
        .get();
      
      // Batch update
      const batch = db.batch();
      let inactiveCount = 0;
      let codeCount = 0;
      
      // Mark teams as inactive
      inactiveTeams.forEach(doc => {
        batch.update(doc.ref, { status: 'inactive' });
        inactiveCount++;
      });
      
      // Regenerate expired join codes
      expiredCodeTeams.forEach(doc => {
        const newCode = generateJoinCode();
        batch.update(doc.ref, { 
          joinCode: newCode,
          joinCodeCreatedAt: now 
        });
        codeCount++;
      });
      
      if (inactiveCount > 0 || codeCount > 0) {
        await batch.commit();
        console.log(`Marked ${inactiveCount} teams as inactive, regenerated ${codeCount} join codes`);
      }
      
      return null;
    } catch (error) {
      console.error('Check team activity error:', error);
      return null;
    }
  });

// Helper function (shared with createTeam)
function generateJoinCode() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

### 4.6 Additional Team Management Functions

#### 4.6.1 removePlayer

**File:** `functions/src/teams/manage.js`

**Input Parameters:**
```javascript
{
  teamId: "team_abc123",
  targetUserId: "auth_user456"
}
```

**Validation:**
- Caller must be team leader
- Target must be team member
- Cannot remove yourself (use leaveTeam)

**Implementation:**
```javascript
exports.removePlayer = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'User must be logged in');
  }
  
  const userId = context.auth.uid;
  const { teamId, targetUserId } = data;
  
  if (!teamId || !targetUserId) {
    throw new functions.https.HttpsError('invalid-argument', 'Missing required parameters');
  }
  
  if (userId === targetUserId) {
    throw new functions.https.HttpsError('invalid-argument', 'Use leaveTeam to remove yourself');
  }
  
  try {
    const teamDoc = await db.collection('teams').doc(teamId).get();
    if (!teamDoc.exists) {
      throw new functions.https.HttpsError('not-found', 'Team not found');
    }
    
    const teamData = teamDoc.data();
    
    // Verify caller is team leader
    if (teamData.leaderId !== userId) {
      throw new functions.https.HttpsError('permission-denied', 'Only team leader can remove players');
    }
    
    // Check if target is on team
    const targetPlayer = teamData.playerRoster.find(p => p.userId === targetUserId);
    if (!targetPlayer) {
      throw new functions.https.HttpsError('not-found', 'Player not found on team');
    }
    
    // Remove player using transaction
    await db.runTransaction(async (transaction) => {
      // Remove from team roster
      const newRoster = teamData.playerRoster.filter(p => p.userId !== targetUserId);
      transaction.update(teamDoc.ref, {
        playerRoster: newRoster,
        lastActivityAt: admin.firestore.FieldValue.serverTimestamp()
      });
      
      // Remove team from target user's teams
      transaction.update(db.collection('users').doc(targetUserId), {
        teams: admin.firestore.FieldValue.arrayRemove(teamId)
      });
    });
    
    return {
      success: true,
      data: {
        removedPlayer: targetPlayer.displayName
      },
      message: `${targetPlayer.displayName} has been removed from the team`
    };
    
  } catch (error) {
    console.error('Remove player error:', error);
    if (error instanceof functions.https.HttpsError) {
      throw error;
    }
    throw new functions.https.HttpsError('internal', 'Failed to remove player');
  }
});
```

#### 4.6.2 updateTeamSettings

**Input Parameters:**
```javascript
{
  teamId: "team_abc123",
  maxPlayers: 12,                 // Optional
  divisions: ["1", "2"],          // Optional  
  teamLogoUrl: "https://..."      // Optional
}
```

**Validation:**
- Caller must be team leader
- maxPlayers must be >= current roster size
- At least one division required
- Logo URL must be valid format (if provided)

**Implementation:**
```javascript
exports.updateTeamSettings = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'User must be logged in');
  }
  
  const userId = context.auth.uid;
  const { teamId, maxPlayers, divisions, teamLogoUrl } = data;
  
  if (!teamId) {
    throw new functions.https.HttpsError('invalid-argument', 'Team ID required');
  }
  
  // Must update at least one field
  if (maxPlayers === undefined && !divisions && teamLogoUrl === undefined) {
    throw new functions.https.HttpsError('invalid-argument', 'No updates provided');
  }
  
  try {
    const teamDoc = await db.collection('teams').doc(teamId).get();
    if (!teamDoc.exists) {
      throw new functions.https.HttpsError('not-found', 'Team not found');
    }
    
    const teamData = teamDoc.data();
    
    // Verify caller is team leader
    if (teamData.leaderId !== userId) {
      throw new functions.https.HttpsError('permission-denied', 'Only team leader can update settings');
    }
    
    const updates = {};
    
    // Validate and add maxPlayers
    if (maxPlayers !== undefined) {
      if (maxPlayers < teamData.playerRoster.length) {
        throw new functions.https.HttpsError(
          'invalid-argument', 
          `Max players cannot be less than current roster size (${teamData.playerRoster.length})`
        );
      }
      if (maxPlayers < 2 || maxPlayers > 50) {
        throw new functions.https.HttpsError('invalid-argument', 'Max players must be between 2 and 50');
      }
      updates.maxPlayers = maxPlayers;
    }
    
    // Validate and add divisions
    if (divisions) {
      if (!Array.isArray(divisions) || divisions.length === 0) {
        throw new functions.https.HttpsError('invalid-argument', 'At least one division required');
      }
      // Validate division values
      const validDivisions = ['1', '2', '3'];
      if (!divisions.every(d => validDivisions.includes(d))) {
        throw new functions.https.HttpsError('invalid-argument', 'Invalid division value');
      }
      updates.divisions = divisions;
    }
    
    // Validate and add logo URL
    if (teamLogoUrl !== undefined) {
      if (teamLogoUrl && !teamLogoUrl.startsWith('https://')) {
        throw new functions.https.HttpsError('invalid-argument', 'Logo URL must use HTTPS');
      }
      updates.teamLogoUrl = teamLogoUrl; // Can be null to remove logo
    }
    
    // Update team
    updates.lastActivityAt = admin.firestore.FieldValue.serverTimestamp();
    await teamDoc.ref.update(updates);
    
    return {
      success: true,
      data: updates,
      message: 'Team settings updated successfully'
    };
    
  } catch (error) {
    console.error('Update team settings error:', error);
    if (error instanceof functions.https.HttpsError) {
      throw error;
    }
    throw new functions.https.HttpsError('internal', 'Failed to update team settings');
  }
});
```

#### 4.6.3 regenerateJoinCode

**Input Parameters:**
```javascript
{
  teamId: "team_abc123"
}
```

**Validation:**
- Caller must be team leader

**Implementation:**
```javascript
exports.regenerateJoinCode = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'User must be logged in');
  }
  
  const userId = context.auth.uid;
  const { teamId } = data;
  
  if (!teamId) {
    throw new functions.https.HttpsError('invalid-argument', 'Team ID required');
  }
  
  try {
    const teamDoc = await db.collection('teams').doc(teamId).get();
    if (!teamDoc.exists) {
      throw new functions.https.HttpsError('not-found', 'Team not found');
    }
    
    const teamData = teamDoc.data();
    
    // Verify caller is team leader
    if (teamData.leaderId !== userId) {
      throw new functions.https.HttpsError('permission-denied', 'Only team leader can regenerate join code');
    }
    
    // Generate new code
    const newCode = generateJoinCode();
    
    // Update team
    await teamDoc.ref.update({
      joinCode: newCode,
      joinCodeCreatedAt: admin.firestore.FieldValue.serverTimestamp(),
      lastActivityAt: admin.firestore.FieldValue.serverTimestamp()
    });
    
    return {
      success: true,
      data: {
        joinCode: newCode
      },
      message: 'Join code regenerated successfully'
    };
    
  } catch (error) {
    console.error('Regenerate join code error:', error);
    if (error instanceof functions.https.HttpsError) {
      throw error;
    }
    throw new functions.https.HttpsError('internal', 'Failed to regenerate join code');
  }
});
```

#### 4.6.4 transferLeadership

**Input Parameters:**
```javascript
{
  teamId: "team_abc123",
  newLeaderId: "auth_user456"
}
```

**Validation:**
- Caller must be current leader
- New leader must be team member

**Implementation:**
```javascript
exports.transferLeadership = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'User must be logged in');
  }
  
  const userId = context.auth.uid;
  const { teamId, newLeaderId } = data;
  
  if (!teamId || !newLeaderId) {
    throw new functions.https.HttpsError('invalid-argument', 'Missing required parameters');
  }
  
  if (userId === newLeaderId) {
    throw new functions.https.HttpsError('invalid-argument', 'Already the team leader');
  }
  
  try {
    const teamDoc = await db.collection('teams').doc(teamId).get();
    if (!teamDoc.exists) {
      throw new functions.https.HttpsError('not-found', 'Team not found');
    }
    
    const teamData = teamDoc.data();
    
    // Verify caller is current leader
    if (teamData.leaderId !== userId) {
      throw new functions.https.HttpsError('permission-denied', 'Only current leader can transfer leadership');
    }
    
    // Verify new leader is on team
    const newLeader = teamData.playerRoster.find(p => p.userId === newLeaderId);
    if (!newLeader) {
      throw new functions.https.HttpsError('not-found', 'New leader must be a team member');
    }
    
    // Transfer leadership
    await teamDoc.ref.update({
      leaderId: newLeaderId,
      lastActivityAt: admin.firestore.FieldValue.serverTimestamp()
    });
    
    return {
      success: true,
      data: {
        newLeader: newLeader.displayName
      },
      message: `${newLeader.displayName} is now the team leader`
    };
    
  } catch (error) {
    console.error('Transfer leadership error:', error);
    if (error instanceof functions.https.HttpsError) {
      throw error;
    }
    throw new functions.https.HttpsError('internal', 'Failed to transfer leadership');
  }
});
```

### 4.7 Profile Management Functions

#### 4.7.1 createProfile

**File:** `functions/src/auth/profile.js`

**Input Parameters:**
```javascript
{
  displayName: "John Doe",        // String: 2-20 characters
  initials: "JD",                 // String: Exactly 3 characters
  discordUsername: "JohnD#1234"   // String: Optional
}
```

**Validation:**
- User must be authenticated
- Profile must not already exist
- Display name: 2-20 characters, alphanumeric + spaces
- Initials: Exactly 3 characters, alphanumeric only

**Implementation:**
```javascript
exports.createProfile = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'User must be logged in');
  }
  
  const userId = context.auth.uid;
  const { displayName, initials, discordUsername } = data;
  
  // Validate display name
  if (!displayName || displayName.length < 2 || displayName.length > 20) {
    throw new functions.https.HttpsError('invalid-argument', 'Display name must be 2-20 characters');
  }
  
  // Validate initials
  if (!initials || initials.length !== 3) {
    throw new functions.https.HttpsError('invalid-argument', 'Initials must be exactly 3 characters');
  }
  
  const validInitialsRegex = /^[A-Z0-9]{3}$/;
  if (!validInitialsRegex.test(initials.toUpperCase())) {
    throw new functions.https.HttpsError('invalid-argument', 'Initials must be alphanumeric');
  }
  
  try {
    // Check if profile already exists
    const existingProfile = await db.collection('users').doc(userId).get();
    if (existingProfile.exists) {
      throw new functions.https.HttpsError('already-exists', 'Profile already exists');
    }
    
    // Create profile
    const profileData = {
      userId: userId,
      displayName: displayName.trim(),
      initials: initials.toUpperCase(),
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      teams: [],
      savedTemplates: {}
    };
    
    // Add optional fields
    if (discordUsername) {
      profileData.discordUsername = discordUsername;
    }
    
    // Get photo URL from auth provider
    if (context.auth.token.picture) {
      profileData.photoURL = context.auth.token.picture;
    }
    
    await db.collection('users').doc(userId).set(profileData);
    
    return {
      success: true,
      data: profileData,
      message: 'Profile created successfully'
    };
    
  } catch (error) {
    console.error('Create profile error:', error);
    if (error instanceof functions.https.HttpsError) {
      throw error;
    }
    throw new functions.https.HttpsError('internal', 'Failed to create profile');
  }
});
```

#### 4.7.2 updateProfile

**Input Parameters:**
```javascript
{
  displayName: "Jane Doe",        // Optional
  initials: "JND",                // Optional
  discordUsername: "JaneD#5678"   // Optional
}
```

**Validation:**
- Must update at least one field
- Same validation rules as createProfile
- If changing initials, check for conflicts within user's teams

**Implementation:**
```javascript
exports.updateProfile = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'User must be logged in');
  }
  
  const userId = context.auth.uid;
  const { displayName, initials, discordUsername } = data;
  
  // Must update at least one field
  if (!displayName && !initials && discordUsername === undefined) {
    throw new functions.https.HttpsError('invalid-argument', 'No updates provided');
  }
  
  try {
    const userDoc = await db.collection('users').doc(userId).get();
    if (!userDoc.exists) {
      throw new functions.https.HttpsError('not-found', 'Profile not found');
    }
    
    const userData = userDoc.data();
    const updates = {};
    
    // Validate display name if provided
    if (displayName) {
      if (displayName.length < 2 || displayName.length > 20) {
        throw new functions.https.HttpsError('invalid-argument', 'Display name must be 2-20 characters');
      }
      updates.displayName = displayName.trim();
    }
    
    // Validate initials if provided
    if (initials) {
      if (initials.length !== 3) {
        throw new functions.https.HttpsError('invalid-argument', 'Initials must be exactly 3 characters');
      }
      
      const validInitialsRegex = /^[A-Z0-9]{3}$/;
      if (!validInitialsRegex.test(initials.toUpperCase())) {
        throw new functions.https.HttpsError('invalid-argument', 'Initials must be alphanumeric');
      }
      
      const newInitials = initials.toUpperCase();
      
      // Check for conflicts within user's teams
      if (userData.teams && userData.teams.length > 0) {
        for (const teamId of userData.teams) {
          const teamDoc = await db.collection('teams').doc(teamId).get();
          if (teamDoc.exists) {
            const teamData = teamDoc.data();
            const conflict = teamData.playerRoster.some(
              p => p.initials === newInitials && p.userId !== userId
            );
            if (conflict) {
              throw new functions.https.HttpsError(
                'already-exists',
                `Initials "${newInitials}" already taken by another player on team ${teamData.teamName}`
              );
            }
          }
        }
      }
      
      updates.initials = newInitials;
    }
    
    // Handle discord username
    if (discordUsername !== undefined) {
      updates.discordUsername = discordUsername || null; // Allow removal
    }
    
    // Update profile and all team rosters in transaction
    await db.runTransaction(async (transaction) => {
      // Update user profile
      transaction.update(userDoc.ref, updates);
      
      // Update team rosters if display name or initials changed
      if ((updates.displayName || updates.initials) && userData.teams) {
        for (const teamId of userData.teams) {
          const teamRef = db.collection('teams').doc(teamId);
          const teamDoc = await transaction.get(teamRef);
          
          if (teamDoc.exists) {
            const teamData = teamDoc.data();
            const updatedRoster = teamData.playerRoster.map(player => {
              if (player.userId === userId) {
                return {
                  userId: userId,
                  displayName: updates.displayName || player.displayName,
                  initials: updates.initials || player.initials
                };
              }
              return player;
            });
            
            transaction.update(teamRef, { playerRoster: updatedRoster });
          }
        }
      }
    });
    
    return {
      success: true,
      data: updates,
      message: 'Profile updated successfully'
    };
    
  } catch (error) {
    console.error('Update profile error:', error);
    if (error instanceof functions.https.HttpsError) {
      throw error;
    }
    throw new functions.https.HttpsError('internal', 'Failed to update profile');
  }
});
```

---

## 5. Authentication Implementation

### 5.1 Firebase Authentication Setup

#### 5.1.1 Google OAuth Configuration

**Firebase Console Steps:**
1. Go to Authentication > Sign-in method
2. Enable Google provider
3. Add authorized domains (localhost for dev, your production domain)
4. No additional configuration needed - Firebase handles everything

#### 5.1.2 Frontend Authentication Flow

**File:** `public/js/services/auth.js`

```javascript
// Firebase Auth Service
const AuthService = (function() {
  let auth;
  let currentUser = null;
  let profileCache = null;
  
  // Initialize Firebase Auth
  function init() {
    auth = firebase.auth();
    
    // Set up auth state listener
    auth.onAuthStateChanged(async (user) => {
      currentUser = user;
      
      if (user) {
        // User is signed in
        console.log('User authenticated:', user.uid);
        await checkUserProfile();
      } else {
        // User is signed out
        console.log('User signed out');
        profileCache = null;
        updateUIForGuest();
      }
    });
  }
  
  // Sign in with Google
  async function signInWithGoogle() {
    const provider = new firebase.auth.GoogleAuthProvider();
    
    try {
      const result = await auth.signInWithPopup(provider);
      return {
        success: true,
        user: result.user
      };
    } catch (error) {
      console.error('Sign in error:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }
  
  // Sign out
  async function signOut() {
    try {
      await auth.signOut();
      return { success: true };
    } catch (error) {
      console.error('Sign out error:', error);
      return { 
        success: false,
        error: error.message
      };
    }
  }
  
  // Check if user has profile
  async function checkUserProfile() {
    if (!currentUser) return null;
    
    try {
      const doc = await firebase.firestore()
        .collection('users')
        .doc(currentUser.uid)
        .get();
      
      if (doc.exists) {
        profileCache = doc.data();
        updateUIForAuthenticatedUser(true); // Has profile
      } else {
        profileCache = null;
        updateUIForAuthenticatedUser(false); // No profile yet
      }
      
      return profileCache;
    } catch (error) {
      console.error('Profile check error:', error);
      return null;
    }
  }
  
  // UI Update functions (called by auth state changes)
  function updateUIForGuest() {
    // Show login button
    document.getElementById('auth-button').textContent = 'Login / Sign Up';
    document.getElementById('user-info').style.display = 'none';
    
    // Show join/create team buttons in read-only state
    document.getElementById('team-info-guest').style.display = 'block';
    document.getElementById('team-info-member').style.display = 'none';
    
    // Disable grid interactions
    GridComponent.setReadOnly(true);
  }
  
  function updateUIForAuthenticatedUser(hasProfile) {
    // Update auth button to show user info
    document.getElementById('auth-button').style.display = 'none';
    document.getElementById('user-info').style.display = 'flex';
    
    if (hasProfile) {
      // Full user - show everything
      document.getElementById('user-display-name').textContent = profileCache.displayName;
      document.getElementById('profile-status').style.display = 'none';
      
      // Enable grid if on a team
      if (profileCache.teams && profileCache.teams.length > 0) {
        document.getElementById('team-info-guest').style.display = 'none';
        document.getElementById('team-info-member').style.display = 'block';
        GridComponent.setReadOnly(false);
      }
    } else {
      // Authenticated but no profile
      document.getElementById('user-display-name').textContent = 'Complete Profile';
      document.getElementById('profile-status').style.display = 'block';
      document.getElementById('profile-status').textContent = '⚠️ Profile Incomplete';
      
      // Keep in guest mode but show profile prompt
      GridComponent.setReadOnly(true);
    }
  }
  
  // Get current user
  function getCurrentUser() {
    return currentUser;
  }
  
  // Get user profile from cache
  function getUserProfile() {
    return profileCache;
  }
  
  // Check if user has profile
  function hasProfile() {
    return profileCache !== null;
  }
  
  // Check if user is team member
  function isTeamMember(teamId) {
    return profileCache && 
           profileCache.teams && 
           profileCache.teams.includes(teamId);
  }
  
  // Check if user is team leader
  async function isTeamLeader(teamId) {
    if (!isTeamMember(teamId)) return false;
    
    try {
      const teamDoc = await firebase.firestore()
        .collection('teams')
        .doc(teamId)
        .get();
      
      return teamDoc.exists && teamDoc.data().leaderId === currentUser.uid;
    } catch (error) {
      console.error('Team leader check error:', error);
      return false;
    }
  }
  
  // Refresh profile from database
  async function refreshProfile() {
    profileCache = null;
    return await checkUserProfile();
  }
  
  return {
    init,
    signInWithGoogle,
    signOut,
    getCurrentUser,
    getUserProfile,
    hasProfile,
    isTeamMember,
    isTeamLeader,
    refreshProfile
  };
})();
```

### 5.2 Authentication UI Components

#### 5.2.1 Login Button and User Menu

**HTML Structure (in index.html):**
```html
<!-- Top navigation bar -->
<nav class="bg-gray-900 border-b border-gray-800">
  <div class="container mx-auto px-4 py-3 flex justify-between items-center">
    <h1 class="text-2xl font-bold text-white">MatchScheduler</h1>
    
    <!-- Guest state: Login button -->
    <button id="auth-button" 
            class="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg"
            onclick="AuthHandlers.showLoginModal()">
      Login / Sign Up
    </button>
    
    <!-- Authenticated state: User info (hidden by default) -->
    <div id="user-info" class="flex items-center gap-3" style="display: none;">
      <span id="profile-status" class="text-yellow-500 text-sm"></span>
      <button onclick="AuthHandlers.showProfileMenu()" 
              class="flex items-center gap-2 hover:bg-gray-800 px-3 py-2 rounded-lg">
        <img id="user-avatar" src="" alt="" class="w-8 h-8 rounded-full">
        <span id="user-display-name" class="text-white"></span>
        <svg class="w-4 h-4 text-gray-400"><!-- Dropdown arrow --></svg>
      </button>
      
      <!-- Dropdown menu -->
      <div id="profile-dropdown" class="hidden absolute right-4 top-14 bg-gray-800 rounded-lg shadow-lg">
        <a href="#" onclick="AuthHandlers.showEditProfile()" class="block px-4 py-2 hover:bg-gray-700">
          Edit Profile
        </a>
        <hr class="border-gray-700">
        <a href="#" onclick="AuthService.signOut()" class="block px-4 py-2 hover:bg-gray-700">
          Sign Out
        </a>
      </div>
    </div>
  </div>
</nav>
```

#### 5.2.2 Authentication Handlers

**File:** `public/js/components/authHandlers.js`

```javascript
const AuthHandlers = (function() {
  
  // Show login modal
  function showLoginModal() {
    const modal = document.getElementById('login-modal');
    modal.classList.remove('hidden');
  }
  
  // Hide login modal
  function hideLoginModal() {
    const modal = document.getElementById('login-modal');
    modal.classList.add('hidden');
  }
  
  // Handle Google sign in
  async function handleGoogleSignIn() {
    const result = await AuthService.signInWithGoogle();
    
    if (result.success) {
      hideLoginModal();
      // Auth state listener will handle UI updates
    } else {
      showError('Sign in failed: ' + result.error);
    }
  }
  
  // Show profile dropdown menu
  function showProfileMenu() {
    const dropdown = document.getElementById('profile-dropdown');
    dropdown.classList.toggle('hidden');
  }
  
  // Show edit profile modal
  async function showEditProfile() {
    const profile = AuthService.getUserProfile();
    
    if (!profile) {
      // First time profile creation
      document.getElementById('profile-modal-title').textContent = 'Create Your Profile';
      document.getElementById('profile-display-name').value = '';
      document.getElementById('profile-initials').value = '';
      document.getElementById('profile-discord').value = '';
    } else {
      // Editing existing profile
      document.getElementById('profile-modal-title').textContent = 'Edit Profile';
      document.getElementById('profile-display-name').value = profile.displayName || '';
      document.getElementById('profile-initials').value = profile.initials || '';
      document.getElementById('profile-discord').value = profile.discordUsername || '';
    }
    
    document.getElementById('profile-modal').classList.remove('hidden');
  }
  
  // Save profile
  async function saveProfile() {
    const displayName = document.getElementById('profile-display-name').value.trim();
    const initials = document.getElementById('profile-initials').value.trim().toUpperCase();
    const discordUsername = document.getElementById('profile-discord').value.trim();
    
    // Validate inputs
    if (!displayName || displayName.length < 2 || displayName.length > 20) {
      showError('Display name must be 2-20 characters');
      return;
    }
    
    if (!initials || initials.length !== 3) {
      showError('Initials must be exactly 3 characters');
      return;
    }
    
    try {
      const profile = AuthService.getUserProfile();
      const functionName = profile ? 'updateProfile' : 'createProfile';
      
      const result = await firebase.functions().httpsCallable(functionName)({
        displayName,
        initials,
        discordUsername: discordUsername || null
      });
      
      if (result.data.success) {
        // Refresh profile and update UI
        await AuthService.refreshProfile();
        document.getElementById('profile-modal').classList.add('hidden');
        showSuccess(result.data.message);
      }
    } catch (error) {
      showError(error.message);
    }
  }
  
  // Show error message
  function showError(message) {
    // Implementation depends on your notification system
    console.error(message);
    alert(message); // Replace with better UI
  }
  
  // Show success message  
  function showSuccess(message) {
    // Implementation depends on your notification system
    console.log(message);
    alert(message); // Replace with better UI
  }
  
  return {
    showLoginModal,
    hideLoginModal,
    handleGoogleSignIn,
    showProfileMenu,
    showEditProfile,
    saveProfile
  };
})();
```

### 5.3 Authentication Flow Integration

#### 5.3.1 Create/Join Team with Authentication

When a user clicks "Create Team" or "Join Team", the system needs to handle multiple states:

**File:** `public/js/components/teamHandlers.js`

```javascript
const TeamHandlers = (function() {
  
  // Handle create team button click
  async function handleCreateTeam() {
    const user = AuthService.getCurrentUser();
    
    if (!user) {
      // Not logged in - show login modal
      AuthHandlers.showLoginModal();
      // Store intent to create team after login
      sessionStorage.setItem('postAuthAction', 'createTeam');
      return;
    }
    
    if (!AuthService.hasProfile()) {
      // Logged in but no profile - show combined modal
      showCreateTeamModal(true); // Include profile fields
    } else {
      // Has profile - show regular create team modal
      showCreateTeamModal(false);
    }
  }
  
  // Handle join team button click
  async function handleJoinTeam() {
    const user = AuthService.getCurrentUser();
    
    if (!user) {
      // Not logged in - show login modal
      AuthHandlers.showLoginModal();
      sessionStorage.setItem('postAuthAction', 'joinTeam');
      return;
    }
    
    if (!AuthService.hasProfile()) {
      // Logged in but no profile - show combined modal
      showJoinTeamModal(true); // Include profile fields
    } else {
      // Has profile - show regular join team modal
      showJoinTeamModal(false);
    }
  }
  
  // Show create team modal
  function showCreateTeamModal(includeProfile) {
    const modal = document.getElementById('create-team-modal');
    
    if (includeProfile) {
      // Show profile fields
      document.getElementById('create-team-profile-section').classList.remove('hidden');
      const profile = AuthService.getUserProfile();
      if (profile) {
        // Pre-fill if we have partial data
        document.getElementById('create-team-display-name').value = profile.displayName || '';
        document.getElementById('create-team-initials').value = profile.initials || '';
      }
    } else {
      // Hide profile fields
      document.getElementById('create-team-profile-section').classList.add('hidden');
    }
    
    modal.classList.remove('hidden');
  }
  
  // Submit create team
  async function submitCreateTeam() {
    const includeProfile = !document.getElementById('create-team-profile-section').classList.contains('hidden');
    
    // Gather data
    const teamData = {
      teamName: document.getElementById('team-name').value.trim(),
      divisions: Array.from(document.querySelectorAll('input[name="divisions"]:checked'))
                     .map(cb => cb.value)
    };
    
    let profileData = null;
    if (includeProfile) {
      profileData = {
        displayName: document.getElementById('create-team-display-name').value.trim(),
        initials: document.getElementById('create-team-initials').value.trim().toUpperCase(),
        discordUsername: document.getElementById('create-team-discord').value.trim() || null
      };
    }
    
    try {
      // Create profile first if needed
      if (profileData) {
        const profileResult = await firebase.functions().httpsCallable('createProfile')(profileData);
        if (!profileResult.data.success) {
          throw new Error(profileResult.data.message);
        }
        await AuthService.refreshProfile();
      }
      
      // Create team
      const teamResult = await firebase.functions().httpsCallable('createTeam')(teamData);
      
      if (teamResult.data.success) {
        document.getElementById('create-team-modal').classList.add('hidden');
        showSuccess(`Team created! Join code: ${teamResult.data.data.joinCode}`);
        
        // Refresh the page or update UI to show new team
        await loadUserTeams();
      }
    } catch (error) {
      showError(error.message);
    }
  }
  
  // Check for post-auth actions
  function checkPostAuthActions() {
    const action = sessionStorage.getItem('postAuthAction');
    if (!action) return;
    
    sessionStorage.removeItem('postAuthAction');
    
    // Execute the stored action
    switch (action) {
      case 'createTeam':
        handleCreateTeam();
        break;
      case 'joinTeam':
        handleJoinTeam();
        break;
    }
  }
  
  return {
    handleCreateTeam,
    handleJoinTeam,
    submitCreateTeam,
    checkPostAuthActions
  };
})();
```

### 5.4 Session Management

#### 5.4.1 Persistence and Token Refresh

Firebase Auth handles session persistence automatically. Configure it during initialization:

```javascript
// In firebase initialization
firebase.auth().setPersistence(firebase.auth.Auth.Persistence.LOCAL);
// LOCAL = persist until explicit sign out
// SESSION = persist until browser closes
// NONE = no persistence
```

#### 5.4.2 Protected Function Calls

All Cloud Functions automatically receive the auth context. Example of calling a protected function:

```javascript
// Frontend code
async function updateTeamSettings(teamId, settings) {
  try {
    // Firebase automatically includes the auth token
    const result = await firebase.functions()
      .httpsCallable('updateTeamSettings')({
        teamId: teamId,
        ...settings
      });
    
    if (result.data.success) {
      // Handle success
    }
  } catch (error) {
    if (error.code === 'unauthenticated') {
      // User not logged in
      AuthHandlers.showLoginModal();
    } else if (error.code === 'permission-denied') {
      // User doesn't have permission
      showError('You do not have permission to perform this action');
    } else {
      // Other error
      showError(error.message);
    }
  }
}
```

### 5.5 Discord Integration (Phase 2)

For future Discord OAuth implementation:

#### 5.5.1 Cloud Function for Discord Auth

```javascript
// functions/src/auth/discord.js
exports.authenticateWithDiscord = functions.https.onRequest(async (req, res) => {
  // This would handle Discord OAuth flow
  // 1. Exchange Discord token for user info
  // 2. Create custom Firebase token
  // 3. Return token to frontend
  // Implementation details omitted for MVP
});
```

#### 5.5.2 Link Discord Account

For MVP, just store Discord username manually in the profile for contact purposes.

---

## 6. Frontend Architecture

### 6.1 Overview

The frontend uses vanilla JavaScript with a modular architecture similar to your existing web API version. The main differences for Firebase:
- Direct Firebase SDK calls instead of `google.script.run`
- Real-time listeners instead of polling
- Firebase Auth state management

### 6.2 File Structure

```
public/
├── index.html                    # Main HTML file
├── css/
│   └── styles.css               # Tailwind CSS output
├── js/
│   ├── config/
│   │   └── firebase.js          # Firebase initialization
│   ├── services/                # Business logic and state
│   │   ├── auth.js             # Authentication service
│   │   ├── database.js         # Firestore operations
│   │   ├── state.js            # Application state management
│   │   └── gridSelection.js    # Grid selection logic
│   ├── components/             # UI components
│   │   ├── app.js             # Main app controller
│   │   ├── userProfile.js     # User profile component
│   │   ├── weekNavigation.js  # Week navigation
│   │   ├── teamInfo.js        # Team display/management
│   │   ├── availabilityGrid.js # Grid rendering
│   │   ├── gridTools.js       # Grid action buttons
│   │   ├── favoritesList.js   # Favorites panel
│   │   └── browseTeams.js     # Browse teams panel
│   └── main.js                # Entry point
└── assets/
    └── images/
```

### 6.3 HTML Structure

**File:** `public/index.html`

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>MatchScheduler</title>
  
  <!-- Tailwind CSS -->
  <link href="/css/styles.css" rel="stylesheet">
  
  <!-- Custom styles for grid selection -->
  <style>
    /* Grid selection styles from your existing project */
    .cell-selected {
      background-color: rgba(56, 189, 248, 0.3) !important;
      border-color: rgb(56, 189, 248) !important;
      box-shadow: inset 0 0 0 1px rgb(56, 189, 248);
    }
    
    /* Prevent text selection during drag */
    .availability-cell, .time-label, .day-header-full {
      -webkit-user-select: none;
      -moz-user-select: none;
      -ms-user-select: none;
      user-select: none;
    }
  </style>
</head>
<body class="bg-slate-900 text-slate-200 flex flex-col min-h-screen">
  <!-- Navigation Bar -->
  <nav class="bg-gray-900 border-b border-gray-800">
    <div class="container mx-auto px-4 py-3 flex justify-between items-center">
      <h1 class="text-2xl font-bold text-white flex items-center">
        <svg class="w-8 h-8 mr-2 text-sky-500"><!-- Calendar icon --></svg>
        MatchScheduler
      </h1>
      
      <!-- Auth state will be dynamically inserted here -->
      <div id="auth-container"></div>
    </div>
  </nav>

  <!-- Main Content Area -->
  <main class="flex-grow w-full max-w-screen-2xl mx-auto flex flex-col p-4 gap-4">
    <!-- Top Row -->
    <div class="flex flex-row gap-4">
      <div id="grid-cell-top-left" class="w-72 flex-shrink-0 bg-slate-800/60 rounded-lg p-3">
        <!-- User profile content -->
      </div>
      <div id="grid-cell-top-center" class="flex-grow bg-slate-800/60 rounded-lg p-3">
        <!-- Week navigation -->
      </div>
      <div id="grid-cell-top-right" class="w-72 flex-shrink-0 bg-slate-800/60 rounded-lg p-3">
        <!-- Match filters -->
      </div>
    </div>

    <!-- Middle Row -->
    <div class="flex flex-row gap-4 flex-1">
      <div id="grid-cell-middle-left" class="w-72 flex-shrink-0 bg-slate-800/60 rounded-lg p-3">
        <!-- Team info -->
      </div>
      <div id="grid-cell-middle-center" class="flex-grow bg-slate-800/60 rounded-lg p-1">
        <!-- Week 1 grid -->
        <table id="availability-grid-week1" class="table-fixed w-full"></table>
      </div>
      <div id="grid-cell-middle-right" class="w-72 flex-shrink-0 bg-slate-800/60 rounded-lg p-3">
        <!-- Favorites list -->
      </div>
    </div>

    <!-- Bottom Row -->
    <div class="flex flex-row gap-4 flex-1">
      <div id="grid-cell-bottom-left" class="w-72 flex-shrink-0 bg-slate-800/60 rounded-lg p-3">
        <!-- Grid tools -->
      </div>
      <div id="grid-cell-bottom-center" class="flex-grow bg-slate-800/60 rounded-lg p-1">
        <!-- Week 2 grid -->
        <table id="availability-grid-week2" class="table-fixed w-full"></table>
      </div>
      <div id="grid-cell-bottom-right" class="w-72 flex-shrink-0 bg-slate-800/60 rounded-lg p-3">
        <!-- Browse teams -->
      </div>
    </div>
  </main>

  <!-- Modals -->
  <div id="login-modal" class="hidden fixed inset-0 bg-black bg-opacity-50 z-50">
    <!-- Login modal content -->
  </div>
  
  <div id="profile-modal" class="hidden fixed inset-0 bg-black bg-opacity-50 z-50">
    <!-- Profile edit modal -->
  </div>
  
  <div id="create-team-modal" class="hidden fixed inset-0 bg-black bg-opacity-50 z-50">
    <!-- Create team modal -->
  </div>

  <!-- Firebase SDKs -->
  <script src="https://www.gstatic.com/firebasejs/10.7.0/firebase-app-compat.js"></script>
  <script src="https://www.gstatic.com/firebasejs/10.7.0/firebase-auth-compat.js"></script>
  <script src="https://www.gstatic.com/firebasejs/10.7.0/firebase-firestore-compat.js"></script>
  <script src="https://www.gstatic.com/firebasejs/10.7.0/firebase-functions-compat.js"></script>
  
  <!-- App Scripts -->
  <script src="/js/config/firebase.js"></script>
  <script src="/js/services/auth.js"></script>
  <script src="/js/services/database.js"></script>
  <script src="/js/services/state.js"></script>
  <script src="/js/services/gridSelection.js"></script>
  <script src="/js/components/app.js"></script>
  <script src="/js/components/userProfile.js"></script>
  <script src="/js/components/weekNavigation.js"></script>
  <script src="/js/components/teamInfo.js"></script>
  <script src="/js/components/availabilityGrid.js"></script>
  <script src="/js/components/gridTools.js"></script>
  <script src="/js/components/favoritesList.js"></script>
  <script src="/js/components/browseTeams.js"></script>
  <script src="/js/main.js"></script>
</body>
</html>
```

### 6.4 Component Architecture

#### 6.4.1 Main App Controller

**File:** `public/js/components/app.js`

```javascript
const App = (function() {
  // Private state
  let _currentTeam = null;
  let _weekOffset = 0;
  let _availabilityListeners = [];
  
  // Initialize the application
  function init() {
    console.log('App: Initializing...');
    
    // Initialize services
    GridSelectionService.init();
    
    // Initialize components
    UserProfile.init('grid-cell-top-left');
    WeekNavigation.init('grid-cell-top-center');
    TeamInfo.init('grid-cell-middle-left');
    AvailabilityGrid.init('availability-grid-week1');
    AvailabilityGrid.init('availability-grid-week2');
    GridTools.init('grid-cell-bottom-left');
    FavoritesList.init('grid-cell-middle-right');
    BrowseTeams.init('grid-cell-bottom-right');
    
    // Set up auth state listener
    AuthService.onAuthStateChanged((user) => {
      if (user && AuthService.hasProfile()) {
        _loadUserData();
      } else {
        _showGuestState();
      }
    });
  }
  
  // Load user data and set up listeners
  async function _loadUserData() {
    const profile = AuthService.getUserProfile();
    if (!profile || !profile.teams || profile.teams.length === 0) {
      _showNoTeamState();
      return;
    }
    
    // Set current team
    _currentTeam = profile.teams[0];
    
    // Update components
    UserProfile.update(profile);
    TeamInfo.update(_currentTeam);
    
    // Set up real-time listeners
    _setupAvailabilityListeners();
    _loadWeekData();
  }
  
  // Set up Firestore listeners for real-time updates
  function _setupAvailabilityListeners() {
    // Clean up old listeners
    _availabilityListeners.forEach(unsubscribe => unsubscribe());
    _availabilityListeners = [];
    
    // Listen to current 4 weeks
    const weeks = _getCurrentWeeks();
    weeks.forEach(weekId => {
      const docId = `${_currentTeam}_${weekId}`;
      const unsubscribe = firebase.firestore()
        .collection('availability')
        .doc(docId)
        .onSnapshot((doc) => {
          _handleAvailabilityUpdate(weekId, doc.data());
        });
      _availabilityListeners.push(unsubscribe);
    });
  }
  
  // Handle week navigation
  function requestWeekChange(direction) {
    if (direction === 'next' && _weekOffset < 1) {
      _weekOffset++;
    } else if (direction === 'prev' && _weekOffset > 0) {
      _weekOffset--;
    }
    
    _loadWeekData();
    GridTools.updateWeekLabels();
  }
  
  // Get current team
  function getCurrentTeam() {
    return _currentTeam;
  }
  
  // Switch teams
  async function switchTeam(teamId) {
    _currentTeam = teamId;
    _setupAvailabilityListeners();
    _loadWeekData();
    TeamInfo.update(await DatabaseService.getTeam(teamId));
  }
  
  return {
    init,
    requestWeekChange,
    getCurrentTeam,
    switchTeam
  };
})();
```

#### 6.4.2 Database Service

**File:** `public/js/services/database.js`

```javascript
const DatabaseService = (function() {
  const db = firebase.firestore();
  const functions = firebase.functions();
  
  // Real-time listener management
  const listeners = new Map();
  
  // Subscribe to team updates
  function subscribeToTeam(teamId, callback) {
    const unsubscribe = db.collection('teams')
      .doc(teamId)
      .onSnapshot((doc) => {
        if (doc.exists) {
          callback({ id: doc.id, ...doc.data() });
        }
      });
    
    listeners.set(`team_${teamId}`, unsubscribe);
    return unsubscribe;
  }
  
  // Subscribe to availability updates
  function subscribeToAvailability(teamId, weekId, callback) {
    const docId = `${teamId}_${weekId}`;
    const unsubscribe = db.collection('availability')
      .doc(docId)
      .onSnapshot((doc) => {
        callback(doc.exists ? doc.data() : null);
      });
    
    listeners.set(`availability_${docId}`, unsubscribe);
    return unsubscribe;
  }
  
  // Update availability
  async function updateAvailability(teamId, weekId, action, slots) {
    try {
      const result = await functions.httpsCallable('updateAvailability')({
        teamId,
        weekId,
        action,
        slots
      });
      return result.data;
    } catch (error) {
      console.error('Update availability error:', error);
      throw error;
    }
  }
  
  // Get team data
  async function getTeam(teamId) {
    try {
      const doc = await db.collection('teams').doc(teamId).get();
      return doc.exists ? { id: doc.id, ...doc.data() } : null;
    } catch (error) {
      console.error('Get team error:', error);
      return null;
    }
  }
  
  // Browse all active teams
  async function getActiveTeams(division = null) {
    try {
      let query = db.collection('teams').where('status', '==', 'active');
      if (division) {
        query = query.where('divisions', 'array-contains', division);
      }
      
      const snapshot = await query.get();
      return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    } catch (error) {
      console.error('Get active teams error:', error);
      return [];
    }
  }
  
  // Clean up all listeners
  function cleanup() {
    listeners.forEach(unsubscribe => unsubscribe());
    listeners.clear();
  }
  
  return {
    subscribeToTeam,
    subscribeToAvailability,
    updateAvailability,
    getTeam,
    getActiveTeams,
    cleanup
  };
})();
```

#### 6.4.3 Grid Selection Service (Adapted)

**File:** `public/js/services/gridSelection.js`

```javascript
// Same as your existing GridSelectionService with minor adaptations
const GridSelectionService = (function() {
  let _selectedCells = new Set();
  let _lastClickedCell = null;
  let _selectionChangeCallbacks = [];
  
  function init() {
    console.log("GridSelectionService Initialized.");
    clear();
  }
  
  function toggleCell(row, col, gridId, isShiftPressed) {
    const cellKey = `${row},${col},${gridId}`;
    
    if (isShiftPressed && _lastClickedCell) {
      if (_lastClickedCell.gridId === gridId) {
        selectRectangle(
          _lastClickedCell.row, _lastClickedCell.col,
          row, col, gridId
        );
      } else {
        // Cross-grid toggle
        if (_selectedCells.has(cellKey)) {
          _selectedCells.delete(cellKey);
        } else {
          _selectedCells.add(cellKey);
        }
      }
    } else {
      // Regular toggle
      if (_selectedCells.has(cellKey)) {
        _selectedCells.delete(cellKey);
      } else {
        _selectedCells.add(cellKey);
      }
    }
    
    _lastClickedCell = { row, col, gridId };
    _notifySelectionChange();
    return _selectedCells.has(cellKey);
  }
  
  // ... rest of the methods remain the same ...
  
  return {
    init,
    toggleCell,
    selectRectangle,
    selectTimeRow,
    selectDayColumn,
    selectAll,
    clear,
    getSelection,
    getSelectionByGrid,
    isSelected,
    onSelectionChange
  };
})();
```

### 6.5 Real-time Updates

Firebase handles real-time updates automatically through Firestore listeners. Key differences from your polling approach:

1. **Instant Updates**: Changes appear immediately (< 100ms)
2. **Efficient**: Only changed data is transmitted
3. **Automatic Retry**: Firebase handles connection issues
4. **Offline Support**: Changes queue when offline

Example listener setup:
```javascript
// Listen to team roster changes
const unsubscribe = firebase.firestore()
  .collection('teams')
  .doc(teamId)
  .onSnapshot((doc) => {
    if (doc.exists) {
      const teamData = doc.data();
      TeamInfo.update(teamData);
    }
  });

// Clean up when switching teams or logging out
unsubscribe();
```

### 6.6 State Management

**File:** `public/js/services/state.js`

```javascript
const StateService = (function() {
  // Application state
  const state = {
    user: null,
    currentTeam: null,
    weekOffset: 0,
    favorites: [],
    filters: {
      yourTeamPlayers: 4,
      opponentPlayers: 4,
      selectedOpponents: []
    }
  };
  
  // State change listeners
  const listeners = new Map();
  
  // Update state and notify listeners
  function setState(key, value) {
    state[key] = value;
    _notifyListeners(key, value);
  }
  
  // Get state value
  function getState(key) {
    return state[key];
  }
  
  // Subscribe to state changes
  function subscribe(key, callback) {
    if (!listeners.has(key)) {
      listeners.set(key, []);
    }
    listeners.get(key).push(callback);
  }
  
  // Notify listeners
  function _notifyListeners(key, value) {
    if (listeners.has(key)) {
      listeners.get(key).forEach(callback => callback(value));
    }
  }
  
  return {
    setState,
    getState,
    subscribe
  };
})();
```

### 6.7 Component Communication

Components communicate through:

1. **Direct method calls**: App controller orchestrates
2. **State service**: Shared state with subscriptions
3. **Custom events**: For decoupled communication
4. **Firebase listeners**: Real-time data updates

Example flow:
```javascript
// User clicks "Add Me" button
GridTools.onAddMeClick()
  → Gets selection from GridSelectionService
  → Calls DatabaseService.updateAvailability()
  → Firebase updates trigger listeners
  → AvailabilityGrid automatically re-renders
```

### 6.8 Error Handling

Consistent error handling across all components:

```javascript
// Wrap Firebase calls
try {
  const result = await firebase.functions()
    .httpsCallable('functionName')(data);
  
  if (result.data.success) {
    // Handle success
  } else {
    showError(result.data.message);
  }
} catch (error) {
  if (error.code === 'unauthenticated') {
    // Redirect to login
  } else {
    showError('An unexpected error occurred');
  }
}
```

### 6.9 Performance Optimizations

1. **Debounce rapid updates**: Prevent spam
2. **Batch Firestore writes**: Use transactions
3. **Lazy load components**: Load as needed
4. **Cache static data**: Teams, divisions
5. **Optimize listeners**: Only subscribe to visible weeks

---

## 7. Core Features Implementation Order

### 7.1 Implementation Philosophy

**Backend-First Approach**: Build and test all backend infrastructure before creating the UI. This approach works well because:
- The features are already proven from previous implementations
- Complete PRD eliminates feature uncertainty
- Test suite can validate all backend logic
- Cleaner separation allows AI to focus on one layer at a time
- Firebase backend patterns can be perfected without UI distractions

### 7.2 Phase 1: Backend Infrastructure (Days 1-10)

#### Step 1.1: Project Setup & Configuration (Day 1)
**Tasks:**
```bash
# Initialize Firebase project
firebase init
# Select: Firestore, Functions, Hosting, Emulators

# Set up project structure as defined in Section 1.2
mkdir -p functions/src/{auth,teams,availability,scheduled}
mkdir -p public/{css,js/{config,services,components},assets/images}

# Install dependencies
cd functions && npm install
cd .. && npm install
```

**Deploy Firebase configuration:**
- Enable Google Authentication in Firebase Console
- Set up Firestore with production rules (temporarily open for testing)
- Configure Functions region (us-central1)
- Initialize local emulators for testing

**Success Criteria:**
- Local emulators run without errors
- Can deploy empty function to Firebase
- Firestore rules deploy successfully

#### Step 1.2: Core Cloud Functions - Authentication & Profiles (Day 2)
**Implement these functions from Section 4:**

1. `createProfile`
   - Validation for displayName (2-20 chars) and initials (3 chars)
   - Check for existing profile
   - Set default fields

2. `updateProfile`
   - Validation rules
   - Update team rosters in transaction
   - Check initial conflicts within teams

**Test Implementation:**
```javascript
// functions/test/auth.test.js
describe('Profile Functions', () => {
  it('should create profile with valid data', async () => {
    const result = await createProfile({
      displayName: 'Test User',
      initials: 'TST'
    }, { auth: { uid: 'test123' } });
    
    assert(result.success === true);
    assert(result.data.displayName === 'Test User');
  });
  
  it('should reject invalid initials', async () => {
    // Test validation
  });
});
```

**Success Criteria:**
- All profile functions pass tests
- Validation works correctly
- Transactions prevent race conditions

#### Step 1.3: Team Management Functions (Days 3-4)
**Implement all team-related functions:**

1. `createTeam`
   - Generate unique join codes
   - Validate team names
   - Set up initial roster
   - Handle divisions array

2. `joinTeam`
   - Validate join code
   - Check team capacity
   - Add to roster transaction

3. `leaveTeam`
   - Remove from roster
   - Archive if last member
   - Prevent leader leaving

4. `removePlayer`
5. `updateTeamSettings`
6. `regenerateJoinCode`
7. `transferLeadership`

**Test Suite:**
```javascript
// functions/test/teams.test.js
describe('Team Functions', () => {
  beforeEach(async () => {
    // Seed test database with users and teams
    await seedTestData();
  });
  
  it('should create team with valid join code', async () => {
    // Test team creation
  });
  
  it('should prevent joining full teams', async () => {
    // Test capacity limits
  });
  
  // ... comprehensive tests for each function
});
```

**Success Criteria:**
- All team functions pass tests
- Join codes are unique (test 1000 generations)
- Transactions handle concurrent operations
- Edge cases handled (last member, leader transfer)

#### Step 1.4: Availability Functions (Days 5-6)
**Implement availability management:**

1. `updateAvailability`
   - Array union/remove operations
   - Week validation (current + 3 future)
   - Update lastActivityAt
   - Create availability docs on demand

**Complex Test Cases:**
```javascript
describe('Availability Functions', () => {
  it('should handle concurrent updates without conflicts', async () => {
    // Simulate two users updating same time slot
    const promises = [
      updateAvailability(/* user1 data */),
      updateAvailability(/* user2 data */)
    ];
    
    const results = await Promise.all(promises);
    // Verify both updates succeeded
  });
  
  it('should aggregate team availability correctly', async () => {
    // Test the aggregation logic
  });
});
```

**Success Criteria:**
- Concurrent updates don't overwrite each other
- Firestore arrayUnion prevents duplicates
- Week validation prevents past/far future updates

#### Step 1.5: Scheduled Functions & Security Rules (Days 7-8)
**Implement maintenance functions:**

1. `checkTeamActivity`
   - Mark inactive teams (14 days)
   - Regenerate old join codes (30 days)
   - Run efficiently with batch operations

**Deploy Production Security Rules:**
```javascript
// Deploy the rules from Section 3
firebase deploy --only firestore:rules

// Test security rules
describe('Security Rules', () => {
  it('should allow users to update own profile', async () => {
    // Test with Firebase rules emulator
  });
  
  it('should prevent non-leaders from team settings', async () => {
    // Verify permission denied
  });
});
```

**Success Criteria:**
- Scheduled function runs in < 10 seconds
- Security rules prevent all unauthorized access
- Rules allow all legitimate operations

#### Step 1.6: Comprehensive Test Suite (Days 9-10)
**Create full integration tests:**

```javascript
// functions/test/integration.test.js
describe('Full User Journey', () => {
  it('should complete new user flow', async () => {
    // 1. Create profile
    // 2. Create team
    // 3. Set availability
    // 4. Verify aggregation
  });
  
  it('should handle team member lifecycle', async () => {
    // 1. User joins team
    // 2. Updates availability
    // 3. Gets kicked
    // 4. Verify cleanup
  });
});
```

**Database Seeding Script:**
```javascript
// functions/test/seed.js
async function seedDatabase() {
  // Create 20 test users
  // Create 5 test teams
  // Add users to teams
  // Generate random availability
  // Create old teams for inactivity testing
}
```

**Success Criteria:**
- 100% backend test coverage
- All integration tests pass
- Can reset and seed database in < 30 seconds
- Performance benchmarks met (all operations < 1 second)

### 7.3 Phase 2: Frontend Foundation (Days 11-12)

#### Step 2.1: Project Shell & Layout (Day 11)
**Create the basic structure:**

1. **Set up build tools:**
   ```bash
   # Install Tailwind CSS
   npm install -D tailwindcss
   npx tailwindcss init
   
   # Configure Tailwind
   # Add build script to package.json
   ```

2. **Create index.html with 9-panel layout:**
   - Copy structure from Section 6.3
   - Add all panel divs with correct IDs
   - Include Firebase SDK scripts
   - Add modal containers

3. **Initialize Firebase:**
   ```javascript
   // public/js/config/firebase.js
   const firebaseConfig = {
     // Your config
   };
   firebase.initializeApp(firebaseConfig);
   ```

**Success Criteria:**
- Page loads without errors
- All 9 panels visible (empty)
- Firebase initializes successfully
- Tailwind styles apply correctly

#### Step 2.2: Core Services & Component Structure (Day 12)
**Set up the frontend architecture:**

1. **Create all service files:**
   - AuthService (from Section 5.2)
   - DatabaseService (from Section 6.4.2)
   - StateService
   - GridSelectionService

2. **Create component stubs:**
   ```javascript
   // Each component gets minimal structure
   const ComponentName = (function() {
     function init(panelId) {
       console.log(`${ComponentName} initialized`);
     }
     return { init };
   })();
   ```

3. **Wire up App.js:**
   - Initialize all services
   - Initialize all components
   - Set up auth state listener

**Success Criteria:**
- All components initialize without errors
- Auth state changes detected
- Console shows initialization messages
- Service structure ready for implementation

### 7.4 Phase 3: Progressive Frontend Implementation (Days 13-20)

#### Step 3.1: Authentication UI (Day 13)
**Panel:** Navigation bar + User Profile (top-left)

**Implementation:**
1. Google Sign-in button in navbar
2. User menu dropdown when authenticated
3. Profile modal for creation/editing
4. Wire up to existing backend functions

**Success Criteria:**
- Can sign in/out with Google
- Profile creation modal works
- Profile data saves to Firestore
- User info displays in top-left panel

#### Step 3.2: Team Management UI (Day 14)
**Panel:** Team Info (middle-left)

**Implementation:**
1. Team display with logo and roster
2. Team switcher buttons (if multiple teams)
3. Team management drawer (PRD Section 2.4)
4. Create/Join team modals

**Key PRD Features:**
- Drawer slides up from bottom
- Different sections for leader vs member
- Logo upload functionality
- Confirmation modals for actions

**Success Criteria:**
- Can create/join teams
- Team switcher works
- Management drawer animates correctly
- All team functions accessible

#### Step 3.3: Availability Grid Core (Days 15-16)
**Panels:** Week Navigation (top-center) + Both Grid Panels (middle/bottom-center)

**Implementation:**
1. Week navigation with date ranges
2. Grid rendering with time slots
3. Port GridSelectionService fully
4. Real-time listener setup

**Key PRD Features:**
- 4-week window (current + 3)
- Navigate in bi-weekly blocks
- Time slots 18:00-23:00
- Current day highlighted

**Success Criteria:**
- Grids render correctly
- Week navigation limited properly
- Selection methods work
- Real-time updates display

#### Step 3.4: Grid Interaction Tools (Day 17)
**Panel:** Grid Tools (bottom-left)

**Implementation:**
1. Selection action buttons
2. Add Me / Remove Me functionality
3. Template save/load
4. Wire to backend availability updates

**Success Criteria:**
- Updates save to database
- Templates work correctly
- Optimistic updates show immediately
- Other users see changes

#### Step 3.5: Team Discovery (Day 18)
**Panels:** Browse Teams (bottom-right) + Favorites (middle-right)

**Implementation:**
1. Browse all teams with division filter
2. Favorite/unfavorite functionality
3. Empty slots in favorites panel
4. Team selection for comparison

**Success Criteria:**
- Can browse all active teams
- Division filter works
- Favorites persist
- Multi-select works

#### Step 3.6: Comparison View (Day 19)
**Panel:** Match Filters (top-right) + Grid Enhancement

**Implementation:**
1. Player count filters
2. Comparison mode toggle
3. Grid highlighting for matches
4. Match detail popups

**Key PRD Features:**
- Shows your team + highlights
- Click for match details
- Real-time comparison updates

**Success Criteria:**
- Comparison mode works
- Filters apply correctly
- Match details show on click
- Performance acceptable with 5+ teams

#### Step 3.7: Polish & Error Handling (Day 20)
**All Panels:**

1. Loading states during operations
2. Error modal for user-friendly messages
3. Offline handling
4. Animation polish
5. Responsive design fixes

**Success Criteria:**
- No console errors in normal use
- All errors show friendly messages
- Graceful offline behavior
- Smooth animations

### 7.5 Phase 4: Testing & Deployment (Days 21-22)

#### Step 4.1: Integration Testing (Day 21)
**Full system testing:**

1. Complete user journeys
2. Multi-user scenarios
3. Performance testing
4. Security verification
5. Browser compatibility

**Test Scenarios:**
- New user complete flow
- Team creation and management
- Multi-team user workflows
- Real-time update verification
- Offline/online transitions

**Success Criteria:**
- All user journeys work
- No security vulnerabilities
- Performance < 2s for all operations
- Works in Chrome/Firefox/Safari

#### Step 4.2: Production Deployment (Day 22)
**Deploy to production:**

1. Set production environment variables
2. Deploy security rules
3. Deploy Cloud Functions
4. Deploy hosting
5. Verify scheduled functions
6. Monitor for errors

**Post-Deployment:**
- Test with real accounts
- Monitor Firebase console
- Check function logs
- Verify scheduled tasks run

### 7.6 Backend-First Benefits

This approach provides several advantages for your project:

1. **Clean Architecture**: Backend isn't influenced by UI needs
2. **Comprehensive Testing**: Full test suite before any UI
3. **AI-Friendly**: Clear separation of concerns for Cursor
4. **Confidence**: Know the backend works before building UI
5. **Efficient Debugging**: Issues are either backend OR frontend

The proven frontend patterns from your previous implementations can be applied confidently to a fully-tested backend.

---

## 8. UI Components Specification

### 8.1 Component HTML Templates

Each component follows the same visual design from your existing project but adapted for Firebase. These templates provide the exact HTML structure for Cursor to implement.

#### 8.1.1 Navigation Bar
```html
<nav class="bg-gray-900 border-b border-gray-800">
  <div class="container mx-auto px-4 py-3 flex justify-between items-center">
    <h1 class="text-2xl font-bold text-white flex items-center">
      <svg xmlns="http://www.w3.org/2000/svg" width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-calendar-check-2 mr-3 text-sky-500">
        <path d="M8 2v4"/><path d="M16 2v4"/><path d="M21 13V6a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h8"/><path d="M3 10h18"/><path d="m16 20 2 2 4-4"/>
      </svg>
      MatchScheduler
    </h1>
    
    <!-- Guest state -->
    <button id="auth-button" class="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg">
      Login / Sign Up
    </button>
    
    <!-- Authenticated state (hidden initially) -->
    <div id="user-info" class="flex items-center gap-3 hidden">
      <span id="profile-status" class="text-yellow-500 text-sm"></span>
      <button id="user-menu-button" class="flex items-center gap-2 hover:bg-gray-800 px-3 py-2 rounded-lg">
        <img id="user-avatar" src="" alt="" class="w-8 h-8 rounded-full">
        <span id="user-display-name" class="text-white"></span>
        <svg class="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"/>
        </svg>
      </button>
      
      <!-- Dropdown menu -->
      <div id="profile-dropdown" class="hidden absolute right-4 top-14 bg-gray-800 rounded-lg shadow-lg z-50">
        <a href="#" id="edit-profile-link" class="block px-4 py-2 hover:bg-gray-700 text-white">
          Edit Profile
        </a>
        <hr class="border-gray-700">
        <a href="#" id="sign-out-link" class="block px-4 py-2 hover:bg-gray-700 text-white">
          Sign Out
        </a>
      </div>
    </div>
  </div>
</nav>
```

#### 8.1.2 Team Info Panel (Middle-Left)
```html
<div id="grid-cell-middle-left" class="w-72 flex-shrink-0 bg-slate-800/60 rounded-lg shadow border border-slate-700 p-3 flex flex-col gap-3 team-panel relative overflow-hidden">
  
  <!-- Team Selector (for multi-team users) -->
  <div id="team-selector-container" class="flex space-x-1 z-10">
    <!-- Buttons dynamically inserted here -->
  </div>
  
  <!-- Team Logo -->
  <div id="team-logo-container" class="my-1">
    <img id="team-logo" src="/assets/images/default-team-logo.png" alt="Team Logo" class="w-full h-auto rounded border border-slate-700 shadow-md">
  </div>
  
  <!-- Team Roster -->
  <div id="team-roster-container" class="space-y-1 text-sm flex-grow">
    <!-- Roster dynamically inserted here -->
  </div>
  
  <!-- Team Management Drawer -->
  <div id="team-management-drawer" class="absolute left-0 right-0 bottom-0 top-14 bg-slate-800 border border-slate-700 rounded-t-lg transform translate-y-[calc(100%-40px)] transition-transform duration-300 ease-out z-30 overflow-hidden">
    
    <!-- Drawer Header (Always Visible) -->
    <button id="team-management-toggle" class="w-full h-10 bg-slate-700/50 hover:bg-slate-700 text-slate-300 hover:text-sky-300 flex items-center justify-between px-3 border-b border-slate-600">
      <span class="text-sm font-medium">Team Management</span>
      <svg id="team-management-arrow" xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="transition-transform duration-300">
        <path d="m18 15-6-6-6 6"/>
      </svg>
    </button>
    
    <!-- Drawer Content -->
    <div class="p-4 space-y-4 overflow-y-auto" style="height: calc(100% - 40px);">
      <!-- Content sections dynamically shown/hidden based on role -->
    </div>
  </div>
</div>
```

#### 8.1.3 Availability Grid
```html
<table id="availability-grid-week1" class="table-fixed min-w-full w-full border-separate" style="border-spacing: 0.1rem;">
  <thead>
    <tr>
      <th class="time-label p-1 w-16 sm:w-20 text-xs font-medium text-slate-400 text-center sticky left-0 bg-slate-800 z-10">Time</th>
      <th class="day-header-full p-1 text-xs font-medium text-sky-400 text-center bg-slate-700/50 rounded-t-sm cursor-pointer">Mon 16th</th>
      <th class="day-header-full p-1 text-xs font-medium text-sky-400 text-center bg-slate-700/50 rounded-t-sm cursor-pointer">Tue 17th</th>
      <th class="day-header-full p-1 text-xs font-medium text-sky-400 text-center bg-slate-700/50 rounded-t-sm cursor-pointer">Wed 18th</th>
      <th class="day-header-full p-1 text-xs font-medium text-sky-400 text-center bg-slate-700/50 rounded-t-sm cursor-pointer">Thu 19th</th>
      <th class="day-header-full p-1 text-xs font-medium text-sky-400 text-center bg-slate-700/50 rounded-t-sm cursor-pointer">Fri 20th</th>
      <th class="day-header-full p-1 text-xs font-medium text-amber-400 text-center bg-slate-700/50 rounded-t-sm cursor-pointer">Sat 21st</th>
      <th class="day-header-full p-1 text-xs font-medium text-amber-400 text-center bg-slate-700/50 rounded-t-sm cursor-pointer">Sun 22nd</th>
    </tr>
  </thead>
  <tbody id="availability-grid-body-week1">
    <!-- Rows dynamically generated -->
  </tbody>
</table>
```

#### 8.1.4 Grid Selection Panel (Bottom-Left)
```html
<div id="grid-cell-bottom-left" class="w-72 flex-shrink-0 bg-slate-800/60 rounded-lg shadow border border-slate-700 p-3 flex flex-col gap-3">
  
  <!-- Section 1: Grid Selection Actions -->
  <div>
    <h3 class="text-base font-semibold text-slate-200 mb-2">Grid Selection</h3>
    <div class="flex items-center space-x-1">
      <button id="btn-select-all" class="text-sm bg-slate-600 hover:bg-slate-500 text-white font-semibold py-2 px-3 rounded shadow flex-1 h-10">All</button>
      <button id="btn-clear-selection" class="text-sm bg-slate-600 hover:bg-slate-500 text-white font-semibold py-2 px-3 rounded shadow flex-1 h-10">Clear</button>
    </div>
    <div class="flex items-center space-x-1 mt-1">
      <button id="btn-add-me" class="text-sm bg-green-600 hover:bg-green-700 text-white font-semibold py-2 px-3 rounded shadow flex-1 h-10 disabled:opacity-50 disabled:cursor-not-allowed">Add Me</button>
      <button id="btn-remove-me" class="text-sm bg-red-600 hover:bg-red-700 text-white font-semibold py-2 px-3 rounded shadow flex-1 h-10 disabled:opacity-50 disabled:cursor-not-allowed">Remove Me</button>
    </div>
  </div>
  
  <!-- Section 2: Save Template -->
  <div class="border-t border-slate-700 pt-3">
    <h4 class="text-sm font-semibold text-slate-300 mb-2">Save Template</h4>
    <button id="btn-save-template" class="w-full text-xs bg-slate-600 hover:bg-slate-500 text-slate-200 py-2 px-3 rounded h-9">
      Save Current Selection as Template
    </button>
    <div id="save-template-status" class="text-xs text-green-400 mt-1 h-4"></div>
  </div>
  
  <!-- Section 3: Load Template -->
  <div class="border-t border-slate-700 pt-3">
    <h4 class="text-sm font-semibold text-slate-300 mb-2">Load Template</h4>
    <div class="space-y-1">
      <button id="btn-load-template-week1" class="w-full text-xs bg-slate-600 hover:bg-slate-500 text-slate-200 py-2 px-3 rounded h-9">
        Load to Week 1
      </button>
      <button id="btn-load-template-week2" class="w-full text-xs bg-slate-600 hover:bg-slate-500 text-slate-200 py-2 px-3 rounded h-9">
        Load to Week 2
      </button>
      <button id="btn-load-template-both" class="w-full text-xs bg-sky-600 hover:bg-sky-700 text-white py-2 px-3 rounded h-9">
        Load to Both Weeks
      </button>
    </div>
    <div id="load-template-status" class="text-xs text-sky-400 mt-1 h-4"></div>
  </div>
</div>
```

### 8.2 Modal Templates

#### 8.2.1 Login Modal
```html
<div id="login-modal" class="fixed inset-0 bg-black bg-opacity-50 hidden z-50 flex items-center justify-center p-4">
  <div class="bg-slate-800 rounded-lg shadow-xl max-w-md w-full p-6">
    <h2 class="text-2xl font-bold text-sky-400 mb-4">Welcome to MatchScheduler</h2>
    <p class="text-slate-300 mb-6">Sign in to manage your team's availability and find match times.</p>
    
    <button id="google-sign-in-btn" class="w-full bg-white hover:bg-gray-100 text-gray-800 font-semibold py-3 px-4 rounded-lg flex items-center justify-center gap-3 transition-colors">
      <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" alt="Google" class="w-5 h-5">
      Sign in with Google
    </button>
    
    <button id="close-login-modal" class="mt-4 text-slate-400 hover:text-slate-200 text-sm">
      Cancel
    </button>
  </div>
</div>
```

#### 8.2.2 Profile Modal
```html
<div id="profile-modal" class="fixed inset-0 bg-black bg-opacity-50 hidden z-50 flex items-center justify-center p-4">
  <div class="bg-slate-800 rounded-lg shadow-xl max-w-md w-full p-6">
    <h2 id="profile-modal-title" class="text-2xl font-bold text-sky-400 mb-4">Create Your Profile</h2>
    
    <form id="profile-form">
      <div class="space-y-4">
        <div>
          <label for="profile-display-name" class="block text-sm font-medium text-slate-300 mb-1">
            Display Name
          </label>
          <input type="text" id="profile-display-name" name="displayName" 
                 class="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-md text-white focus:ring-sky-500 focus:border-sky-500"
                 required minlength="2" maxlength="20">
          <p class="text-xs text-slate-500 mt-1">2-20 characters</p>
        </div>
        
        <div>
          <label for="profile-initials" class="block text-sm font-medium text-slate-300 mb-1">
            Initials
          </label>
          <input type="text" id="profile-initials" name="initials" 
                 class="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-md text-white uppercase font-mono focus:ring-sky-500 focus:border-sky-500"
                 required minlength="3" maxlength="3" pattern="[A-Z0-9]{3}">
          <p class="text-xs text-slate-500 mt-1">Exactly 3 characters (letters/numbers)</p>
        </div>
        
        <div>
          <label for="profile-discord" class="block text-sm font-medium text-slate-300 mb-1">
            Discord Username <span class="text-slate-500">(optional)</span>
          </label>
          <input type="text" id="profile-discord" name="discordUsername" 
                 class="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-md text-white focus:ring-sky-500 focus:border-sky-500"
                 placeholder="username#1234">
        </div>
      </div>
      
      <div id="profile-error" class="mt-4 text-red-400 text-sm hidden"></div>
      
      <div class="mt-6 flex gap-3">
        <button type="submit" class="flex-1 bg-sky-600 hover:bg-sky-700 text-white font-semibold py-2 px-4 rounded-md transition-colors">
          Save Profile
        </button>
        <button type="button" id="cancel-profile-btn" class="flex-1 bg-slate-600 hover:bg-slate-700 text-white font-semibold py-2 px-4 rounded-md transition-colors">
          Cancel
        </button>
      </div>
    </form>
  </div>
</div>
```

#### 8.2.3 Create/Join Team Modal
```html
<div id="team-modal" class="fixed inset-0 bg-black bg-opacity-50 hidden z-50 flex items-center justify-center p-4">
  <div class="bg-slate-800 rounded-lg shadow-xl max-w-md w-full p-6">
    <h2 id="team-modal-title" class="text-2xl font-bold text-sky-400 mb-4">Create Team</h2>
    
    <form id="team-form">
      <!-- Profile fields (shown if user has no profile) -->
      <div id="team-profile-section" class="space-y-4 mb-4 pb-4 border-b border-slate-700 hidden">
        <h3 class="text-lg font-semibold text-slate-300">First, create your profile</h3>
        <!-- Same fields as profile modal -->
      </div>
      
      <!-- Team fields -->
      <div class="space-y-4">
        <!-- For Create Team -->
        <div id="team-name-field" class="hidden">
          <label for="team-name" class="block text-sm font-medium text-slate-300 mb-1">
            Team Name
          </label>
          <input type="text" id="team-name" name="teamName" 
                 class="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-md text-white focus:ring-sky-500 focus:border-sky-500"
                 minlength="3" maxlength="25">
        </div>
        
        <!-- For Join Team -->
        <div id="join-code-field" class="hidden">
          <label for="join-code" class="block text-sm font-medium text-slate-300 mb-1">
            Join Code
          </label>
          <input type="text" id="join-code" name="joinCode" 
                 class="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-md text-white uppercase font-mono text-center text-lg focus:ring-sky-500 focus:border-sky-500"
                 minlength="6" maxlength="6" pattern="[A-Z0-9]{6}">
        </div>
        
        <!-- Division selection (for Create Team) -->
        <div id="division-field" class="hidden">
          <label class="block text-sm font-medium text-slate-300 mb-2">
            Division(s)
          </label>
          <div class="space-y-2">
            <label class="flex items-center">
              <input type="checkbox" name="divisions" value="1" class="mr-2 text-sky-600 focus:ring-sky-500">
              <span class="text-slate-200">Division 1</span>
            </label>
            <label class="flex items-center">
              <input type="checkbox" name="divisions" value="2" class="mr-2 text-sky-600 focus:ring-sky-500">
              <span class="text-slate-200">Division 2</span>
            </label>
            <label class="flex items-center">
              <input type="checkbox" name="divisions" value="3" class="mr-2 text-sky-600 focus:ring-sky-500">
              <span class="text-slate-200">Division 3</span>
            </label>
          </div>
        </div>
      </div>
      
      <div id="team-error" class="mt-4 text-red-400 text-sm hidden"></div>
      
      <div class="mt-6 flex gap-3">
        <button type="submit" id="team-submit-btn" class="flex-1 bg-sky-600 hover:bg-sky-700 text-white font-semibold py-2 px-4 rounded-md transition-colors">
          Create Team
        </button>
        <button type="button" id="cancel-team-btn" class="flex-1 bg-slate-600 hover:bg-slate-700 text-white font-semibold py-2 px-4 rounded-md transition-colors">
          Cancel
        </button>
      </div>
    </form>
  </div>
</div>
```

### 8.3 Component JavaScript Patterns

#### 8.3.1 Modal Controller Pattern
```javascript
const ModalController = (function() {
  let _activeModal = null;
  
  function show(modalId) {
    hide(); // Close any open modal
    const modal = document.getElementById(modalId);
    if (modal) {
      modal.classList.remove('hidden');
      _activeModal = modal;
      document.body.style.overflow = 'hidden'; // Prevent scroll
    }
  }
  
  function hide() {
    if (_activeModal) {
      _activeModal.classList.add('hidden');
      _activeModal = null;
      document.body.style.overflow = ''; // Restore scroll
    }
  }
  
  // Close on escape key
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') hide();
  });
  
  // Close on background click
  document.addEventListener('click', (e) => {
    if (_activeModal && e.target === _activeModal) hide();
  });
  
  return { show, hide };
})();
```

#### 8.3.2 Loading State Pattern
```javascript
const LoadingState = (function() {
  function setLoading(button, isLoading) {
    if (isLoading) {
      button.disabled = true;
      button.dataset.originalText = button.textContent;
      button.innerHTML = `
        <svg class="animate-spin h-4 w-4 mr-2 inline" fill="none" viewBox="0 0 24 24">
          <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
          <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
        </svg>
        Loading...
      `;
    } else {
      button.disabled = false;
      button.textContent = button.dataset.originalText || 'Submit';
    }
  }
  
  return { setLoading };
})();
```

### 8.4 Responsive Design Breakpoints

The UI uses Tailwind's responsive prefixes:
- **Mobile**: Default (< 640px)
- **Tablet**: `sm:` (640px+)
- **Desktop**: `lg:` (1024px+)

Key responsive behaviors:
- **Mobile**: Panels stack vertically, grids scroll horizontally
- **Tablet**: 2-column layout, reduced padding
- **Desktop**: Full 3-column layout as shown

### 8.5 Animation Specifications

#### 8.5.1 Drawer Animation
```css
/* Team Management Drawer */
.drawer-closed {
  transform: translateY(calc(100% - 40px));
}

.drawer-open {
  transform: translateY(0);
}

/* Transition */
transition: transform 300ms cubic-bezier(0.4, 0, 0.2, 1);
```

#### 8.5.2 Loading Spinner
```css
@keyframes spin {
  to { transform: rotate(360deg); }
}

.animate-spin {
  animation: spin 1s linear infinite;
}
```

#### 8.5.3 Selection Highlight
```css
.cell-selected {
  animation: pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite;
}

@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: .8; }
}
```

### 8.6 Color Palette

Using Tailwind's Slate/Sky/Amber palette:
- **Background**: `slate-900` (main), `slate-800` (panels)
- **Borders**: `slate-700`
- **Text**: `slate-200` (primary), `slate-400` (secondary)
- **Accent**: `sky-500` (primary), `sky-400` (hover)
- **Weekend**: `amber-400`
- **Success**: `green-400`
- **Error**: `red-400`

### 8.7 Icon Library

Using Lucide icons (inline SVG):
```html
<!-- Calendar icon -->
<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-calendar">
  <rect width="18" height="14" x="3" y="4" rx="2" ry="2"/>
  <line x1="16" x2="16" y1="2" y2="6"/>
  <line x1="8" x2="8" y1="2" y2="6"/>
  <line x1="3" x2="21" y1="10" y2="10"/>
</svg>

<!-- Star icon (for leader) -->
<svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
  <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2Z"/>
</svg>

<!-- User icon -->
<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-user">
  <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/>
  <circle cx="12" cy="7" r="4"/>
</svg>
```

---

## 9. Error Handling & Edge Cases

### 9.1 Error Types & User Messages

#### 9.1.1 Authentication Errors
```javascript
const AUTH_ERRORS = {
  'auth/popup-closed-by-user': 'Sign in cancelled',
  'auth/network-request-failed': 'Network error. Please check your connection',
  'auth/too-many-requests': 'Too many attempts. Please try again later',
  'auth/user-disabled': 'This account has been disabled',
  'default': 'Sign in failed. Please try again'
};
```

#### 9.1.2 Function Call Errors
```javascript
const FUNCTION_ERRORS = {
  'unauthenticated': 'Please sign in to continue',
  'permission-denied': 'You don\'t have permission to do that',
  'not-found': 'The requested item was not found',
  'already-exists': 'This already exists',
  'failed-precondition': 'Unable to complete action',
  'resource-exhausted': 'Too many requests. Please slow down',
  'internal': 'Something went wrong. Please try again',
  'unavailable': 'Service temporarily unavailable',
  'deadline-exceeded': 'Request timed out. Please try again'
};
```

### 9.2 Error Display Component

```javascript
const ErrorDisplay = (function() {
  let _errorTimeout;
  
  function show(message, duration = 5000) {
    // Clear any existing error
    hide();
    
    // Create error element
    const errorEl = document.createElement('div');
    errorEl.id = 'global-error';
    errorEl.className = 'fixed top-4 right-4 bg-red-900 border border-red-700 text-red-200 px-4 py-3 rounded-lg shadow-lg z-50 max-w-md';
    errorEl.innerHTML = `
      <div class="flex items-start">
        <svg class="w-5 h-5 mr-2 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
        </svg>
        <div class="flex-1">
          <p class="font-semibold">Error</p>
          <p class="text-sm mt-1">${message}</p>
        </div>
        <button onclick="ErrorDisplay.hide()" class="ml-4 text-red-400 hover:text-red-200">
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
          </svg>
        </button>
      </div>
    `;
    
    document.body.appendChild(errorEl);
    
    // Auto-hide after duration
    _errorTimeout = setTimeout(() => hide(), duration);
  }
  
  function hide() {
    clearTimeout(_errorTimeout);
    const errorEl = document.getElementById('global-error');
    if (errorEl) errorEl.remove();
  }
  
  return { show, hide };
})();
```

### 9.3 Edge Case Handlers

#### 9.3.1 Offline Detection
```javascript
const OfflineHandler = (function() {
  let _isOffline = !navigator.onLine;
  let _offlineBanner;
  
  function init() {
    window.addEventListener('online', () => {
      _isOffline = false;
      _hideBanner();
    });
    
    window.addEventListener('offline', () => {
      _isOffline = true;
      _showBanner();
    });
    
    // Check initial state
    if (_isOffline) _showBanner();
  }
  
  function _showBanner() {
    if (_offlineBanner) return;
    
    _offlineBanner = document.createElement('div');
    _offlineBanner.className = 'fixed top-0 left-0 right-0 bg-yellow-900 text-yellow-200 px-4 py-2 text-center z-50';
    _offlineBanner.textContent = 'You are offline. Changes will sync when connection is restored.';
    document.body.appendChild(_offlineBanner);
  }
  
  function _hideBanner() {
    if (_offlineBanner) {
      _offlineBanner.remove();
      _offlineBanner = null;
    }
  }
  
  function isOffline() {
    return _isOffline;
  }
  
  return { init, isOffline };
})();
```

#### 9.3.2 Session Timeout Handler
```javascript
const SessionHandler = (function() {
  let _warningTimeout;
  let _logoutTimeout;
  const WARNING_TIME = 25 * 60 * 1000; // 25 minutes
  const LOGOUT_TIME = 30 * 60 * 1000;  // 30 minutes
  
  function resetTimers() {
    clearTimeout(_warningTimeout);
    clearTimeout(_logoutTimeout);
    
    _warningTimeout = setTimeout(_showWarning, WARNING_TIME);
    _logoutTimeout = setTimeout(_forceLogout, LOGOUT_TIME);
  }
  
  function _showWarning() {
    if (confirm('Your session will expire in 5 minutes. Stay logged in?')) {
      resetTimers();
      // Refresh auth token
      firebase.auth().currentUser.getIdToken(true);
    }
  }
  
  function _forceLogout() {
    firebase.auth().signOut();
    alert('Session expired. Please sign in again.');
  }
  
  function init() {
    // Reset timers on user activity
    ['mousedown', 'keydown', 'scroll', 'touchstart'].forEach(event => {
      document.addEventListener(event, resetTimers, true);
    });
    
    resetTimers();
  }
  
  return { init };
})();
```

### 9.4 Data Validation Patterns

#### 9.4.1 Input Sanitization
```javascript
const Validator = {
  sanitizeString(input, maxLength = 50) {
    return input
      .trim()
      .substring(0, maxLength)
      .replace(/[<>]/g, ''); // Basic XSS prevention
  },
  
  validateInitials(initials) {
    return /^[A-Z0-9]{3}$/.test(initials.toUpperCase());
  },
  
  validateTeamName(name) {
    return name.length >= 3 && 
           name.length <= 25 && 
           /^[a-zA-Z0-9\s\-_]+$/.test(name);
  },
  
  validateJoinCode(code) {
    return /^[A-Z0-9]{6}$/.test(code.toUpperCase());
  }
};
```

#### 9.4.2 Optimistic Update Rollback
```javascript
const OptimisticUpdate = {
  apply(element, newValue, oldValue) {
    element.textContent = newValue;
    element.dataset.oldValue = oldValue;
    element.classList.add('optimistic-update');
  },
  
  commit(element) {
    delete element.dataset.oldValue;
    element.classList.remove('optimistic-update');
  },
  
  rollback(element) {
    if (element.dataset.oldValue !== undefined) {
      element.textContent = element.dataset.oldValue;
      delete element.dataset.oldValue;
      element.classList.remove('optimistic-update');
      
      // Flash error state
      element.classList.add('update-failed');
      setTimeout(() => element.classList.remove('update-failed'), 1000);
    }
  }
};
```

### 9.5 Performance Optimization

#### 9.5.1 Debounce User Input
```javascript
function debounce(func, wait) {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}

// Usage
const searchTeams = debounce((searchTerm) => {
  DatabaseService.searchTeams(searchTerm);
}, 300);
```

#### 9.5.2 Listener Management
```javascript
const ListenerManager = (function() {
  const listeners = new Map();
  
  function add(key, unsubscribe) {
    // Clean up existing listener
    if (listeners.has(key)) {
      listeners.get(key)();
    }
    listeners.set(key, unsubscribe);
  }
  
  function remove(key) {
    if (listeners.has(key)) {
      listeners.get(key)();
      listeners.delete(key);
    }
  }
  
  function removeAll() {
    listeners.forEach(unsubscribe => unsubscribe());
    listeners.clear();
  }
  
  return { add, remove, removeAll };
})();
```

---

## 10. Testing & Deployment

### 10.1 Local Testing Setup

#### 10.1.1 Firebase Emulator Configuration
```json
// firebase.json
{
  "emulators": {
    "auth": {
      "port": 9099
    },
    "functions": {
      "port": 5001
    },
    "firestore": {
      "port": 8080
    },
    "hosting": {
      "port": 5000
    },
    "ui": {
      "enabled": true,
      "port": 4000
    }
  }
}
```

#### 10.1.2 Test Data Seeding Script
```javascript
// test/seed-data.js
const admin = require('firebase-admin');

async function seedTestData() {
  const db = admin.firestore();
  
  // Create test users
  const users = [
    { id: 'user1', displayName: 'Alice Admin', initials: 'AAA' },
    { id: 'user2', displayName: 'Bob Builder', initials: 'BBB' },
    { id: 'user3', displayName: 'Charlie Chat', initials: 'CCC' }
  ];
  
  for (const user of users) {
    await db.collection('users').doc(user.id).set({
      ...user,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      teams: []
    });
  }
  
  // Create test teams
  const teams = [
    {
      teamName: 'Alpha Squad',
      leaderId: 'user1',
      divisions: ['1', '2'],
      joinCode: 'ALPHA1'
    },
    {
      teamName: 'Beta Team',
      leaderId: 'user2',
      divisions: ['2'],
      joinCode: 'BETA22'
    }
  ];
  
  // ... rest of seeding logic
}
```

### 10.2 Testing Checklist

#### 10.2.1 Unit Tests (Backend)
- [ ] All Cloud Functions have tests
- [ ] Validation logic tested
- [ ] Error cases covered
- [ ] Transactions tested for race conditions

#### 10.2.2 Integration Tests
- [ ] Complete user flow (sign up → create team → set availability)
- [ ] Multi-user scenarios (concurrent updates)
- [ ] Permission tests (can't modify other teams)
- [ ] Real-time update propagation

#### 10.2.3 Frontend Tests
- [ ] All selection methods work (click, drag, shift-click)
- [ ] Modals open/close properly
- [ ] Forms validate correctly
- [ ] Error messages display
- [ ] Offline mode handles gracefully

#### 10.2.4 Performance Tests
- [ ] Page load time < 3 seconds
- [ ] Time to interactive < 5 seconds
- [ ] Smooth scrolling on grids
- [ ] No memory leaks after extended use

### 10.3 Deployment Process

#### 10.3.1 Pre-deployment Checklist
```bash
# 1. Run all tests
npm test

# 2. Build CSS
npm run build-css

# 3. Check for security issues
npm audit

# 4. Validate Firebase config
firebase use production
firebase functions:config:get

# 5. Test deployment locally
firebase serve
```

#### 10.3.2 Deployment Commands
```bash
# Deploy everything
firebase deploy

# Deploy specific services
firebase deploy --only functions
firebase deploy --only firestore:rules
firebase deploy --only hosting

# Deploy specific function
firebase deploy --only functions:createTeam
```

#### 10.3.3 Post-deployment Verification
1. Test authentication flow
2. Create a test team
3. Verify scheduled functions are active
4. Check error reporting in Firebase Console
5. Monitor performance metrics

### 10.4 Monitoring & Maintenance

#### 10.4.1 Firebase Console Monitoring
- **Authentication**: Monitor sign-in methods and users
- **Firestore**: Check read/write operations and costs
- **Functions**: Monitor execution times and errors
- **Hosting**: Check bandwidth usage

#### 10.4.2 Error Tracking
```javascript
// Add to all catch blocks
catch (error) {
  console.error('Error context:', {
    function: 'functionName',
    user: context.auth?.uid,
    data: sanitizedData,
    error: error.message
  });
  
  // Re-throw for Firebase Functions to log
  throw error;
}
```

#### 10.4.3 Performance Monitoring
```javascript
// Add performance marks
performance.mark('grid-render-start');
// ... render grid ...
performance.mark('grid-render-end');
performance.measure('grid-render', 'grid-render-start', 'grid-render-end');

// Log slow operations
const measure = performance.getEntriesByName('grid-render')[0];
if (measure.duration > 100) {
  console.warn('Slow grid render:', measure.duration);
}
```

### 10.5 Backup & Recovery

#### 10.5.1 Automated Backups
```bash
# Schedule daily Firestore exports
gcloud firestore export gs://your-backup-bucket/$(date +%Y%m%d)

# Set up lifecycle rules to delete old backups
gsutil lifecycle set backup-lifecycle.json gs://your-backup-bucket
```

#### 10.5.2 Manual Recovery Process
1. Identify the backup to restore
2. Import to a test project first
3. Verify data integrity
4. Import to production if verified

---

## Summary

This Technical PRD provides a complete implementation guide for MatchScheduler on Firebase. Key deliverables:

1. **Complete backend implementation** with all Cloud Functions
2. **Comprehensive test suite** for reliability
3. **Frontend architecture** matching your existing patterns
4. **UI specifications** for consistent implementation
5. **Error handling** for production readiness
6. **Deployment process** for smooth releases

The backend-first approach allows you to:
- Perfect Firebase patterns without UI distractions
- Test thoroughly before any frontend work
- Give Cursor AI clear, focused tasks
- Build on your proven frontend patterns

Total implementation time: 22 days following the structured plan.

## Next Steps for Implementation

1. **Initialize Firebase project** and set up development environment
2. **Implement backend functions** following Section 4 specifications
3. **Create test suite** using patterns from Section 7.2
4. **Build frontend shell** once backend is verified
5. **Progressively implement UI** panels in dependency order
6. **Deploy to production** following Section 10.3 process

This document serves as the complete technical specification for AI-assisted implementation via Cursor.