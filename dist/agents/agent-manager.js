"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AgentManager = void 0;
const hedera_1 = require("../hedera");
const price_feed_agent_1 = require("./price-feed-agent");
const risk_assessment_agent_1 = require("./risk-assessment-agent");
const rebalance_agent_1 = require("./rebalance-agent");
class AgentManager {
    constructor() {
        this.runningAgents = new Set();
        this.hederaService = new hedera_1.HederaService();
        this.priceFeedAgent = new price_feed_agent_1.PriceFeedAgent(this.hederaService);
        this.riskAssessmentAgent = new risk_assessment_agent_1.RiskAssessmentAgent(this.hederaService);
        this.rebalanceAgent = new rebalance_agent_1.RebalanceAgent(this.hederaService);
    }
    startAgent(agentId) {
        return __awaiter(this, void 0, void 0, function* () {
            if (this.runningAgents.has(agentId)) {
                throw new Error(`Agent ${agentId} is already running`);
            }
            try {
                switch (agentId) {
                    case 'price-feed':
                        yield this.priceFeedAgent.start();
                        break;
                    case 'risk-assessment':
                        yield this.riskAssessmentAgent.start();
                        break;
                    case 'rebalance':
                        yield this.rebalanceAgent.start();
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
        });
    }
    stopAgent(agentId) {
        return __awaiter(this, void 0, void 0, function* () {
            if (!this.runningAgents.has(agentId)) {
                return;
            }
            try {
                switch (agentId) {
                    case 'price-feed':
                        yield this.priceFeedAgent.stop();
                        break;
                    case 'risk-assessment':
                        yield this.riskAssessmentAgent.stop();
                        break;
                    case 'rebalance':
                        yield this.rebalanceAgent.stop();
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
        });
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
    start() {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                yield this.hederaService.initializeTopics();
                console.log('AgentManager started successfully');
            }
            catch (error) {
                console.error('Error starting AgentManager:', error);
                throw error;
            }
        });
    }
    stop() {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                // Stop all running agents
                for (const agentId of this.runningAgents) {
                    yield this.stopAgent(agentId);
                }
                console.log('AgentManager stopped successfully');
            }
            catch (error) {
                console.error('Error stopping AgentManager:', error);
                throw error;
            }
        });
    }
}
exports.AgentManager = AgentManager;
