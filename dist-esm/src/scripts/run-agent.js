#!/usr/bin/env ts-node
/**
 * HCS-10 Agent Runner
 * This script runs the HCS-10 agent with either the mock client or real client
 */
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';
import { MockHCS10Client } from '../lib/mock-hcs10-client';
import { HCS10Agent } from '../lib/hcs10-agent';
// Load environment variables
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });
// Check for registration
const REGISTRATION_FILE = path.join(process.cwd(), '.registration_status.json');
/**
 * Import the real HCS10Client if --real flag is passed
 */
async function getRealClient() {
    try {
        // We'll dynamically import the real client module if needed
        // This allows us to avoid requiring it for mock testing
        const { HederaHCS10Client } = await import('../lib/hedera-hcs10-client');
        return new HederaHCS10Client({
            network: 'testnet',
            operatorId: process.env.NEXT_PUBLIC_OPERATOR_ID || '',
            operatorPrivateKey: process.env.OPERATOR_KEY || '',
            inboundTopicId: process.env.NEXT_PUBLIC_HCS_INBOUND_TOPIC,
            outboundTopicId: process.env.NEXT_PUBLIC_HCS_OUTBOUND_TOPIC,
            logLevel: 'debug'
        });
    }
    catch (error) {
        console.error('Failed to import real HCS10Client:', error);
        return null;
    }
}
/**
 * Run the agent with specified client type
 */
async function runAgent(useRealClient = false) {
    try {
        console.log(`🚀 Starting HCS-10 Agent with ${useRealClient ? 'REAL' : 'MOCK'} client`);
        // Check registration
        if (!fs.existsSync(REGISTRATION_FILE)) {
            console.error('❌ Agent not registered. Please run registration script first.');
            process.exit(1);
        }
        // Load registration info
        const registrationInfo = JSON.parse(fs.readFileSync(REGISTRATION_FILE, 'utf8'));
        console.log('✅ Using registered agent:');
        console.log(`   Account ID: ${registrationInfo.accountId}`);
        console.log(`   Inbound Topic ID: ${registrationInfo.inboundTopicId}`);
        console.log(`   Outbound Topic ID: ${registrationInfo.outboundTopicId}`);
        // Create client
        let client;
        if (useRealClient) {
            const realClient = await getRealClient();
            if (!realClient) {
                console.error('❌ Failed to create real client. Exiting.');
                process.exit(1);
            }
            client = realClient;
        }
        else {
            // Create a mock client with all required methods
            client = new MockHCS10Client({
                network: 'testnet',
                operatorId: process.env.NEXT_PUBLIC_OPERATOR_ID || '',
                operatorPrivateKey: process.env.OPERATOR_KEY || '',
                inboundTopicId: registrationInfo.inboundTopicId,
                outboundTopicId: registrationInfo.outboundTopicId,
                logLevel: 'debug'
            });
            // Add logging for client capabilities
            console.log('✅ Client methods:');
            Object.keys(client).forEach(key => {
                console.log(`   - ${key}`);
            });
            // Log methods
            Object.getOwnPropertyNames(Object.getPrototypeOf(client)).forEach(method => {
                if (method !== 'constructor') {
                    console.log(`   - Method: ${method}`);
                }
            });
        }
        // Create agent
        const agent = new HCS10Agent(client, registrationInfo.inboundTopicId, registrationInfo.outboundTopicId);
        // Start the agent
        agent.start(5000); // Poll every 5 seconds
        console.log('✅ Agent started successfully');
        // Handle cleanup
        process.on('SIGINT', () => {
            console.log('\n🛑 Shutting down agent...');
            agent.stop();
            console.log('👋 Goodbye!');
            process.exit(0);
        });
        process.on('SIGTERM', () => {
            console.log('\n🛑 Shutting down agent...');
            agent.stop();
            console.log('👋 Goodbye!');
            process.exit(0);
        });
        // Just keep the process alive
        console.log('🔄 Agent is running. Press Ctrl+C to exit.');
    }
    catch (error) {
        console.error('❌ Error running agent:', error);
        process.exit(1);
    }
}
// Parse command line arguments
const useRealClient = process.argv.includes('--real');
// Run the agent
runAgent(useRealClient).catch(err => {
    console.error('❌ Fatal error:', err);
    process.exit(1);
});
