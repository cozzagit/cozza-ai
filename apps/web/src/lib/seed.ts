import { v7 as uuidv7 } from 'uuid';
import { db, type AppTile, type WorkspaceConfig } from './db';

/**
 * First-launch seed of the launcher (apps) and the 5 workspaces.
 * Idempotent: skipped if anything already exists.
 *
 * Built-in records have `builtin: true` so the admin UI can offer
 * a "reset" without nuking user-created tiles.
 */

const now = (): number => Date.now();

const SEED_APPS: Omit<AppTile, 'id' | 'createdAt'>[] = [
  // Streaming
  {
    name: 'Netflix',
    url: 'https://www.netflix.com',
    icon: 'emoji:🎬',
    category: 'streaming',
    androidIntent:
      'intent://www.netflix.com#Intent;scheme=https;package=com.netflix.mediaclient;end',
    sortOrder: 10,
    pinned: true,
    builtin: true,
  },
  {
    name: 'DAZN',
    url: 'https://www.dazn.com/it-IT',
    icon: 'emoji:⚽',
    category: 'streaming',
    androidIntent: 'intent://www.dazn.com#Intent;scheme=https;package=com.dazn;end',
    sortOrder: 20,
    pinned: true,
    builtin: true,
  },
  {
    name: 'Prime Video',
    url: 'https://www.primevideo.com',
    icon: 'emoji:📺',
    category: 'streaming',
    androidIntent:
      'intent://www.primevideo.com#Intent;scheme=https;package=com.amazon.avod.thirdpartyclient;end',
    sortOrder: 30,
    pinned: true,
    builtin: true,
  },
  {
    name: 'Disney+',
    url: 'https://www.disneyplus.com',
    icon: 'emoji:🏰',
    category: 'streaming',
    androidIntent:
      'intent://www.disneyplus.com#Intent;scheme=https;package=com.disney.disneyplus;end',
    sortOrder: 40,
    pinned: false,
    builtin: true,
  },
  {
    name: 'NOW',
    url: 'https://www.nowtv.it',
    icon: 'emoji:🎞️',
    category: 'streaming',
    sortOrder: 50,
    pinned: false,
    builtin: true,
  },
  {
    name: 'YouTube',
    url: 'https://www.youtube.com',
    icon: 'emoji:▶️',
    category: 'streaming',
    androidIntent:
      'intent://www.youtube.com#Intent;scheme=https;package=com.google.android.youtube;end',
    sortOrder: 60,
    pinned: true,
    builtin: true,
  },
  {
    name: 'RaiPlay',
    url: 'https://www.raiplay.it',
    icon: 'emoji:🇮🇹',
    category: 'streaming',
    sortOrder: 70,
    pinned: false,
    builtin: true,
  },
  {
    name: 'Mediaset Infinity',
    url: 'https://mediasetinfinity.mediaset.it',
    icon: 'emoji:📡',
    category: 'streaming',
    sortOrder: 80,
    pinned: false,
    builtin: true,
  },
  {
    name: 'Twitch',
    url: 'https://www.twitch.tv',
    icon: 'emoji:🎮',
    category: 'streaming',
    sortOrder: 90,
    pinned: false,
    builtin: true,
  },

  // Music
  {
    name: 'Spotify',
    url: 'https://open.spotify.com',
    icon: 'emoji:🎧',
    category: 'music',
    androidIntent: 'intent://open.spotify.com#Intent;scheme=https;package=com.spotify.music;end',
    sortOrder: 110,
    pinned: true,
    builtin: true,
  },
  {
    name: 'YouTube Music',
    url: 'https://music.youtube.com',
    icon: 'emoji:🎵',
    category: 'music',
    sortOrder: 120,
    pinned: false,
    builtin: true,
  },

  // AI
  {
    name: 'Claude',
    url: 'https://claude.ai',
    icon: 'emoji:✦',
    category: 'ai',
    sortOrder: 200,
    pinned: true,
    builtin: true,
  },
  {
    name: 'ChatGPT',
    url: 'https://chatgpt.com',
    icon: 'emoji:🟢',
    category: 'ai',
    sortOrder: 210,
    pinned: true,
    builtin: true,
  },
  {
    name: 'Gemini',
    url: 'https://gemini.google.com',
    icon: 'emoji:✨',
    category: 'ai',
    sortOrder: 220,
    pinned: false,
    builtin: true,
  },

  // Work
  {
    name: 'VS Code Web',
    url: 'https://vscode.dev',
    icon: 'emoji:💻',
    category: 'work',
    sortOrder: 300,
    pinned: true,
    builtin: true,
  },
  {
    name: 'GitHub Dev',
    url: 'https://github.dev',
    icon: 'emoji:🐙',
    category: 'work',
    sortOrder: 310,
    pinned: true,
    builtin: true,
  },
  {
    name: 'GitHub',
    url: 'https://github.com',
    icon: 'emoji:📦',
    category: 'work',
    sortOrder: 320,
    pinned: false,
    builtin: true,
  },
  {
    name: 'Linear',
    url: 'https://linear.app',
    icon: 'emoji:📈',
    category: 'work',
    sortOrder: 330,
    pinned: false,
    builtin: true,
  },
  {
    name: 'Notion',
    url: 'https://www.notion.so',
    icon: 'emoji:🗒️',
    category: 'work',
    sortOrder: 340,
    pinned: false,
    builtin: true,
  },
  {
    name: 'Figma',
    url: 'https://www.figma.com',
    icon: 'emoji:🎨',
    category: 'work',
    sortOrder: 350,
    pinned: false,
    builtin: true,
  },

  // Study
  {
    name: 'Wikipedia',
    url: 'https://it.wikipedia.org',
    icon: 'emoji:📚',
    category: 'study',
    sortOrder: 400,
    pinned: false,
    builtin: true,
  },
  {
    name: 'arXiv',
    url: 'https://arxiv.org',
    icon: 'emoji:📜',
    category: 'study',
    sortOrder: 410,
    pinned: false,
    builtin: true,
  },

  // Social
  {
    name: 'X',
    url: 'https://x.com',
    icon: 'emoji:🅧',
    category: 'social',
    sortOrder: 500,
    pinned: false,
    builtin: true,
  },
  {
    name: 'Reddit',
    url: 'https://www.reddit.com',
    icon: 'emoji:👽',
    category: 'social',
    sortOrder: 510,
    pinned: false,
    builtin: true,
  },
];

