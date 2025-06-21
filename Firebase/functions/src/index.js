const functions = require('firebase-functions');
const admin = require('firebase-admin');

// Initialize Firebase Admin
admin.initializeApp();

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