/**
 * Schedule Manager - Week Block Manager (Phase 1D)
 * @version 1.4.3 (2025-06-02) - Corrected all inter-file function calls to be direct global calls.
 * @version 1.4.2 (2025-05-31) - Rewrote labelData creation to avoid 'label not defined' error.
 * @version 1.4.1 (2025-05-31) - Corrected label placement in roster block for static Row 1 sheet headers.
 * @version 1.4.0 (2025-05-31) - Removed block-internal headers; assumes static Row 1 sheet headers. Refined roster block structure.
 */

// BLOCK_CONFIG is global.
// Functions from Configuration.js (e.g., getMondayFromWeekNumberAndYear, formatDate, handleError) are called directly.

const WEEK_BLOCK_DATA_CACHE_EXPIRATION_SECONDS = 300; 

// =============================================================================
// WEEK BLOCK CREATION & MANAGEMENT
// =============================================================================
function createSingleWeekBlock(sheet, startRow, year, weekNumber, skipIndexUpdate = false) {
  const CONTEXT = "WeekBlockManager.createSingleWeekBlock (v1.4.2 with logging)";
  Logger.log(`[${CONTEXT}] ENTERED. Sheet: '${sheet.getName()}', StartRow: ${startRow}, Year: ${year}, Week: ${weekNumber}`);
  try {
    const mondayDate = getMondayFromWeekNumberAndYear(year, weekNumber); // Global from Configuration.js
    const monthName = formatDate(mondayDate, "MMMM"); // Global from Configuration.js
    const timeSlots = BLOCK_CONFIG.TIME.STANDARD_TIME_SLOTS; 
    const numTimeSlots = timeSlots.length;

    // Create metadata and time slot rows
    const blockDataRows = [];
    for (let t = 0; t < numTimeSlots; t++) {
      const rowData = [];
      rowData[BLOCK_CONFIG.LAYOUT.METADATA_COLUMNS.YEAR] = year;
      rowData[BLOCK_CONFIG.LAYOUT.METADATA_COLUMNS.MONTH] = monthName;
      rowData[BLOCK_CONFIG.LAYOUT.METADATA_COLUMNS.WEEK] = `W${weekNumber}`;
      rowData[BLOCK_CONFIG.LAYOUT.TIME_COLUMN] = timeSlots[t];
      for (let d = 0; d < 7; d++) { 
        rowData[BLOCK_CONFIG.LAYOUT.DAYS_START_COLUMN + d] = "";
      }
      blockDataRows.push(rowData);
    }

    // Set metadata and availability grid values
    sheet.getRange(startRow, 1, numTimeSlots, BLOCK_CONFIG.LAYOUT.DAYS_START_COLUMN + 7).setValues(blockDataRows);
    
    // Style metadata columns
    sheet.getRange(startRow, BLOCK_CONFIG.LAYOUT.METADATA_COLUMNS.YEAR + 1, numTimeSlots, 3)
         .setBackground(BLOCK_CONFIG.COLORS.SHEET.METADATA_COLUMN_BG)
         .setHorizontalAlignment("center")
         .setVerticalAlignment("middle")
         .setBorder(null, true, null, true, false, true, BLOCK_CONFIG.COLORS.LIGHT_GRAY, SpreadsheetApp.BorderStyle.SOLID_MEDIUM);

    // Style time column
    sheet.getRange(startRow, BLOCK_CONFIG.LAYOUT.TIME_COLUMN + 1, numTimeSlots, 1)
         .setBackground(BLOCK_CONFIG.COLORS.SHEET.TIME_COLUMN_BG)
         .setHorizontalAlignment("center")
         .setVerticalAlignment("middle")
         .setFontWeight("bold");

    // Style availability grid
    const availabilityGridRange = sheet.getRange(startRow, BLOCK_CONFIG.LAYOUT.DAYS_START_COLUMN + 1, numTimeSlots, 7);
    const backgrounds = [];
    for (let r_bg = 0; r_bg < numTimeSlots; r_bg++) {
      const rowBackgrounds = [];
      for (let c_bg = 0; c_bg < 7; c_bg++) {
        rowBackgrounds.push(c_bg >= 5 ? BLOCK_CONFIG.COLORS.SHEET.WEEKEND : BLOCK_CONFIG.COLORS.SHEET.WEEKDAY); 
      }
      backgrounds.push(rowBackgrounds);
    }
    availabilityGridRange
      .setBackgrounds(backgrounds)
      .setVerticalAlignment("middle")
      .setBorder(true, true, true, true, true, true, BLOCK_CONFIG.COLORS.LIGHT_GRAY, SpreadsheetApp.BorderStyle.SOLID_MEDIUM);

    // Create roster merged cell (Column L)
    const rosterCol = BLOCK_CONFIG.LAYOUT.DAYS_START_COLUMN + 7 + 1; // Column L
    const rosterCell = sheet.getRange(startRow, rosterCol, numTimeSlots, 1);
    rosterCell.merge()
             .setValue("[]") // Empty JSON array for roster
             .setVerticalAlignment("top")
             .setHorizontalAlignment("left")
             .setWrap(true)
             .setFontWeight("normal")
             .setBorder(true, true, true, true, false, false, BLOCK_CONFIG.COLORS.LIGHT_GRAY, SpreadsheetApp.BorderStyle.SOLID_MEDIUM);
    
    // Create changelog merged cell (Column M)
    const changelogCol = rosterCol + 1; // Column M
    const changelogCell = sheet.getRange(startRow, changelogCol, numTimeSlots, 1);
    changelogCell.merge()
                 .setValue("[]") // Empty JSON array for changelog
                 .setVerticalAlignment("top")
                 .setHorizontalAlignment("left")
                 .setWrap(true)
                 .setFontWeight("normal")
                 .setBorder(true, true, true, true, false, false, BLOCK_CONFIG.COLORS.LIGHT_GRAY, SpreadsheetApp.BorderStyle.SOLID_MEDIUM);
    
    Logger.log(`[${CONTEXT}] EXITED SUCCESSFULLY. Block created for ${year}-W${weekNumber}.`);
    
    // Update index unless skipped (for batching)
    if (!skipIndexUpdate) {
      _updateWeekIndex(sheet.getName(), year, weekNumber, startRow);
    }
    
    return {
      success: true, 
      year: year, weekNumber: weekNumber, month: monthName,
      startRow: startRow, endRow: startRow + numTimeSlots - 1,
      created: true
    };
    
  } catch (e) {
    Logger.log(`❌ Error in ${CONTEXT} on sheet ${sheet.getName()} for ${year}-W${weekNumber}: ${e.message}\n${e.stack}`);
    return handleError(e, CONTEXT); // Global from Configuration.js
  }
}

