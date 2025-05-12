import { EventBus, EventType } from '../utils/event-emitter';
import { SharedHederaService } from './shared-hedera-service';
import { HCSMessage } from '../types/hcs';
import { v4 as uuidv4 } from 'uuid';

/**
 * Configuration for the HCS10 Protocol Service
 */
export interface HCS10ProtocolConfig {
  agentId: string;
  registryTopicId: string;
  agentTopicId?: string;
  capabilities?: string[];
  description?: string;
  reregistrationIntervalMs?: number;
  discoveryIntervalMs?: number;
}

// Agent status in the registry
export enum RegistrationStatus {
  UNKNOWN = 'unknown',
  PENDING = 'pending',
  REGISTERED = 'registered',
  VERIFIED = 'verified',
  FAILED = 'failed'
}

// Agent information structure
export interface AgentInfo {
  agentId: string;
  topicId: string;
  capabilities: string[];
  lastSeen: number;
  description?: string;
  status: RegistrationStatus;
  registrationTimestamp?: number;
  verificationTimestamp?: number;
}

/**
 * Message structure for HCS-10 protocol
 */
export interface HCS10Message {
  id: string;
  timestamp: number;
  type: 'AgentInfo' | 'AgentRequest' | 'AgentResponse' | 'AgentVerification' | 'AgentDiscovery'; 
  sender: string;
  recipient?: string;
  originalMessageId?: string;
  contents: any;
}

// Message tracking interfaces
export interface PendingRequest {
  id: string;
  recipientId: string;
  timestamp: number;
  contents: any;
  status: 'pending' | 'delivered' | 'responded' | 'timeout' | 'error';
  response?: any;
  responseTimestamp?: number;
  error?: Error;
  retryCount: number;
  maxRetries: number;
  timeoutMs: number;
  timeoutId?: NodeJS.Timeout;
}

/**
 * Service that handles all aspects of the HCS-10 protocol
 */
export class HCS10ProtocolService {
  private readonly eventBus: EventBus;
  private readonly hederaService: SharedHederaService;
  private readonly config: HCS10ProtocolConfig;
  
  private agentTopicId: string | null = null;
  private knownAgents: Map<string, AgentInfo> = new Map();
  
  // Message tracking
  private pendingRequests: Map<string, PendingRequest> = new Map();
  private responseListeners: Map<string, ((response: any) => void)[]> = new Map();
  
  private initialized: boolean = false;
  private registrationStatus: RegistrationStatus = RegistrationStatus.UNKNOWN;
  private registrationTimestamp: number | null = null;
  private verificationTimestamp: number | null = null;
  
  private reregistrationInterval: NodeJS.Timeout | null = null;
  private discoveryInterval: NodeJS.Timeout | null = null;
  
  private lastRegistryUpdate: number = 0;
  
  /**
   * Create a new HCS10ProtocolService
   */
  constructor(
    hederaService: SharedHederaService,
    config: HCS10ProtocolConfig,
    testingMode: boolean = false
  ) {
    this.hederaService = hederaService;
    this.config = {
      ...config,
      reregistrationIntervalMs: config.reregistrationIntervalMs || 3600000, // Default 1 hour
      discoveryIntervalMs: config.discoveryIntervalMs || 300000 // Default 5 minutes
    };
    this.eventBus = EventBus.getInstance();
    
    // Store agent's topic ID if provided
    if (config.agentTopicId) {
      this.agentTopicId = config.agentTopicId;
    }
    
    if (!testingMode) {
      this.setupEventHandlers();
    }
  }
  
  /**
   * Set up event handlers for the service
   */
  private setupEventHandlers(): void {
    // Listen for message received events that may contain HCS10 protocol messages
    this.eventBus.onEvent(EventType.MESSAGE_RECEIVED, (data) => {
      if (data.topicId === this.config.registryTopicId) {
        this.processRegistryMessage(data);
      } else if (data.topicId === this.agentTopicId) {
        this.processAgentMessage(data);
      }
    });
    
    // Listen for system shutdown
    this.eventBus.onEvent(EventType.SYSTEM_SHUTDOWN, () => {
      this.clearIntervals();
    });
  }
  
