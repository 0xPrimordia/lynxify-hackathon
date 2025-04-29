"use strict";
/**
 * Token Creation Script for Lynxify Tokenized Index
 *
 * This script creates the demo tokens representing assets in our index
 * as well as the index token itself.
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
const sdk_1 = require("@hashgraph/sdk");
const dotenv = __importStar(require("dotenv"));
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
// Load environment variables
dotenv.config({ path: ".env.local" });
// Check if required environment variables are present
if (!process.env.NEXT_PUBLIC_OPERATOR_ID || !process.env.OPERATOR_KEY) {
    throw new Error("Environment variables for Hedera operator not configured");
}
// Initialize client
const operatorId = sdk_1.AccountId.fromString(process.env.NEXT_PUBLIC_OPERATOR_ID);
const operatorKey = sdk_1.PrivateKey.fromString(process.env.OPERATOR_KEY);
const client = sdk_1.Client.forTestnet()
    .setOperator(operatorId, operatorKey)
    .setMaxQueryPayment(new sdk_1.Hbar(2));
// Define tokens to create
const tokensToCreate = [
    { name: "BTC", symbol: "BTC", initialSupply: 1000 },
    { name: "ETH", symbol: "ETH", initialSupply: 1000 },
    { name: "SOL", symbol: "SOL", initialSupply: 1000 },
    { name: "Lynxify-Index", symbol: "LYX", initialSupply: 1000 }
];
// Store token IDs
const tokenData = {};
/**
 * Creates a demo token using Hedera Token Service
 */
async function createDemoToken(name, symbol, initialSupply = 1000) {
    console.log(`Creating token ${name}-Demo...`);
    try {
        const transaction = new sdk_1.TokenCreateTransaction()
            .setTokenName(`${name}-Demo`)
            .setTokenSymbol(symbol)
            .setTokenType(sdk_1.TokenType.FungibleCommon)
            .setDecimals(2)
            .setInitialSupply(initialSupply)
            .setTreasuryAccountId(operatorId)
            .setSupplyType(sdk_1.TokenSupplyType.Infinite)
            .setSupplyKey(operatorKey)
            .freezeWith(client);
        const signTx = await transaction.sign(operatorKey);
        const txResponse = await signTx.execute(client);
        const receipt = await txResponse.getReceipt(client);
        const tokenId = receipt.tokenId.toString();
        console.log(`✅ Created ${name}-Demo token with ID: ${tokenId}`);
        return {
            tokenId,
            name: `${name}-Demo`,
            symbol,
            transactionId: txResponse.transactionId.toString()
        };
    }
    catch (error) {
        console.error(`❌ Error creating ${name}-Demo token:`, error);
        throw error;
    }
}
/**
 * Saves token data to a JSON file
 */
function saveTokenData(tokenData) {
    const filePath = path.join(__dirname, "../../../token-data.json");
    fs.writeFileSync(filePath, JSON.stringify(tokenData, null, 2));
    console.log(`✅ Token data saved to ${filePath}`);
}
/**
 * Main function to create all tokens
 */
async function main() {
    console.log("Starting token creation process...");
    try {
        for (const token of tokensToCreate) {
            const result = await createDemoToken(token.name, token.symbol, token.initialSupply);
            tokenData[token.name] = result;
        }
        saveTokenData({
            tokens: tokenData,
            createdAt: new Date().toISOString(),
            network: "testnet"
        });
        console.log("✅ All tokens created successfully!");
    }
    catch (error) {
        console.error("❌ Error in token creation process:", error);
    }
    finally {
        client.close();
    }
}
// Run the script
main();
