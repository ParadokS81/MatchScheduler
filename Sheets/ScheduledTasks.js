/**
 * Schedule Manager - Scheduled Tasks (Web App Edition)
 *
 * @version 1.0.0 (2025-05-30) - Phase 1D
 *
 * Description: Handles automated, time-driven tasks like ensuring future week blocks are provisioned
 * for all active team availability sheets.
 */

// =============================================================================
// CONFIGURATION FOR TRIGGERS
// =============================================================================
const DAILY_MAINTENANCE_HANDLER_FUNCTION_NAME = "performDailyMaintenanceTasks";
const WEEK_PROVISIONING_HANDLER_FUNCTION_NAME = "ensureFutureWeekBlocksForAllActiveTeams";


// =============================================================================
// MAIN DAILY MAINTENANCE TASK (Can call multiple sub-tasks)
// =============================================================================
function performDailyMaintenanceTasks() {
    const CONTEXT = "ScheduledTasks.performDailyMaintenanceTasks";
    Logger.log(`======== ${CONTEXT}: Starting Daily Maintenance ========`);
    
    try {
        // Note: Weekly rollover (runWeeklyRollover) now handles week provisioning
        // and runs on its own Monday 00:01 CET schedule
        autoSleepInactiveTeams();
        // Other daily tasks can be added here in the future
        // e.g., cleanupOldArchivedData(), sendSummaryReports(), etc.
    } catch (e) {
        Logger.log(`CRITICAL ERROR in ${CONTEXT}: ${e.message}\nStack: ${e.stack}`);
    }
    Logger.log(`======== ${CONTEXT}: Daily Maintenance Finished ========`);
}


// =============================================================================
// WEEK BLOCK PROVISIONING TASK
// =============================================================================

// In ScheduledTasks.js

// ... (DAILY_MAINTENANCE_HANDLER_FUNCTION_NAME and WEEK_PROVISIONING_HANDLER_FUNCTION_NAME constants as before)
// ... (performDailyMaintenanceTasks function as before)

/**
 * Checks all active teams and puts to sleep any that have been inactive for 28+ days
 * Designed to be run as part of the daily maintenance tasks
 */
function autoSleepInactiveTeams() {
  const CONTEXT = "ScheduledTasks.autoSleepInactiveTeams";
  Logger.log(`${CONTEXT}: Starting auto-sleep check for inactive teams`);
  
  try {
    // Get all active teams
    const teamsResult = getAllTeams(true); // onlyActive = true
    if (!teamsResult.success || !teamsResult.teams) {
      Logger.log(`${CONTEXT}: Could not retrieve active teams. Error: ${teamsResult.message}`);
      return;
    }
    
    const activeTeams = teamsResult.teams;
    if (activeTeams.length === 0) {
      Logger.log(`${CONTEXT}: No active teams found. Nothing to process.`);
      return;
    }
    
    Logger.log(`${CONTEXT}: Checking ${activeTeams.length} active teams for inactivity...`);
    
    // Current timestamp for comparison
    const now = new Date();
    let teamsProcessedCount = 0;
    let teamsPutToSleepCount = 0;
    
    for (const team of activeTeams) {
      teamsProcessedCount++;
      
      // Skip teams without a timestamp (shouldn't happen, but just in case)
      if (!team.lastUpdatedTimestamp) {
        Logger.log(`${CONTEXT}: Team ${team.teamId} (${team.teamName}) has no last updated timestamp. Skipping.`);
        continue;
      }
      
      // Calculate days since last activity
      const lastUpdated = new Date(team.lastUpdatedTimestamp);
      const daysSinceUpdate = Math.floor((now - lastUpdated) / (1000 * 60 * 60 * 24));
      
      // If inactive for 28+ days, put to sleep
      if (daysSinceUpdate >= 28) {
        Logger.log(`${CONTEXT}: Team ${team.teamId} (${team.teamName}) has been inactive for ${daysSinceUpdate} days. Putting to sleep.`);
        
        const sleepResult = putTeamToSleep(team.teamId);
        if (sleepResult.success) {
          teamsPutToSleepCount++;
          Logger.log(`${CONTEXT}: Successfully put team ${team.teamId} (${team.teamName}) to sleep.`);
        } else {
          Logger.log(`${CONTEXT}: Failed to put team ${team.teamId} (${team.teamName}) to sleep. Error: ${sleepResult.message}`);
        }
      }
    }
    
    Logger.log(`${CONTEXT}: Finished. Processed ${teamsProcessedCount} teams. Put ${teamsPutToSleepCount} teams to sleep.`);
    
  } catch (e) {
    Logger.log(`ERROR in ${CONTEXT}: ${e.message}\nStack: ${e.stack}`);
  }
}

