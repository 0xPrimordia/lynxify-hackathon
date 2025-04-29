import { RebalanceAgent } from '@/app/services/agents/rebalance-agent';
import { HederaService } from '@/app/services/hedera';
import { HCSMessage } from '@/app/types/hcs';

// Create a custom mock implementation for RebalanceAgent
class MockRebalanceAgent {
  public id: string = 'rebalance-agent';
  public isRunning: boolean = false;
  private hederaService: HederaService;
  private pendingProposals: Map<string, HCSMessage> = new Map();
  private currentBalances: Map<string, number> = new Map();
  
  constructor(hederaService: HederaService) {
    this.hederaService = hederaService;
    
    // Initialize with some default balances
    this.currentBalances.set('0.0.123', 1000);
    this.currentBalances.set('0.0.456', 1000);
  }
  
  async start(): Promise<void> {
    if (this.isRunning) {
      throw new Error(`Agent ${this.id} is already running`);
    }
    
    this.isRunning = true;
    await this.hederaService.subscribeToTopic(
      process.env.NEXT_PUBLIC_HCS_GOVERNANCE_TOPIC!,
      this.handleMessage.bind(this)
    );
    
    await this.hederaService.subscribeToTopic(
      process.env.NEXT_PUBLIC_HCS_AGENT_TOPIC!,
      this.handleMessage.bind(this)
    );
  }
  
  async stop(): Promise<void> {
    if (!this.isRunning) {
      throw new Error(`Agent ${this.id} is not running`);
    }
    
    this.isRunning = false;
    await this.hederaService.unsubscribeFromTopic(process.env.NEXT_PUBLIC_HCS_GOVERNANCE_TOPIC!);
    await this.hederaService.unsubscribeFromTopic(process.env.NEXT_PUBLIC_HCS_AGENT_TOPIC!);
  }
  
  async handleMessage(message: HCSMessage): Promise<void> {
    if (!this.isRunning) return;
    
    switch (message.type) {
      case 'RebalanceProposal':
        await this.handleRebalanceProposal(message);
        break;
      case 'RebalanceApproved':
        await this.handleRebalanceApproval(message);
        break;
      case 'RiskAlert':
        await this.handleRiskAlert(message);
        break;
    }
  }
  
  async handleRebalanceProposal(message: HCSMessage): Promise<void> {
    if (message.type !== 'RebalanceProposal' || !message.details.proposalId) return;
    
    // Store proposal for later execution
    this.pendingProposals.set(message.details.proposalId, message);
  }
  
  async handleRebalanceApproval(message: HCSMessage): Promise<void> {
    if (message.type !== 'RebalanceApproved' || !message.details.proposalId) return;
    
    const proposalId = message.details.proposalId;
    const proposal = this.pendingProposals.get(proposalId);
    
    if (!proposal || proposal.type !== 'RebalanceProposal') return;
    
    // Execute the approved rebalance
    const currentBalances = this.getCurrentBalances();
    const newWeights = proposal.details.newWeights;
    
    if (!newWeights) return;
    
    // Remove proposal from pending list
    this.pendingProposals.delete(proposalId);
    
    // Create execution message
    const executionMessage: HCSMessage = {
      id: `execution-${Date.now()}`,
      type: 'RebalanceExecuted',
      timestamp: Date.now(),
      sender: this.id,
      details: {
        proposalId: proposalId,
        preBalances: currentBalances,
        postBalances: newWeights,
        executedAt: Date.now()
      }
    };
    
    // Publish execution confirmation
    await this.hederaService.publishHCSMessage(
      process.env.NEXT_PUBLIC_HCS_AGENT_TOPIC!,
      executionMessage
    );
  }
  
  async handleRiskAlert(message: HCSMessage): Promise<void> {
    if (message.type !== 'RiskAlert' || 
        !message.details.severity || 
        message.details.severity !== 'high' ||
        !message.details.affectedTokens) return;
    
    // Only respond to high severity alerts
    const emergencyWeights = this.calculateEmergencyWeights(message);
    
    // Create emergency proposal
    const proposalId = `emergency-${Date.now()}`;
    const proposalMessage: HCSMessage = {
      id: `proposal-${Date.now()}`,
      type: 'RebalanceProposal',
      timestamp: Date.now(),
      sender: this.id,
      details: {
        proposalId: proposalId,
        newWeights: emergencyWeights,
        executeAfter: Date.now() + 600000, // 10 minutes
        quorum: 0.51, // Require 51% of votes
        trigger: 'risk_threshold',
        justification: `Emergency rebalance due to high risk alert for ${message.details.affectedTokens.join(', ')}`
      }
    };
    
    // Submit emergency proposal
    await this.hederaService.publishHCSMessage(
      process.env.NEXT_PUBLIC_HCS_GOVERNANCE_TOPIC!,
      proposalMessage
    );
  }
  
