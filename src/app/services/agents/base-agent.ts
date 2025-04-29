import { HCSMessage } from '../../types/hcs';
import { HederaService } from '../hedera';

export interface AgentConfig {
  id: string;
  type: 'price-feed' | 'risk-assessment' | 'rebalance';
  hederaService: HederaService;
  topics: {
    input: string;
    output: string;
  };
}

export abstract class BaseAgent {
  protected id: string;
  protected type: string;
  protected hederaService: HederaService;
  protected inputTopic: string;
  protected outputTopic: string;
  protected isRunning: boolean = false;

  constructor(config: AgentConfig) {
    this.id = config.id;
    this.type = config.type;
    this.hederaService = config.hederaService;
    this.inputTopic = config.topics.input;
    this.outputTopic = config.topics.output;
  }

  public async start(): Promise<void> {
    if (this.isRunning) {
      throw new Error(`Agent ${this.id} is already running`);
    }

    this.isRunning = true;
    await this.hederaService.subscribeToTopic(this.inputTopic, this.handleMessage.bind(this));
    console.log(`Agent ${this.id} started and listening on topic ${this.inputTopic}`);
  }

  public async stop(): Promise<void> {
    if (!this.isRunning) {
      throw new Error(`Agent ${this.id} is not running`);
    }

    this.isRunning = false;
    await this.hederaService.unsubscribeFromTopic(this.inputTopic);
    console.log(`Agent ${this.id} stopped`);
  }

  protected async publishHCSMessage(message: HCSMessage): Promise<void> {
    if (!this.isRunning) {
      throw new Error(`Agent ${this.id} is not running`);
    }

    await this.hederaService.publishHCSMessage(this.outputTopic, message);
  }

  protected abstract handleMessage(message: HCSMessage): Promise<void>;
} 