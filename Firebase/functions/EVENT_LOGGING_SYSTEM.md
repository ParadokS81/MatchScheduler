# Improved Event Logging System

## Overview

The improved event logging system separates team lifecycle events from player movement events, providing better organization and tracking of all activities within the MatchScheduler application.

## Event Categories

### Team Lifecycle Events
- `TEAM_CREATED` - When a team is created
- `TEAM_INACTIVE` - When a team goes inactive (14 days no activity)
- `TEAM_ACTIVE` - When a team reactivates
- `TEAM_ARCHIVED` - When a team is permanently archived

### Player Movement Events
- `JOINED` - Player joins team
- `LEFT` - Player leaves voluntarily
- `KICKED` - Player removed by leader
- `TRANSFERRED_LEADERSHIP` - Leadership changes

## Implementation Locations

### Team Lifecycle Events

#### TEAM_CREATED
- **Location**: `Firebase/functions/src/teams/create.js`
- **Trigger**: When a new team is created
- **Details**: Includes divisions, maxPlayers, and creator information
- **Note**: Does NOT include `userId` field - this is a team-centric event, not player-specific

#### TEAM_INACTIVE
- **Location**: `Firebase/functions/src/scheduled/teamStatus.js`
- **Trigger**: Daily scheduled function checks for teams with no activity for 14+ days
- **Details**: Includes last activity date and inactivity duration

#### TEAM_ACTIVE
- **Location**: `Firebase/functions/src/availability/update.js`
- **Trigger**: When an inactive team receives an availability update
- **Details**: Includes reactivation trigger and user who caused reactivation

#### TEAM_ARCHIVED
- **Location**: `Firebase/functions/src/teams/leave.js`
- **Trigger**: When the last member leaves a team
- **Details**: Includes reason and final member information

### Player Movement Events

#### JOINED
- **Locations**: 
  - `Firebase/functions/src/teams/create.js` (founder joining their own team)
  - `Firebase/functions/src/teams/join.js` (regular join via join code)
- **Details**: Includes join method and role information

#### LEFT
- **Location**: `Firebase/functions/src/teams/leave.js`
- **Trigger**: When a player voluntarily leaves a team
- **Details**: Includes leave method and whether they were the last member

#### KICKED
- **Location**: `Firebase/functions/src/teams/manage.js` (`removePlayer` function)
- **Trigger**: When a team leader removes a player
- **Details**: Includes who performed the kick

#### TRANSFERRED_LEADERSHIP
- **Location**: `Firebase/functions/src/teams/manage.js` (`transferLeadership` function)
- **Trigger**: When team leadership is transferred
- **Details**: Includes who transferred leadership

## Database Structure

### Collection Name
- **New**: `eventLog` (replaces `rosterEvents`)
- **Legacy**: `rosterEvents` (maintained for backward compatibility)

### Document Structure
```javascript
{
  eventId: "20250630-2051-slackers-team_created_X7Y9",
  teamId: "abc123",
  teamName: "Slackers",
  type: "TEAM_CREATED", // Event type
  category: "TEAM_LIFECYCLE", // or "PLAYER_MOVEMENT"
  timestamp: Timestamp,
  userId: "user123", // Optional for some team lifecycle events
  player: { // Only for player movement events
    displayName: "John Doe",
    initials: "JDO"
  },
  details: { // Event-specific additional data
    // Varies by event type
  }
}
```

## Helper Functions

### Event Type Constants
```javascript
const EVENT_TYPES = {
  // Team Lifecycle Events
  TEAM_CREATED: 'TEAM_CREATED',
  TEAM_INACTIVE: 'TEAM_INACTIVE', 
  TEAM_ACTIVE: 'TEAM_ACTIVE',
  TEAM_ARCHIVED: 'TEAM_ARCHIVED',
  
  // Player Movement Events
  JOINED: 'JOINED',
  LEFT: 'LEFT',
  KICKED: 'KICKED',
  TRANSFERRED_LEADERSHIP: 'TRANSFERRED_LEADERSHIP'
};
```

### Logging Functions
- `logTeamLifecycleEvent(db, transaction, eventType, eventData)`
- `logPlayerMovementEvent(db, transaction, eventType, eventData)`

## Benefits

1. **Separation of Concerns**: Team events and player events are clearly categorized
2. **Dual Event Creation**: Team creation now generates both a TEAM_CREATED and JOINED event
3. **Better Analytics**: Easier to track team vs player activity patterns
4. **Improved Querying**: Can filter events by category for specific use cases
5. **Backward Compatibility**: Legacy rosterEvents collection is maintained

## Migration Notes

- The new system runs alongside the old system initially
- New events go to `eventLog` collection
- Old events remain in `rosterEvents` collection
- Firestore rules allow read access to both collections
- UI can be updated to use the new collection when ready

## Example Event Flows

### Team Creation
1. User creates team "Slackers"
2. Two events are logged:
   - `TEAM_CREATED` event (team lifecycle)
   - `JOINED` event (founder joining as owner)

### Player Joins Team
1. Player uses join code
2. One event is logged:
   - `JOINED` event (player movement)

### Team Goes Inactive
1. Scheduled function runs daily
2. Teams with 14+ days no activity:
   - `TEAM_INACTIVE` event (team lifecycle)

### Team Reactivates
1. Player updates availability on inactive team
2. One event is logged:
   - `TEAM_ACTIVE` event (team lifecycle)

## Expected Event Structure

TEAM_CREATED event should have:
- **NO userId field** (this is a team event, not player-specific)
- category: 'TEAM_LIFECYCLE'
- details with divisions, maxPlayers, and creator info

JOINED event should have:
- **userId field** (the founder's ID)
- category: 'PLAYER_MOVEMENT'
- player object with displayName and initials
- details with role: 'owner' and isFounder: true

### Example TEAM_CREATED Event
```javascript
{
  eventId: "20250630-2051-slackers-team_created_X7Y9",
  teamId: "abc123",
  teamName: "Slackers",
  type: "TEAM_CREATED",
  category: "TEAM_LIFECYCLE",
  timestamp: Timestamp,
  // NO userId field - team-centric event
  details: {
    divisions: ["Division 1"],
    maxPlayers: 5,
    creator: {
      displayName: "John Doe",
      initials: "JDO"
    }
  }
}
```

### Example JOINED Event (Founder)
```javascript
{
  eventId: "20250630-2051-slackers-joined_Y8Z0",
  teamId: "abc123", 
  teamName: "Slackers",
  type: "JOINED",
  category: "PLAYER_MOVEMENT",
  timestamp: Timestamp,
  userId: "user123", // Player-specific event
  player: {
    displayName: "John Doe",
    initials: "JDO"
  },
  details: {
    role: "owner",
    isFounder: true
  }
}
``` 