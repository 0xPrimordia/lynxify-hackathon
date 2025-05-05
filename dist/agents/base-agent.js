"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
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
    start() {
        return __awaiter(this, void 0, void 0, function* () {
            if (this.isRunning) {
                throw new Error(`Agent ${this.id} is already running`);
            }
            this.isRunning = true;
            yield this.hederaService.subscribeToTopic(this.inputTopic, this.handleMessage.bind(this));
            console.log(`Agent ${this.id} started and listening on topic ${this.inputTopic}`);
        });
    }
    stop() {
        return __awaiter(this, void 0, void 0, function* () {
            if (!this.isRunning) {
                throw new Error(`Agent ${this.id} is not running`);
            }
            this.isRunning = false;
            yield this.hederaService.unsubscribeFromTopic(this.inputTopic);
            console.log(`Agent ${this.id} stopped`);
        });
    }
    publishHCSMessage(message) {
        return __awaiter(this, void 0, void 0, function* () {
            if (!this.isRunning) {
                throw new Error(`Agent ${this.id} is not running`);
            }
            yield this.hederaService.publishHCSMessage(this.outputTopic, message);
        });
    }
}
exports.BaseAgent = BaseAgent;
