import { NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';
import { LynxifyAgent } from '@/app/services/lynxify-agent';
import dotenv from 'dotenv';
// Load environment variables for agent configuration
dotenv.config({ path: '.env.local' });
// Constants
const APPROVAL_COMMAND_FILE = path.join(process.cwd(), '.approval_commands.json');
// Force dynamic rendering for API routes
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
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
 * POST endpoint to approve a connection - integrates with Lynxify agent when available
 */
export async function POST(request) {
    try {
        // Get the connection ID either from URL or request body
        let connectionId;
        let memo = "Connection accepted. Looking forward to collaborating!";
        // Try to get from URL first
        const url = new URL(request.url);
        const urlConnectionId = url.pathname.split('/').pop();
        // Next try to get from request body
        try {
            const body = await request.json();
            connectionId = body.connectionId || urlConnectionId;
            if (body.memo) {
                memo = body.memo;
            }
        }
        catch (e) {
            // If body parsing fails, use URL connectionId
            connectionId = urlConnectionId;
        }
        if (!connectionId) {
            return NextResponse.json({ success: false, error: 'Missing connection ID in request' }, { status: 400 });
        }
        console.log(`Processing approval request for connection: ${connectionId}`);
        // Try to use the agent if available
        let directlyApproved = false;
        try {
            const agentInstance = await getAgentInstance();
            if (agentInstance) {
                const hcs10Service = agentInstance.getHCS10Service();
                // Using the HCS-10 protocol service to respond to the connection request
                await hcs10Service.sendResponse(connectionId, // The connection/request ID
                connectionId, // Using the same ID as the original request ID
                {
                    status: 'approved',
                    memo,
                    profileInfo: {
                        version: "1.0",
                        type: 0,
                        display_name: "Lynxify Agent",
                        alias: "lynxify_agent",
                        bio: "Testnet agent for the Lynx tokenized index",
                        properties: {
                            organization: "Lynxify"
                        },
                        inboundTopicId: process.env.NEXT_PUBLIC_HCS_INBOUND_TOPIC,
                        outboundTopicId: process.env.NEXT_PUBLIC_HCS_OUTBOUND_TOPIC
                    }
                });
                directlyApproved = true;
                console.log(`✅ Connection ${connectionId} directly approved through agent`);
            }
        }
        catch (agentError) {
            console.error('Error approving connection through agent:', agentError);
        }
        // If not directly approved, write to command file for next agent run
        if (!directlyApproved) {
            // Write approval command to file for agent to process
            const approvalCommand = {
                action: 'approve',
                connectionId,
                memo,
                timestamp: Date.now()
            };
            // Read existing commands (if any)
            let commands = [];
            try {
                const existingData = await fs.readFile(APPROVAL_COMMAND_FILE, 'utf8');
                commands = JSON.parse(existingData);
            }
            catch (err) {
                // File doesn't exist yet, start with empty array
                console.log('No existing commands file, creating new one');
            }
            // Add new command to list
            commands.push(approvalCommand);
            // Write back to file
            await fs.writeFile(APPROVAL_COMMAND_FILE, JSON.stringify(commands, null, 2));
            console.log(`Wrote approval command to ${APPROVAL_COMMAND_FILE}`);
        }
        return NextResponse.json({
            success: true,
            status: directlyApproved ? 'approved' : 'approval_requested',
            message: directlyApproved ? 'Connection approved' : 'Connection approval requested',
            connectionId
        });
    }
    catch (error) {
        console.error('Error handling connection approval:', error);
        return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
    }
}
