/**
 * Main Firebase Functions Entry Point
 * Imports and exports all functions from src/ directory
 */

const {setGlobalOptions} = require("firebase-functions");

// For cost control, set maximum concurrent instances
setGlobalOptions({ maxInstances: 10 });

// Import all functions from src directory
const functions = require('./src/index');

// Export all functions
module.exports = functions;
