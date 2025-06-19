/**
 * Import function triggers from their respective submodules:
 *
 * const {onCall} = require("firebase-functions/v2/https");
 * const {onDocumentWritten} = require("firebase-functions/v2/firestore");
 *
 * See a full list of supported triggers at https://firebase.google.com/docs/functions
 */

const {onRequest} = require("firebase-functions/v2/https");
const logger = require("firebase-functions/logger");
const {onCall, HttpsError} = require("firebase-functions/v2/https");
const {initializeApp} = require("firebase-admin/app");
const {getFirestore, FieldValue} = require("firebase-admin/firestore");
const functions = require("firebase-functions");
const {getAuth} = require("firebase-admin/auth");

initializeApp();

// Create and deploy your first functions
// https://firebase.google.com/docs/functions/get-started

// exports.helloWorld = onRequest((request, response) => {
//   logger.info("Hello logs!", {structuredData: true});
//   response.send("Hello from Firebase!");
// });

/**
 * Fetches the global application configuration document.
 * This is intended to be called by the client when the app loads.
 * @returns {Promise<Object>} A promise that resolves to the global config object.
 */
exports.getGlobalConfig = onCall(async () => {
  const db = getFirestore();
  const configRef = db.collection("configuration").doc("global");
  const configDoc = await configRef.get();

  if (!configDoc.exists) {
    // If you see this error, it means you need to create the 'global' document
    // in the 'configuration' collection in your Firebase Console.
    throw new HttpsError(
      "not-found",
      "Global configuration not found.",
    );
  }

  return configDoc.data();
});

/**
 * Allows an authenticated user to join a team using a join code.
 * @param {Object} data The data passed to the function.
 * @param {string} data.joinCode The team's join code.
 * @param {string} data.initials The player's desired initials for this team.
 * @param {Object} context The context of the function call.
 * @param {Object} context.auth The authenticated user's data.
 * @returns {Promise<{success: boolean, teamId: string}>} A promise that resolves to a success message.
 */
exports.joinTeamWithCode = onCall(async ({ initials, joinCode }, context) => {
  // Ensure the user is authenticated.
  if (!context.auth) {
    throw new HttpsError(
      "unauthenticated",
      "You must be logged in to join a team.",
    );
  }

  const {uid: playerId} = context.auth;

  if (!joinCode || !initials) {
    throw new HttpsError(
      "invalid-argument",
      "Join code and initials must be provided.",
    );
  }

  const db = getFirestore();
  const auth = getAuth();

  // Get the full user record to access properties like displayName and email
  const userRecord = await auth.getUser(playerId);
  const displayName = userRecord.displayName || 'Unknown Player';
  const email = userRecord.email || null;

  const teamsRef = db.collection("teams");

  // 1. Find the team with the matching join code.
  const querySnapshot = await teamsRef.where("joinCode", "==", joinCode).limit(1).get();

  if (querySnapshot.empty) {
    throw new HttpsError("not-found", "Invalid join code.");
  }

  const teamDoc = querySnapshot.docs[0];
  const teamId = teamDoc.id;
  const teamData = teamDoc.data();

  const playerRef = db.collection("players").doc(playerId);
  const playerDoc = await playerRef.get();

  // 2. Check if the player is already on the team.
  if (playerDoc.exists) {
    const playerData = playerDoc.data();
    if (playerData.memberOf && playerData.memberOf.some((team) => team.teamId === teamId)) {
      throw new HttpsError(
        "already-exists",
        "You are already a member of this team.",
      );
    }
  }
  
  // TODO: Add logic to check if initials are already taken on the team.
  // This would involve reading the `players` collection for members of this team.
  
  // 3. Add the team to the player's 'memberOf' array.
  const newTeamMembership = {
    teamId: teamId,
    initials: initials,
    role: teamData.leaderEmail === email ? "team_leader" : "player",
  };

  await playerRef.set({
    displayName: displayName,
    googleEmail: email,
    isActive: true,
    memberOf: FieldValue.arrayUnion(newTeamMembership),
  }, {merge: true});


  return {success: true, teamId: teamId};
});

/**
 * Starts the onboarding process for a new user.
 * This function validates the display name and join code, then creates
 * an anonymous user and returns a custom token for sign-in.
 *
 * @param {Object} data The data passed to the function.
 * @param {string} data.displayName The user's desired display name.
 * @param {string} data.joinCode The team's join code.
 * @returns {Promise<{success: boolean, token: string, teamName: string}>} A promise that resolves to the custom token and team name.
 */
exports.startOnboarding = onCall(async (data) => {
  const {displayName, joinCode} = data;
  const db = getFirestore();
  const auth = getAuth();

  if (!displayName || !joinCode) {
    throw new HttpsError(
      "invalid-argument",
      "Display name and join code must be provided.",
    );
  }

  // 1. Check if displayName is already taken in the 'players' collection.
  const playersRef = db.collection("players");
  const nameQuerySnapshot = await playersRef.where("displayName", "==", displayName).limit(1).get();
  if (!nameQuerySnapshot.empty) {
    throw new HttpsError("already-exists", `The nickname "${displayName}" is already taken. Please choose another.`);
  }

  // 2. Check if the joinCode is valid by querying the 'teams' collection.
  const teamsRef = db.collection("teams");
  const teamQuerySnapshot = await teamsRef.where("joinCode", "==", joinCode).limit(1).get();
  if (teamQuerySnapshot.empty) {
    throw new HttpsError("not-found", "The join code is not valid.");
  }
  const teamName = teamQuerySnapshot.docs[0].data().teamName;

  // 3. Create a new anonymous Firebase Auth user.
  const userRecord = await auth.createUser({
    displayName: displayName,
  });

  // 4. Create a custom token to sign the user in on the client.
  const customToken = await auth.createCustomToken(userRecord.uid);

  return {success: true, token: customToken, teamName: teamName};
});
