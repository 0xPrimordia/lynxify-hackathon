import { HCS10Client, ConnectionsManager } from '@hashgraphonline/standards-sdk';
import fs from 'fs/promises';
import dotenv from 'dotenv';
import path from 'path';
import { EventEmitter } from 'events';
import http from 'http';
import { fileURLToPath } from 'url';
import 'dotenv/config';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Initialize environment first
(() => {
  const envPath = path.resolve(__dirname, '../../.env.local');
  try {
    const envResult = dotenv.config({ path: envPath });
    if (envResult.error) {
      throw envResult.error;
    }
    console.log('✅ Loaded environment from:', envPath);
  } catch (error) {
    console.error('❌ Error loading .env.local:', error);
    process.exit(1);
  }
})();

// Configuration constants
const PORT = parseInt(process.env.PORT || '3000', 10);
const PENDING_CONNECTIONS_FILE = path.join(process.cwd(), '.pending_connections.json');
const APPROVAL_COMMAND_FILE = path.join(process.cwd(), '.approval_commands.json');
const AGENT_STATUS_FILE = path.join(process.cwd(), '.agent_status.json');
const AUTO_APPROVED_ACCOUNTS = [process.env.NEXT_PUBLIC_OPERATOR_ID];
const ENABLE_APPROVAL_API = process.env.ENABLE_CONNECTION_APPROVAL_API === 'true';

// Environment validation function
const validateEnvironment = () => {
  console.log('Validating environment variables...');
  
  const required = [
    'OPERATOR_KEY',
    'NEXT_PUBLIC_OPERATOR_ID',
    'NEXT_PUBLIC_HCS_AGENT_ID',
    'NEXT_PUBLIC_HCS_INBOUND_TOPIC',
    'NEXT_PUBLIC_HCS_OUTBOUND_TOPIC',
    'NEXT_PUBLIC_NETWORK'
  ];

  const missing = required.filter(key => !process.env[key]);
  
  if (missing.length > 0) {
    throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
  }

  console.log('Environment variables present:', {
    agentId: process.env.NEXT_PUBLIC_HCS_AGENT_ID,
    network: process.env.NEXT_PUBLIC_NETWORK,
    operatorId: process.env.NEXT_PUBLIC_OPERATOR_ID,
    inboundTopic: process.env.NEXT_PUBLIC_HCS_INBOUND_TOPIC,
    outboundTopic: process.env.NEXT_PUBLIC_HCS_OUTBOUND_TOPIC
  });
};

// Create HTTP server for Render
const server = http.createServer((req, res) => {
  if (req.url === '/health' || req.url === '/' || req.url === '/api/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ 
      status: 'ok', 
      agent: 'hcs10-agent', 
      timestamp: new Date().toISOString(),
      environment: process.env.NODE_ENV || 'development'
    }));
    return;
  }
  res.writeHead(404, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ error: 'Not found' }));
});

// Bind server to specific port and interface
server.listen(PORT, '0.0.0.0', () => {
  console.log(`✅ HTTP server running at http://0.0.0.0:${PORT}`);
});

/**
 * HCS10 Agent Handler - Manages agent connections and messages
 */
export class HCS10AgentHandler extends EventEmitter {
  constructor() {
    super();
    this.client = null;
    this.inboundTopicId = null;
    this.outboundTopicId = null;
    this.agentId = null;
    this.agentKey = null;
    this.connections = new Map();
    this.connectionsManager = null;
    this.initialized = false;
    this.monitoring = false;
    this.monitorInterval = null;
    this.cleanupInterval = null;
    this.messageCount = 0;
    this.lastActivityTime = Date.now();
    this.processedMessages = new Map(); // Map of messageKeys to prevent duplicate processing
    this.connectionQueue = [];
    this.processingQueue = false;
    this.topicSequence = {}; // Track sequence numbers by topic
    this.network = process.env.NEXT_PUBLIC_NETWORK || 'testnet';
    this.rateLimiter = {
      getLastRequestTime: () => 0,
      limitReached: () => false,
      trackRequest: () => {}
    };
    this.lastQueryTime = new Map();
    this.lastSequence = {};
    this.processingConnections = false;
  }

