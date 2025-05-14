// Set environment variables for development
process.env.BYPASS_TOPIC_CHECK = 'true';
// Only use environment variables, no default values for HCS topics
process.env.NEXT_PUBLIC_HCS_GOVERNANCE_TOPIC = process.env.NEXT_PUBLIC_HCS_GOVERNANCE_TOPIC;
process.env.NEXT_PUBLIC_HCS_PRICE_FEED_TOPIC = process.env.NEXT_PUBLIC_HCS_PRICE_FEED_TOPIC;
process.env.NEXT_PUBLIC_HCS_AGENT_TOPIC = process.env.NEXT_PUBLIC_HCS_AGENT_TOPIC;
// Only use environment variables for credentials, no hardcoded default values
process.env.NEXT_PUBLIC_OPERATOR_ID = process.env.NEXT_PUBLIC_OPERATOR_ID;
process.env.OPERATOR_KEY = process.env.OPERATOR_KEY;
export {};
