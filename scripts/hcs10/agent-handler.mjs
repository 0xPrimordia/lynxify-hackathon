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
      console.log('🔍 DEBUG: Connections from manager:', JSON.stringify(connections, null, 2));
      
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
   * Start monitoring inbound topic for messages
   */
  async startMonitoring() {
    if (!this.initialized) {
      await this.initialize();
    }
    
    if (this.monitoring) return;
    
    console.log('👂 Starting to monitor inbound topic for messages...');
    
    // Set up a more frequent polling mechanism - check every 2 seconds instead of 3 or 10
    this.monitorInterval = setInterval(async () => {
      console.log('🔄 Polling for new messages...');
      await this.checkInboundTopic();
      await this.checkPendingConnections();
      await this.updateStatusFile();
    }, 2000); // Check every 2 seconds for better responsiveness
    
    // Do an immediate check
    await this.checkInboundTopic();
    await this.checkPendingConnections();
    await this.updateStatusFile();
    
    this.monitoring = true;
    this.emit('monitoring_started');
    
    console.log('✅ Monitoring started with 2-second intervals for better responsiveness');
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
      if (connectionsList.length > 0) {
        console.log('🔍 Connection topics to check:', connectionsList.map(c => c.connectionTopicId).join(', '));
      }
      
      // More aggressive message checking - try multiple approaches
      
      // 1. First try the standard GetMessageStream approach
      try {
        console.log('🔍 Attempting to get messages using standard getMessageStream...');
        const messages = await this.client.getMessageStream(this.inboundTopicId);
        
        console.log(`🔍 DEBUG: Raw message response type: ${typeof messages}`);
        console.log(`🔍 DEBUG: Raw message count: ${messages?.length || 'undefined'}`);
        
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
          console.log('ℹ️ No new messages found with standard approach');
        }
      } catch (standardError) {
        console.error(`⚠️ Error with standard message retrieval:`, standardError);
      }
      
      // 2. Now check active connections for any new messages (more aggressive approach)
      console.log('🔍 Checking active connections for messages...');
      const activeConnections = this.connectionsManager?.getActiveConnections() || [];
      
      if (activeConnections.length > 0) {
        console.log(`📬 Found ${activeConnections.length} active connections to check for messages`);
        
        // Check a sample of active connections (to avoid overloading)
        const samplesToCheck = Math.min(10, activeConnections.length);
        
        for (let i = 0; i < samplesToCheck; i++) {
          const connection = activeConnections[i];
          
          try {
            console.log(`🔍 Checking for messages on connection ${connection.connectionTopicId}`);
            
            // Try to get messages on this connection topic
            const connectionMessages = await this.client.getMessageStream(connection.connectionTopicId);
            
            if (connectionMessages && connectionMessages.length > 0) {
              console.log(`📬 Found ${connectionMessages.length} messages on connection ${connection.connectionTopicId}`);
              
              // Process each message
              for (const message of connectionMessages) {
                await this.processInboundMessage({
                  ...message,
                  connectionTopicId: connection.connectionTopicId // Ensure we have connection ID
                });
              }
            }
          } catch (connError) {
            console.error(`⚠️ Error checking messages for connection ${connection.connectionTopicId}:`, connError);
          }
        }
      }
      
      // 3. Now check the outbound topic as well (some clients send here by mistake)
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
      
      // Log all connections for debugging
      const allConnections = this.connectionsManager.getAllConnections();
      console.log(`🔍 DEBUG: Total connections in ConnectionsManager: ${allConnections.length}`);
      console.log(`🔍 DEBUG: Connection detail sample:`, 
        allConnections.length > 0 
          ? JSON.stringify(allConnections[0], null, 2) 
          : 'No connections'
      );
      
      // Standard pending requests (isPending = true)
      const pendingRequests = this.connectionsManager.getPendingRequests();
      
      // IMPORTANT: Also check for connections that need confirmation (status = 'needs_confirmation')
      // This is the key fix - we need to handle these connections too
      const needsConfirmationConnections = this.connectionsManager.getConnectionsNeedingConfirmation();
      console.log(`🔍 DEBUG: Connections needing confirmation: ${needsConfirmationConnections.length}`);
      
      // Combine both types for processing
      const allPendingConnections = [...pendingRequests];
      
      // Add needs_confirmation connections if they're not already in the pending list
      for (const conn of needsConfirmationConnections) {
        const alreadyInPending = allPendingConnections.some(p => 
          p.connectionTopicId === conn.connectionTopicId
        );
        
        if (!alreadyInPending) {
          console.log(`🔍 DEBUG: Adding needs_confirmation connection to pending list: ${conn.connectionTopicId}`);
          allPendingConnections.push(conn);
        }
      }
      
      // More detailed logging about pending connections
      console.log(`🔍 DEBUG: ConnectionsManager.getPendingRequests() returned ${pendingRequests.length} connections`);
      console.log(`🔍 DEBUG: Total pending connections (including needs_confirmation): ${allPendingConnections.length}`);
      
      if (pendingRequests.length > 0) {
        console.log('🔍 DEBUG: Pending request sample:', JSON.stringify(pendingRequests[0], null, 2));
      }
      
      if (needsConfirmationConnections.length > 0) {
        console.log('🔍 DEBUG: Needs confirmation sample:', JSON.stringify(needsConfirmationConnections[0], null, 2));
      }
      
      // Log how the pending status is determined
      console.log(`🔍 DEBUG: Raw connections data with status and isPending flags:`);
      allConnections.forEach(conn => {
        console.log(` Connection ${conn.connectionTopicId || 'unknown'}: status=${conn.status}, isPending=${!!conn.isPending}, needsConfirmation=${!!conn.needsConfirmation}`);
      });
      
      // Log the active connections for comparison
      const activeConnections = this.connectionsManager.getActiveConnections();
      console.log(`🔍 DEBUG: ConnectionsManager.getActiveConnections() returned ${activeConnections.length} connections`);
      if (activeConnections.length > 0) {
        console.log('🔍 DEBUG: Active connection sample:', JSON.stringify(activeConnections[0], null, 2));
      }
      
      // Continue with processing all pending connections including those needing confirmation
      console.log(`{ module: 'ConnectionsManager' } Total connections in map: ${allConnections.length}`);
      console.log(`{ module: 'ConnectionsManager' } Standard pending connections: ${pendingRequests.length}`);
      console.log(`{ module: 'ConnectionsManager' } Connections needing confirmation: ${needsConfirmationConnections.length}`);
      console.log(`{ module: 'ConnectionsManager' } Total pending to process: ${allPendingConnections.length}`);
      
      // Process all pending connections, including those needing confirmation
      if (allPendingConnections.length > 0) {
        console.log(`{ module: 'ConnectionsManager' } Processing ${allPendingConnections.length} pending connections`);
        
        // Process each pending connection
        for (const conn of allPendingConnections) {
          console.log(`🔍 DEBUG: Processing connection: ${conn.connectionTopicId}, status=${conn.status}`);
          
          // Important: Process connections with different handling based on status
          if (conn.status === 'needs_confirmation') {
            // This is the key part from the example - handle needs_confirmation connections
            console.log(`🔄 Processing connection needing confirmation: ${conn.connectionTopicId}`);
            await this.handleNeedsConfirmationRequest(conn);
          } else if (conn.isPending) {
            // Normal pending connection handling
            console.log(`🔄 Processing standard pending connection: ${conn.connectionTopicId}`);
            await this.handlePendingConnectionRequest(conn);
          }
        }
        
        // Write all pending connections to file for API
        console.log(`ℹ️ Writing ${allPendingConnections.length} pending connection requests to file`);
        await fs.writeFile(PENDING_CONNECTIONS_FILE, JSON.stringify(allPendingConnections, null, 2));
      } else {
        console.log(`{ module: 'ConnectionsManager' } No pending connections found`);
        console.log(`ℹ️ No pending connection requests, clearing file`);
        await fs.writeFile(PENDING_CONNECTIONS_FILE, JSON.stringify([], null, 2));
      }
      
      // Check if there's a command to approve a connection
      await this.checkApprovalCommands();
      
    } catch (error) {
      console.error('❌ Error checking pending connections:', error);
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
      
      // Connection requests are handled by ConnectionsManager
      if (message.op === 'connection_request') {
        console.log('🔍 DEBUG: Detected connection_request message');
        if (!this.connectionsManager) {
          await this.handleConnectionRequest(message);
        } else {
          console.log('ℹ️ ConnectionsManager will handle this message during checkPendingConnections');
        }
        return;
      }
      
      // DIRECT FROM STANDARDS DOCS - HANDLE CHAT MESSAGE
      // Look for standard chat/message operations
      if (message.op === 'message' || message.op === 'chat') {
        console.log('🔍 DEBUG: Detected chat message:', JSON.stringify(message, null, 2));
        
        try {
          // Extract required data following the HCS-10 protocol
          const connectionId = message.connectionTopicId || message.topic_id;
          
          // Parse message content based on HCS-10 protocol
          let textContent = '';
          if (typeof message.data === 'string') {
            try {
              // Try parsing as JSON first
              const parsedData = JSON.parse(message.data);
              textContent = parsedData.text || parsedData.message || parsedData.content || parsedData.data;
            } catch (e) {
              // If not valid JSON, use the data as text
              textContent = message.data;
            }
          } else if (typeof message.data === 'object') {
            textContent = message.data.text || message.data.message || message.data.content || message.data.data;
          } else if (message.text) {
            textContent = message.text;
          }
          
          // Extra handlers for direct message content - this is missing in some cases
          if (!textContent && message.contents) {
            textContent = message.contents;
          }
          
          if (!connectionId || !textContent) {
            console.error('❌ Missing required data for chat response:');
            console.error(`Connection ID: ${connectionId || 'missing'}`);
            console.error(`Text content: ${textContent || 'missing'}`);
            console.error('Full message:', JSON.stringify(message, null, 2));
            return;
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
      console.log(`ℹ️ Received message with unhandled operation type: ${message.op || 'unknown'}`);
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