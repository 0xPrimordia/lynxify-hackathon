#!/usr/bin/env node
/**
 * Start the ES Module compatible HCS10 agent with real Hedera network connection
 * This script starts a live agent that can respond to messages on the Hedera network
 * using the proper HCS-10 protocol patterns with ConnectionsManager
 */

import dotenv from 'dotenv';
import { Client, PrivateKey, TopicCreateTransaction, TopicMessageSubmitTransaction, TopicInfoQuery, TopicId, Hbar, TopicMessageQuery } from '@hashgraph/sdk';
import * as http from 'node:http';
import * as fs from 'node:fs';
import * as path from 'node:path';

// Constants for file paths
const CONNECTIONS_FILE = './connections.json';
const PENDING_PROPOSALS_FILE = './pending-proposals.json';
const EXECUTED_PROPOSALS_FILE = './executed-proposals.json';

// Set up port for Render deployment
const port = process.env.PORT || 3000;

// Load .env file
dotenv.config({ path: './.env.local' });

// Set up topics and client
const inboundTopicId = process.env.NEXT_PUBLIC_HCS_INBOUND_TOPIC;
const outboundTopicId = process.env.NEXT_PUBLIC_HCS_OUTBOUND_TOPIC;
const operatorId = process.env.NEXT_PUBLIC_OPERATOR_ID;
const operatorKey = process.env.OPERATOR_KEY;
const network = process.env.NEXT_PUBLIC_NETWORK || 'testnet';

// Constants for connection management
const CONNECTION_STATES = {
  PENDING: 'pending',           // Connection requested but not confirmed
  ESTABLISHED: 'established',   // Connection confirmed and active
  INACTIVE: 'inactive',         // No activity in a while
  CLOSED: 'closed'              // Explicitly closed
};
const CONNECTION_INACTIVE_THRESHOLD = 24 * 60 * 60 * 1000; // 24 hours
const CONNECTION_CLEANUP_INTERVAL = 60 * 60 * 1000; // 1 hour
const CONNECTIONS_SYNC_INTERVAL = 5 * 60 * 1000; // 5 minutes

// Global connections map
const connections = loadConnections();

// Debug connections
if (Object.keys(connections).length > 0) {
  console.log('Connection summary:');
  console.log(`- Total connections: ${Object.keys(connections).length}`);
  console.log(`- Established: ${Object.values(connections).filter(c => c.state === CONNECTION_STATES.ESTABLISHED).length}`);
  console.log(`- Inactive: ${Object.values(connections).filter(c => c.state === CONNECTION_STATES.INACTIVE).length}`);
  console.log(`- Closed: ${Object.values(connections).filter(c => c.state === CONNECTION_STATES.CLOSED).length}`);
  console.log(`- Pending: ${Object.values(connections).filter(c => c.state === CONNECTION_STATES.PENDING).length}`);
  console.log(`- No state (legacy): ${Object.values(connections).filter(c => !c.state).length}`);
}

// Track processed messages to avoid duplication
const processedMessages = new Map();
const MESSAGE_TTL = 5 * 60 * 1000; // 5 minutes TTL for deduplication cache

// Global client reference
let hederaClient = null;
let connectionsManagerWrapper = null;

// Feature flags
const connectionsManagerAvailable = true; // Set to false to disable ConnectionsManager integration

// Clean up old message entries
function cleanupProcessedMessages() {
  const now = Date.now();
  let count = 0;
  
  for (const [id, timestamp] of processedMessages.entries()) {
    if (now - timestamp > MESSAGE_TTL) {
      processedMessages.delete(id);
      count++;
    }
  }
  
  if (count > 0) {
    console.log(`🧹 Cleaned up ${count} old message entries from deduplication cache`);
  }
}

// Set up periodic cleanup
setInterval(cleanupProcessedMessages, 60 * 1000); // Every minute

// Direct ConnectionsManager wrapper - simplified to follow SDK examples
class ConnectionsManagerWrapper {
  constructor() {
    this.connectionsManager = null;
    this.initialized = false;
  }
  
