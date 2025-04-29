/**
 * Token Service for Lynxify Tokenized Index
 * 
 * This service provides methods to interact with tokens via Hedera Token Service
 */

import {
  Client,
  PrivateKey,
  AccountId,
  TokenId,
  TokenCreateTransaction,
  TokenMintTransaction,
  TokenBurnTransaction,
  AccountBalanceQuery,
  TransactionResponse
} from "@hashgraph/sdk";
import * as fs from "fs";
import * as path from "path";

// Define TokenOperationType enum
export enum TokenOperationType {
  CREATE = 'CREATE',
  MINT = 'MINT',
  BURN = 'BURN'
}

// Token data interface
interface TokenInfo {
  tokenId: string;
  name: string;
  symbol: string;
  transactionId: string;
  transactions?: {
    type: string;
    txId: string;
    timestamp: string;
    amount?: number;
    hashscanUrl: string;
  }[];
}

// Token data structure
interface TokenData {
  tokens: Record<string, TokenInfo>;
  network: string;
}

export class TokenService {
  private client: Client;
  private operatorId: AccountId;
  private operatorKey: PrivateKey;
  private tokenData: TokenData;
  private tokenDataPath: string;

  constructor() {
    // Initialize client with testnet
    this.client = Client.forTestnet();

    // Set operator keys from environment
    if (!process.env.NEXT_PUBLIC_OPERATOR_ID || !process.env.OPERATOR_KEY) {
      throw new Error("Missing required environment variables for Hedera client");
    }

    this.operatorId = AccountId.fromString(process.env.NEXT_PUBLIC_OPERATOR_ID);
    this.operatorKey = PrivateKey.fromString(process.env.OPERATOR_KEY);

    // Configure client
    this.client.setOperator(this.operatorId, this.operatorKey);

    // Load token data if available
    this.tokenDataPath = path.join(process.cwd(), 'token-data.json');
    this.tokenData = this.loadTokenData();
  }

  /**
   * Loads token data from JSON file
   */
  private loadTokenData(): TokenData {
    try {
      if (fs.existsSync(this.tokenDataPath)) {
        const data = fs.readFileSync(this.tokenDataPath, 'utf8');
        return JSON.parse(data);
      }
    } catch (error) {
      console.error('Error loading token data:', error);
    }
    return { tokens: {}, network: "testnet" };
  }

  private saveTokenData(): void {
    try {
      fs.writeFileSync(this.tokenDataPath, JSON.stringify(this.tokenData, null, 2));
    } catch (error) {
      console.error('Error saving token data:', error);
    }
  }

  /**
   * Get token ID by token symbol
   */
  public getTokenId(tokenSymbol: string): string | null {
    if (!this.tokenData?.tokens[tokenSymbol]) {
      return null;
    }
    return this.tokenData.tokens[tokenSymbol].tokenId;
  }

  /**
   * Get all token IDs
   */
  public getAllTokenIds(): Record<string, string> {
    const result: Record<string, string> = {};
    for (const [name, token] of Object.entries(this.tokenData.tokens)) {
      result[name] = token.tokenId;
    }
    return result;
  }

  /**
   * Get token balances for all tokens
   */
  public async getTokenBalances(): Promise<Record<string, number>> {
    try {
      // Query account balance for all tokens
      const balanceQuery = new AccountBalanceQuery()
        .setAccountId(this.operatorId);

      const accountBalance = await balanceQuery.execute(this.client);
      const balances: Record<string, number> = {};
      
      // Convert token balance map to our format
      if (accountBalance.tokens) {
        for (const [name, token] of Object.entries(this.tokenData.tokens)) {
          const tokenId = TokenId.fromString(token.tokenId);
          const balance = accountBalance.tokens.get(tokenId) || 0;
          balances[name] = Number(balance);
        }
      }
      
      return balances;
    } catch (error) {
      console.error("❌ Error getting token balances:", error);
      return {};
    }
  }

  /**
   * Get token balance
   */
  public async getBalance(tokenId: string): Promise<number> {
    try {
      // Query account balance for specific token
      const balanceQuery = new AccountBalanceQuery()
        .setAccountId(this.operatorId);

      const accountBalance = await balanceQuery.execute(this.client);
      let tokenBalance = 0;
      
      if (accountBalance.tokens) {
        tokenBalance = accountBalance.tokens.get(TokenId.fromString(tokenId)) || 0;
      }

      return Number(tokenBalance);
    } catch (error) {
      console.error("❌ Error getting token balance:", error);
      return 0;
    }
  }

