import { readFileSync } from 'node:fs';
import { config } from './config.js';

export interface ProjectEntry {
  name: string;
  url: string | null;
  port: number | null;
  stack: string | null;
  status: string | null;
  category: 'saas' | 'app' | 'game' | 'concept' | 'other';
}

/**
 * Parse `memory/all-projects.md` into a structured catalog so adapters
 * (health, deploy, logs) know what to ping. The file format is the
 * markdown table the user maintains by hand — we do best-effort regex
 * extraction. Falls back to a hardcoded minimal list if the file is
 * missing.
 */
const FALLBACK: ProjectEntry[] = [
  {
    name: 'cozza-ai',
    url: 'https://cozza-ai.vibecanyon.com',
    port: 3025,
    stack: 'Vite+React PWA + Hono Node',
    status: 'LIVE',
    category: 'saas',
  },
];

const URL_RX = /\b([a-z0-9-]+(?:\.[a-z0-9-]+)+)\b/i;
const PORT_RX = /\b([0-9]{3,5})\b/;

function categoryFromHeading(heading: string): ProjectEntry['category'] {
  const h = heading.toLowerCase();
  if (h.includes('saas') || h.includes('piattaform')) return 'saas';
  if (h.includes('giochi') || h.includes('gioco')) return 'game';
  if (h.includes('concept') || h.includes('fattib')) return 'concept';
  if (h.includes('app')) return 'app';
  return 'other';
}

export function loadProjects(): ProjectEntry[] {
  const path = config.projectsCatalog;
  if (!path) return FALLBACK;
  let text: string;
  try {
    text = readFileSync(path, 'utf-8');
  } catch {
    return FALLBACK;
  }
  const out: ProjectEntry[] = [];
  let currentCategory: ProjectEntry['category'] = 'other';
  for (const line of text.split(/\r?\n/)) {
    const heading = line.match(/^##\s+(.+?)\s*$/);
    if (heading?.[1]) {
      currentCategory = categoryFromHeading(heading[1]);
      continue;
    }
    if (!line.startsWith('|') || line.includes('---')) continue;
    const cells = line.split('|').map((c) => c.trim());
    if (cells.length < 4) continue;
    // skip header rows
    if (/^Progetto$/i.test(cells[1] ?? '') || /^Gioco$/i.test(cells[1] ?? '')) continue;
    const rawName = cells[1] ?? '';
    if (!rawName || rawName.startsWith(':')) continue;
    const name = rawName.replace(/\*/g, '').trim();
    if (!name) continue;
    const rest = cells.slice(2).join(' ');
    const urlMatch = rest.match(URL_RX);
    const portMatch = (cells[3] ?? '').match(PORT_RX);
    out.push({
      name,
      url: urlMatch ? `https://${urlMatch[1]}` : null,
      port: portMatch?.[1] ? Number(portMatch[1]) : null,
      stack: cells[3] ?? cells[4] ?? null,
      status: cells[cells.length - 2] ?? null,
      category: currentCategory,
    });
  }
  return out.length ? out : FALLBACK;
}
