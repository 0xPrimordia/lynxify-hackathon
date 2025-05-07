export function isValidHCSMessage(message) {
    return (typeof message === 'object' &&
        message !== null &&
        typeof message.id === 'string' &&
        typeof message.type === 'string' &&
        typeof message.timestamp === 'number' &&
        typeof message.sender === 'string' &&
        typeof message.details === 'object');
}
// Type guard functions
export function isRebalanceProposal(message) {
    return message.type === 'RebalanceProposal';
}
export function isRebalanceApproved(message) {
    return message.type === 'RebalanceApproved';
}
export function isRebalanceExecuted(message) {
    return message.type === 'RebalanceExecuted';
}
export function isPriceUpdate(message) {
    return message.type === 'PriceUpdate';
}
export function isRiskAlert(message) {
    return message.type === 'RiskAlert';
}
export function isPolicyChange(message) {
    return message.type === 'PolicyChange';
}
export function isMoonscapeMessage(message) {
    return message.type === 'AgentInfo' || message.type === 'AgentResponse' || message.type === 'AgentRequest';
}
