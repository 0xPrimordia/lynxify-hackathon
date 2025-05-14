import { NextRequest } from 'next/server';
import { POST } from '@/app/api/hcs/messages/route';
import { hederaService } from '@/app/services/hedera';
// Mock the HederaService module
jest.mock('@/app/services/hedera', () => {
    return {
        hederaService: {
            proposeRebalance: jest.fn().mockResolvedValue(undefined),
            approveRebalance: jest.fn().mockResolvedValue(undefined),
            executeRebalance: jest.fn().mockResolvedValue(undefined),
            publishHCSMessage: jest.fn().mockResolvedValue(undefined)
        }
    };
});
describe('Rebalance API Endpoints', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });
    test('API endpoint for proposing a rebalance', async () => {
        // Set up test data
        const newWeights = { 'BTC': 0.5, 'ETH': 0.3, 'SOL': 0.2 };
        const executeAfter = Date.now() + 3600000; // 1 hour in the future
        const quorum = 0.51;
        const trigger = 'price_deviation';
        const justification = 'Market conditions have changed significantly';
        // Create a mock request
        const request = new NextRequest('http://localhost:3000/api/hcs/messages', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                action: 'propose',
                newWeights,
                executeAfter,
                quorum,
                trigger,
                justification
            })
        });
        // Call the API endpoint
        const response = await POST(request);
        // Verify the response
        expect(response.status).toBe(200);
        const responseData = await response.json();
        expect(responseData.success).toBe(true);
        // Verify the correct service method was called with the right parameters
        expect(hederaService.proposeRebalance).toHaveBeenCalledWith(newWeights, executeAfter, quorum, trigger, justification);
    });
    test('API endpoint for approving a rebalance', async () => {
        // Set up test data
        const proposalId = 'P1234567890';
        // Create a mock request
        const request = new NextRequest('http://localhost:3000/api/hcs/messages', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                action: 'approve',
                proposalId
            })
        });
        // Call the API endpoint
        const response = await POST(request);
        // Verify the response
        expect(response.status).toBe(200);
        const responseData = await response.json();
        expect(responseData.success).toBe(true);
        // Verify the correct service method was called with the right parameters
        expect(hederaService.approveRebalance).toHaveBeenCalledWith(proposalId);
    });
    test('API endpoint for executing a rebalance', async () => {
        // Set up test data
        const proposalId = 'P1234567890';
        const newWeights = { 'BTC': 0.5, 'ETH': 0.3, 'SOL': 0.2 };
        // Create a mock request
        const request = new NextRequest('http://localhost:3000/api/hcs/messages', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                action: 'execute',
                proposalId,
                newWeights
            })
        });
        // Call the API endpoint
        const response = await POST(request);
        // Verify the response
        expect(response.status).toBe(200);
        const responseData = await response.json();
        expect(responseData.success).toBe(true);
        // Verify the correct service method was called with the right parameters
        expect(hederaService.executeRebalance).toHaveBeenCalledWith(proposalId, newWeights);
    });
    test('API endpoint handles missing required fields', async () => {
        // Test proposal with missing fields
        const requestPropose = new NextRequest('http://localhost:3000/api/hcs/messages', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                action: 'propose',
                // Missing newWeights, executeAfter, and quorum
            })
        });
        const responsePropose = await POST(requestPropose);
        expect(responsePropose.status).toBe(400);
        // Test execute with missing fields
        const requestExecute = new NextRequest('http://localhost:3000/api/hcs/messages', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                action: 'execute',
                // Missing proposalId and newWeights
            })
        });
        const responseExecute = await POST(requestExecute);
        expect(responseExecute.status).toBe(400);
        // Test approve with missing fields
        const requestApprove = new NextRequest('http://localhost:3000/api/hcs/messages', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                action: 'approve',
                // Missing proposalId
            })
        });
        const responseApprove = await POST(requestApprove);
        expect(responseApprove.status).toBe(400);
    });
    test('API endpoint handles invalid action', async () => {
        const request = new NextRequest('http://localhost:3000/api/hcs/messages', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                action: 'invalid_action'
            })
        });
        const response = await POST(request);
        expect(response.status).toBe(400);
        const responseData = await response.json();
        expect(responseData.error).toBeTruthy();
    });
});
