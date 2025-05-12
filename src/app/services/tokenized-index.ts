import { EventBus, EventType } from '../utils/event-emitter';
import { SharedHederaService } from './shared-hedera-service';
import { HCSMessage, TokenWeights, isRebalanceProposal, isRebalanceApproved } from '../types/hcs';
import { v4 as uuidv4 } from 'uuid';
import { TokenService } from './token-service';
import { PriceFeedService } from './price-feed-service';

/**
 * Configuration for the Tokenized Index Service
 */
export interface TokenizedIndexConfig {
  indexTopicId: string;
  proposalTimeoutMs?: number;
  rebalanceThreshold?: number;
  riskThreshold?: number;
}

/**
 * Rebalance Proposal structure
 */
interface RebalanceProposal {
  id: string;
  newWeights: Record<string, number>;
  trigger: 'price_deviation' | 'risk_threshold' | 'scheduled';
  timestamp: number;
  expiration: number;
  approved: boolean;
  executed: boolean;
  votes: {
    for: number;
    against: number;
    total: number;
  };
}

/**
 * Risk metrics for a token
 */
interface TokenRiskMetrics {
  volatility: number;            // Standard deviation of returns
  drawdown: number;              // Maximum drawdown
  sharpeRatio?: number;          // Risk-adjusted return
  correlations: Record<string, number>; // Correlation with other tokens
  lastUpdated: number;           // Timestamp of last update
  historicalPrices?: number[];   // Recent price data for analysis
}

/**
 * Portfolio risk metrics
 */
interface PortfolioRiskMetrics {
  totalVolatility: number;        // Portfolio volatility
  diversificationScore: number;   // How well diversified (0-1)
  concentrationRisk: number;      // Risk from overconcentration 
  marketRisk: number;             // Systematic market risk exposure
  timestamp: number;              // When calculated
  highRiskTokens: string[];       // Tokens with concerning metrics
}

/**
 * Service that handles tokenized index business logic
 */
export class TokenizedIndexService {
  private readonly eventBus: EventBus;
  private readonly hederaService: SharedHederaService;
  private readonly tokenService: TokenService;
  private readonly priceFeedService: PriceFeedService;
  private readonly config: TokenizedIndexConfig;
  
  private currentWeights: Record<string, number> = {};
  private tokenPrices: Record<string, { price: number; timestamp: number; source: string }> = {};
  private activeProposals: Map<string, RebalanceProposal> = new Map();
  private executedProposals: string[] = [];
  
  private initialized: boolean = false;
  
  // Add to TokenizedIndexService class properties
  private tokenRiskMetrics: Record<string, TokenRiskMetrics> = {};
  private portfolioRiskMetrics?: PortfolioRiskMetrics;
  private priceHistory: Record<string, { price: number; timestamp: number }[]> = {};
  private riskAssessmentInterval: NodeJS.Timeout | null = null;
  
  /**
   * Create a new TokenizedIndexService
   */
  constructor(
    hederaService: SharedHederaService,
    config: TokenizedIndexConfig,
    tokenService?: TokenService,
    priceFeedService?: PriceFeedService,
    testingMode: boolean = false
  ) {
    this.hederaService = hederaService;
    this.tokenService = tokenService || new TokenService();
    this.priceFeedService = priceFeedService || new PriceFeedService(hederaService, {
      outputTopicId: config.indexTopicId,
      tokenIds: {} // This will be populated later
    });
    this.config = {
      ...config,
      proposalTimeoutMs: config.proposalTimeoutMs || 24 * 60 * 60 * 1000, // Default 24 hours
      rebalanceThreshold: config.rebalanceThreshold || 0.05, // Default 5%
      riskThreshold: config.riskThreshold || 0.2 // Default 20%
    };
    this.eventBus = EventBus.getInstance();
    
    if (!testingMode) {
      this.setupEventHandlers();
    }
  }
  
  /**
   * Set up event handlers for this service
   */
  private setupEventHandlers(): void {
    // Listen for messages received from the index topic
    this.eventBus.onEvent(EventType.MESSAGE_RECEIVED, (data) => {
      if (data.topicId === this.config.indexTopicId) {
        this.processIndexMessage(data);
      }
    });
    
    // Listen for price updates from the price feed service
    this.eventBus.onEvent(EventType.INDEX_PRICE_UPDATED, (data) => {
      this.updateTokenPrice(data.tokenId, data.price, data.source);
    });
    
    // Set up proposal expiration checker
    setInterval(() => this.checkProposalExpirations(), 60 * 1000); // Every minute
    
    // Set up regular risk assessment
    this.riskAssessmentInterval = setInterval(() => this.assessPortfolioRisk(), 15 * 60 * 1000); // Every 15 minutes
  }
  
