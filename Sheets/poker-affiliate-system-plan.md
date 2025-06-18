# Poker Affiliate System - Architecture Plan

## Core Data Model
*The universal truth regardless of poker site*

### Player
- username (might differ across sites)
- total hands played
- total rake generated
- profit/loss

### Deal Structure  
- base rate (your 80% from the site)
- affiliate rate (65% to sub-affiliate)
- player rakeback % (what sub-affiliate gives to player)

### Time-based Data
- Week/Month/Period
- Rake generated
- Commissions earned at each level

## Data Flow Architecture

```
Raw Data Source (PokerSite A, B, C...)
    ↓
Data Sanitizer/Parser (site-specific)
    ↓
Standardized Data Format
    ↓
Your Database
    ↓
Business Logic Layer (calculations)
    ↓
API/Display Layer
```

## Smart Architecture Decisions

### 1. Adapter Pattern for data sources
- `PokerSiteAParser`, `PokerSiteBParser`, etc.
- Each converts to your standard format
- Easy to add new sites later

### 2. Multi-tenant from the start (but hidden)
- Even if you only use it yourself initially
- Database structure supports multiple "organizations"
- Makes it sellable later without major refactoring

### 3. Flexible Deal Structure
- Store deal terms as JSON/flexible format
- Can handle complex multi-tier arrangements
- Sub-affiliates can have their own deal structures

## MVP Focus
- YOUR single poker site
- YOUR affiliate structure only
- But build the database to support expansion

## Key Business Rules

### Deal Hierarchy Example
1. **Poker Site → You**: 80% of rake
2. **You → Sub-Affiliate**: 65% of rake (keeping 15% margin)
3. **Sub-Affiliate → Player**: Variable % (sub-affiliate's choice)

### Special Deal Types
- **Chip Value Deals**: 0.85% value on chips (affects profit calculations)
- **Time-based Deals**: Deals can change mid-week, need date/time tracking
- **Credit Lines**: Track advances/bonuses given to players

### Data Sanitization Goals
- WHO is playing
- WHAT are their results
- HOW much rake did they generate
- WHAT does their deal look like

## Data Import Specifications

### Manual CSV Import Process
- Login to poker site → Select date range → Export CSV
- Date ranges based on site timezone (e.g., Turkish time)
- Weekly periods: Monday 00:00 to Sunday 23:59 (site timezone)

### Core Data Requirements (Always Available)
- **Player username**
- **Total profit/loss** (final number after all calculations)
- **Total rake generated**
- **Time period** (from/to timestamps)

### Optional Data (May vary by site/format)
- Hands played count
- Breakdown of deductions (bad beat jackpot, insurance, etc.)
- Session details
- Other site-specific metrics

### Import Flexibility
- Adapter pattern for each site/format version
- Core fields mapped regardless of source format
- Graceful handling of missing optional fields
- Version tracking for import formats

### Timezone Handling
- Each poker site has a defined timezone
- Date ranges must be stored with timezone context
- Enable accurate weekly/monthly reporting across sites

## Player Identity Management

### Identity Structure
```
Player Identity
  ├── Player Profile 1 (Site A, username1)
  ├── Player Profile 2 (Site A, username2)
  └── Player Profile 3 (Site B, username3)
```

### Use Cases
- Players changing nicknames
- Players wanting to be "hidden"
- Superstitious gambling behavior
- Cross-site player tracking

## Deal History & Tracking

### Time-based Deal Storage
- Store deal terms with start/end timestamps
- Handle mid-week deal changes
- Enable historical reporting with correct rates

### Deal Change Workflow
1. **Import Period 1**: Raw data with Deal A (e.g., Mon-Wed)
2. **Import Period 2**: Raw data with Deal B (e.g., Thu-Sun)
3. **System combines**: Both imports for complete week view
4. **Calculations**: Apply correct deal terms to each period

### Historical Deal Tracking
- **Current Google Sheets approach**: Each week is a time capsule with inherited deals
- **Problem**: No record of what deals were active for that week
- **Solution**: Store deal snapshot with each import/week

### Deal History Benefits
- Recreate exact calculations from any past period
- Answer "what was my deal in Week 19?"
- Audit trail for disputes
- Track deal progression over time
- Generate historical reports with correct rates

### Implementation Approach
- Each data import is tagged with its period and applicable deal
- Store deal terms as they were at import time (snapshot)
- Can rebuild historical data accurately
- Maintains flexibility for any date range

## Payment & Credit Tracking

### Weekly Settlement Process
- Generate reports showing all players under affiliate
- Calculate total rake × affiliate percentage
- Apply special rules (chip value adjustments)

### Credit Management Features
- Track credit lines given to players
- Record bonuses and advances
- Affiliate chip requests via website/Telegram
- Approval workflow for chip distributions
- Running tally of requests and approvals

## Audit & Activity Tracking

### Current Scope
- Admin-only editing (single user initially)
- Track affiliate requests (new players, chip distributions)
- Log approvals and rejections
- Maintain history of credit transactions

### Future Considerations
- Multi-admin support
- Detailed change logs
- User action history
- Integration with Telegram bot for requests