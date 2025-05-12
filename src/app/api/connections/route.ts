import { NextResponse } from 'next/server';
import { LynxifyAgent } from '@/app/services/lynxify-agent';
import fs from 'fs/promises';
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
let agent: LynxifyAgent;

/**
 * Initialize agent if needed
 */
async function getAgentInstance() {
  try {
    if (!agent) {
      // Create a new LynxifyAgent instance with config from env
      agent = new LynxifyAgent({
        agentId: process.env.NEXT_PUBLIC_HCS_AGENT_ID!,
        hederaConfig: {
          network: 'testnet',
          operatorId: process.env.NEXT_PUBLIC_OPERATOR_ID,
          operatorKey: process.env.OPERATOR_KEY,
        },
        hcs10Config: {
          registryTopicId: process.env.NEXT_PUBLIC_HCS_REGISTRY_TOPIC!,
          agentTopicId: process.env.NEXT_PUBLIC_HCS_AGENT_TOPIC!,
          capabilities: ['index', 'rebalancing'],
          description: 'Lynxify Tokenized Index Agent',
        },
        indexConfig: {
          indexTopicId: process.env.NEXT_PUBLIC_HCS_INDEX_TOPIC!,
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
  } catch (error) {
    console.error('Failed to initialize agent:', error);
    return null;
  }
}

/**
 * GET endpoint to retrieve active connections
 */
export async function GET() {
  try {
    // First try to get connections from agent
    try {
      const agentInstance = await getAgentInstance();
      if (agentInstance) {
        const hcs10Service = agentInstance.getHCS10Service();
        const connections = Array.from(hcs10Service.getKnownAgents().values());
        
        return NextResponse.json({
          success: true,
          connections: connections,
        });
      }
    } catch (agentError) {
      console.error('Error getting connections from agent:', agentError);
    }
    
    // Fallback to file-based connections if agent is not available
    try {
      const data = await fs.readFile(CONNECTION_STATE_FILE, 'utf8');
      const connections = JSON.parse(data);
      return NextResponse.json({
        success: true,
        connections: connections,
        source: 'file',
      });
    } catch (fileError) {
      // If file doesn't exist, return empty array
      return NextResponse.json({
        success: true,
        connections: [],
        source: 'empty',
      });
    }
  } catch (error) {
    console.error('Error retrieving connections:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to retrieve connections' },
      { status: 500 }
    );
  }
} 