// This file runs before tests, setting up the environment
// Jest automatically sets NODE_ENV to 'test'

// Set custom environment variables for tests
process.env.IS_TEST_ENV = 'true';

// Normalize the fs mock for all tests
jest.mock('fs', () => ({
  existsSync: jest.fn().mockReturnValue(true),
  readFileSync: jest.fn().mockReturnValue(JSON.stringify({
    tokens: {
      'BTC': {
        tokenId: '0.0.5924920',
        name: 'BTC-Demo',
        symbol: 'BTC',
      },
      'ETH': {
        tokenId: '0.0.5924921',
        name: 'ETH-Demo',
        symbol: 'ETH',
      },
      'SOL': {
        tokenId: '0.0.5924922',
        name: 'SOL-Demo',
        symbol: 'SOL',
      },
    },
  })),
  writeFileSync: jest.fn(),
  mkdirSync: jest.fn(),
}));

// Normalize common environment variables for tests
process.env.NEXT_PUBLIC_OPERATOR_ID = '0.0.4340026';
process.env.OPERATOR_KEY = 'mock-private-key'; 