  /**
   * Update token price (called from price feed events)
   */
  private updateTokenPrice(tokenId: string, price: number, source: string): void {
    // Store the price
    this.tokenPrices[tokenId] = {
      price,
      timestamp: Date.now(),
      source
    };
    
    // Update price history
    if (!this.priceHistory[tokenId]) {
      this.priceHistory[tokenId] = [];
    }
    
    // Add to price history and keep last 30 data points
    this.priceHistory[tokenId].push({
      price,
      timestamp: Date.now()
    });
    
    // Limit history size
    if (this.priceHistory[tokenId].length > 30) {
      this.priceHistory[tokenId].shift();
    }
    
    console.log(`💰 Price update received for ${tokenId}: ${price} from ${source}`);
    
    // Update token risk metrics with new price data
    this.updateTokenRiskMetrics(tokenId);
    
    // Check if the price deviation triggers a rebalance
    this.checkPriceDeviationThreshold();
  }
  
  /**
   * Process messages from the index topic
   */
  private processIndexMessage(data: any): void {
    try {
      const message = data.contents;
      
      // Handle different message types
      switch (message.type) {
        case 'RiskAlert':
          this.handleRiskAlert(message);
          break;
        case 'RebalanceProposal':
          this.handleRebalanceProposal(message);
          break;
        case 'RebalanceApproved':
          this.handleRebalanceApproved(message);
          break;
        case 'RebalanceExecuted':
          this.handleRebalanceExecuted(message);
          break;
        case 'PolicyChange':
          this.handlePolicyChange(message);
          break;
        default:
          console.log(`ℹ️ Ignoring unknown message type: ${message.type}`);
      }
    } catch (error) {
      console.error('❌ Error processing index message:', error);
    }
  }
  
  /**
   * Handle a risk alert message
   */
  private handleRiskAlert(message: any): void {
    const { severity, riskDescription, affectedTokens } = message.details;
    
    console.log(`⚠️ Risk alert received: ${severity} - ${riskDescription}`);
    
    // Emit risk alert event
    this.eventBus.emitEvent(EventType.INDEX_RISK_ALERT, {
      severity,
      riskDescription,
      affectedTokens
    });
    
    // For high severity alerts, consider automatic rebalance proposal
    if (severity === 'high' && affectedTokens && affectedTokens.length > 0) {
      this.proposeRiskBasedRebalance(affectedTokens);
    }
  }
  
  /**
   * Handle a rebalance proposal message
   */
  private handleRebalanceProposal(message: any): void {
    const { proposalId, newWeights, trigger } = message.details;
    
    if (!proposalId || !newWeights) {
      console.warn('⚠️ Invalid rebalance proposal message:', message);
      return;
    }
    
    // Store the proposal
    this.activeProposals.set(proposalId, {
      id: proposalId,
      newWeights,
      trigger: trigger || 'scheduled',
      timestamp: Date.now(),
      expiration: Date.now() + (this.config.proposalTimeoutMs || 24 * 60 * 60 * 1000),
      approved: false,
      executed: false,
      votes: {
        for: 0,
        against: 0,
        total: 0
      }
    });
    
    console.log(`📊 New rebalance proposal received: ${proposalId}`);
    
    // Emit rebalance proposed event
    this.eventBus.emitEvent(EventType.INDEX_REBALANCE_PROPOSED, {
      proposalId,
      newWeights,
      trigger: trigger || 'scheduled'
    });
  }
  
  /**
   * Handle a rebalance approved message
   */
  private handleRebalanceApproved(message: any): void {
    const { proposalId, approvedAt } = message.details;
    
    if (!proposalId) {
      console.warn('⚠️ Invalid rebalance approved message:', message);
      return;
    }
    
    // Update the proposal
    const proposal = this.activeProposals.get(proposalId);
    if (proposal) {
      proposal.approved = true;
      
      console.log(`✅ Rebalance proposal approved: ${proposalId}`);
      
      // Emit rebalance approved event
      this.eventBus.emitEvent(EventType.INDEX_REBALANCE_APPROVED, {
        proposalId,
        approvedAt: approvedAt || Date.now()
      });
      
      // Execute the rebalance
      this.executeRebalance(proposalId);
    } else {
      console.warn(`⚠️ Approved proposal not found: ${proposalId}`);
    }
  }
  
  /**
   * Handle a rebalance executed message
   */
  private handleRebalanceExecuted(message: any): void {
    const { proposalId, preBalances, postBalances, executedAt } = message.details;
    
    if (!proposalId) {
      console.warn('⚠️ Invalid rebalance executed message:', message);
      return;
    }
    
    // Update the proposal and current weights
    const proposal = this.activeProposals.get(proposalId);
    if (proposal) {
      proposal.executed = true;
      this.currentWeights = { ...proposal.newWeights };
      this.executedProposals.push(proposalId);
      this.activeProposals.delete(proposalId);
      
      console.log(`✅ Rebalance proposal executed: ${proposalId}`);
      
      // Emit rebalance executed event
      this.eventBus.emitEvent(EventType.INDEX_REBALANCE_EXECUTED, {
        proposalId,
        preBalances: preBalances || {},
        postBalances: postBalances || this.currentWeights,
        executedAt: executedAt || Date.now()
      });
    } else {
      console.warn(`⚠️ Executed proposal not found: ${proposalId}`);
      
      // Still update weights if provided
      if (postBalances) {
        this.currentWeights = { ...postBalances };
      }
    }
  }
  