function readWeekBlockData(sheet, weekBlock) {
  const CONTEXT = "WeekBlockManager.readWeekBlockData (v1.1 - Cache Check)"; // Updated context for clarity
  const cache = CacheService.getScriptCache();
  const sheetName = sheet.getName();
  const cacheKey = `scheduleData_${sheetName}_${weekBlock.year}_W${weekBlock.weekNumber}`;

  try {
    const cachedScheduleRaw = cache.get(cacheKey);
    if (cachedScheduleRaw !== null) {
      const parsedCachedSchedule = JSON.parse(cachedScheduleRaw);
      // Check if the cached item is an error object or invalid
      if (parsedCachedSchedule && typeof parsedCachedSchedule.error !== 'undefined') {
        Logger.log(`[${CONTEXT}] Cache HIT for ${cacheKey} but it contained a previously cached error object. Invalidating and re-fetching.`);
        cache.remove(cacheKey); // Invalidate this bad cache entry
        // Proceed to fetch fresh data by not returning here
      } else if (parsedCachedSchedule && parsedCachedSchedule.year === weekBlock.year && parsedCachedSchedule.weekNumber === weekBlock.weekNumber) {
        // Valid cache hit
        Logger.log(`[${CONTEXT}] Cache HIT for ${cacheKey}. Returning valid cached data.`);
        return parsedCachedSchedule;
      } else if (parsedCachedSchedule) {
        // Cached object exists but doesn't seem to be the correct one (e.g. year/week mismatch or missing key fields)
        Logger.log(`[${CONTEXT}] Cache HIT for ${cacheKey} but data seemed malformed or for wrong block. Invalidating and re-fetching. Cached data: ${JSON.stringify(parsedCachedSchedule)}`);
        cache.remove(cacheKey);
      } else {
        // parsedCachedSchedule is null (e.g. cache contained literal "null" string)
        Logger.log(`[${CONTEXT}] Cache HIT for ${cacheKey} but parsed to null. Invalidating and re-fetching.`);
        cache.remove(cacheKey);
      }
    }

    Logger.log(`[${CONTEXT}] Cache MISS or invalid/stale cache for ${cacheKey}. Fetching fresh from sheet: ${sheetName}, Year: ${weekBlock.year}, Week: ${weekBlock.weekNumber}`);
    
    const timeSlots = BLOCK_CONFIG.TIME.STANDARD_TIME_SLOTS; //
    const numTimeSlots = timeSlots.length;
    // DAYS_START_COLUMN is 0-indexed, getRange is 1-indexed
    const dataStartColForAvail = BLOCK_CONFIG.LAYOUT.DAYS_START_COLUMN + 1; //
    
    // Day headers are read from Row 1 of the sheet, which is static
    const dayHeadersFromSheet = sheet.getRange(1, dataStartColForAvail, 1, 7).getValues()[0].map(h => String(h).trim());
    
    // Ensure weekBlock.startRow is valid and numTimeSlots is positive
    if (weekBlock.startRow < 1 || numTimeSlots <= 0) {
        const errorMessage = `Invalid parameters for reading availability data: startRow ${weekBlock.startRow}, numTimeSlots ${numTimeSlots}.`;
        Logger.log(`[${CONTEXT}] ERROR: ${errorMessage}`);
        throw new Error(errorMessage); // This will be caught by the outer catch
    }

    const availabilityDataRange = sheet.getRange(weekBlock.startRow, dataStartColForAvail, numTimeSlots, 7);
    const availabilityValues = availabilityDataRange.getDisplayValues(); 
    
    const schedule = {
      year: weekBlock.year, 
      weekNumber: weekBlock.weekNumber, 
      month: weekBlock.month, // month is already part of weekBlock object
      timeSlots: timeSlots, 
      dayHeaders: dayHeadersFromSheet, 
      availability: []
    };

    for (let tIndex = 0; tIndex < numTimeSlots; tIndex++) {
      const timeSlotLabel = timeSlots[tIndex]; 
      const slotData = { time: timeSlotLabel, days: [] };
      for (let dIndex = 0; dIndex < 7; dIndex++) {
        // Ensure availabilityValues[tIndex] exists before trying to access [dIndex]
        const cellValueString = (availabilityValues[tIndex] && typeof availabilityValues[tIndex][dIndex] !== 'undefined') 
                                ? String(availabilityValues[tIndex][dIndex] || "").trim() 
                                : "";
        const initials = cellValueString ? cellValueString.split(/[,\s]+/).filter(e => e.trim()) : [];
        slotData.days.push({
          day: dayHeadersFromSheet[dIndex], 
          initials: initials, 
          playerCount: initials.length,
          cellRef: { row: weekBlock.startRow + tIndex, col: dataStartColForAvail + dIndex }
        });
      }
      schedule.availability.push(slotData);
    }
    
    // Only cache successfully built schedule data
    cache.put(cacheKey, JSON.stringify(schedule), WEEK_BLOCK_DATA_CACHE_EXPIRATION_SECONDS);
    Logger.log(`[${CONTEXT}] EXITED SUCCESSFULLY. Data read and cached for ${cacheKey}.`);
    return schedule;

  } catch (e) {
    Logger.log(`❌ Error in ${CONTEXT} for block ${weekBlock.year}-W${weekBlock.weekNumber} on sheet '${sheetName}': ${e.message}\nStack: ${e.stack || 'No stack'}`);
    // Return a structured error object, but DO NOT CACHE IT.
    return { 
      year: weekBlock.year, 
      weekNumber: weekBlock.weekNumber, 
      month: weekBlock.month || "ErrorMonth", // Use month from weekBlock if available
      timeSlots: BLOCK_CONFIG.TIME.STANDARD_TIME_SLOTS, //
      dayHeaders: BLOCK_CONFIG.LAYOUT.DAY_ABBREV,   //  
      availability: [], 
      error: `Failed to read week block data: ${e.message}`
    };
  }
}

