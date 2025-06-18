/**
 * Schedule Manager - Image Service (Web App Edition)
 * @version 1.2.0 (2025-06-09) - Renamed from LogoService to ImageService, added generic Drive image support
 * @version 1.1.0 (2025-06-09) - Added base64 conversion for Drive images
 * @version 1.0.1 (2025-05-30) - Phase 1D Refactor (Manager calls updated)
 * 
 * Description: Handles all image operations including team logos and generic Drive images.
 * Provides base64 conversion for Google Drive hosted images to bypass CORS issues.
 *
 * CHANGELOG:
 * 1.2.0 - 2025-06-09 - Consolidated all image handling, added getDriveImageAsBase64 for generic use
 * 1.1.0 - 2025-06-09 - Added getTeamLogoAsBase64 and getMultipleTeamLogosAsBase64 for frontend display
 * 1.0.1 - 2025-05-30 - Ensured explicit calls to TeamDataManager.
 * 1.0.0 - 2025-05-30 - Phase 1C: Initial implementation for web app architecture.
 */

// =============================================================================
// GENERIC DRIVE IMAGE OPERATIONS
// =============================================================================

/**
 * Convert any Google Drive hosted image to base64 for display in web app
 * @param {string} driveUrl - Google Drive URL or any image URL
 * @returns {Object} Response with base64 data or direct URL
 */
function imageService_getDriveImageAsBase64(driveUrl) {
  const CONTEXT = "ImageService.getDriveImageAsBase64";
  try {
    if (!driveUrl || typeof driveUrl !== 'string') {
      return createSuccessResponse({
        imageBase64: null,
        mimeType: null
      }, "No URL provided");
    }
    
    // Extract file ID from Drive URL
    const fileIdMatch = driveUrl.match(/id=([a-zA-Z0-9_-]+)/);
    if (!fileIdMatch || !fileIdMatch[1]) {
      // Not a Drive URL, return as direct URL
      return createSuccessResponse({
        imageBase64: null,
        mimeType: null,
        directUrl: driveUrl
      }, "Non-Drive URL provided");
    }
    
    try {
      const file = DriveApp.getFileById(fileIdMatch[1]);
      const blob = file.getBlob();
      
      // Validate it's an image
      const contentType = blob.getContentType();
      if (!contentType.startsWith('image/')) {
        return createErrorResponse(`File is not an image: ${contentType}`);
      }
      
      const base64 = Utilities.base64Encode(blob.getBytes());
      
      return createSuccessResponse({
        imageBase64: base64,
        mimeType: contentType
      }, "Image retrieved successfully");
      
    } catch (e) {
      Logger.log(`${CONTEXT}: Error accessing Drive file: ${e.message}`);
      return createErrorResponse(`Could not access image file: ${e.message}`);
    }
    
  } catch (e) {
    return handleError(e, CONTEXT);
  }
}

// =============================================================================
// TEAM LOGO FILE OPERATIONS
// =============================================================================

function uploadLogoFile(base64Data, fileName, mimeType, teamId) {
  const CONTEXT = "ImageService.uploadLogoFile";
  try {
    // Logger.log(`${CONTEXT}: Processing file upload for team ${teamId}: ${fileName} (${mimeType})`);
    
    const blob = Utilities.newBlob(Utilities.base64Decode(base64Data), mimeType, fileName);
    const validation = validateLogoFile(blob); // from Configuration.js
    if (!validation.isValid) {
      return createErrorResponse(`File validation failed: ${validation.errors.join(', ')}`, { errors: validation.errors });
    }
    
    const teamData = getTeamData(teamId); // Direct call to global function
    if (!teamData) { // getTeamData returns null if not found
      return createErrorResponse(`Team not found: ${teamId}`);
    }
    
    const saveResult = saveTeamLogoToDrive(blob, teamData.teamName);
    if (!saveResult.success) return saveResult;
    
    const updateResult = updateTeamLogoUrl(teamId, saveResult.publicUrl); // Calls local updateTeamLogoUrl
    if (!updateResult.success) {
      Logger.log(`${CONTEXT}: Warning - Failed to update team logo URL in database: ${updateResult.message}`);
    }
    
    // Logger.log(`${CONTEXT}: File upload completed successfully for team ${teamId}: ${saveResult.publicUrl}`);
    return createSuccessResponse({
      teamId: teamId, teamName: teamData.teamName, logoUrl: saveResult.publicUrl, fileName: saveResult.fileName
    }, `Logo uploaded successfully for team "${teamData.teamName}"`);
    
  } catch (e) {
    return handleError(e, CONTEXT); // from Configuration.js
  }
}

