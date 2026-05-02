import Dexie, { type Table } from 'dexie';
import type { ChatModel, ChatProvider, WorkspaceId } from '@cozza/shared';

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

/** Tile pinned in launcher (Netflix, DAZN, Claude.ai, vscode.dev, …) */
export interface AppTile {
  id: string;
  name: string;
  url: string;
  /** lucide-style icon slug, or 'emoji:🎬', or absolute icon URL */
  icon: string;
  /** category slug used to group tiles in the launcher */
  category: 'streaming' | 'ai' | 'work' | 'study' | 'music' | 'social' | 'other';
  /** optional Android intent URL (for native app deep-linking when on Pixel) */
  androidIntent?: string;
  sortOrder: number;
  pinned: boolean;
  builtin: boolean;
  createdAt: number;
}

export type PaneSourceType = 'app' | 'cozza-chat' | 'iframe' | 'note';

export interface PaneConfig {
  /** unique within a workspace */
  id: string;
  /** position label: 'left' | 'right' | 'top' | 'bottom' | 'tl' | 'tr' | 'bl' | 'br' */
  slot: string;
  type: PaneSourceType;
  /** for type=app: the AppTile.id; for iframe: the URL; for note: free text; for cozza-chat: empty */
  ref: string;
  title?: string;
}

export type WorkspaceLayout = 'single' | 'split-2-h' | 'split-2-v' | 'cols-3' | 'grid-2x2';

export interface WorkspaceConfig {
  id: WorkspaceId | string;
  name: string;
  icon: string;
  description?: string;
  layout: WorkspaceLayout;
  panes: PaneConfig[];
  builtin: boolean;
  sortOrder: number;
}

class CozzaDb extends Dexie {
  conversations!: Table<Conversation, string>;
  messages!: Table<MessageRecord, string>;
  audioBlobs!: Table<AudioBlobRecord, string>;
  apps!: Table<AppTile, string>;
  workspaces!: Table<WorkspaceConfig, string>;

  constructor() {
    super('cozza-ai');
    this.version(1).stores({
      conversations: 'id, lastMessageAt, provider',
      messages: 'id, conversationId, createdAt, [conversationId+createdAt]',
      audioBlobs: 'key, createdAt',
    });
    this.version(2).stores({
      conversations: 'id, lastMessageAt, provider',
      messages: 'id, conversationId, createdAt, [conversationId+createdAt]',
      audioBlobs: 'key, createdAt',
      apps: 'id, category, sortOrder, pinned',
      workspaces: 'id, sortOrder',
    });
  }
}

export const db = new CozzaDb();
