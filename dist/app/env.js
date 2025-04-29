"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.env = void 0;
var dotenv_1 = __importDefault(require("dotenv"));
var path_1 = __importDefault(require("path"));
// Load environment variables
var envPath = path_1.default.resolve(process.cwd(), '.env.local');
console.log('Loading environment variables from:', envPath);
dotenv_1.default.config({ path: envPath });
// Validate required environment variables
var requiredEnvVars = [
    'NEXT_PUBLIC_OPERATOR_ID',
    'OPERATOR_KEY',
    'NEXT_PUBLIC_GOVERNANCE_TOPIC_ID',
    'NEXT_PUBLIC_AGENT_TOPIC_ID',
    'NEXT_PUBLIC_WS_URL'
];
for (var _i = 0, requiredEnvVars_1 = requiredEnvVars; _i < requiredEnvVars_1.length; _i++) {
    var envVar = requiredEnvVars_1[_i];
    if (!process.env[envVar]) {
        throw new Error("Missing required environment variable: ".concat(envVar));
    }
}
// Export environment variables
exports.env = {
    operatorId: process.env.NEXT_PUBLIC_OPERATOR_ID,
    operatorKey: process.env.OPERATOR_KEY,
    governanceTopicId: process.env.NEXT_PUBLIC_GOVERNANCE_TOPIC_ID,
    agentTopicId: process.env.NEXT_PUBLIC_AGENT_TOPIC_ID,
    wsUrl: process.env.NEXT_PUBLIC_WS_URL
};
