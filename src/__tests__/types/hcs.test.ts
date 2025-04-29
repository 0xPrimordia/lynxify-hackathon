import { HCSMessage, isValidHCSMessage } from '../../app/types/hcs';

describe('HCS Message Types', () => {
  describe('isValidHCSMessage', () => {
    it('should return false for null or undefined', () => {
      expect(isValidHCSMessage(null)).toBe(false);
      expect(isValidHCSMessage(undefined)).toBe(false);
    });

    it('should return false for non-object values', () => {
      expect(isValidHCSMessage('string')).toBe(false);
      expect(isValidHCSMessage(123)).toBe(false);
      expect(isValidHCSMessage(true)).toBe(false);
    });

    it('should return false for objects missing required fields', () => {
      expect(isValidHCSMessage({})).toBe(false);
      expect(isValidHCSMessage({ type: 'RebalanceProposal' })).toBe(false);
      expect(isValidHCSMessage({ timestamp: Date.now() })).toBe(false);
      expect(isValidHCSMessage({ sender: 'test' })).toBe(false);
    });

    it('should return false for invalid message types', () => {
      expect(isValidHCSMessage({
        type: 'InvalidType',
        timestamp: Date.now(),
        sender: 'test'
      })).toBe(false);
    });

    it('should return true for valid RebalanceProposal', () => {
      const proposal: HCSMessage = {
        type: 'RebalanceProposal',
        timestamp: Date.now(),
        sender: 'test',
        proposalId: 'P123',
        newWeights: { '0.0.123': 0.5, '0.0.456': 0.5 },
        executeAfter: Date.now() + 3600000,
        quorum: 1000
      };
      expect(isValidHCSMessage(proposal)).toBe(true);
    });

    it('should return true for valid PriceUpdate', () => {
      const update: HCSMessage = {
        type: 'PriceUpdate',
        timestamp: Date.now(),
        sender: 'test',
        tokenId: '0.0.123',
        price: 100.50,
        source: 'test-source'
      };
      expect(isValidHCSMessage(update)).toBe(true);
    });

    it('should return true for valid RiskAlert', () => {
      const alert: HCSMessage = {
        type: 'RiskAlert',
        timestamp: Date.now(),
        sender: 'test',
        severity: 'high',
        description: 'Test alert',
        affectedTokens: ['0.0.123'],
        metrics: {
          volatility: 0.1,
          priceChange: 0.05
        }
      };
      expect(isValidHCSMessage(alert)).toBe(true);
    });
  });
}); 