import { HederaService } from './hedera';
/**
 * HCS Messaging Service
 * Handles formatting and sending messages to HCS topics
 */
export class HCSMessagingService {
    constructor(hederaService) {
        this.hederaService = hederaService;
    }
    /**
     * Send a message to a Moonscape topic using HCS-10 standard format
     * @param outboundTopicId The outbound topic ID to publish to
     * @param inboundTopicId The agent's inbound topic ID
     * @param operatorId The agent's account ID
     * @param message The message to format and send
     */
    async sendToMoonscape(outboundTopicId, inboundTopicId, operatorId, message) {
        if (!outboundTopicId) {
            console.log('⚠️ HCS MESSAGING: Cannot send message - outbound topic not configured');
            return false;
        }
        try {
            console.log(`🌙 HCS MESSAGING: Sending message to outbound channel: ${message.type}`);
            // Format outbound message according to HCS-10 standard
            const moonscapeMessage = {
                p: "hcs-10", // Protocol identifier
                op: "message", // Operation type for standard message
                operator_id: `${inboundTopicId}@${operatorId}`,
                data: JSON.stringify({
                    id: message.id || `msg-${Date.now()}`,
                    type: message.type,
                    timestamp: Date.now(),
                    content: message.details?.message || "Agent activity update",
                    metadata: {
                        testTime: new Date().toISOString(), // Required field for Moonscape
                        agentId: operatorId,
                        status: message.details?.rebalancerStatus,
                        proposalId: message.details?.proposalId,
                        executedAt: message.details?.executedAt
                    }
                }),
                m: "Message from Lynxify Agent" // Optional memo
            };
            await this.hederaService.publishHCSMessage(outboundTopicId, moonscapeMessage);
            console.log('✅ HCS MESSAGING: Message sent successfully with HCS-10 format');
            return true;
        }
        catch (error) {
            console.error('❌ HCS MESSAGING ERROR: Failed to send message:', error);
            return false;
        }
    }
    /**
     * Send agent status update to a Moonscape topic
     * @param outboundTopicId The outbound topic ID to publish to
     * @param inboundTopicId The agent's inbound topic ID
     * @param operatorId The agent's account ID
     * @param pendingProposals Number of pending proposals
     * @param executedProposals Number of executed proposals
     */
    async sendAgentStatus(outboundTopicId, inboundTopicId, operatorId, pendingProposals, executedProposals) {
        if (!outboundTopicId) {
            console.log('⚠️ HCS MESSAGING: Cannot send status - outbound topic not configured');
            return false;
        }
        try {
            console.log('🌙 HCS MESSAGING: Sending agent status message');
            // Format according to HCS-10 standard for message operations
            const statusMessage = {
                p: "hcs-10",
                op: "message",
                operator_id: `${inboundTopicId}@${operatorId}`,
                data: JSON.stringify({
                    id: `status-${Date.now()}`,
                    timestamp: Date.now(),
                    type: "AgentStatus",
                    content: "Rebalancer Agent is active and monitoring proposals",
                    metadata: {
                        testTime: new Date().toISOString(),
                        agentId: operatorId,
                        pendingProposals,
                        executedProposals,
                        status: "active"
                    }
                }),
                m: "Agent status update"
            };
            await this.hederaService.publishHCSMessage(outboundTopicId, statusMessage);
            console.log('✅ HCS MESSAGING: Status message sent successfully with HCS-10 format');
            return true;
        }
        catch (error) {
            console.error('❌ HCS MESSAGING ERROR: Failed to send status message:', error);
            return false;
        }
    }
    /**
     * Send a standard HCS message to any topic
     * @param topicId The topic ID to publish to
     * @param message The message to send
     */
    async sendHCSMessage(topicId, message) {
        if (!topicId) {
            console.log('⚠️ HCS MESSAGING: Cannot send message - topic ID not provided');
            return false;
        }
        try {
            console.log(`🌙 HCS MESSAGING: Sending message to topic ${topicId}: ${message.type}`);
            await this.hederaService.publishHCSMessage(topicId, message);
            console.log(`✅ HCS MESSAGING: Message published successfully to topic ${topicId}`);
            return true;
        }
        catch (error) {
            console.error('❌ HCS MESSAGING ERROR: Failed to send message:', error);
            return false;
        }
    }
}
// Create a singleton instance
const hederaService = new HederaService();
export default new HCSMessagingService(hederaService);