function fetchAndSaveTeamLogo(imageUrl, teamId) {
  const CONTEXT = "ImageService.fetchAndSaveTeamLogo";
  try {
    // Logger.log(`${CONTEXT}: Fetching logo from ${imageUrl} for team ${teamId}`);
    
    const urlValidation = validateLogoUrl(imageUrl); // from Configuration.js
    if (!urlValidation.isValid) {
      return createErrorResponse(`URL validation failed: ${urlValidation.errors.join(', ')}`, { errors: urlValidation.errors });
    }
    
    const teamData = getTeamData(teamId); // Direct call
    if (!teamData) {
      return createErrorResponse(`Team not found: ${teamId}`);
    }
    
    let response;
    try {
      response = UrlFetchApp.fetch(imageUrl, { muteHttpExceptions: true, followRedirects: true });
    } catch (e) {
      return createErrorResponse(`Failed to fetch image from URL: ${e.message}`);
    }
    
    if (response.getResponseCode() !== 200) {
      return createErrorResponse(`Failed to fetch image: HTTP ${response.getResponseCode()}`);
    }
    
    const imageBlob = response.getBlob();
    const validation = validateLogoFile(imageBlob);
    if (!validation.isValid) {
      return createErrorResponse(`Fetched file validation failed: ${validation.errors.join(', ')}`, { errors: validation.errors });
    }
    
    const saveResult = saveTeamLogoToDrive(imageBlob, teamData.teamName);
    if (!saveResult.success) return saveResult;
    
    const updateResult = updateTeamLogoUrl(teamId, saveResult.publicUrl);
    if (!updateResult.success) {
      Logger.log(`${CONTEXT}: Warning - Failed to update team logo URL in database: ${updateResult.message}`);
    }
    
    // Logger.log(`${CONTEXT}: URL fetch completed for team ${teamId}: ${saveResult.publicUrl}`);
    return createSuccessResponse({
      teamId: teamId, teamName: teamData.teamName, logoUrl: saveResult.publicUrl,
      fileName: saveResult.fileName, originalUrl: imageUrl
    }, `Logo saved successfully from URL for team "${teamData.teamName}"`);
    
  } catch (e) {
    return handleError(e, CONTEXT);
  }
}

function saveTeamLogoToDrive(imageBlob, teamName) {
  const CONTEXT = "ImageService.saveTeamLogoToDrive";
  try {
    const cleanTeamName = teamName.toLowerCase().replace(/[^a-zA-Z0-9]/g, '');
    let fileExtension = getExtensionFromContentType(imageBlob.getContentType()); // local helper
    if (!fileExtension) fileExtension = 'png'; 
    const fileName = `${cleanTeamName}.${fileExtension}`.substring(0, 250); // Ensure filename isn't too long

    let logoFolder;
    try {
      logoFolder = DriveApp.getFolderById(BLOCK_CONFIG.LOGO.DRIVE_FOLDER_ID);
    } catch (e) {
      return createErrorResponse(`Logo Drive folder not accessible: ${e.message}. Check ID: ${BLOCK_CONFIG.LOGO.DRIVE_FOLDER_ID}`);
    }
    
    deleteExistingTeamLogo(logoFolder, cleanTeamName); // local helper
    
    let file;
    try {
      file = logoFolder.createFile(imageBlob.setName(fileName));
    } catch (e) {
      return createErrorResponse(`Failed to create file in Drive: ${e.message}`);
    }
    
    try {
      file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
    } catch (e) {
      Logger.log(`${CONTEXT}: Warning - Could not set public sharing for ${fileName}: ${e.message}`);
    }
    
    const publicUrl = `https://drive.google.com/uc?id=${file.getId()}`;
    // Logger.log(`${CONTEXT}: Successfully saved logo as ${fileName}, public URL: ${publicUrl}`);
    return createSuccessResponse({ publicUrl: publicUrl, fileName: fileName, fileId: file.getId(), teamName: teamName }, `Logo saved as ${fileName}`);
  } catch (e) {
    return handleError(e, CONTEXT);
  }
}

