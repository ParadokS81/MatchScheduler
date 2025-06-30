// Load environment variables for all tests
// Look for .env file in the project root (two levels up from functions/)
require('dotenv').config({ path: '../../.env' });

console.log('Test environment loaded - Firebase Project:', process.env.FIREBASE_PROJECT_ID);
console.log('Working directory:', process.cwd());
console.log('Looking for .env at:', require('path').resolve('../../.env')); 