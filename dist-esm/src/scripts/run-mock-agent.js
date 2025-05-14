#!/usr/bin/env ts-node
/**
 * HCS-10 Agent Mock Test
 * This script simulates the agent workflow with mocked topic creation
 */
import dotenv from 'dotenv';
import { MockHCS10Client } from '../lib/mock-hcs10-client';
import { HCS10Agent } from '../lib/hcs10-agent';
import { ConnectionsManager } from '@hashgraphonline/standards-sdk';
// Load environment variables
dotenv.config({ path: '.env.local' });
// Check if required environment variables exist
if (!process.env.NEXT_PUBLIC_OPERATOR_ID) {
    console.error('Missing NEXT_PUBLIC_OPERATOR_ID in environment');
    process.exit(1);
}
if (!process.env.OPERATOR_KEY) {
    console.error('Missing OPERATOR_KEY in environment');
    process.exit(1);
}
// Create mock topics if needed
const inboundTopicId = process.env.NEXT_PUBLIC_HCS_INBOUND_TOPIC || '0.0.5956431';
const outboundTopicId = process.env.NEXT_PUBLIC_HCS_OUTBOUND_TOPIC || '0.0.5956432';
const agentId = process.env.NEXT_PUBLIC_HCS_AGENT_ID || process.env.NEXT_PUBLIC_OPERATOR_ID;
console.log('🔄 Creating mock HCS10 client...');
const client = new MockHCS10Client({
    network: 'testnet',
    operatorId: process.env.NEXT_PUBLIC_OPERATOR_ID,
    operatorPrivateKey: process.env.OPERATOR_KEY,
    inboundTopicId,
    outboundTopicId,
    logLevel: 'debug'
});
console.log('✅ Created mock client');
// Initialize ConnectionsManager - This is the key fix to ensure it works properly
console.log('🔄 Initializing ConnectionsManager...');
const connectionsManager = new ConnectionsManager({
    baseClient: client,
    logLevel: 'info'
});
console.log('✅ ConnectionsManager initialized');
// Set agent info in ConnectionsManager
connectionsManager.setAgentInfo({
    accountId: agentId,
    inboundTopicId,
    outboundTopicId
}).then(() => {
    console.log('✅ Agent info set in ConnectionsManager');
    // After ConnectionsManager is ready, create and start the agent
    console.log('🔄 Creating and starting HCS10 agent...');
    const agent = new HCS10Agent(client, inboundTopicId, outboundTopicId);
    agent.start(5000); // Poll every 5 seconds
    console.log('✅ Agent started. Press Ctrl+C to exit.');
    // Debug: print topics being used
    console.log(`Using topics:
  - Inbound:  ${inboundTopicId}
  - Outbound: ${outboundTopicId}
  - Agent ID: ${agentId}
  `);
}).catch((error) => {
    console.error('❌ Error setting agent info:', error);
    process.exit(1);
});
