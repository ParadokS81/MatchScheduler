// teamStatus.js - Team status check functionality
// TODO: Implement according to Technical PRD Section 6.1

const functions = require('firebase-functions');
const admin = require('firebase-admin');
const { FieldValue } = require("firebase-admin/firestore");
const { EVENT_TYPES, logTeamLifecycleEvent } = require('../utils/helpers');
const db = admin.firestore();

// Constants for business rules
const BATCH_SIZE = 250; // Reduced from 500 for better memory management
const BATCH_DELAY_MS = 1000; // 1 second delay between batches
const MAX_JOIN_CODE_RETRIES = 10;
const INACTIVITY_THRESHOLD_DAYS = 14;
const JOIN_CODE_EXPIRY_DAYS = 30;
const MIN_TEAM_AGE_DAYS = 14; // Don't mark teams inactive if younger than this

// Helper function to generate unique join code
function generateJoinCode() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

// Helper function to add delay between batches
const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// Helper function to check if a team should be marked inactive
function shouldMarkInactive(teamData, inactivityCutoff) {
  // Don't mark teams as inactive if they're too new
  const createdAt = teamData.createdAt?.toDate() || new Date(0);
  const minAgeDate = new Date(Date.now() - (MIN_TEAM_AGE_DAYS * 24 * 60 * 60 * 1000));
  if (createdAt > minAgeDate) {
    return false;
  }

  // Check lastActivityAt, defaulting to createdAt if not set
  const lastActivity = teamData.lastActivityAt?.toDate() || createdAt;
  return lastActivity < inactivityCutoff;
}

// Helper function to process teams in batches with improved error handling
async function processBatch(query, processor, jobId) {
  let lastDoc = null;
  let processedCount = 0;
  let failedTeams = [];
  let batchNumber = 0;

  try {
    do {
      batchNumber++;
      console.log(`Processing batch #${batchNumber} for job ${jobId}...`);
      
      let batchQuery = query.limit(BATCH_SIZE);
      if (lastDoc) {
        batchQuery = batchQuery.startAfter(lastDoc);
      }

      const snapshot = await batchQuery.get();
      if (snapshot.empty) break;

      const batch = db.batch();
      let batchCount = 0;
      let batchPromises = [];

      for (const doc of snapshot.docs) {
        try {
          const result = await processor(doc, batch);
          if (result.success) {
            batchCount++;
          } else {
            failedTeams.push({ id: doc.id, error: result.error });
          }
          batchPromises.push(result);
        } catch (error) {
          console.error(`Error processing team ${doc.id} in batch ${batchNumber}:`, error);
          failedTeams.push({ id: doc.id, error: error.message });
        }
      }

      if (batchCount > 0) {
        try {
          await batch.commit();
          processedCount += batchCount;
          console.log(`Batch #${batchNumber} committed successfully: ${batchCount} teams processed`);
        } catch (error) {
          console.error(`Error committing batch #${batchNumber}:`, error);
          // Add all teams in this batch to failedTeams
          snapshot.docs.forEach(doc => {
            failedTeams.push({ id: doc.id, error: 'Batch commit failed' });
          });
        }
      }

      lastDoc = snapshot.docs[snapshot.docs.length - 1];

      // Add delay between batches to avoid rate limits
      if (lastDoc) {
        await delay(BATCH_DELAY_MS);
      }

    } while (lastDoc);

    return {
      processedCount,
      failedTeams
    };
  } catch (error) {
    console.error(`Error in batch processing for job ${jobId}:`, error);
    return {
      processedCount,
      failedTeams,
      error: error.message
    };
  }
}

// Helper function to generate unique join code with retries
async function generateUniqueJoinCode(retries = 0) {
  if (retries >= MAX_JOIN_CODE_RETRIES) {
    throw new Error('Failed to generate unique join code after maximum retries');
  }

  const code = generateJoinCode();
  const existingCode = await db.collection('teams')
    .where('joinCode', '==', code)
    .get(); // Check all teams regardless of active status

  if (existingCode.empty) {
    return code;
  }

  return generateUniqueJoinCode(retries + 1);
}

exports.checkTeamActivity = functions.pubsub
  .schedule('0 2 * * *')  // Daily at 2 AM
  .timeZone('UTC')
  .onRun(async (context) => {
    try {
      console.log('Starting daily team activity check...');

      // Calculate cutoff timestamps
      const now = admin.firestore.Timestamp.now();
      const fourteenDaysAgo = new admin.firestore.Timestamp(
        now.seconds - (14 * 24 * 60 * 60),
        now.nanoseconds
      );
      const thirtyDaysAgo = new admin.firestore.Timestamp(
        now.seconds - (30 * 24 * 60 * 60),
        now.nanoseconds
      );

      // Get all active, non-archived teams
      const teams = await db.collection('teams')
        .where('active', '==', true)
        .where('archived', '==', false)
        .get();

      let inactiveCount = 0;
      let regeneratedCount = 0;
      const inactiveTeams = [];
      const batch = db.batch();

      teams.forEach(doc => {
        const team = doc.data();
        let updates = {};
        
        // Check for inactivity (only for non-archived teams)
        if (!team.archived && team.lastActivityAt && team.lastActivityAt < fourteenDaysAgo) {
          updates.active = false;  // Mark as inactive (but still recoverable)
          updates.statusChangedAt = FieldValue.serverTimestamp();
          inactiveCount++;
          
          // Log team inactive event (we'll do this in a separate batch after the main updates)
          inactiveTeams.push({
            teamId: doc.id,
            teamName: team.teamName,
            lastActivity: team.lastActivityAt?.toDate() || team.createdAt?.toDate()
          });
        }
        
        // Check for old join code
        if (team.joinCodeCreatedAt && team.joinCodeCreatedAt < thirtyDaysAgo) {
          updates.joinCode = generateJoinCode();
          updates.joinCodeCreatedAt = FieldValue.serverTimestamp();
          regeneratedCount++;
        }
        
        if (Object.keys(updates).length > 0) {
          batch.update(doc.ref, updates);
        }
      });

      await batch.commit();

      // Log team inactive events in a separate batch
      if (inactiveTeams.length > 0) {
        for (const team of inactiveTeams) {
          await logTeamLifecycleEvent(db, null, EVENT_TYPES.TEAM_INACTIVE, {
            teamId: team.teamId,
            teamName: team.teamName,
            details: {
              lastActivity: team.lastActivity,
              inactivityDays: Math.floor((Date.now() - team.lastActivity.getTime()) / (1000 * 60 * 60 * 24))
            }
          });
        }
      }

      console.log(`Scheduled job complete: ${inactiveCount} teams marked inactive, ${regeneratedCount} join codes regenerated`);
      return null;

    } catch (error) {
      console.error('Error in checkTeamActivity:', error);
      return null;
    }
  }); 