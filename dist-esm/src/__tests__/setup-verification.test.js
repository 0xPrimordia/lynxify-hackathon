/**
 * This test verifies that Jest is working correctly
 */
// Set environment variables directly for tests
beforeAll(() => {
    process.env.NEXT_PUBLIC_OPERATOR_ID = '0.0.12345';
    process.env.OPERATOR_KEY = 'mock-operator-key-for-tests-only';
    process.env.NEXT_PUBLIC_HCS_GOVERNANCE_TOPIC = '0.0.12346';
    process.env.NEXT_PUBLIC_HCS_AGENT_TOPIC = '0.0.12347';
    process.env.NEXT_PUBLIC_HCS_PRICE_FEED_TOPIC = '0.0.12348';
});
describe('Setup Verification', () => {
    test('All environment variables are set', () => {
        expect(process.env.NEXT_PUBLIC_OPERATOR_ID).toBe('0.0.12345');
        expect(process.env.OPERATOR_KEY).toBe('mock-operator-key-for-tests-only');
        expect(process.env.NEXT_PUBLIC_HCS_GOVERNANCE_TOPIC).toBe('0.0.12346');
    });
    test('Jest mocking works', () => {
        const mockFn = jest.fn(() => 'test');
        expect(mockFn()).toBe('test');
        expect(mockFn).toHaveBeenCalled();
    });
});
export {};