function ensureWeekExists(sheet, year, weekNumber) {
  const CONTEXT = "WeekBlockManager.ensureWeekExists (with logging)";
  Logger.log(`[${CONTEXT}] ENTERED. Sheet: ${sheet.getName()}, Year: ${year}, Week: ${weekNumber}`);
  try {
    if (!sheet) {
        Logger.log(`[${CONTEXT}] ERROR: Sheet object is required.`);
        throw new Error("Sheet object is required.");
    }
    Logger.log(`[${CONTEXT}] Calling findWeekBlock...`);
    // This calls findWeekBlock from this same WeekBlockManager.js file (which is fine)
    const existingBlock = findWeekBlock(sheet, year, weekNumber); 
    
    if (existingBlock) {
      Logger.log(`[${CONTEXT}] Block found for ${year}-W${weekNumber}. Returning existing.`);
      return { ...existingBlock, created: false, success: true };
    }
    
    Logger.log(`[${CONTEXT}] Block NOT found for ${year}-W${weekNumber}. Calling getNextAvailableBlockPosition...`);
    // This calls getNextAvailableBlockPosition from this same WeekBlockManager.js file (which is fine)
    const insertDataRow = getNextAvailableBlockPosition(sheet); 
    Logger.log(`[${CONTEXT}] Next available row: ${insertDataRow}. Calling createSingleWeekBlock...`);
    // This calls createSingleWeekBlock from this same WeekBlockManager.js file (which is fine)
    const newBlock = createSingleWeekBlock(sheet, insertDataRow, year, weekNumber); 
    Logger.log(`[${CONTEXT}] createSingleWeekBlock result: ${JSON.stringify(newBlock)}`);
    
    if (newBlock && newBlock.success) {
        Logger.log(`[${CONTEXT}] EXITED SUCCESSFULLY. New block created for ${year}-W${weekNumber}.`);
    } else {
        Logger.log(`[${CONTEXT}] EXITED WITH FAILURE. Block creation failed for ${year}-W${weekNumber}.`);
    }
    return { ...newBlock, created: (newBlock && newBlock.success), success: (newBlock && newBlock.success) };
  } catch (e) {
    Logger.log(`❌ Error in ${CONTEXT} for sheet ${sheet.getName()}, ${year}-W${weekNumber}: ${e.message}`);
    return { year: year, weekNumber: weekNumber, created: false, success: false, message: e.message };
  }
}

