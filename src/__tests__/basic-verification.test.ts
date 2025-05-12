/**
 * This test verifies that Jest is working correctly
 * without requiring any complex dependencies
 */

describe('Basic Test Verification', () => {
  test('Jest is running', () => {
    // If this test runs, it means Jest is working properly
    expect(true).toBe(true);
  });
  
  test('Basic math works', () => {
    expect(1 + 1).toBe(2);
    expect(2 * 3).toBe(6);
  });
  
  test('Mocks work', () => {
    const mockFn = jest.fn(() => 'mocked');
    expect(mockFn()).toBe('mocked');
    expect(mockFn).toHaveBeenCalled();
  });
}); 