/**
 * Schedule Manager - Debug Data Management & Verification
 * Split from Debug.js v2.2.0 (2025-06-07)
 * 
 * Purpose: Data verification, cleanup, and data management utilities
 * Dependencies: Calls core business logic functions and uses TEST_CONFIG from DebugMenu.gs
 */

// =============================================================================
// DATA VERIFICATION FUNCTIONS
// =============================================================================

/**
 * Verify that test data was created successfully
 */
function verifyTestDataCreation(expectedTeams) {
    Logger.log("Verifying test data creation...");
    
    try {
        const issues = [];
        let successCount = 0;
        
        // Check each expected team
        for (const expectedTeam of expectedTeams) {
            if (!expectedTeam.teamId) {
                issues.push(`Setup issue: Team '${expectedTeam.name}' was not found to verify.`);
                continue;
            }
            
            const teamData = getTeamData(expectedTeam.teamId);
            if (!teamData) {
                issues.push(`Data issue: Team ${expectedTeam.name} (${expectedTeam.teamId}) not found via getTeamData.`);
                continue;
            }
            
            // Verify team basics
            if (teamData.teamName !== expectedTeam.name) {
                issues.push(`Team ${expectedTeam.teamId} name mismatch: expected ${expectedTeam.name}, got ${teamData.teamName}`);
            }
            
            if (teamData.leaderEmail !== expectedTeam.finalLeader) {
                issues.push(`Team ${expectedTeam.name} leader mismatch: expected ${expectedTeam.finalLeader}, got ${teamData.leaderEmail}`);
            }
            
            const expectedMemberCount = 1 + expectedTeam.fakeMembers.length; // leader + members
            if (teamData.playerCount !== expectedMemberCount) {
                issues.push(`Team ${expectedTeam.name} player count mismatch: expected ${expectedMemberCount}, got ${teamData.playerCount}`);
            }
            
            // Verify team sheet exists
            const ss = SpreadsheetApp.getActiveSpreadsheet();
            const teamSheet = ss.getSheetByName(expectedTeam.sheetName);
            if (!teamSheet) {
                issues.push(`Sheet issue: Team sheet ${expectedTeam.sheetName} not found`);
                continue;
            }
            
            // Check if availability patterns were applied
            const currentYear = TEST_CONFIG.TEST_AVAILABILITY_YEAR;
            const currentWeek = TEST_CONFIG.TEST_AVAILABILITY_CURRENT_WEEK;
            const weekBlock = findWeekBlock(teamSheet, currentYear, currentWeek);
            
            if (!weekBlock) {
                issues.push(`Block issue: Team ${expectedTeam.name} missing current week block`);
                continue;
            }
            
            // Check if there's any availability data
            const scheduleData = readWeekBlockData(teamSheet, weekBlock);
            let hasAvailability = false;
            
            if (scheduleData && scheduleData.availability) {
                // CORRECTED LOGIC: Iterate through the array of time-slot objects
                for (const timeSlot of scheduleData.availability) {
                    // Each timeSlot is an object with a 'days' array
                    if (timeSlot.days) {
                        for (const day of timeSlot.days) {
                            // Each day is an object with an 'initials' array
                            if (day.initials && day.initials.length > 0) {
                                hasAvailability = true;
                                break;
                            }
                        }
                    }
                    if (hasAvailability) break;
                }
            }
            
            if (!hasAvailability) {
                issues.push(`Team ${expectedTeam.name} has no availability patterns applied`);
            }
            
            if (issues.length === 0 || issues.filter(i => i.includes(expectedTeam.name)).length === 0) {
                successCount++;
            }
        }
        
        // Check sheet ordering
        const ss = SpreadsheetApp.getActiveSpreadsheet();
        const allSheets = ss.getSheets();
        
        if (allSheets.length < 2 || 
            allSheets[0].getName() !== BLOCK_CONFIG.MASTER_SHEET.TEAMS_SHEET ||
            allSheets[1].getName() !== BLOCK_CONFIG.MASTER_SHEET.PLAYERS_SHEET) {
            issues.push("Sheet ordering incorrect: Teams and Players should be first two sheets");
        }
        
        if (issues.length === 0) {
            return { 
                success: true, 
                message: `All ${expectedTeams.length} teams verified successfully with proper data and availability patterns` 
            };
        } else {
            return {
                success: false,
                message: `${issues.length} issues found: ${issues.join('; ')}`,
                successfulTeams: successCount,
                totalTeams: expectedTeams.length
            };
        }
        
    } catch (e) {
        return {
            success: false,
            message: `Verification failed with error: ${e.message}`
        };
    }
}

/**
 * Standalone verification function for menu use.
 * FIXED: Updated to look for simple team names ("Alpha") instead of prefixed names ("Team Alpha")
 * to match the current setup script.
 */