/**
 * Complete weekly rollover system - runs Monday 00:01 CET
 * Replaces ensureFutureWeekBlocksForAllActiveTeams with roster snapshot functionality
 * 1. Identifies current week using ISO week numbers
 * 2. Updates roster snapshots for current week of all teams
 * 3. Ensures 3 future weeks exist (4 total including current)
 * 4. Initializes new weeks with current roster data
 */
function runWeeklyRollover() {
  const CONTEXT = "ScheduledTasks.runWeeklyRollover";
  Logger.log(`======== ${CONTEXT}: Starting Weekly Rollover ========`);
  
  try {
    // Get current week information
    const now = getCurrentCETDate();
    const currentYear = now.getFullYear();
    const currentWeek = getISOWeekNumber(now);
    
    Logger.log(`${CONTEXT}: Processing rollover for ${currentYear}-W${currentWeek}`);
    
    // Get all active teams
    const teamsResult = getAllTeams(true); // onlyActive = true
    if (!teamsResult.success || !teamsResult.teams) {
      Logger.log(`${CONTEXT}: Could not retrieve active teams. Error: ${teamsResult.message}`);
      return createErrorResponse(`Failed to get teams: ${teamsResult.message}`);
    }

    const activeTeams = teamsResult.teams;
    if (activeTeams.length === 0) {
      Logger.log(`${CONTEXT}: No active teams found. Nothing to process.`);
      return createSuccessResponse({ teamsProcessed: 0 }, "No active teams to process");
    }

    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const totalWeeksToEnsure = BLOCK_CONFIG.TEAM_SETTINGS.MAX_WEEKS_PER_TEAM || 4;
    
    let teamsProcessedCount = 0;
    let rosterSnapshotsCreated = 0;
    let newWeekBlocksCreated = 0;
    let teamsWithErrorsCount = 0;
    const processedTeams = [];

    Logger.log(`${CONTEXT}: Processing ${activeTeams.length} active teams for weekly rollover`);

    for (const team of activeTeams) {
      const teamId = team.teamId;
      const teamAvailabilitySheetName = team.availabilitySheetName;

      if (!teamAvailabilitySheetName) {
        Logger.log(`${CONTEXT}: Team ${teamId} (${team.teamName}) has no availability sheet name configured. Skipping.`);
        teamsWithErrorsCount++;
        continue;
      }

      Logger.log(`${CONTEXT}: Processing team ${teamId} (${team.teamName}) - Sheet: ${teamAvailabilitySheetName}`);
      const teamSheet = ss.getSheetByName(teamAvailabilitySheetName);
      if (!teamSheet) {
        Logger.log(`${CONTEXT}: Availability sheet '${teamAvailabilitySheetName}' for team ${teamId} not found. Skipping.`);
        teamsWithErrorsCount++;
        continue;
      }

      try {
        // 1. Update roster snapshot for current week
        const currentWeekSnapshot = _updateRosterSnapshotForWeek(teamSheet, teamId, currentWeek, currentYear);
        if (currentWeekSnapshot) {
          rosterSnapshotsCreated++;
        }

        // 2. Ensure future weeks exist (current + 3 future = 4 total)
        let blocksCreatedForThisTeam = 0;
        let processingYear = currentYear;
        let processingWeek = currentWeek;

        for (let i = 0; i < totalWeeksToEnsure; i++) {
          const result = ensureWeekExists(teamSheet, processingYear, processingWeek);

          if (result && result.success) {
            if (result.created) {
              blocksCreatedForThisTeam++;
              
              // Initialize new weeks with current roster data (except current week which was already updated)
              if (i > 0) { // Skip current week (i=0) as it was handled above
                _updateRosterSnapshotForWeek(teamSheet, teamId, processingWeek, processingYear);
              }
            }
          } else {
            Logger.log(`${CONTEXT}: Failed to ensure week ${processingYear}-W${processingWeek} for team ${teamId}. Error: ${result ? result.message : 'Unknown'}`);
          }

          // Calculate next week
          const mondayOfCurrentWeek = getMondayFromWeekNumberAndYear(processingYear, processingWeek);
          const nextWeekMonday = new Date(mondayOfCurrentWeek);
          nextWeekMonday.setDate(mondayOfCurrentWeek.getDate() + 7);

          processingYear = nextWeekMonday.getFullYear();
          processingWeek = getISOWeekNumber(nextWeekMonday);
        }

        newWeekBlocksCreated += blocksCreatedForThisTeam;
        processedTeams.push({
          teamId: teamId,
          teamName: team.teamName,
          snapshotUpdated: currentWeekSnapshot,
          newBlocksCreated: blocksCreatedForThisTeam
        });

        teamsProcessedCount++;
        Logger.log(`${CONTEXT}: Completed team ${teamId}. New blocks: ${blocksCreatedForThisTeam}, Snapshot: ${currentWeekSnapshot}`);

      } catch (teamError) {
        Logger.log(`${CONTEXT}: Error processing team ${teamId}: ${teamError.message}`);
        teamsWithErrorsCount++;
      }
    }

    // Summary logging
    Logger.log(`======== ${CONTEXT}: Weekly Rollover Complete ========`);
    Logger.log(`Teams processed: ${teamsProcessedCount}/${activeTeams.length}`);
    Logger.log(`Roster snapshots created/updated: ${rosterSnapshotsCreated}`);
    Logger.log(`New week blocks created: ${newWeekBlocksCreated}`);
    Logger.log(`Teams with errors: ${teamsWithErrorsCount}`);
    Logger.log(`========================================`);

    return createSuccessResponse({
      currentWeek: `${currentYear}-W${currentWeek}`,
      teamsProcessed: teamsProcessedCount,
      totalActiveTeams: activeTeams.length,
      rosterSnapshotsCreated: rosterSnapshotsCreated,
      newWeekBlocksCreated: newWeekBlocksCreated,
      teamsWithErrors: teamsWithErrorsCount,
      processedTeams: processedTeams
    }, `Weekly rollover completed successfully for ${teamsProcessedCount} teams`);

  } catch (e) {
    Logger.log(`❌ CRITICAL ERROR in ${CONTEXT}: ${e.message}\nStack: ${e.stack}`);
    return createErrorResponse(`Critical weekly rollover error: ${e.message}`);
  }
}

