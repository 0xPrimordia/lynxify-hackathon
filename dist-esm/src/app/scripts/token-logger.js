import * as fs from 'fs';
import * as path from 'path';
export class TokenLogger {
    constructor() {
        this.logPath = path.join(process.cwd(), 'token-transactions.json');
        this.logs = this.loadLogs();
    }
    loadLogs() {
        try {
            if (fs.existsSync(this.logPath)) {
                const data = fs.readFileSync(this.logPath, 'utf8');
                return JSON.parse(data);
            }
        }
        catch (error) {
            console.error('Error loading token transaction logs:', error);
        }
        return { transactions: [], lastUpdated: new Date().toISOString() };
    }
    saveLogs() {
        try {
            this.logs.lastUpdated = new Date().toISOString();
            fs.writeFileSync(this.logPath, JSON.stringify(this.logs, null, 2));
        }
        catch (error) {
            console.error('Error saving token transaction logs:', error);
        }
    }
    /**
     * Log a token transaction with Hashscan link
     */
    logTransaction(tokenSymbol, tokenId, txId, type, amount) {
        // Format transaction ID for Hashscan URL
        const formattedTxId = txId.replace(/\./g, '-').replace('@', '-');
        const hashscanUrl = `https://hashscan.io/testnet/transaction/${formattedTxId}`;
        // Create transaction log entry
        const transaction = {
            tokenSymbol,
            tokenId,
            type,
            txId,
            amount,
            timestamp: new Date().toISOString(),
            hashscanUrl
        };
        // Add to logs
        this.logs.transactions.push(transaction);
        this.saveLogs();
        // Log to console for demo purposes
        console.log('');
        console.log('=======================================================');
        console.log(`🔗 TOKEN OPERATION: ${type} ${amount !== undefined ? amount : ''} ${tokenSymbol}`);
        console.log(`🌐 HASHSCAN URL: ${hashscanUrl}`);
        console.log(`🔢 TOKEN ID: ${tokenId}`);
        console.log(`⏰ TIMESTAMP: ${transaction.timestamp}`);
        console.log('=======================================================');
        console.log('');
    }
    /**
     * Get all token transactions
     */
    getTransactions() {
        return this.logs.transactions;
    }
    /**
     * Get transactions for a specific token
     */
    getTransactionsForToken(tokenSymbol) {
        return this.logs.transactions.filter(tx => tx.tokenSymbol === tokenSymbol);
    }
    /**
     * Generate HTML report of token transactions
     */
    generateHtmlReport() {
        let html = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Lynxify Token Transactions</title>
        <style>
          body { font-family: Arial, sans-serif; margin: 20px; }
          h1 { color: #333; }
          table { border-collapse: collapse; width: 100%; }
          th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
          th { background-color: #f2f2f2; }
          tr:nth-child(even) { background-color: #f9f9f9; }
          .mint { color: green; }
          .burn { color: red; }
          .create { color: blue; }
        </style>
      </head>
      <body>
        <h1>Lynxify Token Transactions</h1>
        <p>Last updated: ${this.logs.lastUpdated}</p>
        <table>
          <tr>
            <th>Timestamp</th>
            <th>Token</th>
            <th>Type</th>
            <th>Amount</th>
            <th>Transaction</th>
          </tr>
    `;
        // Sort transactions by timestamp (newest first)
        const sortedTransactions = [...this.logs.transactions]
            .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
        for (const tx of sortedTransactions) {
            const typeClass = tx.type.toLowerCase();
            html += `
        <tr>
          <td>${new Date(tx.timestamp).toLocaleString()}</td>
          <td>${tx.tokenSymbol} (${tx.tokenId})</td>
          <td class="${typeClass}">${tx.type}</td>
          <td>${tx.amount !== undefined ? tx.amount : '-'}</td>
          <td><a href="${tx.hashscanUrl}" target="_blank">View on Hashscan</a></td>
        </tr>
      `;
        }
        html += `
        </table>
      </body>
      </html>
    `;
        return html;
    }
    /**
     * Save HTML report to file
     */
    saveHtmlReport(outputPath) {
        const filePath = outputPath || path.join(process.cwd(), 'token-transactions.html');
        const html = this.generateHtmlReport();
        try {
            fs.writeFileSync(filePath, html);
            console.log(`📊 Token transaction report saved to ${filePath}`);
            return filePath;
        }
        catch (error) {
            console.error('Error saving HTML report:', error);
            return '';
        }
    }
}