const SEED_WORKSPACES: WorkspaceConfig[] = [
  {
    id: 'casual',
    name: 'Casual',
    icon: 'emoji:🏠',
    description: 'Home dashboard: chat AI + tiles app preferite',
    layout: 'single',
    panes: [{ id: 'main', slot: 'full', type: 'cozza-chat', ref: '' }],
    builtin: true,
    sortOrder: 10,
  },
  {
    id: 'lavoriamo',
    name: 'Lavoriamo',
    icon: 'emoji:💻',
    description: 'VS Code + chat Claude + browser preview live',
    layout: 'cols-3',
    panes: [
      { id: 'editor', slot: 'left', type: 'iframe', ref: 'https://vscode.dev', title: 'Editor' },
      { id: 'chat', slot: 'center', type: 'cozza-chat', ref: '', title: 'AI' },
      { id: 'preview', slot: 'right', type: 'iframe', ref: 'https://github.com', title: 'Preview' },
    ],
    builtin: true,
    sortOrder: 20,
  },
  {
    id: 'cinema',
    name: 'Cinema',
    icon: 'emoji:🎬',
    description: 'Launcher fullscreen Netflix / DAZN / Prime / YouTube',
    layout: 'single',
    panes: [{ id: 'launcher', slot: 'full', type: 'note', ref: 'cinema-launcher' }],
    builtin: true,
    sortOrder: 30,
  },
  {
    id: 'studio',
    name: 'Studio',
    icon: 'emoji:📚',
    description: 'Reading + chat AI per studio voice-first',
    layout: 'split-2-h',
    panes: [
      {
        id: 'reader',
        slot: 'left',
        type: 'iframe',
        ref: 'https://it.wikipedia.org',
        title: 'Reader',
      },
      { id: 'chat', slot: 'right', type: 'cozza-chat', ref: '', title: 'AI' },
    ],
    builtin: true,
    sortOrder: 40,
  },
  {
    id: 'ambient',
    name: 'Ambient',
    icon: 'emoji:🌙',
    description: 'UI minimale, voice hands-free per camminare',
    layout: 'single',
    panes: [{ id: 'voice', slot: 'full', type: 'cozza-chat', ref: '' }],
    builtin: true,
    sortOrder: 50,
  },
];

export async function seedIfEmpty(): Promise<void> {
  const t = now();
  const appsCount = await db.apps.count();
  if (appsCount === 0) {
    await db.apps.bulkAdd(SEED_APPS.map((a) => ({ ...a, id: uuidv7(), createdAt: t })));
  }
  const wsCount = await db.workspaces.count();
  if (wsCount === 0) {
    await db.workspaces.bulkAdd(SEED_WORKSPACES);
  }
}

/** Reset built-in apps and workspaces to factory defaults. User-created tiles preserved. */
export async function resetBuiltins(): Promise<void> {
  const t = now();
  const allApps = await db.apps.toArray();
  await db.apps.bulkDelete(allApps.filter((a) => a.builtin).map((a) => a.id));
  await db.apps.bulkAdd(SEED_APPS.map((a) => ({ ...a, id: uuidv7(), createdAt: t })));
  const allWs = await db.workspaces.toArray();
  await db.workspaces.bulkDelete(allWs.filter((w) => w.builtin).map((w) => w.id));
  await db.workspaces.bulkAdd(SEED_WORKSPACES);
}
