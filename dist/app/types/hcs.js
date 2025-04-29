"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.isValidHCSMessage = isValidHCSMessage;
function isValidHCSMessage(message) {
    if (!message || typeof message !== 'object')
        return false;
    if (!('type' in message) || !('timestamp' in message) || !('sender' in message))
        return false;
    const validTypes = [
        'RebalanceProposal',
        'RebalanceApproved',
        'RebalanceExecuted',
        'PriceUpdate',
        'RiskAlert',
        'PolicyChange',
        'PolicyUpdated'
    ];
    return validTypes.includes(message.type);
}