/**
 * Updates the roster snapshot for a specific week block
 * @param {GoogleAppsScript.Spreadsheet.Sheet} teamSheet The team's availability sheet
 * @param {string} teamId The team ID
 * @param {number} weekNumber ISO week number
 * @param {number} year Year
 * @return {boolean} Success status
 */
function _updateRosterSnapshotForWeek(teamSheet, teamId, weekNumber, year) {
  const CONTEXT = "ScheduledTasks._updateRosterSnapshotForWeek";
  try {
    if (!teamSheet || !teamId || !weekNumber || !year) {
      Logger.log(`${CONTEXT}: Missing required parameters`);
      return false;
    }

    // Find the week block
    const weekBlock = findWeekBlock(teamSheet, year, weekNumber);
    if (!weekBlock) {
      Logger.log(`${CONTEXT}: Week block ${year}-W${weekNumber} not found for team ${teamId}`);
      return false;
    }

    // Update roster snapshot using the new merged cell structure
    const rosterUpdated = updateWeekBlockRoster(teamSheet, weekBlock.startRow, teamId);
    
    if (rosterUpdated) {
      Logger.log(`${CONTEXT}: Updated roster snapshot for team ${teamId}, week ${year}-W${weekNumber}`);
      return true;
    } else {
      Logger.log(`${CONTEXT}: Failed to update roster snapshot for team ${teamId}, week ${year}-W${weekNumber}`);
      return false;
    }

  } catch (e) {
    Logger.log(`${CONTEXT}: Error updating roster snapshot: ${e.message}`);
    return false;
  }
}

