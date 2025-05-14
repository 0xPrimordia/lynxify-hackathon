import { LynxifyAgent } from '../../app/services/lynxify-agent';
/**
 * Utility function to safely disable all timers in the agent for testing
 * This helps prevent "Cannot log after tests are done" errors
 */
export declare function disableAgentTimers(agent: LynxifyAgent): Promise<void>;
