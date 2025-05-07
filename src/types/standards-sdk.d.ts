// Type declarations for @hashgraphonline/standards-sdk

declare module '@hashgraphonline/standards-sdk' {
  // HCS10Client class
  export class HCS10Client {
    constructor(config: {
      network: string;
      operatorId: string;
      operatorPrivateKey: string;
      logLevel?: string;
    });
    
    // Core methods
    getClient(): any;
    createAccount(): Promise<any>;
    createTopic(options?: { memo?: string }): Promise<string>;
    submitPayload(topicId: string, payload: any): Promise<any>;
    
    // Message handling methods
    getMessageStream(topicId: string): Promise<{ messages: HCSMessage[] }>;
    sendMessage(topicId: string, message: string): Promise<any>;
    getMessageContent(reference: string): Promise<string | ArrayBuffer>;
    
    // Connection methods
    createInboundTopic(): Promise<any>;
    handleConnectionRequest(inboundTopicId: string, requesterId: string, sequenceNumber: number): Promise<{ connectionTopicId: string }>;
    confirmConnection(connectionData: any): Promise<any>;
    waitForConnectionConfirmation(topicId: string): Promise<any>;
    
    // Agent methods
    createAgent(agentData: any): Promise<any>;
    createAndRegisterAgent(agentData: any): Promise<any>;
    registerAgent(agentData: any): Promise<any>;
    registerAgentWithGuardedRegistry(agentData: any): Promise<any>;
    
    // Other methods
    inscribePfp(data: any): Promise<any>;
    storeHCS11Profile(data: any): Promise<any>;
    setupFees(data: any): Promise<any>;
    setupExemptKeys(data: any): Promise<any>;
    inscribeFile(file: any, options?: any): Promise<any>;
    getAccountAndSigner(): Promise<any>;
  }
  
  // HCSMessage interface
  export interface HCSMessage {
    sequence_number: number;
    content?: string;
    contents?: string; // Alternative property name used in runtime
    data?: string;     // Another alternative property name used in some SDK versions
    topic_id?: string;
    consensus_timestamp?: string;
    [key: string]: any;
  }
  
  // Logger class
  export class Logger {
    constructor(options: {
      module: string;
      level?: string;
      prettyPrint?: boolean;
    });
    
    debug(message: string, ...args: any[]): void;
    info(message: string, ...args: any[]): void;
    warn(message: string, ...args: any[]): void;
    error(message: string, ...args: any[]): void;
  }
} 