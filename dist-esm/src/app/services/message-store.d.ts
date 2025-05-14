import { HCSMessage } from '../types/hcs.js';
declare class MessageStore {
    private static instance;
    private messages;
    private messageIds;
    private constructor();
    static getInstance(): MessageStore;
    addMessage(topicId: string, message: HCSMessage): void;
    getMessages(topicId: string): HCSMessage[];
    getAllMessages(): HCSMessage[];
    clearMessages(): void;
}
declare const messageStore: MessageStore;
export default messageStore;
