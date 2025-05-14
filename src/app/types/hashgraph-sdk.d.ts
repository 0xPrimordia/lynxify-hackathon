declare module '@hashgraph/sdk' {
  export class Client {
    static forTestnet(): Client;
    setOperator(operatorId: AccountId, operatorKey: PrivateKey): void;
  }

  export class AccountId {
    static fromString(id: string): AccountId;
  }

  export class PrivateKey {
    static fromString(key: string): PrivateKey;
    static fromStringED25519(key: string): PrivateKey;
    static fromStringECDSA(key: string): PrivateKey;
    static fromStringDer(key: string): PrivateKey;
    publicKey: any;
  }

  export class TopicId {
    static fromString(id: string): TopicId;
  }

  export class TokenId {
    static fromString(id: string): TokenId;
  }

  export class TopicCreateTransaction {
    setTopicMemo(memo: string): this;
    execute(client: Client): Promise<TransactionResponse>;
  }

  export class TopicMessageSubmitTransaction {
    setTopicId(topicId: TopicId): this;
    setMessage(message: string): this;
    execute(client: Client): Promise<TransactionResponse>;
    freezeWith(client: Client): Promise<this>;
    sign(privateKey: PrivateKey): Promise<this>;
  }

  export class TopicInfoQuery {
    setTopicId(topicId: TopicId): this;
    execute(client: Client): Promise<{
      topicId: TopicId;
      adminKey?: any;
      submitKey?: any;
      topicMemo: string;
    }>;
  }

  export class TopicMessageQuery {
    setTopicId(topicId: TopicId): this;
    subscribe(
      client: Client,
      errorHandler: ((message: TopicMessage | null, error: Error) => void) | null,
      listener: (message: TopicMessage) => void
    ): any;
  }

  export interface TransactionResponse {
    getReceipt(client: Client): Promise<{ topicId?: string }>;
    transactionId: any;
  }

  export interface TopicMessage {
    contents: Uint8Array;
    consensusTimestamp?: any;
    sequenceNumber?: any;
    topicId?: any;
  }
} 