  /**
   * Initialize with proper ConnectionsManager setup
   */
  async initialize(agentKey, agentId, inboundTopicId, outboundTopicId) {
    try {
      console.log(`🔄 Initializing agent handler with: ${agentId}, ${inboundTopicId}, ${outboundTopicId}`);
      
      // Validate required parameters
      if (!agentKey || !agentId || !inboundTopicId || !outboundTopicId) {
        throw new Error('Missing required initialization parameters');
      }

      this.agentId = agentId;
      this.inboundTopicId = inboundTopicId;
      this.outboundTopicId = outboundTopicId;
      
      // Validate and normalize private key
      this.agentKey = agentKey.trim();
      if (!this.agentKey || typeof this.agentKey !== 'string') {
        throw new Error('Invalid operator key format');
      }

      // Validate private key format
      const hexKey = this.agentKey.trim().toLowerCase();
      console.log(`🔑 Validating key format (length=${hexKey.length})`);

      // Check if it's a valid hex string of 64 characters
      if (!/^[0-9a-f]{64}$/i.test(hexKey)) {
        throw new Error(`Invalid private key format - expected 64 hex characters, got ${hexKey.length}`);
      }

      // Create HCS10 client with proper configuration - matching reference implementation
      this.client = new HCS10Client({
        network: this.network,
        operatorId: this.agentId,
        operatorPrivateKey: hexKey,
        logLevel: 'debug'
      });
      
      console.log('✅ HCS10 client initialized');
      
      // Initialize processed messages map
      this.processedMessages = new Map();
      this.topicSequence = {};
      
      // DEBUG: Log client properties to see what's available
      console.log('Client properties:', Object.keys(this.client));
      
      // TRY DIFFERENT APPROACH: Use baseClient parameter directly without standardClient
      console.log('🔄 Initializing ConnectionsManager...');
      this.connectionsManager = new ConnectionsManager({
        baseClient: this.client, // Try using client directly
        logLevel: 'info',
        prettyPrint: true
      });
      
      // Set agent info on the connections manager
      await this.connectionsManager.setAgentInfo({
        accountId: this.agentId,
        inboundTopicId: this.inboundTopicId,
        outboundTopicId: this.outboundTopicId
      });
      
      // Load existing connections
      await this.getConnections();
      console.log('✅ ConnectionsManager initialized');
      
      // Mark initialization as complete
      this.initialized = true;
      console.log('✅ Agent initialization complete!');
      
      // Now that we're initialized, start monitoring
      await this.startMonitoring();
      
      // Success!
      console.log('✅ Agent handler fully operational and monitoring for messages...');
      return true;
    } catch (error) {
      console.error('❌ Error initializing agent handler:', error);
      this.emit('error', error);
      return false;
    }
  }

  /**
   * Get all established connections
   */
  async getConnections() {
    try {
      const connections = await this.connectionsManager.fetchConnectionData(this.agentId);
      if (!connections) {
        console.log('No connections found');
        return [];
      }
      
      // Filter out invalid connections
      const validConnections = connections.filter(conn => {
        if (!conn.connectionTopicId) {
          return false;
        }
        
        // Check if it's in valid format (0.0.NUMBER)
        if (!conn.connectionTopicId.match(/^[0-9]+\.[0-9]+\.[0-9]+$/)) {
          return false;
        }
        
        return true;
      });
      
      console.log(`Found ${validConnections.length} valid connections out of ${connections.length} total`);
      return validConnections;
    } catch (error) {
      console.error('❌ Error fetching connections:', error.message);
      return [];
    }
  }
  
  /**
   * Process pending connection requests
   */
  async processPendingConnectionRequests() {
    try {
      const pendingRequests = await this.connectionsManager.getPendingRequests();
      if (!pendingRequests || pendingRequests.length === 0) {
        return;
      }
      
      console.log(`Found ${pendingRequests.length} pending connection requests`);
      
      // Auto-approve all pending requests
      for (const request of pendingRequests) {
        try {
          await this.connectionsManager.acceptConnectionRequest({
            requestId: request.id,
            memo: 'Connection accepted by Lynxify Agent'
          });
          
          console.log(`✅ Approved connection request from ${request.targetAccountId || 'unknown'}`);
        } catch (error) {
          console.error(`❌ Error approving connection request:`, error.message);
        }
      }
    } catch (error) {
      console.error('❌ Error processing pending connection requests:', error.message);
    }
  }

