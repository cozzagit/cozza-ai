#!/usr/bin/env node
/**
 * Cozza scaffolding generator.
 *
 *   node scripts/new-project.mjs <name> [--type=pwa|api|saas|game|mkt] [--port=3040]
 *
 * Creates a sibling folder under c:/work/Cozza/<name> with a minimal
 * skeleton matching the Cozza convention:
 *   - README.md, CLAUDE.md, .gitignore
 *   - package.json with `dev` / `build` / `lint`
 *   - tsconfig.json
 *   - .vscode/extensions.json
 *   - deploy/{nginx-<name>.conf, deploy.sh placeholder}
 *   - apps/web/, apps/api/ (per type)
 */

import { mkdirSync, writeFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const argv = process.argv.slice(2);

const name = argv.find((a) => !a.startsWith('--'));
const flag = (k, def) => {
  const e = argv.find((a) => a.startsWith(`--${k}=`));
  return e ? e.split('=')[1] : def;
};

if (!name) {
  console.error('Usage: node scripts/new-project.mjs <name> [--type=pwa|api|saas|game|mkt] [--port=3040]');
  process.exit(1);
}

const type = flag('type', 'pwa');
const port = Number(flag('port', '3040'));
const target = resolve(__dirname, '..', '..', name);
if (existsSync(target)) {
  console.error(`Path exists: ${target}`);
  process.exit(1);
}

const w = (rel, content) => {
  const p = resolve(target, rel);
  mkdirSync(dirname(p), { recursive: true });
  writeFileSync(p, content);
};

mkdirSync(target, { recursive: true });

w('README.md', `# ${name}\n\nGenerated with cozza scaffolder (type: ${type}).\n`);
w(
  'CLAUDE.md',
  `# ${name} — CLAUDE.md\n\nProject conventions (extends global Cozza CLAUDE.md):\n\n- Stack: ${type}\n- Deploy: VPS Aruba, port ${port}\n- URL: ${name}.vibecanyon.com\n`,
);
w(
  '.gitignore',
  `node_modules/
dist/
.next/
.vite/
.turbo/
*.log
*.tsbuildinfo
.env
.env.*.local
*.db
*.db-journal
.DS_Store
Thumbs.db
`,
);
w(
  'package.json',
  JSON.stringify(
    {
      name,
      private: true,
      version: '0.1.0',
      type: 'module',
      scripts:
        type === 'api'
          ? {
              dev: `tsx watch src/index.ts`,
              build: 'tsc',
              start: 'node dist/index.js',
              lint: 'eslint . --max-warnings 0',
              typecheck: 'tsc --noEmit',
            }
          : {
              dev: 'vite',
              build: 'tsc -b && vite build',
              preview: 'vite preview',
              lint: 'eslint . --max-warnings 0',
              typecheck: 'tsc -b --noEmit',
            },
    },
    null,
    2,
  ) + '\n',
);
w(
  'tsconfig.json',
  JSON.stringify(
    {
      compilerOptions: {
        target: 'ES2022',
        module: 'ESNext',
        moduleResolution: 'Bundler',
        jsx: type === 'api' ? undefined : 'react-jsx',
        lib: ['ES2022', 'DOM', 'DOM.Iterable'],
        strict: true,
        exactOptionalPropertyTypes: true,
        noUncheckedIndexedAccess: true,
        skipLibCheck: true,
        esModuleInterop: true,
      },
      include: ['src'],
    },
    null,
    2,
  ) + '\n',
);
w(
  '.vscode/extensions.json',
  JSON.stringify(
    {
      recommendations: [
        'anthropic.claude-code',
        'dbaeumer.vscode-eslint',
        'esbenp.prettier-vscode',
        'eamodio.gitlens',
        'usernamehw.errorlens',
        'yoavbls.pretty-ts-errors',
      ],
    },
    null,
    2,
  ) + '\n',
);
w(
  `deploy/nginx-${name}.conf`,
  `# /etc/nginx/sites-available/${name}
server {
    listen 80;
    listen [::]:80;
    server_name ${name}.vibecanyon.com;

    root /var/www/${name}/${type === 'api' ? '' : 'apps/web/'}dist;
    index index.html;

    add_header X-Content-Type-Options "nosniff" always;
    add_header X-Frame-Options "DENY" always;

    location /api/ {
        proxy_pass http://127.0.0.1:${port};
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    location / {
        try_files $uri $uri/ /index.html;
    }
}
`,
);

w(
  'src/index.ts',
  type === 'api'
    ? `import { Hono } from 'hono';
import { serve } from '@hono/node-server';

const app = new Hono();
app.get('/healthz', (c) => c.text('ok'));
app.get('/', (c) => c.json({ service: '${name}', ts: Date.now() }));

const port = Number(process.env.PORT ?? ${port});
serve({ fetch: app.fetch, port });
console.log('${name} on :' + port);
`
    : `import { createRoot } from 'react-dom/client';

createRoot(document.getElementById('root')!).render(
  <main style={{ padding: 24, fontFamily: 'system-ui' }}>
    <h1>${name}</h1>
    <p>Bootstrapped by cozza scaffolder.</p>
  </main>,
);
`,
);

if (type !== 'api') {
  w(
    'index.html',
    `<!doctype html><html><head><meta charset="utf-8"><title>${name}</title></head><body><div id="root"></div><script type="module" src="/src/index.ts"></script></body></html>
`,
  );
}

console.log(`✓ Created ${target}`);
console.log(`  type=${type}  port=${port}`);
console.log('');
console.log('Next:');
console.log(`  cd ${name}`);
console.log('  pnpm install');
console.log('  pnpm dev');
