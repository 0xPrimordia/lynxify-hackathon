import * as fs from 'node:fs';
import * as path from 'node:path';
import { v4 as uuidv4 } from 'uuid';
import { 
  HCS10ProtocolMessage, 
  HCS10ConnectionRequest, 
  HCS10ConnectionCreated,
  HCS10Message,
  RebalanceProposal, 
  RebalanceApproved,
  RebalanceExecuted,
  MessageStreamResponse
} from './types/hcs10-types.js';

// File paths for persistent storage
const CONNECTIONS_FILE = path.join(process.cwd(), '.connections.json');
const PENDING_PROPOSALS_FILE = path.join(process.cwd(), '.pending_proposals.json');
const EXECUTED_PROPOSALS_FILE = path.join(process.cwd(), '.executed_proposals.json');

// Interface for the HCS10Client (can be actual SDK or mock)
export interface HCS10Client {
  createTopic(): Promise<string>;
  sendMessage(topicId: string, message: string): Promise<{ success: boolean }>;
  getMessageStream(topicId: string): Promise<MessageStreamResponse>;
  
  // Add any other required methods for ConnectionsManager
  retrieveCommunicationTopics?: (accountId: string) => Promise<any>;
  getMessages?: (topicId: string) => Promise<any>;
}

// Interface for connection data
interface Connection {
  id: string;
  requesterTopic: string;
  timestamp: number;
}

// Interface for the storage of pending proposals
interface PendingProposal {
  id: string;
  proposal: RebalanceProposal;
  timestamp: number;
}

// Interface for executed proposals
interface ExecutedProposal {
  id: string;
  proposalId: string;
  executedAt: number;
  preBalances: Record<string, number>;
  postBalances: Record<string, number>;
}

/**
 * HCS10Agent class
 * Handles connections and proposal processing for the Lynxify tokenized index
 */
export class HCS10Agent {
  private client: HCS10Client;
  private inboundTopicId: string;
  private outboundTopicId: string;
  private connections: Connection[];
  private pendingProposals: PendingProposal[];
  private executedProposals: ExecutedProposal[];
  private pollingInterval: NodeJS.Timeout | null = null;
  private lastSequence: Record<string, number> = {};
  private profileTopicId: string | null = null;
  
  constructor(
    client: HCS10Client, 
    inboundTopicId: string, 
    outboundTopicId: string,
    profileTopicId?: string
  ) {
    this.client = client;
    this.inboundTopicId = inboundTopicId;
    this.outboundTopicId = outboundTopicId;
    this.profileTopicId = profileTopicId || null;
    
    // Load existing connections and proposals from file system
    this.connections = this.loadConnections();
    this.pendingProposals = this.loadPendingProposals();
    this.executedProposals = this.loadExecutedProposals();
    
    console.log(`🤖 HCS10Agent initialized with inbound topic: ${inboundTopicId}, outbound topic: ${outboundTopicId}`);
    console.log(`📊 Loaded ${this.connections.length} existing connections`);
    console.log(`📋 Loaded ${this.pendingProposals.length} pending proposals`);
    console.log(`🔄 Loaded ${this.executedProposals.length} executed proposals`);
  }

  /**
   * Start the agent's polling for new messages
   * @param pollingIntervalMs The interval in milliseconds to poll for new messages
   */
  public start(pollingIntervalMs: number = 5000): void {
    console.log(`🚀 Starting HCS10Agent with polling interval ${pollingIntervalMs}ms`);
    
    if (this.pollingInterval) {
      clearInterval(this.pollingInterval);
    }
    
    // Initialize sequence numbers for topics
    this.lastSequence[this.inboundTopicId] = 0;
    
    // Start polling
    this.pollingInterval = setInterval(() => {
      this.pollForMessages();
    }, pollingIntervalMs);
    
    // Poll once immediately
    this.pollForMessages();
  }

  /**
   * Stop the agent's polling
   */
  public stop(): void {
    console.log('🛑 Stopping HCS10Agent');
    
    if (this.pollingInterval) {
      clearInterval(this.pollingInterval);
      this.pollingInterval = null;
    }
  }