  async initialize(ConnectionsManager, client) {
    try {
      console.log('Initializing ConnectionsManager...');
      
      // Create a new ConnectionsManager instance with the proper client configuration
      // We're now using the HederaHCS10Client itself as baseClient, so it has all needed methods
      this.connectionsManager = new ConnectionsManager({
        baseClient: client, // The client itself is the baseClient - it has all required methods
        logLevel: 'info',
        prettyPrint: true
      });
      
      // Set agent info based on available methods
      if (typeof this.connectionsManager.setAgentInfo === 'function') {
        await this.connectionsManager.setAgentInfo({
          accountId: client.operatorId,
          inboundTopicId: inboundTopicId,
          outboundTopicId: outboundTopicId
        });
      } else if (typeof this.connectionsManager.initialize === 'function') {
        await this.connectionsManager.initialize({
          accountId: client.operatorId,
          inboundTopicId: inboundTopicId,
          outboundTopicId: outboundTopicId
        });
      } else {
        console.warn('Could not find setAgentInfo or initialize method, ConnectionsManager may not be properly configured');
      }
      
      // Load connections using the API
      if (typeof this.connectionsManager.fetchConnectionData === 'function') {
        await this.connectionsManager.fetchConnectionData(client.operatorId);
      } else if (typeof this.connectionsManager.loadConnections === 'function') {
        await this.connectionsManager.loadConnections(client.operatorId);
      } else {
        console.warn('Could not find a method to load connections');
      }
      
      this.initialized = true;
      console.log('✅ ConnectionsManager fully initialized');
      
      // Auto-approve any pending requests
      await this.approvePendingRequests();
      
      return true;
    } catch (error) {
      console.error('❌ Error initializing ConnectionsManager:', error);
      return false;
    }
  }
  
  // Get all pending connection requests
  getPendingRequests() {
    if (!this.connectionsManager) {
      return [];
    }
    
    try {
      // Try the different methods that might exist
      if (typeof this.connectionsManager.getPendingRequests === 'function') {
        return this.connectionsManager.getPendingRequests() || [];
      } else if (typeof this.connectionsManager.getConnectionsNeedingConfirmation === 'function') {
        return this.connectionsManager.getConnectionsNeedingConfirmation() || [];
      } else {
        console.warn('No method found to get pending requests');
        return [];
      }
    } catch (error) {
      console.error('Error getting pending requests:', error);
      return [];
    }
  }
  
  // Get all connections
  getConnections() {
    if (!this.connectionsManager) {
      return [];
    }
    
    try {
      // Try the different methods that might exist
      if (typeof this.connectionsManager.getConnections === 'function') {
        return this.connectionsManager.getConnections() || [];
      } else if (typeof this.connectionsManager.getAllConnections === 'function') {
        return this.connectionsManager.getAllConnections() || [];
      } else {
        console.warn('No method found to get connections');
        return [];
      }
    } catch (error) {
      console.error('Error getting connections:', error);
      return [];
    }
  }
  
  // Accept a connection request
  async acceptConnection(requestId, memo = 'Connection accepted') {
    if (!this.connectionsManager) {
      return false;
    }
    
    try {
      // Try the different methods that might exist
      if (typeof this.connectionsManager.acceptConnectionRequest === 'function') {
        await this.connectionsManager.acceptConnectionRequest({
          requestId,
          memo
        });
        return true;
      } else if (typeof this.connectionsManager.acceptConnection === 'function') {
        await this.connectionsManager.acceptConnection(requestId, memo);
        return true;
      } else {
        console.warn('No method found to accept connection request');
        return false;
      }
    } catch (error) {
      console.error(`Error accepting connection request ${requestId}:`, error);
      return false;
    }
  }
  
  // Process messages through ConnectionsManager
  async processMessages(messages, topicId) {
    if (!this.connectionsManager) {
      return false;
    }
    
    try {
      // Try the different methods that might exist
      if (typeof this.connectionsManager.processInboundMessages === 'function') {
        await this.connectionsManager.processInboundMessages(messages);
        return true;
      } else if (typeof this.connectionsManager.processMessages === 'function') {
        await this.connectionsManager.processMessages(topicId, messages);
        return true;
      } else {
        console.warn('No method found to process messages');
        return false;
      }
    } catch (error) {
      console.error('Error processing messages through ConnectionsManager:', error);
      return false;
    }
  }
  
