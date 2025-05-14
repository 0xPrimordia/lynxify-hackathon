#!/usr/bin/env ts-node
/**
 * Enhanced HCS-10 Agent Test
 * Tests the ConnectionsManager integration with the EnhancedHCS10Agent
 */
import dotenv from 'dotenv';
import path from 'path';
import { MockHCS10Client } from '../lib/mock-hcs10-client';
import { EnhancedHCS10Agent } from '../lib/enhanced-hcs10-agent';
// Load environment variables
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });
// Environment setup
const operatorId = process.env.NEXT_PUBLIC_OPERATOR_ID;
const operatorKey = process.env.OPERATOR_KEY;
const inboundTopicId = process.env.NEXT_PUBLIC_HCS_INBOUND_TOPIC || '0.0.5956431';
const outboundTopicId = process.env.NEXT_PUBLIC_HCS_OUTBOUND_TOPIC || '0.0.5956432';
const agentId = process.env.NEXT_PUBLIC_HCS_AGENT_ID || operatorId;
// Validate environment
if (!operatorId || !operatorKey) {
    console.error('❌ Missing required environment variables: NEXT_PUBLIC_OPERATOR_ID, OPERATOR_KEY');
    process.exit(1);
}
console.log('Environment variables loaded:');
console.log(`- Operator ID: ${operatorId}`);
console.log(`- Inbound Topic: ${inboundTopicId}`);
console.log(`- Outbound Topic: ${outboundTopicId}`);
console.log(`- Agent ID: ${agentId}`);
// Create client
console.log('🔄 Creating MockHCS10Client...');
const client = new MockHCS10Client({
    network: 'testnet',
    operatorId: operatorId,
    operatorPrivateKey: operatorKey,
    inboundTopicId,
    outboundTopicId,
    logLevel: 'debug'
});
// Create agent with correct agent ID
console.log('🔄 Creating EnhancedHCS10Agent...');
const agent = new EnhancedHCS10Agent(client, inboundTopicId, outboundTopicId, agentId);
// Start the agent
agent.start(10000); // Poll every 10 seconds
console.log('✅ Agent started successfully');
console.log('ℹ️ Press Ctrl+C to stop');
// Setup signal handlers for clean shutdown
process.on('SIGINT', () => {
    console.log('\n🛑 Stopping agent...');
    agent.stop();
    console.log('👋 Goodbye!');
    process.exit(0);
});
process.on('SIGTERM', () => {
    console.log('\n🛑 Stopping agent...');
    agent.stop();
    console.log('👋 Goodbye!');
    process.exit(0);
});
