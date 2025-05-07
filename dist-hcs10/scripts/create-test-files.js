#!/usr/bin/env node
/**
 * File Creation Test Script
 * This script tests if we can create files in the current directory
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
// Get directory name in ESM
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
// Files to test
const TEST_FILES = {
    connections: '.connections.json',
    pendingProposals: '.pending_proposals.json',
    executedProposals: '.executed_proposals.json'
};
// Test data
const testData = {
    connections: [{ id: 'test-connection-id', requesterTopic: 'test-topic', timestamp: Date.now() }],
    pendingProposals: [{ id: 'test-proposal-id', proposal: { type: 'RebalanceProposal' }, timestamp: Date.now() }],
    executedProposals: [{ id: 'test-execution-id', proposalId: 'test-proposal-id', executedAt: Date.now() }]
};
// Main function
async function main() {
    console.log('🧪 Starting file writing test');
    const cwd = process.cwd();
    console.log(`Current working directory: ${cwd}`);
    // Check file permissions
    try {
        fs.accessSync(cwd, fs.constants.W_OK);
        console.log(`✅ Directory ${cwd} is writable`);
    }
    catch (error) {
        console.error(`❌ Cannot write to directory ${cwd}:`, error);
    }
    // Write test files
    for (const [key, filename] of Object.entries(TEST_FILES)) {
        const filePath = path.join(cwd, filename);
        try {
            fs.writeFileSync(filePath, JSON.stringify(testData[key], null, 2));
            console.log(`✅ Successfully wrote to ${filePath}`);
            // Verify file exists and read content back
            const content = fs.readFileSync(filePath, 'utf8');
            console.log(`✅ Successfully read from ${filePath}`);
            // Delete the test file
            fs.unlinkSync(filePath);
            console.log(`✅ Successfully deleted ${filePath}`);
        }
        catch (error) {
            console.error(`❌ Error with file ${filePath}:`, error);
        }
    }
    console.log('✅ File writing test completed');
}
// Run the test
main();