  // Auto-approve any pending requests
  async approvePendingRequests() {
    try {
      // Check for pending requests
      const pendingRequests = this.getPendingRequests();
      if (pendingRequests.length > 0) {
        console.log(`Found ${pendingRequests.length} pending connection requests`);
        
        // Auto-approve pending connections
        for (const request of pendingRequests) {
          console.log(`Auto-approving connection request: ${request.id}`);
          await this.acceptConnection(request.id, 'Connection auto-accepted by agent');
        }
      } else {
        console.log('No pending connection requests found');
      }
    } catch (error) {
      console.error('Error processing pending requests:', error);
    }
  }
}

// Create a real Hedera client with direct message subscription
class HederaHCS10Client {
  constructor(options) {
    this.privateKey = null;
    this.client = null;
    this.baseClient = null; // Add baseClient property for ConnectionsManager
    this.operatorId = options.operatorId;
    this.operatorKey = options.operatorKey;
    this.network = options.network;
    this.subscriptions = {};
    this.latestMessages = {};
    this.topicInfoCache = {}; // Cache for topic info
    this.connectionsManagerWrapper = null; // Set by startAgent
    
    // Initialize the client
    this.init();
  }

  // Initialize the client
  async init() {
    try {
      console.log('Initializing Hedera client...');
      
      // Create the client for the specified network
      this.client = Client.forName(this.network);
      
      // Set up operator account
      this.privateKey = PrivateKey.fromString(this.operatorKey);
      this.client.setOperator(this.operatorId, this.privateKey);
      
      // Set baseClient to this client instance (self-reference) so ConnectionsManager gets all our methods
      this.baseClient = this;
      
      console.log(`✅ Client initialized for ${this.network} with operator ${this.operatorId}`);
    } catch (error) {
      console.error('❌ Error initializing client:', error);
      throw error;
    }
  }

  // Wait for client to be fully initialized
  async waitForReady() {
    // If client is not initialized, wait for it
    if (!this.client) {
      console.log('Waiting for client to initialize...');
      await this.init();
    }
    
    // Test connection with a simple query to ensure client works
    try {
      console.log('Testing client connection...');
      
      // Use a simple query to test connectivity
      const accountId = this.operatorId;
      await new TopicInfoQuery()
        .setTopicId(TopicId.fromString(inboundTopicId))
        .execute(this.client);
        
      console.log('✅ Client connection verified');
      return true;
    } catch (error) {
      console.error('❌ Error testing client connection:', error);
      throw error;
    }
  }

  // Get a mirror client (required by ConnectionsManager)
  getMirrorClient() {
    return this.client;
  }
  
  // Add required getAccountBalance method for ConnectionsManager
  async getAccountBalance(accountId) {
    try {
      // Just return a placeholder balance since we don't need the actual balance
      return { hbars: new Hbar(100) };
    } catch (error) {
      console.error(`Error getting account balance: ${error}`);
      throw error;
    }
  }
  
  // Get message stream in the format expected by HCS10AgentWithConnections
  async getMessageStream(topicId) {
    try {
      console.log(`Getting messages from topic ${topicId}`);
      
      // Format cached messages in the expected format if they exist
      const messages = this.latestMessages[topicId] || [];
      
      // Return in the expected format
      return {
        messages: messages.map(msg => ({
          ...msg,
          topic_id: topicId
        }))
      };
    } catch (error) {
      console.error(`Error getting message stream for topic ${topicId}:`, error);
      return { messages: [] };
    }
  }

