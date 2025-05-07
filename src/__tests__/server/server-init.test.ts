import { initializeServer } from '@/app/server/server-init';
import { validateHederaEnv, getAllTopicIds, getOptionalEnv } from '@/app/utils/env-utils';
import { HederaService } from '@/app/services/hedera';
import agentRegistry from '@/app/services/agent-registry';
import hcsMessaging from '@/app/services/hcs-messaging';
import proposalHandler from '@/app/services/proposal-handler';

// Mock all dependencies
jest.mock('@/app/utils/env-utils', () => ({
  validateHederaEnv: jest.fn(),
  getAllTopicIds: jest.fn(),
  getOptionalEnv: jest.fn(),
}));

jest.mock('@/app/services/hedera', () => {
  const mockSubscribeToTopic = jest.fn().mockResolvedValue(undefined);
  
  return {
    HederaService: jest.fn().mockImplementation(() => ({
      subscribeToTopic: mockSubscribeToTopic,
    })),
  };
});

jest.mock('@/app/services/agent-registry', () => ({
  isAlreadyRegistered: jest.fn(),
  registerAgent: jest.fn(),
  getStoredRegistrationInfo: jest.fn(),
}));

jest.mock('@/app/services/hcs-messaging', () => ({
  sendAgentStatus: jest.fn(),
}));

jest.mock('@/app/services/proposal-handler', () => ({
  handleMessage: jest.fn(),
  createTestProposal: jest.fn(),
  getPendingProposalCount: jest.fn().mockReturnValue(0),
  getExecutedProposalCount: jest.fn().mockReturnValue(0),
}));

describe('Server Initialization', () => {
  // Save original console methods
  const originalConsoleLog = console.log;
  const originalConsoleWarn = console.warn;
  const originalConsoleError = console.error;
  
  beforeEach(() => {
    jest.clearAllMocks();
    
    // Silence console output during tests
    console.log = jest.fn();
    console.warn = jest.fn();
    console.error = jest.fn();
    
    // Set up default mocks
    (validateHederaEnv as jest.Mock).mockReturnValue({ valid: true });
    (getAllTopicIds as jest.Mock).mockReturnValue({
      governanceTopic: '0.0.1',
      agentTopic: '0.0.2',
      registryTopic: '0.0.3',
      inboundTopic: '0.0.4',
      outboundTopic: '0.0.5',
      priceFeedTopic: '0.0.6',
      profileTopic: '0.0.7',
    });
    (getOptionalEnv as jest.Mock).mockReturnValue('mock-value');
    (agentRegistry.isAlreadyRegistered as jest.Mock).mockResolvedValue(true);
    (agentRegistry.getStoredRegistrationInfo as jest.Mock).mockResolvedValue({
      accountId: '0.0.123',
      inboundTopicId: '0.0.4',
      outboundTopicId: '0.0.5',
      registryTopic: '0.0.3',
    });
  });
  
  afterEach(() => {
    // Restore console methods
    console.log = originalConsoleLog;
    console.warn = originalConsoleWarn;
    console.error = originalConsoleError;
  });

  test('should initialize successfully with valid environment', async () => {
    await expect(initializeServer()).resolves.not.toThrow();
    
    expect(validateHederaEnv).toHaveBeenCalled();
    expect(getAllTopicIds).toHaveBeenCalled();
    expect(getOptionalEnv).toHaveBeenCalledWith('NEXT_PUBLIC_OPERATOR_ID');
    expect(getOptionalEnv).toHaveBeenCalledWith('OPERATOR_KEY');
    
    // Verify HederaService was instantiated
    expect(HederaService).toHaveBeenCalled();
    
    // Verify topic subscriptions
    const mockHederaInstance = (HederaService as jest.Mock).mock.results[0].value;
    expect(mockHederaInstance.subscribeToTopic).toHaveBeenCalledWith('0.0.1', expect.any(Function));
    expect(mockHederaInstance.subscribeToTopic).toHaveBeenCalledWith('0.0.4', expect.any(Function));
  });
  
  test('should throw error when environment validation fails', async () => {
    (validateHederaEnv as jest.Mock).mockReturnValue({ 
      valid: false, 
      error: 'Missing required environment variables' 
    });
    
    await expect(initializeServer()).rejects.toThrow('Environment validation failed');
    
    expect(validateHederaEnv).toHaveBeenCalled();
    expect(getAllTopicIds).not.toHaveBeenCalled();
  });
  
  test('should handle agent registration when not already registered', async () => {
    (agentRegistry.isAlreadyRegistered as jest.Mock).mockResolvedValue(false);
    (agentRegistry.registerAgent as jest.Mock).mockResolvedValue({
      success: true,
      accountId: '0.0.999',
      inboundTopicId: '0.0.998',
      outboundTopicId: '0.0.997',
    });
    
    await initializeServer();
    
    expect(agentRegistry.isAlreadyRegistered).toHaveBeenCalled();
    expect(agentRegistry.registerAgent).toHaveBeenCalled();
  });
  
  test('should skip registration when registry topic is not configured', async () => {
    (getAllTopicIds as jest.Mock).mockReturnValue({
      governanceTopic: '0.0.1',
      agentTopic: '0.0.2',
      registryTopic: '', // Empty registry topic
      inboundTopic: '0.0.4',
      outboundTopic: '0.0.5',
      priceFeedTopic: '0.0.6',
      profileTopic: '0.0.7',
    });
    
    await initializeServer();
    
    expect(agentRegistry.isAlreadyRegistered).not.toHaveBeenCalled();
    expect(agentRegistry.registerAgent).not.toHaveBeenCalled();
    expect(console.warn).toHaveBeenCalledWith(expect.stringContaining('Registry topic not configured'));
  });
  
  test('should handle missing governance topic', async () => {
    (getAllTopicIds as jest.Mock).mockReturnValue({
      governanceTopic: '', // Empty governance topic
      agentTopic: '0.0.2',
      registryTopic: '0.0.3',
      inboundTopic: '0.0.4',
      outboundTopic: '0.0.5',
      priceFeedTopic: '0.0.6',
      profileTopic: '0.0.7',
    });
    
    await initializeServer();
    
    const mockHederaInstance = (HederaService as jest.Mock).mock.results[0].value;
    expect(mockHederaInstance.subscribeToTopic).not.toHaveBeenCalledWith('', expect.any(Function));
    expect(console.warn).toHaveBeenCalledWith(expect.stringContaining('Governance topic not configured'));
  });
}); 