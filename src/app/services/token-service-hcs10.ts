import { TokenService } from './token-service.js';
import { Logger } from '@hashgraphonline/standards-sdk';

/**
 * Enhanced TokenService for HCS-10 Integration
 * Extends the base TokenService with additional methods needed for the HCS-10 implementation
 */
export class TokenServiceHCS10 {
  private tokenService: TokenService;
  private logger: Logger;
  
  constructor(tokenService: TokenService) {
    this.tokenService = tokenService;
    this.logger = new Logger({
      module: 'TokenServiceHCS10',
      level: 'debug',
      prettyPrint: true,
    });
  }
  
  /**
   * Get current balances for all tokens
   * Wrapper for getTokenBalances in the base TokenService
   */
  async getCurrentBalances(): Promise<Record<string, number>> {
    try {
      return await this.tokenService.getTokenBalances();
    } catch (error) {
      this.logger.error('Error getting current token balances:', error);
      return {};
    }
  }
  
  /**
   * Execute a rebalance operation based on target weights
   * @param targetWeights Record of token symbols to target weights (0-1)
   */
  async rebalance(targetWeights: Record<string, number>): Promise<boolean> {
    try {
      this.logger.info('Starting rebalance operation with target weights:', targetWeights);
      
      // Get current balances
      const currentBalances = await this.getCurrentBalances();
      if (!currentBalances || Object.keys(currentBalances).length === 0) {
        throw new Error('Failed to get current token balances');
      }
      
      this.logger.info('Current balances:', currentBalances);
      
      // Calculate required adjustments
      const adjustments = this.tokenService.calculateAdjustments(currentBalances, targetWeights);
      
      this.logger.info('Calculated adjustments:', adjustments);
      
      // Execute mint and burn operations
      let success = true;
      for (const [token, amount] of Object.entries(adjustments)) {
        // Skip tokens with zero adjustment
        if (amount === 0) continue;
        
        if (amount > 0) {
          // Mint tokens
          const mintResult = await this.tokenService.mintTokens(token, amount);
          if (!mintResult) {
            this.logger.error(`Failed to mint ${amount} tokens for ${token}`);
            success = false;
          }
        } else if (amount < 0) {
          // Burn tokens
          const burnResult = await this.tokenService.burnTokens(token, Math.abs(amount));
          if (!burnResult) {
            this.logger.error(`Failed to burn ${Math.abs(amount)} tokens for ${token}`);
            success = false;
          }
        }
      }
      
      if (success) {
        this.logger.info('Rebalance operation completed successfully');
      } else {
        this.logger.error('Rebalance operation completed with errors');
      }
      
      return success;
    } catch (error) {
      this.logger.error('Error executing rebalance:', error);
      return false;
    }
  }
  
  /**
   * Get token ID by symbol
   * @param symbol The token symbol
   */
  getTokenId(symbol: string): string | null {
    return this.tokenService.getTokenId(symbol);
  }
  
  /**
   * Get all token IDs
   */
  getAllTokenIds(): Record<string, string> {
    return this.tokenService.getAllTokenIds();
  }
  
  /**
   * Get balance for a specific token
   * @param tokenId The token ID
   */
  async getBalance(tokenId: string): Promise<number> {
    return this.tokenService.getBalance(tokenId);
  }
}

// Export factory function
export function createTokenServiceHCS10(tokenService: TokenService): TokenServiceHCS10 {
  return new TokenServiceHCS10(tokenService);
} 