  async sendMessage(topicId, message) {
    try {
      console.log(`Sending message to topic ${topicId}...`);
      console.log(`Message length: ${message.length} bytes`);
      
      // Check if we have the topic info in cache
      let hasSubmitKey = false;
      if (!this.topicInfoCache[topicId]) {
        try {
          const topicInfo = await new TopicInfoQuery()
            .setTopicId(TopicId.fromString(topicId))
            .execute(this.client);
            
          hasSubmitKey = topicInfo.submitKey ? true : false;
          this.topicInfoCache[topicId] = { hasSubmitKey };
          console.log(`Topic ${topicId} has submit key: ${hasSubmitKey}`);
        } catch (error) {
          console.warn(`Failed to get topic info for ${topicId}, assuming no submit key:`, error);
          this.topicInfoCache[topicId] = { hasSubmitKey: false };
        }
      } else {
        hasSubmitKey = this.topicInfoCache[topicId].hasSubmitKey;
      }
      
      // Create a message transaction with explicit options
      console.log('Creating TopicMessageSubmitTransaction...');
      const transaction = new TopicMessageSubmitTransaction({
        topicId: topicId, 
        message: message,
        maxTransactionFee: new Hbar(10) // Explicit 10 hbar max fee
      });
      
      let response;
      
      // Use proper transaction pattern based on topic submit key
      if (hasSubmitKey) {
        // For topics with submit key (freeze+sign+execute)
        console.log('Topic has submit key, using freeze+sign+execute pattern');
        const frozenTx = await transaction.freezeWith(this.client);
        const signedTx = await frozenTx.sign(this.privateKey);
        response = await signedTx.execute(this.client);
      } else {
        // For topics without submit key (direct execute)
        console.log('Topic has no submit key, using direct execute pattern');
        response = await transaction.execute(this.client);
      }
      
      console.log(`✅ Message sent to topic ${topicId} with transaction ID: ${response.transactionId.toString()}`);
      return { success: true, transactionId: response.transactionId.toString() };
    } catch (error) {
      console.error(`❌ Error sending message to topic ${topicId}:`, error);
      return { success: false, error: error.message };
    }
  }

  async createTopic(withSubmitKey = false, topicMemo = '') {
    try {
      console.log(`Creating new topic ${withSubmitKey ? 'with' : 'without'} submit key...`);
      
      // Create transaction
      let transaction = new TopicCreateTransaction()
        .setMaxTransactionFee(new Hbar(10));
      
      // Set admin key to our key
      transaction = transaction.setAdminKey(this.privateKey.publicKey);
      
      // If requested, set submit key to our key (otherwise anyone can submit)
      if (withSubmitKey) {
        transaction = transaction.setSubmitKey(this.privateKey.publicKey);
      }
      
      // Add topic memo if provided
      if (topicMemo) {
        transaction = transaction.setTopicMemo(topicMemo);
        console.log(`Setting topic memo: ${topicMemo}`);
      }
      
      // Submit the transaction
      const response = await transaction.execute(this.client);
      
      // Get the receipt
      const receipt = await response.getReceipt(this.client);
      
      // Get the topic ID
      const topicId = receipt.topicId.toString();
      console.log(`✅ Created new topic: ${topicId}`);
      
      // Initialize subscription for this topic
      await this.subscribeToTopic(topicId);
      
      return topicId;
    } catch (error) {
      console.error('❌ Error creating topic:', error);
      throw error;
    }
  }
  
  async subscribeToTopic(topicId) {
    try {
      console.log(`Setting up subscription to topic ${topicId}...`);
      
      // Initialize cache for this topic
      if (!this.latestMessages[topicId]) {
        this.latestMessages[topicId] = [];
      }
      
      // If we're already subscribed, don't do it again
      if (this.subscriptions[topicId]) {
        console.log(`Already subscribed to topic ${topicId}`);
        return;
      }
      
      // Create a query to subscribe
      console.log(`Creating TopicMessageQuery for ${topicId}...`);
      const messageQuery = new TopicMessageQuery()
        .setTopicId(topicId);
        
      // Subscribe and set up message handler
      this.subscriptions[topicId] = await messageQuery.subscribe(
        this.client,
        (message) => this.handleIncomingMessage(message, topicId)
      );
      
      console.log(`✅ Successfully subscribed to topic ${topicId}`);
    } catch (error) {
      console.error(`❌ Error subscribing to topic ${topicId}:`, error);
    }
  }
  
