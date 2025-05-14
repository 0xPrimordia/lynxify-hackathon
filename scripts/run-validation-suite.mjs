#!/usr/bin/env node

/**
 * Validation Suite Runner
 * 
 * This script automates running all validation tests in sequence
 * and generates a comprehensive validation report.
 * 
 * Usage:
 *   node scripts/run-validation-suite.mjs
 */

import { exec } from 'child_process';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import util from 'util';

const execPromise = util.promisify(exec);
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.resolve(__dirname, '..');

// Validation tests to run
const validationTests = [
  {
    id: 1,
    name: 'SDK Version Check',
    command: 'npm run check:sdk-versions',
    successCriteria: 'No missing packages'
  },
  {
    id: 2,
    name: 'Connection API Test',
    command: 'npm run test:connection:api',
    successCriteria: 'Connection methods available'
  },
  {
    id: 3,
    name: 'Connection Validation',
    command: 'npm run test:agent:connection',
    successCriteria: 'All connections valid'
  },
  {
    id: 4,
    name: 'Connection Repair',
    command: 'npm run fix:connections',
    successCriteria: 'All connections "established"'
  },
  {
    id: 5,
    name: 'Message Format Test',
    command: 'npm run test:agent:message',
    successCriteria: '≥80% format compatibility'
  }
];

// Validation results
const results = {
  timestamp: new Date().toISOString(),
  tests: [],
  summary: {
    total: validationTests.length,
    passed: 0,
    failed: 0,
    skipped: 0
  }
};

async function runTest(test) {
  console.log(`\n=== Running Test #${test.id}: ${test.name} ===`);
  console.log(`Command: ${test.command}`);
  console.log(`Success Criteria: ${test.successCriteria}`);
  
  const startTime = Date.now();
  const result = {
    id: test.id,
    name: test.name,
    command: test.command,
    successCriteria: test.successCriteria,
    startTime: new Date(startTime).toISOString(),
    endTime: null,
    duration: null,
    output: null,
    error: null,
    status: 'running'
  };
  
  try {
    const { stdout, stderr } = await execPromise(test.command);
    const endTime = Date.now();
    
    result.endTime = new Date(endTime).toISOString();
    result.duration = endTime - startTime;
    result.output = stdout;
    result.error = stderr || null;
    result.status = stderr ? 'failed' : 'passed';
    
    console.log(`Output: ${stdout.substring(0, 200)}${stdout.length > 200 ? '...[truncated]' : ''}`);
    
    if (stderr) {
      console.error(`Error: ${stderr}`);
      results.summary.failed++;
    } else {
      console.log('✅ Test passed');
      results.summary.passed++;
    }
  } catch (error) {
    const endTime = Date.now();
    result.endTime = new Date(endTime).toISOString();
    result.duration = endTime - startTime;
    result.error = error.message;
    result.status = 'failed';
    
    console.error(`❌ Test failed: ${error.message}`);
    results.summary.failed++;
  }
  
  results.tests.push(result);
  return result;
}

async function main() {
  console.log('🚀 Starting Validation Suite');
  console.log(`Timestamp: ${results.timestamp}`);
  console.log(`Total tests: ${validationTests.length}`);
  
  // Create validation-reports directory if it doesn't exist
  const reportsDir = path.join(PROJECT_ROOT, 'validation-reports');
  try {
    await fs.mkdir(reportsDir, { recursive: true });
  } catch (error) {
    console.error(`Error creating reports directory: ${error.message}`);
  }
  
  // Run all tests sequentially
  for (const test of validationTests) {
    await runTest(test);
  }
  
  // Generate report
  const reportPath = path.join(reportsDir, `validation-report-${Date.now()}.json`);
  await fs.writeFile(reportPath, JSON.stringify(results, null, 2));
  
  // Generate HTML report
  const htmlReport = generateHtmlReport(results);
  const htmlReportPath = path.join(reportsDir, `validation-report-${Date.now()}.html`);
  await fs.writeFile(htmlReportPath, htmlReport);
  
  // Print summary
  console.log('\n=== Validation Suite Summary ===');
  console.log(`Total tests: ${results.summary.total}`);
  console.log(`Passed: ${results.summary.passed}`);
  console.log(`Failed: ${results.summary.failed}`);
  console.log(`Skipped: ${results.summary.skipped}`);
  console.log(`Results saved to: ${reportPath}`);
  console.log(`HTML Report saved to: ${htmlReportPath}`);
}

