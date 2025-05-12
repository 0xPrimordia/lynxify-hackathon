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
 * GET endpoint to retrieve pending connections
 */
export async function GET() {
  try {
    // Try to get pending connections from agent
    try {
      const agentInstance = await getAgentInstance();
      if (agentInstance) {
        const hcs10Service = agentInstance.getHCS10Service();
        // Use internal methods to get pending connections
        const pendingConnections = [];
        
        // Get all pending requests that are connection requests
        const pendingRequests = hcs10Service.getAllPendingRequests();
        if (pendingRequests) {
          // Convert Map entries to array for easier iteration
          const requestEntries = Array.from(pendingRequests.entries());
          for (const [id, request] of requestEntries) {
            if (request.contents?.action === 'connection_request' || 
                request.contents?.op === 'connection_request') {
              pendingConnections.push({
                id: request.id,
                recipientId: request.recipientId,
                timestamp: request.timestamp,
                status: request.status,
                contents: request.contents
              });
            }
          }
        }
        
        return NextResponse.json({
          success: true,
          pendingConnections: pendingConnections,
        });
      }
    } catch (agentError) {
      console.error('Error getting pending connections from agent:', agentError);
    }
    
    // If agent is not available, return empty array
    return NextResponse.json({
      success: true,
      pendingConnections: [],
      source: 'fallback',
    });
  } catch (error) {
    console.error('Error retrieving pending connections:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to retrieve pending connections' },
      { status: 500 }
    );
  }
} 