/**
 * Finds a specific week block using three-tier lookup strategy
 * Tier 1: Script Cache (fastest)
 * Tier 2: Index Sheet (fast)
 * Tier 3: Full Scan (slow, self-healing)
 */
function findWeekBlock(sheet, yearToFind, weekNumberToFind) {
  const CONTEXT = "WeekBlockManager.findWeekBlock";
  const sheetName = sheet.getName();
  
  Logger.log(`[${CONTEXT}] Looking for ${yearToFind}-W${weekNumberToFind} in ${sheetName}`);
  
  try {
    // TIER 1: Check Script Cache
    const cache = CacheService.getScriptCache();
    const cacheKey = `${BLOCK_CONFIG.WEEK_BLOCK_INDEX.CACHE_PREFIX}${sheetName}_${yearToFind}_W${weekNumberToFind}`;
    Logger.log(`${CONTEXT}: Attempting to get cache for key: ${cacheKey}`); // <<< ADD THIS LOG

    const cachedLocation = cache.get(cacheKey);
    if (cachedLocation) {
      Logger.log(`${CONTEXT}: ✅ Cache HIT`);
      return JSON.parse(cachedLocation);
    }
    
    Logger.log(`${CONTEXT}: ❌ Cache MISS for ${cacheKey}. Checking index sheet.`); // <<< ADD THIS LOG
    // TIER 2: Check Index Sheet
    Logger.log(`${CONTEXT}: Cache MISS, checking index sheet`);
    const indexResult = _findWeekInIndexSheet(sheetName, yearToFind, weekNumberToFind);
    
    if (indexResult) {
      Logger.log(`${CONTEXT}: ✅ Found in index, putting to cache for key: ${cacheKey}`); // <<< ADD THIS LOG
      // Cache for next time
      cache.put(cacheKey, JSON.stringify(indexResult), BLOCK_CONFIG.WEEK_BLOCK_INDEX.CACHE_TTL);
      return indexResult;
    }
    
    // TIER 3: Fall back to full scan
    Logger.log(`${CONTEXT}: Not in index, performing full scan`);
    const allBlocks = _scanSheetForAllWeekBlocks(sheet);
    
    for (const block of allBlocks) {
      if (block.year === yearToFind && block.weekNumber === weekNumberToFind) {
        Logger.log(`${CONTEXT}: ✅ Found via scan, updating index`);
        
        // Self-healing: Update index for next time
        _updateWeekIndex(sheetName, yearToFind, weekNumberToFind, block.startRow);
        
        // Cache the result
        cache.put(cacheKey, JSON.stringify(block), BLOCK_CONFIG.WEEK_BLOCK_INDEX.CACHE_TTL);
        
        return block;
      }
    }
    
    Logger.log(`${CONTEXT}: ❌ Week block not found`);
    return null;
    
  } catch (e) {
    Logger.log(`Error in ${CONTEXT}: ${e.message}`);
    // Fall back to scan on any error
    return _scanSheetForAllWeekBlocks(sheet)
      .find(block => block.year === yearToFind && block.weekNumber === weekNumberToFind) || null;
  }
}