  /**
   * Process messages from the registry topic
   */
  private processRegistryMessage(data: any): void {
    try {
      const message = data.contents;
      
      // Validate message format
      if (!this.isValidHCS10Message(message)) {
        console.warn('⚠️ Invalid HCS10 message format:', message);
        return;
      }
      
      // Handle message based on type
      switch(message.type) {
        case 'AgentInfo':
          this.handleAgentInfoMessage(message);
          break;
        case 'AgentVerification':
          this.handleAgentVerificationMessage(message);
          break;
        case 'AgentDiscovery':
          this.handleAgentDiscoveryMessage(message);
          break;
      }
    } catch (error) {
      console.error('❌ Error processing registry message:', error);
    }
  }
  
  /**
   * Handle AgentInfo messages
   */
  private handleAgentInfoMessage(message: HCS10Message): void {
    // Ignore our own messages
    if (message.sender === this.config.agentId) {
      // If we received our own registration message, mark as registered
      if (this.registrationStatus === RegistrationStatus.PENDING) {
        this.registrationStatus = RegistrationStatus.REGISTERED;
        this.registrationTimestamp = Date.now();
        
        console.log(`✅ Agent ${this.config.agentId} registration confirmed`);
        
        // Emit registered event
        this.eventBus.emitEvent(EventType.HCS10_AGENT_REGISTERED, {
          agentId: this.config.agentId,
          registryTopicId: this.config.registryTopicId
        });
        
        // Verify the agent registration
        this.verifyAgentRegistration();
      }
      return;
    }
    
    // Store or update agent information
    this.updateAgentRegistry(message.sender, {
      agentId: message.sender,
      topicId: message.contents.topicId,
      capabilities: message.contents.capabilities || [],
      lastSeen: Date.now(),
      description: message.contents.description,
      status: RegistrationStatus.REGISTERED
    });
    
    console.log(`📋 Agent registered: ${message.sender} with ${message.contents.capabilities?.length || 0} capabilities`);
  }
  
  /**
   * Handle AgentVerification messages
   */
  private handleAgentVerificationMessage(message: HCS10Message): void {
    // Ignore messages not intended for us
    if (message.recipient !== this.config.agentId) {
      return;
    }
    
    console.log(`🔍 Received verification from ${message.sender}`);
    
    // If we're in the REGISTERED state, move to VERIFIED
    if (this.registrationStatus === RegistrationStatus.REGISTERED) {
      this.registrationStatus = RegistrationStatus.VERIFIED;
      this.verificationTimestamp = Date.now();
      
      // Emit verified event
      this.eventBus.emitEvent(EventType.HCS10_AGENT_CONNECTED, {
        agentId: this.config.agentId,
        capabilities: this.config.capabilities || []
      });
      
      console.log(`✅ Agent ${this.config.agentId} is now verified`);
    }
    
    // Mark the verifying agent as connected
    const agent = this.knownAgents.get(message.sender);
    if (agent) {
      agent.status = RegistrationStatus.VERIFIED;
      agent.verificationTimestamp = Date.now();
      this.knownAgents.set(message.sender, agent);
      
      // Respond with our own verification to establish bidirectional connection
      this.sendVerification(message.sender);
    }
  }
  
  /**
   * Handle AgentDiscovery messages
   */
  private handleAgentDiscoveryMessage(message: HCS10Message): void {
    // If this is a discovery request to all agents, respond with our info
    if (!message.recipient || message.recipient === this.config.agentId) {
      console.log(`🔍 Responding to discovery request from ${message.sender}`);
      
      // Send our agent info
      this.sendAgentInfo(false);
      
      // If we don't know this agent yet, send a verification message
      if (!this.knownAgents.has(message.sender) && message.contents.topicId) {
        // Add agent to registry
        this.updateAgentRegistry(message.sender, {
          agentId: message.sender,
          topicId: message.contents.topicId,
          capabilities: message.contents.capabilities || [],
          lastSeen: Date.now(),
          description: message.contents.description,
          status: RegistrationStatus.REGISTERED
        });
        
        // Send verification
        this.sendVerification(message.sender);
      }
    }
  }
  
