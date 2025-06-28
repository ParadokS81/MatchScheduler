const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

// Create logs directory if it doesn't exist
const logsDir = path.join(__dirname, 'logs');
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir);
}

// Generate timestamp for log file
const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
const logFile = path.join(logsDir, `test-run-${timestamp}.log`);
const summaryFile = path.join(logsDir, `test-summary-${timestamp}.txt`);

console.log(`📝 Full logs will be saved to: ${logFile}`);
console.log(`📊 Summary will be saved to: ${summaryFile}`);
console.log('\n🚀 Starting integration tests...\n');

// Create write streams
const logStream = fs.createWriteStream(logFile);
const summaryData = {
  startTime: new Date(),
  tests: {},
  totals: {
    suites: 0,
    passed: 0,
    failed: 0,
    total: 0
  }
};

// Test files to run
const testFiles = [
  'connection.test.js',
  'auth.integration.test.js',
  'teams-clean.integration.test.js',
  'availability.integration.test.js',
  'scheduled.integration.test.js',
  'rules.integration.test.js'
];

// Run tests sequentially
async function runTests() {
  for (const testFile of testFiles) {
    console.log(`\n📋 Running ${testFile}...`);
    summaryData.tests[testFile] = {
      startTime: new Date(),
      status: 'running'
    };

    await new Promise((resolve) => {
      // Use relative path pattern that Jest can understand
      const testPattern = `test/integration/${testFile}`;
      const jest = spawn('npx', ['jest', testPattern, '--verbose', '--no-colors', '--forceExit'], {
        stdio: 'pipe',
        shell: true
      });

      let allOutput = '';

      jest.stdout.on('data', (data) => {
        const text = data.toString();
        logStream.write(`[STDOUT] ${text}`);
        allOutput += text;
      });

      jest.stderr.on('data', (data) => {
        const text = data.toString();
        logStream.write(`[STDERR] ${text}`);
        allOutput += text;
        
        // Parse test results from stderr (Jest outputs test results to stderr)
        if (text.includes('Test Suites:')) {
          // Parse test suite status
          if (text.includes('1 passed, 1 total') && !text.includes('failed')) {
            summaryData.tests[testFile].status = 'passed';
            console.log(`  ✅ ${testFile} - PASSED`);
          } else if (text.includes('failed')) {
            summaryData.tests[testFile].status = 'failed';
            console.log(`  ❌ ${testFile} - FAILED`);
          }
        }
        
        // Parse test counts from the "Tests:" line
        if (text.includes('Tests:')) {
          // Handle format: "Tests:       1 failed, 7 passed, 8 total"
          const testMatch = text.match(/Tests:\s+(?:(\d+)\s+failed,\s*)?(\d+)\s+passed,\s+(\d+)\s+total/);
          if (testMatch) {
            summaryData.tests[testFile].failed = parseInt(testMatch[1] || '0');
            summaryData.tests[testFile].passed = parseInt(testMatch[2]);
            summaryData.tests[testFile].total = parseInt(testMatch[3]);
          }
        }
      });

      jest.on('close', (code) => {
        summaryData.tests[testFile].endTime = new Date();
        summaryData.tests[testFile].duration = 
          (summaryData.tests[testFile].endTime - summaryData.tests[testFile].startTime) / 1000;
        
        // Set status based on exit code if not already set by parsing
        if (!summaryData.tests[testFile].status || summaryData.tests[testFile].status === 'running') {
          if (code === 0) {
            summaryData.tests[testFile].status = 'passed';
            console.log(`  ✅ ${testFile} - PASSED (exit code: ${code})`);
          } else {
            summaryData.tests[testFile].status = 'failed';
            console.log(`  ❌ ${testFile} - FAILED (exit code: ${code})`);
          }
        }
        
        // Set default values if not parsed
        if (!summaryData.tests[testFile].hasOwnProperty('passed')) {
          summaryData.tests[testFile].passed = 0;
          summaryData.tests[testFile].failed = 0;
          summaryData.tests[testFile].total = 0;
        }
        
        resolve();
      });
    });
  }

  // Calculate totals
  for (const test of Object.values(summaryData.tests)) {
    summaryData.totals.suites++;
    summaryData.totals.passed += test.passed || 0;
    summaryData.totals.failed += test.failed || 0;
    summaryData.totals.total += test.total || 0;
  }
  
  summaryData.endTime = new Date();
  summaryData.totalDuration = (summaryData.endTime - summaryData.startTime) / 1000;

  // Generate summary
  generateSummary();
}

function generateSummary() {
  let summary = `
FIREBASE INTEGRATION TEST SUMMARY
=================================
Generated: ${new Date().toLocaleString()}
Total Duration: ${summaryData.totalDuration.toFixed(2)}s

TEST RESULTS BY FILE:
`;

  for (const [file, data] of Object.entries(summaryData.tests)) {
    const status = data.status === 'passed' ? '✅' : 
                   data.status === 'failed' ? '❌' : '⚠️';
    summary += `
${status} ${file}
   Status: ${data.status.toUpperCase()}
   Tests: ${data.passed || 0} passed, ${data.failed || 0} failed, ${data.total || 0} total
   Duration: ${data.duration?.toFixed(2)}s
`;
  }

  summary += `
OVERALL SUMMARY:
================
Test Suites: ${summaryData.totals.suites} total
Tests: ${summaryData.totals.passed} passed, ${summaryData.totals.failed} failed, ${summaryData.totals.total} total
Total Duration: ${summaryData.totalDuration.toFixed(2)}s

${summaryData.totals.failed === 0 ? '🎉 ALL TESTS PASSED!' : '⚠️  Some tests failed - check the full log for details'}

Full log saved to: ${logFile}
`;

  // Write summary to file
  fs.writeFileSync(summaryFile, summary);
  
  // Also display summary in console
  console.log('\n' + '='.repeat(50));
  console.log(summary);
  
  logStream.end();
}

// Run the tests
runTests().catch(console.error); 