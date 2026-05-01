import Dexie, { type Table } from 'dexie';
import type { ChatModel, ChatProvider } from '@cozza/shared';

export interface Conversation {
  id: string;
  title: string;
  provider: ChatProvider;
  model: ChatModel;
  createdAt: number;
  lastMessageAt: number;
  messageCount: number;
}

export interface MessageRecord {
  id: string;
  conversationId: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  createdAt: number;
  audioBlobKey?: string;
  inputTokens?: number;
  outputTokens?: number;
}

export interface AudioBlobRecord {
  key: string;
  blob: Blob;
  createdAt: number;
}

class CozzaDb extends Dexie {
  conversations!: Table<Conversation, string>;
  messages!: Table<MessageRecord, string>;
  audioBlobs!: Table<AudioBlobRecord, string>;

  constructor() {
    super('cozza-ai');
    this.version(1).stores({
      conversations: 'id, lastMessageAt, provider',
      messages: 'id, conversationId, createdAt, [conversationId+createdAt]',
      audioBlobs: 'key, createdAt',
    });
  }
}

export const db = new CozzaDb();