  /**
   * Send a verification message to another agent
   */
  private async sendVerification(recipientId: string): Promise<void> {
    const agent = this.knownAgents.get(recipientId);
    if (!agent || !agent.topicId) {
      console.warn(`⚠️ Cannot verify agent ${recipientId} - no topic ID found`);
      return;
    }
    
    try {
      console.log(`🔍 Sending verification to agent ${recipientId}`);
      
      const verificationMessage: HCS10Message = {
        id: uuidv4(),
        timestamp: Date.now(),
        type: 'AgentVerification',
        sender: this.config.agentId,
        recipient: recipientId,
        contents: {
          agentId: this.config.agentId,
          topicId: this.agentTopicId,
          capabilities: this.config.capabilities || [],
          verificationTimestamp: Date.now()
        }
      };
      
      // Send to the registry so other agents can see the verification
      await this.hederaService.sendMessage(
        this.config.registryTopicId,
        JSON.stringify(verificationMessage)
      );
      
      console.log(`✅ Verification sent to ${recipientId}`);
    } catch (error) {
      console.error(`❌ Failed to send verification to ${recipientId}:`, error);
    }
  }
  
  /**
   * Process messages sent to this agent's topic
   */
  private processAgentMessage(data: any): void {
    try {
      const message = data.contents;
      
      // Validate that this is a proper HCS10 message
      if (!this.isValidHCS10Message(message)) {
        console.warn('⚠️ Invalid message format received on agent topic:', message);
        return;
      }
      
      // Handle agent requests
      if (message.type === 'AgentRequest' && message.recipient === this.config.agentId) {
        console.log(`📩 Received request from ${message.sender} (ID: ${message.id})`);
        
        // Emit request received event for the application to handle
        this.eventBus.emitEvent(EventType.HCS10_REQUEST_RECEIVED, {
          requestId: message.id,
          senderId: message.sender,
          request: message.contents
        });
      }
      
      // Handle agent responses to our requests
      if (message.type === 'AgentResponse' && message.recipient === this.config.agentId && message.originalMessageId) {
        console.log(`📩 Received response from ${message.sender} for request ${message.originalMessageId}`);
        
        // Look up the original request
        const pendingRequest = this.pendingRequests.get(message.originalMessageId);
        
        if (pendingRequest) {
          // Update request status
          pendingRequest.status = 'responded';
          pendingRequest.response = message.contents;
          pendingRequest.responseTimestamp = Date.now();
          
          // Clear any timeout
          if (pendingRequest.timeoutId) {
            clearTimeout(pendingRequest.timeoutId);
          }
          
          // Update the stored request
          this.pendingRequests.set(message.originalMessageId, pendingRequest);
          
          // Notify response listeners
          this.notifyResponseListeners(message.originalMessageId, message.contents);
          
          // Emit response received event
          this.eventBus.emitEvent(EventType.HCS10_RESPONSE_RECEIVED, {
            requestId: message.originalMessageId,
            senderId: message.sender,
            response: message.contents
          });
        } else {
          console.warn(`⚠️ Received response for unknown request: ${message.originalMessageId}`);
        }
      }
    } catch (error) {
      console.error('❌ Error processing agent message:', error);
    }
  }
  
  /**
   * Update the agent registry with new information
   */
  private updateAgentRegistry(agentId: string, agentInfo: AgentInfo): void {
    // Get existing data if any
    const existingInfo = this.knownAgents.get(agentId);
    
    // Merge with existing data
    const updatedInfo: AgentInfo = {
      ...existingInfo,
      ...agentInfo,
      lastSeen: Date.now()
    };
    
    // Store updated info
    this.knownAgents.set(agentId, updatedInfo);
    
    // If this is a new agent, emit an event
    if (!existingInfo) {
      this.eventBus.emitEvent(EventType.HCS10_AGENT_CONNECTED, {
        agentId: agentInfo.agentId,
        capabilities: agentInfo.capabilities
      });
    }
  }
  
  /**
   * Validate that a message follows the HCS10 protocol format
   */
  private isValidHCS10Message(message: any): boolean {
    return (
      message &&
      typeof message === 'object' &&
      typeof message.id === 'string' &&
      typeof message.type === 'string' &&
      typeof message.sender === 'string' &&
      typeof message.timestamp === 'number' &&
      (message.type === 'AgentInfo' || 
       message.type === 'AgentRequest' || 
       message.type === 'AgentResponse' ||
       message.type === 'AgentVerification' ||
       message.type === 'AgentDiscovery')
    );
  }
  
