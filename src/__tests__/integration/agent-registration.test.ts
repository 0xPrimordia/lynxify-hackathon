import { AgentRegistryService } from '@/app/services/agent-registry';
import fs from 'fs/promises';
import { HCS10Client, AgentBuilder } from '@hashgraphonline/standards-sdk';

// Create mock for createAndRegisterAgent that we can reference
const createAndRegisterAgentMock = jest.fn().mockResolvedValue({
  metadata: {
    accountId: '0.0.12345',
    inboundTopicId: '0.0.67890',
    outboundTopicId: '0.0.54321',
  }
});

// Mock the standards-sdk
jest.mock('@hashgraphonline/standards-sdk', () => {
  return {
    HCS10Client: jest.fn().mockImplementation(() => ({
      createAndRegisterAgent: createAndRegisterAgentMock
    })),
    AgentBuilder: jest.fn().mockImplementation(() => ({
      setName: jest.fn().mockReturnThis(),
      setAlias: jest.fn().mockReturnThis(),
      setBio: jest.fn().mockReturnThis(),
      setCapabilities: jest.fn().mockReturnThis(),
      setCreator: jest.fn().mockReturnThis(),
      setModel: jest.fn().mockReturnThis(),
    })),
    AIAgentCapability: {
      TEXT_GENERATION: 'TEXT_GENERATION',
      KNOWLEDGE_RETRIEVAL: 'KNOWLEDGE_RETRIEVAL',
      DATA_INTEGRATION: 'DATA_INTEGRATION'
    },
    Logger: jest.fn().mockImplementation(() => ({
      info: jest.fn(),
      error: jest.fn(),
      debug: jest.fn(),
    })),
  };
});

// Mock fs/promises
jest.mock('fs/promises', () => ({
  readFile: jest.fn(),
  writeFile: jest.fn((path, data) => Promise.resolve())
}));

describe('Agent Registration Integration', () => {
  let agentRegistry: AgentRegistryService;
  
  beforeEach(() => {
    jest.clearAllMocks();
    agentRegistry = new AgentRegistryService();
    
    // Reset mocks
    (fs.readFile as jest.Mock).mockRejectedValue(new Error('File not found'));
    (fs.writeFile as jest.Mock).mockImplementation((path, data) => Promise.resolve());
  });
  
  test('should register a new agent with Moonscape', async () => {
    // Mock isAlreadyRegistered to return false (not registered)
    jest.spyOn(agentRegistry, 'isAlreadyRegistered').mockResolvedValue(false);
    
    // Registration parameters
    const operatorId = '0.0.4340026';
    const operatorKey = 'mock-private-key';
    const registryUrl = 'https://moonscape.tech';
    const registryTopic = '0.0.12345';
    
    // Call the register method
    const result = await agentRegistry.registerAgent(
      operatorId,
      operatorKey,
      registryUrl,
      registryTopic
    );
    
    // Verify results
    expect(result.success).toBe(true);
    expect(result.accountId).toBe('0.0.12345');
    expect(result.inboundTopicId).toBe('0.0.67890');
    expect(result.outboundTopicId).toBe('0.0.54321');
    
    // Verify createAndRegisterAgent was called
    expect(createAndRegisterAgentMock).toHaveBeenCalled();
    
    // Verify the registration status was stored
    expect(fs.writeFile).toHaveBeenCalledWith(
      expect.any(String),
      expect.stringContaining('accountId')
    );
  });
  
  test('should detect previously registered agent', async () => {
    // Mock file reading to simulate existing registration
    (fs.readFile as jest.Mock).mockResolvedValue(JSON.stringify({
      accountId: '0.0.4340026',
      inboundTopicId: '0.0.67890',
      outboundTopicId: '0.0.54321',
      registryTopic: '0.0.12345',
      timestamp: Date.now()
    }));
    
    // Check if registered
    const isRegistered = await agentRegistry.isAlreadyRegistered(
      '0.0.4340026',
      '0.0.12345'
    );
    
    // Verify results
    expect(isRegistered).toBe(true);
    expect(fs.readFile).toHaveBeenCalled();
  });
  
  test('should retrieve stored registration information', async () => {
    // Mock stored data
    const storedData = {
      accountId: '0.0.4340026',
      inboundTopicId: '0.0.67890',
      outboundTopicId: '0.0.54321',
      registryTopic: '0.0.12345',
      timestamp: Date.now()
    };
    
    // Mock file reading to return the stored data
    (fs.readFile as jest.Mock).mockResolvedValue(JSON.stringify(storedData));
    
    // Get stored info
    const info = await agentRegistry.getStoredRegistrationInfo();
    
    // Verify results
    expect(info).toEqual(storedData);
    expect(fs.readFile).toHaveBeenCalled();
  });
  
  test('should handle registration failure', async () => {
    // Mock HCS10Client to simulate registration failure
    createAndRegisterAgentMock.mockResolvedValueOnce(null);
    
    // Call register with valid params
    const result = await agentRegistry.registerAgent(
      '0.0.4340026',
      'mock-private-key',
      'https://moonscape.tech',
      '0.0.12345'
    );
    
    // Verify failure result
    expect(result.success).toBe(false);
    expect(result.accountId).toBeUndefined();
    expect(fs.writeFile).not.toHaveBeenCalled();
  });
  
  test('should handle exceptions during registration', async () => {
    // Mock HCS10Client to throw an error
    createAndRegisterAgentMock.mockRejectedValueOnce(new Error('Network error'));
    
    // Call register
    const result = await agentRegistry.registerAgent(
      '0.0.4340026',
      'mock-private-key',
      'https://moonscape.tech',
      '0.0.12345'
    );
    
    // Verify failure result
    expect(result.success).toBe(false);
    expect(fs.writeFile).not.toHaveBeenCalled();
  });
}); 