function _scanSheetForAllWeekBlocks(sheet) {
  const CONTEXT = "WeekBlockManager._scanSheetForAllWeekBlocks (Static Headers, with logging)";
  let iterationCount = 0; 
  Logger.log(`[${CONTEXT}] ENTERED. Sheet: ${sheet.getName()}`);
  try {
    const blocks = [];
    const lastRowWithContent = sheet.getLastRow();
    const dataScanStartRow = 2; 
    
    if (lastRowWithContent < dataScanStartRow) {
        Logger.log(`[${CONTEXT}] No content rows to scan (lastRowWithContent: ${lastRowWithContent}). Returning empty blocks.`);
        return blocks;
    }

    const yearColIdx = BLOCK_CONFIG.LAYOUT.METADATA_COLUMNS.YEAR + 1;
    const monthColIdx = BLOCK_CONFIG.LAYOUT.METADATA_COLUMNS.MONTH + 1;
    const weekColIdx = BLOCK_CONFIG.LAYOUT.METADATA_COLUMNS.WEEK + 1;
    
    const numSheetDataRows = lastRowWithContent - dataScanStartRow + 1;
    if (numSheetDataRows <= 0) {
        Logger.log(`[${CONTEXT}] Calculated numSheetDataRows is ${numSheetDataRows}. Returning empty blocks.`);
        return blocks;
    }

    Logger.log(`[${CONTEXT}] Reading metadata from range: R${dataScanStartRow}C${yearColIdx} to R${dataScanStartRow + numSheetDataRows -1}C${weekColIdx}`);
    const metaRange = sheet.getRange(dataScanStartRow, yearColIdx, numSheetDataRows, weekColIdx - yearColIdx + 1);
    const metaValues = metaRange.getValues();
    const numTimeSlots = BLOCK_CONFIG.TIME.STANDARD_TIME_SLOTS.length;
    Logger.log(`[${CONTEXT}] numTimeSlots: ${numTimeSlots}, numSheetDataRows from sheet: ${numSheetDataRows}, metaValues length: ${metaValues.length}`);

    for (let r = 0; r < metaValues.length; r++) { 
      iterationCount++;
      if (iterationCount > 500 && (iterationCount % 100 === 0)) { 
          Logger.log(`[${CONTEXT}] WARNING: Iteration ${iterationCount} in loop. Checking row index r=${r} of metaValues.`);
          if (iterationCount > 2000) { 
            Logger.log(`[${CONTEXT}] CRITICAL WARNING: Exceeded 2000 iterations. Aborting _scanSheetForAllWeekBlocks for safety.`);
            break;
          }
      }
      
      const currentYear = metaValues[r][0]; 
      const currentWeekText = metaValues[r][2]; 

      if (typeof currentYear === 'number' && currentYear >= 2000 && 
          typeof currentWeekText === 'string' && currentWeekText.toUpperCase().startsWith('W')) {
        
        const actualSheetRowForDataStart = dataScanStartRow + r; 
        const isAlreadyFound = blocks.some(b => 
            actualSheetRowForDataStart >= b.startRow && actualSheetRowForDataStart <= b.endRow);
        
        if (isAlreadyFound) {
          continue;
        }

        const weekNumber = parseInt(currentWeekText.substring(1));
        if (!isNaN(weekNumber) && weekNumber > 0 && weekNumber <= 53) {
          let isFullBlockPattern = true;
          if (r + numTimeSlots > metaValues.length) { 
              isFullBlockPattern = false; 
          } else {
              for(let i_block = 1; i_block < numTimeSlots; i_block++) { 
                  if(metaValues[r+i_block][0] !== currentYear || 
                     String(metaValues[r+i_block][2]).toUpperCase() !== currentWeekText.toUpperCase()) {
                      isFullBlockPattern = false;
                      break;
                  }
              }
          }
          
          if (isFullBlockPattern) {
            blocks.push({
              year: currentYear,
              weekNumber: weekNumber,
              month: metaValues[r][1], 
              startRow: actualSheetRowForDataStart, 
              endRow: actualSheetRowForDataStart + numTimeSlots - 1 
            });
            r += numTimeSlots - 1; 
          }
        }
      }
    } 

    blocks.sort((a, b) => (a.year - b.year) || (a.weekNumber - b.weekNumber));
    Logger.log(`[${CONTEXT}] EXITED. Found ${blocks.length} blocks after ${iterationCount} metaValues row checks (total rows scanned from sheet: ${numSheetDataRows}).`);
    return blocks;
  } catch (e) {
    Logger.log(`Error in ${CONTEXT} on sheet ${sheet.getName()}: ${e.message}\nStack: ${e.stack}`);
    return [];
  }
}

/**
 * Looks up a week block in the index sheet (Tier 2)
 * @private
 */
function _findWeekInIndexSheet(sheetName, year, weekNumber) {
  const CONTEXT = "WeekBlockManager._findWeekInIndexSheet";
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const indexSheet = ss.getSheetByName(BLOCK_CONFIG.WEEK_BLOCK_INDEX.SHEET_NAME);
    
    if (!indexSheet) {
      Logger.log(`${CONTEXT}: Index sheet not found`);
      return null;
    }
    
    const lastRow = indexSheet.getLastRow();
    if (lastRow <= 1) {
      Logger.log(`${CONTEXT}: Index sheet is empty`);
      return null;
    }
    
    // Get all index data at once for efficiency
    const indexData = indexSheet.getRange(1, 1, lastRow, 5).getValues();
    
    // Search for matching entry (skip header row)
    for (let i = 1; i < indexData.length; i++) {
      if (indexData[i][0] === sheetName && 
          indexData[i][1] === year && 
          indexData[i][2] === weekNumber) {
        
        // Verify the referenced sheet still exists (lazy cleanup)
        const targetSheet = ss.getSheetByName(sheetName);
        if (!targetSheet) {
          // Sheet was archived/renamed - remove stale entry
          Logger.log(`${CONTEXT}: Removing stale index entry for ${sheetName} at row ${i + 1}`);
          indexSheet.deleteRow(i + 1);
          return null;
        }
        
        // Calculate end row based on standard time slots
        const numTimeSlots = BLOCK_CONFIG.TIME.STANDARD_TIME_SLOTS.length;
        const startRow = indexData[i][3];
        
        return {
          year: year,
          weekNumber: weekNumber,
          startRow: startRow,
          endRow: startRow + numTimeSlots - 1
        };
      }
    }
    
    Logger.log(`${CONTEXT}: ❌ Week block not found`);
    return null;
  } catch (e) {
    Logger.log(`Error in ${CONTEXT}: ${e.message}`);
    return null;
  }
}

/**
 * Updates the week index sheet (Tier 2)
 * @private
 */
