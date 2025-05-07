/**
 * Token Balance Check Script for Lynxify Tokenized Index
 *
 * This script checks the current token balances using the TokenService
 */
import { TokenService } from '../services/token-service';
import * as dotenv from "dotenv";
// Load environment variables
dotenv.config({ path: ".env.local" });
async function main() {
    console.log("Checking token balances...");
    try {
        // Initialize TokenService
        const tokenService = new TokenService();
        // Get all token IDs
        const tokenIds = tokenService.getAllTokenIds();
        console.log("Token IDs:", tokenIds);
        // Get token balances
        const balances = await tokenService.getTokenBalances();
        console.log("Token Balances:", balances);
        // Print formatted results
        console.log("\nToken Balance Summary:");
        console.log("=====================");
        for (const [asset, balance] of Object.entries(balances)) {
            console.log(`${asset}: ${balance}`);
        }
    }
    catch (error) {
        console.error("Error checking token balances:", error);
    }
}
// Run the script
main();