  /**
   * Poll for new messages on the inbound topic
   */
  private async pollForMessages(): Promise<void> {
    try {
      // Get messages from the inbound topic
      const response = await this.client.getMessageStream(this.inboundTopicId);
      
      // Process each message
      for (const message of response.messages) {
        // Skip messages we've already processed
        if (message.sequence_number <= (this.lastSequence[this.inboundTopicId] || 0)) {
          continue;
        }
        
        // Update last sequence number
        this.lastSequence[this.inboundTopicId] = message.sequence_number;
        
        // Process the message
        await this.processMessage(message.contents, this.inboundTopicId);
      }
    } catch (error) {
      console.error('Error polling for messages:', error);
    }
  }

  /**
   * Process a received message
   * @param messageContent The content of the message
   * @param topicId The topic ID the message was received on
   */
  private async processMessage(messageContent: string, topicId: string): Promise<void> {
    try {
      console.log('=== RECEIVED MESSAGE ===');
      console.log(`Topic: ${topicId}`);
      console.log(`Content: ${messageContent}`);
      
      const message = JSON.parse(messageContent) as HCS10ProtocolMessage;
      
      // Check if this is a valid HCS-10 message
      if (message.p !== 'hcs-10') {
        console.log('Received non-HCS-10 message, ignoring');
        return;
      }
      
      console.log(`📨 Received message with operation: ${message.op}`);
      
      // Handle based on operation type
      switch (message.op) {
        case 'connection_request':
          console.log('Processing connection_request operation');
          await this.handleConnectionRequest(message as HCS10ConnectionRequest);
          break;
          
        case 'message':
          console.log('Processing message operation');
          await this.handleApplicationMessage(message as HCS10Message);
          break;
          
        default:
          console.log(`Received unknown operation type: ${message.op}`);
      }
    } catch (error) {
      console.error('Error processing message:', error);
    }
  }

  /**
   * Handle a connection request
   * @param message The connection request message
   */
  private async handleConnectionRequest(message: HCS10ConnectionRequest): Promise<void> {
    console.log('Received connection request:', message);
    
    // Extract the requester's topic ID
    const parts = message.operator_id.split('@');
    if (parts.length !== 2) {
      console.error('Invalid operator_id format in connection request');
      return;
    }
    
    const requesterTopic = parts[0];
    const requesterId = parts[1];
    console.log(`Extracted requester topic: ${requesterTopic}, requesterId: ${requesterId}`);
    
    // Check if we already have a connection with this requester
    const existingConnection = this.connections.find(conn => conn.requesterTopic === requesterTopic);
    if (existingConnection) {
      console.log(`Connection already exists with ${requesterTopic}, reusing existing connection ${existingConnection.id}`);
      
      // Respond with connection created message to acknowledge the request
      const response: HCS10ConnectionCreated = {
        p: 'hcs-10',
        op: 'connection_created',
        requesterId: this.outboundTopicId,
        timestamp: Date.now()
      };
      
      await this.client.sendMessage(requesterTopic, JSON.stringify(response));
      console.log(`Sent connection created response to ${requesterTopic}`);

      // Update profile after successful connection reuse
      await this.updateProfile();
      return;
    }
    
    console.log(`No existing connection found with ${requesterTopic}, creating a new one`);
    
    // Create a new connection record
    const connection: Connection = {
      id: uuidv4(),
      requesterTopic,
      timestamp: Date.now()
    };
    
    console.log(`Created new connection: ${JSON.stringify(connection)}`);
    
    // Add to connections and save
    this.connections.push(connection);
    console.log(`Added connection. Total connections: ${this.connections.length}`);
    
    // Save to disk
    await this.saveConnections();
    
    // Send a connection created response
    const response: HCS10ConnectionCreated = {
      p: 'hcs-10',
      op: 'connection_created',
      requesterId: this.outboundTopicId,
      timestamp: Date.now()
    };
    
    await this.client.sendMessage(requesterTopic, JSON.stringify(response));
    console.log(`Sent connection created response to ${requesterTopic}`);
    
    // Update profile after successful connection
    await this.updateProfile();
  }

