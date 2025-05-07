import { HCSMessagingService } from '@/app/services/hcs-messaging';
import { HederaService } from '@/app/services/hedera';
import { HCSMessage } from '@/app/types/hcs';

// Mock HederaService
jest.mock('@/app/services/hedera', () => {
  return {
    HederaService: jest.fn().mockImplementation(() => ({
      publishHCSMessage: jest.fn().mockResolvedValue(true),
      subscribeToTopic: jest.fn().mockResolvedValue(true),
    })),
  };
});

/**
 * Integration test for HCS-10 messaging service
 */
describe('HCS-10 Messaging Integration', () => {
  let hcsMessaging: HCSMessagingService;
  let hederaService: HederaService;
  
  beforeEach(() => {
    jest.clearAllMocks();
    hederaService = new HederaService();
    hcsMessaging = new HCSMessagingService(hederaService);
  });
  
  test('should format and send message in HCS-10 format to Moonscape', async () => {
    // Setup test data
    const outboundTopicId = '0.0.12345';
    const inboundTopicId = '0.0.67890';
    const operatorId = '0.0.4340026';
    const message: HCSMessage = {
      id: 'test-message',
      type: 'AgentInfo',
      timestamp: Date.now(),
      sender: 'test-agent',
      details: {
        message: 'Test message content',
        rebalancerStatus: 'processing',
        proposalId: 'proposal-123',
        executedAt: Date.now()
      }
    };
    
    // Send message
    const result = await hcsMessaging.sendToMoonscape(
      outboundTopicId, 
      inboundTopicId, 
      operatorId, 
      message
    );
    
    // Verify results
    expect(result).toBe(true);
    
    // Verify HederaService was called with properly formatted HCS-10 message
    expect(hederaService.publishHCSMessage).toHaveBeenCalledWith(
      outboundTopicId,
      expect.objectContaining({
        p: 'hcs-10',             // Protocol identifier
        op: 'message',           // Operation type
        operator_id: expect.stringContaining(inboundTopicId),
        data: expect.stringContaining('"type":"AgentInfo"')
      })
    );
  });
  
  test('should send agent status updates in HCS-10 format', async () => {
    // Setup test data
    const outboundTopicId = '0.0.12345';
    const inboundTopicId = '0.0.67890';
    const operatorId = '0.0.4340026';
    const pendingProposals = 3;
    const executedProposals = 5;
    
    // Send status update
    const result = await hcsMessaging.sendAgentStatus(
      outboundTopicId,
      inboundTopicId,
      operatorId,
      pendingProposals,
      executedProposals
    );
    
    // Verify results
    expect(result).toBe(true);
    
    // Verify HederaService was called with HCS-10 status message
    expect(hederaService.publishHCSMessage).toHaveBeenCalledWith(
      outboundTopicId,
      expect.objectContaining({
        p: 'hcs-10',
        op: 'message',
        operator_id: expect.stringContaining(inboundTopicId),
        data: expect.stringContaining('"type":"AgentStatus"')
      })
    );
    
    // Verify status data was included
    const callArgs = (hederaService.publishHCSMessage as jest.Mock).mock.calls[0];
    const messageData = callArgs[1];
    const parsedData = JSON.parse(messageData.data);
    
    expect(parsedData.metadata.pendingProposals).toBe(pendingProposals);
    expect(parsedData.metadata.executedProposals).toBe(executedProposals);
    expect(parsedData.metadata.status).toBe('active');
  });
  
  test('should handle standard HCS message sending', async () => {
    // Setup test data
    const topicId = '0.0.12345';
    const message: HCSMessage = {
      id: 'test-message',
      type: 'RebalanceProposal',
      timestamp: Date.now(),
      sender: 'test-agent',
      details: {
        newWeights: { BTC: 0.5, ETH: 0.3, SOL: 0.2 },
        executeAfter: Date.now() + 3600000,
        quorum: 5000
      }
    };
    
    // Send message
    const result = await hcsMessaging.sendHCSMessage(topicId, message);
    
    // Verify results
    expect(result).toBe(true);
    expect(hederaService.publishHCSMessage).toHaveBeenCalledWith(topicId, message);
  });
  
  test('should handle errors when sending fails', async () => {
    // Mock publishHCSMessage to fail
    (hederaService.publishHCSMessage as jest.Mock).mockRejectedValue(new Error('Network error'));
    
    // Setup test data
    const topicId = '0.0.12345';
    const message: HCSMessage = {
      id: 'test-message',
      type: 'RebalanceProposal',
      timestamp: Date.now(),
      sender: 'test-agent',
      details: {
        newWeights: { BTC: 0.5, ETH: 0.3, SOL: 0.2 }
      }
    };
    
    // Mock console.error
    const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    
    // Try to send message
    const result = await hcsMessaging.sendHCSMessage(topicId, message);
    
    // Verify results
    expect(result).toBe(false);
    expect(consoleErrorSpy).toHaveBeenCalled();
    expect(consoleErrorSpy.mock.calls[0][0]).toContain('Failed to send message');
    
    // Restore console.error
    consoleErrorSpy.mockRestore();
  });
  
  test('should handle missing topic IDs', async () => {
    // Setup test data with empty topic ID
    const topicId = '';
    const message: HCSMessage = {
      id: 'test-message',
      type: 'RebalanceProposal',
      timestamp: Date.now(),
      sender: 'test-agent',
      details: {}
    };
    
    // Mock console.log
    const consoleLogSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
    
    // Try to send message
    const result = await hcsMessaging.sendHCSMessage(topicId, message);
    
    // Verify results
    expect(result).toBe(false);
    expect(consoleLogSpy).toHaveBeenCalled();
    expect(consoleLogSpy.mock.calls[0][0]).toContain('Cannot send message');
    expect(hederaService.publishHCSMessage).not.toHaveBeenCalled();
    
    // Restore console.log
    consoleLogSpy.mockRestore();
  });
}); 