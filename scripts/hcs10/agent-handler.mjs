import { HCS10Client } from '@hashgraphonline/standards-sdk';
import fs from 'fs/promises';
import dotenv from 'dotenv';
import path from 'path';
import { EventEmitter } from 'events';

// Load environment variables
dotenv.config({ path: '.env.local' });

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
    this.connections = new Map(); // connection ID -> connection details
    this.initialized = false;
    this.monitoring = false;
    this.monitorInterval = null;
  }

  /**
   * Initialize the agent handler
   */
  async initialize() {
    try {
      if (this.initialized) return true;

      // Get credentials from environment
      const operatorId = process.env.NEXT_PUBLIC_OPERATOR_ID;
      const operatorKey = process.env.OPERATOR_KEY;
      
      if (!operatorId || !operatorKey) {
        throw new Error('Missing required environment variables: NEXT_PUBLIC_OPERATOR_ID and OPERATOR_KEY');
      }
      
      // Get topic IDs from environment or registration file
      await this.loadRegistrationInfo();
      
      if (!this.agentId || !this.inboundTopicId || !this.outboundTopicId) {
        throw new Error('Missing required agent configuration. Make sure agent is registered.');
      }
      
      // Create HCS10 client
      console.log('🔄 Creating HCS10 client...');
      this.client = new HCS10Client({
        network: 'testnet',
        operatorId,
        operatorPrivateKey: operatorKey,
        logLevel: 'debug'
      });
      
      console.log('✅ HCS10 client created');
      
      // Load existing connections
      await this.loadConnections();
      
      this.initialized = true;
      this.emit('initialized');
      
      return true;
    } catch (error) {
      console.error('❌ Error initializing agent handler:', error);
      this.emit('error', error);
      return false;
    }
  }
  
  /**
   * Load agent registration information
   */
  async loadRegistrationInfo() {
    try {
      // Try to load from registration file first
      const registrationData = JSON.parse(
        await fs.readFile('.registration_status.json', 'utf8')
      );
      
      this.agentId = registrationData.accountId || process.env.NEXT_PUBLIC_HCS_AGENT_ID;
      this.inboundTopicId = registrationData.inboundTopicId || process.env.NEXT_PUBLIC_HCS_INBOUND_TOPIC;
      this.outboundTopicId = registrationData.outboundTopicId || process.env.NEXT_PUBLIC_HCS_OUTBOUND_TOPIC;
      
      console.log('✅ Loaded agent registration info:');
      console.log(`   Agent ID: ${this.agentId}`);
      console.log(`   Inbound Topic: ${this.inboundTopicId}`);
      console.log(`   Outbound Topic: ${this.outboundTopicId}`);
    } catch (error) {
      // Fall back to environment variables
      this.agentId = process.env.NEXT_PUBLIC_HCS_AGENT_ID;
      this.inboundTopicId = process.env.NEXT_PUBLIC_HCS_INBOUND_TOPIC;
      this.outboundTopicId = process.env.NEXT_PUBLIC_HCS_OUTBOUND_TOPIC;
      
      console.log('ℹ️ Using environment variables for agent configuration:');
      console.log(`   Agent ID: ${this.agentId}`);
      console.log(`   Inbound Topic: ${this.inboundTopicId}`);
      console.log(`   Outbound Topic: ${this.outboundTopicId}`);
    }
  }
  
  /**
   * Load existing connections
   */
  async loadConnections() {
    try {
      const connectionsFile = path.join(process.cwd(), '.connections.json');
      const data = await fs.readFile(connectionsFile, 'utf8');
      const connections = JSON.parse(data);
      
      for (const connection of connections) {
        this.connections.set(connection.id, connection);
      }
      
      console.log(`✅ Loaded ${this.connections.size} existing connections`);
    } catch (error) {
      console.log('ℹ️ No existing connections found or error loading them.');
      this.connections.clear();
    }
  }
  
  /**
   * Save connections to disk
   */
  async saveConnections() {
    try {
      const connectionsFile = path.join(process.cwd(), '.connections.json');
      const connections = Array.from(this.connections.values());
      await fs.writeFile(connectionsFile, JSON.stringify(connections, null, 2));
      console.log(`✅ Saved ${connections.length} connections to disk`);
    } catch (error) {
      console.error('❌ Error saving connections:', error);
    }
  }
  
  /**
   * Start monitoring inbound topic for messages
   */
  async startMonitoring() {
    if (!this.initialized) {
      await this.initialize();
    }
    
    if (this.monitoring) return;
    
    console.log('👂 Starting to monitor inbound topic for messages...');
    
    // Set up a periodic polling mechanism
    this.monitorInterval = setInterval(async () => {
      await this.checkInboundTopic();
    }, 10000); // Check every 10 seconds
    
    // Do an immediate check
    await this.checkInboundTopic();
    
    this.monitoring = true;
    this.emit('monitoring_started');
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
  
  /**
   * Check inbound topic for new messages
   */
  async checkInboundTopic() {
    try {
      const messages = await this.client.getMessageStream(this.inboundTopicId);
      
      if (messages && messages.length > 0) {
        console.log(`📬 Found ${messages.length} messages on inbound topic`);
        
        for (const message of messages) {
          await this.processInboundMessage(message);
        }
      }
    } catch (error) {
      console.error('❌ Error checking inbound topic:', error);
      this.emit('error', error);
    }
  }
  
  /**
   * Process a message from inbound topic
   */
  async processInboundMessage(message) {
    try {
      console.log('📩 Processing inbound message:', message);
      this.emit('message_received', message);
      
      // Handle different message types based on op field
      if (message.op === 'connection_request') {
        await this.handleConnectionRequest(message);
      } else {
        console.log('ℹ️ Unknown operation type:', message.op);
      }
    } catch (error) {
      console.error('❌ Error processing inbound message:', error);
    }
  }
  
  /**
   * Handle connection request
   */
  async handleConnectionRequest(message) {
    try {
      console.log('🔄 Handling connection request:', message);
      
      // Extract requester info
      const requesterId = message.account_id || message.sender;
      const connectionRequestId = message.id || message.sequence_number;
      
      console.log(`👤 Connection request from ${requesterId}, ID: ${connectionRequestId}`);
      
      // Accept the connection request
      const connection = await this.client.handleConnectionRequest(
        this.inboundTopicId,
        requesterId,
        connectionRequestId
      );
      
      console.log('✅ Connection established:', connection);
      
      // Store the connection
      this.connections.set(connection.id, {
        id: connection.id,
        connectionTopicId: connection.connectionTopicId,
        requesterId,
        establishedAt: Date.now()
      });
      
      // Save connections to disk
      await this.saveConnections();
      
      // Emit event
      this.emit('connection_established', connection);
      
      // Send a welcome message on the connection topic
      await this.sendMessage(
        connection.connectionTopicId,
        {
          type: 'welcome',
          message: 'Welcome to Lynxify HCS-10 Agent!',
          timestamp: new Date().toISOString()
        }
      );
      
      return connection;
    } catch (error) {
      console.error('❌ Error handling connection request:', error);
      this.emit('error', error);
      return null;
    }
  }
  
  /**
   * Send a message on a connection topic
   */
  async sendMessage(connectionTopicId, message) {
    try {
      if (!this.initialized) {
        await this.initialize();
      }
      
      console.log(`📤 Sending message to topic ${connectionTopicId}:`, message);
      
      // Convert message to string if it's an object
      const messageStr = typeof message === 'object' ? JSON.stringify(message) : message;
      
      // Send the message
      const result = await this.client.sendMessage(connectionTopicId, messageStr);
      
      console.log('✅ Message sent successfully');
      this.emit('message_sent', { connectionTopicId, message, result });
      
      return result;
    } catch (error) {
      console.error('❌ Error sending message:', error);
      this.emit('error', error);
      return null;
    }
  }
  
  /**
   * Get agent status
   */
  getStatus() {
    return {
      initialized: this.initialized,
      monitoring: this.monitoring,
      agentId: this.agentId,
      inboundTopicId: this.inboundTopicId,
      outboundTopicId: this.outboundTopicId,
      connections: Array.from(this.connections.values()),
      connectionCount: this.connections.size
    };
  }
}

// Export a singleton instance
const agentHandler = new HCS10AgentHandler();
export default agentHandler; 