  /**
   * Start monitoring for messages and connections
   */
  async startMonitoring() {
    if (!this.initialized) {
      throw new Error('Agent handler not initialized');
    }

    try {
      if (this.monitoring) {
        console.log('⚠️ Already monitoring');
        return true;
      }

      console.log('🔄 Starting monitoring...');
      
      // Simple monitoring at regular intervals
      const MONITOR_INTERVAL = 15000; // 15 seconds
      const CLEANUP_INTERVAL = 300000; // 5 minutes
      const CONNECTION_CHECK_DELAY = 1000; // 1 second minimum delay between connection checks
      
      // Connection processing queue
      this.connectionQueue = [];
      this.processingQueue = false;
      this.lastProcessedTime = Date.now();
      
      // Start monitoring
      this.monitorInterval = setInterval(async () => {
        try {
          // Process inbound topic messages for connection requests
          await this.checkInboundMessages();
          
          // If we're not already processing, load connections and start
          if (!this.processingQueue) {
            // Get connections but limit to a small subset to avoid overwhelming the Mirror Node
            const allConnections = await this.getConnections();
            
            // Only process up to 10 connections per interval
            // This prevents overwhelming the system with too many connections
            if (allConnections && allConnections.length > 0) {
              // Select a very small batch to process each cycle
              const connectionBatch = allConnections.slice(0, 10);
              
              // Update the connection queue
              console.log(`Queueing ${connectionBatch.length} connections out of ${allConnections.length} total`);
              this.connectionQueue = [...connectionBatch];
              
              // Start processing the queue if not already processing
              if (!this.processingQueue) {
                console.log(`Starting to process ${this.connectionQueue.length} connections`);
                this.processConnectionQueue();
              }
            }
          } else {
            console.log('Already processing connections, skipping new batch');
          }
        } catch (error) {
          console.error('❌ Error in monitor interval:', error.message);
        }
      }, MONITOR_INTERVAL);
      
      // Cleanup at regular intervals
      this.cleanupInterval = setInterval(async () => {
        try {
          await this.cleanupConnections();
        } catch (error) {
          console.error('❌ Error in cleanup interval:', error.message);
        }
      }, CLEANUP_INTERVAL);
      
      this.monitoring = true;
      console.log('✅ Monitoring started');
      return true;
    } catch (error) {
      console.error('❌ Error starting monitoring:', error.message);
      return false;
    }
  }
  
  /**
   * Process connection queue one by one with rate limiting and backoff
   */
  async processConnectionQueue() {
    // If queue is empty, mark as not processing and exit
    if (this.connectionQueue.length === 0) {
      this.processingQueue = false;
      console.log('🔄 Connection queue processing complete');
      return;
    }
    
    this.processingQueue = true;
    
    try {
      // Process one connection at a time
      const connection = this.connectionQueue.shift();
      const connectionTopicId = connection.connectionTopicId;
      
      // Check if it's a valid connection topic
      if (connectionTopicId && !connectionTopicId.startsWith('inb-')) {
        // Process this connection with retry
        const timeSinceLastProcessed = Date.now() - this.lastProcessedTime;
        const requiredDelay = Math.max(0, 1000 - timeSinceLastProcessed);
        
        // Add a delay to ensure rate limiting
        if (requiredDelay > 0) {
          await new Promise(resolve => setTimeout(resolve, requiredDelay));
        }
        
        // Process the connection with retry logic
        let retryCount = 0;
        let success = false;
        
        while (!success && retryCount < 3) {
          try {
            console.log(`🔎 Processing connection topic: ${connectionTopicId} (attempt ${retryCount + 1})`);
            success = await this.checkConnectionMessages(connectionTopicId);
            this.lastProcessedTime = Date.now();
          } catch (error) {
            retryCount++;
            if (error.message.includes('429')) {
              // For rate limiting, add exponential backoff
              const backoffDelay = Math.pow(2, retryCount) * 1000;
              console.log(`⚠️ Rate limited. Backing off for ${backoffDelay}ms before retry`);
              await new Promise(resolve => setTimeout(resolve, backoffDelay));
            } else {
              console.error(`❌ Error processing connection ${connectionTopicId}:`, error.message);
              // For other errors, shorter delay
              await new Promise(resolve => setTimeout(resolve, 500));
            }
          }
        }
      } else {
        console.warn(`⚠️ Skipping invalid connection topic ID: ${connectionTopicId}`);
      }
      
      // Add delay between connections to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Continue processing the queue with a delay
      setTimeout(() => this.processConnectionQueue(), 500);
    } catch (error) {
      console.error('❌ Error processing connection queue:', error.message);
      // Continue processing despite error, but with a longer delay
      setTimeout(() => this.processConnectionQueue(), 2000);
    }
  }
  