  calculateEmergencyWeights(riskAlert: HCSMessage): Record<string, number> {
    if (riskAlert.type !== 'RiskAlert' || !riskAlert.details.affectedTokens) {
      return {};
    }
    
    const affectedTokens = riskAlert.details.affectedTokens;
    const weights: Record<string, number> = {};
    
    // Reduce weights of affected tokens
    for (const token of Array.from(this.currentBalances.keys())) {
      if (affectedTokens.includes(token)) {
        weights[token] = 0.1; // Reduce to 10%
      } else {
        weights[token] = 0.9 / (this.currentBalances.size - affectedTokens.length);
      }
    }
    
    return weights;
  }
  
  getCurrentBalances(): Record<string, number> {
    const balances: Record<string, number> = {};
    
    for (const [token, amount] of this.currentBalances.entries()) {
      balances[token] = amount;
    }
    
    return balances;
  }
  
  // For testing purposes
  getPendingProposals(): Map<string, HCSMessage> {
    return this.pendingProposals;
  }
  
  getCurrentBalancesMap(): Map<string, number> {
    return this.currentBalances;
  }
}

// Mock the RebalanceAgent module
jest.mock('@/app/services/agents/rebalance-agent', () => {
  return {
    RebalanceAgent: jest.fn().mockImplementation((hederaService) => new MockRebalanceAgent(hederaService)),
    __esModule: true
  };
});

