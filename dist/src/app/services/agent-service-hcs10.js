import { Logger } from '@hashgraphonline/standards-sdk';
import fs from 'fs/promises';
import path from 'path';
import { createTokenServiceHCS10 } from './token-service-hcs10.js';
import { createConnectionHandler } from './connection-handler.js';
import { createMessageProcessor } from './message-processor.js';
import { createProposalHandler } from './proposal-handler-hcs10.js';
const REGISTRATION_STATUS_FILE = path.join(process.cwd(), '.registration_status.json');
/**
 * HCS-10 Agent Service
 * Coordinates all components of the HCS-10 agent implementation
 */
export class AgentServiceHCS10 {
    constructor(client, baseTokenService) {
        this.registrationInfo = null;
        this.isRunning = false;
        this.client = client;
        this.baseTokenService = baseTokenService;
        this.logger = new Logger({
            module: 'AgentServiceHCS10',
            level: 'debug',
            prettyPrint: true,
        });
        // Create enhanced token service
        this.tokenService = createTokenServiceHCS10(baseTokenService);
        // Create other services
        this.connectionHandler = createConnectionHandler(client);
        this.messageProcessor = createMessageProcessor(client);
        this.proposalHandler = createProposalHandler(client, this.tokenService);
    }
    /**
     * Initialize the agent service and all its components
     */
    async initialize() {
        try {
            this.logger.info('Initializing HCS-10 agent service...');
            // Load registration info
            await this.loadRegistrationInfo();
            if (!this.registrationInfo) {
                this.logger.error('Agent not registered, cannot initialize');
                return false;
            }
            // Initialize connection handler
            const connectionInit = await this.connectionHandler.initialize();
            if (!connectionInit) {
                this.logger.error('Failed to initialize connection handler');
                return false;
            }
            // Initialize message processor
            const messageInit = await this.messageProcessor.initialize();
            if (!messageInit) {
                this.logger.error('Failed to initialize message processor');
                return false;
            }
            // Initialize proposal handler
            const proposalInit = await this.proposalHandler.initialize(this.registrationInfo.outboundTopicId);
            if (!proposalInit) {
                this.logger.error('Failed to initialize proposal handler');
                return false;
            }
            // Register message handlers
            this.registerMessageHandlers();
            this.logger.info('HCS-10 agent service initialized successfully');
            return true;
        }
        catch (error) {
            this.logger.error('Failed to initialize agent service:', error);
            return false;
        }
    }
    /**
     * Load agent registration information
     */
    async loadRegistrationInfo() {
        try {
            const data = await fs.readFile(REGISTRATION_STATUS_FILE, 'utf8');
            this.registrationInfo = JSON.parse(data);
            if (!this.registrationInfo) {
                throw new Error('Invalid registration info - data is null or undefined');
            }
            if (!this.registrationInfo.accountId ||
                !this.registrationInfo.inboundTopicId ||
                !this.registrationInfo.outboundTopicId) {
                throw new Error('Invalid registration info - missing required fields');
            }
            this.logger.info('Loaded registration info:', {
                accountId: this.registrationInfo.accountId,
                inboundTopicId: this.registrationInfo.inboundTopicId,
                outboundTopicId: this.registrationInfo.outboundTopicId
            });
        }
        catch (error) {
            this.logger.error('Failed to load registration info:', error);
            throw new Error('Agent not registered');
        }
    }
    /**
     * Register message handlers for different message types
     */
    registerMessageHandlers() {
        // Register proposal handlers
        this.messageProcessor.registerHandler('RebalanceProposal', async (message, senderId) => {
            await this.proposalHandler.handleRebalanceProposal(message, senderId);
        });
        this.messageProcessor.registerHandler('RebalanceApproved', async (message, senderId) => {
            await this.proposalHandler.handleRebalanceApproval(message, senderId);
        });
        // Add more message handlers here as needed
        this.messageProcessor.registerHandler('QueryIndexComposition', async (message, senderId) => {
            await this.handleIndexCompositionQuery(message, senderId);
        });
        this.logger.info('Registered message handlers');
    }
    /**
     * Start the agent service
     */
    async start() {
        if (this.isRunning) {
            this.logger.warn('Agent service is already running');
            return true;
        }
        try {
            this.logger.info('Starting HCS-10 agent service...');
            // Start connection handler
            const connectionStarted = await this.connectionHandler.startListening();
            if (!connectionStarted) {
                this.logger.error('Failed to start connection handler');
                return false;
            }
            // Start message processor
            const messageStarted = await this.messageProcessor.startProcessing();
            if (!messageStarted) {
                this.logger.error('Failed to start message processor');
                return false;
            }
            // Set running state
            this.isRunning = true;
            this.logger.info('HCS-10 agent service started successfully');
            return true;
        }
        catch (error) {
            this.logger.error('Failed to start agent service:', error);
            return false;
        }
    }
    /**
     * Handle a query for index composition
     * @param message The query message
     * @param senderId The sender's account ID
     */
    async handleIndexCompositionQuery(message, senderId) {
        try {
            this.logger.info(`Handling index composition query from ${senderId}`);
            // Get current token balances
            const balances = await this.tokenService.getCurrentBalances();
            // Calculate total value
            const totalValue = Object.values(balances).reduce((sum, value) => sum + value, 0);
            // Calculate weights
            const weights = {};
            for (const [token, balance] of Object.entries(balances)) {
                weights[token] = totalValue > 0 ? balance / totalValue : 0;
            }
            // Prepare response
            const response = {
                type: 'IndexComposition',
                composition: weights,
                timestamp: Date.now()
            };
            // Send response
            await this.messageProcessor.sendMessage(senderId, response);
            this.logger.info(`Sent index composition to ${senderId}`);
        }
        catch (error) {
            this.logger.error('Error handling index composition query:', error);
        }
    }
    /**
     * Get the agent's registration info
     */
    getRegistrationInfo() {
        return this.registrationInfo;
    }
    /**
     * Get active connections
     */
    getActiveConnections() {
        return this.connectionHandler.getConnections();
    }
    /**
     * Get pending proposals
     */
    getPendingProposals() {
        return this.proposalHandler.getPendingProposals();
    }
    /**
     * Get executed proposals
     */
    getExecutedProposals() {
        return this.proposalHandler.getExecutedProposals();
    }
    /**
     * Check if the agent service is running
     */
    isActive() {
        return this.isRunning;
    }
}
/**
 * Create and initialize an HCS-10 agent service
 */
export async function createAgentService(client, tokenService) {
    const agent = new AgentServiceHCS10(client, tokenService);
    await agent.initialize();
    return agent;
}