  /**
   * Initialize the HCS10 Protocol Service
   */
  public async initialize(): Promise<void> {
    if (this.initialized) {
      return;
    }
    
    try {
      console.log('🔄 Initializing HCS10ProtocolService...');
      
      // Create agent topic if not provided
      if (!this.agentTopicId) {
        this.agentTopicId = await this.createAgentTopic();
      }
      
      // Register with the network
      await this.registerAgent();
      
      // Only set up intervals if not in test environment
      if (!process.env.NODE_ENV || process.env.NODE_ENV !== 'test') {
        // Schedule periodic re-registration
        this.scheduleRegistryUpdates();
        
        // Schedule periodic agent discovery
        this.scheduleAgentDiscovery();
        
        // Schedule periodic cleanup of pending requests
        this.schedulePendingRequestCleanup();
      } else {
        console.log('🧪 Running in test environment - disabling periodic timers');
        // For tests, we'll handle these operations explicitly
        this.disablePeriodicTimers();
      }
      
      this.initialized = true;
      console.log('✅ HCS10ProtocolService initialized successfully');
    } catch (error) {
      console.error('❌ Failed to initialize HCS10ProtocolService:', error);
      throw error;
    }
  }
  
  /**
   * Create a dedicated topic for this agent
   */
  private async createAgentTopic(): Promise<string> {
    try {
      console.log('🔄 Creating agent topic...');
      
      const memo = `HCS10 compliant agent topic for ${this.config.agentId}`;
      const topicId = await this.hederaService.createTopic(memo);
      
      console.log(`✅ Created agent topic: ${topicId}`);
      
      this.eventBus.emitEvent(EventType.HEDERA_TOPIC_CREATED, {
        topicId,
        memo: `HCS10 Agent Topic for ${this.config.agentId}`
      });
      
      return topicId;
    } catch (error) {
      console.error('❌ Failed to create agent topic:', error);
      throw error;
    }
  }
  
  /**
   * Register this agent with the HCS10 registry
   */
  private async registerAgent(): Promise<void> {
    if (!this.agentTopicId) {
      throw new Error('Agent topic ID must be set before registering');
    }
    
    try {
      console.log(`🔄 Registering agent ${this.config.agentId} with registry...`);
      
      // Mark as pending
      this.registrationStatus = RegistrationStatus.PENDING;
      
      // Send agent info
      await this.sendAgentInfo(true);
      
      console.log(`✅ Agent ${this.config.agentId} registration initiated`);
    } catch (error) {
      console.error(`❌ Failed to register agent ${this.config.agentId}:`, error);
      this.registrationStatus = RegistrationStatus.FAILED;
      throw error;
    }
  }
  
  /**
   * Send agent info to registry topic
   */
  private async sendAgentInfo(isInitialRegistration: boolean): Promise<void> {
    const agentInfoMessage = {
      id: uuidv4(),
      type: 'AgentInfo',
      timestamp: Date.now(),
      sender: this.config.agentId,
      details: {
        agentId: this.config.agentId,
        topicId: this.agentTopicId,
        capabilities: this.config.capabilities || [],
        description: this.config.description || '',
        version: '1.0.0',
        status: 'active',
        lastSeen: Date.now()
      }
    };
    
    console.log(`📤 Publishing agent info to registry topic: ${this.config.registryTopicId}`);
    
    // Submit to registry topic
    await this.hederaService.sendMessage(
      this.config.registryTopicId,
      agentInfoMessage
    );
    
    this.lastRegistryUpdate = Date.now();
    
    this.eventBus.emitEvent(EventType.HCS10_AGENT_REGISTERED, {
      agentId: this.config.agentId,
      registryTopicId: this.config.registryTopicId
    });
  }
  
  /**
   * Verify agent registration
   */
  private async verifyAgentRegistration(): Promise<void> {
    // Send verification requests to the registry
    try {
      const verificationMessage: HCS10Message = {
        id: uuidv4(),
        timestamp: Date.now(),
        type: 'AgentVerification',
        sender: this.config.agentId,
        contents: {
          agentId: this.config.agentId,
          topicId: this.agentTopicId,
          capabilities: this.config.capabilities || [],
          verificationTimestamp: Date.now()
        }
      };
      
      // Send to the registry topic
      await this.hederaService.sendMessage(
        this.config.registryTopicId,
        JSON.stringify(verificationMessage)
      );
      
      console.log('🔍 Verification message sent to registry');
    } catch (error) {
      console.error('❌ Failed to send verification message:', error);
    }
  }
  