function updateTeamLogoUrl(teamId, logoUrl = "") {
  const CONTEXT = "ImageService.updateTeamLogoUrl";
  try {
    // Logger.log(`${CONTEXT}: Updating logo URL for team ${teamId}: ${logoUrl}`);
    const validation = validateLogoUrl(logoUrl); // from Configuration.js
    if (!validation.isValid) {
      return createErrorResponse(`Invalid logo URL: ${validation.errors.join(', ')}`);
    }
    
    // Call updateTeam - requestingUserEmail assumed to be system or already validated by API layer
    const updateResult = updateTeam(teamId, { logoUrl: logoUrl.trim() }, BLOCK_CONFIG.ADMIN.SYSTEM_EMAIL); // Direct call
    
    if (updateResult.success) {
      // Logger.log(`${CONTEXT}: ✅ Logo URL updated for team ${teamId}`);
      return createSuccessResponse({ teamId: teamId, logoUrl: logoUrl.trim() }, logoUrl ? "Logo URL updated." : "Logo URL cleared.");
    } else {
      return createErrorResponse(`Failed to update team record with logo URL: ${updateResult.message}`, updateResult);
    }
  } catch (e) {
    return handleError(e, CONTEXT);
  }
}

function deleteTeamLogo(teamId) {
  const CONTEXT = "ImageService.deleteTeamLogo";
  try {
    // Logger.log(`${CONTEXT}: Deleting logo for team ${teamId}`);
    const teamData = getTeamData(teamId); // Direct call
    if (!teamData) {
      return createErrorResponse(`Team not found: ${teamId}`);
    }
    const currentLogoUrl = teamData.logoUrl;
    
    const clearDbResult = updateTeamLogoUrl(teamId, ""); // This calls updateTeam
    if (!clearDbResult.success) {
      Logger.log(`${CONTEXT}: Warning - Could not clear logo URL from database for ${teamId}: ${clearDbResult.message}`);
      // Continue to attempt Drive file deletion if URL was present
    }
    
    if (currentLogoUrl && currentLogoUrl.includes('drive.google.com')) {
      try {
        const fileIdMatch = currentLogoUrl.match(/id=([a-zA-Z0-9_-]+)/);
        if (fileIdMatch && fileIdMatch[1]) {
          const fileId = fileIdMatch[1];
          DriveApp.getFileById(fileId).setTrashed(true);
          // Logger.log(`${CONTEXT}: Deleted logo file from Drive: ${fileId}`);
        }
      } catch (e) {
        Logger.log(`${CONTEXT}: Warning - Could not delete logo file from Drive (${currentLogoUrl}): ${e.message}`);
      }
    }
    
    // Logger.log(`${CONTEXT}: ✅ Logo deletion process completed for team ${teamId}`);
    return createSuccessResponse({ teamId: teamId, teamName: teamData.teamName, previousLogoUrl: currentLogoUrl }, 
      `Logo deletion process for team "${teamData.teamName}" completed.`);
  } catch (e) {
    return handleError(e, CONTEXT);
  }
}

// =============================================================================
// BASE64 CONVERSION FUNCTIONS FOR TEAM LOGOS
// =============================================================================

