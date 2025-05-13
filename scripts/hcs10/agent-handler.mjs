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
    this.connections = new Map(); // connection ID -> connection details
    this.connectionsManager = null; // ConnectionsManager instance
    this.initialized = false;
    this.monitoring = false;
    this.monitorInterval = null;
    this.commandCheckInterval = null;
    this.lastCheckedConnectionIndex = null;
    this.messageCount = 0; // Track number of messages processed
  }

  /**
   * Initialize with proper ConnectionsManager setup to prevent duplicate connections
   */
  async initialize(agentKey, agentId, inboundTopicId, outboundTopicId) {
    try {
      console.log(`🔄 Initializing agent handler with: ${agentId}, ${inboundTopicId}, ${outboundTopicId}`);
      
      this.agentId = agentId;
      this.inboundTopicId = inboundTopicId;
      this.outboundTopicId = outboundTopicId;
      this.agentKey = agentKey;
      
      // Validate private key before creating client
      if (!this.agentKey) {
        throw new Error('Missing operator key. Check your OPERATOR_KEY environment variable.');
      }
      
      // Log the first few characters to verify it's present (never log entire private key)
      console.log(`🔑 Using private key starting with: ${this.agentKey.substring(0, 4)}...`);
      
      try {
        // Create HCS10 client with proper configuration
        console.log('🔄 Creating HCS10 client...');
        
        // The key seems to be in DER format already from the environment, so we'll
        // use it directly without additional formatting
        const clientConfig = {
          network: 'testnet',
          operatorId: this.agentId,
          operatorKey: this.agentKey,
          mirrorNode: process.env.MIRROR_NODE_URL || 'https://testnet.mirrornode.hedera.com',
          useEncryption: false
        };
        
        console.log('🔍 Client configuration:', JSON.stringify({
          ...clientConfig,
          operatorKey: '***REDACTED***' // Don't log the actual key
        }, null, 2));
        
        this.client = new HCS10Client(clientConfig);
        console.log('✅ HCS10 client created successfully');
      } catch (clientError) {
        console.error('❌ Error creating HCS10 client:', clientError);
        
        // Try an alternative approach if there was an issue with the key
        console.log('🔄 Attempting alternative client initialization...');
        
        // Some SDKs expect different key formats, try with explicit configuration
        this.client = new HCS10Client({
          network: 'testnet',
          operatorId: this.agentId,
          // Pass just the key string without additional formatting
          operatorKey: this.agentKey.trim(),
          mirrorNode: process.env.MIRROR_NODE_URL || 'https://testnet.mirrornode.hedera.com',
          useEncryption: false
        });
        
        console.log('✅ HCS10 client created successfully using alternative method');
      }
      
      // Initialize ConnectionsManager properly
      console.log('🔄 Initializing ConnectionsManager...');
      this.connectionsManager = new ConnectionsManager({
        client: this.client,
        logLevel: 'info',
        prettyPrint: true
      });
      
      console.log('✅ ConnectionsManager initialized');
      
      // Set agent info required for proper connection management
      console.log('🔄 Setting agent info in ConnectionsManager...');
      await this.connectionsManager.setAgentInfo({
        accountId: this.agentId,
        inboundTopicId: this.inboundTopicId,
        outboundTopicId: this.outboundTopicId
      });
      console.log('✅ Agent info set in ConnectionsManager');
      
      // Fetch connection data to load existing connections
      console.log('🔄 Fetching connections from Hedera...');
      await this.connectionsManager.fetchConnectionData(this.agentId);
      
      // Initialize connections map for backward compatibility
      this.connections = new Map();
      this.syncConnectionsFromManager();
      
      // CRITICAL: Auto approve whitelisted accounts
      console.log('🔍 DEBUG: Auto approved accounts:', AUTO_APPROVED_ACCOUNTS);
      console.log('🔍 DEBUG: Connection approval API enabled:', ENABLE_APPROVAL_API);
      
      // Print info about loaded connection data
      this.logConnectionStats();
      
      // Save status for API
      this.initialized = true;
      await this.updateStatusFile();
      
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
      
      // CHANGED: Reduced polling interval to be more responsive to chat
      const pollingIntervalMs = 10000; // 10 seconds for much faster response
      console.log(`🔄 Starting message polling with ${pollingIntervalMs/1000}s interval...`);
      
      // CHANGED: Check immediately on startup to be responsive
      console.log('🔍 Checking for messages immediately on startup...');
      await this.checkInboundTopic();
      
      // Set up regular polling with a shorter interval
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
        
        // Check pending connections immediately
        await this.checkPendingConnections();
        
        // Set up interval for checking pending connections - more frequent
        setInterval(async () => {
          await this.checkPendingConnections();
        }, 30000); // Check every 30 seconds
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
      
      // Get current connection counts for debugging
      const activeConnections = this.connectionsManager?.getActiveConnections() || [];
      const pendingRequests = this.connectionsManager?.getPendingRequests() || [];
      const needsConfirmation = this.connectionsManager?.getConnectionsNeedingConfirmation() || [];
      
      console.log(`🔍 Connection stats: ${activeConnections.length} active, ${pendingRequests.length} pending, ${needsConfirmation.length} need confirmation`);
      
      // Send debug info message every 5 checks
      if (this.messageCount % 5 === 0) {
        await this.sendDebugMessage();
      }
      
      // Get messages from inbound topic
      try {
        console.log('🔄 Fetching messages from inbound topic...');
        const messages = await this.client.getMessageStream(this.inboundTopicId);
        
        if (messages && messages.length > 0) {
          console.log(`📬 Found ${messages.length} messages on inbound topic`);
          
          // *** CRITICAL STEP *** 
          // Process ALL messages through ConnectionsManager first
          // This ensures proper protocol-compliant handling of connection messages
          if (this.connectionsManager) {
            console.log('🔄 Processing messages with ConnectionsManager...');
            await this.connectionsManager.processInboundMessages(messages);
            
            // After ConnectionsManager processes messages, handle any pending connections
            await this.processPendingConnections();
          }
          
          // For other message types, process individually
          for (const message of messages) {
            // We still want this for any application-level logic
            await this.processInboundMessage(message);
          }
        } else {
          console.log('ℹ️ No new messages found on inbound topic');
        }
      } catch (error) {
        console.error(`⚠️ Error retrieving messages from inbound topic:`, error);
      }
      
      // Update status and sync connections from manager
      await this.updateStatusFile();
      this.syncConnectionsFromManager();
      await this.saveConnections();
      
      // Update lastActivityTime
      this.lastActivityTime = Date.now();
    } catch (error) {
      console.error('❌ Error checking inbound topic:', error);
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
            await this.handleNeedsConfirmation(conn);
          } else if (conn.isPending) {
            await this.handlePendingRequest(conn);
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
  async handleNeedsConfirmation(connection) {
    try {
      console.log(`🔄 Processing connection needing confirmation from ${connection.targetAccountId}`);
      
      // Skip if we're using API and this account is not auto-approved
      if (ENABLE_APPROVAL_API && !AUTO_APPROVED_ACCOUNTS.includes(connection.targetAccountId)) {
        console.log(`⏳ Connection from ${connection.targetAccountId} requires manual approval via API`);
        return;
      }
      
      console.log(`✅ Approving connection from ${connection.targetAccountId}`);
      
      // Properly handle the connection request using requestId
      const result = await this.client.handleConnectionRequest(
        this.inboundTopicId,
        connection.targetAccountId,
        connection.connectionRequestId
      );
      
      console.log(`✅ Connection established: ${result.connectionTopicId}`);
      
      // Update connection in ConnectionsManager
      connection.status = 'established';
      connection.needsConfirmation = false;
      this.connectionsManager.updateOrAddConnection(connection);
      
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
    } catch (error) {
      console.error(`❌ Error handling connection needing confirmation:`, error);
    }
  }
  
  /**
   * Handle pending connection request
   */
  async handlePendingRequest(connection) {
    try {
      console.log(`🔄 Processing pending connection request from ${connection.targetAccountId}`);
      
      // Skip if we're using API and this account is not auto-approved
      if (ENABLE_APPROVAL_API && !AUTO_APPROVED_ACCOUNTS.includes(connection.targetAccountId)) {
        console.log(`⏳ Connection from ${connection.targetAccountId} requires manual approval via API`);
        return;
      }
      
      console.log(`✅ Approving connection from ${connection.targetAccountId}`);
      
      // Properly handle the connection request using requestId
      const result = await this.client.handleConnectionRequest(
        this.inboundTopicId,
        connection.targetAccountId,
        connection.connectionRequestId
      );
      
      console.log(`✅ Connection established: ${result.connectionTopicId}`);
      
      // Update connection in ConnectionsManager
      connection.status = 'established';
      connection.isPending = false;
      this.connectionsManager.updateOrAddConnection(connection);
      
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
    } catch (error) {
      console.error(`❌ Error handling pending connection request:`, error);
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
   * Get the current agent status for the API
   */
  getStatus() {
    try {
      const activeConnections = this.connectionsManager?.getActiveConnections() || [];
      const pendingConnections = this.connectionsManager?.getPendingRequests() || [];
      const needsConfirmation = this.connectionsManager?.getConnectionsNeedingConfirmation() || [];
      
      return {
        status: 'running',
        timestamp: new Date().toISOString(),
        agent_id: this.agentId,
        inbound_topic: this.inboundTopicId,
        outbound_topic: this.outboundTopicId,
        connections: {
          active: activeConnections.length,
          pending: pendingConnections.length,
          needs_confirmation: needsConfirmation.length,
          total: this.connections.size
        },
        message_stats: {
          count: this.messageCount,
          last_check: new Date().toISOString()
        }
      };
    } catch (error) {
      console.error('❌ Error getting agent status:', error);
      return {
        status: 'error',
        timestamp: new Date().toISOString(),
        error: error.message
      };
    }
  }
  
  /**
   * Update the pending connections file for the API
   */
  async updatePendingConnectionsFile() {
    if (!ENABLE_APPROVAL_API) return;
    
    try {
      // Get pending connections
      const pendingRequests = this.connectionsManager?.getPendingRequests() || [];
      const needsConfirmation = this.connectionsManager?.getConnectionsNeedingConfirmation() || [];
      
      // Combine and format for API
      const pendingConnections = [...pendingRequests, ...needsConfirmation].map(conn => ({
        id: conn.connectionTopicId,
        requester_id: conn.targetAccountId,
        status: conn.status || (conn.isPending ? 'pending' : 'needs_confirmation'),
        timestamp: conn.created ? conn.created.toISOString() : new Date().toISOString()
      }));
      
      // Write to file
      await fs.writeFile(PENDING_CONNECTIONS_FILE, JSON.stringify(pendingConnections, null, 2));
      
      console.log(`✅ Updated pending connections file with ${pendingConnections.length} connections`);
    } catch (error) {
      console.error('❌ Error updating pending connections file:', error);
    }
  }
  
  /**
   * Process a message from inbound topic
   */
  async processInboundMessage(message) {
    try {
      if (!message) return;
      
      this.messageCount++;
      this.lastActivityTime = Date.now();
      
      // Log basic message info
      console.log(`📩 Message received: ${message.sequence_number}`);
      
      // Skip if we've already processed connection-related messages via ConnectionsManager
      if (this.isConnectionMessage(message)) {
        console.log('ℹ️ Skipping connection message (already handled by ConnectionsManager)');
        return;
      }
      
      // Process as chat message if on a connection topic
      if (this.isStandardMessage(message)) {
        await this.processChatMessage(message);
      }
    } catch (error) {
      console.error('❌ Error processing inbound message:', error);
    }
  }
  
  /**
   * Check if a message is a connection-related message
   * @param {Object} message The message to check
   * @returns {boolean} True if connection-related
   */
  isConnectionMessage(message) {
    const op = message.op || '';
    return op.startsWith('connection_') || 
           op === 'init_connection' || 
           op === 'close_connection';
  }
  
  /**
   * Check if a message is a standard chat message
   * @param {Object} message The message to check
   * @returns {boolean} True if standard message
   */
  isStandardMessage(message) {
    const op = message.op || '';
    return op === 'message' || op === '';
  }
  
  /**
   * Process a chat message
   * @param {Object} message The message to process
   */
  async processChatMessage(message) {
    try {
      // Extract content from the message
      const content = this.extractMessageContent(message);
      if (!content) {
        console.log('⚠️ No content found in message:', message);
        return;
      }
      
      console.log(`📝 Extracted message content: "${content}"`);
      
      // Get connection topic ID for sending response
      const connectionTopicId = message.origin_topic_id || message.connectionTopicId;
      if (!connectionTopicId) {
        console.log('⚠️ No connection topic ID found for message:', message);
        return;
      }
      
      // Generate response
      const responseText = await this.generateResponse(content);
      
      // Send response
      await this.sendChatResponse(connectionTopicId, responseText);
      
    } catch (error) {
      console.error('❌ Error processing chat message:', error);
    }
  }
  
  /**
   * Extract content from a message
   * @param {Object} message The message
   * @returns {string} The extracted content
   */
  extractMessageContent(message) {
    // If message has a text field
    if (message.text) {
      return message.text;
    }
    
    // If message has a data field as string
    if (typeof message.data === 'string') {
      try {
        // Try parsing as JSON
        const parsedData = JSON.parse(message.data);
        return parsedData.text || parsedData.message || parsedData.content || parsedData;
      } catch (e) {
        // If not valid JSON, use the data directly
        return message.data;
      }
    }
    
    // If data is an object
    if (typeof message.data === 'object' && message.data !== null) {
      return message.data.text || message.data.message || message.data.content || JSON.stringify(message.data);
    }
    
    return null;
  }
  
  /**
   * Generate a response to a message
   * @param {string} content The message content
   * @returns {string} The response text
   */
  async generateResponse(content) {
    // Simple response generation based on content
    const lowerContent = content.toLowerCase();
    
    if (lowerContent.includes('hello') || lowerContent.includes('hi')) {
      return "Hello! I'm the Lynxify agent. How can I assist you with the tokenized index today?";
    }
    
    if (lowerContent.includes('help') || lowerContent.includes('what can you do')) {
      return "I can help with the Lynxify tokenized index, including rebalancing operations, price information, and token management. What would you like to know?";
    }
    
    if (lowerContent.includes('about') || lowerContent.includes('who are you')) {
      return "I am the Lynxify Agent, designed to help manage the Lynx tokenized index. I can provide information and assist with token operations.";
    }
    
    if (lowerContent.includes('rebalance') || lowerContent.includes('tokens') || lowerContent.includes('index')) {
      return "The Lynxify index is a tokenized basket of digital assets, managed through automated rebalancing. Would you like to know more about the current composition or rebalancing process?";
    }
    
    // Default response
    return `Thank you for your message. I've received: "${content}". How can I assist you with the Lynxify tokenized index?`;
  }
  
  /**
   * Send a chat response message
   * @param {string} connectionTopicId The connection topic ID
   * @param {string} text The response text
   */
  async sendChatResponse(connectionTopicId, text) {
    try {
      console.log(`🔄 Sending chat response to ${connectionTopicId}: "${text}"`);
      
      // Format as proper HCS-10 message
      const message = {
        p: 'hcs-10',
        op: 'message',
        text: text,
        timestamp: new Date().toISOString()
      };
      
      // Send to the connection topic
      await this.client.sendMessage(connectionTopicId, JSON.stringify(message));
      
      console.log('✅ Chat response sent successfully');
    } catch (error) {
      console.error('❌ Error sending chat response:', error);
    }
  }
  
  /**
   * Process pending connections using ConnectionsManager
   * This is critical to avoid duplicate connections
   */
  async processPendingConnections() {
    if (!this.connectionsManager) return;
    
    try {
      // Fetch fresh connection data
      await this.connectionsManager.fetchConnectionData(this.agentId);
      
      // Get connections needing confirmation
      const needsConfirmation = this.connectionsManager.getConnectionsNeedingConfirmation();
      console.log(`🔄 Found ${needsConfirmation.length} connections needing confirmation`);
      
      // Handle each connection needing confirmation
      for (const connection of needsConfirmation) {
        await this.handleNeedsConfirmation(connection);
      }
      
      // Get pending requests
      const pendingRequests = this.connectionsManager.getPendingRequests();
      console.log(`🔄 Found ${pendingRequests.length} pending connection requests`);
      
      // Handle each pending request
      for (const connection of pendingRequests) {
        await this.handlePendingRequest(connection);
      }
      
      // After processing, sync connections
      this.syncConnectionsFromManager();
      await this.saveConnections();
      await this.updateStatusFile();
    } catch (error) {
      console.error('❌ Error processing pending connections:', error);
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

  /**
   * Send a debug message to the outbound topic
   * This is useful for debugging when connections aren't working
   */
  async sendDebugMessage() {
    try {
      if (!this.outboundTopicId || !this.client) {
        console.log('⚠️ Cannot send debug message - outbound topic or client not initialized');
        return;
      }

      // Get connection information
      const activeConnections = this.connectionsManager?.getActiveConnections() || [];
      const pendingConnections = this.connectionsManager?.getPendingRequests() || [];
      const needsConfirmation = this.connectionsManager?.getConnectionsNeedingConfirmation() || [];

      // Create debug message
      const debugMessage = {
        p: 'hcs-10',
        op: 'debug_info',
        agent_id: this.agentId,
        timestamp: new Date().toISOString(),
        connections: {
          active: activeConnections.length,
          pending: pendingConnections.length, 
          needs_confirmation: needsConfirmation.length,
          total: this.connections.size
        },
        active_connection_ids: activeConnections.map(c => c.connectionTopicId),
        message_stats: {
          count: this.messageCount,
          last_check: new Date().toISOString()
        }
      };

      console.log('🔍 Sending debug message to outbound topic:', JSON.stringify(debugMessage, null, 2));
      
      // Send to outbound topic
      const result = await this.client.sendMessage(this.outboundTopicId, JSON.stringify(debugMessage));
      console.log('✅ Debug message sent successfully:', result);
      
      return result;
    } catch (error) {
      console.error('❌ Error sending debug message:', error);
    }
  }

  /**
   * Log connection statistics
   */
  logConnectionStats() {
    if (!this.connectionsManager) return;
    
    try {
      const allConnections = this.connectionsManager.getAllConnections();
      const active = this.connectionsManager.getActiveConnections();
      const pending = this.connectionsManager.getPendingRequests();
      const needsConfirmation = this.connectionsManager.getConnectionsNeedingConfirmation();
      
      console.log('=============== CONNECTION STATS ===============');
      console.log(`Total connections: ${allConnections.length}`);
      console.log(`Active connections: ${active.length}`);
      console.log(`Pending requests: ${pending.length}`);
      console.log(`Needs confirmation: ${needsConfirmation.length}`);
      console.log('===============================================');
    } catch (error) {
      console.error('❌ Error logging connection stats:', error);
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