/**
 * HCS-10 Protocol Message Types
 */

// Base interface for all HCS-10 messages
export interface HCS10ProtocolMessage {
  p: 'hcs-10';
  op: string;
  timestamp?: number;
}

// Connection request message
export interface HCS10ConnectionRequest extends HCS10ProtocolMessage {
  op: 'connection_request';
  operator_id: string;
}

// Connection created response
export interface HCS10ConnectionCreated extends HCS10ProtocolMessage {
  op: 'connection_created';
  requesterId: string;
}

// General message container
export interface HCS10Message extends HCS10ProtocolMessage {
  op: 'message';
  data: string; // JSON string of the actual message content
}

/**
 * Application-specific message types
 */

// Base for all application messages
export interface ApplicationMessage {
  type: string;
  timestamp: number;
}

// Rebalance proposal message
export interface RebalanceProposal extends ApplicationMessage {
  type: 'RebalanceProposal';
  proposalId: string;
  newWeights: Record<string, number>;
  executeAfter?: number;
  quorum?: number;
}

// Rebalance approved message
export interface RebalanceApproved extends ApplicationMessage {
  type: 'RebalanceApproved';
  proposalId: string;
  approvedAt: number;
}

// Rebalance executed message
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

// Union type of all application-specific message types
export type ApplicationMessageType = 
  | RebalanceProposal
  | RebalanceApproved
  | RebalanceExecuted;

// Message stream response type
export interface MessageStreamResponse {
  messages: Array<{
    sequence_number: number;
    contents: string;
  }>;
}

// HCS-10 Client Configuration
export interface HCS10ClientConfig {
  network: string;
  operatorId: string;
  operatorPrivateKey: string;
}

// Interface for the HCS10Client
export interface HCS10Client {
  createTopic(): Promise<string>;
  sendMessage(topicId: string, message: string): Promise<{ success: boolean }>;
  getMessageStream(topicId: string): Promise<MessageStreamResponse>;
} 