function generateHtmlReport(results) {
  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>HCS-10 Agent Validation Report</title>
  <style>
    body { font-family: Arial, sans-serif; margin: 0; padding: 20px; }
    .header { background-color: #f0f0f0; padding: 20px; border-radius: 5px; margin-bottom: 20px; }
    .summary { display: flex; gap: 20px; margin-bottom: 20px; }
    .summary-box { padding: 15px; border-radius: 5px; text-align: center; flex: 1; }
    .total { background-color: #e3f2fd; }
    .passed { background-color: #e8f5e9; }
    .failed { background-color: #ffebee; }
    .skipped { background-color: #fff8e1; }
    .test { margin-bottom: 20px; border: 1px solid #ddd; border-radius: 5px; overflow: hidden; }
    .test-header { padding: 10px; display: flex; justify-content: space-between; align-items: center; }
    .test-passed { background-color: #e8f5e9; }
    .test-failed { background-color: #ffebee; }
    .test-details { padding: 15px; background-color: #f9f9f9; display: none; }
    .test-output { white-space: pre-wrap; background-color: #f5f5f5; padding: 10px; border-radius: 5px; }
    .test-error { white-space: pre-wrap; background-color: #ffebee; padding: 10px; border-radius: 5px; margin-top: 10px; }
    .collapsible { cursor: pointer; }
  </style>
</head>
<body>
  <div class="header">
    <h1>HCS-10 Agent Validation Report</h1>
    <p>Timestamp: ${results.timestamp}</p>
  </div>
  
  <div class="summary">
    <div class="summary-box total">
      <h2>${results.summary.total}</h2>
      <p>Total Tests</p>
    </div>
    <div class="summary-box passed">
      <h2>${results.summary.passed}</h2>
      <p>Passed</p>
    </div>
    <div class="summary-box failed">
      <h2>${results.summary.failed}</h2>
      <p>Failed</p>
    </div>
    <div class="summary-box skipped">
      <h2>${results.summary.skipped}</h2>
      <p>Skipped</p>
    </div>
  </div>
  
  <h2>Test Results</h2>
  ${results.tests.map(test => `
    <div class="test">
      <div class="test-header ${test.status === 'passed' ? 'test-passed' : 'test-failed'} collapsible" onclick="toggleDetails(${test.id})">
        <h3>Test #${test.id}: ${test.name}</h3>
        <span>${test.status.toUpperCase()}</span>
      </div>
      <div class="test-details" id="details-${test.id}">
        <p><strong>Command:</strong> ${test.command}</p>
        <p><strong>Success Criteria:</strong> ${test.successCriteria}</p>
        <p><strong>Duration:</strong> ${Math.round(test.duration / 1000)} seconds</p>
        <p><strong>Start Time:</strong> ${test.startTime}</p>
        <p><strong>End Time:</strong> ${test.endTime}</p>
        ${test.output ? `<h4>Output:</h4><div class="test-output">${escapeHtml(test.output)}</div>` : ''}
        ${test.error ? `<h4>Error:</h4><div class="test-error">${escapeHtml(test.error)}</div>` : ''}
      </div>
    </div>
  `).join('')}
  
  <script>
    function toggleDetails(id) {
      const details = document.getElementById('details-' + id);
      details.style.display = details.style.display === 'block' ? 'none' : 'block';
    }
  </script>
</body>
</html>
  `;
}

function escapeHtml(unsafe) {
  return unsafe
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

main().catch(error => {
  console.error(`❌ Validation suite failed: ${error.message}`);
  process.exit(1);
}); 