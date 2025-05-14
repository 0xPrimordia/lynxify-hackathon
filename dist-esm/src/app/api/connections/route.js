import { NextResponse } from 'next/server';
import { LynxifyAgent } from '@/app/services/lynxify-agent';
import path from 'path';
// Configuration constants
import dotenv from 'dotenv';
// Load environment variables for agent configuration
dotenv.config({ path: '.env.local' });
// Force dynamic rendering for API routes
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
// Get connection state from file when agent is not running in API context
const CONNECTION_STATE_FILE = path.join(process.cwd(), '.connection_state.json');
// Get agent instance
let agent;
/**
 * Initialize agent if needed
 */
async function getAgentInstance() {
    try {
        if (!agent) {
            // Create a new LynxifyAgent instance with config from env
            agent = new LynxifyAgent({
                agentId: process.env.NEXT_PUBLIC_HCS_AGENT_ID,
                hederaConfig: {
                    network: 'testnet',
                    operatorId: process.env.NEXT_PUBLIC_OPERATOR_ID,
                    operatorKey: process.env.OPERATOR_KEY,
                },
                hcs10Config: {
                    registryTopicId: process.env.NEXT_PUBLIC_HCS_REGISTRY_TOPIC,
                    agentTopicId: process.env.NEXT_PUBLIC_HCS_AGENT_TOPIC,
                    capabilities: ['index', 'rebalancing'],
                    description: 'Lynxify Tokenized Index Agent',
                },
                indexConfig: {
                    indexTopicId: process.env.NEXT_PUBLIC_HCS_INDEX_TOPIC,
                    proposalTimeoutMs: 300000, // 5 minutes
                    rebalanceThreshold: 0.05, // 5%
                    riskThreshold: 0.2, // 20%
                },
                logEvents: true,
            });
            // Initialize the agent
            await agent.initialize();
        }
        return agent;
    }
    catch (error) {
        console.error('Failed to initialize agent:', error);
        return null;
    }
}
/**
 * GET endpoint to retrieve all connections
 */
export async function GET() {
    try {
        // Try to use the agent if available
        try {
            const agentInstance = await getAgentInstance();
            if (agentInstance) {
                const hcs10Service = agentInstance.getHCS10Service();
                // Get all connections from the HCS-10 service
                const connections = hcs10Service.getKnownAgents();
                return NextResponse.json({
                    success: true,
                    connections: Array.from(connections.values())
                });
            }
        }
        catch (agentError) {
            console.error('Error getting connections through agent:', agentError);
        }
        // If agent is not available, return empty list
        return NextResponse.json({
            success: true,
            connections: [],
            message: 'Agent not initialized, returning empty connections list'
        });
    }
    catch (error) {
        console.error('Error retrieving connections:', error);
        return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
    }
}
