/**
 * Environment utilities
 * Provides helper functions for working with environment variables
 */
/**
 * Get a required environment variable
 * @param name The name of the environment variable
 * @param defaultValue Optional default value if not found
 * @throws Error if the variable is not found and no default is provided
 */
export declare function getRequiredEnv(name: string, defaultValue?: string): string;
/**
 * Get an optional environment variable
 * @param name The name of the environment variable
 * @param defaultValue Default value if not found
 */
export declare function getOptionalEnv(name: string, defaultValue?: string): string;
/**
 * Get a clean topic ID by removing any surrounding quotes
 * and trimming whitespace
 * @param name The name of the environment variable
 * @param defaultValue Default value if not found
 */
export declare function getTopicId(name: string, defaultValue?: string): string;
/**
 * Check if a feature is enabled via environment variable
 * @param name The name of the environment variable
 * @param defaultValue Default value if not found
 */
export declare function isFeatureEnabled(name: string, defaultValue?: boolean): boolean;
/**
 * Get Hedera network type from environment
 * @returns The network type (testnet, mainnet, etc.)
 */
export declare function getHederaNetwork(): string;
/**
 * Validate if required environment variables for Hedera operations are set
 * @returns Object with validation result and optional error message
 */
export declare function validateHederaEnv(): {
    valid: boolean;
    error?: string;
};
/**
 * Get all topic IDs from environment
 * @returns Object containing all topic IDs
 */
export declare function getAllTopicIds(): {
    governanceTopic: string;
    agentTopic: string;
    priceFeedTopic: string;
    registryTopic: string;
    inboundTopic: string;
    outboundTopic: string;
    profileTopic: string;
};
