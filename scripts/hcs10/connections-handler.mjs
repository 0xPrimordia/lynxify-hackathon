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

    // Create ConnectionsManager as shown in standards-expert example
    this.connectionsManager = new ConnectionsManager({
      baseClient: this.client
    });

    // Fetch initial connection data
    console.log('🔄 Fetching initial connections data...');
    await this.connectionsManager.fetchConnectionData(this.agentId);
    console.log('✅ ConnectionsHandler initialized');

    // Initial sync to file
    await this.syncConnectionsToFile();
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
    this.connectionsManager.processInboundMessages(messages);

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

      // Sync to file
      await this.syncConnectionsToFile();
    } catch (error) {
      console.error('❌ Error processing connection requests:', error);
    }
  }

  /**
   * Handle a connection needing confirmation
   * @param {Object} conn The connection object
   */
  async handleNeedsConfirmation(conn) {
    try {
      console.log(`🔄 Handling connection needing confirmation: ${conn.connectionTopicId}`);
      console.log(`   From: ${conn.targetAccountId}`);

      // Extract request ID - this is important
      const requestId = conn.connectionRequestId;
      if (!requestId) {
        console.error('❌ Missing connectionRequestId for connection needing confirmation');
        return;
      }

      // Following standards-expert example to approve the connection
      const result = await this.client.handleConnectionRequest(
        this.inboundTopicId,
        conn.targetAccountId,
        requestId
      );

      console.log(`✅ Connection approved: ${result.connectionTopicId}`);

      // Update connection status
      conn.status = 'established';
      conn.needsConfirmation = false;
      this.connectionsManager.updateOrAddConnection(conn);

      // Emit event for optional handling
      this.emit('connection_established', conn);
    } catch (error) {
      console.error('❌ Error handling connection needing confirmation:', error);
    }
  }

  /**
   * Handle a standard pending connection request
   * @param {Object} conn The connection object
   */
  async handlePendingRequest(conn) {
    try {
      console.log(`🔄 Handling pending connection request: ${conn.connectionTopicId}`);
      console.log(`   From: ${conn.targetAccountId}`);

      // Extract request ID - this is important
      const requestId = conn.connectionRequestId;
      if (!requestId) {
        console.error('❌ Missing connectionRequestId for pending connection');
        return;
      }

      // Following standards-expert example to approve the connection
      const result = await this.client.handleConnectionRequest(
        this.inboundTopicId,
        conn.targetAccountId,
        requestId
      );

      console.log(`✅ Connection approved: ${result.connectionTopicId}`);

      // Update connection status
      conn.status = 'established';
      conn.isPending = false;
      this.connectionsManager.updateOrAddConnection(conn);

      // Emit event for optional handling
      this.emit('connection_established', conn);
    } catch (error) {
      console.error('❌ Error handling pending connection request:', error);
    }
  }

  /**
   * Synchronize connections to file 
   * Called after connection updates to ensure file remains in sync
   */
  async syncConnectionsToFile() {
    try {
      const connections = this.connectionsManager.getAllConnections();

      // Format for file storage
      const connectionsToStore = connections.map(conn => ({
        id: conn.connectionTopicId,
        connectionTopicId: conn.connectionTopicId,
        requesterId: conn.targetAccountId,
        status: conn.status || 'established',
        timestamp: conn.created?.getTime() || Date.now()
      }));

      // Write to file
      await fs.writeFile(CONNECTIONS_FILE, JSON.stringify(connectionsToStore, null, 2));
      console.log(`✅ Synchronized ${connectionsToStore.length} connections to file`);
    } catch (error) {
      console.error('❌ Error syncing connections to file:', error);
    }
  }

  /**
   * Get all connections
   * @returns {Array} All connections
   */
  getAllConnections() {
    if (!this.connectionsManager) {
      return [];
    }
    return this.connectionsManager.getAllConnections();
  }

  /**
   * Get pending connections
   * @returns {Array} Pending connections
   */
  getPendingConnections() {
    if (!this.connectionsManager) {
      return [];
    }
    
    const pendingRequests = this.connectionsManager.getPendingRequests();
    const needsConfirmation = this.connectionsManager.getConnectionsNeedingConfirmation();
    
    // Combine both types
    return [...pendingRequests, ...needsConfirmation];
  }

  /**
   * Get established connections
   * @returns {Array} Established connections
   */
  getEstablishedConnections() {
    if (!this.connectionsManager) {
      return [];
    }
    return this.connectionsManager.getActiveConnections();
  }
} 