/**
 * Token Service for Lynxify Tokenized Index
 * 
 * This service provides methods to interact with tokens via Hedera Token Service
 */

import {
  Client,
  TokenMintTransaction,
  TokenBurnTransaction,
  TokenInfoQuery,
  AccountBalanceQuery,
  PrivateKey,
  AccountId,
  TokenId
} from "@hashgraph/sdk";
import * as fs from "fs";
import * as path from "path";

// Token data interface
interface TokenInfo {
  tokenId: string;
  name: string;
  symbol: string;
  transactionId: string;
}

// Token data structure
interface TokenData {
  tokens: {
    [key: string]: TokenInfo;
  };
  createdAt: string;
  network: string;
}

export class TokenService {
  private client: Client;
  private operatorId: AccountId;
  private operatorKey: PrivateKey;
  private tokenData: TokenData | null = null;

  constructor() {
    // Check if required environment variables are present
    if (!process.env.NEXT_PUBLIC_OPERATOR_ID || !process.env.OPERATOR_KEY) {
      throw new Error("Environment variables for Hedera operator not configured");
    }

    // Initialize client
    this.operatorId = AccountId.fromString(process.env.NEXT_PUBLIC_OPERATOR_ID);
    this.operatorKey = PrivateKey.fromString(process.env.OPERATOR_KEY);

    this.client = Client.forTestnet()
      .setOperator(this.operatorId, this.operatorKey);

    // Load token data if available
    this.loadTokenData();
  }

  /**
   * Loads token data from JSON file
   */
  private loadTokenData(): void {
    try {
      const filePath = path.join(__dirname, "../../../token-data.json");
      if (fs.existsSync(filePath)) {
        const data = fs.readFileSync(filePath, 'utf8');
        this.tokenData = JSON.parse(data);
        console.log(`✅ Loaded token data for ${Object.keys(this.tokenData?.tokens || {}).length} tokens`);
      } else {
        console.warn("⚠️ No token data file found. Please run the create-tokens script first.");
      }
    } catch (error) {
      console.error("❌ Error loading token data:", error);
    }
  }

  /**
   * Gets token ID by asset name
   */
  public getTokenId(assetName: string): string | null {
    if (!this.tokenData) {
      console.error("❌ Token data not loaded");
      return null;
    }

    const token = this.tokenData.tokens[assetName];
    return token ? token.tokenId : null;
  }

  /**
   * Gets all token IDs
   */
  public getAllTokenIds(): Record<string, string> {
    if (!this.tokenData) {
      console.error("❌ Token data not loaded");
      return {};
    }

    const result: Record<string, string> = {};
    for (const [name, token] of Object.entries(this.tokenData.tokens)) {
      result[name] = token.tokenId;
    }
    return result;
  }

  /**
   * Gets token balances for the treasury account
   */
  public async getTokenBalances(): Promise<Record<string, number>> {
    if (!this.tokenData) {
      console.error("❌ Token data not loaded");
      return {};
    }

    try {
      const query = new AccountBalanceQuery()
        .setAccountId(this.operatorId);

      const accountBalance = await query.execute(this.client);
      const balances: Record<string, number> = {};

      // Convert token balance map to our format
      if (accountBalance.tokens) {
        for (const [name, token] of Object.entries(this.tokenData.tokens)) {
          const tokenId = TokenId.fromString(token.tokenId);
          const balance = accountBalance.tokens.get(tokenId) || 0;
          balances[name] = Number(balance) / 100; // Adjust for decimals
        }
      }

      return balances;
    } catch (error) {
      console.error("❌ Error fetching token balances:", error);
      return {};
    }
  }

  /**
   * Mints additional tokens
   */
  public async mintTokens(assetName: string, amount: number): Promise<boolean> {
    const tokenId = this.getTokenId(assetName);
    if (!tokenId) {
      console.error(`❌ Token ID not found for ${assetName}`);
      return false;
    }

    try {
      // Convert amount to atomic units (multiply by 10^decimals)
      const atomicAmount = Math.floor(amount * 100);

      const transaction = await new TokenMintTransaction()
        .setTokenId(tokenId)
        .setAmount(atomicAmount)
        .freezeWith(this.client)
        .sign(this.operatorKey);

      const response = await transaction.execute(this.client);
      const receipt = await response.getReceipt(this.client);

      console.log(`✅ Minted ${amount} of ${assetName} tokens, status: ${receipt.status}`);
      return receipt.status.toString() === "SUCCESS";
    } catch (error) {
      console.error(`❌ Error minting ${assetName} tokens:`, error);
      return false;
    }
  }

  /**
   * Burns tokens
   */
  public async burnTokens(assetName: string, amount: number): Promise<boolean> {
    const tokenId = this.getTokenId(assetName);
    if (!tokenId) {
      console.error(`❌ Token ID not found for ${assetName}`);
      return false;
    }

    try {
      // Convert amount to atomic units (multiply by 10^decimals)
      const atomicAmount = Math.floor(amount * 100);

      const transaction = await new TokenBurnTransaction()
        .setTokenId(tokenId)
        .setAmount(atomicAmount)
        .freezeWith(this.client)
        .sign(this.operatorKey);

      const response = await transaction.execute(this.client);
      const receipt = await response.getReceipt(this.client);

      console.log(`✅ Burned ${amount} of ${assetName} tokens, status: ${receipt.status}`);
      return receipt.status.toString() === "SUCCESS";
    } catch (error) {
      console.error(`❌ Error burning ${assetName} tokens:`, error);
      return false;
    }
  }

  /**
   * Calculates token adjustments needed to match new weights
   */
  public calculateAdjustments(
    currentBalances: Record<string, number>,
    newWeights: Record<string, number>
  ): Record<string, number> {
    const result: Record<string, number> = {};
    const totalValue = 1000; // Simplified total value for demo
    
    // Calculate new target amounts based on weights
    for (const [asset, weight] of Object.entries(newWeights)) {
      const targetAmount = totalValue * weight;
      const currentAmount = currentBalances[asset] || 0;
      const adjustment = targetAmount - currentAmount;
      
      // Only include non-zero adjustments
      if (Math.abs(adjustment) > 0.01) {
        result[asset] = adjustment;
      }
    }
    
    return result;
  }
} 