  /**
   * Check messages for a specific connection
   * @returns {Promise<boolean>} Success status
   */
  async checkConnectionMessages(connectionTopicId) {
    try {
      const messages = await this.client.getMessages(connectionTopicId);
      
      if (messages && messages.length > 0) {
        console.log(`📬 Found ${messages.length} messages on connection topic ${connectionTopicId}`);
        
        // Process each message sequentially
        for (const message of messages) {
          // Add sequence tracking to avoid duplicates
          const messageKey = `${connectionTopicId}-${this.getMessageSequence(message)}`;
          if (this.processedMessages.has(messageKey)) {
            console.log(`🔄 Skipping duplicate message: ${messageKey}`);
            continue;
          }
          
          // Process the message
          await this.processApplicationMessage(message);
          
          // Mark as processed
          this.processedMessages.set(messageKey, true);
        }
      }
      return true;
    } catch (error) {
      if (error.message.includes('429')) {
        console.log(`⚠️ Rate limited for topic ${connectionTopicId}, will retry later`);
      } else {
        console.error(`❌ Error checking messages for connection ${connectionTopicId}:`, error.message);
      }
      throw error; // Rethrow to allow retry logic
    }
  }

  /**
   * Get sequence number from message
   */
  getMessageSequence(message) {
    // Use incrementing sequence for messages without sequence
    if (!message.sequence) {
      const topicId = message.connection_topic_id || message.origin_topic_id;
      if (!this.topicSequence[topicId]) {
        this.topicSequence[topicId] = 1;
      }
      return this.topicSequence[topicId]++;
    }
    return message.sequence;
  }

  /**
   * Create client with proper configuration to avoid signature errors
   */
  async createClient() {
    try {
      // Ensure environment has the correct operatorKey
      if (!process.env.OPERATOR_KEY) {
        throw new Error('Missing OPERATOR_KEY in environment');
      }
      
      console.log('🔄 Creating HCS10 client...');
      const client = new HCS10Client({
        network: this.network,
        operatorId: this.agentId, // Use agentId (not operatorId) for sending messages
        operatorKey: process.env.OPERATOR_KEY,
        logLevel: 'debug'
      });
      
      return client;
    } catch (error) {
      console.error('❌ Error creating client:', error.message);
      throw error;
    }
  }

  /**
   * Check inbound messages without causing rate limiting
   */
  async checkInboundMessages() {
    try {
      console.log('🔍 Checking inbound topic for messages...');
      const messages = await this.client.getMessages(this.inboundTopicId);
      
      if (messages && messages.length > 0) {
        console.log(`📬 Found ${messages.length} messages on inbound topic`);
        
        // Process the messages through ConnectionsManager
        await this.connectionsManager.processInboundMessages(messages);
        
        // Handle pending connection requests
        await this.processPendingConnectionRequests();
      }
    } catch (error) {
      console.error('❌ Error checking inbound messages:', error.message);
    }
  }