function verifyTestDataOnly() {
    Logger.log("=== STANDALONE TEST DATA VERIFICATION ===");
    
    try {
        initializeTestConfigDates();
        
        const realAdmin = TEST_CONFIG.ADMIN_EMAIL;
        const realPlayer = TEST_CONFIG.PLAYER1_EMAIL;
        
        // This list now uses the simple names "Alpha", "Beta", "Gamma" to match the setup script.
        const expectedTeams = [
            {
                teamId: null, // Will be found by name
                name: "Alpha",
                sheetName: null,
                finalLeader: realAdmin,
                finalLeaderInitials: "DL",
                finalLeaderName: "David Larsen",
                fakeMembers: [
                    { email: "alex.storm@testmail.com", name: "Alex Storm", initials: "AS" },
                    { email: "mike.thunder@testmail.com", name: "Mike Thunder", initials: "MT" },
                    { email: "sarah.lightning@testmail.com", name: "Sarah Lightning", initials: "SL" }
                ]
            },
            {
                name: "Beta",
                finalLeader: realAdmin,
                fakeMembers: [
                    { email: realPlayer, name: "MatchScheduler Player", initials: "MS" },
                    { email: "emma.frost@testmail.com", name: "Emma Frost", initials: "EF" },
                    { email: "jack.steel@testmail.com", name: "Jack Steel", initials: "JS" }
                ]
            },
            {
                name: "Gamma",
                finalLeader: realPlayer,
                fakeMembers: [
                    // This user was changed in the setup script to avoid the "max 2 teams" error.
                    { email: "greg.garrison@testmail.com", name: "Greg Garrison", initials: "GG" },
                    { email: "nina.viper@testmail.com", name: "Nina Viper", initials: "NV" },
                    { email: "ryan.hawk@testmail.com", name: "Ryan Hawk", initials: "RH" },
                    { email: "zoe.phoenix@testmail.com", name: "Zoe Phoenix", initials: "ZP" }
                ]
            }
        ];
        
        // Find actual teams by name and add their IDs/sheet names
        const teamsResult = getAllTeams(true);
        if (teamsResult.success) {
            for (const expectedTeam of expectedTeams) {
                const foundTeam = teamsResult.teams.find(t => t.teamName === expectedTeam.name);
                if (foundTeam) {
                    expectedTeam.teamId = foundTeam.teamId;
                    expectedTeam.sheetName = foundTeam.availabilitySheetName;
                }
            }
        }
        
        const verificationResult = verifyTestDataCreation(expectedTeams);
        
        if (verificationResult.success) {
            Logger.log(`✅ VERIFICATION PASSED: ${verificationResult.message}`);
            return { success: true, message: verificationResult.message };
        } else {
            Logger.log(`❌ VERIFICATION FAILED: ${verificationResult.message}`);
            return { success: false, message: verificationResult.message };
        }
        
    } catch (e) {
        const errorMsg = `Verification exception: ${e.message}`;
        Logger.log(`❌ VERIFICATION ERROR: ${errorMsg}`);
        return { success: false, message: errorMsg };
    }
}

// =============================================================================
// VERIFICATION HELPER FUNCTIONS (Used by test scenarios)
// =============================================================================

function verifyTeamData(teamId, expectedData) {
    const teamData = getTeamData(teamId, true);
    if (!assert(teamData !== null, `Team ${teamId} should exist.`, `Fetching team ${teamId}`)) return null;
    for (const key in expectedData) {
        if (expectedData.hasOwnProperty(key)) {
            assert(teamData[key] === expectedData[key], `Team ${teamId} ${key} should be ${expectedData[key]}.`, `Team ${teamId} ${key} check`);
        }
    } 
    return teamData;
}

function verifyPlayerData(playerEmail, expectedData, teamContext = null) {
    const playerData = getPlayerDataByEmail(playerEmail, true);
    if (!assert(playerData !== null, `Player ${playerEmail} should exist.`, `Fetching player ${playerEmail}`)) return null;
    for (const key in expectedData) {
        if (expectedData.hasOwnProperty(key)) {
            assert(playerData[key] === expectedData[key], `Player ${playerEmail} ${key} should be ${expectedData[key]}.`, `Player ${playerEmail} ${key} check`);
        }
    } 
    return playerData;
}