  /**
   * Send discovery request to find other agents
   */
  private async discoverAgents(): Promise<void> {
    try {
      console.log('🔍 Sending agent discovery request...');
      
      const discoveryMessage: HCS10Message = {
        id: uuidv4(),
        timestamp: Date.now(),
        type: 'AgentDiscovery',
        sender: this.config.agentId,
        contents: {
          agentId: this.config.agentId,
          topicId: this.agentTopicId,
          capabilities: this.config.capabilities || []
        }
      };
      
      // Send to registry topic
      await this.hederaService.sendMessage(
        this.config.registryTopicId,
        JSON.stringify(discoveryMessage)
      );
      
      console.log('📤 Discovery request sent');
    } catch (error) {
      console.error('❌ Failed to send discovery request:', error);
    }
  }
  
  /**
   * Schedule periodic registry updates
   */
  private scheduleRegistryUpdates(): void {
    console.log(`🔄 Scheduled registry updates every ${(this.config.reregistrationIntervalMs || 3600000) / 60000} minutes`);
    
    // Clear any existing interval
    if (this.reregistrationInterval) {
      clearInterval(this.reregistrationInterval);
    }
    
    // Set up interval for periodic updates
    this.reregistrationInterval = setInterval(() => {
      this.sendAgentInfo(false);
    }, this.config.reregistrationIntervalMs || 3600000); // Default to 1 hour if not specified
  }
  
  /**
   * Schedule periodic agent discovery
   */
  private scheduleAgentDiscovery(): void {
    console.log(`🔍 Scheduled agent discovery every ${(this.config.discoveryIntervalMs || 300000) / 60000} minutes`);
    
    // Clear any existing interval
    if (this.discoveryInterval) {
      clearInterval(this.discoveryInterval);
    }
    
    // Set up interval for periodic discovery
    this.discoveryInterval = setInterval(() => {
      this.discoverAgents();
    }, this.config.discoveryIntervalMs || 300000); // Default to 5 minutes if not specified
  }
  
  /**
   * Schedule periodic cleanup of pending requests
   */
  private schedulePendingRequestCleanup(): void {
    // Clean up old pending requests every 5 minutes
    setInterval(() => {
      this.cleanupPendingRequests();
    }, 5 * 60 * 1000);
  }
  
  /**
   * Clean up old pending requests
   */
  private cleanupPendingRequests(): void {
    const now = Date.now();
    let cleanedCount = 0;
    
    // Look for requests older than 1 hour
    this.pendingRequests.forEach((request, requestId) => {
      const ageMs = now - request.timestamp;
      
      // Keep requests less than 1 hour old or that are still pending with retries left
      if (
        ageMs < 60 * 60 * 1000 || 
        (request.status === 'pending' && request.retryCount < request.maxRetries)
      ) {
        return;
      }
      
      // Clean up any timeouts
      if (request.timeoutId) {
        clearTimeout(request.timeoutId);
      }
      
      // Remove from tracking
      this.pendingRequests.delete(requestId);
      this.removeResponseListeners(requestId);
      
      cleanedCount++;
    });
    
    if (cleanedCount > 0) {
      console.log(`🧹 Cleaned up ${cleanedCount} old pending requests`);
    }
  }
  
  /**
   * Get a pending request by ID
   */
  public getPendingRequest(requestId: string): PendingRequest | undefined {
    return this.pendingRequests.get(requestId);
  }
  
  /**
   * Get all pending requests
   */
  public getAllPendingRequests(): Map<string, PendingRequest> {
    return new Map(this.pendingRequests);
  }
  
  /**
   * Cancel a pending request
   */
  public cancelRequest(requestId: string): boolean {
    const pendingRequest = this.pendingRequests.get(requestId);
    
    if (!pendingRequest) {
      return false;
    }
    
    // Clean up timeout
    if (pendingRequest.timeoutId) {
      clearTimeout(pendingRequest.timeoutId);
    }
    
    // Remove from tracking
    this.pendingRequests.delete(requestId);
    this.removeResponseListeners(requestId);
    
    console.log(`❌ Cancelled request ${requestId}`);
    return true;
  }
  
  /**
   * Clear all intervals and timeouts
   */
  private clearIntervals(): void {
    if (this.reregistrationInterval) {
      clearInterval(this.reregistrationInterval);
      this.reregistrationInterval = null;
    }
    
    if (this.discoveryInterval) {
      clearInterval(this.discoveryInterval);
      this.discoveryInterval = null;
    }
    
    // Clean up all pending request timeouts
    this.pendingRequests.forEach(request => {
      if (request.timeoutId) {
        clearTimeout(request.timeoutId);
      }
    });
  }
  
