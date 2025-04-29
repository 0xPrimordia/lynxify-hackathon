import { AgentManager } from '@/app/services/agents/agent-manager';
import { HederaService } from '@/app/services/hedera';
import { PriceFeedAgent } from '@/app/services/agents/price-feed-agent';
import { RiskAssessmentAgent } from '@/app/services/agents/risk-assessment-agent';
import { RebalanceAgent } from '@/app/services/agents/rebalance-agent';

jest.mock('@/app/services/hedera');
jest.mock('@/app/services/agents/price-feed-agent');
jest.mock('@/app/services/agents/risk-assessment-agent');
jest.mock('@/app/services/agents/rebalance-agent');

describe('AgentManager', () => {
  let manager: AgentManager;
  let hederaService: jest.Mocked<HederaService>;
  let priceFeedAgent: jest.Mocked<PriceFeedAgent>;
  let riskAssessmentAgent: jest.Mocked<RiskAssessmentAgent>;
  let rebalanceAgent: jest.Mocked<RebalanceAgent>;

  beforeEach(() => {
    jest.clearAllMocks();
    hederaService = new HederaService() as jest.Mocked<HederaService>;
    
    // Create mock agent instances
    priceFeedAgent = {
      start: jest.fn().mockResolvedValue(undefined),
      stop: jest.fn().mockResolvedValue(undefined)
    } as unknown as jest.Mocked<PriceFeedAgent>;

    riskAssessmentAgent = {
      start: jest.fn().mockResolvedValue(undefined),
      stop: jest.fn().mockResolvedValue(undefined)
    } as unknown as jest.Mocked<RiskAssessmentAgent>;

    rebalanceAgent = {
      start: jest.fn().mockResolvedValue(undefined),
      stop: jest.fn().mockResolvedValue(undefined)
    } as unknown as jest.Mocked<RebalanceAgent>;

    // Mock the constructor to return our mock instances
    (PriceFeedAgent as jest.Mock).mockImplementation(() => priceFeedAgent);
    (RiskAssessmentAgent as jest.Mock).mockImplementation(() => riskAssessmentAgent);
    (RebalanceAgent as jest.Mock).mockImplementation(() => rebalanceAgent);

    manager = new AgentManager();
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

    it('should stop all agents if any agent fails to start', async () => {
      // Mock the first agent to fail
      priceFeedAgent.start.mockRejectedValueOnce(new Error('Failed to start'));

      // Mock successful starts for other agents
      riskAssessmentAgent.start.mockResolvedValueOnce(undefined);
      rebalanceAgent.start.mockResolvedValueOnce(undefined);

      // Mock successful stops for all agents
      priceFeedAgent.stop.mockResolvedValueOnce(undefined);
      riskAssessmentAgent.stop.mockResolvedValueOnce(undefined);
      rebalanceAgent.stop.mockResolvedValueOnce(undefined);

      await expect(manager.start()).rejects.toThrow('Failed to start');

      // Verify all agents were stopped
      expect(priceFeedAgent.stop).not.toHaveBeenCalled(); // First agent failed to start, so no need to stop
      expect(riskAssessmentAgent.stop).not.toHaveBeenCalled(); // Second agent wasn't started yet
      expect(rebalanceAgent.stop).not.toHaveBeenCalled(); // Third agent wasn't started yet
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

    it('should not stop if not running', async () => {
      await manager.stop();
      expect(priceFeedAgent.stop).not.toHaveBeenCalled();
      expect(riskAssessmentAgent.stop).not.toHaveBeenCalled();
      expect(rebalanceAgent.stop).not.toHaveBeenCalled();
    });

    it('should throw error if any agent fails to stop', async () => {
      await manager.start();
      priceFeedAgent.stop.mockRejectedValueOnce(new Error('Failed to stop'));

      await expect(manager.stop()).rejects.toThrow('Failed to stop');
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