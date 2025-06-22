# Integration Test Runner

## Overview

The `runAllTests.js` script provides a comprehensive test runner for all Firebase Cloud Functions integration tests. It runs tests sequentially, captures detailed output, and generates both full logs and summary reports.

## Usage

### Quick Start
```bash
npm run test:integration:full
```

### What It Does
1. **Sequential Execution**: Runs all integration tests one by one to avoid race conditions
2. **Full Logging**: Captures all Jest output to timestamped log files
3. **Summary Generation**: Creates clean summary reports with test counts and durations
4. **Status Tracking**: Shows real-time progress and final results

### Test Files Included
- `connection.test.js` - Basic emulator connectivity
- `auth.integration.test.js` - Authentication and profile management
- `teams-clean.integration.test.js` - Team management operations
- `availability.integration.test.js` - Availability tracking
- `scheduled.integration.test.js` - Scheduled functions

## Output Files

### Logs Directory
All output is saved to `test/integration/logs/` with timestamps:
- `test-run-[timestamp].log` - Complete Jest output with all details
- `test-summary-[timestamp].txt` - Clean summary with test counts and status

### Example Summary
```
FIREBASE INTEGRATION TEST SUMMARY
=================================
Generated: 6/22/2025, 7:01:25 PM
Total Duration: 16.60s

TEST RESULTS BY FILE:

✅ connection.test.js
   Status: PASSED
   Tests: 1 passed, 0 failed, 1 total
   Duration: 2.74s

✅ auth.integration.test.js
   Status: PASSED
   Tests: 9 passed, 0 failed, 9 total
   Duration: 3.03s

❌ teams-clean.integration.test.js
   Status: FAILED
   Tests: 12 passed, 1 failed, 13 total
   Duration: 4.01s

OVERALL SUMMARY:
================
Test Suites: 5 total
Tests: 31 passed, 2 failed, 33 total
Total Duration: 16.60s
```

## Prerequisites

### Firebase Emulators
The tests require Firebase emulators to be running:
```bash
firebase emulators:start --only firestore,auth
```

### Environment
- Node.js 20+
- Firebase CLI
- Jest testing framework

## Individual Test Scripts

You can also run individual test suites:
```bash
npm run test:teams                    # Teams integration tests
npm run test:availability            # Availability integration tests  
npm run test:scheduled              # Scheduled function tests
npm test                           # All tests (parallel)
```

## Troubleshooting

### Common Issues
1. **"No tests found"** - Make sure emulators are running
2. **Connection errors** - Check emulator ports (8080 for Firestore, 9099 for Auth)
3. **Timeouts** - Tests include automatic cleanup, but may need manual emulator restart

### Debug Mode
For detailed debugging, check the full log files in `test/integration/logs/`

## Benefits
- 📝 **Complete Logging**: Every Jest output line is preserved
- 📊 **Clean Summaries**: Easy-to-read test results  
- 🕐 **Timestamped**: Track test runs over time
- 📁 **Organized**: All logs in dedicated directory
- 🚀 **Sequential**: No race conditions between tests
- ✅ **Reliable**: Consistent test execution and cleanup 