  /**
   * Handle an application message
   * @param message The HCS-10 message wrapper
   */
  private async handleApplicationMessage(message: HCS10Message): Promise<void> {
    console.log('Received application message');
    
    try {
      // Parse the inner data
      const data = JSON.parse(message.data);
      console.log(`📩 Parsed message of type: ${data.type}`);
      
      // Handle based on message type
      switch (data.type) {
        case 'RebalanceProposal':
          await this.handleRebalanceProposal(data as RebalanceProposal);
          break;
          
        case 'RebalanceApproved':
          await this.handleRebalanceApproved(data as RebalanceApproved);
          break;
          
        default:
          console.log(`Unknown application message type: ${data.type}`);
      }
    } catch (error) {
      console.error('Error handling application message:', error);
    }
  }

  /**
   * Handle a rebalance proposal
   * @param proposal The rebalance proposal
   */
  private async handleRebalanceProposal(proposal: RebalanceProposal): Promise<void> {
    console.log('Received rebalance proposal:', proposal);
    
    // Store the proposal
    const pendingProposal: PendingProposal = {
      id: proposal.proposalId,
      proposal,
      timestamp: Date.now()
    };
    
    this.pendingProposals.push(pendingProposal);
    this.savePendingProposals();
    
    console.log(`Stored pending proposal with ID: ${proposal.proposalId}`);
    
    // In a real implementation, we would:
    // 1. Validate the proposal
    // 2. Check if the sender has permission to propose
    // 3. Start the voting process
    // For the hackathon demo, we'll just store it
  }

  /**
   * Handle a rebalance approval
   * @param approval The rebalance approval
   */
  private async handleRebalanceApproved(approval: RebalanceApproved): Promise<void> {
    console.log('Received rebalance approval:', approval);
    
    // Find the pending proposal
    const pendingProposal = this.pendingProposals.find(p => p.id === approval.proposalId);
    if (!pendingProposal) {
      console.error(`No pending proposal found with ID: ${approval.proposalId}`);
      return;
    }
    
    // In a real implementation, we would:
    // 1. Execute the rebalance using the HTS
    // 2. Calculate the deltas
    // 3. Mint/burn tokens as needed
    // For the hackathon demo, we'll simulate this
    
    // Mock balances
    const preBalances = {
      'btc': 1000,
      'eth': 2000,
      'sol': 500,
      'lynx': 500
    };
    
    // Simulate new balances based on weights
    const totalValue = Object.values(preBalances).reduce((sum, val) => sum + val, 0);
    const postBalances: Record<string, number> = {};
    
    for (const [token, weight] of Object.entries(pendingProposal.proposal.newWeights)) {
      postBalances[token] = Math.round(totalValue * weight);
    }
    
    // Create executed message
    const executed: RebalanceExecuted = {
      type: 'RebalanceExecuted',
      proposalId: approval.proposalId,
      preBalances,
      postBalances,
      executedAt: Date.now(),
      timestamp: Date.now()
    };
    
    // Add to executed proposals
    const executedProposal: ExecutedProposal = {
      id: uuidv4(),
      proposalId: approval.proposalId,
      executedAt: executed.executedAt,
      preBalances,
      postBalances
    };
    this.executedProposals.push(executedProposal);
    this.saveExecutedProposals();
    
    // Wrap in HCS-10 message
    const executedMessage: HCS10Message = {
      p: 'hcs-10',
      op: 'message',
      data: JSON.stringify(executed)
    };
    
    // Send to all connections
    for (const connection of this.connections) {
      await this.client.sendMessage(connection.requesterTopic, JSON.stringify(executedMessage));
    }
    
    // Remove the proposal from pending
    this.pendingProposals = this.pendingProposals.filter(p => p.id !== approval.proposalId);
    this.savePendingProposals();
    
    console.log(`Executed rebalance for proposal: ${approval.proposalId}`);
  }

  /**
   * Load existing connections from file
   * @returns Array of connections
   */
  private loadConnections(): Connection[] {
    try {
      if (fs.existsSync(CONNECTIONS_FILE)) {
        return JSON.parse(fs.readFileSync(CONNECTIONS_FILE, 'utf8'));
      }
    } catch (error) {
      console.error('Error loading connections:', error);
    }
    
    return [];
  }