  /**
   * Handle a policy change message
   */
  private handlePolicyChange(message: any): void {
    const { policyId, changes, effectiveFrom } = message.details;
    
    if (!policyId || !changes) {
      console.warn('⚠️ Invalid policy change message:', message);
      return;
    }
    
    console.log(`🔄 Policy change received: ${policyId}`);
    
    // Update local config based on policy changes
    if (changes.rebalanceThreshold !== undefined) {
      this.config.rebalanceThreshold = changes.rebalanceThreshold;
    }
    
    if (changes.riskThreshold !== undefined) {
      this.config.riskThreshold = changes.riskThreshold;
    }
    
    // Emit policy changed event
    this.eventBus.emitEvent(EventType.INDEX_POLICY_CHANGED, {
      policyId,
      changes,
      effectiveFrom: effectiveFrom || Date.now()
    });
  }
  
  /**
   * Check price deviations to see if a rebalance should be triggered
   */
  private checkPriceDeviationThreshold(): void {
    // Get token prices and calculate their impact on current weights
    const tokenPrices = this.tokenPrices;
    const currentWeights = this.currentWeights;
    
    // Skip if we don't have enough data
    if (Object.keys(tokenPrices).length === 0 || Object.keys(currentWeights).length === 0) {
      return;
    }
    
    // Calculate implied weights based on current prices
    const impliedWeights: Record<string, number> = {};
    let totalImpliedValue = 0;
    
    // First, calculate total implied value
    for (const [tokenId, weight] of Object.entries(currentWeights)) {
      const priceInfo = tokenPrices[tokenId];
      
      if (!priceInfo) {
        console.log(`⚠️ No price information for ${tokenId}, using 1.0`);
        // Default to 1.0 if no price info available
        totalImpliedValue += weight;
        continue;
      }
      
      // Calculate value contribution: weight * price
      const impliedValue = weight * priceInfo.price;
      totalImpliedValue += impliedValue;
    }
    
    // Then, calculate implied weights
    for (const [tokenId, weight] of Object.entries(currentWeights)) {
      const priceInfo = tokenPrices[tokenId];
      const price = priceInfo ? priceInfo.price : 1.0;
      
      // Calculate implied weight: (weight * price) / total
      impliedWeights[tokenId] = totalImpliedValue > 0 
        ? (weight * price) / totalImpliedValue 
        : weight;
    }
    
    // Check for deviations
    let maxDeviation = 0;
    let maxDeviationToken = '';
    
    for (const [tokenId, targetWeight] of Object.entries(currentWeights)) {
      const impliedWeight = impliedWeights[tokenId] || 0;
      const deviation = Math.abs(impliedWeight - targetWeight);
      
      if (deviation > maxDeviation) {
        maxDeviation = deviation;
        maxDeviationToken = tokenId;
      }
    }
    
    // Log the findings
    console.log(`📊 Max weight deviation: ${(maxDeviation * 100).toFixed(2)}% for token ${maxDeviationToken}`);
    
    // If deviation exceeds threshold, propose a rebalance
    if (maxDeviation > (this.config.rebalanceThreshold || 0.05)) {
      console.log(`🔄 Price deviation exceeds threshold (${(maxDeviation * 100).toFixed(2)}% > ${((this.config.rebalanceThreshold || 0.05) * 100).toFixed(2)}%), proposing rebalance`);
      
      // Emit deviation detected event
      this.eventBus.emitEvent(EventType.INDEX_PRICE_UPDATED, {
        tokenId: maxDeviationToken,
        price: this.tokenPrices[maxDeviationToken]?.price || 0,
        source: this.tokenPrices[maxDeviationToken]?.source || 'unknown'
      });
      
      // Propose a rebalance
      this.proposeRebalance('price_deviation');
    }
  }
  
