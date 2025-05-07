#!/usr/bin/env node
/**
 * HCS-10 Agent Runner
 * This script runs the HCS-10 agent with our mock client implementation
 */
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import fs from 'fs';
import dotenv from 'dotenv';
// Get directory name in ESM
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
// Load environment variables
dotenv.config({ path: join(process.cwd(), '.env.local') });
// Import our mock client and agent
// Note: The path needs to match the output directory from tsconfig.hcs10.json
import { MockHCS10Client } from '../dist/src/lib/mock-hcs10-client.js';
import { HCS10Agent } from '../dist/src/lib/hcs10-agent.js';
// Constants
const REGISTRATION_FILE = join(process.cwd(), '.registration_status.json');
// Log with timestamp
function log(message) {
    const now = new Date().toISOString();
    console.log(`[${now}] ${message}`);
}
// Main function
async function main() {
    try {
        log('🚀 Starting HCS-10 Agent with Mock Client');
        // Check registration
        if (!fs.existsSync(REGISTRATION_FILE)) {
            log('❌ Agent not registered. Please run registration script first.');
            process.exit(1);
        }
        // Load registration info
        const registrationInfo = JSON.parse(fs.readFileSync(REGISTRATION_FILE, 'utf8'));
        log('✅ Using registered agent:');
        log(`   Account ID: ${registrationInfo.accountId}`);
        log(`   Inbound Topic ID: ${registrationInfo.inboundTopicId}`);
        log(`   Outbound Topic ID: ${registrationInfo.outboundTopicId}`);
        // Create mock client
        const client = new MockHCS10Client({
            network: 'testnet',
            operatorId: process.env.NEXT_PUBLIC_OPERATOR_ID || '',
            operatorPrivateKey: process.env.OPERATOR_KEY || ''
        });
        log('✅ Mock HCS10 client created');
        // Create agent
        const agent = new HCS10Agent(client, registrationInfo.inboundTopicId, registrationInfo.outboundTopicId);
        log('✅ HCS10 agent created');
        // Start the agent
        agent.start(5000); // Poll every 5 seconds
        log('✅ Agent started successfully');
        log('🔄 Agent is running. Press Ctrl+C to exit.');
        // Handle cleanup
        process.on('SIGINT', () => {
            log('🛑 Shutting down agent...');
            agent.stop();
            log('👋 Goodbye!');
            process.exit(0);
        });
        process.on('SIGTERM', () => {
            log('🛑 Shutting down agent...');
            agent.stop();
            log('👋 Goodbye!');
            process.exit(0);
        });
        // Keep the process alive
        setInterval(() => {
            // Do nothing, just keep the process running
        }, 1000);
    }
    catch (error) {
        log(`❌ Error running agent: ${error.message}`);
        console.error(error);
        process.exit(1);
    }
}
// Run the script
main();
