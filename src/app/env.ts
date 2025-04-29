import dotenv from 'dotenv';
import path from 'path';

// Load environment variables
const envPath = path.resolve(process.cwd(), '.env.local');
console.log('Loading environment variables from:', envPath);
dotenv.config({ path: envPath });

// Validate required environment variables
const requiredEnvVars = [
  'NEXT_PUBLIC_OPERATOR_ID',
  'OPERATOR_KEY',
  'NEXT_PUBLIC_GOVERNANCE_TOPIC_ID',
  'NEXT_PUBLIC_AGENT_TOPIC_ID',
  'NEXT_PUBLIC_WS_URL'
];

for (const envVar of requiredEnvVars) {
  if (!process.env[envVar]) {
    throw new Error(`Missing required environment variable: ${envVar}`);
  }
}

// Export environment variables
export const env = {
  operatorId: process.env.NEXT_PUBLIC_OPERATOR_ID!,
  operatorKey: process.env.OPERATOR_KEY!,
  governanceTopicId: process.env.NEXT_PUBLIC_GOVERNANCE_TOPIC_ID!,
  agentTopicId: process.env.NEXT_PUBLIC_AGENT_TOPIC_ID!,
  wsUrl: process.env.NEXT_PUBLIC_WS_URL!
}; 