import { HederaService } from '@/app/services/hedera';
import { TokenService } from '@/app/services/token-service';
import { jest } from '@jest/globals';

// Mock Hedera SDK and set environment variables for testing
jest.mock('@hashgraph/sdk');
jest.mock('fs');

// Set required environment variables
process.env.NEXT_PUBLIC_OPERATOR_ID = '0.0.4340026';
process.env.OPERATOR_KEY = 'mock-private-key';
process.env.NEXT_PUBLIC_HCS_AGENT_TOPIC = '0.0.12345';
process.env.BYPASS_TOPIC_CHECK = 'true';

describe('Token Operations', () => {
  let tokenService: TokenService;

  beforeEach(() => {
    jest.clearAllMocks();
    tokenService = new TokenService();
  });

  test('getTokenId returns correct token ID', () => {
    // Mock existsSync and readFileSync directly
    const mockFs = require('fs');
    mockFs.existsSync.mockReturnValue(true);
    mockFs.readFileSync.mockReturnValue(JSON.stringify({
      tokens: {
        'BTC': { tokenId: '0.0.5924920' },
        'ETH': { tokenId: '0.0.5924921' },
      }
    }));

    // Create a new instance with our mocked fs
    const service = new TokenService();
    
    // Now the token data should be loaded from our mock
    expect(service.getTokenId('BTC')).toBe('0.0.5924920');
    expect(service.getTokenId('XYZ')).toBeNull();
  });

  test('calculateAdjustments calculates correctly', () => {
    const currentBalances = {
      'BTC': 100,
      'ETH': 200,
      'SOL': 300,
    };
    
    const newWeights = {
      'BTC': 0.5,
      'ETH': 0.3,
      'SOL': 0.2,
    };
    
    const adjustments = tokenService.calculateAdjustments(currentBalances, newWeights);
    
    // With a total value of 600 and weights of 0.5, 0.3, 0.2
    // Expected: BTC = 300-100 = 200, ETH = 180-200 = -20, SOL = 120-300 = -180
    expect(adjustments).toEqual({
      'BTC': 200,
      'ETH': -20,
      'SOL': -180,
    });
  });
});

describe('Error Handling', () => {
  let tokenService: TokenService;
  
  beforeEach(() => {
    jest.clearAllMocks();
    tokenService = new TokenService();
  });
  
  test('mintTokens handles invalid token ID', async () => {
    // Mock getTokenId to return null for invalid token
    jest.spyOn(tokenService, 'getTokenId').mockReturnValue(null);
    
    // Mock console.error
    const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    
    // Call mintTokens with invalid token
    const result = await tokenService.mintTokens('INVALID', 100);
    
    // Should return false for invalid token
    expect(result).toBe(false);
    
    // Should log error
    expect(consoleErrorSpy).toHaveBeenCalled();
    expect(consoleErrorSpy.mock.calls[0][0]).toContain('Token ID not found');
  });
}); 