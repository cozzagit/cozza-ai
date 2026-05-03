import { existsSync, statSync, readFileSync, watch, type FSWatcher } from 'node:fs';
import { readdir } from 'node:fs/promises';
import { resolve, basename } from 'node:path';
import { homedir } from 'node:os';
import { bus } from '../bus.js';

/**
 * Tails Claude Code session JSONL files in
 *   ~/.claude/projects/<workspace-id>/<sessionId>.jsonl
 * and emits `claude` events when new lines appear.
 *
 * We only care about user/assistant messages and tool_use entries — the
 * raw JSON is large and noisy. Best-effort parser; tolerates schema drift.
 */

interface ClaudeLogLine {
  type?: string;
  message?: { content?: unknown[] };
  toolUseResult?: unknown;
  cwd?: string;
}

const projectsDir = resolve(homedir(), '.claude', 'projects');
const offsets = new Map<string, number>();

export function startClaudeAdapter(): () => void {
  if (!existsSync(projectsDir)) {
    return () => {
      // disabled
    };
  }

  let stopped = false;
  const watchers: FSWatcher[] = [];

  const scanAndWatch = async (): Promise<void> => {
    if (stopped) return;
    let workspaceFolders: string[] = [];
    try {
      workspaceFolders = await readdir(projectsDir);
    } catch {
      return;
    }
    for (const folder of workspaceFolders) {
      const p = resolve(projectsDir, folder);
      let files: string[] = [];
      try {
        files = await readdir(p);
      } catch {
        continue;
      }
      for (const f of files.filter((x) => x.endsWith('.jsonl'))) {
        const file = resolve(p, f);
        readNewLines(file);
        // chokidar would be heavier; one fs.watch per active session is fine.
        try {
          const w = watch(file, { persistent: true }, (eventType) => {
            if (eventType === 'change') readNewLines(file);
          });
          watchers.push(w);
        } catch {
          // ignore, file may not be watchable
        }
      }
    }
  };

  void scanAndWatch();
  // periodic rescan to pick up newly-created sessions
  const t = setInterval(() => void scanAndWatch(), 30_000);

  return () => {
    stopped = true;
    clearInterval(t);
    for (const w of watchers) w.close();
  };
}

function readNewLines(file: string): void {
  let content: string;
  try {
    const sz = statSync(file).size;
    const prev = offsets.get(file) ?? sz; // first read: skip backlog
    if (sz === prev) return;
    if (sz < prev) {
      // truncated/rotated
      offsets.set(file, sz);
      return;
    }
    content = readFileSync(file, 'utf-8').slice(prev);
    offsets.set(file, sz);
  } catch {
    return;
  }

  const sessionId = basename(file, '.jsonl');
  for (const raw of content.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line) continue;
    let obj: ClaudeLogLine;
    try {
      obj = JSON.parse(line) as ClaudeLogLine;
    } catch {
      continue;
    }
    const summary = summarize(obj);
    if (!summary) continue;
    bus.emitEvent({
      type: 'claude',
      ts: Date.now(),
      sessionId,
      ...(obj.cwd ? { project: shortProject(obj.cwd) } : {}),
      msg: summary.slice(0, 200),
    });
  }
}

function shortProject(cwd: string): string {
  const norm = cwd.replace(/\\/g, '/');
  const m = norm.match(/\/Cozza\/([^/]+)/);
  return m?.[1] ?? 'unknown';
}

function summarize(obj: ClaudeLogLine): string | null {
  if (obj.type === 'user' || obj.type === 'assistant') {
    const content = Array.isArray(obj.message?.content) ? obj.message?.content : [];
    for (const part of content ?? []) {
      if (typeof part === 'object' && part && 'type' in part) {
        const t = (part as { type: string }).type;
        if (t === 'text' && 'text' in part) {
          const text = String((part as { text: string }).text ?? '');
          if (text.trim()) return `${obj.type}: ${text}`;
        }
        if (t === 'tool_use' && 'name' in part) {
          return `tool_use: ${(part as { name: string }).name}`;
        }
      }
    }
  }
  return null;
}
