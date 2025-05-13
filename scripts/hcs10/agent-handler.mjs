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
      service: 'lynxify-hcs10-agent',
      uptime: Math.floor(process.uptime()),
      timestamp: new Date().toISOString()
    }));
    return;
  }
  
  // Default response for other routes
  res.writeHead(404, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ error: 'Not found' }));
});

// CRITICAL: Explicitly bind to 0.0.0.0 as required by Render
server.listen(PORT, '0.0.0.0', () => {
  console.log(`🌐 HTTP server running at http://0.0.0.0:${PORT}`);
  console.log(`🌐 Health check available at http://0.0.0.0:${PORT}/health`);
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
    this.connections = new Map(); // connection ID -> connection details
    this.connectionsManager = null; // ConnectionsManager instance
    this.initialized = false;
    this.monitoring = false;
    this.monitorInterval = null;
    this.commandCheckInterval = null;
    this.lastCheckedConnectionIndex = null;
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
      
      // Load connections from ConnectionsManager - Force a fresh fetch
      console.log('🔄 Fetching connections from Hedera...');
      await this.connectionsManager.fetchConnectionData(this.agentId, true); // force fresh fetch
      
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
      console.log(`🔍 DEBUG: Pending connections file path: ${PENDING_CONNECTIONS_FILE}`);
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
      // Check if file exists first
      try {
        await fs.access(APPROVAL_COMMAND_FILE);
      } catch (err) {
        // File doesn't exist yet, create it
        await fs.writeFile(APPROVAL_COMMAND_FILE, '[]');
        return;
      }
      
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
        const remainingCommands = [];
        
        for (const command of commands) {
          if (command.type === 'approve_connection') {
            console.log(`🔄 Processing approval command for connection ${command.connectionId}`);
            
            try {
              // Get the connection from ConnectionsManager by topic ID
              const connectionToApprove = this.connectionsManager.getConnectionByTopicId(command.connectionId);
              
              if (connectionToApprove && (connectionToApprove.isPending || connectionToApprove.status === 'needs_confirmation')) {
                // Approve the connection
                await this.approveConnection(connectionToApprove);
                console.log(`✅ Successfully approved connection ${command.connectionId}`);
                processedCommands.push(command);
              } else {
                console.log(`⚠️ Connection ${command.connectionId} not found or doesn't need approval`);
                processedCommands.push(command); // Mark as processed even if we couldn't approve it
              }
            } catch (error) {
              console.error(`❌ Error processing approval command:`, error);
              // Keep the command for retrying later
              remainingCommands.push(command);
            }
          } else {
            // Unknown command type, just mark as processed
            processedCommands.push(command);
          }
        }
        
        // Write back only unprocessed commands
        await fs.writeFile(APPROVAL_COMMAND_FILE, JSON.stringify(remainingCommands, null, 2));
        
        console.log(`✅ Processed ${processedCommands.length} commands, ${remainingCommands.length} remaining`);
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
   * Save connections to file (for test tools)
   */
  async saveConnections() {
    try {
      // Get connections from ConnectionsManager
      const connections = this.connectionsManager.getAllConnections();
      
      // Convert to the format expected by test tools
      const formattedConnections = connections.map(conn => ({
        id: conn.connectionTopicId,
        connectionTopicId: conn.connectionTopicId,
        requesterId: conn.targetAccountId,
        status: conn.status,
        establishedAt: conn.created?.getTime() || Date.now()
      }));
      
      // Save to file
      const connectionsFile = path.join(process.cwd(), '.connections.json');
      await fs.writeFile(connectionsFile, JSON.stringify(formattedConnections, null, 2));
      
      console.log(`✅ Saved ${formattedConnections.length} connections to file for test tools`);
    } catch (error) {
      console.error('❌ Error saving connections to file:', error);
    }
  }

  /**
   * Load connections from ConnectionsManager
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
      console.log('🔍 DEBUG: Connections from manager:', JSON.stringify(connections, null, 2));
      
      // For backward compatibility, keep the connections map updated
      this.syncConnectionsFromManager();
      
      // Save connections to file for test tools
      await this.saveConnections();
      
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
    
    console.log('🔍 DEBUG: All connections from manager:', JSON.stringify(managerConnections, null, 2));
    
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
   * Start monitoring the inbound topic for new messages
   */
  async startMonitoring() {
    try {
      if (this.monitoring) {
        console.log('⚠️ Monitoring already active');
        return;
      }
      
      if (!this.initialized) {
        throw new Error('Agent handler not initialized');
      }
      
      // Set up polling interval with much longer time between polls
      // This reduces server load dramatically while still being responsive enough
      const pollingIntervalMs = 60000; // 60 seconds (1 minute)
      console.log(`🔄 Starting message polling with ${pollingIntervalMs/1000}s interval...`);
      
      // Do NOT check immediately on startup - let the server stabilize
      
      // Set up regular polling with a much longer interval
      this.monitorInterval = setInterval(async () => {
        await this.checkInboundTopic();
      }, pollingIntervalMs);
      
      this.monitoring = true;
      this.emit('monitoring_started');
      console.log('✅ Started monitoring inbound topic');
      
      // Also set up connection state file updates if API enabled
      if (ENABLE_APPROVAL_API) {
        // Update pending connections file with current state
        await this.updatePendingConnectionsFile();
        
        // Check pending connections with a delay
        setTimeout(async () => {
          await this.checkPendingConnections();
        }, 10000); // 10 second initial delay
        
        // Set up interval for checking pending connections - much less frequent
        setInterval(async () => {
          await this.checkPendingConnections();
        }, 120000); // Check every 2 minutes
      }
      
      return true;
    } catch (error) {
      console.error('❌ Error starting monitoring:', error);
      this.emit('error', error);
      return false;
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
      console.log(`🔄 Checking inbound topic ${this.inboundTopicId} for new messages...`);
      
      // Debug - active connections list
      const connectionsList = this.connectionsManager?.getActiveConnections() || [];
      console.log(`🔍 Active connections: ${connectionsList.length}`);
      
      // IMPORTANT: Don't log all connection IDs - just count them
      if (connectionsList.length > 0) {
        console.log(`🔍 Found ${connectionsList.length} active connections`);
      }
      
      // ONLY use the standard approach for messages - no connection-by-connection checking
      try {
        console.log('🔍 Checking for new messages using standard getMessageStream...');
        const messages = await this.client.getMessageStream(this.inboundTopicId);
        
        if (messages && messages.length > 0) {
          console.log(`📬 Found ${messages.length} messages on inbound topic`);
          
          // Process messages with ConnectionsManager if available
          if (this.connectionsManager) {
            console.log('🔄 Processing messages with ConnectionsManager...');
            this.connectionsManager.processInboundMessages(messages);
          }
          
          // Also process individually for backward compatibility
          for (const message of messages) {
            await this.processInboundMessage(message);
          }
        } else {
          console.log('ℹ️ No new messages found');
        }
      } catch (standardError) {
        console.error(`⚠️ Error with message retrieval:`, standardError);
      }
      
      // Check the outbound topic once per poll
      if (this.outboundTopicId) {
        try {
          console.log(`🔍 Checking outbound topic ${this.outboundTopicId} for misrouted messages...`);
          const outboundMessages = await this.client.getMessageStream(this.outboundTopicId);
          
          if (outboundMessages && outboundMessages.length > 0) {
            console.log(`📬 Found ${outboundMessages.length} messages on outbound topic`);
            
            // Process these messages too
            for (const message of outboundMessages) {
              await this.processInboundMessage(message);
            }
          }
        } catch (outboundError) {
          console.error(`⚠️ Error checking outbound topic:`, outboundError);
        }
      }
    } catch (error) {
      console.error('❌ Error checking inbound topic:', error);
      this.emit('error', error);
    }
  }
  
  /**
   * Check pending connections and update status files
   */
  async checkPendingConnections() {
    try {
      // Get pending connections from ConnectionsManager
      await this.connectionsManager.fetchConnectionData(this.agentId);
      
      // Log minimal connection information
      const allConnections = this.connectionsManager.getAllConnections();
      console.log(`🔍 Total connections in ConnectionsManager: ${allConnections.length}`);
      
      // Standard pending requests (isPending = true)
      const pendingRequests = this.connectionsManager.getPendingRequests();
      
      // Check for connections that need confirmation (status = 'needs_confirmation')
      const needsConfirmationConnections = this.connectionsManager.getConnectionsNeedingConfirmation();
      console.log(`🔍 Connections needing confirmation: ${needsConfirmationConnections.length}`);
      
      // Combine both types for processing
      const allPendingConnections = [...pendingRequests, ...needsConfirmationConnections];
      
      // Simple log of connection counts
      console.log(`{ module: 'ConnectionsManager' } Total connections in map: ${allConnections.length}`);
      console.log(`{ module: 'ConnectionsManager' } Standard pending connections: ${pendingRequests.length}`);
      console.log(`{ module: 'ConnectionsManager' } Connections needing confirmation: ${needsConfirmationConnections.length}`);
      console.log(`{ module: 'ConnectionsManager' } Total pending to process: ${allPendingConnections.length}`);
      
      // Process all pending connections, including those needing confirmation
      if (allPendingConnections.length > 0) {
        console.log(`{ module: 'ConnectionsManager' } Processing ${allPendingConnections.length} pending connections`);
        
        // Process each pending connection
        for (const conn of allPendingConnections) {
          // Only log the connection ID to reduce log spam
          console.log(`🔄 Processing connection: ${conn.connectionTopicId}`);
          
          // Process based on status
          if (conn.status === 'needs_confirmation') {
            await this.handleNeedsConfirmationRequest(conn);
          } else if (conn.isPending) {
            await this.handlePendingConnectionRequest(conn);
          }
        }
      } else {
        console.log(`{ module: 'ConnectionsManager' } No pending connections found`);
      }
      
      // Update pending connections file
      if (ENABLE_APPROVAL_API) {
        await this.updatePendingConnectionsFile();
      }
      
      // Update status file
      await this.updateStatusFile();
    } catch (error) {
      console.error('❌ Error checking pending connections:', error);
      this.emit('error', error);
    }
  }
  
  /**
   * Handle a connection that needs confirmation (status = 'needs_confirmation')
   * This follows the SDK example from polling-agent.ts
   */
  async handleNeedsConfirmationRequest(connection) {
    try {
      console.log(`🔄 Handling connection that needs confirmation: ${connection.connectionTopicId}`);
      console.log(`   Target Account: ${connection.targetAccountId}`);
      console.log(`   Request ID: ${connection.connectionRequestId}`);
      
      // If the connectionRequestId is not available, try to derive it from other sources
      if (!connection.connectionRequestId) {
        console.log(`⚠️ Connection is missing connectionRequestId, attempting to extract from connection data...`);
        console.log(`🔍 DEBUG: Connection object:`, JSON.stringify(connection, null, 2));
        
        // If we have a connection ID in a format like "inb-10:0.0.5949517@0.0.4340026"
        // try to extract parts to form a request ID
        if (connection.connectionTopicId && connection.connectionTopicId.includes('@')) {
          const parts = connection.connectionTopicId.split('@');
          if (parts.length === 2) {
            // Use the sequence number or some default if not available
            connection.connectionRequestId = connection.sequenceNumber || 1;
            console.log(`✅ Derived connectionRequestId: ${connection.connectionRequestId}`);
          }
        }
        
        // If we still don't have a connectionRequestId, check if there's a connectionId field
        if (!connection.connectionRequestId && connection.connectionId) {
          connection.connectionRequestId = connection.connectionId;
          console.log(`✅ Using connectionId as connectionRequestId: ${connection.connectionRequestId}`);
        }
        
        // Last resort - generate a simple numeric ID
        if (!connection.connectionRequestId) {
          connection.connectionRequestId = Date.now();
          console.log(`⚠️ Using generated timestamp as connectionRequestId: ${connection.connectionRequestId}`);
        }
      }
      
      // If API is enabled, don't auto-approve unless in whitelist
      if (ENABLE_APPROVAL_API) {
        // Only auto-approve if explicitly in whitelist
        const shouldAutoApprove = AUTO_APPROVED_ACCOUNTS.includes(connection.targetAccountId);
        
        console.log(`🔍 DEBUG: Should auto-approve (API enabled): ${shouldAutoApprove}`);
        
        if (shouldAutoApprove) {
          console.log(`✅ Auto-approving connection from ${connection.targetAccountId} (in whitelist)`);
          
          // Ensure that both inboundTopicId and connectionId (which is the connectionRequestId) are passed
          if (!this.inboundTopicId) {
            throw new Error('inboundTopicId is required for connection memo');
          }
          if (!connection.connectionRequestId) {
            throw new Error('connectionRequestId is required for connection memo');
          }
          
          const result = await this.client.handleConnectionRequest(
            this.inboundTopicId,
            connection.targetAccountId, 
            connection.connectionRequestId
          );
          
          console.log(`✅ Connection approved:`, result);
          
          // Update connection status
          connection.status = 'established';
          connection.needsConfirmation = false;
          this.connectionsManager.updateOrAddConnection(connection);
          
          // Save for legacy code
          await this.syncConnectionsFromManager();
          await this.saveConnections();
          
          // Send welcome message
          if (result && result.connectionTopicId) {
            await this.sendMessage(
              result.connectionTopicId,
              {
                type: 'welcome',
                message: 'Welcome to Lynxify HCS-10 Agent!',
                timestamp: new Date().toISOString()
              }
            );
          }
          
          // Update status files
          if (ENABLE_APPROVAL_API) {
            await this.updateStatusFile();
            await this.checkPendingConnections();
          }
        } else {
          console.log(`⏳ Connection from ${connection.targetAccountId} requires manual approval via API`);
          // Notification happens via the status file and pending connections file
        }
      } else {
        // If API is not enabled, use the original auto-approval logic
        const shouldAutoApprove = this.shouldAutoApproveConnection(connection.targetAccountId);
        
        console.log(`🔍 DEBUG: Should auto-approve (API disabled): ${shouldAutoApprove}`);
        
        if (shouldAutoApprove) {
          console.log(`✅ Auto-approving connection from ${connection.targetAccountId}`);
          
          // Ensure that both inboundTopicId and connectionId (which is the connectionRequestId) are passed
          if (!this.inboundTopicId) {
            throw new Error('inboundTopicId is required for connection memo');
          }
          if (!connection.connectionRequestId) {
            throw new Error('connectionId is required for connection memo');
          }
          
          // KEY CHANGE: Use client.handleConnectionRequest directly
          const result = await this.client.handleConnectionRequest(
            this.inboundTopicId,
            connection.targetAccountId, 
            connection.connectionRequestId
          );
          
          console.log(`✅ Connection approved:`, result);
          
          // Update connection status
          connection.status = 'established';
          connection.needsConfirmation = false;
          this.connectionsManager.updateOrAddConnection(connection);
          
          // Save for legacy code
          await this.syncConnectionsFromManager();
          await this.saveConnections();
          
          // Send welcome message
          if (result && result.connectionTopicId) {
            await this.sendMessage(
              result.connectionTopicId,
              {
                type: 'welcome',
                message: 'Welcome to Lynxify HCS-10 Agent!',
                timestamp: new Date().toISOString()
              }
            );
          }
        } else {
          console.log(`⏳ Connection from ${connection.targetAccountId} requires manual approval`);
          this.emit('connection_needs_approval', connection);
        }
      }
    } catch (error) {
      console.error(`❌ Error handling needs_confirmation connection:`, error);
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
      console.log('📩 Processing inbound message:', JSON.stringify(message));
      this.emit('message_received', message);
      
      // Enhanced message format detection
      // Many different formats are used in practice, so we need to be flexible
      let messageOp = message.op;
      
      // Extract op from different possible formats
      if (!messageOp) {
        if (message.operation) messageOp = message.operation;
        if (message.type) messageOp = message.type;
        if (message.action) messageOp = message.action;
        
        // Try to parse data field if it exists and might contain an op
        if (message.data && typeof message.data === 'string') {
          try {
            const parsedData = JSON.parse(message.data);
            if (parsedData.op) messageOp = parsedData.op;
            if (parsedData.operation) messageOp = parsedData.operation;
            if (parsedData.type) messageOp = parsedData.type;
            if (parsedData.action) messageOp = parsedData.action;
          } catch (e) {
            // Not valid JSON, ignore
          }
        }
      }
      
      console.log(`🔍 DEBUG: Detected message op: ${messageOp || 'unknown'}`);
      
      // Connection requests are handled by ConnectionsManager
      if (messageOp === 'connection_request') {
        console.log('🔍 DEBUG: Detected connection_request message');
        if (!this.connectionsManager) {
          await this.handleConnectionRequest(message);
        } else {
          console.log('ℹ️ ConnectionsManager will handle this message during checkPendingConnections');
        }
        return;
      }
      
      // HANDLE ALL POSSIBLE MESSAGE TYPES
      const isChatMessage = 
        messageOp === 'message' || 
        messageOp === 'chat' || 
        messageOp === 'text' || 
        messageOp === 'direct_message' ||
        (message.text && typeof message.text === 'string');
      
      if (isChatMessage) {
        console.log('🔍 DEBUG: Detected chat message:', JSON.stringify(message, null, 2));
        
        try {
          // Extract connection ID - many formats in the wild
          let connectionId = 
            message.connectionTopicId || 
            message.topic_id || 
            message.conversationTopicId || 
            message.topicId;
            
          // Fallback: try using originTopicId as connectionId if exists
          if (!connectionId && message.originTopicId) {
            connectionId = message.originTopicId;
          }
          
          // Parse message content based on HCS-10 protocol - handle ALL variants
          let textContent = '';
          
          // Direct text field
          if (message.text) {
            textContent = message.text;
          }
          // Message field
          else if (message.message) {
            textContent = message.message;
          }
          // Content field
          else if (message.content) {
            textContent = message.content;
          }
          // Contents field
          else if (message.contents) {
            textContent = message.contents;
          }
          // Data field as string
          else if (typeof message.data === 'string') {
            try {
              // Try parsing as JSON first
              const parsedData = JSON.parse(message.data);
              textContent = parsedData.text || parsedData.message || parsedData.content || parsedData.data;
            } catch (e) {
              // If not valid JSON, use the data as text
              textContent = message.data;
            }
          }
          // Data field as object
          else if (typeof message.data === 'object') {
            textContent = message.data.text || message.data.message || message.data.content || message.data.data;
          }
          
          // If we still don't have a connection ID or text, dump everything to see what we're getting
          if (!connectionId || !textContent) {
            console.error('❌ Missing required data for chat response:');
            console.error(`Connection ID: ${connectionId || 'missing'}`);
            console.error(`Text content: ${textContent || 'missing'}`);
            console.error('Full message:', JSON.stringify(message, null, 2));
            
            // Try one more fallback for connection ID - if we have any active connections
            if (!connectionId) {
              const activeConnections = this.connectionsManager?.getActiveConnections() || [];
              if (activeConnections.length > 0) {
                connectionId = activeConnections[0].connectionTopicId;
                console.log(`ℹ️ Using fallback connection ID: ${connectionId}`);
              }
            }
            
            // Last resort fallback for text content
            if (!textContent) {
              textContent = "I received your message but couldn't parse the content. Could you try again?";
            }
            
            if (!connectionId) {
              console.error('❌ Could not determine connection ID for response, giving up.');
              return;
            }
          }
          
          console.log(`📬 Received message: "${textContent}" on connection: ${connectionId}`);
          
          // Generate response
          let responseText = '';
          const lowerText = typeof textContent === 'string' ? textContent.toLowerCase() : 'hello';
          
          if (lowerText.includes('tell me about yourself') || lowerText.includes('who are you')) {
            responseText = "I am the Lynxify Rebalancer Agent, designed to help manage the Lynx tokenized index. I can assist with rebalancing operations, risk assessments, and tokenized asset management.";
          } 
          else if (lowerText.includes('help') || lowerText.includes('what can you do')) {
            responseText = "I can help with rebalancing token indexes, calculating optimal weights, monitoring price feeds, and executing token operations on the Hedera Token Service.";
          }
          else if (lowerText.includes('hello') || lowerText.includes('hi') || lowerText.includes('hey')) {
            responseText = "Hello! I'm the Lynxify Rebalancer Agent. How can I assist you with your tokenized index today?";
          }
          else {
            responseText = `Thank you for your message: "${textContent}". I am the Lynxify Rebalancer Agent, designed to help with tokenized index operations. How can I assist you further?`;
          }
          
          // Send response according to HCS-10 protocol
          console.log(`🔄 Sending response to ${connectionId}: "${responseText}"`);
          
          // EXACTLY FOLLOWING HCS-10 PROTOCOL
          const response = {
            p: 'hcs-10',
            op: 'message',
            text: responseText,
            timestamp: new Date().toISOString()
          };
          
          // Send directly to the connection topic
          await this.client.sendMessage(connectionId, JSON.stringify(response));
          console.log('✅ Response sent successfully');
        } catch (error) {
          console.error('❌ Error handling chat message:', error);
        }
        return;
      }
      
      // Log any other message types
      console.log(`ℹ️ Received message with unhandled operation type: ${messageOp || 'unknown'}`);
      console.log('Full message:', JSON.stringify(message, null, 2));
      
    } catch (error) {
      console.error('❌ Error processing inbound message:', error);
    }
  }
  
  /**
   * Handle a pending connection request - follows standards-sdk example
   */
  async handlePendingConnectionRequest(pendingRequest) {
    try {
      const requesterId = pendingRequest.targetAccountId;
      let requestId = pendingRequest.connectionRequestId;
      
      console.log(`🔄 Processing pending connection request from ${requesterId}, requestId: ${requestId}`);
      console.log('🔍 DEBUG: Full pending request:', JSON.stringify(pendingRequest, null, 2));
      
      // If the requestId is not available, try to derive it from other sources
      if (!requestId) {
        console.log(`⚠️ PendingRequest is missing connectionRequestId, attempting to extract from request data...`);
        
        // If we have a connection ID in a format like "inb-10:0.0.5949517@0.0.4340026"
        // try to extract parts to form a request ID
        if (pendingRequest.connectionTopicId && pendingRequest.connectionTopicId.includes('@')) {
          const parts = pendingRequest.connectionTopicId.split('@');
          if (parts.length === 2) {
            // Use the sequence number or some default if not available
            requestId = pendingRequest.sequenceNumber || 1;
            console.log(`✅ Derived connectionRequestId: ${requestId}`);
            pendingRequest.connectionRequestId = requestId;
          }
        }
        
        // If we still don't have a requestId, check if there's a connectionId field
        if (!requestId && pendingRequest.connectionId) {
          requestId = pendingRequest.connectionId;
          console.log(`✅ Using connectionId as connectionRequestId: ${requestId}`);
          pendingRequest.connectionRequestId = requestId;
        }
        
        // Last resort - generate a simple numeric ID
        if (!requestId) {
          requestId = Date.now();
          console.log(`⚠️ Using generated timestamp as connectionRequestId: ${requestId}`);
          pendingRequest.connectionRequestId = requestId;
        }
      }
      
      // If API is enabled, don't auto-approve unless in whitelist
      if (ENABLE_APPROVAL_API) {
        // Only auto-approve if explicitly in whitelist
        const shouldAutoApprove = AUTO_APPROVED_ACCOUNTS.includes(requesterId);
        
        console.log(`🔍 DEBUG: Should auto-approve (API enabled): ${shouldAutoApprove}`);
        console.log(`🔍 DEBUG: Requester ID: "${requesterId}"`);
        console.log(`🔍 DEBUG: Whitelist contains: ${AUTO_APPROVED_ACCOUNTS.join(', ')}`);
        
        if (shouldAutoApprove) {
          console.log(`✅ Auto-approving connection from ${requesterId} (in whitelist)`);
          
          // Ensure that both inboundTopicId and connectionId (which is the connectionRequestId) are passed
          if (!this.inboundTopicId) {
            throw new Error('inboundTopicId is required for connection memo');
          }
          if (!connection.connectionRequestId) {
            throw new Error('connectionRequestId is required for connection memo');
          }
          
          const result = await this.client.handleConnectionRequest(
            this.inboundTopicId,
            connection.targetAccountId, 
            connection.connectionRequestId
          );
          
          console.log(`✅ Connection approved:`, result);
          
          // Update connection status
          connection.status = 'established';
          connection.needsConfirmation = false;
          this.connectionsManager.updateOrAddConnection(connection);
          
          // Save for legacy code
          await this.syncConnectionsFromManager();
          await this.saveConnections();
          
          // Send welcome message
          if (result && result.connectionTopicId) {
            await this.sendMessage(
              result.connectionTopicId,
              {
                type: 'welcome',
                message: 'Welcome to Lynxify HCS-10 Agent!',
                timestamp: new Date().toISOString()
              }
            );
          }
          
          // Update status files
          if (ENABLE_APPROVAL_API) {
            await this.updateStatusFile();
            await this.checkPendingConnections();
          }
        } else {
          console.log(`⏳ Connection from ${requesterId} requires manual approval`);
          this.emit('connection_needs_approval', connection);
        }
      } else {
        // If API is not enabled, use the original auto-approval logic
        const shouldAutoApprove = this.shouldAutoApproveConnection(requesterId);
        
        console.log(`🔍 DEBUG: Should auto-approve (API disabled): ${shouldAutoApprove}`);
        
        if (shouldAutoApprove) {
          console.log(`✅ Auto-approving connection from ${requesterId}`);
          
          // Ensure that both inboundTopicId and connectionId (which is the connectionRequestId) are passed
          if (!this.inboundTopicId) {
            throw new Error('inboundTopicId is required for connection memo');
          }
          if (!connection.connectionRequestId) {
            throw new Error('connectionId is required for connection memo');
          }
          
          // KEY CHANGE: Use client.handleConnectionRequest directly
          const result = await this.client.handleConnectionRequest(
            this.inboundTopicId,
            connection.targetAccountId, 
            connection.connectionRequestId
          );
          
          console.log(`✅ Connection approved:`, result);
          
          // Update connection status
          connection.status = 'established';
          connection.needsConfirmation = false;
          this.connectionsManager.updateOrAddConnection(connection);
          
          // Save for legacy code
          await this.syncConnectionsFromManager();
          await this.saveConnections();
          
          // Send welcome message
          if (result && result.connectionTopicId) {
            await this.sendMessage(
              result.connectionTopicId,
              {
                type: 'welcome',
                message: 'Welcome to Lynxify HCS-10 Agent!',
                timestamp: new Date().toISOString()
              }
            );
          }
        } else {
          console.log(`⏳ Connection from ${requesterId} requires manual approval`);
          this.emit('connection_needs_approval', connection);
        }
      }
    } catch (error) {
      console.error(`❌ Error handling pending connection request:`, error);
    }
  }

  /**
   * Send a message to a connection topic
   * @param {string} connectionId The connection topic ID
   * @param {object} messageContent The message content
   */
  async sendMessage(connectionId, messageContent) {
    try {
      console.log(`🔄 Sending message to ${connectionId}:`, JSON.stringify(messageContent, null, 2));
      
      // Format as proper HCS-10 message
      const message = {
        p: 'hcs-10',
        op: 'message',
        text: typeof messageContent === 'string' ? messageContent : JSON.stringify(messageContent),
        timestamp: new Date().toISOString()
      };
      
      // Send directly through client to avoid any issues
      const result = await this.client.sendMessage(connectionId, JSON.stringify(message));
      
      console.log('✅ Message sent successfully:', result);
      return result;
    } catch (error) {
      console.error('❌ Error sending message:', error);
      throw error;
    }
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
    await handler.initialize();
    
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