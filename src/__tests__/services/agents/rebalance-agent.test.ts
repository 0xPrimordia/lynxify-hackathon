import { RebalanceAgent } from '@/app/services/agents/rebalance-agent';
import { HederaService } from '@/app/services/hedera';
import { RebalanceProposal, RebalanceApproved, RiskAlert, RebalanceExecuted } from '@/app/types/hcs';

jest.mock('../../../app/services/hedera');

describe('RebalanceAgent', () => {
  let agent: RebalanceAgent;
  let hederaService: jest.Mocked<HederaService>;

  beforeEach(() => {
    jest.clearAllMocks();
    hederaService = new HederaService() as jest.Mocked<HederaService>;
    agent = new RebalanceAgent(hederaService);
  });

  describe('handleMessage', () => {
    it('should handle RebalanceProposal messages', async () => {
      const proposal: RebalanceProposal = {
        type: 'RebalanceProposal',
        timestamp: Date.now(),
        sender: 'governance',
        proposalId: 'P123',
        newWeights: { '0.0.123': 0.5, '0.0.456': 0.5 },
        executeAfter: Date.now() + 3600000,
        quorum: 1000
      };

      await agent.start();
      await agent['handleMessage'](proposal);

      // Verify proposal was stored
      expect(agent['pendingProposals'].get('P123')).toBeDefined();
    });

    it('should handle RebalanceApproved messages', async () => {
      const proposal: RebalanceProposal = {
        type: 'RebalanceProposal',
        timestamp: Date.now(),
        sender: 'governance',
        proposalId: 'P123',
        newWeights: { '0.0.123': 0.5, '0.0.456': 0.5 },
        executeAfter: Date.now() + 3600000,
        quorum: 1000
      };

      const approval: RebalanceApproved = {
        type: 'RebalanceApproved',
        timestamp: Date.now(),
        sender: 'governance',
        proposalId: 'P123',
        approvedAt: Date.now(),
        approvedBy: 'governance'
      };

      // Store proposal first
      agent['pendingProposals'].set('P123', proposal);

      await agent.start();
      await agent['handleMessage'](approval);

      // Verify rebalance was executed and proposal was removed
      expect(hederaService.publishMessage).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          type: 'RebalanceExecuted',
          proposalId: 'P123'
        } as RebalanceExecuted)
      );
      expect(agent['pendingProposals'].has('P123')).toBe(false);
    });

    it('should handle RiskAlert messages', async () => {
      const alert: RiskAlert = {
        type: 'RiskAlert',
        timestamp: Date.now(),
        sender: 'risk-assessment-agent',
        severity: 'high',
        description: 'Test alert',
        affectedTokens: ['0.0.123'],
        metrics: {
          volatility: 0.1,
          priceChange: 0.05
        }
      };

      await agent.start();
      await agent['handleMessage'](alert);

      // Verify emergency proposal was published
      expect(hederaService.publishMessage).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          type: 'RebalanceProposal',
          proposalId: expect.stringContaining('emergency-'),
          newWeights: expect.any(Object)
        } as RebalanceProposal)
      );
    });
  });

  describe('handleRebalanceProposal', () => {
    it('should store proposal for later execution', async () => {
      const proposal: RebalanceProposal = {
        type: 'RebalanceProposal',
        timestamp: Date.now(),
        sender: 'governance',
        proposalId: 'P123',
        newWeights: { '0.0.123': 0.5, '0.0.456': 0.5 },
        executeAfter: Date.now() + 3600000,
        quorum: 1000
      };

      await agent['handleRebalanceProposal'](proposal);
      expect(agent['pendingProposals'].get('P123')).toBe(proposal);
    });
  });

  describe('handleRebalanceApproval', () => {
    it('should execute rebalance when proposal exists', async () => {
      const proposal: RebalanceProposal = {
        type: 'RebalanceProposal',
        timestamp: Date.now(),
        sender: 'governance',
        proposalId: 'P123',
        newWeights: { '0.0.123': 0.5, '0.0.456': 0.5 },
        executeAfter: Date.now() + 3600000,
        quorum: 1000
      };

      const approval: RebalanceApproved = {
        type: 'RebalanceApproved',
        timestamp: Date.now(),
        sender: 'governance',
        proposalId: 'P123',
        approvedAt: Date.now(),
        approvedBy: 'governance'
      };

      // Store proposal first
      agent['pendingProposals'].set('P123', proposal);

      // Start the agent before testing
      await agent.start();
      await agent['handleRebalanceApproval'](approval);

      // Verify rebalance was executed
      expect(hederaService.publishMessage).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          type: 'RebalanceExecuted',
          proposalId: 'P123',
          preBalances: expect.any(Object),
          postBalances: expect.any(Object)
        } as RebalanceExecuted)
      );
    });

    it('should not execute rebalance when proposal does not exist', async () => {
      const approval: RebalanceApproved = {
        type: 'RebalanceApproved',
        timestamp: Date.now(),
        sender: 'governance',
        proposalId: 'P123',
        approvedAt: Date.now(),
        approvedBy: 'governance'
      };

      await agent['handleRebalanceApproval'](approval);
      expect(hederaService.publishMessage).not.toHaveBeenCalled();
    });
  });

  describe('handleRiskAlert', () => {
    it('should create emergency proposal for high risk alerts', async () => {
      const alert: RiskAlert = {
        type: 'RiskAlert',
        timestamp: Date.now(),
        sender: 'risk-assessment-agent',
        severity: 'high',
        description: 'Test alert',
        affectedTokens: ['0.0.123'],
        metrics: {
          volatility: 0.1,
          priceChange: 0.05
        }
      };

      // Start the agent before testing
      await agent.start();
      await agent['handleRiskAlert'](alert);

      // Verify emergency proposal was published
      expect(hederaService.publishMessage).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          type: 'RebalanceProposal',
          proposalId: expect.stringContaining('emergency-'),
          newWeights: expect.objectContaining({
            '0.0.123': 0.1 // Reduced weight for affected token
          })
        } as RebalanceProposal)
      );
    });

    it('should not create emergency proposal for non-high risk alerts', async () => {
      const alert: RiskAlert = {
        type: 'RiskAlert',
        timestamp: Date.now(),
        sender: 'risk-assessment-agent',
        severity: 'medium',
        description: 'Test alert',
        affectedTokens: ['0.0.123'],
        metrics: {
          volatility: 0.1,
          priceChange: 0.05
        }
      };

      await agent['handleRiskAlert'](alert);
      expect(hederaService.publishMessage).not.toHaveBeenCalled();
    });
  });

  describe('calculateEmergencyWeights', () => {
    it('should reduce weights of affected tokens', () => {
      const alert: RiskAlert = {
        type: 'RiskAlert',
        timestamp: Date.now(),
        sender: 'risk-assessment-agent',
        severity: 'high',
        description: 'Test alert',
        affectedTokens: ['0.0.123'],
        metrics: {
          volatility: 0.1,
          priceChange: 0.05
        }
      };

      // Set up some current balances
      agent['currentBalances'].set('0.0.123', 1000);
      agent['currentBalances'].set('0.0.456', 1000);

      const weights = agent['calculateEmergencyWeights'](alert);

      // Verify affected token weight is reduced
      expect(weights['0.0.123']).toBe(0.1);
      // Verify other token weight is increased
      expect(weights['0.0.456']).toBe(0.9);
    });
  });
}); 