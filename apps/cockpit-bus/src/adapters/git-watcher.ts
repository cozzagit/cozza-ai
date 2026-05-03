import chokidar from 'chokidar';
import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { bus } from '../bus.js';

/**
 * Git watcher: watches `.git/HEAD` and `.git/refs/heads/*` of a list of
 * project paths. Emits a `git` event on commit / branch change.
 *
 * The list of paths is configured via the parent watch root — by default
 * `c:/work/Cozza` so that all 25+ projects are picked up.
 */

interface WatchOpts {
  root: string;
  /** Project folder names to ignore (heavy ones, archives). */
  ignore?: string[];
}

export function startGitWatcher(opts: WatchOpts): () => void {
  const root = resolve(opts.root);
  const ignore = new Set(opts.ignore ?? []);

  const pattern = [
    `${root}/*/.git/HEAD`,
    `${root}/*/.git/refs/heads/**`,
    `${root}/*/.git/logs/HEAD`,
  ];

  const watcher = chokidar.watch(pattern, {
    ignored: (p) => {
      const proj = p.split(/[/\\]/).find((s) => s && !s.includes('.git'));
      return Boolean(proj && ignore.has(proj));
    },
    ignoreInitial: true,
    persistent: true,
    awaitWriteFinish: { stabilityThreshold: 200, pollInterval: 100 },
  });

  const projectFromPath = (p: string): string => {
    const norm = p.replace(/\\/g, '/');
    const m = norm.match(/\/Cozza\/([^/]+)\/\.git\//);
    return m?.[1] ?? 'unknown';
  };

  const readHead = (gitDir: string): { hash: string; ref: string } | null => {
    const headFile = resolve(gitDir, 'HEAD');
    if (!existsSync(headFile)) return null;
    const head = readFileSync(headFile, 'utf-8').trim();
    if (head.startsWith('ref: ')) {
      const ref = head.slice(5);
      const refFile = resolve(gitDir, ref);
      const hash = existsSync(refFile) ? readFileSync(refFile, 'utf-8').trim() : '';
      return { hash, ref };
    }
    return { hash: head, ref: 'detached' };
  };

  const onChange = (p: string): void => {
    const project = projectFromPath(p);
    const norm = p.replace(/\\/g, '/');
    const gitDirMatch = norm.match(/^(.*\/\.git)\//);
    const gitDir = gitDirMatch?.[1];
    if (!gitDir) return;
    const head = readHead(gitDir);
    if (!head) return;
    const action = norm.includes('/HEAD') ? 'branch-change' : 'commit';
    bus.emitEvent({
      type: 'git',
      ts: Date.now(),
      project,
      action,
      hash: head.hash,
      ref: head.ref,
    });
  };

  watcher.on('change', onChange).on('add', onChange);

  return () => {
    void watcher.close();
  };
}
