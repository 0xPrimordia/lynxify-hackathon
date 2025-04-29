"use strict";
/**
 * Token Service for Lynxify Tokenized Index
 *
 * This service provides methods to interact with tokens via Hedera Token Service
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.TokenService = void 0;
const sdk_1 = require("@hashgraph/sdk");
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
class TokenService {
    constructor() {
        // Initialize client with testnet
        this.client = sdk_1.Client.forTestnet();
        // Set operator keys from environment
        if (!process.env.NEXT_PUBLIC_OPERATOR_ID || !process.env.OPERATOR_KEY) {
            throw new Error("Missing required environment variables for Hedera client");
        }
        this.operatorId = sdk_1.AccountId.fromString(process.env.NEXT_PUBLIC_OPERATOR_ID);
        this.operatorKey = sdk_1.PrivateKey.fromString(process.env.OPERATOR_KEY);
        // Configure client
        this.client.setOperator(this.operatorId, this.operatorKey);
        // Load token data if available
        this.tokenDataPath = path.join(process.cwd(), 'token-data.json');
        this.tokenData = this.loadTokenData();
    }
    /**
     * Loads token data from JSON file
     */
    loadTokenData() {
        try {
            if (fs.existsSync(this.tokenDataPath)) {
                const data = fs.readFileSync(this.tokenDataPath, 'utf8');
                return JSON.parse(data);
            }
        }
        catch (error) {
            console.error('Error loading token data:', error);
        }
        return { tokens: {}, network: "testnet" };
    }
    saveTokenData() {
        try {
            fs.writeFileSync(this.tokenDataPath, JSON.stringify(this.tokenData, null, 2));
        }
        catch (error) {
            console.error('Error saving token data:', error);
        }
    }
    /**
     * Get token ID by token symbol
     */
    getTokenId(tokenSymbol) {
        if (!this.tokenData?.tokens[tokenSymbol]) {
            return null;
        }
        return this.tokenData.tokens[tokenSymbol].tokenId;
    }
    /**
     * Get all token IDs
     */
    getAllTokenIds() {
        const result = {};
        for (const [name, token] of Object.entries(this.tokenData.tokens)) {
            result[name] = token.tokenId;
        }
        return result;
    }
    /**
     * Get token balances for all tokens
     */
    async getTokenBalances() {
        try {
            // Query account balance for all tokens
            const balanceQuery = new sdk_1.AccountBalanceQuery()
                .setAccountId(this.operatorId);
            const accountBalance = await balanceQuery.execute(this.client);
            const balances = {};
            // Convert token balance map to our format
            if (accountBalance.tokens) {
                for (const [name, token] of Object.entries(this.tokenData.tokens)) {
                    const tokenId = sdk_1.TokenId.fromString(token.tokenId);
                    const balance = accountBalance.tokens.get(tokenId) || 0;
                    balances[name] = Number(balance);
                }
            }
            return balances;
        }
        catch (error) {
            console.error("❌ Error getting token balances:", error);
            return {};
        }
    }
    /**
     * Get token balance
     */
    async getBalance(tokenId) {
        try {
            // Query account balance for specific token
            const balanceQuery = new sdk_1.AccountBalanceQuery()
                .setAccountId(this.operatorId);
            const accountBalance = await balanceQuery.execute(this.client);
            let tokenBalance = 0;
            if (accountBalance.tokens) {
                tokenBalance = accountBalance.tokens.get(sdk_1.TokenId.fromString(tokenId)) || 0;
            }
            return Number(tokenBalance);
        }
        catch (error) {
            console.error("❌ Error getting token balance:", error);
            return 0;
        }
    }
    /**
     * Mint tokens for an asset
     */
    async mintTokens(assetName, amount) {
        const tokenId = this.getTokenId(assetName);
        if (!tokenId) {
            console.error(`❌ Token ID not found for ${assetName}`);
            return false;
        }
        try {
            console.log(`🔄 Preparing to mint ${amount} of ${assetName} tokens (${tokenId})`);
            // Create mint transaction
            const transaction = new sdk_1.TokenMintTransaction()
                .setTokenId(sdk_1.TokenId.fromString(tokenId))
                .setAmount(amount);
            // Execute transaction
            const txResponse = await transaction.execute(this.client);
            console.log(`📋 Transaction submitted: ${txResponse.transactionId.toString()}`);
            // Get receipt
            const receipt = await txResponse.getReceipt(this.client);
            const status = receipt.status.toString();
            console.log(`✅ Mint transaction status: ${status}`);
            if (status === "SUCCESS") {
                // Log mint operation with actual transaction ID
                this.logTransaction(assetName, txResponse.transactionId.toString(), 'MINT', amount);
                return true;
            }
            else {
                console.error(`❌ Mint transaction failed with status: ${status}`);
                return false;
            }
        }
        catch (error) {
            console.error(`❌ Error minting tokens for ${assetName}:`, error);
            return false;
        }
    }
    /**
     * Burn tokens for an asset
     */
    async burnTokens(assetName, amount) {
        const tokenId = this.getTokenId(assetName);
        if (!tokenId) {
            console.error(`❌ Token ID not found for ${assetName}`);
            return false;
        }
        try {
            console.log(`🔄 Preparing to burn ${amount} of ${assetName} tokens (${tokenId})`);
            // Create burn transaction
            const transaction = new sdk_1.TokenBurnTransaction()
                .setTokenId(sdk_1.TokenId.fromString(tokenId))
                .setAmount(amount);
            // Execute transaction
            const txResponse = await transaction.execute(this.client);
            console.log(`📋 Transaction submitted: ${txResponse.transactionId.toString()}`);
            // Get receipt
            const receipt = await txResponse.getReceipt(this.client);
            const status = receipt.status.toString();
            console.log(`✅ Burn transaction status: ${status}`);
            if (status === "SUCCESS") {
                // Log burn operation with actual transaction ID
                this.logTransaction(assetName, txResponse.transactionId.toString(), 'BURN', amount);
                return true;
            }
            else {
                console.error(`❌ Burn transaction failed with status: ${status}`);
                return false;
            }
        }
        catch (error) {
            console.error(`❌ Error burning tokens for ${assetName}:`, error);
            return false;
        }
    }
    /**
     * Calculate required token adjustments to match new weights
     */
    calculateAdjustments(currentBalances, targetWeights) {
        // Calculate total value across all tokens
        const totalValue = Object.values(currentBalances).reduce((sum, value) => sum + value, 0);
        // Calculate target balances based on weights
        const targetBalances = {};
        const adjustments = {};
        for (const [token, weight] of Object.entries(targetWeights)) {
            // Calculate target balance based on weight and total value
            targetBalances[token] = totalValue * weight;
            // Calculate adjustment (positive for mint, negative for burn)
            const currentBalance = currentBalances[token] || 0;
            adjustments[token] = Math.round(targetBalances[token] - currentBalance);
        }
        return adjustments;
    }
    logTransaction(symbol, txId, type, amount) {
        if (!this.tokenData.tokens[symbol]) {
            console.error(`Token ${symbol} not found in token data`);
            return;
        }
        // Format transaction ID for Hashscan URL
        const formattedTxId = txId.replace(/\./g, '-').replace('@', '-');
        const hashscanUrl = `https://hashscan.io/testnet/transaction/${formattedTxId}`;
        // Add transaction to token's transaction history
        if (!this.tokenData.tokens[symbol].transactions) {
            this.tokenData.tokens[symbol].transactions = [];
        }
        this.tokenData.tokens[symbol].transactions.push({
            type,
            txId,
            timestamp: new Date().toISOString(),
            amount,
            hashscanUrl
        });
        // Save updated token data
        this.saveTokenData();
        // Log transaction with Hashscan link for demo purposes
        console.log(`🔗 TOKEN OPERATION: ${type} ${amount || ''} ${symbol} | TxID: ${txId}`);
        console.log(`🌐 HASHSCAN URL: ${hashscanUrl}`);
    }
}
exports.TokenService = TokenService;