  /**
   * Send a request to another agent with options for timeout and retry
   */
  public async sendRequest(
    recipientId: string, 
    contents: any,
    options: {
      timeoutMs?: number;
      maxRetries?: number;
      waitForResponse?: boolean;
    } = {}
  ): Promise<{ requestId: string; response?: any }> {
    // Merge with default options
    const mergedOptions = {
      timeoutMs: options.timeoutMs || 30000, // Default 30 seconds
      maxRetries: options.maxRetries || 0, // Default no retries
      waitForResponse: options.waitForResponse !== undefined ? options.waitForResponse : true // Default wait for response
    };
    
    // Create a unique ID for the request
    const requestId = uuidv4();
    
    // Find the recipient's topic ID
    const recipient = this.knownAgents.get(recipientId);
    if (!recipient || !recipient.topicId) {
      const error = new Error(`Cannot send request: Unknown recipient ${recipientId} or missing topicId`);
      
      // Emit error event
      this.eventBus.emitEvent(EventType.HCS10_REQUEST_ERROR, {
        requestId,
        recipientId,
        error
      });
      
      return Promise.reject(error);
    }
    
    // Store topicId to ensure TypeScript knows it's non-null
    const topicId = recipient.topicId;
    
    // Create the request message
    const requestMessage: HCS10Message = {
      id: requestId,
      timestamp: Date.now(),
      type: 'AgentRequest',
      sender: this.config.agentId,
      recipient: recipientId,
      contents
    };
    
    // Track the pending request
    const pendingRequest: PendingRequest = {
      id: requestId,
      recipientId,
      timestamp: Date.now(),
      contents,
      status: 'pending',
      retryCount: 0,
      maxRetries: mergedOptions.maxRetries,
      timeoutMs: mergedOptions.timeoutMs
    };
    
    this.pendingRequests.set(requestId, pendingRequest);
    
    // Set up timeout
    if (mergedOptions.timeoutMs > 0) {
      pendingRequest.timeoutId = setTimeout(() => {
        this.handleRequestTimeout(requestId);
      }, mergedOptions.timeoutMs);
    }
    
    try {
      // Send the request message
      await this.hederaService.sendMessage(
        topicId,
        requestMessage
      );
      
      // Emit the request sent event
      this.eventBus.emitEvent(EventType.HCS10_REQUEST_SENT, {
        requestId,
        recipientId,
        request: contents
      });
      
      console.log(`📤 Sent request to ${recipientId} with ID ${requestId}`);
      
      // If we need to wait for the response
      if (mergedOptions.waitForResponse) {
        try {
          const responseData = await this.waitForResponse(requestId, mergedOptions.timeoutMs);
          return { requestId, response: responseData };
        } catch (error) {
          return Promise.reject(error);
        }
      }
      
      // Otherwise return just the request ID
      return { requestId };
    } catch (error) {
      // Handle send error
      pendingRequest.status = 'error';
      pendingRequest.error = error as Error;
      
      // Clear the timeout
      if (pendingRequest.timeoutId) {
        clearTimeout(pendingRequest.timeoutId);
      }
      
      // Emit error event
      this.eventBus.emitEvent(EventType.HCS10_REQUEST_ERROR, {
        requestId,
        recipientId,
        error: error as Error
      });
      
      console.error(`❌ Error sending request to ${recipientId}:`, error);
      
      // If we should retry
      if (pendingRequest.retryCount < pendingRequest.maxRetries) {
        pendingRequest.retryCount += 1;
        console.log(`🔄 Retrying request ${requestId} (${pendingRequest.retryCount}/${pendingRequest.maxRetries})`);
        
        return this.retryRequest(requestId).then(() => ({ requestId }));
      }
      
      return Promise.reject(error);
    }
  }
  