  /**
   * Mint tokens for an asset
   */
  public async mintTokens(assetName: string, amount: number): Promise<boolean> {
    const tokenId = this.getTokenId(assetName);
    if (!tokenId) {
      console.error(`❌ Token ID not found for ${assetName}`);
      return false;
    }

    try {
      console.log(`⚡ ACTUAL HTS OPERATION: Attempting to mint ${amount} of ${assetName} tokens (${tokenId})`);
      
      // Create mint transaction
      const transaction = new TokenMintTransaction()
        .setTokenId(TokenId.fromString(tokenId))
        .setAmount(amount);

      // Execute transaction
      const txResponse = await transaction.execute(this.client);
      console.log(`⚡ ACTUAL HTS TRANSACTION EXECUTED: ${txResponse.transactionId.toString()}`);
      
      // Get receipt
      const receipt = await txResponse.getReceipt(this.client);
      const status = receipt.status.toString();
      
      console.log(`⚡ ACTUAL HTS TRANSACTION STATUS: ${status}`);

      if (status === "SUCCESS") {
        // Log mint operation with actual transaction ID
        this.logTransaction(assetName, TokenOperationType.MINT, txResponse.transactionId.toString(), amount);
        return true;
      } else {
        console.error(`❌ Mint transaction failed with status: ${status}`);
        return false;
      }
    } catch (error) {
      console.error(`❌ Error minting tokens for ${assetName}:`, error);
      return false;
    }
  }

  /**
   * Burn tokens for an asset
   */
  public async burnTokens(assetName: string, amount: number): Promise<boolean> {
    const tokenId = this.getTokenId(assetName);
    if (!tokenId) {
      console.error(`❌ Token ID not found for ${assetName}`);
      return false;
    }

    try {
      console.log(`⚡ ACTUAL HTS OPERATION: Attempting to burn ${amount} of ${assetName} tokens (${tokenId})`);
      
      // Create burn transaction
      const transaction = new TokenBurnTransaction()
        .setTokenId(TokenId.fromString(tokenId))
        .setAmount(amount);

      // Execute transaction
      const txResponse = await transaction.execute(this.client);
      console.log(`⚡ ACTUAL HTS TRANSACTION EXECUTED: ${txResponse.transactionId.toString()}`);
      
      // Get receipt
      const receipt = await txResponse.getReceipt(this.client);
      const status = receipt.status.toString();
      
      console.log(`⚡ ACTUAL HTS TRANSACTION STATUS: ${status}`);

      if (status === "SUCCESS") {
        // Log burn operation with actual transaction ID
        this.logTransaction(assetName, TokenOperationType.BURN, txResponse.transactionId.toString(), amount);
        return true;
      } else {
        console.error(`❌ Burn transaction failed with status: ${status}`);
        return false;
      }
    } catch (error) {
      console.error(`❌ Error burning tokens for ${assetName}:`, error);
      return false;
    }
  }

  /**
   * Calculate required token adjustments to match new weights
   */
  public calculateAdjustments(
    currentBalances: Record<string, number>,
    targetWeights: Record<string, number>
  ): Record<string, number> {
    // Calculate total value across all tokens
    const totalValue = Object.values(currentBalances).reduce((sum, value) => sum + value, 0);
    
    // Calculate target balances based on weights
    const targetBalances: Record<string, number> = {};
    const adjustments: Record<string, number> = {};
    
    for (const [token, weight] of Object.entries(targetWeights)) {
      // Calculate target balance based on weight and total value
      targetBalances[token] = totalValue * weight;
      
      // Calculate adjustment (positive for mint, negative for burn)
      const currentBalance = currentBalances[token] || 0;
      adjustments[token] = Math.round(targetBalances[token] - currentBalance);
    }
    
    return adjustments;
  }

  private logTransaction(token: string, type: TokenOperationType, txId: string, amount?: number) {
    try {
      const tokenEntry = this.tokenData.tokens[token];
      
      if (!tokenEntry) {
        console.error(`Token ${token} not found in token-data.json`);
        return;
      }
      
      // Parse the transaction ID to get the account ID and consensus timestamp
      const [accountId, timestamp] = txId.split('@');
      
      // Format account ID from 0.0.xxxxxx to 0-0-xxxxxx
      const formattedAccountId = accountId.replace(/\./g, '-');
      
      // Format timestamp from xxx.yyy to xxx-yyy
      const formattedTimestamp = timestamp.replace('.', '-');
      
      // Create the properly formatted Hashscan URL for the transaction
      const hashscanUrl = `https://hashscan.io/testnet/transaction/${formattedAccountId}-${formattedTimestamp}`;
      
      console.log(`⚡ LOGGED TRANSACTION: ${txId} with Hashscan URL: ${hashscanUrl}`);
      
      const transaction = {
        type,
        txId,
        timestamp: new Date().toISOString(),
        hashscanUrl,
      };
      
      if (amount !== undefined) {
        (transaction as any).amount = amount;
      }
      
      if (!tokenEntry.transactions) {
        tokenEntry.transactions = [];
      }
      
      tokenEntry.transactions.push(transaction);
      this.saveTokenData();
      
    } catch (error) {
      console.error('Error logging transaction:', error);
    }
  }
} 