"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AgentManager = void 0;
const hedera_js_1 = require("../hedera.js");
const price_feed_agent_js_1 = require("./price-feed-agent.js");
const risk_assessment_agent_js_1 = require("./risk-assessment-agent.js");
const rebalance_agent_js_1 = require("./rebalance-agent.js");
class AgentManager {
    constructor() {
        this.runningAgents = new Set();
        this.hederaService = new hedera_js_1.HederaService();
        this.priceFeedAgent = new price_feed_agent_js_1.PriceFeedAgent(this.hederaService);
        this.riskAssessmentAgent = new risk_assessment_agent_js_1.RiskAssessmentAgent(this.hederaService);
        this.rebalanceAgent = new rebalance_agent_js_1.RebalanceAgent(this.hederaService);
    }
    async startAgent(agentId) {
        if (this.runningAgents.has(agentId)) {
            throw new Error(`Agent ${agentId} is already running`);
        }
        try {
            switch (agentId) {
                case 'price-feed':
                    await this.priceFeedAgent.start();
                    break;
                case 'risk-assessment':
                    await this.riskAssessmentAgent.start();
                    break;
                case 'rebalance':
                    await this.rebalanceAgent.start();
                    break;
                default:
                    throw new Error(`Unknown agent: ${agentId}`);
            }
            this.runningAgents.add(agentId);
            console.log(`Agent ${agentId} started successfully`);
        }
        catch (error) {
            console.error(`Error starting agent ${agentId}:`, error);
            throw error;
        }
    }
    async stopAgent(agentId) {
        if (!this.runningAgents.has(agentId)) {
            return;
        }
        try {
            switch (agentId) {
                case 'price-feed':
                    await this.priceFeedAgent.stop();
                    break;
                case 'risk-assessment':
                    await this.riskAssessmentAgent.stop();
                    break;
                case 'rebalance':
                    await this.rebalanceAgent.stop();
                    break;
                default:
                    throw new Error(`Unknown agent: ${agentId}`);
            }
            this.runningAgents.delete(agentId);
            console.log(`Agent ${agentId} stopped successfully`);
        }
        catch (error) {
            console.error(`Error stopping agent ${agentId}:`, error);
            throw error;
        }
    }
    getAgentStatus(agentId) {
        if (!this.runningAgents.has(agentId)) {
            return 'stopped';
        }
        try {
            switch (agentId) {
                case 'price-feed':
                    return this.runningAgents.has('price-feed') ? 'running' : 'error';
                case 'risk-assessment':
                    return this.runningAgents.has('risk-assessment') ? 'running' : 'error';
                case 'rebalance':
                    return this.runningAgents.has('rebalance') ? 'running' : 'error';
                default:
                    return 'error';
            }
        }
        catch (error) {
            console.error(`Error getting status for agent ${agentId}:`, error);
            return 'error';
        }
    }
    getAllAgentStatuses() {
        return {
            'price-feed': this.getAgentStatus('price-feed'),
            'risk-assessment': this.getAgentStatus('risk-assessment'),
            'rebalance': this.getAgentStatus('rebalance')
        };
    }
    async start() {
        try {
            await this.hederaService.initializeTopics();
            console.log('AgentManager started successfully');
        }
        catch (error) {
            console.error('Error starting AgentManager:', error);
            throw error;
        }
    }
    async stop() {
        try {
            // Stop all running agents
            for (const agentId of this.runningAgents) {
                await this.stopAgent(agentId);
            }
            console.log('AgentManager stopped successfully');
        }
        catch (error) {
            console.error('Error stopping AgentManager:', error);
            throw error;
        }
    }
}
exports.AgentManager = AgentManager;