  // Handle incoming messages from the subscription
  async handleIncomingMessage(message, topicId) {
    try {
      // Extract message content
      const contents = Buffer.from(message.contents).toString();
      const consensusTimestamp = message.consensusTimestamp.toDate();
      
      // Create a unique message ID for deduplication
      const messageId = `${topicId}-${consensusTimestamp.toISOString()}`;
      
      // Check if we've already processed this message
      if (processedMessages.has(messageId)) {
        console.log(`⚠️ Skipping duplicate message: ${messageId}`);
        return;
      }
      
      // Mark as processed with current timestamp
      processedMessages.set(messageId, Date.now());
      
      console.log(`🔔 Received message on topic ${topicId} at ${consensusTimestamp.toISOString()}`);
      console.log(`Content: ${contents}`);
      
      // Store the message for later retrieval
      this.latestMessages[topicId].push({
        contents,
        sequence_number: Date.now(), // Use timestamp as sequence
        consensus_timestamp: consensusTimestamp
      });
      
      // Only keep the last 10 messages
      if (this.latestMessages[topicId].length > 10) {
        this.latestMessages[topicId].shift();
      }
      
      // If we have a ConnectionsManager wrapper, process through it
      if (this.connectionsManagerWrapper && this.connectionsManagerWrapper.initialized) {
        try {
          // Format the message for ConnectionsManager
          const formattedMessage = {
            consensusTimestamp,
            topicId,
            message: contents,
            sequence: null // not required by ConnectionsManager
          };
          
          // Process through ConnectionsManager
          const processed = await this.connectionsManagerWrapper.processMessages([formattedMessage], topicId);
          if (processed) {
            console.log('✅ Message processed through ConnectionsManager');
            return;
          }
        } catch (cmError) {
          console.error('Error processing through ConnectionsManager:', cmError);
        }
      }
      
      // If ConnectionsManager failed or isn't available, process directly
      await this.processMessageDirectly(contents, topicId);
    } catch (error) {
      console.error('❌ Error handling incoming message:', error);
    }
  }
  
  // Process a message directly (for immediate feedback during testing)
  async processMessageDirectly(content, topicId) {
    console.log(`🔄 Directly processing message from topic ${topicId}`);
    
    try {
      // Parse the message
      const message = JSON.parse(content);
      
      // Check if it's a valid HCS-10 message
      if (message.p !== 'hcs-10') {
        console.log('Not an HCS-10 message, ignoring');
        return;
      }
      
      console.log(`Processing message with operation: ${message.op}`);
      
      // If it's the inbound topic, only handle connection requests
      if (topicId === inboundTopicId) {
        // Handle connection request
        if (message.op === 'connection_request') {
          await this.handleConnectionRequest(message);
        } else if (message.op === 'connection_created') {
          console.log(`Received connection_created on inbound topic - this is likely a response to someone else's request`);
        } else {
          console.log(`Ignoring non-connection request message on inbound topic: ${message.op}`);
        }
      } 
      // If it's a connection topic, handle regular messages
      else if (this.isConnectionTopic(topicId)) {
        // Update connection activity timestamp
        this.updateConnectionActivity(topicId);
        
        if (message.op === 'message') {
          await this.handleRegularMessage(message, topicId);
        } else if (message.op === 'close_connection') {
          await this.handleCloseConnection(message, topicId);
        } else {
          console.log(`Received message with op ${message.op} on connection topic ${topicId}`);
        }
      }
      // If it's the outbound topic, we don't need to handle messages
      else if (topicId === outboundTopicId) {
        console.log(`Received message on outbound topic: ${message.op}. Outbound topic should only be used for broadcasts.`);
      }
    } catch (error) {
      console.error('❌ Error processing message directly:', error);
    }
  }
  
  // Check if a topic is a connection topic
  isConnectionTopic(topicId) {
    for (const connection of Object.values(connections)) {
      if (connection.connectionTopicId === topicId) {
        return true;
      }
    }
    return false;
  }
  
