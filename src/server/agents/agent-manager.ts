import { HederaService } from '../hedera';
import { PriceFeedAgent } from './price-feed-agent';
import { RiskAssessmentAgent } from './risk-assessment-agent';
import { RebalanceAgent } from './rebalance-agent';

export class AgentManager {
  private hederaService: HederaService;
  private priceFeedAgent: PriceFeedAgent;
  private riskAssessmentAgent: RiskAssessmentAgent;
  private rebalanceAgent: RebalanceAgent;
  private runningAgents: Set<string> = new Set();

  constructor() {
    this.hederaService = new HederaService();
    this.priceFeedAgent = new PriceFeedAgent(this.hederaService);
    this.riskAssessmentAgent = new RiskAssessmentAgent(this.hederaService);
    this.rebalanceAgent = new RebalanceAgent(this.hederaService);
  }

  public async startAgent(agentId: string): Promise<void> {
    if (this.runningAgents.has(agentId)) {
      throw new Error(`Agent ${agentId} is already running`);
    }

    try {
      switch (agentId) {
        case 'price-feed':
          await this.priceFeedAgent.start();
          break;
        case 'risk-assessment':
          await this.riskAssessmentAgent.start();
          break;
        case 'rebalance':
          await this.rebalanceAgent.start();
          break;
        default:
          throw new Error(`Unknown agent: ${agentId}`);
      }

      this.runningAgents.add(agentId);
      console.log(`Agent ${agentId} started successfully`);
    } catch (error) {
      console.error(`Error starting agent ${agentId}:`, error);
      throw error;
    }
  }

  public async stopAgent(agentId: string): Promise<void> {
    if (!this.runningAgents.has(agentId)) {
      return;
    }

    try {
      switch (agentId) {
        case 'price-feed':
          await this.priceFeedAgent.stop();
          break;
        case 'risk-assessment':
          await this.riskAssessmentAgent.stop();
          break;
        case 'rebalance':
          await this.rebalanceAgent.stop();
          break;
        default:
          throw new Error(`Unknown agent: ${agentId}`);
      }

      this.runningAgents.delete(agentId);
      console.log(`Agent ${agentId} stopped successfully`);
    } catch (error) {
      console.error(`Error stopping agent ${agentId}:`, error);
      throw error;
    }
  }

  public getAgentStatus(agentId: string): 'running' | 'stopped' | 'error' {
    if (!this.runningAgents.has(agentId)) {
      return 'stopped';
    }

    try {
      switch (agentId) {
        case 'price-feed':
          return this.runningAgents.has('price-feed') ? 'running' : 'error';
        case 'risk-assessment':
          return this.runningAgents.has('risk-assessment') ? 'running' : 'error';
        case 'rebalance':
          return this.runningAgents.has('rebalance') ? 'running' : 'error';
        default:
          return 'error';
      }
    } catch (error) {
      console.error(`Error getting status for agent ${agentId}:`, error);
      return 'error';
    }
  }

  public getAllAgentStatuses(): { [key: string]: 'running' | 'stopped' | 'error' } {
    return {
      'price-feed': this.getAgentStatus('price-feed'),
      'risk-assessment': this.getAgentStatus('risk-assessment'),
      'rebalance': this.getAgentStatus('rebalance')
    };
  }

  public async start(): Promise<void> {
    try {
      await this.hederaService.initializeTopics();
      console.log('AgentManager started successfully');
    } catch (error) {
      console.error('Error starting AgentManager:', error);
      throw error;
    }
  }

  public async stop(): Promise<void> {
    try {
      // Stop all running agents
      for (const agentId of this.runningAgents) {
        await this.stopAgent(agentId);
      }
      console.log('AgentManager stopped successfully');
    } catch (error) {
      console.error('Error stopping AgentManager:', error);
      throw error;
    }
  }
} 