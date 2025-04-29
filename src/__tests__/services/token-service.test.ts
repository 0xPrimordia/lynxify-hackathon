import { TokenService } from '@/app/services/token-service';
import { jest } from '@jest/globals';

// Mock the Hedera SDK
jest.mock('@hashgraph/sdk', () => {
  return {
    Client: {
      forTestnet: jest.fn().mockReturnValue({
        setOperator: jest.fn().mockReturnThis(),
      }),
    },
    AccountId: {
      fromString: jest.fn().mockReturnValue('0.0.4340026'),
    },
    PrivateKey: {
      fromString: jest.fn().mockReturnValue('mock-private-key'),
    },
    TokenId: {
      fromString: jest.fn().mockImplementation((id) => id),
    },
    AccountBalanceQuery: jest.fn().mockImplementation(() => ({
      setAccountId: jest.fn().mockReturnThis(),
      execute: jest.fn().mockResolvedValue({
        tokens: new Map([
          ['0.0.5924920', 1000],
          ['0.0.5924921', 2000],
          ['0.0.5924922', 3000],
        ]),
      }),
    })),
    TokenMintTransaction: jest.fn().mockImplementation(() => ({
      setTokenId: jest.fn().mockReturnThis(),
      setAmount: jest.fn().mockReturnThis(),
      freezeWith: jest.fn().mockReturnThis(),
      sign: jest.fn().mockResolvedValue({
        execute: jest.fn().mockResolvedValue({
          getReceipt: jest.fn().mockResolvedValue({
            status: 'SUCCESS',
          }),
        }),
      }),
    })),
    TokenBurnTransaction: jest.fn().mockImplementation(() => ({
      setTokenId: jest.fn().mockReturnThis(),
      setAmount: jest.fn().mockReturnThis(),
      freezeWith: jest.fn().mockReturnThis(),
      sign: jest.fn().mockResolvedValue({
        execute: jest.fn().mockResolvedValue({
          getReceipt: jest.fn().mockResolvedValue({
            status: 'SUCCESS',
          }),
        }),
      }),
    })),
  };
});

// Mock the fs module
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
}));

// Mock environment variables
process.env.NEXT_PUBLIC_OPERATOR_ID = '0.0.4340026';
process.env.OPERATOR_KEY = 'mock-private-key';

describe('TokenService', () => {
  let tokenService: TokenService;

  beforeEach(() => {
    tokenService = new TokenService();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('getTokenId', () => {
    it('should return the correct token ID for a valid asset', () => {
      const tokenId = tokenService.getTokenId('BTC');
      expect(tokenId).toBe('0.0.5924920');
    });

    it('should return null for an invalid asset', () => {
      const tokenId = tokenService.getTokenId('INVALID');
      expect(tokenId).toBeNull();
    });
  });

  describe('getAllTokenIds', () => {
    it('should return all token IDs', () => {
      const tokenIds = tokenService.getAllTokenIds();
      expect(tokenIds).toEqual({
        'BTC': '0.0.5924920',
        'ETH': '0.0.5924921',
        'SOL': '0.0.5924922',
      });
    });
  });

  describe('getTokenBalances', () => {
    it('should return token balances correctly', async () => {
      const balances = await tokenService.getTokenBalances();
      expect(balances).toEqual({
        'BTC': 10,
        'ETH': 20,
        'SOL': 30,
      });
    });
  });

  describe('mintTokens', () => {
    it('should mint tokens successfully', async () => {
      const result = await tokenService.mintTokens('BTC', 100);
      expect(result).toBe(true);
    });

    it('should return false for an invalid asset', async () => {
      const result = await tokenService.mintTokens('INVALID', 100);
      expect(result).toBe(false);
    });
  });

  describe('burnTokens', () => {
    it('should burn tokens successfully', async () => {
      const result = await tokenService.burnTokens('BTC', 50);
      expect(result).toBe(true);
    });

    it('should return false for an invalid asset', async () => {
      const result = await tokenService.burnTokens('INVALID', 50);
      expect(result).toBe(false);
    });
  });

  describe('calculateAdjustments', () => {
    it('should calculate adjustments correctly', () => {
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
      
      // With a total value of 1000 and weights of 0.5, 0.3, 0.2
      // Expected target amounts: BTC = 500, ETH = 300, SOL = 200
      // Adjustments: BTC = 500-100 = 400, ETH = 300-200 = 100, SOL = 200-300 = -100
      expect(adjustments).toEqual({
        'BTC': 400,
        'ETH': 100,
        'SOL': -100,
      });
    });

    it('should ignore very small adjustments', () => {
      const currentBalances = {
        'BTC': 500,
        'ETH': 300,
        'SOL': 200,
      };
      const newWeights = {
        'BTC': 0.5,
        'ETH': 0.3,
        'SOL': 0.2,
      };
      const adjustments = tokenService.calculateAdjustments(currentBalances, newWeights);
      expect(adjustments).toEqual({});
    });
  });
}); 