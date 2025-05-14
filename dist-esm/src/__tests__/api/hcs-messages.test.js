import { NextRequest } from 'next/server';
import { POST } from '@/app/api/hcs/messages/route';
import * as hederaModule from '@/app/services/hedera';
// Mock the HederaService module
jest.mock('@/app/services/hedera', () => {
    return {
        hederaService: {
            proposeRebalance: jest.fn().mockResolvedValue({ transactionId: 'mock-tx-id' }),
            executeRebalance: jest.fn().mockResolvedValue({ transactionId: 'mock-tx-id' }),
            approveRebalance: jest.fn().mockResolvedValue({ transactionId: 'mock-tx-id' })
        }
    };
});
describe('HCS Messages API Route', () => {
    beforeEach(() => {
        // Reset mocks
        jest.clearAllMocks();
    });
    test('should propose a rebalance successfully', async () => {
        // Create a mock request with the propose action
        const request = new NextRequest('http://localhost:3000/api/hcs/messages', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                action: 'propose',
                newWeights: { 'BTC': 0.5, 'ETH': 0.3, 'SOL': 0.2 },
                executeAfter: Date.now() + 3600000, // 1 hour in the future
                quorum: 0.51,
                trigger: 'market_volatility',
                justification: 'High market volatility requires rebalancing'
            })
        });
        // Call the API route handler
        const response = await POST(request);
        // Verify the response
        expect(response.status).toBe(200);
        const responseData = await response.json();
        expect(responseData.success).toBe(true);
        // Verify that proposeRebalance was called with the correct parameters
        expect(hederaModule.hederaService.proposeRebalance).toHaveBeenCalledWith({ 'BTC': 0.5, 'ETH': 0.3, 'SOL': 0.2 }, expect.any(Number), 0.51, 'market_volatility', 'High market volatility requires rebalancing');
    });
    test('should handle executing a rebalance', async () => {
        // Create a mock request with the execute action
        const request = new NextRequest('http://localhost:3000/api/hcs/messages', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                action: 'execute',
                proposalId: 'P1234567890',
                newWeights: { 'BTC': 0.6, 'ETH': 0.3, 'SOL': 0.1 }
            })
        });
        // Call the API route handler
        const response = await POST(request);
        // Verify the response
        expect(response.status).toBe(200);
        const responseData = await response.json();
        expect(responseData.success).toBe(true);
        // Verify that executeRebalance was called with the correct parameters
        expect(hederaModule.hederaService.executeRebalance).toHaveBeenCalledWith('P1234567890', { 'BTC': 0.6, 'ETH': 0.3, 'SOL': 0.1 });
    });
    test('should handle approving a rebalance', async () => {
        // Create a mock request with the approve action
        const request = new NextRequest('http://localhost:3000/api/hcs/messages', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                action: 'approve',
                proposalId: 'P1234567890'
            })
        });
        // Call the API route handler
        const response = await POST(request);
        // Verify the response
        expect(response.status).toBe(200);
        const responseData = await response.json();
        expect(responseData.success).toBe(true);
        // Verify that approveRebalance was called with the correct parameters
        expect(hederaModule.hederaService.approveRebalance).toHaveBeenCalledWith('P1234567890');
    });
    test('should handle missing required fields', async () => {
        // Create a mock request with missing fields
        const request = new NextRequest('http://localhost:3000/api/hcs/messages', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                action: 'propose',
                // Missing newWeights, executeAfter, quorum
            })
        });
        // Call the API route handler
        const response = await POST(request);
        // Verify the response indicates an error
        expect(response.status).toBe(400);
        const responseData = await response.json();
        expect(responseData.error).toBeTruthy();
    });
    test('should handle invalid action', async () => {
        // Create a mock request with an invalid action
        const request = new NextRequest('http://localhost:3000/api/hcs/messages', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                action: 'invalid_action'
            })
        });
        // Call the API route handler
        const response = await POST(request);
        // Verify the response indicates an error
        expect(response.status).toBe(400);
        const responseData = await response.json();
        expect(responseData.error).toBeTruthy();
    });
});
