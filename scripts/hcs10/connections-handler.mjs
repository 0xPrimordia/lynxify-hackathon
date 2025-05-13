import { EventEmitter } from 'events';
import { ConnectionsManager } from '@hashgraphonline/standards-sdk';
import fs from 'fs/promises';
import path from 'path';

// Constants
const CONNECTIONS_FILE = path.join(process.cwd(), '.connections.json');

/**
 * Implementation of the connections handler based on the standards-expert-agent example
 * Properly manages connections to avoid duplication issues
 */
export class ConnectionsHandler extends EventEmitter {
  constructor(client) {
    super();
    this.client = client;
    this.connectionsManager = null;
    this.agentId = null;
    this.inboundTopicId = null;
  }

  /**
   * Initialize the handler
   * @param {string} agentId The agent's ID
   * @param {string} inboundTopicId The agent's inbound topic ID
   */
  async initialize(agentId, inboundTopicId) {
    this.agentId = agentId;
    this.inboundTopicId = inboundTopicId;

    console.log(`🔧 Initializing ConnectionsHandler for agent ${agentId}`);
    console.log(`   Inbound topic ID: ${inboundTopicId}`);

    // Create ConnectionsManager with proper configuration
    this.connectionsManager = new ConnectionsManager({
      baseClient: this.client,
      logLevel: 'info',
      prettyPrint: true
    });

    // Set required agent info
    await this.connectionsManager.setAgentInfo({
      accountId: this.agentId,
      inboundTopicId: this.inboundTopicId
    });

    // Fetch initial connection data
    console.log('🔄 Fetching initial connections data...');
    await this.connectionsManager.fetchConnectionData(this.agentId);
    console.log('✅ ConnectionsHandler initialized');
  }

  /**
   * Process incoming messages using ConnectionsManager
   * Following standards-expert-agent example
   */
  async processMessages(messages) {
    if (!this.connectionsManager) {
      throw new Error('ConnectionsHandler not initialized');
    }

    // Process messages with ConnectionsManager to handle connection requests properly
    // This ensures proper handling of duplicate connection requests
    await this.connectionsManager.processInboundMessages(messages);

    // Handle pending connections and those needing confirmation
    await this.processConnectionRequests();
  }

  /**
   * Process pending connections and those needing confirmation
   * This is the key to avoiding duplicate connections
   */
  async processConnectionRequests() {
    if (!this.connectionsManager) {
      throw new Error('ConnectionsHandler not initialized');
    }

    try {
      // Get fresh data
      await this.connectionsManager.fetchConnectionData(this.agentId);

      // Process both types of pending connections
      const pendingRequests = this.connectionsManager.getPendingRequests();
      const needsConfirmation = this.connectionsManager.getConnectionsNeedingConfirmation();

      console.log(`🔍 Found ${pendingRequests.length} pending connection requests`);
      console.log(`🔍 Found ${needsConfirmation.length} connections needing confirmation`);

      // Handle connection requests that need explicit confirmation
      for (const conn of needsConfirmation) {
        await this.handleNeedsConfirmation(conn);
      }

      // Handle standard pending requests
      for (const conn of pendingRequests) {
        await this.handlePendingRequest(conn);
      }
    } catch (error) {
      console.error('❌ Error processing connection requests:', error);
      throw error;
    }
  }

  /**
   * Handle a connection needing confirmation
   * @param {Object} conn The connection object
   */
  async handleNeedsConfirmation(conn) {
    try {
      console.log(`🔄 Processing connection needing confirmation from ${conn.targetAccountId}`);
      
      // Handle the connection request using ConnectionsManager
      const result = await this.client.handleConnectionRequest(
        this.inboundTopicId,
        conn.targetAccountId,
        conn.connectionRequestId
      );

      if (result && result.connectionTopicId) {
        console.log(`✅ Connection established: ${result.connectionTopicId}`);
        
        // Update connection status in ConnectionsManager
        conn.status = 'established';
        conn.needsConfirmation = false;
        this.connectionsManager.updateOrAddConnection(conn);

        // Emit event for optional handling
        this.emit('connection_established', conn);
      }
    } catch (error) {
      console.error('❌ Error handling connection needing confirmation:', error);
      throw error;
    }
  }

  /**
   * Handle a standard pending connection request
   * @param {Object} conn The connection object
   */
  async handlePendingRequest(conn) {
    try {
      console.log(`🔄 Processing pending connection request from ${conn.targetAccountId}`);

      // Handle the connection request using ConnectionsManager
      const result = await this.client.handleConnectionRequest(
        this.inboundTopicId, 
        conn.targetAccountId,
        conn.connectionRequestId
      );

      if (result && result.connectionTopicId) {
        console.log(`✅ Connection established: ${result.connectionTopicId}`);
        
        // Update connection status in ConnectionsManager
        conn.status = 'established';
        conn.isPending = false;
        this.connectionsManager.updateOrAddConnection(conn);

        // Emit event for optional handling
        this.emit('connection_established', conn);
      }
    } catch (error) {
      console.error('❌ Error handling pending connection request:', error);
      throw error;
    }
  }
}