  /**
   * Propose a rebalance based on risk analysis
   */
  private proposeRiskBasedRebalance(affectedTokens: string[]): void {
    if (!affectedTokens || affectedTokens.length === 0) {
      return;
    }
    
    console.log(`⚠️ Proposing risk-based rebalance for affected tokens:`, affectedTokens);
    
    // Get current weights
    const currentWeights = { ...this.currentWeights };
    const newWeights: Record<string, number> = { ...currentWeights };
    
    // Calculate total weight of affected tokens
    let totalAffectedWeight = 0;
    for (const tokenId of affectedTokens) {
      totalAffectedWeight += currentWeights[tokenId] || 0;
    }
    
    // Apply risk mitigation strategy
    if (totalAffectedWeight > 0) {
      // Reduce weights of affected tokens by 50%
      const reductionFactor = 0.5;
      const weightToRedistribute = totalAffectedWeight * reductionFactor;
      
      // First reduce the affected tokens
      for (const tokenId of affectedTokens) {
        if (currentWeights[tokenId]) {
          newWeights[tokenId] = currentWeights[tokenId] * (1 - reductionFactor);
        }
      }
      
      // Get unaffected tokens for redistribution
      const unaffectedTokens = Object.keys(currentWeights).filter(
        tokenId => !affectedTokens.includes(tokenId)
      );
      
      if (unaffectedTokens.length > 0) {
        // Calculate total weight of unaffected tokens
        let totalUnaffectedWeight = 0;
        for (const tokenId of unaffectedTokens) {
          totalUnaffectedWeight += currentWeights[tokenId] || 0;
        }
        
        // Redistribute the reduced weight proportionally to unaffected tokens
        for (const tokenId of unaffectedTokens) {
          const proportion = totalUnaffectedWeight > 0 
            ? (currentWeights[tokenId] || 0) / totalUnaffectedWeight
            : 1 / unaffectedTokens.length;
            
          newWeights[tokenId] = (currentWeights[tokenId] || 0) + (weightToRedistribute * proportion);
        }
      } else {
        // If all tokens are affected, normalize weights
        const newTotal = Object.values(newWeights).reduce((sum, weight) => sum + weight, 0);
        for (const tokenId in newWeights) {
          newWeights[tokenId] = newTotal > 0 ? newWeights[tokenId] / newTotal : 1 / Object.keys(newWeights).length;
        }
      }
      
      // Ensure weights sum to 1.0
      const finalTotal = Object.values(newWeights).reduce((sum, weight) => sum + weight, 0);
      for (const tokenId in newWeights) {
        newWeights[tokenId] = finalTotal > 0 ? newWeights[tokenId] / finalTotal : 1 / Object.keys(newWeights).length;
      }
      
      // Log the weight adjustments
      console.log('📊 Risk-based weight adjustments:');
      for (const tokenId in newWeights) {
        const change = newWeights[tokenId] - (currentWeights[tokenId] || 0);
        console.log(`  ${tokenId}: ${(currentWeights[tokenId] || 0).toFixed(4)} → ${newWeights[tokenId].toFixed(4)} (${change >= 0 ? '+' : ''}${(change * 100).toFixed(2)}%)`);
      }
      
      // Propose the rebalance with the new weights
      this.proposeRebalanceWithWeights(newWeights, 'risk_threshold');
    } else {
      // If no affected tokens have weight, just propose a regular rebalance
      this.proposeRebalance('risk_threshold');
    }
  }
  
  /**
   * Propose a rebalance with auto-calculated weights
   */
  private proposeRebalance(trigger: 'price_deviation' | 'risk_threshold' | 'scheduled'): void {
    // Create new balanced weights (simplified)
    // In a real implementation, this would use more sophisticated rebalancing strategies
    const newWeights: Record<string, number> = {};
    const tokenCount = Object.keys(this.currentWeights).length;
    
    if (tokenCount === 0) return;
    
    // Equal weight distribution for simplicity
    const weight = 1 / tokenCount;
    for (const tokenId in this.currentWeights) {
      newWeights[tokenId] = weight;
    }
    
    this.proposeRebalanceWithWeights(newWeights, trigger);
  }
  
  /**
   * Propose a rebalance with specific weights
   */
  private proposeRebalanceWithWeights(
    newWeights: Record<string, number>,
    trigger: 'price_deviation' | 'risk_threshold' | 'scheduled'
  ): void {
    const proposalId = uuidv4();
    
    // Create proposal message
    const proposalMessage = {
      id: uuidv4(),
      type: 'RebalanceProposal',
      timestamp: Date.now(),
      sender: 'tokenized-index-service',
      details: {
        proposalId,
        newWeights,
        trigger,
        executeAfter: Date.now() + 3600000, // 1 hour
        quorum: 0.51, // 51% quorum
        message: `Rebalance proposed due to ${trigger}`
      }
    };
    
    // Send the proposal to the index topic
    this.hederaService.sendMessage(this.config.indexTopicId, proposalMessage)
      .then(() => console.log(`📤 Sent rebalance proposal: ${proposalId}`))
      .catch(error => console.error('❌ Failed to send rebalance proposal:', error));
  }
  
