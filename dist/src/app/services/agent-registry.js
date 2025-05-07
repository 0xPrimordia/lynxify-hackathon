import { HCS10Client, AgentBuilder, AIAgentCapability, Logger } from '@hashgraphonline/standards-sdk';
import fs from 'fs/promises';
import path from 'path';
// Define registration status file path
const REGISTRATION_STATUS_FILE = path.join(process.cwd(), '.registration_status.json');
/**
 * Agent Registry Service
 * Handles agent registration with Moonscape using the standards-sdk
 */
export class AgentRegistryService {
    constructor() {
        this.logger = new Logger({
            module: 'AgentRegistry',
            level: 'debug',
            prettyPrint: true,
        });
    }
    /**
     * Check if the agent is already registered with the registry
     * @param operatorId The operator account ID
     * @param registryTopic The registry topic ID
     */
    async isAlreadyRegistered(operatorId, registryTopic) {
        if (!operatorId || !registryTopic) {
            return false;
        }
        try {
            // Check if the registration status file exists
            const data = await fs.readFile(REGISTRATION_STATUS_FILE, 'utf8');
            const status = JSON.parse(data);
            // Check if the registered account ID matches the current one
            if (status.accountId === operatorId &&
                status.registryTopic === registryTopic) {
                this.logger.info('Found existing registration record');
                return true;
            }
            return false;
        }
        catch (error) {
            // File doesn't exist or is invalid, assume not registered
            this.logger.info('No existing registration record found');
            return false;
        }
    }
    /**
     * Register agent with Moonscape using the HCS-10 standards SDK
     * @param operatorId The operator account ID
     * @param operatorKey The operator private key
     * @param registryUrl The registry URL (e.g. https://moonscape.tech)
     * @param registryTopic The registry topic ID
     */
    async registerAgent(operatorId, operatorKey, registryUrl, registryTopic) {
        try {
            this.logger.info('Registering agent using HCS10Client...');
            // Create base client for registration
            const baseClient = new HCS10Client({
                network: 'testnet',
                operatorId: operatorId,
                operatorPrivateKey: operatorKey,
                guardedRegistryBaseUrl: registryUrl,
                prettyPrint: true,
                logLevel: 'debug',
            });
            // Build the agent using AgentBuilder
            const agentBuilder = new AgentBuilder()
                .setName('Lynxify Agent')
                .setAlias('lynxify_agent')
                .setBio('AI-powered rebalancing agent for the Lynxify Tokenized Index')
                .setCapabilities([
                AIAgentCapability.TEXT_GENERATION,
                AIAgentCapability.KNOWLEDGE_RETRIEVAL,
                AIAgentCapability.DATA_INTEGRATION
            ])
                .setCreator('Lynxify')
                .setModel('gpt-3.5-turbo');
            // Register agent using the SDK
            const result = await baseClient.createAndRegisterAgent(agentBuilder, { initialBalance: 5 } // Fund with 5 HBAR
            );
            if (result && result.metadata) {
                this.logger.info('Agent created and registered successfully using SDK');
                this.logger.info(`Account ID: ${result.metadata.accountId}`);
                this.logger.info(`Inbound Topic ID: ${result.metadata.inboundTopicId}`);
                this.logger.info(`Outbound Topic ID: ${result.metadata.outboundTopicId}`);
                // Store registration data for future runs
                await this.storeRegistrationStatus(result.metadata, registryTopic);
                return {
                    success: true,
                    accountId: result.metadata.accountId,
                    inboundTopicId: result.metadata.inboundTopicId,
                    outboundTopicId: result.metadata.outboundTopicId
                };
            }
            this.logger.error('Failed to create agent with SDK - missing metadata');
            return { success: false };
        }
        catch (error) {
            this.logger.error('Error registering agent with SDK:', error);
            return { success: false };
        }
    }
    /**
     * Store registration status for future runs
     * @param metadata The agent metadata
     * @param registryTopic The registry topic ID
     */
    async storeRegistrationStatus(metadata, registryTopic) {
        try {
            const status = {
                accountId: metadata.accountId,
                inboundTopicId: metadata.inboundTopicId,
                outboundTopicId: metadata.outboundTopicId,
                registryTopic: registryTopic,
                timestamp: Date.now()
            };
            await fs.writeFile(REGISTRATION_STATUS_FILE, JSON.stringify(status, null, 2));
            this.logger.info('Registration status stored for future runs');
        }
        catch (error) {
            this.logger.error('Failed to store registration status:', error);
        }
    }
    /**
     * Get stored registration information if available
     */
    async getStoredRegistrationInfo() {
        try {
            const data = await fs.readFile(REGISTRATION_STATUS_FILE, 'utf8');
            return JSON.parse(data);
        }
        catch (error) {
            return null;
        }
    }
}
// Export singleton instance
export default new AgentRegistryService();