// ... (Trigger management functions as before) ...

// =============================================================================
// TRIGGER MANAGEMENT (Run manually by admin once to set up)
// =============================================================================

/**
 * Sets up a daily time-driven trigger for the main maintenance handler.
 */
function setupDailyMaintenanceTrigger() {
  const CONTEXT = "ScheduledTasks.setupDailyMaintenanceTrigger";
  // Delete any existing triggers for this function to avoid duplicates
  const triggers = ScriptApp.getProjectTriggers();
  for (const trigger of triggers) {
    if (trigger.getHandlerFunction() === DAILY_MAINTENANCE_HANDLER_FUNCTION_NAME) {
      ScriptApp.deleteTrigger(trigger);
      Logger.log(`${CONTEXT}: Deleted existing trigger for ${DAILY_MAINTENANCE_HANDLER_FUNCTION_NAME}`);
    }
  }

  // Create a new trigger to run daily (e.g., around 2-3 AM in script's timezone)
  ScriptApp.newTrigger(DAILY_MAINTENANCE_HANDLER_FUNCTION_NAME)
    .timeBased()
    .everyDays(1) // Run daily
    .atHour(2)    // e.g., at 2 AM. Adjust as needed.
    .create();
  Logger.log(`${CONTEXT}: Setup daily trigger for ${DAILY_MAINTENANCE_HANDLER_FUNCTION_NAME} to run around 2 AM.`);
  
  // Inform the admin via UI if possible (only works if run from script editor)
  try {
    SpreadsheetApp.getUi().alert("Success", `Daily maintenance trigger ('${DAILY_MAINTENANCE_HANDLER_FUNCTION_NAME}') has been set up to run around 2 AM.`, SpreadsheetApp.getUi().ButtonSet.OK);
  } catch(uiError) {
    Logger.log(`${CONTEXT}: Could not show UI alert for trigger setup (probably run automatically).`);
  }
}

/**
 * Deletes all triggers for the main daily maintenance handler function.
 */
function deleteDailyMaintenanceTrigger() {
  const CONTEXT = "ScheduledTasks.deleteDailyMaintenanceTrigger";
  let deletedCount = 0;
  const triggers = ScriptApp.getProjectTriggers();
  for (const trigger of triggers) {
    if (trigger.getHandlerFunction() === DAILY_MAINTENANCE_HANDLER_FUNCTION_NAME) {
      ScriptApp.deleteTrigger(trigger);
      deletedCount++;
      Logger.log(`${CONTEXT}: Deleted trigger ID ${trigger.getUniqueId()} for ${DAILY_MAINTENANCE_HANDLER_FUNCTION_NAME}`);
    }
  }
  
  const message = deletedCount > 0 ? 
    `${deletedCount} daily maintenance trigger(s) for '${DAILY_MAINTENANCE_HANDLER_FUNCTION_NAME}' have been deleted.` :
    `No daily maintenance triggers found for '${DAILY_MAINTENANCE_HANDLER_FUNCTION_NAME}' to delete.`;
  Logger.log(`${CONTEXT}: ${message}`);
  
  try {
    SpreadsheetApp.getUi().alert("Trigger Info", message, SpreadsheetApp.getUi().ButtonSet.OK);
  } catch(uiError) {
     Logger.log(`${CONTEXT}: Could not show UI alert for trigger deletion.`);
  }
}

/**
 * Lists all current project triggers in the logs.
 */
