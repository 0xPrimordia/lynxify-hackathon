/**
 * Agent Registry Service
 * Handles agent registration with Moonscape using the standards-sdk
 */
export declare class AgentRegistryService {
    private logger;
    constructor();
    /**
     * Check if the agent is already registered with the registry
     * @param operatorId The operator account ID
     * @param registryTopic The registry topic ID
     */
    isAlreadyRegistered(operatorId: string, registryTopic: string): Promise<boolean>;
    /**
     * Register agent with Moonscape using the HCS-10 standards SDK
     * @param operatorId The operator account ID
     * @param operatorKey The operator private key
     * @param registryUrl The registry URL (e.g. https://moonscape.tech)
     * @param registryTopic The registry topic ID
     */
    registerAgent(operatorId: string, operatorKey: string, registryUrl: string, registryTopic: string): Promise<{
        success: boolean;
        accountId?: string;
        inboundTopicId?: string;
        outboundTopicId?: string;
    }>;
    /**
     * Store registration status for future runs
     * @param metadata The agent metadata
     * @param registryTopic The registry topic ID
     */
    private storeRegistrationStatus;
    /**
     * Get stored registration information if available
     */
    getStoredRegistrationInfo(): Promise<{
        accountId: string;
        inboundTopicId: string;
        outboundTopicId: string;
        registryTopic: string;
    } | null>;
}
declare const _default: AgentRegistryService;
export default _default;
