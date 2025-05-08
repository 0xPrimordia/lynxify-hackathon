import { HCS10Client, ConnectionsManager } from '@hashgraphonline/standards-sdk';
import fs from 'fs/promises';
import dotenv from 'dotenv';
import path from 'path';
import { EventEmitter } from 'events';

// Load environment variables
dotenv.config({ path: '.env.local' });

// Define whitelist for auto-approved connections (optional)
const AUTO_APPROVED_ACCOUNTS = process.env.AUTO_APPROVED_ACCOUNTS 
  ? process.env.AUTO_APPROVED_ACCOUNTS.split(',') 
  : [];

// Paths for IPC with wrapper process
const PENDING_CONNECTIONS_FILE = path.join(process.cwd(), '.pending_connections.json');
const APPROVAL_COMMAND_FILE = path.join(process.cwd(), '.approval_commands.json');
const AGENT_STATUS_FILE = path.join(process.cwd(), '.agent_status.json');

// Check if API-based connection approval is enabled
const ENABLE_APPROVAL_API = process.env.ENABLE_CONNECTION_APPROVAL_API === 'true';

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
    this.connectionsManager = null; // ConnectionsManager instance
    this.initialized = false;
    this.monitoring = false;
    this.monitorInterval = null;
    this.commandCheckInterval = null;
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
      
      // Initialize ConnectionsManager
      console.log('🔄 Initializing ConnectionsManager...');
      this.connectionsManager = new ConnectionsManager({ 
        baseClient: this.client 
      });
      console.log('✅ ConnectionsManager initialized');
      
      // Load connections from ConnectionsManager
      await this.loadConnections();
      
      // Initialize file-based IPC (if API enabled)
      if (ENABLE_APPROVAL_API) {
        console.log('🔄 Initializing file-based IPC for connection approvals...');
        await this.initializeIPC();
        
        // Set up interval to check for approval commands
        this.commandCheckInterval = setInterval(() => {
          this.checkApprovalCommands();
        }, 5000); // Check every 5 seconds
      }
      
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
   * Initialize file-based IPC for connection approvals
   */
  async initializeIPC() {
    try {
      // Ensure the approval command file exists
      try {
        await fs.access(APPROVAL_COMMAND_FILE);
      } catch (err) {
        // Create empty file if it doesn't exist
        await fs.writeFile(APPROVAL_COMMAND_FILE, '[]');
      }
      
      // Ensure the pending connections file exists
      try {
        await fs.access(PENDING_CONNECTIONS_FILE);
      } catch (err) {
        // Create empty file if it doesn't exist
        await fs.writeFile(PENDING_CONNECTIONS_FILE, '[]');
      }
      
      // Ensure the agent status file exists
      try {
        await fs.access(AGENT_STATUS_FILE);
      } catch (err) {
        // Create empty file with initial status
        await fs.writeFile(AGENT_STATUS_FILE, JSON.stringify(this.getStatus()));
      }
      
      console.log('✅ File-based IPC initialized');
    } catch (error) {
      console.error('❌ Error initializing file-based IPC:', error);
    }
  }
  
  /**
   * Check for approval commands from the wrapper process
   */
  async checkApprovalCommands() {
    if (!ENABLE_APPROVAL_API) return;
    
    try {
      // Read the approval command file
      const data = await fs.readFile(APPROVAL_COMMAND_FILE, 'utf8');
      let commands = [];
      
      try {
        commands = JSON.parse(data);
      } catch (err) {
        // Invalid JSON, reset the file
        await fs.writeFile(APPROVAL_COMMAND_FILE, '[]');
        return;
      }
      
      // Process any pending commands
      if (commands.length > 0) {
        console.log(`📝 Found ${commands.length} approval commands to process`);
        
        const processedCommands = [];
        
        for (const command of commands) {
          if (command.type === 'approve_connection') {
            console.log(`🔄 Processing approval command for connection ${command.connectionId}`);
            
            try {
              // Get the connection from ConnectionsManager by topic ID
              const connectionToApprove = this.connectionsManager.getConnectionByTopicId(command.connectionId);
              
              if (connectionToApprove && connectionToApprove.isPending) {
                // Approve the connection
                await this.approveConnection(connectionToApprove);
                console.log(`✅ Successfully approved connection ${command.connectionId}`);
              } else {
                console.log(`⚠️ Connection ${command.connectionId} not found or doesn't need approval`);
              }
              
              // Mark command as processed
              processedCommands.push(command);
            } catch (error) {
              console.error(`❌ Error processing approval command:`, error);
            }
          } else {
            // Unknown command type, just mark as processed
            processedCommands.push(command);
          }
        }
        
        // Remove processed commands
        if (processedCommands.length > 0) {
          const remainingCommands = commands.filter(cmd => 
            !processedCommands.some(processed => 
              processed.connectionId === cmd.connectionId && 
              processed.timestamp === cmd.timestamp
            )
          );
          
          // Write back the remaining commands
          await fs.writeFile(APPROVAL_COMMAND_FILE, JSON.stringify(remainingCommands, null, 2));
        }
      }
    } catch (error) {
      console.error('❌ Error checking approval commands:', error);
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
   * Load existing connections using ConnectionsManager
   */
  async loadConnections() {
    try {
      if (!this.connectionsManager) {
        console.log('⚠️ ConnectionsManager not initialized, using legacy connection loading');
        await this.loadLegacyConnections();
        return;
      }

      console.log('🔄 Loading connections from ConnectionsManager...');
      const connections = await this.connectionsManager.fetchConnectionData(this.agentId);
      console.log(`✅ Loaded ${connections.length} connections from ConnectionsManager`);
      
      // For backward compatibility, keep the connections map updated
      this.syncConnectionsFromManager();
      
      // Update status file with latest connection info
      await this.updateStatusFile();
    } catch (error) {
      console.error('❌ Error loading connections:', error);
      console.log('ℹ️ Using empty connections list');
      this.connections.clear();
    }
  }

  /**
   * Legacy method to load connections from file
   * This is kept for backward compatibility
   */
  async loadLegacyConnections() {
    try {
      const connectionsFile = path.join(process.cwd(), '.connections.json');
      const data = await fs.readFile(connectionsFile, 'utf8');
      const connections = JSON.parse(data);
      
      for (const connection of connections) {
        this.connections.set(connection.id, connection);
      }
      
      console.log(`✅ Loaded ${this.connections.size} existing connections from file`);
    } catch (error) {
      console.log('ℹ️ No existing connections found or error loading them.');
      this.connections.clear();
    }
  }

  /**
   * Synchronize the connections map with ConnectionsManager data
   */
  syncConnectionsFromManager() {
    if (!this.connectionsManager) return;
    
    const managerConnections = this.connectionsManager.getAllConnections();
    this.connections.clear();
    
    for (const conn of managerConnections) {
      this.connections.set(conn.connectionTopicId, {
        id: conn.connectionTopicId,
        connectionTopicId: conn.connectionTopicId,
        requesterId: conn.targetAccountId,
        status: conn.status,
        establishedAt: conn.created?.getTime() || Date.now()
      });
    }
    
    console.log(`✅ Synchronized ${this.connections.size} connections from ConnectionsManager`);
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
      await this.checkPendingConnections();
      await this.updateStatusFile();
    }, 10000); // Check every 10 seconds
    
    // Do an immediate check
    await this.checkInboundTopic();
    await this.checkPendingConnections();
    await this.updateStatusFile();
    
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
    
    if (this.commandCheckInterval) {
      clearInterval(this.commandCheckInterval);
      this.commandCheckInterval = null;
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
        
        // Process messages with ConnectionsManager if available
        if (this.connectionsManager) {
          this.connectionsManager.processInboundMessages(messages);
        }
        
        // Also process individually for backward compatibility
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
   * Check for pending connection requests that need approval
   */
  async checkPendingConnections() {
    if (!this.connectionsManager) return;
    
    try {
      // Get pending connections that need approval
      const pendingRequests = this.connectionsManager.getPendingRequests();
      
      if (pendingRequests.length > 0) {
        console.log(`📝 Found ${pendingRequests.length} pending connection requests`);
        
        // Write pending connections to file for the API to read
        if (ENABLE_APPROVAL_API) {
          await fs.writeFile(
            PENDING_CONNECTIONS_FILE, 
            JSON.stringify(pendingRequests, null, 2)
          );
        }
        
        for (const request of pendingRequests) {
          await this.handlePendingConnection(request);
        }
      } else if (ENABLE_APPROVAL_API) {
        // Clear the pending connections file if there are no pending requests
        await fs.writeFile(PENDING_CONNECTIONS_FILE, '[]');
      }
    } catch (error) {
      console.error('❌ Error checking pending connections:', error);
    }
  }
  
  /**
   * Update the agent status file for the API
   */
  async updateStatusFile() {
    if (!ENABLE_APPROVAL_API) return;
    
    try {
      const status = this.getStatus();
      await fs.writeFile(AGENT_STATUS_FILE, JSON.stringify(status, null, 2));
    } catch (error) {
      console.error('❌ Error updating status file:', error);
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
        // Use ConnectionsManager for handling (will call handlePendingConnection later)
        if (!this.connectionsManager) {
          await this.handleConnectionRequest(message);
        }
        // Otherwise, already processed by ConnectionsManager and will be handled by checkPendingConnections
      } else {
        console.log('ℹ️ Unknown operation type:', message.op);
      }
    } catch (error) {
      console.error('❌ Error processing inbound message:', error);
    }
  }
  
  /**
   * Handle pending connection based on approval rules
   */
  async handlePendingConnection(pendingRequest) {
    try {
      const requesterId = pendingRequest.targetAccountId;
      console.log(`🔄 Processing pending connection request from ${requesterId}`);
      
      // If API is enabled, don't auto-approve unless in whitelist
      if (ENABLE_APPROVAL_API) {
        // Only auto-approve if explicitly in whitelist
        const shouldAutoApprove = AUTO_APPROVED_ACCOUNTS.includes(requesterId);
        
        if (shouldAutoApprove) {
          console.log(`✅ Auto-approving connection from ${requesterId} (in whitelist)`);
          await this.approveConnection(pendingRequest);
        } else {
          console.log(`⏳ Connection from ${requesterId} requires manual approval via API`);
          // Notification happens via the status file and pending connections file
        }
      } else {
        // If API is not enabled, use the original auto-approval logic
        const shouldAutoApprove = this.shouldAutoApproveConnection(requesterId);
        
        if (shouldAutoApprove) {
          console.log(`✅ Auto-approving connection from ${requesterId}`);
          await this.approveConnection(pendingRequest);
        } else {
          console.log(`⏳ Connection from ${requesterId} requires manual approval`);
          // Emit an event to notify about pending approval
          this.emit('connection_needs_approval', pendingRequest);
        }
      }
    } catch (error) {
      console.error('❌ Error handling pending connection:', error);
    }
  }
  
  /**
   * Check if a connection should be auto-approved
   */
  shouldAutoApproveConnection(accountId) {
    // Auto-approve if in whitelist, or approve all if whitelist is empty
    return AUTO_APPROVED_ACCOUNTS.includes(accountId) || AUTO_APPROVED_ACCOUNTS.length === 0;
  }
  
  /**
   * Approve a connection request
   */
  async approveConnection(pendingRequest) {
    try {
      // Get connection request details
      const requesterId = pendingRequest.targetAccountId;
      const connectionRequestId = pendingRequest.connectionRequestId;
      
      console.log(`🔄 Approving connection request from ${requesterId}, ID: ${connectionRequestId}`);
      
      // Accept the connection request
      const connection = await this.client.handleConnectionRequest(
        this.inboundTopicId,
        requesterId,
        connectionRequestId
      );
      
      console.log('✅ Connection established:', connection);
      
      // Update connection in ConnectionsManager
      pendingRequest.status = 'established';
      pendingRequest.isPending = false;
      this.connectionsManager.updateOrAddConnection(pendingRequest);
      
      // Update the connections map for backward compatibility
      this.connections.set(connection.id, {
        id: connection.id,
        connectionTopicId: connection.connectionTopicId,
        requesterId,
        status: 'established',
        establishedAt: Date.now()
      });
      
      // Save connections to disk (legacy)
      await this.saveConnections();
      
      // Update status and pending connections files
      if (ENABLE_APPROVAL_API) {
        await this.updateStatusFile();
        await this.checkPendingConnections(); // This will update the pending connections file
      }
      
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
      console.error('❌ Error approving connection:', error);
      this.emit('error', error);
      return null;
    }
  }
  
  /**
   * Legacy connection request handler
   * Used as a fallback when ConnectionsManager is not available
   */
  async handleConnectionRequest(message) {
    try {
      console.log('🔄 Handling connection request (legacy mode):', message);
      
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
   * Send a message to a connection topic
   */
  async sendMessage(connectionTopicId, message) {
    try {
      if (!connectionTopicId) {
        throw new Error('Missing connection topic ID');
      }
      
      if (typeof message === 'object') {
        message = JSON.stringify(message);
      }
      
      await this.client.sendMessage(connectionTopicId, message);
      console.log(`✅ Message sent to ${connectionTopicId}`);
      return true;
    } catch (error) {
      console.error(`❌ Error sending message to ${connectionTopicId}:`, error);
      this.emit('error', error);
      return false;
    }
  }
  
  /**
   * Legacy method to save connections to disk
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
   * Get current agent status
   */
  getStatus() {
    // Get pending connections for status report
    const pendingCount = this.connectionsManager 
      ? this.connectionsManager.getPendingRequests().length 
      : 0;
    
    // Get active connections for status report
    const activeCount = this.connectionsManager
      ? this.connectionsManager.getActiveConnections().length
      : this.connections.size;
    
    return {
      initialized: this.initialized,
      monitoring: this.monitoring,
      agentId: this.agentId,
      inboundTopicId: this.inboundTopicId,
      outboundTopicId: this.outboundTopicId,
      connectionCount: this.connections.size,
      activeConnectionCount: activeCount,
      pendingConnectionCount: pendingCount,
      lastUpdated: new Date().toISOString()
    };
  }
  
  /**
   * Manually approve a pending connection request
   * This can be called from an admin API or UI
   */
  async manuallyApproveConnection(connectionId) {
    if (!this.connectionsManager) {
      throw new Error('ConnectionsManager not initialized');
    }
    
    const pendingRequest = this.connectionsManager.getConnectionByTopicId(connectionId);
    
    if (!pendingRequest || !pendingRequest.isPending) {
      throw new Error(`Connection ${connectionId} not found or doesn't need approval`);
    }
    
    return await this.approveConnection(pendingRequest);
  }
}

// Export a singleton instance
const agentHandler = new HCS10AgentHandler();
export default agentHandler; 