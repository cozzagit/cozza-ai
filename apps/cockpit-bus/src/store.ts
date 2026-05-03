import Database from 'better-sqlite3';
import { config } from './config.js';
import type { CockpitEvent } from './events.js';

/**
 * Lightweight SQLite store for last-N-days replay. Dashboard "ultimi 7 giorni"
 * reads from here. Live subscribers read from the in-memory bus.
 */

const db = new Database(config.dbPath);
db.pragma('journal_mode = WAL');
db.pragma('synchronous = NORMAL');

db.exec(`
  CREATE TABLE IF NOT EXISTS events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    ts INTEGER NOT NULL,
    type TEXT NOT NULL,
    project TEXT,
    payload TEXT NOT NULL
  );
  CREATE INDEX IF NOT EXISTS idx_events_ts   ON events(ts DESC);
  CREATE INDEX IF NOT EXISTS idx_events_type ON events(type, ts DESC);
  CREATE INDEX IF NOT EXISTS idx_events_proj ON events(project, ts DESC);
`);

const insertStmt = db.prepare(
  'INSERT INTO events (ts, type, project, payload) VALUES (?, ?, ?, ?)',
);

export function persistEvent(e: CockpitEvent): void {
  const project = 'project' in e && typeof e.project === 'string' ? e.project : null;
  insertStmt.run(e.ts, e.type, project, JSON.stringify(e));
}

export function recentEvents(opts: {
  type?: CockpitEvent['type'];
  project?: string;
  sinceTs?: number;
  limit?: number;
}): CockpitEvent[] {
  const limit = Math.min(opts.limit ?? 200, 1000);
  const where: string[] = [];
  const params: unknown[] = [];
  if (opts.type) {
    where.push('type = ?');
    params.push(opts.type);
  }
  if (opts.project) {
    where.push('project = ?');
    params.push(opts.project);
  }
  if (opts.sinceTs) {
    where.push('ts >= ?');
    params.push(opts.sinceTs);
  }
  const sql = `SELECT payload FROM events ${
    where.length ? `WHERE ${where.join(' AND ')}` : ''
  } ORDER BY ts DESC LIMIT ?`;
  params.push(limit);
  const rows = db.prepare(sql).all(...params) as { payload: string }[];
  return rows.map((r) => JSON.parse(r.payload) as CockpitEvent);
}

// Cleanup loop: drop events older than 14 days.
setInterval(
  () => {
    const cutoff = Date.now() - 14 * 24 * 3600_000;
    db.prepare('DELETE FROM events WHERE ts < ?').run(cutoff);
  },
  3600_000, // hourly
);
