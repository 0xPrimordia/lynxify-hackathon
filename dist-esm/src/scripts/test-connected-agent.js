#!/usr/bin/env node --experimental-specifier-resolution=node --experimental-import-meta-resolve
/**
 * HCS10 Agent With Connections Test
 * Tests the proper ConnectionsManager integration with the HCS10AgentWithConnections
 */
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { MockHCS10Client } from '../lib/mock-hcs10-client.js';
import { HCS10AgentWithConnections } from '../lib/hcs10-connection/hcs10-agent-with-connections.js';
// Set up __dirname equivalent for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
// Load environment variables
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });
// Environment setup
const operatorId = process.env.NEXT_PUBLIC_OPERATOR_ID || '';
const operatorKey = process.env.OPERATOR_KEY || '';
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
async function main() {
    try {
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
        console.log('🔄 Creating HCS10AgentWithConnections...');
        const agent = new HCS10AgentWithConnections(client, inboundTopicId, outboundTopicId, agentId);
        // Set up event handlers
        agent.on('connectionsManagerReady', () => {
            console.log('✅ ConnectionsManager is ready!');
            console.log('👤 Checking available connections...');
            const cm = agent.getConnectionsManager();
            if (cm) {
                // Log any important ConnectionsManager state
                try {
                    // Use type casting to access potential methods that might exist
                    const connections = cm.getConnectionStore ? cm.getConnectionStore() : [];
                    console.log(`📊 Found ${connections.length} connections in store`);
                }
                catch (error) {
                    console.error('❌ Error accessing connection store:', error instanceof Error ? error.message : String(error));
                }
            }
        });
        agent.on('connectionsManagerError', (error) => {
            console.error('❌ ConnectionsManager error:', error instanceof Error ? error.message : String(error));
            console.log('⚠️ Agent will continue working but without ConnectionsManager functionality');
        });
        agent.on('connectionAccepted', (connection) => {
            console.log('✅ New connection accepted:');
            console.log(`   - ID: ${connection.id || 'unknown'}`);
            console.log(`   - Target: ${connection.targetAccountId || 'unknown'}`);
            console.log(`   - Status: ${connection.status || 'unknown'}`);
        });
        agent.on('message', (content, message) => {
            console.log('📨 Message received:');
            console.log(`   - Sequence: ${message.sequence_number}`);
            console.log(`   - Content: ${content.substring(0, 100)}${content.length > 100 ? '...' : ''}`);
            try {
                // Try to parse the message content
                const parsed = JSON.parse(content);
                console.log(`   - Type: ${parsed.type || 'unknown'}`);
            }
            catch (error) {
                // Not JSON or invalid format
            }
        });
        // Start the agent
        agent.start(10000); // Poll every 10 seconds
        console.log('✅ Agent started successfully');
        console.log('ℹ️ Press Ctrl+C to stop');
        // Try to wait until the ConnectionsManager is ready
        try {
            const isReady = await agent.waitUntilReady(30000);
            if (isReady) {
                console.log('✅ ConnectionsManager initialized successfully');
            }
            else {
                console.log('⚠️ ConnectionsManager initialization timed out or failed, but agent will continue to function');
            }
        }
        catch (error) {
            console.error('❌ Error waiting for ConnectionsManager:', error instanceof Error ? error.message : String(error));
        }
    }
    catch (error) {
        console.error('❌ Error starting agent:', error instanceof Error ? error.message : String(error));
    }
}
// Run the main function
main().catch((error) => {
    console.error('❌ Unhandled error:', error instanceof Error ? error.message : String(error));
    process.exit(1);
});
// Setup signal handlers for clean shutdown
process.on('SIGINT', () => {
    console.log('\n🛑 Stopping agent...');
    process.exit(0);
});
process.on('SIGTERM', () => {
    console.log('\n🛑 Stopping agent...');
    process.exit(0);
});
