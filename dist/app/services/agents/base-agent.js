"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.BaseAgent = void 0;
class BaseAgent {
    constructor(config) {
        this.isRunning = false;
        this.id = config.id;
        this.type = config.type;
        this.hederaService = config.hederaService;
        this.inputTopic = config.topics.input;
        this.outputTopic = config.topics.output;
    }
    async start() {
        if (this.isRunning) {
            throw new Error(`Agent ${this.id} is already running`);
        }
        this.isRunning = true;
        await this.hederaService.subscribeToTopic(this.inputTopic, this.handleMessage.bind(this));
        console.log(`Agent ${this.id} started and listening on topic ${this.inputTopic}`);
    }
    async stop() {
        if (!this.isRunning) {
            throw new Error(`Agent ${this.id} is not running`);
        }
        this.isRunning = false;
        await this.hederaService.unsubscribeFromTopic(this.inputTopic);
        console.log(`Agent ${this.id} stopped`);
    }
    async publishHCSMessage(message) {
        if (!this.isRunning) {
            throw new Error(`Agent ${this.id} is not running`);
        }
        await this.hederaService.publishHCSMessage(this.outputTopic, message);
    }
}
exports.BaseAgent = BaseAgent;