function _updateWeekIndex(sheetName, year, weekNumber, startRow) {
  const CONTEXT = "WeekBlockManager._updateWeekIndex";
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const indexSheet = ss.getSheetByName(BLOCK_CONFIG.WEEK_BLOCK_INDEX.SHEET_NAME);
    
    if (!indexSheet) {
      Logger.log(`${CONTEXT}: Index sheet not found`);
      return;
    }
    
    const lastRow = indexSheet.getLastRow();
    if (lastRow <= 1) {
      Logger.log(`${CONTEXT}: Index sheet is empty`);
      indexSheet.appendRow([sheetName, year, weekNumber, startRow]);
      return;
    }
    
    // Get all index data at once for efficiency
    const indexData = indexSheet.getRange(1, 1, lastRow, 5).getValues();
    
    // Search for matching entry (skip header row)
    for (let i = 1; i < indexData.length; i++) {
      if (indexData[i][0] === sheetName && 
          indexData[i][1] === year && 
          indexData[i][2] === weekNumber) {
        
        // Update existing entry
        indexSheet.getRange(i + 1, 4).setValue(startRow);
        return;
      }
    }
    
    // No existing entry found, append new row
    indexSheet.appendRow([sheetName, year, weekNumber, startRow]);
  } catch (e) {
    Logger.log(`Error in ${CONTEXT}: ${e.message}`);
  }
}

/**
 * Batch updates the week index sheet for multiple blocks
 * @private
 */
function _batchUpdateWeekIndex(sheetName, blocks) {
  const CONTEXT = "WeekBlockManager._batchUpdateWeekIndex";
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const indexSheet = ss.getSheetByName(BLOCK_CONFIG.WEEK_BLOCK_INDEX.SHEET_NAME);
    
    if (!indexSheet) {
      Logger.log(`${CONTEXT}: Index sheet not found`);
      return;
    }
    
    // Get all existing index data
    const lastRow = indexSheet.getLastRow();
    const indexData = lastRow > 1 ? 
      indexSheet.getRange(2, 1, lastRow - 1, 4).getValues() : [];
    
    // Prepare batch updates
    const updates = [];
    const newRows = [];
    
    blocks.forEach(block => {
      const existingIndex = indexData.findIndex(row => 
        row[0] === sheetName && 
        row[1] === block.year && 
        row[2] === block.weekNumber
      );
      
      if (existingIndex === -1) {
        // New entry
        newRows.push([sheetName, block.year, block.weekNumber, block.startRow]);
      } else {
        // Update existing
        const rowToUpdate = existingIndex + 2; // +2 for header and 0-based index
        updates.push({
          range: indexSheet.getRange(rowToUpdate, 4, 1, 1),
          value: block.startRow
        });
      }
    });
    
    // Apply updates in batch
    if (updates.length > 0) {
      updates.forEach(update => {
        update.range.setValue(update.value);
      });
    }
    
    // Append new rows in batch
    if (newRows.length > 0) {
      indexSheet.getRange(lastRow + 1, 1, newRows.length, 4).setValues(newRows);
    }
    
    Logger.log(`${CONTEXT}: Updated ${updates.length} entries, added ${newRows.length} new entries`);
    
  } catch (e) {
    Logger.log(`Error in ${CONTEXT}: ${e.message}`);
  }
}

/**
 * Gets all week blocks for a team from the index sheet
 * @private
 */
function _getWeekBlocksForTeamFromIndex(sheetName) {
  const CONTEXT = "WeekBlockManager._getWeekBlocksForTeamFromIndex";
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const indexSheet = ss.getSheetByName(BLOCK_CONFIG.WEEK_BLOCK_INDEX.SHEET_NAME);
    
    if (!indexSheet) {
      Logger.log(`${CONTEXT}: Index sheet not found`);
      return [];
    }
    
    const lastRow = indexSheet.getLastRow();
    if (lastRow <= 1) {
      Logger.log(`${CONTEXT}: Index sheet is empty`);
      return [];
    }
    
    // Get all index data at once
    const indexData = indexSheet.getRange(1, 1, lastRow, 4).getValues();
    
    // Filter and map entries for this sheet
    const blocks = indexData
      .slice(1) // Skip header row
      .filter(row => row[0] === sheetName)
      .map(row => ({
        year: row[1],
        weekNumber: row[2],
        startRow: row[3],
        endRow: row[3] + BLOCK_CONFIG.TIME.STANDARD_TIME_SLOTS.length - 1
      }))
      .sort((a, b) => (a.year - b.year) || (a.weekNumber - b.weekNumber));
    
    Logger.log(`${CONTEXT}: Found ${blocks.length} blocks for sheet ${sheetName}`);
    return blocks;
    
  } catch (e) {
    Logger.log(`Error in ${CONTEXT}: ${e.message}`);
    return [];
  }
}

/**
 * Validates the week block index sheet against actual data
 * @return {Object} Validation results with error rate and details
 */
