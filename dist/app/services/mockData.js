"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.mockHCSMessages = exports.mockProposals = void 0;
// Create a sequence of events for the demo
var now = Date.now();
var ONE_HOUR = 3600000;
var TWO_HOURS = 7200000;
var THREE_HOURS = 10800000;
exports.mockProposals = [
    {
        id: 'P001',
        type: 'RebalanceProposal',
        status: 'pending',
        timestamp: now - ONE_HOUR,
        sender: 'System',
        details: {
            trigger: 'price_deviation',
            deviation: 7.2,
            riskLevel: 'medium',
            impact: 'Rebalancing to maintain target weights and reduce risk exposure',
            newWeights: {
                'BTC': 0.45,
                'ETH': 0.35,
                'USDC': 0.20
            }
        },
        votes: {
            for: 1200,
            against: 300,
            total: 2000
        }
    }
];
exports.mockHCSMessages = [
    // Initial price update that triggers the rebalance
    {
        id: 'M001',
        type: 'PriceUpdate',
        timestamp: now - THREE_HOURS,
        tokenId: 'BTC',
        price: 65000,
        priceChange: -7.2,
        sender: 'Price Feed Agent'
    },
    // Risk assessment after price drop
    {
        id: 'M002',
        type: 'RiskAlert',
        timestamp: now - TWO_HOURS,
        riskLevel: 'high',
        affectedTokens: ['BTC'],
        trigger: 'price_deviation',
        sender: 'Risk Assessment Agent',
        details: {
            message: 'BTC price deviation exceeds 5% threshold',
            impact: 'High volatility detected in BTC market'
        }
    },
    // System generates rebalance proposal
    {
        id: 'M003',
        type: 'RebalanceProposal',
        timestamp: now - ONE_HOUR,
        sender: 'System',
        details: {
            trigger: 'price_deviation',
            deviation: 7.2,
            newWeights: {
                'BTC': 0.45,
                'ETH': 0.35,
                'USDC': 0.20
            }
        }
    },
    // Proposal approved by DAO
    {
        id: 'M004',
        type: 'RebalanceApproved',
        timestamp: now - 30 * 60 * 1000, // 30 minutes ago
        sender: 'Governance',
        details: {
            proposalId: 'P001',
            approvedAt: now - 30 * 60 * 1000
        }
    },
    // Rebalance executed by agent
    {
        id: 'M005',
        type: 'RebalanceExecuted',
        timestamp: now - 15 * 60 * 1000, // 15 minutes ago
        sender: 'Rebalance Agent',
        details: {
            proposalId: 'P001',
            executedAt: now - 15 * 60 * 1000,
            preBalances: {
                'BTC': 0.50,
                'ETH': 0.30,
                'USDC': 0.20
            },
            postBalances: {
                'BTC': 0.45,
                'ETH': 0.35,
                'USDC': 0.20
            }
        }
    }
];
