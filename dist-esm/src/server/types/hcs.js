"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.isValidHCSMessage = isValidHCSMessage;
exports.isRebalanceProposal = isRebalanceProposal;
exports.isRiskAlert = isRiskAlert;
exports.isPolicyChange = isPolicyChange;
function isValidHCSMessage(message) {
    return (typeof message === 'object' &&
        message !== null &&
        typeof message.id === 'string' &&
        typeof message.type === 'string' &&
        typeof message.timestamp === 'number' &&
        typeof message.sender === 'string' &&
        typeof message.details === 'object');
}
function isRebalanceProposal(message) {
    return message.type === 'RebalanceProposal';
}
function isRiskAlert(message) {
    return message.type === 'RiskAlert';
}
function isPolicyChange(message) {
    return message.type === 'PolicyChange';
}