  /**
   * Wait for a response to a specific request
   */
  private waitForResponse(requestId: string, timeoutMs: number): Promise<any> {
    return new Promise((resolve, reject) => {
      // Check if we already have a response
      const pendingRequest = this.pendingRequests.get(requestId);
      
      if (!pendingRequest) {
        return reject(new Error(`No pending request found with ID: ${requestId}`));
      }
      
      if (pendingRequest.status === 'responded') {
        return resolve(pendingRequest.response);
      }
      
      if (pendingRequest.status === 'error') {
        return reject(pendingRequest.error || new Error('Unknown request error'));
      }
      
      // Otherwise, register a listener for the response
      this.addResponseListener(requestId, (response) => {
        resolve(response);
      });
      
      // Set up a backup timeout just in case
      setTimeout(() => {
        // Remove the listener
        this.removeResponseListeners(requestId);
        
        // Reject with timeout
        reject(new Error(`Request timed out after ${timeoutMs}ms`));
      }, timeoutMs + 1000); // Add 1 second buffer
    });
  }
  
  /**
   * Add a listener for a response to a specific request
   */
  private addResponseListener(requestId: string, listener: (response: any) => void): void {
    const listeners = this.responseListeners.get(requestId) || [];
    listeners.push(listener);
    this.responseListeners.set(requestId, listeners);
  }
  
  /**
   * Remove all listeners for a specific request
   */
  private removeResponseListeners(requestId: string): void {
    this.responseListeners.delete(requestId);
  }
  
  /**
   * Notify all listeners for a specific request
   */
  private notifyResponseListeners(requestId: string, response: any): void {
    const listeners = this.responseListeners.get(requestId) || [];
    
    // Call each listener
    listeners.forEach(listener => {
      try {
        listener(response);
      } catch (error) {
        console.error(`❌ Error in response listener for ${requestId}:`, error);
      }
    });
    
    // Remove all listeners after notification
    this.removeResponseListeners(requestId);
  }
  
  /**
   * Handle a request timeout
   */
  private handleRequestTimeout(requestId: string): void {
    const pendingRequest = this.pendingRequests.get(requestId);
    
    if (!pendingRequest) {
      return;
    }
    
    console.log(`⏱️ Request ${requestId} to ${pendingRequest.recipientId} timed out`);
    
    // Check if we can retry
    if (pendingRequest.retryCount < pendingRequest.maxRetries) {
      this.retryRequest(requestId);
    } else {
      // Mark as timed out
      pendingRequest.status = 'timeout';
      this.pendingRequests.set(requestId, pendingRequest);
      
      // Emit timeout event
      this.eventBus.emitEvent(EventType.HCS10_REQUEST_TIMEOUT, {
        requestId,
        recipientId: pendingRequest.recipientId,
        timeoutMs: pendingRequest.timeoutMs
      });
      
      // Emit message timeout event
      this.eventBus.emitEvent(EventType.MESSAGE_TIMEOUT, {
        messageId: requestId,
        recipientId: pendingRequest.recipientId,
        elapsedTimeMs: Date.now() - pendingRequest.timestamp
      });
    }
  }
  
  /**
   * Retry a request
   */
  private async retryRequest(requestId: string): Promise<void> {
    const pendingRequest = this.pendingRequests.get(requestId);
    
    if (!pendingRequest) {
      return;
    }
    
    pendingRequest.retryCount++;
    
    console.log(`🔄 Retrying request ${requestId} to ${pendingRequest.recipientId} (Attempt ${pendingRequest.retryCount}/${pendingRequest.maxRetries})`);
    
    // Emit retry event
    this.eventBus.emitEvent(EventType.MESSAGE_RETRY, {
      messageId: requestId,
      retryCount: pendingRequest.retryCount,
      recipientId: pendingRequest.recipientId
    });
    
    try {
      const agent = this.knownAgents.get(pendingRequest.recipientId);
      
      if (!agent || !agent.topicId) {
        throw new Error(`Unknown agent or no topic ID for ${pendingRequest.recipientId}`);
      }
      
      // Create a new request message with the same ID
      const requestMessage: HCS10Message = {
        id: requestId,
        timestamp: Date.now(),
        type: 'AgentRequest',
        sender: this.config.agentId,
        recipient: pendingRequest.recipientId,
        contents: pendingRequest.contents
      };
      
      // Set up a new timeout
      if (pendingRequest.timeoutId) {
        clearTimeout(pendingRequest.timeoutId);
      }
      
      pendingRequest.timeoutId = setTimeout(() => {
        this.handleRequestTimeout(requestId);
      }, pendingRequest.timeoutMs);
      
      // Update status
      pendingRequest.status = 'pending';
      this.pendingRequests.set(requestId, pendingRequest);
      
      // Send the request again
      await this.hederaService.sendMessage(
        agent.topicId,
        JSON.stringify(requestMessage)
      );
      
      // Update status to delivered
      pendingRequest.status = 'delivered';
      this.pendingRequests.set(requestId, pendingRequest);
      
      console.log(`✅ Retry sent for request ${requestId}`);
    } catch (error) {
      console.error(`❌ Failed to retry request ${requestId}:`, error);
      
      // Update pending request with error
      pendingRequest.status = 'error';
      pendingRequest.error = error instanceof Error ? error : new Error(String(error));
      this.pendingRequests.set(requestId, pendingRequest);
      
      // Emit error event
      this.eventBus.emitEvent(EventType.HCS10_REQUEST_ERROR, {
        requestId,
        recipientId: pendingRequest.recipientId,
        error: pendingRequest.error
      });
    }
  }
  