function listAllProjectTriggers() {
    const CONTEXT = "ScheduledTasks.listAllProjectTriggers";
    const triggers = ScriptApp.getProjectTriggers();
    if (triggers.length === 0) {
        Logger.log(`${CONTEXT}: No project triggers are currently set.`);
        return;
    }
    Logger.log(`${CONTEXT}: Listing ${triggers.length} project trigger(s):`);
    triggers.forEach(trigger => {
        Logger.log(`  - Handler: ${trigger.getHandlerFunction()}, Type: ${trigger.getEventType()}, ID: ${trigger.getUniqueId()}`);
        if (trigger.getTriggerSource() === ScriptApp.TriggerSource.CLOCK) {
            // Future: more detailed clock trigger info if API allows
        }
    });
}

// =============================================================================
// WEEKLY PROVISIONING AND INDEX VALIDATION
// =============================================================================

/**
 * Weekly scheduled task: Provision new weeks and validate index
 * Should be triggered weekly via time-based trigger
 */
function weeklyProvisionAndValidate() {
  const CONTEXT = "ScheduledTasks.weeklyProvisionAndValidate";
  try {
    Logger.log(`${CONTEXT}: Starting weekly provisioning...`);
    
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const allNewEntries = [];
    let teamsProcessed = 0;
    let weeksCreated = 0;
    
    // Get all active teams
    const teamsResult = getAllTeams(false);
    if (!teamsResult.success || !teamsResult.teams) {
      return createErrorResponse("Failed to get teams list");
    }
    
    // Process each team
    for (const team of teamsResult.teams) {
      if (!team.availabilitySheetName) continue;
      
      const teamSheet = ss.getSheetByName(team.availabilitySheetName);
      if (!teamSheet) continue;
      
      teamsProcessed++;
      
      // Find the last week block
      const blocks = _scanSheetForAllWeekBlocks(teamSheet);
      if (blocks.length === 0) {
        Logger.log(`${CONTEXT}: No blocks found for ${team.teamName}`);
        continue;
      }
      
      // Get the last block
      const lastBlock = blocks[blocks.length - 1];
      
      // Calculate next week
      const lastWeekDate = getMondayFromWeekNumberAndYear(
        lastBlock.year, 
        lastBlock.weekNumber
      );
      lastWeekDate.setDate(lastWeekDate.getDate() + 7);
      
      const nextYear = lastWeekDate.getFullYear();
      const nextWeek = getISOWeekNumber(lastWeekDate);
      
      // Check if we need to create this week
      const currentDate = getCurrentCETDate();
      const weeksAhead = Math.floor(
        (lastWeekDate - currentDate) / (7 * 24 * 60 * 60 * 1000)
      );
      
      if (weeksAhead <= 3) {
        // Create the week block
        const newBlockRow = lastBlock.endRow + 1;
        const blockResult = createSingleWeekBlock(
          teamSheet,
          newBlockRow,
          nextYear,
          nextWeek,
          true // skipIndexUpdate for batching
        );
        
        if (blockResult && blockResult.success) {
          weeksCreated++;
          allNewEntries.push({
            sheetName: teamSheet.getName(),
            year: nextYear,
            weekNumber: nextWeek,
            startRow: newBlockRow
          });
          
          Logger.log(`${CONTEXT}: Created week ${nextYear}-W${nextWeek} for ${team.teamName}`);
        }
      }
    }
    
    // Batch update index
    if (allNewEntries.length > 0) {
      _batchUpdateWeekIndex(allNewEntries);
      Logger.log(`${CONTEXT}: Batch indexed ${allNewEntries.length} new weeks`);
    }
    
    // Validate index integrity
    Logger.log(`${CONTEXT}: Starting index validation...`);
    const validationResult = _validateWeekBlockIndex();
    
    if (!validationResult.isValid && BLOCK_CONFIG.WEEK_BLOCK_INDEX.AUTO_REBUILD_ON_ERROR) {
      Logger.log(`${CONTEXT}: Validation failed, rebuilding index...`);
      const rebuildResult = rebuildWeekBlockIndex();
      
      return createSuccessResponse({
        teamsProcessed: teamsProcessed,
        weeksCreated: weeksCreated,
        indexValidation: validationResult,
        rebuildPerformed: true,
        rebuildResult: rebuildResult
      });
    }
    
    Logger.log(`${CONTEXT}: ✅ Complete. Created ${weeksCreated} weeks, index valid`);
    
    return createSuccessResponse({
      teamsProcessed: teamsProcessed,
      weeksCreated: weeksCreated,
      indexValidation: validationResult,
      rebuildPerformed: false
    });
    
  } catch (e) {
    return handleError(e, CONTEXT);
  }
}