  /**
   * Execute a rebalance based on an approved proposal
   */
  private async executeRebalance(proposalId: string): Promise<void> {
    const proposal = this.activeProposals.get(proposalId);
    if (!proposal || !proposal.approved) {
      console.warn(`⚠️ Cannot execute proposal ${proposalId}: not found or not approved`);
      return;
    }
    
    try {
      console.log(`🔄 Executing rebalance for proposal: ${proposalId}`);
      
      // Get current token balances using TokenService
      // This would be injected as a dependency in a full implementation
      const currentBalances = await this.tokenService.getTokenBalances();
      
      // Store old weights for comparison
      const preBalances = { ...currentBalances };
      
      // Calculate token adjustments needed based on new weights
      const targetWeights = proposal.newWeights;
      const adjustments = this.tokenService.calculateAdjustments(currentBalances, targetWeights);
      
      // Log planned adjustments
      console.log('📊 Planned token adjustments:', adjustments);
      
      // Execute token operations using TokenService (mint/burn)
      let successfulOperations = true;
      for (const [token, amount] of Object.entries(adjustments)) {
        if (Math.abs(amount) < 1) {
          console.log(`ℹ️ Adjustment too small for ${token}, skipping`);
          continue;
        }
        
        try {
          if (amount > 0) {
            console.log(`🔼 Minting ${amount} ${token} tokens`);
            const mintResult = await this.tokenService.mintTokens(token, amount);
            if (!mintResult) {
              throw new Error(`Failed to mint ${token} tokens`);
            }
          } else if (amount < 0) {
            const burnAmount = Math.abs(amount);
            console.log(`🔽 Burning ${burnAmount} ${token} tokens`);
            const burnResult = await this.tokenService.burnTokens(token, burnAmount);
            if (!burnResult) {
              throw new Error(`Failed to burn ${token} tokens`);
            }
          }
        } catch (error) {
          console.error(`❌ Error executing operation for ${token}:`, error);
          successfulOperations = false;
        }
      }
      
      // Get updated balances after operations
      const postBalances = await this.tokenService.getTokenBalances();
      
      // Update current weights based on actual new balances
      const totalBalance = Object.values(postBalances).reduce((sum, val) => sum + val, 0);
      const newWeights: Record<string, number> = {};
      
      for (const [token, balance] of Object.entries(postBalances)) {
        newWeights[token] = totalBalance > 0 ? balance / totalBalance : 0;
      }
      
      this.currentWeights = newWeights;
      
      // Create executed message
      const executedMessage = {
        id: uuidv4(),
        type: 'RebalanceExecuted',
        timestamp: Date.now(),
        sender: 'tokenized-index-service',
        details: {
          proposalId,
          preBalances,
          postBalances,
          success: successfulOperations,
          executedAt: Date.now(),
          message: `Rebalance executed for proposal ${proposalId}`
        }
      };
      
      // Send the message to the index topic
      await this.hederaService.sendMessage(this.config.indexTopicId, executedMessage);
      
      // Also publish to Moonscape HCS-10 compatible format via eventBus
      this.eventBus.emitEvent(EventType.HCS10_RESPONSE_SENT, {
        requestId: proposalId,
        recipientId: 'moonscape-registry',
        response: {
          operation: 'RebalanceExecuted',
          proposalId,
          preBalances,
          postBalances,
          executedAt: Date.now(),
          success: successfulOperations
        }
      });
      
      console.log(`✅ Rebalance executed for proposal: ${proposalId}`);
      
      // Mark as executed and move to history
      proposal.executed = true;
      this.executedProposals.push(proposalId);
      this.activeProposals.delete(proposalId);
    } catch (error) {
      console.error(`❌ Failed to execute rebalance for proposal ${proposalId}:`, error);
      
      // Publish error message
      const errorMessage = {
        id: uuidv4(),
        type: 'RebalanceError',
        timestamp: Date.now(),
        sender: 'tokenized-index-service',
        details: {
          proposalId,
          error: error instanceof Error ? error.message : String(error),
          timestamp: Date.now()
        }
      };
      
      await this.hederaService.sendMessage(this.config.indexTopicId, errorMessage)
        .catch(err => console.error('Failed to send error message:', err));
    }
  }
  
  /**
   * Check for expired proposals
   */
  private checkProposalExpirations(): void {
    const now = Date.now();
    
    // Convert Map.entries() to array before iterating
    Array.from(this.activeProposals.entries()).forEach(([proposalId, proposal]) => {
      if (now > proposal.expiration && !proposal.executed) {
        console.log(`⏱️ Proposal expired: ${proposalId}`);
        
        // Clean up expired proposals
        this.activeProposals.delete(proposalId);
      }
    });
  }
  
  /**
   * Calculate risk metrics for a specific token
   */
  private updateTokenRiskMetrics(tokenId: string): void {
    const priceData = this.priceHistory[tokenId];
    
    // Need at least 2 data points for meaningful metrics
    if (!priceData || priceData.length < 2) {
      return;
    }
    
    try {
      // Calculate returns from price data
      const returns: number[] = [];
      for (let i = 1; i < priceData.length; i++) {
        const previousPrice = priceData[i-1].price;
        const currentPrice = priceData[i].price;
        if (previousPrice > 0) {
          returns.push((currentPrice - previousPrice) / previousPrice);
        }
      }
      
      // Skip if not enough return data
      if (returns.length < 2) {
        return;
      }
      
      // Calculate volatility (standard deviation of returns)
      const meanReturn = returns.reduce((sum, val) => sum + val, 0) / returns.length;
      const variance = returns.reduce((sum, val) => sum + Math.pow(val - meanReturn, 2), 0) / returns.length;
      const volatility = Math.sqrt(variance);
      
      // Calculate maximum drawdown
      let maxDrawdown = 0;
      let peak = priceData[0].price;
      
      for (let i = 1; i < priceData.length; i++) {
        const currentPrice = priceData[i].price;
        if (currentPrice > peak) {
          peak = currentPrice;
        } else {
          const drawdown = (peak - currentPrice) / peak;
          maxDrawdown = Math.max(maxDrawdown, drawdown);
        }
      }
      
      // Calculate correlations with other tokens
      const correlations: Record<string, number> = {};
      
      for (const otherId in this.priceHistory) {
        if (otherId !== tokenId && this.priceHistory[otherId].length >= 2) {
          correlations[otherId] = this.calculateCorrelation(tokenId, otherId);
        }
      }
      
      // Store the calculated metrics
      this.tokenRiskMetrics[tokenId] = {
        volatility,
        drawdown: maxDrawdown,
        correlations,
        lastUpdated: Date.now(),
        historicalPrices: priceData.map(p => p.price)
      };
      
      console.log(`📊 Updated risk metrics for ${tokenId}: Volatility=${volatility.toFixed(4)}, MaxDrawdown=${maxDrawdown.toFixed(4)}`);
    } catch (error) {
      console.error(`❌ Error calculating risk metrics for ${tokenId}:`, error);
    }
  }
  
