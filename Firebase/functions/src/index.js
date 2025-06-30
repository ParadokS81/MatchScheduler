const functions = require('firebase-functions');
const admin = require('firebase-admin');

console.log('INDEX.JS: Before initializeApp, admin.firestore.FieldValue exists?', !!admin.firestore.FieldValue);

// Initialize Firebase Admin
admin.initializeApp({
  projectId: 'matchscheduler-dev'
});

console.log('INDEX.JS: After initializeApp, admin.firestore.FieldValue exists?', !!admin.firestore.FieldValue);

// Import function modules
const { createProfile, updateProfile } = require('./auth/profile');
const { createTeam } = require('./teams/create');
const { joinTeam } = require('./teams/join');
const { leaveTeam } = require('./teams/leave');
const { removePlayer, updateTeamSettings, regenerateJoinCode, transferLeadership } = require('./teams/manage');
const { updateAvailability } = require('./availability/update');
const { checkTeamActivity } = require('./scheduled/teamStatus');

// Export all functions
exports.createProfile = createProfile;
exports.updateProfile = updateProfile;
exports.createTeam = createTeam;
exports.joinTeam = joinTeam;
exports.leaveTeam = leaveTeam;
exports.removePlayer = removePlayer;
exports.updateTeamSettings = updateTeamSettings;
exports.regenerateJoinCode = regenerateJoinCode;
exports.transferLeadership = transferLeadership;
exports.updateAvailability = updateAvailability;
exports.checkTeamActivity = checkTeamActivity; 