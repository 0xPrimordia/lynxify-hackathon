"use strict";
/**
 * Token Balance Check Script for Lynxify Tokenized Index
 *
 * This script checks the current token balances using the TokenService
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
async function main() {
    console.log("Checking token balances...");
    try {
        // Initialize TokenService
        const tokenService = new token_service_1.TokenService();
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