function _validateWeekBlockIndex() {
  const CONTEXT = "WeekBlockManager._validateWeekBlockIndex";
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const indexSheet = ss.getSheetByName(BLOCK_CONFIG.WEEK_BLOCK_INDEX.SHEET_NAME);
    if (!indexSheet) {
      Logger.log(`${CONTEXT}: Index sheet not found`);
      return { success: false, message: "Index sheet not found" };
    }

    const results = {
      totalEntries: 0,
      errorCount: 0,
      errors: [],
      errorRate: 0
    };

    // Get all team sheets
    const allSheets = ss.getSheets();
    const teamSheets = allSheets.filter(s => 
      s.getName().startsWith(BLOCK_CONFIG.MASTER_SHEET.TEAM_TAB_PREFIX)
    );

    // Scan each team sheet
    for (const sheet of teamSheets) {
      const sheetName = sheet.getName();
      Logger.log(`${CONTEXT}: Validating ${sheetName}`);
      
      // Get actual blocks from sheet
      const actualBlocks = _scanSheetForAllWeekBlocks(sheet);
      
      // Get indexed blocks for this sheet
      const indexedBlocks = _getWeekBlocksForTeamFromIndex(sheetName);
      
      // Compare counts
      if (actualBlocks.length !== indexedBlocks.length) {
        results.errors.push(`${sheetName}: Block count mismatch. Actual: ${actualBlocks.length}, Indexed: ${indexedBlocks.length}`);
        results.errorCount++;
      }
      
      // Compare each block
      for (const actual of actualBlocks) {
        results.totalEntries++;
        const indexed = indexedBlocks.find(b => 
          b.year === actual.year && 
          b.weekNumber === actual.weekNumber
        );
        
        if (!indexed) {
          results.errors.push(`${sheetName}: Missing index for ${actual.year}-W${actual.weekNumber}`);
          results.errorCount++;
        } else if (indexed.startRow !== actual.startRow) {
          results.errors.push(`${sheetName}: Row mismatch for ${actual.year}-W${actual.weekNumber}. Actual: ${actual.startRow}, Indexed: ${indexed.startRow}`);
          results.errorCount++;
        }
      }
    }
    
    // Calculate error rate
    results.errorRate = results.totalEntries > 0 ? 
      results.errorCount / results.totalEntries : 1;
    
    Logger.log(`${CONTEXT}: Validation complete. Error rate: ${results.errorRate}`);
    return {
      success: true,
      ...results,
      needsRebuild: results.errorRate >= BLOCK_CONFIG.WEEK_BLOCK_INDEX.VALIDATION_ERROR_THRESHOLD
    };
    
  } catch (e) {
    Logger.log(`Error in ${CONTEXT}: ${e.message}`);
    return { success: false, message: e.message };
  }
}

/**
 * Rebuilds the entire week block index from scratch
 * @return {Object} Result of the rebuild operation
 */
function rebuildWeekBlockIndex() {
  const CONTEXT = "WeekBlockManager.rebuildWeekBlockIndex";
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    
    // Get or create index sheet
    let indexSheet = ss.getSheetByName(BLOCK_CONFIG.WEEK_BLOCK_INDEX.SHEET_NAME);
    if (!indexSheet) {
      indexSheet = ss.insertSheet(BLOCK_CONFIG.WEEK_BLOCK_INDEX.SHEET_NAME);
      indexSheet.getRange(1, 1, 1, 4).setValues([["TeamSheetName", "Year", "WeekNumber", "StartRow"]]);
    } else {
      // Clear existing data but keep header
      const lastRow = indexSheet.getLastRow();
      if (lastRow > 1) {
        indexSheet.getRange(2, 1, lastRow - 1, 4).clearContent();
      }
    }
    
    // Get all team sheets
    const allSheets = ss.getSheets();
    const teamSheets = allSheets.filter(s => 
      s.getName().startsWith(BLOCK_CONFIG.MASTER_SHEET.TEAM_TAB_PREFIX)
    );
    
    let totalBlocks = 0;
    const newEntries = [];
    
    // Scan each team sheet
    for (const sheet of teamSheets) {
      const sheetName = sheet.getName();
      Logger.log(`${CONTEXT}: Processing ${sheetName}`);
      
      const blocks = _scanSheetForAllWeekBlocks(sheet);
      totalBlocks += blocks.length;
      
      // Add each block to new entries
      blocks.forEach(block => {
        newEntries.push([
          sheetName,
          block.year,
          block.weekNumber,
          block.startRow
        ]);
      });
    }
    
    // Batch write all entries
    if (newEntries.length > 0) {
      indexSheet.getRange(2, 1, newEntries.length, 4).setValues(newEntries);
    }
    
    // Clear any related cache entries
    const cache = CacheService.getScriptCache();
    if (cache) {
      try {
        // Note: We can't selectively remove entries, but they'll expire
        Logger.log(`${CONTEXT}: Cache entries will expire naturally`);
      } catch (e) {
        Logger.log(`${CONTEXT}: Cache warning: ${e.message}`);
      }
    }
    
    Logger.log(`${CONTEXT}: Rebuild complete. Indexed ${totalBlocks} blocks from ${teamSheets.length} sheets`);
    return createSuccessResponse({
      sheetsProcessed: teamSheets.length,
      blocksIndexed: totalBlocks
    }, `Week block index rebuilt successfully with ${totalBlocks} blocks from ${teamSheets.length} sheets`);
    
  } catch (e) {
    Logger.log(`Error in ${CONTEXT}: ${e.message}`);
    return createErrorResponse(`Failed to rebuild week block index: ${e.message}`);
  }
}