  /**
   * Calculate correlation between two tokens
   */
  private calculateCorrelation(tokenIdA: string, tokenIdB: string): number {
    const priceDataA = this.priceHistory[tokenIdA];
    const priceDataB = this.priceHistory[tokenIdB];
    
    // We need equal length arrays for correlation
    const minLength = Math.min(priceDataA.length, priceDataB.length);
    
    if (minLength < 2) {
      return 0; // Not enough data
    }
    
    // Extract just the price values
    const pricesA = priceDataA.slice(priceDataA.length - minLength).map(p => p.price);
    const pricesB = priceDataB.slice(priceDataB.length - minLength).map(p => p.price);
    
    // Calculate means
    const meanA = pricesA.reduce((sum, val) => sum + val, 0) / pricesA.length;
    const meanB = pricesB.reduce((sum, val) => sum + val, 0) / pricesB.length;
    
    // Calculate correlation coefficient
    let numerator = 0;
    let denominatorA = 0;
    let denominatorB = 0;
    
    for (let i = 0; i < minLength; i++) {
      const diffA = pricesA[i] - meanA;
      const diffB = pricesB[i] - meanB;
      numerator += diffA * diffB;
      denominatorA += diffA * diffA;
      denominatorB += diffB * diffB;
    }
    
    // Avoid division by zero
    if (denominatorA === 0 || denominatorB === 0) {
      return 0;
    }
    
    return numerator / (Math.sqrt(denominatorA) * Math.sqrt(denominatorB));
  }
  
  /**
   * Perform a comprehensive risk assessment of the entire portfolio
   */
  private assessPortfolioRisk(): void {
    try {
      console.log('🔍 Assessing portfolio risk...');
      
      const tokenWeights = this.currentWeights;
      const tokenIds = Object.keys(tokenWeights);
      
      // Skip if we don't have enough tokens or risk metrics
      if (tokenIds.length < 2 || Object.keys(this.tokenRiskMetrics).length < 2) {
        console.log('⚠️ Not enough data for portfolio risk assessment');
        return;
      }
      
      // Calculate portfolio volatility (weighted sum of individual volatilities)
      let portfolioVolatility = 0;
      let totalWeight = 0;
      
      const highRiskTokens: string[] = [];
      const volatilityThreshold = this.config.riskThreshold || 0.2; // 20% volatility threshold
      
      for (const tokenId of tokenIds) {
        const weight = tokenWeights[tokenId] || 0;
        totalWeight += weight;
        
        const metrics = this.tokenRiskMetrics[tokenId];
        if (!metrics) continue;
        
        // Check for high risk tokens
        if (metrics.volatility > volatilityThreshold || metrics.drawdown > 0.3) {
          highRiskTokens.push(tokenId);
        }
        
        portfolioVolatility += weight * metrics.volatility;
      }
      
      // Calculate concentration risk (Herfindahl-Hirschman Index)
      let concentrationRisk = 0;
      for (const tokenId of tokenIds) {
        const weight = tokenWeights[tokenId] || 0;
        concentrationRisk += Math.pow(weight, 2);
      }
      
      // Calculate diversification score (inverse of average correlation)
      let totalCorrelation = 0;
      let correlationPairs = 0;
      
      for (let i = 0; i < tokenIds.length; i++) {
        for (let j = i + 1; j < tokenIds.length; j++) {
          const tokenA = tokenIds[i];
          const tokenB = tokenIds[j];
          
          const metricsA = this.tokenRiskMetrics[tokenA];
          if (metricsA && metricsA.correlations[tokenB] !== undefined) {
            totalCorrelation += Math.abs(metricsA.correlations[tokenB]);
            correlationPairs++;
          }
        }
      }
      
      const avgCorrelation = correlationPairs > 0 ? totalCorrelation / correlationPairs : 0;
      const diversificationScore = 1 - avgCorrelation; // Higher is better
      
      // Estimate market risk (simplified)
      const marketRisk = portfolioVolatility * avgCorrelation;
      
      // Store portfolio risk metrics
      this.portfolioRiskMetrics = {
        totalVolatility: portfolioVolatility,
        diversificationScore,
        concentrationRisk,
        marketRisk,
        timestamp: Date.now(),
        highRiskTokens
      };
      
      console.log(`📊 Portfolio risk assessment complete:
        - Total Volatility: ${portfolioVolatility.toFixed(4)}
        - Diversification Score: ${diversificationScore.toFixed(4)}
        - Concentration Risk: ${concentrationRisk.toFixed(4)}
        - Market Risk: ${marketRisk.toFixed(4)}
        - High Risk Tokens: ${highRiskTokens.join(', ') || 'None'}`
      );
      
      // Check if risk exceeds thresholds
      this.checkRiskThresholds();
    } catch (error) {
      console.error('❌ Error in portfolio risk assessment:', error);
    }
  }
  