  /**
   * Save connections to file
   */
  private saveConnections(): void {
    try {
      console.log(`DEBUG: Attempting to save ${this.connections.length} connections to ${CONNECTIONS_FILE}`);
      console.log(`DEBUG: Current working directory: ${process.cwd()}`);
      
      fs.writeFileSync(CONNECTIONS_FILE, JSON.stringify(this.connections, null, 2));
      console.log(`✅ Saved ${this.connections.length} connections to ${CONNECTIONS_FILE}`);
      
      // Verify file was created
      if (fs.existsSync(CONNECTIONS_FILE)) {
        console.log(`DEBUG: File exists after saving: ${CONNECTIONS_FILE}`);
      } else {
        console.log(`DEBUG: File does not exist after saving: ${CONNECTIONS_FILE}`);
      }
    } catch (error) {
      console.error('❌ Error saving connections:', error);
    }
  }

  /**
   * Load pending proposals from file
   * @returns Array of pending proposals
   */
  private loadPendingProposals(): PendingProposal[] {
    try {
      if (fs.existsSync(PENDING_PROPOSALS_FILE)) {
        return JSON.parse(fs.readFileSync(PENDING_PROPOSALS_FILE, 'utf8'));
      }
    } catch (error) {
      console.error('Error loading pending proposals:', error);
    }
    
    return [];
  }

  /**
   * Save pending proposals to file
   */
  private savePendingProposals(): void {
    try {
      console.log(`DEBUG: Attempting to save ${this.pendingProposals.length} proposals to ${PENDING_PROPOSALS_FILE}`);
      
      fs.writeFileSync(PENDING_PROPOSALS_FILE, JSON.stringify(this.pendingProposals, null, 2));
      console.log(`✅ Saved ${this.pendingProposals.length} pending proposals to ${PENDING_PROPOSALS_FILE}`);
      
      // Verify file was created
      if (fs.existsSync(PENDING_PROPOSALS_FILE)) {
        console.log(`DEBUG: File exists after saving: ${PENDING_PROPOSALS_FILE}`);
      } else {
        console.log(`DEBUG: File does not exist after saving: ${PENDING_PROPOSALS_FILE}`);
      }
    } catch (error) {
      console.error('❌ Error saving pending proposals:', error);
    }
  }
  
  /**
   * Load executed proposals from file
   * @returns Array of executed proposals
   */
  private loadExecutedProposals(): ExecutedProposal[] {
    try {
      if (fs.existsSync(EXECUTED_PROPOSALS_FILE)) {
        return JSON.parse(fs.readFileSync(EXECUTED_PROPOSALS_FILE, 'utf8'));
      }
    } catch (error) {
      console.error('Error loading executed proposals:', error);
    }
    
    return [];
  }
  
  /**
   * Save executed proposals to file
   */
  private saveExecutedProposals(): void {
    try {
      fs.writeFileSync(EXECUTED_PROPOSALS_FILE, JSON.stringify(this.executedProposals, null, 2));
      console.log(`Saved ${this.executedProposals.length} executed proposals to ${EXECUTED_PROPOSALS_FILE}`);
    } catch (error) {
      console.error('Error saving executed proposals:', error);
    }
  }

  /**
   * Update agent profile
   */
  private async updateProfile(): Promise<void> {
    if (!this.profileTopicId) {
      console.log('⚠️ Profile topic not configured, skipping profile update');
      return;
    }

    try {
      console.log('🔄 Updating agent profile...');
      
      const profileMessage = {
        id: `profile-${Date.now()}`,
        type: 'AgentInfo',
        timestamp: Date.now(),
        sender: 'Lynxify Agent',
        details: {
          message: 'Agent profile update',
          agentId: this.outboundTopicId,
          capabilities: ['rebalancing', 'market_analysis', 'token_management', 'portfolio_optimization'],
          agentDescription: 'AI-powered rebalancing agent for the Lynxify Tokenized Index',
          inboundTopicId: this.inboundTopicId,
          outboundTopicId: this.outboundTopicId,
          display_name: 'Lynxify Agent',
          alias: 'lynxify_agent',
          bio: 'AI-powered rebalancing agent for the Lynxify Tokenized Index'
        }
      };

      await this.client.sendMessage(this.profileTopicId, JSON.stringify(profileMessage));
      console.log('✅ Profile updated successfully');
    } catch (error) {
      console.error('❌ Failed to update profile:', error);
    }
  }
} 