function imageService_getTeamLogoAsBase64(teamId) {
  const CONTEXT = "ImageService.getTeamLogoAsBase64";
  try {
    // Get team data to find logo URL
    const teamData = getTeamData(teamId); // Direct call to global function
    if (!teamData || !teamData.logoUrl) {
      return createSuccessResponse({
        teamId: teamId,
        logoBase64: null,
        mimeType: null
      }, "No logo found for team");
    }
    
    // Use the generic function to handle the conversion
    const imageResult = imageService_getDriveImageAsBase64(teamData.logoUrl);
    
    // Map the response to match the expected structure for team logos
    if (imageResult.success) {
      return createSuccessResponse({
        teamId: teamId,
        logoBase64: imageResult.imageBase64,
        mimeType: imageResult.mimeType,
        directUrl: imageResult.directUrl
      }, imageResult.message);
    } else {
      return imageResult; // Pass through error response
    }
    
  } catch (e) {
    return handleError(e, CONTEXT);
  }
}

// Batch operation for performance
function imageService_getMultipleTeamLogosAsBase64(teamIds) {
  const CONTEXT = "ImageService.getMultipleTeamLogosAsBase64";
  try {
    const results = {};
    
    // Process each team ID
    teamIds.forEach(teamId => {
      const logoResult = imageService_getTeamLogoAsBase64(teamId);
      if (logoResult.success) {
        if (logoResult.logoBase64) {
          results[teamId] = {
            base64: logoResult.logoBase64,
            mimeType: logoResult.mimeType
          };
        } else if (logoResult.directUrl) {
          results[teamId] = {
            directUrl: logoResult.directUrl
          };
        }
      }
    });
    
    return createSuccessResponse({
      logos: results
    }, `Retrieved ${Object.keys(results).length} logos`);
    
  } catch (e) {
    return handleError(e, CONTEXT);
  }
}

// =============================================================================
// UTILITY FUNCTIONS (Local to ImageService)
// =============================================================================
function deleteExistingTeamLogo(folder, cleanTeamName) {
  try {
    const files = folder.getFiles();
    let deletedCount = 0;
    while (files.hasNext()) {
      const file = files.next();
      if (file.getName().startsWith(cleanTeamName + ".")) {
        file.setTrashed(true);
        deletedCount++;
      }
    }
    return { success: true, deletedCount: deletedCount };
  } catch (e) {
    Logger.log(`ImageService.deleteExistingTeamLogo: Warning - ${e.message}`);
    return { success: false, message: e.message };
  }
}

function getExtensionFromContentType(contentType) {
  const typeMap = {'image/png':'png', 'image/jpeg':'jpg', 'image/jpg':'jpg', 'image/gif':'gif', 'image/webp':'webp'};
  return typeMap[String(contentType).toLowerCase()] || null;
}

// =============================================================================
// PUBLIC GETTERS (Used by WebAppAPI typically)
// =============================================================================
function getTeamLogoUrl(teamId) {
  const CONTEXT = "ImageService.getTeamLogoUrl";
  try {
    const teamData = getTeamData(teamId); // Direct call
    if (!teamData) {
      return createErrorResponse(`Team not found: ${teamId}`);
    }
    const logoUrl = teamData.logoUrl || "";
    return createSuccessResponse({
      teamId: teamId, teamName: teamData.teamName, logoUrl: logoUrl, hasLogo: logoUrl.length > 0
    }, logoUrl ? "Logo URL retrieved" : "No logo set for this team");
  } catch (e) {
    return handleError(e, CONTEXT);
  }
}

function convertDiscordImageToBase64() {
  const imageUrl = "https://drive.google.com/uc?id=1a0ydLZEVfQpZyMxccvOI8Hw03gQfHseN";
  const result = imageService_getDriveImageAsBase64(imageUrl);
  
  if (result.success && result.imageBase64) {
    const dataUrl = `data:${result.mimeType};base64,${result.imageBase64}`;
    
    // This will be too long for Logger.log, so let's save it to a document
    const doc = DocumentApp.create('Discord Image Base64');
    doc.getBody().appendParagraph(dataUrl);
    
    Logger.log('Base64 data URL saved to document: ' + doc.getUrl());
    Logger.log('Length: ' + dataUrl.length + ' characters');
  }
}