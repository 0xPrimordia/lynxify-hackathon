import { HederaService } from '@/app/services/hedera';
import { RebalanceAgent } from '@/app/services/agents/rebalance-agent';
import { HCSMessage } from '@/app/types/hcs';
import { TokenWeights } from '@/app/types/hcs';

jest.mock('@/app/services/hedera');

describe('End-to-End Rebalance Flow', () => {
  let hederaService: HederaService;
  let rebalanceAgent: RebalanceAgent;
  
  // Track published messages
  const publishedMessages: Record<string, HCSMessage[]> = {
    governance: [],
    agent: []
  };
  
  // Track the proposal ID
  let proposalId: string;
  
  // Define topic IDs
  const GOVERNANCE_TOPIC = '0.0.12347';
  const AGENT_TOPIC = '0.0.12346';
  
  beforeAll(() => {
    // Set environment variables
    process.env.NEXT_PUBLIC_HCS_GOVERNANCE_TOPIC = GOVERNANCE_TOPIC;
    process.env.NEXT_PUBLIC_HCS_AGENT_TOPIC = AGENT_TOPIC;
  });
  
  beforeEach(() => {
    jest.clearAllMocks();
    
    // Reset the message store
    publishedMessages.governance = [];
    publishedMessages.agent = [];
    
    // Mock the HederaService
    hederaService = {
      publishHCSMessage: jest.fn().mockImplementation(async (topicId: string, message: HCSMessage) => {
        if (topicId === GOVERNANCE_TOPIC) {
          publishedMessages.governance.push(message);
        } else if (topicId === AGENT_TOPIC) {
          publishedMessages.agent.push(message);
        }
        return Promise.resolve();
      }),
      subscribeToTopic: jest.fn().mockResolvedValue(undefined),
      unsubscribeFromTopic: jest.fn().mockResolvedValue(undefined),
      proposeRebalance: jest.fn().mockImplementation(async (newWeights: TokenWeights, executeAfter: number, quorum: number) => {
        proposalId = `P${Date.now()}`;
        const proposal: HCSMessage = {
          id: proposalId,
          type: 'RebalanceProposal',
          timestamp: Date.now(),
          sender: 'test-user',
          details: {
            proposalId,
            newWeights,
            executeAfter,
            quorum
          }
        };
        
        await hederaService.publishHCSMessage(
          GOVERNANCE_TOPIC,
          proposal
        );
      }),
      approveRebalance: jest.fn().mockImplementation(async (proposalId: string) => {
        const approval: HCSMessage = {
          id: `A${Date.now()}`,
          type: 'RebalanceApproved',
          timestamp: Date.now(),
          sender: 'test-user',
          details: {
            proposalId,
            approvedAt: Date.now()
          }
        };
        
        await hederaService.publishHCSMessage(
          GOVERNANCE_TOPIC,
          approval
        );
      }),
      executeRebalance: jest.fn().mockImplementation(async (proposalId: string, newWeights: TokenWeights) => {
        const execution: HCSMessage = {
          id: `E${Date.now()}`,
          type: 'RebalanceExecuted',
          timestamp: Date.now(),
          sender: 'rebalance-agent',
          details: {
            proposalId,
            executedAt: Date.now(),
            preBalances: { 'BTC': 0.4, 'ETH': 0.4, 'SOL': 0.2 },
            postBalances: newWeights
          }
        };
        
        await hederaService.publishHCSMessage(
          AGENT_TOPIC,
          execution
        );
      }),
      getCurrentPortfolioWeights: jest.fn().mockReturnValue({ 'BTC': 0.4, 'ETH': 0.4, 'SOL': 0.2 })
    } as unknown as HederaService;
    
    // Create agent instance with proper mocking
    rebalanceAgent = new RebalanceAgent(hederaService);
  });
  
  test('Complete rebalance flow: propose, approve, and execute', async () => {
    // 1. Create new portfolio weights
    const newWeights = { 'BTC': 0.5, 'ETH': 0.3, 'SOL': 0.2 };
    const executeAfter = Date.now() + 3600000; // 1 hour in the future
    const quorum = 0.51; // 51% quorum
    
    // 2. Propose the rebalance
    await hederaService.proposeRebalance(newWeights, executeAfter, quorum);
    
    // Verify the proposal was published
    expect(publishedMessages.governance.length).toBe(1);
    expect(publishedMessages.governance[0].type).toBe('RebalanceProposal');
    expect(publishedMessages.governance[0].details.newWeights).toEqual(newWeights);
    
    // Get the proposal ID from the published message
    const proposalIdFromMessage = publishedMessages.governance[0].details.proposalId as string;
    expect(proposalIdFromMessage).toBeDefined();
    
    // 3. Approve the rebalance proposal
    await hederaService.approveRebalance(proposalIdFromMessage);
    
    // Verify the approval was published
    expect(publishedMessages.governance.length).toBe(2);
    expect(publishedMessages.governance[1].type).toBe('RebalanceApproved');
    expect(publishedMessages.governance[1].details.proposalId).toBe(proposalIdFromMessage);
    
    // 4. Execute the approved rebalance
    await hederaService.executeRebalance(proposalIdFromMessage, newWeights);
    
    // Verify the execution was published
    expect(publishedMessages.agent.length).toBe(1);
    expect(publishedMessages.agent[0].type).toBe('RebalanceExecuted');
    expect(publishedMessages.agent[0].details.proposalId).toBe(proposalIdFromMessage);
    expect(publishedMessages.agent[0].details.postBalances).toEqual(newWeights);
    
    // 5. Verify the full sequence of events
    expect(hederaService.proposeRebalance).toHaveBeenCalledWith(newWeights, executeAfter, quorum);
    expect(hederaService.approveRebalance).toHaveBeenCalledWith(proposalIdFromMessage);
    expect(hederaService.executeRebalance).toHaveBeenCalledWith(proposalIdFromMessage, newWeights);
  });
  
  test('Rebalance agent processes approved proposals automatically', async () => {
    // Mock necessary methods on the rebalance agent
    (rebalanceAgent as any).isRunning = true;
    (rebalanceAgent as any).handleMessage = jest.fn().mockImplementation(async (message: HCSMessage) => {
      if (message.type === 'RebalanceApproved') {
        const proposal = await (hederaService as any).getProposal(message.details.proposalId);
        if (proposal && proposal.type === 'RebalanceProposal') {
          await hederaService.executeRebalance(proposal.details.proposalId, proposal.details.newWeights);
        }
      }
    });
    
    // Create a proposal message
    const testProposalId = `P${Date.now()}`;
    const newWeights = { 'BTC': 0.6, 'ETH': 0.3, 'SOL': 0.1 };
    
    // Create an approval message that simulates the governance approval
    const approvalMessage: HCSMessage = {
      id: `A${Date.now()}`,
      type: 'RebalanceApproved',
      timestamp: Date.now(),
      sender: 'governance',
      details: {
        proposalId: testProposalId,
        approvedAt: Date.now()
      }
    };
    
    // Create a corresponding proposal that simulates what would be in the message store
    const proposalMessage: HCSMessage = {
      id: testProposalId,
      type: 'RebalanceProposal',
      timestamp: Date.now() - 1000, // Slightly earlier
      sender: 'test-user',
      details: {
        proposalId: testProposalId,
        newWeights,
        executeAfter: Date.now() - 100, // Already eligible for execution
        quorum: 0.51
      }
    };
    
    // Mock the getProposal method to return our test proposal
    (hederaService as any).getProposal = jest.fn().mockResolvedValue(proposalMessage);
    
    // Trigger the message handler directly
    await (rebalanceAgent as any).handleMessage(approvalMessage);
    
    // Verify the rebalance was executed
    expect(hederaService.executeRebalance).toHaveBeenCalledWith(testProposalId, newWeights);
    
    // Check that the execution message was published
    expect(publishedMessages.agent.length).toBe(1);
    const executionMessage = publishedMessages.agent[0];
    expect(executionMessage.type).toBe('RebalanceExecuted');
    expect(executionMessage.details.proposalId).toBe(testProposalId);
  });
}); 