  // Handle a connection request by creating a dedicated connection topic
  async handleConnectionRequest(message) {
    console.log('Responding to connection request...');
    
    // Extract the requester information from operator_id
    let requesterTopic = '';
    let requesterId = '';
    
    if (message.operator_id) {
      const parts = message.operator_id.split('@');
      if (parts.length === 2) {
        requesterTopic = parts[0];
        requesterId = parts[1];
      }
    }
    
    if (!requesterTopic || !requesterId) {
      console.error('Invalid operator_id in connection request:', message.operator_id);
      return;
    }
    
    console.log(`Requester topic: ${requesterTopic}, Requester ID: ${requesterId}`);
    
    // Check if we already have a connection for this requester
    if (connections[requesterTopic]) {
      const existingConnection = connections[requesterTopic];
      console.log(`Found existing connection for ${requesterTopic} with state: ${existingConnection.state}`);
      
      // If we have a connection topic, reuse it
      if (existingConnection.connectionTopicId) {
        // If connection was inactive, reactivate it
        if (existingConnection.state === CONNECTION_STATES.INACTIVE) {
          existingConnection.state = CONNECTION_STATES.ESTABLISHED;
          existingConnection.stateUpdatedAt = Date.now();
          existingConnection.lastActivity = Date.now();
          console.log(`🔄 Reactivated inactive connection: ${existingConnection.connectionTopicId}`);
        }
        
        console.log(`Reusing existing connection topic: ${existingConnection.connectionTopicId}`);
        
        // Send connection_created response
        const response = {
          p: 'hcs-10',
          op: 'connection_created',
          connection_topic_id: existingConnection.connectionTopicId,
          connected_account_id: requesterId,
          operator_id: `${inboundTopicId}@${operatorId}`,
          connection_id: Date.now(),
          timestamp: Date.now()
        };
        
        // Send through Hedera
        await this.sendMessage(requesterTopic, JSON.stringify(response));
        console.log(`✅ Sent connection_created response to ${requesterTopic} with existing topic ${existingConnection.connectionTopicId}`);
        
        // Save connection state changes
        saveConnections();
        return;
      }
    }
    
    // Create a new connection topic with proper metadata
    console.log('Creating new dedicated connection topic...');
    const connectionDescription = `HCS-10 Connection: Agent ${operatorId} with Client ${requesterId}`;
    const connectionTopicId = await this.createTopic(false, connectionDescription);
    
    // Store connection information with state tracking
    connections[requesterTopic] = {
      requesterTopic,
      requesterId,
      connectionTopicId,
      created: Date.now(),
      lastActivity: Date.now(),
      state: CONNECTION_STATES.ESTABLISHED,
      stateUpdatedAt: Date.now(),
      messageCount: 0
    };
    
    // Save to file
    saveConnections();
    
    // Send connection_created response
    const response = {
      p: 'hcs-10',
      op: 'connection_created',
      connection_topic_id: connectionTopicId,
      connected_account_id: requesterId,
      operator_id: `${inboundTopicId}@${operatorId}`,
      connection_id: Date.now(),
      timestamp: Date.now()
    };
    
    // Send through Hedera
    await this.sendMessage(requesterTopic, JSON.stringify(response));
    console.log(`✅ Sent connection_created response to ${requesterTopic} with new topic ${connectionTopicId}`);
  }
  
  // Handle a regular message on a connection topic
  async handleRegularMessage(message, topicId) {
    console.log(`Processing regular message on connection topic ${topicId}`);
    
    // Update connection activity timestamp
    for (const connection of Object.values(connections)) {
      if (connection.connectionTopicId === topicId) {
        connection.lastActivity = Date.now();
        connection.messageCount = (connection.messageCount || 0) + 1;
        
        // If connection was inactive, reactivate it
        if (connection.state === CONNECTION_STATES.INACTIVE) {
          connection.state = CONNECTION_STATES.ESTABLISHED;
          connection.stateUpdatedAt = Date.now();
          console.log(`🔄 Reactivated inactive connection: ${topicId}`);
        }
        
        // Save connection state changes
        saveConnections();
        break;
      }
    }
    
    try {
      // For simplicity in this demo, just echo back the message with a timestamp
      const responseText = typeof message.data === 'string' 
        ? message.data
        : JSON.stringify(message.data);
        
      const response = {
        p: 'hcs-10',
        op: 'message',
        data: `Echo: ${responseText}`,
        timestamp: Date.now()
      };
      
      // Send response to the same connection topic
      await this.sendMessage(topicId, JSON.stringify(response));
      console.log(`✅ Sent echo response to connection topic ${topicId}`);
    } catch (error) {
      console.error('❌ Error handling regular message:', error);
    }
  }
  
  // Update connection activity timestamp and state if needed
  updateConnectionActivity(topicId) {
    for (const connection of Object.values(connections)) {
      if (connection.connectionTopicId === topicId) {
        const now = Date.now();
        connection.lastActivity = now;
        connection.messageCount = (connection.messageCount || 0) + 1;
        
        // If connection was inactive, reactivate it
        if (connection.state === CONNECTION_STATES.INACTIVE) {
          connection.state = CONNECTION_STATES.ESTABLISHED;
          connection.stateUpdatedAt = now;
          console.log(`🔄 Reactivated inactive connection: ${topicId}`);
          saveConnections();
        }
        break;
      }
    }
  }
  
