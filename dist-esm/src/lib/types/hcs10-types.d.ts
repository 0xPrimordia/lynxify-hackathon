/**
 * HCS-10 Protocol Message Types
 */
export interface HCS10ProtocolMessage {
    p: 'hcs-10';
    op: string;
    timestamp?: number;
}
export interface HCS10ConnectionRequest extends HCS10ProtocolMessage {
    op: 'connection_request';
    operator_id: string;
}
export interface HCS10ConnectionCreated extends HCS10ProtocolMessage {
    op: 'connection_created';
    requesterId: string;
}
export interface HCS10Message extends HCS10ProtocolMessage {
    op: 'message';
    data: string;
}
/**
 * Application-specific message types
 */
export interface ApplicationMessage {
    type: string;
    timestamp: number;
}
export interface RebalanceProposal extends ApplicationMessage {
    type: 'RebalanceProposal';
    proposalId: string;
    newWeights: Record<string, number>;
    executeAfter?: number;
    quorum?: number;
}
export interface RebalanceApproved extends ApplicationMessage {
    type: 'RebalanceApproved';
    proposalId: string;
    approvedAt: number;
}
export interface RebalanceExecuted extends ApplicationMessage {
    type: 'RebalanceExecuted';
    proposalId: string;
    preBalances: Record<string, number>;
    postBalances: Record<string, number>;
    executedAt: number;
}
/**
 * Helper types
 */
export type ApplicationMessageType = RebalanceProposal | RebalanceApproved | RebalanceExecuted;
export interface HCSMessage {
    sequence_number: number;
    contents: string;
    timestamp: string;
    topic_id: string;
}
export interface MessageStreamResponse {
    messages: Array<HCSMessage>;
}
export interface HCS10ClientConfig {
    network: string;
    operatorId: string;
    operatorPrivateKey: string;
    inboundTopicId?: string;
    outboundTopicId?: string;
    logLevel?: string;
}
export interface HCS10Client {
    createTopic(): Promise<string>;
    sendMessage(topicId: string, message: string): Promise<{
        success: boolean;
    }>;
    getMessageStream(topicId: string): Promise<MessageStreamResponse>;
    retrieveCommunicationTopics?(accountId: string): Promise<{
        inboundTopic: string;
        outboundTopic: string;
    }>;
    getMessages?(topicId: string): Promise<HCSMessage[]>;
}
