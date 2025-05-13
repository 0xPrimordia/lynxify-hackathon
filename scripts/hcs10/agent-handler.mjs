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
    this.messageCount = 0;
    this.lastActivityTime = Date.now();
    this.rateLimiter = {
      getLastRequestTime: () => 0,
      limitReached: () => false,
      trackRequest: () => {}
    };
    this.lastQueryTime = new Map();
    this.lastSequence = {};
  }

  /**
   * Initialize with proper ConnectionsManager setup to prevent duplicate connections
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

      // Validate private key before creating client
      if (!this.agentKey || typeof this.agentKey !== 'string') {
        throw new Error('Invalid operator key. Check your OPERATOR_KEY environment variable.');
      }
      
      // Validate and format the private key
      if (!this.agentKey) {
        throw new Error('Missing operator key');
      }

      const hexKey = this.agentKey.trim().toLowerCase();
      console.log(`🔑 Validating key format (length=${hexKey.length})`);

      // Check if it's a valid hex string of 64 characters
      if (!/^[0-9a-f]{64}$/i.test(hexKey)) {
        throw new Error(`Invalid private key format - expected 64 hex characters, got ${hexKey.length}`);
      }

      // Use raw hex key for HCS10Client - it will handle DER conversion internally
      const formattedKey = hexKey;

      try {
        // Create HCS10 client with proper configuration
        console.log('🔄 Creating HCS10 client...');
        
        const clientConfig = {
          network: 'testnet', // Always use testnet for consistency
          operatorId: this.agentId,
          operatorPrivateKey: formattedKey, // Changed from operatorKey to operatorPrivateKey
          logLevel: 'debug'
        };

        console.log('🔍 Client configuration:', {
          network: clientConfig.network,
          operatorId: clientConfig.operatorId,
          logLevel: clientConfig.logLevel
        });

        this.client = new HCS10Client(clientConfig);
        console.log('✅ HCS10 client initialized');

        // Initialize ConnectionsManager with proper configuration
        console.log('🔄 Initializing ConnectionsManager...');
        this.connectionsManager = new ConnectionsManager({
          baseClient: this.client,
          logLevel: 'info',
          prettyPrint: true,
          agentId: this.agentId,
          inboundTopicId: this.inboundTopicId,
          outboundTopicId: this.outboundTopicId
        });
        
        // Load existing connections
        await this.connectionsManager.fetchConnectionData(this.agentId);
        console.log('✅ ConnectionsManager initialized');
        
        // Mark initialization as complete
        this.initialized = true;
        console.log('✅ Agent initialization complete!');
        
        // Now that we're initialized, start monitoring
        await this.startMonitoring();
        
        // Success!
        console.log('✅ Agent handler fully operational and monitoring for messages...');
        return true;

      } catch (clientError) {
        console.error('❌ Error initializing HCS10 client:', clientError);
        throw clientError;
      }

    } catch (error) {
      console.error('❌ Error initializing agent handler:', error);
      this.emit('error', error);
      return false;
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
      
      // Simple monitoring at regular intervals - standard implementation
      const MONITOR_INTERVAL = 10000; // 10 seconds - standard from examples
      const CLEANUP_INTERVAL = 300000; // 5 minutes - standard from examples
      
      let lastCleanupTime = Date.now();

      this.monitorInterval = setInterval(async () => {
        try {
          // Check for messages on inbound topic
          const { messages } = await this.client.getMessageStream(this.inboundTopicId);
          
          if (messages && messages.length > 0) {
            console.log(`📬 Found ${messages.length} messages on inbound topic`);
            
            // Process messages through ConnectionsManager 
            await this.connectionsManager.processInboundMessages(messages);
            
            // Process any connections that need confirmation
            await this.processConnectionRequests();
            
            // Process standard messages
            for (const message of messages) {
              if (message.op === 'message' && !message.operator_id?.includes(this.agentId)) {
                try {
                  await this.processApplicationMessage(message);
                } catch (error) {
                  console.error('❌ Error processing application message:', error);
                }
              }
            }
          }
          
          // Check established connections for messages
          const connections = this.connectionsManager.getAllConnections() || [];
          const establishedConnections = connections.filter(conn => conn.status === 'established');
          
          for (const connection of establishedConnections) {
            if (!connection.connectionTopicId) continue;
            
            try {
              const { messages } = await this.client.getMessageStream(connection.connectionTopicId);
              
              if (messages && messages.length > 0) {
                // Process connection messages
                await this.connectionsManager.processInboundMessages(messages);
                
                // Process standard messages on the connection topic
                for (const message of messages) {
                  if (message.op === 'message' && !message.operator_id?.includes(this.agentId)) {
                    await this.processApplicationMessage(message);
                  }
                }
              }
            } catch (connError) {
              console.error(`❌ Error checking connection topic ${connection.connectionTopicId}:`, connError);
            }
          }
          
          // Cleanup stale connections every 5 minutes
          const now = Date.now();
          if (now - lastCleanupTime >= CLEANUP_INTERVAL) {
            await this.cleanupStaleConnections();
            lastCleanupTime = now;
          }

        } catch (error) {
          if (error.response?.status === 429) {
            // If we hit rate limit, log it but continue
            console.warn('⚠️ Rate limit hit, waiting for next interval...');
          } else {
            console.error('❌ Error in monitoring loop:', error);
          }
        }
      }, MONITOR_INTERVAL);

      this.monitoring = true;
      console.log(`✅ Started monitoring with ${MONITOR_INTERVAL}ms interval`);
      return true;

    } catch (error) {
      console.error('❌ Error starting monitoring:', error);
      this.emit('error', error);
      return false;
    }
  }

  /**
   * Check inbound topic for new messages
   */
  async checkInboundTopic() {
    try {
      // Track last sequence by topic
      if (!this.lastSequence) {
        this.lastSequence = {};
      }
      
      await this.rateLimiter.waitForNextRequest(this.inboundTopicId);
      const messages = await this.client.getMessageStream(this.inboundTopicId);

      if (messages && messages.length > 0) {
        console.log(`📬 Found ${messages.length} messages on inbound topic`);
        this.rateLimiter.handleSuccess(this.inboundTopicId);
        
        // Sort messages by sequence_number to ensure proper order
        const sortedMessages = [...messages].sort((a, b) => 
          (a.sequence_number || 0) - (b.sequence_number || 0)
        );
        
        // Filter out already processed messages
        const newMessages = sortedMessages.filter(message => {
          const sequenceNumber = message.sequence_number || 0;
          const lastSequence = this.lastSequence[this.inboundTopicId] || 0;
          return sequenceNumber > lastSequence;
        });
        
        if (newMessages.length > 0) {
          console.log(`📨 Processing ${newMessages.length} new messages`);
          
          // Process messages through ConnectionsManager first
          await this.connectionsManager.processInboundMessages(newMessages);
          
          // Process connection requests
          await this.processConnectionRequests();
          
          // Process standard messages after connection handling
          for (const message of newMessages) {
            if (this.isStandardMessage(message)) {
              await this.processApplicationMessage(message);
            }
            
            // Update the last sequence number
            if (message.sequence_number) {
              this.lastSequence[this.inboundTopicId] = Math.max(
                this.lastSequence[this.inboundTopicId] || 0,
                message.sequence_number
              );
            }
          }
          
          this.messageCount += newMessages.length;
        }
      }

      this.lastActivityTime = Date.now();

    } catch (error) {
      if (error.response?.status === 429) {
        console.warn('⚠️ Rate limit hit, backing off...');
        this.rateLimiter.handle429Error(this.inboundTopicId);
      } else {
        console.error('❌ Error checking inbound topic:', error);
      }
    }
  }

  /**
   * Process a single message with rate limiting
   */
  async processMessage(message) {
    try {
      const messageId = message.id || message.transactionId;
      if (!messageId) return;

      // Check cache first to avoid duplicate processing
      const cached = this.rateLimiter.getCachedMessage(messageId);
      if (cached) {
        console.log(`⏭️ Skipping already processed message: ${messageId}`);
        return;
      }

      // Handle connection messages via ConnectionsManager
      try {
        await this.connectionsManager.processInboundMessages([message]);
      } catch (connError) {
        console.error('❌ Error processing message through ConnectionsManager:', connError);
      }
      
      // Process standard messages for established connections
      try {
        if (this.isStandardMessage(message)) {
          console.log(`📨 Processing standard message: ${messageId}`);
          await this.processApplicationMessage(message);
        }
      } catch (appError) {
        console.error('❌ Error processing application message:', appError);
      }
      
      // Process any pending connection requests that resulted from this message
      try {
        await this.processConnectionRequests();
      } catch (reqError) {
        console.error('❌ Error processing connection requests:', reqError);
      }
      
      // Cache the processed message to avoid duplicates
      this.rateLimiter.cacheMessage(messageId, message);
    } catch (error) {
      if (error.response?.status === 429) {
        console.warn('⚠️ Rate limit hit while processing message, backing off...');
        await new Promise(resolve => setTimeout(resolve, 5000));
      } else {
        console.error('❌ Error processing message:', error);
      }
    }
  }

  /**
   * Process non-connection application messages
   */
  async processApplicationMessage(message) {
    try {
      if (!this.isStandardMessage(message)) {
        return;
      }
      
      // Determine the response topic ID
      const responseTopicId = message.connection_topic_id;
      if (!responseTopicId) {
        console.error('❌ Missing topic ID for response');
        return;
      }
      
      console.log(`📩 Received message on topic ${responseTopicId}`);
      
      // Extract message text from various formats
      let messageText = '';
      
      if (message.text) {
        messageText = message.text;
      } else if (message.data) {
        if (typeof message.data === 'string') {
          try {
            // Try to parse as JSON
            const jsonData = JSON.parse(message.data);
            messageText = jsonData.text || jsonData.message || jsonData.content || JSON.stringify(jsonData);
          } catch (e) {
            // Not JSON, use as is
            messageText = message.data;
          }
        } else {
          messageText = JSON.stringify(message.data);
        }
      }
      
      console.log(`📝 Message text: "${messageText}"`);
      
      // Create a simple response
      let responseText = `I received your message: "${messageText}"`;
      
      // Some simple response generation based on content
      if (messageText.toLowerCase().includes('hello') || messageText.toLowerCase().includes('hi')) {
        responseText = "Hello! I'm the Lynxify HCS-10 Agent. How can I help you today?";
      } else if (messageText.toLowerCase().includes('help')) {
        responseText = "I'm here to help! You can ask me about Lynxify, the tokenized index, or anything else you'd like to know.";
      } else if (messageText.toLowerCase().includes('test')) {
        responseText = "Test message received successfully! I'm working properly and can receive and respond to your messages.";
      }
      
      // Format the response as HCS-10 message
      const responseMessage = {
        p: 'hcs-10',
        op: 'message',
        text: responseText,
        timestamp: new Date().toISOString()
      };
      
      // Send the response
      console.log(`📤 Sending response to topic ${responseTopicId}: "${responseText}"`);
      await this.client.sendMessage(responseTopicId, JSON.stringify(responseMessage));
      console.log('✅ Response sent successfully');
      
      // Update last activity time
      this.lastActivityTime = Date.now();
    } catch (error) {
      console.error('❌ Error processing application message:', error);
    }
  }

  /**
   * Send a welcome message to newly connected agents
   */
  async sendWelcomeMessage(connection) {
    try {
      if (!connection.connectionTopicId) {
        console.error('❌ Missing connection topic ID for welcome message');
        return;
      }

      // Make sure welcome message follows HCS-10 format
      const welcomeMessage = {
        p: 'hcs-10',
        op: 'message',
        text: 'Welcome to Lynxify HCS-10 Agent! I am now online and ready to respond to your messages.',
        timestamp: new Date().toISOString()
      };

      await this.client.sendMessage(
        connection.connectionTopicId,
        JSON.stringify(welcomeMessage)
      );
      console.log(`✅ Sent welcome message to ${connection.targetAccountId || 'connected agent'}`);

    } catch (error) {
      console.error('❌ Error sending welcome message:', error);
    }
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
    
    // Initialize the handler
    console.log('🔧 Initializing with:', {
      agentId: process.env.NEXT_PUBLIC_HCS_AGENT_ID,
      inboundTopic: process.env.NEXT_PUBLIC_HCS_INBOUND_TOPIC,
      outboundTopic: process.env.NEXT_PUBLIC_HCS_OUTBOUND_TOPIC
    });
    
    const success = await handler.initialize(
      process.env.OPERATOR_KEY,
      process.env.NEXT_PUBLIC_HCS_AGENT_ID,
      process.env.NEXT_PUBLIC_HCS_INBOUND_TOPIC,
      process.env.NEXT_PUBLIC_HCS_OUTBOUND_TOPIC
    );
    
    if (!success) {
      throw new Error('Failed to initialize agent handler');
    }
    
    // Start monitoring for messages
    await handler.startMonitoring();
    
    console.log('✅ HCS10 agent started and monitoring for messages');
    
    // Keep the process running indefinitely by creating a never-resolved promise
    // This is the key part that was missing - the process was exiting after initialization
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