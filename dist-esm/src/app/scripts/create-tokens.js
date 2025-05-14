/**
 * Token Creation Script for Lynxify Tokenized Index
 *
 * This script creates the demo tokens representing assets in our index
 * as well as the index token itself.
 */
import { Client, TokenCreateTransaction, TokenType, TokenSupplyType, PrivateKey, AccountId, Hbar } from "@hashgraph/sdk";
import * as dotenv from "dotenv";
import * as fs from "fs";
import * as path from "path";
// Load environment variables
dotenv.config({ path: ".env.local" });
// Check if required environment variables are present
if (!process.env.NEXT_PUBLIC_OPERATOR_ID || !process.env.OPERATOR_KEY) {
    throw new Error("Environment variables for Hedera operator not configured");
}
// Initialize client
const operatorId = AccountId.fromString(process.env.NEXT_PUBLIC_OPERATOR_ID);
const operatorKey = PrivateKey.fromString(process.env.OPERATOR_KEY);
const client = Client.forTestnet()
    .setOperator(operatorId, operatorKey)
    .setMaxQueryPayment(new Hbar(2));
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
        const transaction = new TokenCreateTransaction()
            .setTokenName(`${name}-Demo`)
            .setTokenSymbol(symbol)
            .setTokenType(TokenType.FungibleCommon)
            .setDecimals(2)
            .setInitialSupply(initialSupply)
            .setTreasuryAccountId(operatorId)
            .setSupplyType(TokenSupplyType.Infinite)
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
