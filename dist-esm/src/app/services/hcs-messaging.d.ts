import { HCSMessage } from '../types/hcs';
import { HederaService } from './hedera';
export type HCS10Message = {
    p: string;
    op: string;
    operator_id?: string;
    account_id?: string;
    data?: string;
    m?: string;
};
/**
 * HCS Messaging Service
 * Handles formatting and sending messages to HCS topics
 */
export declare class HCSMessagingService {
    private hederaService;
    constructor(hederaService: HederaService);
    /**
     * Send a message to a Moonscape topic using HCS-10 standard format
     * @param outboundTopicId The outbound topic ID to publish to
     * @param inboundTopicId The agent's inbound topic ID
     * @param operatorId The agent's account ID
     * @param message The message to format and send
     */
    sendToMoonscape(outboundTopicId: string, inboundTopicId: string, operatorId: string, message: HCSMessage): Promise<boolean>;
    /**
     * Send agent status update to a Moonscape topic
     * @param outboundTopicId The outbound topic ID to publish to
     * @param inboundTopicId The agent's inbound topic ID
     * @param operatorId The agent's account ID
     * @param pendingProposals Number of pending proposals
     * @param executedProposals Number of executed proposals
     */
    sendAgentStatus(outboundTopicId: string, inboundTopicId: string, operatorId: string, pendingProposals: number, executedProposals: number): Promise<boolean>;
    /**
     * Send a standard HCS message to any topic
     * @param topicId The topic ID to publish to
     * @param message The message to send
     */
    sendHCSMessage(topicId: string, message: HCSMessage): Promise<boolean>;
}
declare const _default: HCSMessagingService;
export default _default;
