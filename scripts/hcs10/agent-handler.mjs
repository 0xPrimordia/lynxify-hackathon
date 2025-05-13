import { HCS10Client, ConnectionsManager } from '@hashgraphonline/standards-sdk';
import fs from 'fs/promises';
import dotenv from 'dotenv';
import path from 'path';
import { EventEmitter } from 'events';
import http from 'http';

// Load environment variables
dotenv.config({ path: '.env.local' });

// Create a simple HTTP server to satisfy Render's port detection requirements
const PORT = parseInt(process.env.PORT || '3000', 10);
console.log(`🌐 Creating HTTP server on port ${PORT} bound to 0.0.0.0 for Render`);

// Simple HTTP server for Render port detection
const server = http.createServer((req, res) => {
  // Health check endpoint
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

  // Not found for all other routes
  res.writeHead(404, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ error: 'Not found' }));
});

// Explicitly bind to 0.0.0.0 to make the port visible to Render's port scanner
server.listen(PORT, '0.0.0.0', () => {
  console.log(`✅ HTTP server running at http://0.0.0.0:${PORT}`);
});

// Define whitelist for auto-approved connections (optional)
const AUTO_APPROVED_ACCOUNTS = process.env.AUTO_APPROVED_ACCOUNTS 
  ? process.env.AUTO_APPROVED_ACCOUNTS.split(',') 
  : [];

// Output the whitelist for debugging
console.log('🔍 DEBUG: Auto approved accounts:', AUTO_APPROVED_ACCOUNTS);

// Paths for IPC with wrapper process
const PENDING_CONNECTIONS_FILE = path.join(process.cwd(), '.pending_connections.json');
const APPROVAL_COMMAND_FILE = path.join(process.cwd(), '.approval_commands.json');
const AGENT_STATUS_FILE = path.join(process.cwd(), '.agent_status.json');

// Check if API-based connection approval is enabled
const ENABLE_APPROVAL_API = process.env.ENABLE_CONNECTION_APPROVAL_API === 'true';
console.log('🔍 DEBUG: Connection approval API enabled:', ENABLE_APPROVAL_API);

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
    this.connections = new Map(); // For backward compatibility
    this.connectionsHandler = null; // ConnectionsHandler instance
    this.initialized = false;
    this.monitoring = false;
    this.monitorInterval = null;
    this.messageCount = 0;
    this.lastActivityTime = Date.now();
  }

  /**
   * Initialize the agent handler with proper connection management
   */
  async initialize(agentKey, agentId, inboundTopicId, outboundTopicId) {
    try {
      console.log(`🔄 Initializing agent handler with: ${agentId}, ${inboundTopicId}, ${outboundTopicId}`);
      
      this.agentId = agentId;
      this.inboundTopicId = inboundTopicId;
      this.outboundTopicId = outboundTopicId;
      this.agentKey = agentKey;

      // Create and initialize HCS10 client
      try {
        let formattedKey = this.agentKey.trim();
        if (formattedKey.length === 64 && /^[0-9a-fA-F]{64}$/.test(formattedKey)) {
          formattedKey = `302e020100300506032b657004220420${formattedKey}`;
        }

        const clientConfig = {
          network: 'testnet',
          operatorId: this.agentId,
          operatorKey: formattedKey,
          mirrorNode: process.env.MIRROR_NODE_URL || 'https://testnet.mirrornode.hedera.com',
          useEncryption: false
        };

        this.client = new HCS10Client(clientConfig);
        console.log('✅ HCS10 client initialized');
      } catch (error) {
        console.error('❌ Error initializing HCS10 client:', error);
        throw error;
      }

      // Initialize ConnectionsHandler
      console.log('🔄 Initializing ConnectionsHandler...');
      this.connectionsHandler = new ConnectionsManager(this.client);
      await this.connectionsHandler.initialize(this.agentId, this.inboundTopicId);

      // Set up connection event handlers
      this.connectionsHandler.on('connection_established', (conn) => {
        this.sendWelcomeMessage(conn);
      });

      this.initialized = true;
      console.log('✅ Agent handler initialization complete');
      return true;

    } catch (error) {
      console.error('❌ Error initializing agent handler:', error);
      this.emit('error', error);
      return false;
    }
  }

  /**
   * Start monitoring for messages
   */
  async startMonitoring() {
    if (!this.initialized) {
      throw new Error('Agent handler not initialized');
    }

    try {
      if (this.monitoring) {
        console.log('⚠️ Already monitoring inbound topic');
        return true;
      }

      const pollingIntervalMs = 5000; // 5 seconds
      console.log(`🔄 Starting to monitor inbound topic with ${pollingIntervalMs}ms interval`);

      this.monitorInterval = setInterval(async () => {
        await this.checkInboundTopic();
      }, pollingIntervalMs);

      this.monitoring = true;
      this.emit('monitoring_started');
      console.log('✅ Started monitoring inbound topic');
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
      const messages = await this.client.getMessageStream(this.inboundTopicId);

      if (messages && messages.length > 0) {
        console.log(`📬 Found ${messages.length} messages on inbound topic`);
        
        // Process messages through ConnectionsHandler first
        await this.connectionsHandler.processMessages(messages);

        // Process application messages after connection handling
        for (const message of messages) {
          await this.processApplicationMessage(message);
        }
        
        this.messageCount += messages.length;
      }

      this.lastActivityTime = Date.now();

    } catch (error) {
      console.error('❌ Error checking inbound topic:', error);
    }
  }

  /**
   * Process non-connection application messages
   */
  async processApplicationMessage(message) {
    try {
      let content = message.content || message.contents;
      if (typeof content === 'string') {
        content = JSON.parse(content);
      }

      // Skip connection-related messages - already handled by ConnectionsHandler
      if (content.op && ['connection_request', 'connection_created'].includes(content.op)) {
        return;
      }

      // Handle other application-specific messages
      this.emit('message', content);

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

      await this.client.sendMessage(
        connection.connectionTopicId,
        JSON.stringify({
          type: 'welcome',
          message: 'Welcome to Lynxify HCS-10 Agent!',
          timestamp: new Date().toISOString()
        })
      );
      console.log(`✅ Sent welcome message to ${connection.targetAccountId}`);

    } catch (error) {
      console.error('❌ Error sending welcome message:', error);
    }
  }

  /**
   * Stop monitoring
   */
  stopMonitoring() {
    if (this.monitorInterval) {
      clearInterval(this.monitorInterval);
      this.monitorInterval = null;
    }
    this.monitoring = false;
    this.emit('monitoring_stopped');
    console.log('🛑 Stopped monitoring inbound topic');
  }
}

/**
 * Main function for running the agent
 */
async function main() {
  try {
    console.log('🚀 Starting HCS10 agent...');
    
    // Create handler
    const handler = new HCS10AgentHandler();
    
    // Initialize the handler
    await handler.initialize(process.env.OPERATOR_KEY, process.env.NEXT_PUBLIC_HCS_AGENT_ID, process.env.NEXT_PUBLIC_HCS_INBOUND_TOPIC, process.env.NEXT_PUBLIC_HCS_OUTBOUND_TOPIC);
    
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