  /**
   * Check if portfolio risk exceeds defined thresholds
   */
  private checkRiskThresholds(): void {
    if (!this.portfolioRiskMetrics) return;
    
    const metrics = this.portfolioRiskMetrics;
    let riskLevel: 'low' | 'medium' | 'high' = 'low';
    const riskFactors: string[] = [];
    
    // Risk threshold from config
    const riskThreshold = this.config.riskThreshold || 0.2;
    
    // Check portfolio volatility
    if (metrics.totalVolatility > riskThreshold * 1.5) {
      riskLevel = 'high';
      riskFactors.push(`High portfolio volatility (${(metrics.totalVolatility * 100).toFixed(2)}%)`);
    } else if (metrics.totalVolatility > riskThreshold) {
      riskLevel = 'medium';
      riskFactors.push(`Elevated portfolio volatility (${(metrics.totalVolatility * 100).toFixed(2)}%)`);
    }
    
    // Check concentration risk
    if (metrics.concentrationRisk > 0.5) {
      riskLevel = 'high';
      riskFactors.push('High concentration risk (portfolio too concentrated)');
    } else if (metrics.concentrationRisk > 0.3) {
      riskLevel = Math.max(riskLevel === 'high' ? 2 : riskLevel === 'medium' ? 1 : 0, 1) === 2 ? 'high' : 'medium';
      riskFactors.push('Elevated concentration risk');
    }
    
    // Check diversification score
    if (metrics.diversificationScore < 0.3) {
      riskLevel = Math.max(riskLevel === 'high' ? 2 : riskLevel === 'medium' ? 1 : 0, 1) === 2 ? 'high' : 'medium';
      riskFactors.push('Poor diversification');
    }
    
    // Check if we have specific high-risk tokens
    if (metrics.highRiskTokens.length > 0) {
      if (metrics.highRiskTokens.length > 2 || metrics.highRiskTokens.length / Object.keys(this.currentWeights).length > 0.3) {
        riskLevel = 'high';
      } else {
        riskLevel = Math.max(riskLevel === 'high' ? 2 : riskLevel === 'medium' ? 1 : 0, 1) === 2 ? 'high' : 'medium';
      }
      riskFactors.push(`High-risk tokens: ${metrics.highRiskTokens.join(', ')}`);
    }
    
    // Emit risk event if not low
    if (riskLevel !== 'low') {
      const riskMessage = {
        id: uuidv4(),
        type: 'RiskAlert',
        timestamp: Date.now(),
        sender: 'tokenized-index-service',
        details: {
          severity: riskLevel,
          riskDescription: riskFactors.join('; '),
          affectedTokens: metrics.highRiskTokens,
          metrics: {
            volatility: metrics.totalVolatility,
            concentration: metrics.concentrationRisk,
            diversification: metrics.diversificationScore
          }
        }
      };
      
      // Log risk alert
      console.log(`⚠️ ${riskLevel.toUpperCase()} RISK ALERT: ${riskFactors.join('; ')}`);
      
      // Publish risk alert
      this.hederaService.sendMessage(this.config.indexTopicId, riskMessage)
        .then(() => console.log('📤 Risk alert published to index topic'))
        .catch(error => console.error('❌ Failed to publish risk alert:', error));
      
      // Emit risk alert event
      this.eventBus.emitEvent(EventType.INDEX_RISK_ALERT, {
        severity: riskLevel,
        riskDescription: riskFactors.join('; '),
        affectedTokens: metrics.highRiskTokens
      });
      
      // For high risk, auto-propose rebalance
      if (riskLevel === 'high') {
        this.proposeRiskBasedRebalance(metrics.highRiskTokens);
      }
    }
  }
  
  /**
   * Initialize the service
   */
  public async initialize(): Promise<void> {
    if (this.initialized) {
      return;
    }
    
    try {
      console.log('🔄 Initializing TokenizedIndexService...');
      
      // Ensure price feed service is initialized
      if (!this.priceFeedService.isInitialized()) {
        await this.priceFeedService.initialize();
      }
      
      // Load initial state
      await this.loadInitialState();
      
      // Initial price synchronization
      this.syncPricesFromFeed();
      
      // Only set up the risk assessment interval if not in a test environment
      if (!process.env.NODE_ENV || process.env.NODE_ENV !== 'test') {
        // Perform initial risk assessment if we have data
        if (Object.keys(this.currentWeights).length > 0) {
          // Wait a bit for price data to be loaded
          setTimeout(() => this.assessPortfolioRisk(), 5000);
        }
        
        // Set up regular risk assessment
        this.riskAssessmentInterval = setInterval(() => this.assessPortfolioRisk(), 15 * 60 * 1000); // Every 15 minutes
      } else {
        console.log('🧪 Running in test environment - disabling risk assessment interval');
        // For tests, we'll handle risk assessment explicitly
        this.disableRiskAssessmentTimer();
      }
      
      this.initialized = true;
      console.log('✅ TokenizedIndexService initialized successfully');
    } catch (error) {
      console.error('❌ Failed to initialize TokenizedIndexService:', error);
      throw error;
    }
  }
  
