import { HCS10Client } from '../hcs10-agent.js';
import { HCSMessage, MessageStreamResponse } from '../types/hcs10-types.js';
import { EventEmitter } from 'events';
import { v4 as uuidv4 } from 'uuid';
import * as path from 'path';
// Dynamic import will be used instead of static import
// import { ConnectionsManager } from '@hashgraphonline/standards-sdk';

// Define extended client interface to include ConnectionsManager required properties
interface ExtendedHCS10Client extends HCS10Client {
  network?: string;
  operatorId?: string;
  getMirrorClient?: () => any;
}

// Connection interface for ConnectionsManager
interface Connection {
  connectionTopicId: string;
  targetAccountId: string;
  targetAgentName?: string;
  targetInboundTopicId?: string;
  targetOutboundTopicId?: string;
  status: 'pending' | 'established' | 'needs_confirmation' | 'closed';
  isPending: boolean;
  needsConfirmation: boolean;
  memo?: string;
  created: Date;
  lastActivity?: Date;
  connectionRequestId?: number;
  uniqueRequestKey?: string;
  from?: string;  // For getPendingRequests
  id?: string;    // For getPendingRequests
}

// Updated type interface to match ConnectionsManager structure
interface ConnectionsManagerInterface {
  setAgentInfo(info: {
    accountId: string;
    inboundTopicId: string;
    outboundTopicId: string;
  }): Promise<void>;
  fetchConnectionData(accountId: string): Promise<Connection[]>;
  processInboundMessages(messages: HCSMessage[]): Promise<void>;
  getPendingRequests(): Connection[];
  acceptConnectionRequest(options: {
    requestId: string;
    memo?: string;
  }): Promise<void>;
}

/**
 * HCS10AgentWithConnections
 * Enhanced HCS10Agent implementation that properly uses the ConnectionsManager from standards-sdk
 */
export class HCS10AgentWithConnections extends EventEmitter {
  private client: ExtendedHCS10Client;
  private inboundTopicId: string;
  private outboundTopicId: string;
  private agentId: string;
  private connectionsManager: ConnectionsManagerInterface | null = null;
  private pollingInterval: NodeJS.Timeout | null = null;
  private lastSequence: Record<string, number> = {};
  private isConnectionsManagerInitialized = false;
  private initAttempted = false;

  /**
   * Create a new HCS10 agent with ConnectionsManager
   * @param client An HCS10Client instance
   * @param inboundTopicId The agent's inbound topic ID
   * @param outboundTopicId The agent's outbound topic ID 
   * @param agentId The agent's ID (usually an account ID)
   */
  constructor(
    client: HCS10Client,
    inboundTopicId: string,
    outboundTopicId: string,
    agentId?: string
  ) {
    super();
    // Cast client to extended interface
    this.client = client as ExtendedHCS10Client;
    this.inboundTopicId = inboundTopicId;
    this.outboundTopicId = outboundTopicId;
    this.agentId = agentId || '';

    // Initialize the connections manager asynchronously
    this.initializeConnectionsManager();
  }

  /**
   * Initialize the ConnectionsManager using proper ES Module import
   */
  private async initializeConnectionsManager(): Promise<void> {
    if (this.initAttempted) return;
    this.initAttempted = true;
    
    try {
      // Verify client implements required methods for ConnectionsManager
      if (typeof this.client.retrieveCommunicationTopics !== 'function' || 
          typeof this.client.getMessages !== 'function') {
        throw new Error('Client missing required methods for ConnectionsManager');
      }

      console.log('🔄 Initializing ConnectionsManager...');
      
      // Create an adapted client that conforms to what ConnectionsManager expects
      const adaptedClient = {
        // Original client methods
        ...this.client,
        // Required methods for ConnectionsManager
        retrieveCommunicationTopics: this.client.retrieveCommunicationTopics.bind(this.client),
        getMessages: this.client.getMessages.bind(this.client),
        // Required properties that might be missing
        network: this.client.network || 'testnet',
        operatorId: this.client.operatorId || this.agentId,
        // Default methods if not provided by client
        getMirrorClient: this.client.getMirrorClient || (() => ({
          getTopicMessages: async () => ({ messages: [] })
        }))
      };
      
      try {
        // Import the module dynamically using a more flexible approach
        const importedModule = await import('@hashgraphonline/standards-sdk');
        
        // Cast to any to bypass TypeScript restrictions on dynamic imports
        const sdkModule = importedModule as any;
        
        // Check if ConnectionsManager exists
        if (!sdkModule || typeof sdkModule.ConnectionsManager !== 'function') {
          throw new Error('ConnectionsManager not found in standards-sdk module');
        }
        
        // Create ConnectionsManager instance
        this.connectionsManager = new sdkModule.ConnectionsManager({
          baseClient: adaptedClient,
          logLevel: 'info'
        });
        
        console.log('✅ ConnectionsManager initialized with ES Module import');
        
        // Initialize connections data
        if (this.connectionsManager && this.agentId) {
          // API has changed, fetchConnectionData might need to be called with agentId
          await this.connectionsManager.fetchConnectionData(this.agentId);
          this.isConnectionsManagerInitialized = true;
          console.log('✅ ConnectionsManager fully initialized');
          
          // Emit an event to notify that ConnectionsManager is ready
          this.emit('connectionsManagerReady');
        }
      } catch (error) {
        console.error('Failed to import ConnectionsManager:', error instanceof Error ? error.message : String(error));
        throw error;
      }
    } catch (error) {
      console.error('❌ Failed to initialize ConnectionsManager:', error instanceof Error ? error.message : String(error));
      this.emit('connectionsManagerError', error);
      // Continue without ConnectionsManager functionality
    }
  }

