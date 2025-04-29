'use server';

import { NextRequest, NextResponse } from 'next/server';
import * as fs from 'fs';
import * as path from 'path';

// Token data structure
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

interface TokenData {
  tokens: Record<string, TokenInfo>;
  network: string;
}

interface TokenOperation {
  type: string;
  txId: string;
  timestamp: string;
  amount?: number;
  hashscanUrl: string;
}

interface Token {
  tokenId: string;
  name: string;
  symbol: string;
  transactionId: string;
  transactions?: TokenOperation[];
}

// Function to generate the proper URL format for Hashscan
function generateHashscanUrl(transactionId: string | null, consensusTimestamp?: string, tokenId?: string): string {
  // For token creation transactions, use token page format if tokenId is provided
  if (tokenId) {
    return `https://hashscan.io/testnet/token/${tokenId}`;
  }
  
  // For transaction IDs from Mirror Node API, use as-is
  if (transactionId) {
    return `https://hashscan.io/testnet/transaction/${transactionId}`;
  }
  
  // Fallback
  return `https://hashscan.io/testnet/transaction/unknown`;
}

// Format timestamp from Mirror Node to ISO string
function formatTimestamp(consensusTimestamp: string): string {
  const seconds = parseInt(consensusTimestamp.split('.')[0]);
  return new Date(seconds * 1000).toISOString();
}

export async function GET(request: NextRequest) {
  try {
    // Read the token data file for token IDs
    const filePath = path.join(process.cwd(), 'token-data.json');
    const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));

    // Mirror Node base URL for Hedera testnet
    const MIRROR_NODE_URL = 'https://testnet.mirrornode.hedera.com';
    
    // Get token transactions from Mirror Node where possible
    const tokenInfo = await Promise.all(
      Object.values(data.tokens).map(async (token: any) => {
        let transactions = [];
        
        try {
          // Get token data from Mirror Node
          console.log(`Fetching token data for ${token.tokenId} from Mirror Node...`);
          const tokenUrl = `${MIRROR_NODE_URL}/api/v1/tokens/${token.tokenId}`;
          const tokenResponse = await fetch(tokenUrl);
          
          if (tokenResponse.ok) {
            const tokenData = await tokenResponse.json();
            console.log(`Found token ${tokenData.token_id} (${tokenData.name})`);
            
            // Add CREATE transaction with proper link
            transactions.push({
              type: 'CREATE',
              txId: token.transactionId || tokenData.created_timestamp,
              timestamp: tokenData.created_timestamp 
                ? formatTimestamp(tokenData.created_timestamp) 
                : token.transactions[0].timestamp,
              hashscanUrl: generateHashscanUrl(null, undefined, token.tokenId)
            });
            
            // Get all transactions for this account
            const txUrl = `${MIRROR_NODE_URL}/api/v1/transactions?account.id=${process.env.NEXT_PUBLIC_OPERATOR_ID}&limit=100&order=desc`;
            console.log(`Fetching transactions from ${txUrl}`);
            
            const txResponse = await fetch(txUrl);
            if (txResponse.ok) {
              const txData = await txResponse.json();
              
              // Filter transactions for this specific token (with token transfers)
              const tokenTransactions = txData.transactions.filter((tx: any) => {
                return tx.token_transfers?.some((transfer: any) => 
                  transfer.token_id === token.tokenId
                );
              });
              
              console.log(`Found ${tokenTransactions.length} transactions for token ${token.tokenId}`);
              
              // Map transactions to our format
              const mappedTransactions = tokenTransactions.map((tx: any) => {
                // Find the transfer for this token
                const transfer = tx.token_transfers.find((t: any) => t.token_id === token.tokenId);
                if (!transfer) return null;
                
                const amount = Math.abs(Number(transfer.amount));
                // Check if amount is positive (mint) or negative (burn)
                const type = Number(transfer.amount) > 0 ? 'MINT' : 'BURN';
                
                return {
                  type,
                  txId: tx.transaction_id,
                  timestamp: formatTimestamp(tx.consensus_timestamp),
                  amount,
                  hashscanUrl: `https://hashscan.io/testnet/transaction/${tx.transaction_id}`
                };
              }).filter(Boolean);
              
              // Add these transactions to our list
              transactions = [...transactions, ...mappedTransactions];
            }
          }
        } catch (err) {
          console.error(`Error fetching transaction data for ${token.tokenId}:`, err);
          
          // Fallback to token-data.json transactions if Mirror Node fails
          transactions = token.transactions || [];
        }
        
        return {
          ...token,
          transactions: transactions.length > 0 ? transactions : token.transactions
        };
      })
    );

    return NextResponse.json({
      tokens: tokenInfo,
      message: 'Token data retrieved successfully',
      note: 'This page shows verified on-chain transactions from the Hedera Mirror Node',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error retrieving token data:', error);
    return NextResponse.json(
      { error: 'Failed to retrieve token data' },
      { status: 500 }
    );
  }
} 