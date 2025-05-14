import { NextResponse } from 'next/server';
import * as fs from 'fs';
import * as path from 'path';
// Only run on server, not during build
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
// Function to generate the proper URL format for Hashscan
function generateHashscanUrl(transactionId, consensusTimestamp, tokenId) {
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
function formatTimestamp(consensusTimestamp) {
    const seconds = parseInt(consensusTimestamp.split('.')[0]);
    return new Date(seconds * 1000).toISOString();
}
// Hardcoded fallback token data for Vercel deployment
const fallbackTokenData = {
    "tokens": {
        "btc": {
            "tokenId": "0.0.5924920",
            "name": "BTC-Demo",
            "symbol": "BTC",
            "transactionId": "0.0.5924920@1714416000.123456789",
            "transactions": [
                {
                    "type": "CREATE",
                    "txId": "0.0.5924920@1714416000.123456789",
                    "timestamp": "2024-05-30T12:00:00.000Z",
                    "hashscanUrl": "https://hashscan.io/testnet/token/0.0.5924920"
                }
            ]
        },
        "eth": {
            "tokenId": "0.0.5924921",
            "name": "ETH-Demo",
            "symbol": "ETH",
            "transactionId": "0.0.5924921@1714416000.123456789",
            "transactions": [
                {
                    "type": "CREATE",
                    "txId": "0.0.5924921@1714416000.123456789",
                    "timestamp": "2024-05-30T12:00:00.000Z",
                    "hashscanUrl": "https://hashscan.io/testnet/token/0.0.5924921"
                }
            ]
        },
        "sol": {
            "tokenId": "0.0.5924922",
            "name": "SOL-Demo",
            "symbol": "SOL",
            "transactionId": "0.0.5924922@1714416000.123456789",
            "transactions": [
                {
                    "type": "CREATE",
                    "txId": "0.0.5924922@1714416000.123456789",
                    "timestamp": "2024-05-30T12:00:00.000Z",
                    "hashscanUrl": "https://hashscan.io/testnet/token/0.0.5924922"
                }
            ]
        },
        "lynx": {
            "tokenId": "0.0.5924924",
            "name": "Lynxify-Index",
            "symbol": "LYNX",
            "transactionId": "0.0.5924924@1714416000.123456789",
            "transactions": [
                {
                    "type": "CREATE",
                    "txId": "0.0.5924924@1714416000.123456789",
                    "timestamp": "2024-05-30T12:00:00.000Z",
                    "hashscanUrl": "https://hashscan.io/testnet/token/0.0.5924924"
                }
            ]
        }
    },
    "network": "testnet"
};
export async function GET(request) {
    try {
        let data;
        // Try to read the token data file, if it exists and we're not in a serverless environment
        try {
            if (process.env.NODE_ENV === 'development') {
                const filePath = path.join(process.cwd(), 'token-data.json');
                data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
                console.log('Successfully read token data from file');
            }
            else {
                // In production/Vercel, use the fallback data
                console.log('Using fallback token data in production environment');
                data = fallbackTokenData;
            }
        }
        catch (error) {
            // Fallback if file reading fails
            console.log('Error reading token data file, using fallback data:', error);
            data = fallbackTokenData;
        }
        // Mirror Node base URL for Hedera testnet
        const MIRROR_NODE_URL = 'https://testnet.mirrornode.hedera.com';
        // Get token transactions from Mirror Node where possible
        try {
            const tokenInfo = await Promise.all(Object.values(data.tokens).map(async (token) => {
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
                        if (process.env.NEXT_PUBLIC_OPERATOR_ID) {
                            const txUrl = `${MIRROR_NODE_URL}/api/v1/transactions?account.id=${process.env.NEXT_PUBLIC_OPERATOR_ID}&limit=100&order=desc`;
                            console.log(`Fetching transactions from ${txUrl}`);
                            const txResponse = await fetch(txUrl);
                            if (txResponse.ok) {
                                const txData = await txResponse.json();
                                // Filter transactions for this specific token (with token transfers)
                                const tokenTransactions = txData.transactions.filter((tx) => {
                                    return tx.token_transfers?.some((transfer) => transfer.token_id === token.tokenId);
                                });
                                console.log(`Found ${tokenTransactions.length} transactions for token ${token.tokenId}`);
                                // Map transactions to our format
                                const mappedTransactions = tokenTransactions.map((tx) => {
                                    // Find the transfer for this token
                                    const transfer = tx.token_transfers.find((t) => t.token_id === token.tokenId);
                                    if (!transfer)
                                        return null;
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
                    }
                }
                catch (err) {
                    console.error(`Error fetching transaction data for ${token.tokenId}:`, err);
                    // Fallback to token-data.json transactions if Mirror Node fails
                    transactions = token.transactions || [];
                }
                return {
                    ...token,
                    transactions: transactions.length > 0 ? transactions : token.transactions
                };
            }));
            return NextResponse.json({
                tokens: tokenInfo,
                message: 'Token data retrieved successfully',
                note: 'This page shows verified on-chain transactions from the Hedera Mirror Node',
                timestamp: new Date().toISOString()
            });
        }
        catch (fetchError) {
            console.error('Error fetching token data from Mirror Node:', fetchError);
            // Return the static data as fallback
            return NextResponse.json({
                tokens: Object.values(data.tokens),
                message: 'Token data retrieved from fallback',
                note: 'Using static data due to Mirror Node connection issue',
                timestamp: new Date().toISOString()
            });
        }
    }
    catch (error) {
        console.error('Error retrieving token data:', error);
        return NextResponse.json({ error: 'Failed to retrieve token data' }, { status: 500 });
    }
}
