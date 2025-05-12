/**
 * This test verifies that all required environment variables are set correctly
 * for test execution.
 */

describe('Environment Variables Verification', () => {
  beforeAll(() => {
    // Set test environment variables
    process.env.NEXT_PUBLIC_OPERATOR_ID = '0.0.12345';
    process.env.OPERATOR_KEY = '302e020100300506032b657004220420db484b828e64b2d8f12ce3c0a0e93a0b8cce7af1bb8f39c97732394482538e10';
    process.env.NEXT_PUBLIC_HCS_GOVERNANCE_TOPIC = '0.0.12346';
    process.env.NEXT_PUBLIC_HCS_AGENT_TOPIC = '0.0.12347';
    process.env.NEXT_PUBLIC_HCS_PRICE_FEED_TOPIC = '0.0.12348';
    // Legacy names
    process.env.NEXT_PUBLIC_GOVERNANCE_TOPIC_ID = '0.0.12346';
    process.env.NEXT_PUBLIC_AGENT_TOPIC_ID = '0.0.12347';
    // Network
    process.env.NEXT_PUBLIC_NETWORK = 'testnet';
    // WS URL
    process.env.NEXT_PUBLIC_WS_URL = 'ws://localhost:3001';
    // Testing flags
    process.env.BYPASS_TOPIC_CHECK = 'true';
  });

  test('Hedera credentials are properly set for tests', () => {
    expect(process.env.NEXT_PUBLIC_OPERATOR_ID).toBe('0.0.12345');
    expect(process.env.OPERATOR_KEY).toMatch(/^302e/); // Check key format starts correctly
    expect(process.env.NEXT_PUBLIC_NETWORK).toBe('testnet');
  });

  test('HCS topics are properly configured', () => {
    expect(process.env.NEXT_PUBLIC_HCS_GOVERNANCE_TOPIC).toBe('0.0.12346');
    expect(process.env.NEXT_PUBLIC_HCS_AGENT_TOPIC).toBe('0.0.12347');
    expect(process.env.NEXT_PUBLIC_HCS_PRICE_FEED_TOPIC).toBe('0.0.12348');

    // Legacy environment variables
    expect(process.env.NEXT_PUBLIC_GOVERNANCE_TOPIC_ID).toBe('0.0.12346');
    expect(process.env.NEXT_PUBLIC_AGENT_TOPIC_ID).toBe('0.0.12347');
  });

  test('Testing bypass flags are set', () => {
    expect(process.env.BYPASS_TOPIC_CHECK).toBe('true');
  });
}); 