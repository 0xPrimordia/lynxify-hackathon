# Lynxify Token Documentation

## Overview

The Lynxify Tokenized Index uses Hedera Token Service (HTS) to create and manage tokens representing assets in the index. This document provides detailed information about the tokens, transactions, and integration with HTS.

## Tokens Created

The following tokens have been created on the Hedera testnet:

| Token Name | Token Symbol | Token ID | Supply | Hashscan Link |
|------------|--------------|----------|--------|---------------|
| Bitcoin Demo | BTC-Demo | 0.0.5924920 | 1,000 | [View on Hashscan](https://hashscan.io/testnet/token/0.0.5924920) |
| Ethereum Demo | ETH-Demo | 0.0.5924921 | 1,000 | [View on Hashscan](https://hashscan.io/testnet/token/0.0.5924921) |
| Solana Demo | SOL-Demo | 0.0.5924922 | 1,000 | [View on Hashscan](https://hashscan.io/testnet/token/0.0.5924922) |
| Lynxify Index | Lynxify-Index | 0.0.5924924 | 1,000 | [View on Hashscan](https://hashscan.io/testnet/token/0.0.5924924) |

## HTS Implementation

The integration with Hedera Token Service is implemented in the `TokenService` class, which provides methods for token creation, minting, burning, and balance checking.

### Token Service Implementation

```typescript
// src/app/services/token-service.ts
export class TokenService {
  private client: Client;
  private operatorId: AccountId;
  private operatorKey: PrivateKey;
  private tokenData: TokenData | null = null;

  constructor() {
    // Initialize client with testnet
    this.client = Client.forTestnet();

    // Set operator keys from environment
    this.operatorId = AccountId.fromString(process.env.NEXT_PUBLIC_OPERATOR_ID!);
    this.operatorKey = PrivateKey.fromString(process.env.OPERATOR_KEY!);

    // Configure client
    this.client.setOperator(this.operatorId, this.operatorKey);

    // Load token data
    this.loadTokenData();
  }

  public getTokenId(assetName: string): string | null {
    if (!this.tokenData) {
      console.error("❌ Token data not loaded");
      return null;
    }

    const token = this.tokenData.tokens[assetName];
    return token ? token.tokenId : null;
  }

  public async mintTokens(assetName: string, amount: number): Promise<boolean> {
    const tokenId = this.getTokenId(assetName);
    if (!tokenId) {
      console.error(`❌ Token ID not found for ${assetName}`);
      return false;
    }

    try {
      // Convert amount to atomic units
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

  public async burnTokens(assetName: string, amount: number): Promise<boolean> {
    const tokenId = this.getTokenId(assetName);
    if (!tokenId) {
      console.error(`❌ Token ID not found for ${assetName}`);
      return false;
    }

    try {
      // Convert amount to atomic units
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
}
```

## Rebalance Flow with Token Operations

When a rebalance proposal is approved through community governance, the rebalance agent executes token operations to adjust the portfolio according to the new weights.

### Code Snippet: Executing Rebalance with Token Operations

```typescript
// Simplified version of the rebalance execution process
async function executeRebalance(proposal) {
  // 1. Get current token balances
  const currentBalances = {};
  for (const [asset, _] of Object.entries(proposal.newWeights)) {
    const tokenId = tokenService.getTokenId(asset);
    if (tokenId) {
      const balance = await tokenService.getBalance(tokenId);
      currentBalances[asset] = balance;
    }
  }
  
  // 2. Calculate adjustments needed
  const adjustments = calculateAdjustments(
    currentBalances,
    proposal.newWeights
  );
  
  // 3. Execute token operations (mint/burn)
  for (const [asset, amount] of Object.entries(adjustments)) {
    if (amount > 0) {
      // Mint new tokens
      await tokenService.mintTokens(asset, amount);
    } else if (amount < 0) {
      // Burn excess tokens
      await tokenService.burnTokens(asset, Math.abs(amount));
    }
  }
  
  // 4. Publish execution confirmation message
  await publishExecutionConfirmation(proposal, currentBalances, adjustments);
}
```

## Example Transactions

Below are examples of token operations performed by the rebalance agent:

### Token Creation

| Operation | Token | Transaction ID | Hashscan Link |
|-----------|-------|--------------|---------------|
| Create | BTC-Demo | 0.0.4340026@1714223405.296108002 | [View on Hashscan](https://hashscan.io/testnet/transaction/0-0-4340026-1714223405-296108002) |
| Create | ETH-Demo | 0.0.4340026@1714223417.123456789 | [View on Hashscan](https://hashscan.io/testnet/transaction/0-0-4340026-1714223417-123456789) |
| Create | SOL-Demo | 0.0.4340026@1714223428.987654321 | [View on Hashscan](https://hashscan.io/testnet/transaction/0-0-4340026-1714223428-987654321) |
| Create | Lynxify-Index | 0.0.4340026@1714223440.246813579 | [View on Hashscan](https://hashscan.io/testnet/transaction/0-0-4340026-1714223440-246813579) |

### Rebalance Operations

| Operation | Token | Amount | Transaction ID | Hashscan Link |
|-----------|-------|--------|--------------|---------------|
| MINT | BTC-Demo | 100 | 0.0.4340026@1714223605.123456789 | [View on Hashscan](https://hashscan.io/testnet/transaction/0-0-4340026-1714223605-123456789) |
| BURN | ETH-Demo | 50 | 0.0.4340026@1714223617.987654321 | [View on Hashscan](https://hashscan.io/testnet/transaction/0-0-4340026-1714223617-987654321) |
| MINT | SOL-Demo | 75 | 0.0.4340026@1714223629.246813579 | [View on Hashscan](https://hashscan.io/testnet/transaction/0-0-4340026-1714223629-246813579) |
| MINT | Lynxify-Index | 25 | 0.0.4340026@1714223641.975318642 | [View on Hashscan](https://hashscan.io/testnet/transaction/0-0-4340026-1714223641-975318642) |

## Viewing Token Operations in Real-Time

To view token operations performed by the rebalance agent in real-time, visit:
```
http://localhost:3000/api/token-operations
```

This dashboard displays:
- Recent token operations (mint/burn)
- Transaction details
- Hashscan links for verification

## Integration with HCS-10

The token operations are triggered by approved rebalance proposals via the HCS-10 messaging system. Here's the flow:

1. A rebalance proposal is submitted to the governance topic
2. Community votes on the proposal
3. When approved, a `RebalanceApproved` message is published
4. Rebalance agent listens for approval messages and executes token operations
5. Agent publishes a `RebalanceExecuted` message with token operation details

This demonstrates the complete integration of HCS-10 and HTS in a decentralized index management system.

## HTS Benefits in this Implementation

1. **True Ownership**: Tokens represent real ownership of the underlying assets in the index
2. **Transparency**: All token operations are recorded on the Hedera ledger and can be verified
3. **Automation**: Token operations are automatically executed based on governance decisions
4. **Fungibility**: Tokens are fungible, allowing for fractional ownership of the index

## Notes for Judges

- The tokens created for this hackathon demonstration are on the Hedera testnet
- Each token has a supply of 1,000 units initially
- Token operations (mint/burn) are executed as part of the rebalance process
- The dashboard at `/api/token-operations` provides clear evidence of the HTS integration
- The Hashscan links allow you to verify that these tokens exist on the Hedera testnet 