  /**
   * Synchronize token prices from price feed service
   */
  private async syncPricesFromFeed(): Promise<void> {
    try {
      if (!this.priceFeedService) {
        console.warn('⚠️ No price feed service available for sync');
        return;
      }
      
      const allPrices = this.priceFeedService.getAllLatestPrices() || {};
      
      if (!allPrices || Object.keys(allPrices).length === 0) {
        console.warn('⚠️ No prices available from price feed service');
        return;
      }
      
      for (const [symbol, priceInfo] of Object.entries(allPrices)) {
        this.updateTokenPrice(
          priceInfo.tokenId,
          priceInfo.price,
          priceInfo.source
        );
      }
      
      // After updating all prices, check if we need to rebalance
      this.checkPriceDeviationThreshold();
    } catch (error) {
      console.error('❌ Error syncing prices from feed:', error);
    }
  }
  
  /**
   * Load initial state for the service
   */
  private async loadInitialState(): Promise<void> {
    try {
      console.log('🔄 Loading initial state for TokenizedIndexService...');
      
      // Get current token balances from the token service
      const balances = await this.tokenService.getTokenBalances();
      console.log('💰 Current token balances:', balances);
      
      if (Object.keys(balances).length > 0) {
        // Calculate weights based on actual balances
        const totalBalance = Object.values(balances).reduce((sum, val) => sum + val, 0);
        
        if (totalBalance > 0) {
          for (const [token, balance] of Object.entries(balances)) {
            this.currentWeights[token] = balance / totalBalance;
          }
          console.log('⚖️ Calculated token weights from balances:', this.currentWeights);
        } else {
          // If no balance, initialize with equal weights
          this.initializeDefaultWeights();
        }
      } else {
        // If no tokens exist, initialize with default weights
        this.initializeDefaultWeights();
      }
      
      // Load active proposals from persistent storage (if available)
      // In a real implementation, this would load from a database or file
      
      console.log('✅ Loaded initial state successfully');
    } catch (error) {
      console.error('❌ Error loading initial state:', error);
      
      // Fall back to default weights in case of error
      this.initializeDefaultWeights();
    }
  }
  
  /**
   * Initialize default weights for demonstration
   */
  private initializeDefaultWeights(): void {
    // Default weight distribution (simplified for demo)
    this.currentWeights = {
      'BTC': 0.3,  // 30% Bitcoin
      'ETH': 0.25, // 25% Ethereum
      'SOL': 0.15, // 15% Solana
      'HBAR': 0.2, // 20% Hedera
      'LYNX': 0.1  // 10% Lynxify
    };
    
    console.log('ℹ️ Initialized with default weights:', this.currentWeights);
  }
  
  /**
   * Get current token weights
   */
  public getCurrentWeights(): Record<string, number> {
    return { ...this.currentWeights };
  }
  
  /**
   * Get current token prices
   */
  public getTokenPrices(): Record<string, { price: number; timestamp: number; source: string }> {
    return { ...this.tokenPrices };
  }
  
  /**
   * Get active proposals
   */
  public getActiveProposals(): Map<string, RebalanceProposal> {
    return new Map(this.activeProposals);
  }
  
  /**
   * Get service config
   */
  public getConfig(): TokenizedIndexConfig {
    return { ...this.config };
  }
  
  /**
   * Check if the service is initialized
   */
  public isInitialized(): boolean {
    return this.initialized;
  }
  
  /**
   * Clean up resources when shutting down
   */
  public async shutdown(): Promise<void> {
    try {
      console.log('🛑 Shutting down TokenizedIndexService...');
      
      // Clean up any intervals
      if (this.riskAssessmentInterval) {
        clearInterval(this.riskAssessmentInterval);
        this.riskAssessmentInterval = null;
      }
      
      console.log('✅ TokenizedIndexService shutdown completed');
    } catch (error) {
      console.error('❌ Error during TokenizedIndexService shutdown:', error);
      throw error;
    }
  }
  
  /**
   * Disable risk assessment timer (useful for testing)
   * @internal This method is intended for testing purposes only
   */
  public disableRiskAssessmentTimer(): void {
    if (this.riskAssessmentInterval) {
      clearInterval(this.riskAssessmentInterval);
      this.riskAssessmentInterval = null;
    }
  }
  
  /**
   * Legacy cleanup method kept for backward compatibility
   * @deprecated Use shutdown() instead
   */
  public cleanup(): void {
    if (this.riskAssessmentInterval) {
      clearInterval(this.riskAssessmentInterval);
      this.riskAssessmentInterval = null;
    }
  }
  
  /**
   * Get the current risk metrics for the portfolio
   */
  public getPortfolioRiskMetrics(): PortfolioRiskMetrics | undefined {
    return this.portfolioRiskMetrics ? { ...this.portfolioRiskMetrics } : undefined;
  }
  
  /**
   * Get risk metrics for a specific token
   */
  public getTokenRiskMetrics(tokenId: string): TokenRiskMetrics | undefined {
    return this.tokenRiskMetrics[tokenId] ? { ...this.tokenRiskMetrics[tokenId] } : undefined;
  }
  
  /**
   * Get all token risk metrics
   */
  public getAllTokenRiskMetrics(): Record<string, TokenRiskMetrics> {
    return { ...this.tokenRiskMetrics };
  }
} 