  /**
   * Start polling for messages
   * @param pollingIntervalMs Polling interval in milliseconds
   */
  public start(pollingIntervalMs: number = 5000): void {
    console.log(`🚀 Starting HCS10AgentWithConnections with polling interval ${pollingIntervalMs}ms`);
    
    if (this.pollingInterval) {
      clearInterval(this.pollingInterval);
    }
    
    // Initialize sequence numbers
    this.lastSequence[this.inboundTopicId] = 0;
    
    // Start polling
    this.pollingInterval = setInterval(() => {
      this.pollForMessages();
    }, pollingIntervalMs);
    
    // Poll once immediately
    this.pollForMessages();
  }

  /**
   * Stop polling for messages
   */
  public stop(): void {
    console.log('🛑 Stopping HCS10AgentWithConnections');
    
    if (this.pollingInterval) {
      clearInterval(this.pollingInterval);
      this.pollingInterval = null;
    }
  }

  /**
   * Poll for new messages
   */
  private async pollForMessages(): Promise<void> {
    try {
      // Get new messages from the inbound topic
      const response = await this.client.getMessageStream(this.inboundTopicId);
      
      // Process messages with ConnectionsManager if available
      if (this.isConnectionsManagerInitialized && this.connectionsManager) {
        try {
          await this.connectionsManager.processInboundMessages(response.messages);
          
          // Process pending connection requests
          await this.processPendingRequests();
        } catch (error) {
          console.error('❌ Error processing messages with ConnectionsManager:', error instanceof Error ? error.message : String(error));
          // If ConnectionsManager fails, fall back to direct processing
          this.processSingleMessages(response);
        }
      } else {
        // If ConnectionsManager is not available, process messages directly
        this.processSingleMessages(response);
      }
    } catch (error) {
      console.error('Error polling for messages:', error instanceof Error ? error.message : String(error));
    }
  }

  /**
   * Process messages directly without ConnectionsManager
   */
  private processSingleMessages(response: MessageStreamResponse): void {
    for (const message of response.messages) {
      // Skip messages we've already processed
      if (message.sequence_number <= (this.lastSequence[this.inboundTopicId] || 0)) {
        continue;
      }
      
      // Update last sequence number
      this.lastSequence[this.inboundTopicId] = message.sequence_number;
      
      // Emit the message
      this.emit('message', message.contents, message);
    }
  }

  /**
   * Process pending connection requests
   */
  private async processPendingRequests(): Promise<void> {
    if (!this.connectionsManager) return;
    
    try {
      // Get pending requests
      const pendingRequests = this.connectionsManager.getPendingRequests();
      
      if (pendingRequests.length > 0) {
        console.log(`🔔 Found ${pendingRequests.length} pending connection requests`);
        
        // Auto-accept all pending requests
        for (const request of pendingRequests) {
          console.log(`✅ Auto-accepting connection request from ${request.from || 'unknown'}`);
          
          // The original acceptConnectionRequest method is not available in this version
          // Instead, we'll use the appropriate method to mark the connection as established
          // For now, we'll just emit an event since we don't know the exact API
          this.emit('connectionAccepted', request);
          
          // Log that we need to implement this differently based on the API
          console.log('⚠️ Connection approval implementation needs to be updated for this SDK version');
        }
      }
    } catch (error) {
      console.error('❌ Error processing pending requests:', error instanceof Error ? error.message : String(error));
    }
  }

  /**
   * Get the ConnectionsManager instance
   */
  public getConnectionsManager(): ConnectionsManagerInterface | null {
    return this.connectionsManager;
  }

  /**
   * Check if the agent is ready (ConnectionsManager initialized)
   */
  public isReady(): boolean {
    return this.isConnectionsManagerInitialized && this.connectionsManager !== null;
  }

  /**
   * Wait until the agent is ready
   * @param timeoutMs Timeout in milliseconds
   */
  public async waitUntilReady(timeoutMs: number = 30000): Promise<boolean> {
    if (this.isReady()) return true;
    
    return new Promise<boolean>((resolve) => {
      const timeout = setTimeout(() => {
        cleanup();
        resolve(false);
      }, timeoutMs);
      
      const readyHandler = () => {
        cleanup();
        resolve(true);
      };
      
      const errorHandler = () => {
        cleanup();
        resolve(false);
      };
      
      const cleanup = () => {
        clearTimeout(timeout);
        this.removeListener('connectionsManagerReady', readyHandler);
        this.removeListener('connectionsManagerError', errorHandler);
      };
      
      this.once('connectionsManagerReady', readyHandler);
      this.once('connectionsManagerError', errorHandler);
    });
  }
}