  // Handle a close_connection message
  async handleCloseConnection(message, topicId) {
    console.log(`Received close_connection request on topic ${topicId}`);
    
    // Find the connection
    for (const [requesterTopic, connection] of Object.entries(connections)) {
      if (connection.connectionTopicId === topicId) {
        // Mark as closed
        connection.state = CONNECTION_STATES.CLOSED;
        connection.stateUpdatedAt = Date.now();
        connection.closeReason = message.reason || 'Client closed connection';
        
        console.log(`✅ Connection ${topicId} closed. Reason: ${connection.closeReason}`);
        saveConnections();
        
        // Acknowledge the close
        const response = {
          p: 'hcs-10',
          op: 'connection_closed',
          connection_topic_id: topicId,
          timestamp: Date.now(),
          reason: 'Acknowledged'
        };
        
        await this.sendMessage(topicId, JSON.stringify(response));
        break;
      }
    }
  }
  
  // Implement required methods for ConnectionsManager

  // Get all known topics for an account
  async retrieveCommunicationTopics(accountId) {
    console.log(`Retrieving communication topics for account ${accountId}`);
    
    // Return our known topics for this account
    const topics = [];
    
    // Always include our inbound/outbound topics
    topics.push(inboundTopicId);
    topics.push(outboundTopicId);
    
    // Include connection topics 
    let connectionCount = 0;
    for (const connection of Object.values(connections)) {
      if (connection.connectionTopicId && !topics.includes(connection.connectionTopicId)) {
        topics.push(connection.connectionTopicId);
        connectionCount++;
      }
    }
    
    console.log(`Found ${topics.length} total communication topics (${connectionCount} connection topics) for account ${accountId}`);
    return topics;
  }
  
  // Get messages for a topic
  async getMessages(topicId) {
    // Return cached messages for this topic
    return this.latestMessages[topicId] || [];
  }

  // Get topic info
  async getTopicInfo(topicId) {
    try {
      const topicInfo = await new TopicInfoQuery()
        .setTopicId(TopicId.fromString(topicId))
        .execute(this.client);
      
      return topicInfo;
    } catch (error) {
      console.error(`Error getting topic info for ${topicId}:`, error);
      throw error;
    }
  }
}

/**
 * Start the agent
 */