  /**
   * Get the list of all known agents
   */
  public getKnownAgents(): Map<string, AgentInfo> {
    return new Map(this.knownAgents);
  }
  
  /**
   * Find agents with a specific capability
   */
  public findAgentsByCapability(capability: string): string[] {
    const agents: string[] = [];
    
    this.knownAgents.forEach((agent, agentId) => {
      if (agent.capabilities.includes(capability)) {
        agents.push(agentId);
      }
    });
    
    return agents;
  }
  
  /**
   * Get this agent's topic ID
   */
  public getAgentTopicId(): string | null {
    return this.agentTopicId;
  }
  
  /**
   * Get this agent's registration status
   */
  public getRegistrationStatus(): RegistrationStatus {
    return this.registrationStatus;
  }
  
  /**
   * Get this agent's registration timestamp
   */
  public getRegistrationTimestamp(): number | null {
    return this.registrationTimestamp;
  }
  
  /**
   * Get this agent's verification timestamp
   */
  public getVerificationTimestamp(): number | null {
    return this.verificationTimestamp;
  }
  
  /**
   * Check if agent is registered
   */
  public isAgentRegistered(): boolean {
    return this.registrationStatus === RegistrationStatus.REGISTERED ||
           this.registrationStatus === RegistrationStatus.VERIFIED;
  }
  
  /**
   * Check if agent is verified
   */
  public isAgentVerified(): boolean {
    return this.registrationStatus === RegistrationStatus.VERIFIED;
  }
  
  /**
   * Send a response to an agent for a specific request
   * 
   * @param recipientId The agent ID to send the response to
   * @param requestId The original request ID this response is for
   * @param response The response payload
   * @returns Promise resolving to the response information
   */
  public async sendResponse(
    recipientId: string,
    requestId: string,
    response: any
  ): Promise<{ requestId: string; recipientId: string }> {
    try {
      console.log(`📤 Sending response for request ${requestId} to ${recipientId}`);
      
      const knownAgent = this.getKnownAgents().get(recipientId);
      
      if (!knownAgent) {
        throw new Error(`Unknown agent: ${recipientId}`);
      }
      
      const message = {
        type: 'HCS10_RESPONSE',
        requestId,
        timestamp: Date.now(),
        senderId: this.config.agentId,
        response
      };
      
      // Send to the agent's topic
      await this.hederaService.sendMessage(knownAgent.topicId, message);
      
      // Emit response sent event
      this.eventBus.emitEvent(EventType.HCS10_RESPONSE_SENT, {
        requestId,
        recipientId,
        response
      });
      
      return {
        requestId,
        recipientId
      };
    } catch (error) {
      console.error(`❌ Failed to send response to ${recipientId}:`, error);
      
      // Emit error event
      this.eventBus.emitEvent(EventType.HCS10_REQUEST_ERROR, {
        requestId,
        recipientId,
        error: error instanceof Error ? error : new Error(`Unknown error: ${error}`)
      });
      
      throw error;
    }
  }
  
  /**
   * Shutdown the service and clean up resources
   */
  public async shutdown(): Promise<void> {
    try {
      console.log('🛑 Shutting down HCS10ProtocolService...');
      
      // Clear all intervals
      this.clearIntervals();
      
      console.log('✅ HCS10ProtocolService shutdown completed');
    } catch (error) {
      console.error('❌ Error during HCS10ProtocolService shutdown:', error);
      throw error;
    }
  }
  
  /**
   * Disable all periodic timers (useful for testing)
   * @internal This method is intended for testing purposes only
   */
  public disablePeriodicTimers(): void {
    this.clearIntervals();
  }
} 