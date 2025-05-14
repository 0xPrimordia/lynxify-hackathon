export const mockHederaService = {
    publishMessage: jest.fn().mockResolvedValue(undefined),
    subscribeToTopic: jest.fn().mockResolvedValue(undefined),
    unsubscribeFromTopic: jest.fn().mockResolvedValue(undefined),
    createGovernanceTopic: jest.fn().mockResolvedValue('0.0.1234568'),
    createAgentTopic: jest.fn().mockResolvedValue('0.0.1234569'),
};
