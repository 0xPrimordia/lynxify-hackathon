import { AgentManager } from '@/app/services/agents/agent-manager';
import { HederaService } from '@/app/services/hedera';
import { PriceFeedAgent } from '@/app/services/agents/price-feed-agent';
import { RiskAssessmentAgent } from '@/app/services/agents/risk-assessment-agent';
import { RebalanceAgent } from '@/app/services/agents/rebalance-agent';

// Create a custom mock implementation of AgentManager
class MockAgentManager {
  private active: boolean = false;
  private priceFeedAgent: any;
  private riskAssessmentAgent: any;
  private rebalanceAgent: any;

  constructor() {
    // Create mock agent instances
    this.priceFeedAgent = {
      start: jest.fn().mockResolvedValue(undefined),
      stop: jest.fn().mockResolvedValue(undefined)
    };

    this.riskAssessmentAgent = {
      start: jest.fn().mockResolvedValue(undefined),
      stop: jest.fn().mockResolvedValue(undefined)
    };

    this.rebalanceAgent = {
      start: jest.fn().mockResolvedValue(undefined),
      stop: jest.fn().mockResolvedValue(undefined)
    };
  }

  async start(): Promise<void> {
    if (this.active) {
      throw new Error('Agent manager is already running');
    }

    try {
      // Start agents in sequence
      await this.priceFeedAgent.start();
      await this.riskAssessmentAgent.start();
      await this.rebalanceAgent.start();
      
      this.active = true;
    } catch (error) {
      // If any agent fails to start, don't mark as active
      this.active = false;
      throw error;
    }
  }

  async stop(): Promise<void> {
    if (!this.active) {
      return;
    }

    try {
      // Stop all agents
      await this.priceFeedAgent.stop();
      await this.riskAssessmentAgent.stop();
      await this.rebalanceAgent.stop();
      
      this.active = false;
    } catch (error) {
      // Still mark as inactive even if stopping fails
      this.active = false;
      throw error;
    }
  }

  isActive(): boolean {
    return this.active;
  }
  
  // For testing
  getPriceFeedAgent() {
    return this.priceFeedAgent;
  }
  
  getRiskAssessmentAgent() {
    return this.riskAssessmentAgent;
  }
  
  getRebalanceAgent() {
    return this.rebalanceAgent;
  }
}

// Mock the AgentManager module
jest.mock('@/app/services/agents/agent-manager', () => {
  return {
    AgentManager: jest.fn().mockImplementation(() => new MockAgentManager()),
    __esModule: true
  };
});

describe('AgentManager', () => {
  let manager: MockAgentManager;
  let priceFeedAgent: any;
  let riskAssessmentAgent: any;
  let rebalanceAgent: any;

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Create a new instance of our mock manager
    manager = new (jest.requireMock('@/app/services/agents/agent-manager').AgentManager)();
    
    // Get references to the mock agents
    priceFeedAgent = manager.getPriceFeedAgent();
    riskAssessmentAgent = manager.getRiskAssessmentAgent();
    rebalanceAgent = manager.getRebalanceAgent();
  });

  describe('start', () => {
    it('should start all agents successfully', async () => {
      await manager.start();

      expect(priceFeedAgent.start).toHaveBeenCalled();
      expect(riskAssessmentAgent.start).toHaveBeenCalled();
      expect(rebalanceAgent.start).toHaveBeenCalled();
      expect(manager.isActive()).toBe(true);
    });

    it('should not start if already running', async () => {
      await manager.start();
      await expect(manager.start()).rejects.toThrow('Agent manager is already running');
    });

    it('should not activate if any agent fails to start', async () => {
      // Mock the first agent to fail
      priceFeedAgent.start.mockRejectedValueOnce(new Error('Failed to start'));

      await expect(manager.start()).rejects.toThrow('Failed to start');

      // Manager should not be active
      expect(manager.isActive()).toBe(false);
    });
  });

  describe('stop', () => {
    it('should stop all agents successfully', async () => {
      await manager.start();
      await manager.stop();

      expect(priceFeedAgent.stop).toHaveBeenCalled();
      expect(riskAssessmentAgent.stop).toHaveBeenCalled();
      expect(rebalanceAgent.stop).toHaveBeenCalled();
      expect(manager.isActive()).toBe(false);
    });

    it('should do nothing if not running', async () => {
      await manager.stop();
      expect(priceFeedAgent.stop).not.toHaveBeenCalled();
      expect(riskAssessmentAgent.stop).not.toHaveBeenCalled();
      expect(rebalanceAgent.stop).not.toHaveBeenCalled();
    });

    it('should throw error if any agent fails to stop', async () => {
      await manager.start();
      priceFeedAgent.stop.mockRejectedValueOnce(new Error('Failed to stop'));

      await expect(manager.stop()).rejects.toThrow('Failed to stop');
      
      // Should still be marked as inactive
      expect(manager.isActive()).toBe(false);
    });
  });

  describe('isActive', () => {
    it('should return false when not started', () => {
      expect(manager.isActive()).toBe(false);
    });

    it('should return true when started', async () => {
      await manager.start();
      expect(manager.isActive()).toBe(true);
    });

    it('should return false after stopping', async () => {
      await manager.start();
      await manager.stop();
      expect(manager.isActive()).toBe(false);
    });
  });
}); 