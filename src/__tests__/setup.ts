import dotenv from 'dotenv';

// Load environment variables from .env.test
dotenv.config({ path: '.env.test' });

// Mock environment variables if not set
process.env.NEXT_PUBLIC_OPERATOR_ID = process.env.NEXT_PUBLIC_OPERATOR_ID || '0.0.1234567';
process.env.OPERATOR_KEY = process.env.OPERATOR_KEY || 'test-key';
process.env.NEXT_PUBLIC_GOVERNANCE_TOPIC_ID = process.env.NEXT_PUBLIC_GOVERNANCE_TOPIC_ID || '0.0.1234568';
process.env.NEXT_PUBLIC_AGENT_TOPIC_ID = process.env.NEXT_PUBLIC_AGENT_TOPIC_ID || '0.0.1234569';
process.env.NEXT_PUBLIC_WS_URL = process.env.NEXT_PUBLIC_WS_URL || 'ws://localhost:3001';

// Mock console methods to keep test output clean
const mockConsole = {
  log: () => {},
  error: () => {},
  warn: () => {},
  info: () => {},
  debug: () => {},
};

Object.assign(console, mockConsole); 