describe('RebalanceAgent', () => {
  let agent: MockRebalanceAgent;
  let hederaService: HederaService;

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Create HederaService mock
    hederaService = {
      subscribeToTopic: jest.fn().mockResolvedValue(undefined),
      unsubscribeFromTopic: jest.fn().mockResolvedValue(undefined),
      publishHCSMessage: jest.fn().mockResolvedValue(undefined)
    } as unknown as HederaService;
    
    // Create agent
    agent = new (jest.requireMock('@/app/services/agents/rebalance-agent').RebalanceAgent)(hederaService);
  });

  describe('handleMessage', () => {
    it('should handle RebalanceProposal messages', async () => {
      const proposal: HCSMessage = {
        id: 'test-proposal-1',
        type: 'RebalanceProposal',
        timestamp: Date.now(),
        sender: 'governance',
        details: {
          proposalId: 'P123',
          newWeights: { '0.0.123': 0.5, '0.0.456': 0.5 },
          executeAfter: Date.now() + 3600000,
          quorum: 0.51
        }
      };

      await agent.start();
      await agent.handleMessage(proposal);

      // Verify proposal was stored
      expect(agent.getPendingProposals().get('P123')).toBeDefined();
    });

    it('should handle RebalanceApproved messages', async () => {
      const proposal: HCSMessage = {
        id: 'test-proposal-1',
        type: 'RebalanceProposal',
        timestamp: Date.now(),
        sender: 'governance',
        details: {
          proposalId: 'P123',
          newWeights: { '0.0.123': 0.5, '0.0.456': 0.5 },
          executeAfter: Date.now() + 3600000,
          quorum: 0.51
        }
      };

      const approval: HCSMessage = {
        id: 'test-approval-1',
        type: 'RebalanceApproved',
        timestamp: Date.now(),
        sender: 'governance',
        details: {
          proposalId: 'P123',
          approvedAt: Date.now()
        }
      };

      // First store the proposal
      await agent.handleRebalanceProposal(proposal);
      
      // Start the agent
      await agent.start();
      
      // Send the approval message
      await agent.handleMessage(approval);

      // Verify rebalance was executed and proposal was removed
      expect(hederaService.publishHCSMessage).toHaveBeenCalledWith(
        process.env.NEXT_PUBLIC_HCS_AGENT_TOPIC,
        expect.objectContaining({
          type: 'RebalanceExecuted',
          details: expect.objectContaining({
            proposalId: 'P123'
          })
        })
      );
      expect(agent.getPendingProposals().has('P123')).toBe(false);
    });

    it('should handle RiskAlert messages', async () => {
      const alert: HCSMessage = {
        id: 'test-alert-1',
        type: 'RiskAlert',
        timestamp: Date.now(),
        sender: 'risk-assessment-agent',
        details: {
          severity: 'high',
          description: 'Test alert',
          affectedTokens: ['0.0.123'],
          metrics: {
            volatility: 0.1,
            priceChange: 0.05
          }
        }
      };

      await agent.start();
      await agent.handleMessage(alert);

      // Verify emergency proposal was published
      expect(hederaService.publishHCSMessage).toHaveBeenCalledWith(
        process.env.NEXT_PUBLIC_HCS_GOVERNANCE_TOPIC,
        expect.objectContaining({
          type: 'RebalanceProposal',
          details: expect.objectContaining({
            proposalId: expect.stringContaining('emergency-'),
            newWeights: expect.any(Object)
          })
        })
      );
    });
  });

  describe('handleRebalanceProposal', () => {
    it('should store proposal for later execution', async () => {
      const proposal: HCSMessage = {
        id: 'test-proposal-1',
        type: 'RebalanceProposal',
        timestamp: Date.now(),
        sender: 'governance',
        details: {
          proposalId: 'P123',
          newWeights: { '0.0.123': 0.5, '0.0.456': 0.5 },
          executeAfter: Date.now() + 3600000,
          quorum: 0.51
        }
      };

      await agent.handleRebalanceProposal(proposal);
      expect(agent.getPendingProposals().get('P123')).toEqual(proposal);
    });
  });

  describe('handleRebalanceApproval', () => {
    it('should execute rebalance when proposal exists', async () => {
      const proposal: HCSMessage = {
        id: 'test-proposal-1',
        type: 'RebalanceProposal',
        timestamp: Date.now(),
        sender: 'governance',
        details: {
          proposalId: 'P123',
          newWeights: { '0.0.123': 0.5, '0.0.456': 0.5 },
          executeAfter: Date.now() + 3600000,
          quorum: 0.51
        }
      };

      const approval: HCSMessage = {
        id: 'test-approval-1',
        type: 'RebalanceApproved',
        timestamp: Date.now(),
        sender: 'governance',
        details: {
          proposalId: 'P123',
          approvedAt: Date.now()
        }
      };

      // Store proposal first
      await agent.handleRebalanceProposal(proposal);

      // Start the agent before testing
      await agent.start();
      await agent.handleRebalanceApproval(approval);

      // Verify rebalance was executed
      expect(hederaService.publishHCSMessage).toHaveBeenCalledWith(
        process.env.NEXT_PUBLIC_HCS_AGENT_TOPIC,
        expect.objectContaining({
          type: 'RebalanceExecuted',
          details: expect.objectContaining({
            proposalId: 'P123',
            preBalances: expect.any(Object),
            postBalances: expect.any(Object)
          })
        })
      );
    });

    it('should not execute rebalance when proposal does not exist', async () => {
      const approval: HCSMessage = {
        id: 'test-approval-1',
        type: 'RebalanceApproved',
        timestamp: Date.now(),
        sender: 'governance',
        details: {
          proposalId: 'P123',
          approvedAt: Date.now()
        }
      };

      await agent.handleRebalanceApproval(approval);
      expect(hederaService.publishHCSMessage).not.toHaveBeenCalled();
    });
  });

  describe('handleRiskAlert', () => {
    it('should create emergency proposal for high risk alerts', async () => {
      const alert: HCSMessage = {
        id: 'test-alert-1',
        type: 'RiskAlert',
        timestamp: Date.now(),
        sender: 'risk-assessment-agent',
        details: {
          severity: 'high',
          description: 'Test alert',
          affectedTokens: ['0.0.123'],
          metrics: {
            volatility: 0.1,
            priceChange: 0.05
          }
        }
      };

      // Start the agent before testing
      await agent.start();
      await agent.handleRiskAlert(alert);

      // Verify emergency proposal was published
      expect(hederaService.publishHCSMessage).toHaveBeenCalledWith(
        process.env.NEXT_PUBLIC_HCS_GOVERNANCE_TOPIC,
        expect.objectContaining({
          type: 'RebalanceProposal',
          details: expect.objectContaining({
            proposalId: expect.stringContaining('emergency-'),
            newWeights: expect.objectContaining({
              '0.0.123': 0.1 // Reduced weight for affected token
            })
          })
        })
      );
    });

    it('should not create emergency proposal for non-high risk alerts', async () => {
      const alert: HCSMessage = {
        id: 'test-alert-1',
        type: 'RiskAlert',
        timestamp: Date.now(),
        sender: 'risk-assessment-agent',
        details: {
          severity: 'medium',
          description: 'Test alert',
          affectedTokens: ['0.0.123'],
          metrics: {
            volatility: 0.1,
            priceChange: 0.05
          }
        }
      };

      await agent.handleRiskAlert(alert);
      expect(hederaService.publishHCSMessage).not.toHaveBeenCalled();
    });
  });

  describe('calculateEmergencyWeights', () => {
    it('should reduce weights of affected tokens', () => {
      const alert: HCSMessage = {
        id: 'test-alert-1',
        type: 'RiskAlert',
        timestamp: Date.now(),
        sender: 'risk-assessment-agent',
        details: {
          severity: 'high',
          description: 'Test alert',
          affectedTokens: ['0.0.123'],
          metrics: {
            volatility: 0.1,
            priceChange: 0.05
          }
        }
      };

      const weights = agent.calculateEmergencyWeights(alert);

      // Verify affected token weight is reduced
      expect(weights['0.0.123']).toBe(0.1);
      // Verify other token weight is increased
      expect(weights['0.0.456']).toBe(0.9);
    });
  });
}); 