/**
 * Test Rebalance Script for Lynxify Tokenized Index
 *
 * This script tests token operations directly without using HCS messaging
 */
import { TokenService } from '../services/token-service';
import * as dotenv from "dotenv";
// Load environment variables
dotenv.config({ path: ".env.local" });
// Bypass HCS topic checks
process.env.BYPASS_TOPIC_CHECK = 'true';
async function main() {
    console.log("Starting token operation test...");
    try {
        // Initialize token service
        const tokenService = new TokenService();
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