/**
 * Updates the roster merged cell in a week block with JSON roster data
 * @param {GoogleAppsScript.Spreadsheet.Sheet} sheet The team sheet
 * @param {number} blockStartRow Starting row of the week block
 * @param {string} teamId The team ID to get roster for
 * @return {boolean} Success status
 */
function updateWeekBlockRoster(sheet, blockStartRow, teamId) {
  const CONTEXT = "WeekBlockManager.updateWeekBlockRoster";
  try {
    if (!sheet || !blockStartRow || !teamId) {
      Logger.log(`${CONTEXT}: Missing required parameters`);
      return false;
    }
    
    const numTimeSlots = BLOCK_CONFIG.TIME.STANDARD_TIME_SLOTS.length;
    const rosterCol = BLOCK_CONFIG.LAYOUT.DAYS_START_COLUMN + 7 + 1; // Column L
    
    // Get roster JSON string using utilities from Task 2
    const rosterJson = buildRosterString(teamId);
    
    // Update the merged roster cell
    const rosterCell = sheet.getRange(blockStartRow, rosterCol, numTimeSlots, 1);
    rosterCell.setValue(rosterJson);
    
    Logger.log(`${CONTEXT}: Updated roster cell for team ${teamId} at row ${blockStartRow}`);
    return true;
    
  } catch (e) {
    Logger.log(`${CONTEXT}: Error updating roster cell: ${e.message}`);
    return false;
  }
}

/**
 * Appends an entry to the changelog merged cell in a week block
 * @param {GoogleAppsScript.Spreadsheet.Sheet} sheet The team sheet
 * @param {number} blockStartRow Starting row of the week block
 * @param {string} changelogEntry The entry to append
 * @return {boolean} Success status
 */
function appendToWeekBlockChangelog(sheet, blockStartRow, changelogEntry) {
  const CONTEXT = "WeekBlockManager.appendToWeekBlockChangelog";
  try {
    if (!sheet || !blockStartRow || !changelogEntry) {
      Logger.log(`${CONTEXT}: Missing required parameters`);
      return false;
    }
    
    const numTimeSlots = BLOCK_CONFIG.TIME.STANDARD_TIME_SLOTS.length;
    const changelogCol = BLOCK_CONFIG.LAYOUT.DAYS_START_COLUMN + 7 + 2; // Column M
    
    // Get current changelog content
    const changelogCell = sheet.getRange(blockStartRow, changelogCol, numTimeSlots, 1);
    let currentChangelog = changelogCell.getValue().toString();
    
    // Handle initial state
    if (currentChangelog.includes("(No changes this week)") || currentChangelog.trim() === "") {
      currentChangelog = "";
    } else {
      currentChangelog += "\n";
    }
    
    // Append new entry
    const updatedChangelog = currentChangelog + changelogEntry;
    changelogCell.setValue(updatedChangelog);
    
    Logger.log(`${CONTEXT}: Appended changelog entry at row ${blockStartRow}`);
    return true;
    
  } catch (e) {
    Logger.log(`${CONTEXT}: Error appending to changelog: ${e.message}`);
    return false;
  }
}

/**
 * Reads roster data from a week block's merged cell
 * @param {GoogleAppsScript.Spreadsheet.Sheet} sheet The team sheet
 * @param {number} blockStartRow Starting row of the week block
 * @return {Array} Array of player objects or empty array
 */
function getWeekBlockRosterData(sheet, blockStartRow) {
  const CONTEXT = "WeekBlockManager.getWeekBlockRosterData";
  try {
    if (!sheet || !blockStartRow) {
      Logger.log(`${CONTEXT}: Missing required parameters`);
      return [];
    }
    
    const numTimeSlots = BLOCK_CONFIG.TIME.STANDARD_TIME_SLOTS.length;
    const rosterCol = BLOCK_CONFIG.LAYOUT.DAYS_START_COLUMN + 7 + 1; // Column L
    
    // Read roster JSON from merged cell
    const rosterCell = sheet.getRange(blockStartRow, rosterCol, numTimeSlots, 1);
    const rosterJson = rosterCell.getValue().toString();
    
    // Parse using utility from Task 2
    const rosterArray = parseRosterString(rosterJson);
    
    Logger.log(`${CONTEXT}: Retrieved ${rosterArray.length} players from week block at row ${blockStartRow}`);
    return rosterArray;
    
  } catch (e) {
    Logger.log(`${CONTEXT}: Error reading roster data: ${e.message}`);
    return [];
  }
}

function getWeekBlocksForTeam(teamId) {
  // ... existing code ...
}