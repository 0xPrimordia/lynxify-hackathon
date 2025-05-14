export interface AgentWebSocketMessage {
    type: string;
    data: any;
}
/**
 * React hook for connecting to the unified agent WebSocket service
 * and handling agent events in real-time
 *
 * @param url WebSocket URL to connect to (defaults to ws://localhost:3001)
 * @returns Object containing WebSocket state and message handlers
 */
export declare function useAgentWebSocket(url?: string): {
    connected: boolean;
    error: Error | null;
    messages: AgentWebSocketMessage[];
    sendMessage: (type: string, data: any) => boolean;
    getMessagesByType: (type: string) => AgentWebSocketMessage[];
    getLatestMessageByType: (type: string) => AgentWebSocketMessage | null;
    clearMessages: () => void;
};
