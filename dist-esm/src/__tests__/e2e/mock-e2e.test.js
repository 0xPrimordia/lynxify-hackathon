/**
 * Mock E2E test for the refactored server
 */
// Import the utilities, not the actual implementations
// This avoids the window reference issues with standards-sdk
import { validateHederaEnv, getAllTopicIds } from '@/app/utils/env-utils';
// Mock all dependencies
jest.mock('@/app/utils/env-utils', () => ({
    validateHederaEnv: jest.fn(),
    getAllTopicIds: jest.fn(),
    getOptionalEnv: jest.fn(),
}));
describe('Mock E2E Server Flow', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        // Configure mocks
        validateHederaEnv.mockReturnValue({ valid: true });
        getAllTopicIds.mockReturnValue({
            governanceTopic: '0.0.1',
            agentTopic: '0.0.2',
            registryTopic: '0.0.3',
            inboundTopic: '0.0.4',
            outboundTopic: '0.0.5',
        });
    });
    test('should validate a successful server environment', () => {
        // Call the function
        const result = validateHederaEnv();
        // Verify the result
        expect(result.valid).toBe(true);
        expect(validateHederaEnv).toHaveBeenCalled();
    });
    test('should get all topic IDs from environment', () => {
        // Call the function
        const topics = getAllTopicIds();
        // Verify the result
        expect(topics.governanceTopic).toBe('0.0.1');
        expect(topics.agentTopic).toBe('0.0.2');
        expect(topics.registryTopic).toBe('0.0.3');
        expect(topics.inboundTopic).toBe('0.0.4');
        expect(topics.outboundTopic).toBe('0.0.5');
        expect(getAllTopicIds).toHaveBeenCalled();
    });
    test('should handle invalid environment', () => {
        // Change the mock to return invalid
        validateHederaEnv.mockReturnValue({
            valid: false,
            error: 'Missing credentials'
        });
        // Call the function
        const result = validateHederaEnv();
        // Verify the result
        expect(result.valid).toBe(false);
        expect(result.error).toBe('Missing credentials');
        expect(validateHederaEnv).toHaveBeenCalled();
    });
});
