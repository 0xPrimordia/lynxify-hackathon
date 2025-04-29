import { HederaService } from '../../app/services/hedera';
import { HCSMessage } from '../../app/types/hcs';

export const mockHederaService: jest.Mocked<HederaService> = {
  publishMessage: jest.fn().mockResolvedValue(undefined),
  subscribeToTopic: jest.fn().mockResolvedValue(undefined),
  unsubscribeFromTopic: jest.fn().mockResolvedValue(undefined),
  createGovernanceTopic: jest.fn().mockResolvedValue('0.0.1234568'),
  createAgentTopic: jest.fn().mockResolvedValue('0.0.1234569'),
} as unknown as jest.Mocked<HederaService>; 