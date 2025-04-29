import { HederaService } from '@/app/services/hedera';
import { HCSMessage } from '@/app/types/hcs';
import { Client, TopicId, TopicCreateTransaction, TopicMessageSubmitTransaction, AccountId, PrivateKey, TopicMessageQuery } from '@hashgraph/sdk';

// Mock implementations
const mockExecute = jest.fn().mockResolvedValue({ getReceipt: jest.fn().mockResolvedValue({ topicId: 'mock-topic-id' }) });
const mockSetTopicMemo = jest.fn().mockReturnThis();
const mockSetTopicId = jest.fn().mockReturnThis();
const mockSetMessage = jest.fn().mockReturnThis();
const mockSubscribe = jest.fn().mockReturnThis();

jest.mock('@hashgraph/sdk', () => ({
  Client: {
    forTestnet: jest.fn().mockReturnValue({
      setOperator: jest.fn()
    })
  },
  TopicId: jest.fn(),
  TopicCreateTransaction: jest.fn().mockImplementation(() => ({
    setTopicMemo: mockSetTopicMemo,
    execute: mockExecute
  })),
  TopicMessageSubmitTransaction: jest.fn().mockImplementation(() => ({
    setTopicId: mockSetTopicId,
    setMessage: mockSetMessage,
    execute: mockExecute
  })),
  TopicMessageQuery: jest.fn().mockImplementation(() => ({
    setTopicId: mockSetTopicId,
    subscribe: mockSubscribe
  })),
  AccountId: {
    fromString: jest.fn().mockReturnValue('mock-account-id')
  },
  PrivateKey: {
    fromString: jest.fn().mockReturnValue('mock-private-key')
  }
}));

describe('HederaService', () => {
  let service: HederaService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new HederaService();
  });

  describe('constructor', () => {
    it('should initialize with testnet credentials', () => {
      expect(service).toBeDefined();
      expect(process.env.NEXT_PUBLIC_OPERATOR_ID).toBeDefined();
      expect(process.env.OPERATOR_KEY).toBeDefined();
    });
  });

  describe('createGovernanceTopic', () => {
    it('should create a governance topic', async () => {
      const result = await service.createGovernanceTopic();
      expect(mockSetTopicMemo).toHaveBeenCalledWith('Governance Topic');
      expect(mockExecute).toHaveBeenCalled();
      expect(result).toBe('mock-topic-id');
    });
  });

  describe('createAgentTopic', () => {
    it('should create an agent topic', async () => {
      const result = await service.createAgentTopic();
      expect(mockSetTopicMemo).toHaveBeenCalledWith('Agent Topic');
      expect(mockExecute).toHaveBeenCalled();
      expect(result).toBe('mock-topic-id');
    });
  });

  describe('publishMessage', () => {
    it('should publish a message to a topic', async () => {
      const message: HCSMessage = {
        type: 'PriceUpdate',
        timestamp: Date.now(),
        sender: 'test-agent',
        tokenId: '0.0.123',
        price: 100,
        source: 'test'
      };
      const topicId = 'test-topic';

      await service.publishMessage(topicId, message);
      expect(mockSetTopicId).toHaveBeenCalled();
      expect(mockSetMessage).toHaveBeenCalledWith(JSON.stringify(message));
      expect(mockExecute).toHaveBeenCalled();
    });
  });

  describe('subscribeToTopic', () => {
    it('should subscribe to a topic', async () => {
      const topicId = 'test-topic';
      const callback = jest.fn();

      await service.subscribeToTopic(topicId, callback);
      expect(mockSetTopicId).toHaveBeenCalled();
      expect(mockSubscribe).toHaveBeenCalled();
    });
  });

  describe('unsubscribeFromTopic', () => {
    it('should unsubscribe from a topic', async () => {
      const topicId = '0.0.1234568';
      const callback = jest.fn();

      await service.subscribeToTopic(topicId, callback);
      await service.unsubscribeFromTopic(topicId);

      expect(service['subscriptions'].has(topicId)).toBe(false);
    });

    it('should throw error if not subscribed to topic', async () => {
      const topicId = '0.0.1234568';
      await expect(service.unsubscribeFromTopic(topicId))
        .rejects.toThrow(`Not subscribed to topic ${topicId}`);
    });
  });
}); 