async function startAgent() {
  console.log('🚀 Starting HCS-10 Agent...');
  
  try {
    // Create a client to communicate with Hedera
    hederaClient = new HederaHCS10Client({
      operatorId,
      operatorKey,
      network
    });
    
    // Wait for client to fully initialize
    await hederaClient.waitForReady();
    
    console.log(`Loaded ${Object.keys(connections).length} existing connections`);
    
    // Create ConnectionsManager if available
    if (connectionsManagerAvailable) {
      try {
        // Load the ConnectionsManager from the standards-sdk package
        const standardsSDK = await import('@hashgraphonline/standards-sdk');
        
        // Check if ConnectionsManager exists
        if (standardsSDK.ConnectionsManager) {
          console.log('✅ ConnectionsManager found in standards-sdk');
          
          // Initialize wrapper
          connectionsManagerWrapper = new ConnectionsManagerWrapper();
          
          // Create a minimal client with baseClient EXACTLY as the SDK expects
          // No need to create a minimal client, just pass the HederaHCS10Client directly
          // It already has a baseClient property properly set in its init() method
          
          // Pass the client directly - it has baseClient property set correctly
          await connectionsManagerWrapper.initialize(standardsSDK.ConnectionsManager, hederaClient);
          
          // Set the wrapper in the client
          hederaClient.connectionsManagerWrapper = connectionsManagerWrapper;
          
          // Get connected topics from ConnectionsManager
          const managerConnections = connectionsManagerWrapper.getConnections();
          console.log(`ConnectionsManager has ${managerConnections.length} connections`);
          
          console.log('✅ HCS10 client initialized successfully with ConnectionsManager');
          
          // Schedule periodic checks for pending requests
          setInterval(async () => {
            await connectionsManagerWrapper.approvePendingRequests();
          }, 30000); // Check every 30 seconds
        } else {
          console.error('❌ ConnectionsManager not found in standards-sdk');
        }
      } catch (error) {
        console.error('❌ Error initializing ConnectionsManager:', error);
        console.error('Full error:', error instanceof Error ? error.stack : JSON.stringify(error));
        console.log('⚠️ ConnectionsManager not available, using basic connection handling');
      }
    } else {
      console.log('⚠️ ConnectionsManager not available, using basic connection handling');
    }
    
    // Subscribe to all topics
    console.log('Subscribing to inbound topic...');
    await hederaClient.subscribeToTopic(inboundTopicId);
    
    console.log('Subscribing to outbound topic...');
    await hederaClient.subscribeToTopic(outboundTopicId);
    
    // Subscribe to all connection topics from internal connections
    console.log('Subscribing to all connection topics...');
    const connectionTopics = new Set();
    
    // Add internal connection topics
    for (const connection of Object.values(connections)) {
      if (connection.connectionTopicId) {
        connectionTopics.add(connection.connectionTopicId);
      }
    }
    
    // Add ConnectionsManager topics
    if (connectionsManagerWrapper && connectionsManagerWrapper.initialized) {
      const managerConnections = connectionsManagerWrapper.getConnections();
      for (const connection of managerConnections) {
        if (connection.connectionTopicId || connection.topicId) {
          connectionTopics.add(connection.connectionTopicId || connection.topicId);
        }
      }
    }
    
    // Subscribe to unique topics
    let count = 0;
    for (const topicId of connectionTopics) {
      await hederaClient.subscribeToTopic(topicId);
      count++;
    }
    
    console.log(`✅ Subscribed to ${count} connection topics`);
    console.log('✅ Agent is now running and listening for messages');
    console.log('Press Ctrl+C to stop the agent...');
    
    // Handle Ctrl+C for graceful shutdown
    process.on('SIGINT', async () => {
      console.log('🛑 Shutting down agent...');
      process.exit(0);
    });
  } catch (error) {
    console.error('❌ Error starting agent:', error);
    process.exit(1);
  }
}

// Create HTTP server for Render
const server = http.createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ 
    status: 'ok', 
    agent: 'Lynxify HCS-10 Agent',
    timestamp: new Date().toISOString(),
    connections: Object.keys(connections).length
  }));
});

// Start HTTP server before agent
server.listen(port, '0.0.0.0', () => {
  console.log(`✅ HTTP server running on port ${port} bound to 0.0.0.0`);
  
  // Start the agent after server is listening
  startAgent();
});

/**
 * Load existing connections from file
 */
function loadConnections() {
  try {
    // Check if connections file exists, if not return empty object
    if (!fs.existsSync(CONNECTIONS_FILE)) {
      console.log(`No ${CONNECTIONS_FILE} file found, starting with empty connections`);
      return {};
    }
    
    // Read connections file
    const data = fs.readFileSync(CONNECTIONS_FILE, 'utf8');
    const connections = JSON.parse(data);
    
    // Validation and upgrade path for connections
    const now = Date.now();
    for (const [requesterTopic, connection] of Object.entries(connections)) {
      // Add any missing fields with defaults
      if (!connection.state) {
        connection.state = CONNECTION_STATES.ESTABLISHED;
        connection.stateUpdatedAt = now;
      }
      if (!connection.lastActivity) {
        connection.lastActivity = connection.timestamp || now;
      }
      if (!connection.messageCount) {
        connection.messageCount = 0;
      }
    }
    
    console.log(`Loaded ${Object.keys(connections).length} existing connections`);
    return connections;
  } catch (error) {
    console.error('Error loading connections:', error);
    return {};
  }
}

/**
 * Save connections to file
 */
function saveConnections() {
  try {
    fs.writeFileSync(CONNECTIONS_FILE, JSON.stringify(connections, null, 2));
  } catch (error) {
    console.error('Error saving connections:', error);
  }
}

// Handle graceful shutdown
process.on('SIGINT', () => {
  console.log('🛑 Shutting down agent...');
  process.exit(0);
}); 