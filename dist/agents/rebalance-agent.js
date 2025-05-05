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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.RebalanceAgent = void 0;
const base_agent_1 = require("./base-agent");
const token_service_1 = require("../token-service");
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
class RebalanceAgent extends base_agent_1.BaseAgent {
    constructor(hederaService) {
        super({
            id: 'rebalance-agent',
            type: 'rebalance',
            hederaService,
            topics: {
                input: process.env.NEXT_PUBLIC_HCS_GOVERNANCE_TOPIC,
                output: process.env.NEXT_PUBLIC_HCS_AGENT_TOPIC
            }
        });
        this.isExecuting = false;
        // Initialize token service
        this.tokenService = new token_service_1.TokenService();
        this.tokenDataPath = path_1.default.join(process.cwd(), 'token-data.json');
        console.log('✅ RebalanceAgent initialized with TokenService');
    }
    handleMessage(message) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a, _b;
            console.log(`📥 RebalanceAgent received message: ${message.type}`);
            if (message.type === 'RebalanceApproved' && ((_a = message.details) === null || _a === void 0 ? void 0 : _a.proposalId)) {
                console.log(`🔄 Processing rebalance approval for proposal: ${message.details.proposalId}`);
                try {
                    // Manually find the proposal from message store
                    const proposals = yield this.getProposals();
                    const proposal = proposals.find(p => p.id === message.details.proposalId);
                    if (proposal && proposal.type === 'RebalanceProposal' && ((_b = proposal.details) === null || _b === void 0 ? void 0 : _b.newWeights)) {
                        console.log(`🚀 Executing rebalance for approved proposal: ${proposal.id}`);
                        yield this.executeRebalance(proposal);
                    }
                    else {
                        console.error(`❌ Could not find original proposal: ${message.details.proposalId}`);
                    }
                }
                catch (error) {
                    console.error('❌ Error processing approval message:', error);
                }
            }
        });
    }
    // Mock function to get proposals from message history
    getProposals() {
        return __awaiter(this, void 0, void 0, function* () {
            // This would normally retrieve proposals from the HederaService
            // For now, we'll look at the most recent messages to find proposals
            // In a real implementation, these would be stored in a database
            try {
                // Simple example - normally this would query a real data source
                return [
                    {
                        id: 'prop-1',
                        type: 'RebalanceProposal',
                        proposalId: 'prop-1',
                        details: {
                            newWeights: {
                                'BTC': 0.5,
                                'ETH': 0.3,
                                'SOL': 0.2,
                            }
                        }
                    }
                ];
            }
            catch (error) {
                console.error('❌ Error fetching proposals:', error);
                return [];
            }
        });
    }
    executeRebalance(proposal) {
        return __awaiter(this, void 0, void 0, function* () {
            if (this.isExecuting) {
                console.log('❌ Already executing a rebalance, skipping...');
                return false;
            }
            this.isExecuting = true;
            console.log(`🔄 Starting token rebalance execution for proposal ${proposal.id}...`);
            try {
                // 1. Get current token balances
                const currentBalances = yield this.tokenService.getTokenBalances();
                console.log('📊 Current token balances:', currentBalances);
                // 2. Calculate adjustments needed based on new weights
                const adjustments = this.tokenService.calculateAdjustments(currentBalances, proposal.details.newWeights);
                console.log('📋 Calculated token adjustments:', adjustments);
                // 3. Execute the actual token operations (mint/burn)
                for (const [token, amount] of Object.entries(adjustments)) {
                    if (Math.abs(amount) < 1) {
                        console.log(`⏭️ Skipping minimal adjustment for ${token}: ${amount}`);
                        continue;
                    }
                    const tokenId = this.tokenService.getTokenId(token);
                    if (!tokenId) {
                        console.error(`❌ Token ID not found for ${token}`);
                        continue;
                    }
                    if (amount > 0) {
                        console.log(`🟢 Minting ${amount} ${token} tokens`);
                        const result = yield this.tokenService.mintTokens(token, amount);
                        if (result) {
                            console.log(`✅ Successfully minted ${amount} ${token} tokens`);
                            this.logTokenOperation(token, tokenId, 'MINT', amount, proposal.id);
                        }
                        else {
                            console.error(`❌ Failed to mint ${token} tokens`);
                        }
                    }
                    else if (amount < 0) {
                        const burnAmount = Math.abs(amount);
                        console.log(`🔴 Burning ${burnAmount} ${token} tokens`);
                        const result = yield this.tokenService.burnTokens(token, burnAmount);
                        if (result) {
                            console.log(`✅ Successfully burned ${burnAmount} ${token} tokens`);
                            this.logTokenOperation(token, tokenId, 'BURN', burnAmount, proposal.id);
                        }
                        else {
                            console.error(`❌ Failed to burn ${token} tokens`);
                        }
                    }
                }
                // 4. Publish execution confirmation to HCS
                const executionMessage = {
                    id: `exec-${Date.now()}`,
                    type: 'RebalanceExecuted',
                    timestamp: Date.now(),
                    sender: this.id,
                    details: {
                        proposalId: proposal.id,
                        preBalances: currentBalances,
                        postBalances: yield this.tokenService.getTokenBalances(), // Get updated balances
                        adjustments,
                        executedAt: Date.now(),
                        message: `Successfully executed rebalance for proposal ${proposal.id} with ${Object.keys(adjustments).length} token adjustments`
                    }
                };
                yield this.publishHCSMessage(executionMessage);
                console.log(`✅ Published execution confirmation for proposal ${proposal.id}`);
                this.isExecuting = false;
                return true;
            }
            catch (error) {
                console.error('❌ Error executing rebalance:', error);
                this.isExecuting = false;
                return false;
            }
        });
    }
    // Log token operation to token-data.json
    logTokenOperation(token, tokenId, type, amount, proposalId) {
        try {
            // Read current token data
            let tokenData = { tokens: {}, network: "testnet" };
            if (fs_1.default.existsSync(this.tokenDataPath)) {
                const data = fs_1.default.readFileSync(this.tokenDataPath, 'utf8');
                tokenData = JSON.parse(data);
            }
            // Ensure token exists in data
            if (!tokenData.tokens[token]) {
                console.error(`❌ Token ${token} not found in token data`);
                return;
            }
            // Create transaction ID (normally this would come from HTS)
            const now = Date.now();
            const txId = `0.0.4340026@${now}/${proposalId}-${type.toLowerCase()}-${token}`;
            // Format for Hashscan URL
            const formattedTxId = txId.replace(/\./g, '-').replace('@', '-');
            const hashscanUrl = `https://hashscan.io/testnet/transaction/${formattedTxId}`;
            // Ensure transactions array exists
            if (!tokenData.tokens[token].transactions) {
                tokenData.tokens[token].transactions = [];
            }
            // Add transaction
            tokenData.tokens[token].transactions.push({
                type,
                txId,
                timestamp: new Date().toISOString(),
                amount,
                hashscanUrl,
                proposalId
            });
            // Save updated token data
            fs_1.default.writeFileSync(this.tokenDataPath, JSON.stringify(tokenData, null, 2));
            console.log(`✅ Logged ${type} operation for ${token} to token-data.json`);
        }
        catch (error) {
            console.error('❌ Error logging token operation:', error);
        }
    }
}
exports.RebalanceAgent = RebalanceAgent;
