"use strict";
/**
 * Test Rebalance Script for Lynxify Tokenized Index
 *
 * This script tests token operations directly without using HCS messaging
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
const token_service_1 = require("../services/token-service");
const dotenv = __importStar(require("dotenv"));
// Load environment variables
dotenv.config({ path: ".env.local" });
// Bypass HCS topic checks
process.env.BYPASS_TOPIC_CHECK = 'true';
async function main() {
    console.log("Starting token operation test...");
    try {
        // Initialize token service
        const tokenService = new token_service_1.TokenService();
        // Get current token balances
        console.log("Checking initial token balances...");
        const initialBalances = await tokenService.getTokenBalances();
        console.log("Initial balances:", initialBalances);
        // Define new target amounts
        const newTargets = {
            "BTC": 500, // Increase BTC 
            "ETH": 300, // Adjust ETH
            "SOL": 200 // Adjust SOL
        };
        console.log("Target amounts:", newTargets);
        // Calculate adjustments needed
        console.log("Calculating adjustments...");
        const currentBalances = initialBalances;
        const adjustments = {};
        for (const [asset, targetAmount] of Object.entries(newTargets)) {
            const currentAmount = currentBalances[asset] || 0;
            const adjustment = targetAmount - currentAmount;
            if (Math.abs(adjustment) > 0.01) {
                adjustments[asset] = adjustment;
            }
        }
        console.log("Calculated adjustments:", adjustments);
        // Execute token operations
        console.log("Executing token operations...");
        for (const [asset, adjustment] of Object.entries(adjustments)) {
            if (adjustment > 0) {
                console.log(`Minting ${adjustment} of ${asset} tokens...`);
                await tokenService.mintTokens(asset, adjustment);
            }
            else if (adjustment < 0) {
                console.log(`Burning ${Math.abs(adjustment)} of ${asset} tokens...`);
                await tokenService.burnTokens(asset, Math.abs(adjustment));
            }
        }
        // Check updated balances
        console.log("Checking final token balances...");
        const finalBalances = await tokenService.getTokenBalances();
        console.log("Final balances:", finalBalances);
        // Print summary
        console.log("\nToken Operation Test Summary:");
        console.log("=============================");
        console.log("Initial Balances:");
        for (const [asset, balance] of Object.entries(initialBalances)) {
            console.log(`  ${asset}: ${balance}`);
        }
        console.log("Target Amounts:");
        for (const [asset, amount] of Object.entries(newTargets)) {
            console.log(`  ${asset}: ${amount}`);
        }
        console.log("Final Balances:");
        for (const [asset, balance] of Object.entries(finalBalances)) {
            console.log(`  ${asset}: ${balance}`);
        }
        console.log("\n✅ Token operation test completed successfully!");
    }
    catch (error) {
        console.error("Error in token operations test:", error);
    }
}
// Run the script
main();
