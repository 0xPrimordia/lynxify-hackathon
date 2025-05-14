export declare class AgentManager {
    private hederaService;
    private priceFeedAgent;
    private riskAssessmentAgent;
    private rebalanceAgent;
    private runningAgents;
    constructor();
    startAgent(agentId: string): Promise<void>;
    stopAgent(agentId: string): Promise<void>;
    getAgentStatus(agentId: string): 'running' | 'stopped' | 'error';
    getAllAgentStatuses(): {
        [key: string]: 'running' | 'stopped' | 'error';
    };
    start(): Promise<void>;
    stop(): Promise<void>;
}
