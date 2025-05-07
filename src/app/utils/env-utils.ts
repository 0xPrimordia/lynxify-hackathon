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
export function getRequiredEnv(name: string, defaultValue?: string): string {
  const value = process.env[name];
  
  if (!value && defaultValue === undefined) {
    throw new Error(`Required environment variable ${name} is not set`);
  }
  
  return value || defaultValue || '';
}

/**
 * Get an optional environment variable
 * @param name The name of the environment variable
 * @param defaultValue Default value if not found
 */
export function getOptionalEnv(name: string, defaultValue: string = ''): string {
  return process.env[name] || defaultValue;
}

/**
 * Get a clean topic ID by removing any surrounding quotes
 * and trimming whitespace
 * @param name The name of the environment variable
 * @param defaultValue Default value if not found
 */
export function getTopicId(name: string, defaultValue: string = ''): string {
  const rawValue = getOptionalEnv(name, defaultValue);
  // Clean up the value by removing quotes and whitespace
  return rawValue.trim().replace(/['"]/g, '');
}

/**
 * Check if a feature is enabled via environment variable
 * @param name The name of the environment variable
 * @param defaultValue Default value if not found
 */
export function isFeatureEnabled(name: string, defaultValue: boolean = false): boolean {
  const value = getOptionalEnv(name, defaultValue ? 'true' : 'false');
  return value.toLowerCase() === 'true';
}

/**
 * Get Hedera network type from environment
 * @returns The network type (testnet, mainnet, etc.)
 */
export function getHederaNetwork(): string {
  return getOptionalEnv('NEXT_PUBLIC_HEDERA_NETWORK', 'testnet');
}

/**
 * Validate if required environment variables for Hedera operations are set
 * @returns Object with validation result and optional error message
 */
export function validateHederaEnv(): { valid: boolean; error?: string } {
  try {
    const operatorId = getRequiredEnv('NEXT_PUBLIC_OPERATOR_ID');
    const operatorKey = getRequiredEnv('OPERATOR_KEY');
    
    if (!operatorId || !operatorKey) {
      return { 
        valid: false, 
        error: 'Missing required Hedera credentials (NEXT_PUBLIC_OPERATOR_ID and/or OPERATOR_KEY)' 
      };
    }
    
    return { valid: true };
  } catch (error) {
    if (error instanceof Error) {
      return { valid: false, error: error.message };
    }
    return { valid: false, error: 'Unknown error validating Hedera environment' };
  }
}

/**
 * Get all topic IDs from environment
 * @returns Object containing all topic IDs
 */
export function getAllTopicIds(): { 
  governanceTopic: string;
  agentTopic: string;
  priceFeedTopic: string;
  registryTopic: string;
  inboundTopic: string;
  outboundTopic: string;
  profileTopic: string;
} {
  return {
    governanceTopic: getTopicId('NEXT_PUBLIC_HCS_GOVERNANCE_TOPIC'),
    agentTopic: getTopicId('NEXT_PUBLIC_HCS_AGENT_TOPIC'),
    priceFeedTopic: getTopicId('NEXT_PUBLIC_HCS_PRICE_FEED_TOPIC'),
    registryTopic: getTopicId('NEXT_PUBLIC_HCS_REGISTRY_TOPIC'),
    inboundTopic: getTopicId('NEXT_PUBLIC_HCS_INBOUND_TOPIC'),
    outboundTopic: getTopicId('NEXT_PUBLIC_HCS_OUTBOUND_TOPIC'),
    profileTopic: getTopicId('NEXT_PUBLIC_HCS_PROFILE_TOPIC'),
  };
} 