/**
 * Sets up the weekly trigger for provisioning and validation
 * Run this once manually from the script editor
 */
function setupWeeklyTrigger() {
  // Remove any existing triggers for this function
  const triggers = ScriptApp.getProjectTriggers();
  triggers.forEach(trigger => {
    if (trigger.getHandlerFunction() === 'weeklyProvisionAndValidate') {
      ScriptApp.deleteTrigger(trigger);
    }
  });
  
  // Create new weekly trigger
  // Runs every Monday at 2 AM
  ScriptApp.newTrigger('weeklyProvisionAndValidate')
    .timeBased()
    .everyWeeks(1)
    .onWeekDay(ScriptApp.WeekDay.MONDAY)
    .atHour(2)
    .create();
    
  Logger.log('Weekly trigger set up successfully');
}

/**
 * Sets up the weekly trigger for roster rollover - Monday 00:01 CET
 * Run this manually once to establish the weekly schedule
 */
function setupWeeklyRolloverTrigger() {
  const CONTEXT = "ScheduledTasks.setupWeeklyRolloverTrigger";
  
  try {
    // Delete any existing triggers for the weekly rollover function
    const triggers = ScriptApp.getProjectTriggers();
    for (const trigger of triggers) {
      if (trigger.getHandlerFunction() === 'runWeeklyRollover') {
        ScriptApp.deleteTrigger(trigger);
        Logger.log(`${CONTEXT}: Deleted existing trigger for runWeeklyRollover`);
      }
    }

    // Create new weekly trigger - Monday 00:01 CET
    ScriptApp.newTrigger('runWeeklyRollover')
      .timeBased()
      .everyWeeks(1)
      .onWeekDay(ScriptApp.WeekDay.MONDAY)
      .atHour(0)  // 00:01 (midnight + 1 minute)
      .create();
      
    Logger.log(`${CONTEXT}: Set up weekly rollover trigger for Monday 00:01 CET`);
    
    // Also log when next execution will be
    const nextMonday = getNextMonday();
    Logger.log(`${CONTEXT}: Next execution scheduled for: ${nextMonday.toISOString()}`);
    
    // Show success message if UI available
    try {
      SpreadsheetApp.getUi().alert(
        "Weekly Rollover Trigger Set", 
        `Weekly roster rollover trigger has been set up to run every Monday at 00:01 CET.\n\nNext execution: ${nextMonday.toLocaleDateString()}`, 
        SpreadsheetApp.getUi().ButtonSet.OK
      );
    } catch(uiError) {
      Logger.log(`${CONTEXT}: Could not show UI alert (probably run automatically)`);
    }
    
    return createSuccessResponse({ 
      nextExecution: nextMonday.toISOString() 
    }, "Weekly rollover trigger set up successfully");
    
  } catch (e) {
    Logger.log(`${CONTEXT}: Error setting up weekly trigger: ${e.message}`);
    return createErrorResponse(`Failed to set up weekly trigger: ${e.message}`);
  }
}

/**
 * Helper function to calculate next Monday
 * @return {Date} Next Monday date
 */
function getNextMonday() {
  const today = new Date();
  const dayOfWeek = today.getDay(); // 0 = Sunday, 1 = Monday, etc.
  const daysUntilMonday = dayOfWeek === 0 ? 1 : 8 - dayOfWeek; // If today is Sunday, next Monday is tomorrow
  
  const nextMonday = new Date(today);
  nextMonday.setDate(today.getDate() + daysUntilMonday);
  nextMonday.setHours(0, 1, 0, 0); // 00:01:00
  
  return nextMonday;
}