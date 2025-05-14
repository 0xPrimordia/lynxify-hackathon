interface TokenTransaction {
    tokenSymbol: string;
    tokenId: string;
    type: 'MINT' | 'BURN' | 'CREATE';
    txId: string;
    amount?: number;
    timestamp: string;
    hashscanUrl: string;
}
export declare class TokenLogger {
    private logPath;
    private logs;
    constructor();
    private loadLogs;
    private saveLogs;
    /**
     * Log a token transaction with Hashscan link
     */
    logTransaction(tokenSymbol: string, tokenId: string, txId: string, type: 'MINT' | 'BURN' | 'CREATE', amount?: number): void;
    /**
     * Get all token transactions
     */
    getTransactions(): TokenTransaction[];
    /**
     * Get transactions for a specific token
     */
    getTransactionsForToken(tokenSymbol: string): TokenTransaction[];
    /**
     * Generate HTML report of token transactions
     */
    generateHtmlReport(): string;
    /**
     * Save HTML report to file
     */
    saveHtmlReport(outputPath?: string): string;
}
export {};