  /**
   * Send response with better error handling and retry logic
   */
  async sendResponse(topicId, responseText) {
    if (!topicId) {
      console.error('❌ No topic ID for response');
      return;
    }
    
    try {
      console.log(`🔄 Sending response to topic ${topicId}`);
      
      // Format the response message
      const responseMessage = {
        p: 'hcs-10',
        op: 'message',
        text: responseText,
        timestamp: new Date().toISOString()
      };
      
      // Send the message with retries
      let retries = 3;
      while (retries > 0) {
        try {
          await this.client.sendMessage(topicId, JSON.stringify(responseMessage));
          console.log('✅ Response sent successfully');
          return;
        } catch (error) {
          retries--;
          if (retries === 0) {
            throw error;
          }
          // Wait before retry
          console.log(`⚠️ Retrying message send (${retries} attempts left): ${error.message}`);
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      }
    } catch (error) {
      console.error('❌ Error sending response:', error);
      
      // For INVALID_SIGNATURE errors, log more details about the key being used
      if (error.toString().includes('INVALID_SIGNATURE')) {
        console.error(`❌ INVALID_SIGNATURE error. Check if correct key is being used for topic ${topicId}`);
      }
      
      // Try to use alternative topics
      if (this.outboundTopicId && this.outboundTopicId !== topicId) {
        console.log(`📝 Using fallback topic ID for response: ${this.outboundTopicId}`);
        try {
          const responseMessage = {
            p: 'hcs-10',
            op: 'message',
            text: responseText,
            timestamp: new Date().toISOString()
          };
          await this.client.sendMessage(this.outboundTopicId, JSON.stringify(responseMessage));
        } catch (fallbackError) {
          console.error('❌ Even fallback response failed:', fallbackError.message);
        }
      }
    }
  }

  /**
   * Process non-connection application messages
   */
  async processApplicationMessage(message) {
    try {
      // Extract message content from various formats
      let content = this.extractMessageContent(message);
      if (!content) {
        console.warn('⚠️ No content found in message');
        return;
      }

      // Get topic ID for response
      let responseTopicId = message.connection_topic_id;
      
      // Add fallback logic for determining response topic
      if (!responseTopicId) {
        // Try to extract from origin_topic_id
        responseTopicId = message.origin_topic_id;
        
        // If still no topic, try sender's topic from operator_id
        if (!responseTopicId && message.operator_id) {
          const parts = message.operator_id.split('@');
          if (parts.length >= 1) {
            responseTopicId = parts[0];  // First part is usually the topic ID
          }
        }
        
        // If outbound topic is configured, use as last resort
        if (!responseTopicId && this.outboundTopicId) {
          responseTopicId = this.outboundTopicId;
          console.warn(`⚠️ Using agent's outbound topic as fallback: ${responseTopicId}`);
        }
        
        // If we found a fallback, log it
        if (responseTopicId) {
          console.log(`📝 Using fallback topic ID for response: ${responseTopicId}`);
        } else {
          console.error('❌ Missing topic ID for response and no fallback available');
          return;
        }
      }

      console.log(`📨 Processing message from ${message.operator_id || 'unknown'}: ${content}`);

      // Skip duplicate messages
      const messageSequence = this.getMessageSequence(message);
      if (messageSequence) {
        const topicId = message.topic_id || responseTopicId;
        const key = `${topicId}-${messageSequence}`;
        
        if (this.processedMessages.has(key)) {
          console.log(`🔄 Skipping duplicate message: ${key}`);
          return;
        }
        
        // Mark message as processed
        this.processedMessages.set(key, true);
      }

      // Generate response and send it
      const responseText = await this.generateResponse(content);
      if (responseText) {
        await this.sendResponse(responseTopicId, responseText);
      }
    } catch (error) {
      console.error('❌ Error processing application message:', error);
    }
  }

  /**
   * Extracts message content from various formats
   * @param {Object} message - The message object
   * @returns {string|null} - The extracted content or null if none found
   */
  extractMessageContent(message) {
    // Handle direct text content
    if (message.content) {
      return message.content;
    }
    
    // Handle nested content object
    if (message.message?.content) {
      return message.message.content;
    }
    
    // Handle data object with content
    if (message.data?.content) {
      return message.data.content;
    }
    
    // Handle data object with message
    if (message.data?.message) {
      return typeof message.data.message === 'string' 
        ? message.data.message 
        : JSON.stringify(message.data.message);
    }
    
    // Handle data as string
    if (message.data && typeof message.data === 'string') {
      return message.data;
    }
    
    // Handle payload object
    if (message.payload) {
      if (typeof message.payload === 'string') {
        return message.payload;
      } else if (message.payload.content) {
        return message.payload.content;
      } else if (message.payload.message) {
        return typeof message.payload.message === 'string'
          ? message.payload.message
          : JSON.stringify(message.payload.message);
      }
    }
    
    // Last resort: stringify entire message
    try {
      return JSON.stringify(message);
    } catch (e) {
      console.error('Failed to stringify message:', e);
      return null;
    }
  }
  
  /**
   * Generates a response based on message content
   * @param {string} content - The message content
   * @returns {Promise<string>} - The generated response
   */
  async generateResponse(content) {
    console.log(`🤖 Generating response for: "${content}"`);
    
    // Simple response generation based on content
    if (content.toLowerCase().includes('hello') || content.toLowerCase().includes('hi')) {
      return "Hello! I'm the Lynxify HCS-10 Agent. How can I help you today?";
    } else if (content.toLowerCase().includes('help')) {
      return "I'm here to help! You can ask me about Lynxify, the tokenized index, or anything else you'd like to know.";
    } else if (content.toLowerCase().includes('test')) {
      return "Test message received successfully! I'm working properly and can receive and respond to your messages.";
    }
    
    // Default response
    return `I received your message: "${content}"`;
  }

  /**
   * Stop monitoring and cleanup any intervals
   */
  stopMonitoring() {
    if (this.monitorInterval) {
      clearInterval(this.monitorInterval);
      this.monitorInterval = null;
    }
    
    if (this.connectionRefreshInterval) {
      clearInterval(this.connectionRefreshInterval);
      this.connectionRefreshInterval = null;
    }
    
    // Clear rate limiter cache
    this.rateLimiter.clearOldCache();
    
    this.monitoring = false;
    this.emit('monitoring_stopped');
    console.log('🛑 Stopped monitoring inbound topic');
  }

  /**
   * Check if a message is a standard application message (not connection-related)
   */
  isStandardMessage(message) {
    try {
      // Check if this is a message operation with the standard protocol
      if (message.op !== 'message' || message.p !== 'hcs-10') {
        return false;
      }
      
      // Don't process our own messages
      if (message.operator_id && message.operator_id.includes(this.agentId)) {
        return false;
      }
      
      return true;
    } catch (error) {
      console.error('Error checking if message is standard:', error);
      return false;
    }
  }

  /**
   * Process connection requests that need confirmation
   */
  async processConnectionRequests() {
    try {
      // Get pending requests that need confirmation
      const pendingRequests = this.connectionsManager.getPendingRequests() || [];
      
      if (pendingRequests.length === 0) {
        return;
      }
      
      console.log(`📝 Processing ${pendingRequests.length} connection requests that need confirmation`);
      
      for (const pendingRequest of pendingRequests) {
        try {
          const accountId = pendingRequest.accountId || pendingRequest.targetAccountId;
          console.log(`🔄 Auto-approving connection request from: ${accountId}`);
          
          // Accept the connection request using the correct API
          const connectionTopicId = await this.connectionsManager.acceptConnectionRequest({
            requestId: pendingRequest.id,
            memo: 'Connection accepted by Lynxify Agent'
          });
          
          console.log(`✅ Connection accepted for: ${accountId} on topic ${connectionTopicId}`);
          
          // Send welcome message
          await this.sendWelcomeMessage({ 
            connectionTopicId,
            targetAccountId: accountId 
          });
        } catch (error) {
          console.error(`❌ Error processing connection request from ${pendingRequest.accountId || pendingRequest.targetAccountId}:`, error);
        }
      }
    } catch (error) {
      console.error('❌ Error processing connection requests:', error);
    }
  }

  /**
   * Clean up stale connections
   */
  async cleanupStaleConnections() {
    try {
      console.log('🧹 Cleaning up stale connections...');
      
      // Get all connections
      const connections = this.connectionsManager.getAllConnections() || [];
      
      // Get the current time
      const now = Date.now();
      
      // Define max age for different connection types (in milliseconds)
      const MAX_PENDING_AGE = 24 * 60 * 60 * 1000; // 24 hours for pending connections
      const MAX_ESTABLISHED_AGE = 7 * 24 * 60 * 60 * 1000; // 7 days for established connections
      let staleCount = 0;

      for (const connection of connections) {
        try {
          // Skip already closed connections
          if (connection.status === 'closed') {
            continue;
          }
          
          const createdTime = connection.created ? new Date(connection.created).getTime() : 0;
          
          // No creation time means we can't determine age, so skip
          if (!createdTime) {
            continue;
          }
          
          const age = now - createdTime;
          
          // Check if the connection is stale based on its status
          let isStale = false;
          
          if (connection.status === 'pending' || connection.status === 'needs_confirmation') {
            isStale = age > MAX_PENDING_AGE;
          } else if (connection.status === 'established') {
            isStale = age > MAX_ESTABLISHED_AGE;
          }
          
          if (isStale) {
            console.log(`🧹 Closing stale connection: ${connection.connectionTopicId} (${connection.status}, age: ${Math.round(age / (1000 * 60 * 60))} hours)`);
            
            // For established connections, send a close message
            if (connection.status === 'established') {
              try {
                const closeMessage = {
                  p: 'hcs-10',
                  op: 'close_connection',
                  reason: 'Connection timeout'
                };
                
                await this.client.sendMessage(
                  connection.connectionTopicId,
                  JSON.stringify(closeMessage)
                );
                
                console.log(`✅ Sent close message to ${connection.connectionTopicId}`);
              } catch (sendError) {
                console.error(`❌ Error sending close message to ${connection.connectionTopicId}:`, sendError);
              }
            }
            
            // Update the connection status in the ConnectionsManager
            connection.status = 'closed';
            this.connectionsManager.updateOrAddConnection(connection);
            staleCount++;
          }
        } catch (connError) {
          console.error(`❌ Error cleaning up connection ${connection.connectionTopicId}:`, connError);
        }
      }
      
      console.log(`✅ Connection cleanup complete: ${staleCount} stale connections closed`);
    } catch (error) {
      console.error('❌ Error cleaning up stale connections:', error);
    }
  }
}

/**
 * Main function for running the agent
 */
async function main() {
  try {
    // Validate environment variables first
    validateEnvironment();
    
    console.log('🚀 Starting HCS10 agent...');
    
    // Create handler
    const handler = new HCS10AgentHandler();
    
    // Add error handler
    handler.on('error', (error) => {
      console.error('❌ Agent handler error:', error);
    });
    
    // Initialize the handler with proper key format
    console.log('🔧 Initializing with:', {
      agentId: process.env.NEXT_PUBLIC_HCS_AGENT_ID,
      inboundTopic: process.env.NEXT_PUBLIC_HCS_INBOUND_TOPIC,
      outboundTopic: process.env.NEXT_PUBLIC_HCS_OUTBOUND_TOPIC
    });
    
    // Get private key from environment and ensure it's in correct format
    const privateKey = process.env.OPERATOR_KEY;
    if (!privateKey) {
      throw new Error('Missing OPERATOR_KEY in environment');
    }
    
    const success = await handler.initialize(
      privateKey,
      process.env.NEXT_PUBLIC_HCS_AGENT_ID,
      process.env.NEXT_PUBLIC_HCS_INBOUND_TOPIC,
      process.env.NEXT_PUBLIC_HCS_OUTBOUND_TOPIC
    );
    
    if (!success) {
      throw new Error('Failed to initialize agent handler');
    }
    
    // Keep the process running indefinitely by creating a never-resolved promise
    await new Promise(() => {
      console.log('🔄 Agent is now running continuously...');
      // This promise never resolves, keeping the process alive
    });
  } catch (error) {
    console.error('❌ Error in agent main function:', error);
    process.exit(1);
  }
}

// Run the main function
main().catch(error => {
  console.error('❌ Fatal error in agent:', error);
  process.exit(1);
});