function verifyAvailability(sheetName, blockYear, blockWeek, playerInitials, expectedPresenceOrCount) {
    const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(sheetName);
    if (!assert(sheet !== null, `Sheet ${sheetName} should exist.`)) return;
    
    const weekBlock = findWeekBlock(sheet, blockYear, blockWeek);
    if (!assert(weekBlock !== null, `Week block ${blockYear}-W${blockWeek} should exist on sheet ${sheetName}.`)) return;
    
    const scheduleData = readWeekBlockData(sheet, weekBlock);
    if (scheduleData.error) { 
        assert(false, `Read schedule error: ${scheduleData.error}`); 
        return; 
    }
    
    let actualCount = 0;
    // *** THIS IS THE FIX FOR BUG #3 ***
    // Correctly loop through the availability data structure
    if (scheduleData && scheduleData.availability) {
        for (const timeSlot of scheduleData.availability) {
            // timeSlot is an object: { time: "...", days: [...] }
            if (timeSlot.days) {
                for (const day of timeSlot.days) {
                    // day is an object: { day: "...", initials: [...] }
                    if (day.initials && day.initials.includes(playerInitials)) {
                        actualCount++;
                    }
                }
            }
        }
    }
    
    const upperPlayerInitials = playerInitials.toUpperCase();

    if (typeof expectedPresenceOrCount === 'number') {
        assert(actualCount === expectedPresenceOrCount, `Player ${upperPlayerInitials} should have ${expectedPresenceOrCount} slots in ${blockYear}-W${blockWeek}. Found ${actualCount}.`);
    } else if (expectedPresenceOrCount === "present") {
        assert(actualCount > 0, `Player ${upperPlayerInitials} should have availability in ${blockYear}-W${blockWeek}. Found ${actualCount} slots.`);
    } else if (expectedPresenceOrCount === "absent") {
        assert(actualCount === 0, `Player ${upperPlayerInitials} should have NO availability in ${blockYear}-W${blockWeek}. Found ${actualCount} slots.`);
    }
}

// =============================================================================
// CLEANUP HELPER (Updated for new direct manipulation approach)
// =============================================================================
function comprehensiveCleanupOfTestData() {
    const CLEANUP_CONTEXT = "Debug.comprehensiveCleanupOfTestData";
    Logger.log(`${CLEANUP_CONTEXT}: Starting comprehensive cleanup of test entities...`);
    
    try {
        const adminEmail = TEST_CONFIG.ADMIN_EMAIL;
        const teamsResult = getAllTeams(true);
        
        if (teamsResult.success && teamsResult.teams) {
            // Clean up any teams with test-related names
            for (const team of teamsResult.teams) {
                const isTestTeam = team.teamName.includes("ZZZ Test") || 
                                 team.teamName.includes("Test Team") ||
                                 team.teamName.includes("Team Alpha") ||
                                 team.teamName.includes("Team Beta") ||
                                 team.teamName.includes("Team Gamma");
                                 
                if (isTestTeam) {
                    Logger.log(`${CLEANUP_CONTEXT}: Cleaning up test team: ${team.teamName}`);
                    
                    if (team.isActive) {
                        const archiveResult = archiveTeam(team.teamId, adminEmail);
                        if (archiveResult.success) {
                            const deleteResult = hardDeleteArchivedTeam(team.teamId, adminEmail);
                            Logger.log(`${CLEANUP_CONTEXT}: ${team.teamName} archived and deleted. Success: ${deleteResult.success}`);
                        }
                    } else {
                        const deleteResult = hardDeleteArchivedTeam(team.teamId, adminEmail);
                        Logger.log(`${CLEANUP_CONTEXT}: ${team.teamName} was inactive, deleted directly. Success: ${deleteResult.success}`);
                    }
                }
            }
        }
        
        // Clean up any orphaned test player records with @testmail.com emails
        try {
            const ss = SpreadsheetApp.getActiveSpreadsheet();
            const playersSheet = ss.getSheetByName(BLOCK_CONFIG.MASTER_SHEET.PLAYERS_SHEET);
            
            if (playersSheet) {
                const playersData = playersSheet.getDataRange().getValues();
                const pCols = BLOCK_CONFIG.MASTER_SHEET.PLAYERS_COLUMNS;
                
                // Find test email rows to remove (from bottom to top to avoid index issues)
                for (let i = playersData.length - 1; i >= 1; i--) {
                    const email = playersData[i][pCols.GOOGLE_EMAIL];
                    if (email && email.includes('@testmail.com')) {
                        Logger.log(`${CLEANUP_CONTEXT}: Removing test player: ${email}`);
                        withProtectionBypass(() => {
                            playersSheet.deleteRow(i + 1); // Sheet rows are 1-indexed
                        }, "Remove Test Player", BLOCK_CONFIG.MASTER_SHEET.PLAYERS_SHEET);
                    }
                }
            }
        } catch (cleanupError) {
            Logger.log(`${CLEANUP_CONTEXT}: Warning during player cleanup: ${cleanupError.message}`);
        }
        
        Logger.log(`${CLEANUP_CONTEXT}: Comprehensive cleanup completed.`);
        return { success: true, message: "Test entities cleaned up successfully" };
        
    } catch (e) {
        Logger.log(`${CLEANUP_CONTEXT}: Error during cleanup: ${e.message}`);
        return { success: false, message: `Cleanup error: ${e.message}` };
    }
}