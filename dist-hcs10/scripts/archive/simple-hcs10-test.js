#!/usr/bin/env node
/**
 * Simple Test Script for HCS-10 Agent
 * This script tests basic connectivity with the HCS-10 agent
 */
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import fs from 'fs';
import dotenv from 'dotenv';
// Load environment variables
dotenv.config({ path: '.env.local' });
// Get directory name in ESM
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
// Function to log with timestamp
function log(message) {
    const now = new Date().toISOString();
    console.log(`[${now}] ${message}`);
}
// Check if the agent is registered
function checkRegistration() {
    const registrationPath = join(process.cwd(), '.registration_status.json');
    if (!fs.existsSync(registrationPath)) {
        log('❌ Agent not registered. Please run the registration script first.');
        return false;
    }
    try {
        const data = fs.readFileSync(registrationPath, 'utf8');
        const info = JSON.parse(data);
        log('✅ Agent registration found:');
        log(`  Account ID: ${info.accountId}`);
        log(`  Inbound Topic ID: ${info.inboundTopicId}`);
        log(`  Outbound Topic ID: ${info.outboundTopicId}`);
        return true;
    }
    catch (error) {
        log(`❌ Error reading registration file: ${error.message}`);
        return false;
    }
}
// Check if there are pending proposals
function checkPendingProposals() {
    const pendingProposalsPath = join(process.cwd(), '.pending_proposals.json');
    if (!fs.existsSync(pendingProposalsPath)) {
        log('ℹ️ No pending proposals file found.');
        return 0;
    }
    try {
        const data = fs.readFileSync(pendingProposalsPath, 'utf8');
        const proposals = JSON.parse(data);
        log(`✅ Found ${proposals.length} pending proposals.`);
        return proposals.length;
    }
    catch (error) {
        log(`❌ Error reading pending proposals: ${error.message}`);
        return 0;
    }
}
// Check if there are executed proposals
function checkExecutedProposals() {
    const executedProposalsPath = join(process.cwd(), '.executed_proposals.json');
    if (!fs.existsSync(executedProposalsPath)) {
        log('ℹ️ No executed proposals file found.');
        return 0;
    }
    try {
        const data = fs.readFileSync(executedProposalsPath, 'utf8');
        const proposals = JSON.parse(data);
        log(`✅ Found ${proposals.length} executed proposals.`);
        return proposals.length;
    }
    catch (error) {
        log(`❌ Error reading executed proposals: ${error.message}`);
        return 0;
    }
}
// Check if there are active connections
function checkConnections() {
    const connectionsPath = join(process.cwd(), '.connections.json');
    if (!fs.existsSync(connectionsPath)) {
        log('ℹ️ No connections file found.');
        return 0;
    }
    try {
        const data = fs.readFileSync(connectionsPath, 'utf8');
        const connections = JSON.parse(data);
        log(`✅ Found ${connections.length} connections.`);
        return connections.length;
    }
    catch (error) {
        log(`❌ Error reading connections: ${error.message}`);
        return 0;
    }
}
// Main function
async function main() {
    log('🚀 Starting HCS-10 Agent Test');
    // Check environment variables
    if (!process.env.NEXT_PUBLIC_OPERATOR_ID || !process.env.OPERATOR_KEY) {
        log('❌ Missing required environment variables.');
        process.exit(1);
    }
    // Check registration
    const isRegistered = checkRegistration();
    if (!isRegistered) {
        process.exit(1);
    }
    // Check connections
    const connectionCount = checkConnections();
    // Check proposals
    const pendingCount = checkPendingProposals();
    const executedCount = checkExecutedProposals();
    log('\n📊 HCS-10 Agent Status Summary:');
    log(`  Registration: ${isRegistered ? '✅ Completed' : '❌ Missing'}`);
    log(`  Connections: ${connectionCount}`);
    log(`  Pending Proposals: ${pendingCount}`);
    log(`  Executed Proposals: ${executedCount}`);
    log('\n✅ Test completed successfully!');
}
main().catch(error => {
    log(`❌ Error in test: ${error.message}`);
    process.exit(1);
});
