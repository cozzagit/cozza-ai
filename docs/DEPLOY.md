# Deploy & smoke-test guide — cozza-ai MVP (Aruba VPS)

> Manuale operativo Phase 1 per il deploy sulla VPS Aruba esistente di Cozza.
> Pattern standard: nginx subdomain con SSL + Node Hono su PM2.
>
> **Target:** `https://cozza-ai.vibecanyon.com` (record A `→ 188.213.170.214` già impostato 2026-05-01).

---

## 0. Architettura runtime

```
Browser PWA  ────HTTPS───▶  cozza-ai.vibecanyon.com (nginx, 80/443)
                              │
                              ├── /            → /var/www/cozza-ai/apps/web/dist (statici PWA)
                              └── /api/*       → http://127.0.0.1:3025  (Node Hono via PM2)
                                                         │
                                                         ├── Anthropic API
                                                         ├── OpenAI API
                                                         └── ElevenLabs API
```

- Frontend: bundle Vite in `/var/www/cozza-ai/apps/web/dist/`, servito statico da nginx
- Backend: `apps/api/dist/server.js` su Node 20+, **PM2 fork instances=1**, listen `127.0.0.1:3025`
- Stato: in-memory rate limit (instance singola); chat history in IndexedDB lato client
- Secrets: `apps/api/.env` sulla VPS (gitignored)
- SSL: certbot + Let's Encrypt (auto-renew via systemd timer, già attivo sulla VPS)

---

## 1. Prerequisiti (one-time)

### 1.1 — Sulla macchina locale
```bash
node --version            # >= 20.18.0
pnpm --version            # >= 9
git remote -v             # origin = https://github.com/cozzagit/cozza-ai.git
ls ~/.ssh/aruba_vps       # chiave SSH per la VPS
```

### 1.2 — Sulla VPS (verifica una sola volta)
```bash
ssh -i ~/.ssh/aruba_vps root@188.213.170.214

node --version            # >= 20.18.0 (già OK su altri progetti)
corepack enable && corepack prepare pnpm@9.12.0 --activate
pm2 --version             # già installato
nginx -v
which certbot
mkdir -p /var/www/cozza-ai /var/log/pm2
```

### 1.3 — DNS
Record A `cozza-ai.vibecanyon.com → 188.213.170.214`: ✓ già fatto (2026-05-01).

### 1.4 — Secrets sulla VPS (`/var/www/cozza-ai/apps/api/.env`)
Crea il file una sola volta:
```bash
ssh -i ~/.ssh/aruba_vps root@188.213.170.214 \
  'mkdir -p /var/www/cozza-ai/apps/api && cat > /var/www/cozza-ai/apps/api/.env' <<'EOF'
NODE_ENV=production
PORT=3025
HOST=127.0.0.1
ANTHROPIC_API_KEY=sk-ant-api03-...
OPENAI_API_KEY=sk-proj-...
ELEVENLABS_API_KEY=sk_...
ALLOWED_ORIGINS=https://cozza-ai.vibecanyon.com
RATE_LIMIT_PER_MIN=30
EOF
ssh -i ~/.ssh/aruba_vps root@188.213.170.214 \
  'chmod 600 /var/www/cozza-ai/apps/api/.env'
```

> **Mai** committare il `.env`. La sola fonte di verità è la VPS. Lo script `deploy.sh` non tocca il `.env`.

---

## 2. Local dev

```bash
cd c:/work/Cozza/cozza-ai
pnpm install
pnpm --filter @cozza/shared build    # genera packages/shared/dist (workspace dep)

cp apps/api/.env.example apps/api/.env
# Edita apps/api/.env con le 3 chiavi

cp apps/web/.env.example apps/web/.env
# Edita VITE_ELEVENLABS_VOICE_ID con il voice id italiano scelto

pnpm dev
# - frontend: http://localhost:5173 (vite proxy /api → 127.0.0.1:3025)
# - api:      http://127.0.0.1:3025
```

Test rapidi:
```bash
curl http://127.0.0.1:3025/api/healthz
# {"status":"ok","commit":"local","timestamp":"..."}
```

---

## 3. Smoke test pre-deploy

### 3.1 — Chat Anthropic SSE
```bash
curl -N -X POST http://127.0.0.1:3025/api/chat/anthropic \
  -H 'Content-Type: application/json' \
  -H 'Origin: http://localhost:5173' \
  -d '{
    "provider": "anthropic",
    "model": "claude-haiku-4-5",
    "messages": [{"role":"user","content":"Dimmi ciao in tre parole."}]
  }'
```

### 3.2 — Chat OpenAI SSE
```bash
curl -N -X POST http://127.0.0.1:3025/api/chat/openai \
  -H 'Content-Type: application/json' \
  -H 'Origin: http://localhost:5173' \
  -d '{
    "provider": "openai",
    "model": "gpt-4o-mini",
    "messages": [{"role":"user","content":"Dimmi ciao in tre parole."}]
  }'
```

### 3.3 — TTS ElevenLabs
```bash
curl -X POST http://127.0.0.1:3025/api/tts \
  -H 'Content-Type: application/json' \
  -H 'Origin: http://localhost:5173' \
  -d '{"text":"Ciao, sono cozza-ai.","voiceId":"<TUO_VOICE_ID_IT>"}' \
  --output test.mp3
```

### 3.4 — Security smoke
```bash
# CORS allowlist (Origin sconosciuto blocca preflight)
curl -i -X OPTIONS http://127.0.0.1:3025/api/chat/anthropic \
  -H 'Origin: https://malicious.example' \
  -H 'Access-Control-Request-Method: POST'
# Atteso: 403

# Body troppo grande
curl -i -X POST http://127.0.0.1:3025/api/chat/anthropic \
  -H 'Content-Type: application/json' \
  -H 'Origin: http://localhost:5173' \
  -H 'Content-Length: 5000000' \
  -d 'X'
# Atteso: 413
```

### 3.5 — Rate limit
```bash
for i in $(seq 1 35); do
  curl -s -o /dev/null -w '%{http_code}\n' -X POST http://127.0.0.1:3025/api/chat/anthropic \
    -H 'Content-Type: application/json' -H 'Origin: http://localhost:5173' \
    -d '{"provider":"anthropic","model":"claude-haiku-4-5","messages":[{"role":"user","content":"hi"}]}'
done | sort | uniq -c
# Atteso: ~30x 200, ~5x 429
```

---

## 4. Deploy

### 4.1 — Una sola riga
```bash
pnpm deploy:vps
# (== bash deploy/deploy.sh)
```

Lo script fa **tutto** in ordine:
1. `pnpm install --frozen-lockfile` locale
2. Build `@cozza/shared` (genera `dist/`)
3. Build `apps/web` con `VITE_BUILD_COMMIT=$(git rev-parse --short HEAD)`
4. Build `apps/api` (TypeScript → `apps/api/dist/`)
5. Verifica zero secret leak nel bundle web
6. rsync su `/var/www/cozza-ai/` (web/dist, api/dist, shared/dist, package.json, ecosystem.config.cjs)
7. Sulla VPS: `pnpm install --prod`, symlink nginx config, `nginx -t && systemctl reload`, `certbot --nginx` (idempotente), `pm2 reload cozza-ai-api`
8. `curl /api/healthz` di verifica

### 4.2 — Variabili override
```bash
VPS_HOST=staging.example.com bash deploy/deploy.sh    # se servisse uno staging
DOMAIN=other.example.com bash deploy/deploy.sh        # cambia dominio per certbot
```

### 4.3 — Manuale (se deploy.sh non gira da Windows)

Da Git Bash / WSL2:
```bash
bash deploy/deploy.sh
```

Se rsync non è disponibile, fallback con scp:
```bash
pnpm build
ssh -i ~/.ssh/aruba_vps root@188.213.170.214 'mkdir -p /var/www/cozza-ai/apps/web/dist /var/www/cozza-ai/apps/api/dist /var/www/cozza-ai/packages/shared/dist'
scp -i ~/.ssh/aruba_vps -r apps/web/dist/* root@188.213.170.214:/var/www/cozza-ai/apps/web/dist/
scp -i ~/.ssh/aruba_vps -r apps/api/dist/* root@188.213.170.214:/var/www/cozza-ai/apps/api/dist/
scp -i ~/.ssh/aruba_vps -r packages/shared/dist/* root@188.213.170.214:/var/www/cozza-ai/packages/shared/dist/
scp -i ~/.ssh/aruba_vps {package.json,pnpm-workspace.yaml,ecosystem.config.cjs} root@188.213.170.214:/var/www/cozza-ai/
scp -i ~/.ssh/aruba_vps deploy/nginx-cozza-ai.conf root@188.213.170.214:/etc/nginx/sites-available/cozza-ai
ssh -i ~/.ssh/aruba_vps root@188.213.170.214 << 'EOS'
cd /var/www/cozza-ai
pnpm install --prod --filter '!@cozza/shared'
ln -sf /etc/nginx/sites-available/cozza-ai /etc/nginx/sites-enabled/cozza-ai
nginx -t && systemctl reload nginx
[ -d /etc/letsencrypt/live/cozza-ai.vibecanyon.com ] || \
  certbot --nginx -d cozza-ai.vibecanyon.com --non-interactive --agree-tos --redirect -m luca.cozza@gmail.com
pm2 describe cozza-ai-api >/dev/null 2>&1 \
  && pm2 reload cozza-ai-api --update-env \
  || pm2 start ecosystem.config.cjs --only cozza-ai-api --update-env
pm2 save
EOS
```

---

## 5. Verifica post-deploy

```bash
# Live health
curl https://cozza-ai.vibecanyon.com/api/healthz
# {"status":"ok","commit":"<sha>","timestamp":"..."}

# Static index
curl -I https://cozza-ai.vibecanyon.com/
# HTTP/2 200 (cache no-cache su index.html)

# Manifest PWA
curl https://cozza-ai.vibecanyon.com/manifest.webmanifest

# SSL grade
curl -sI https://cozza-ai.vibecanyon.com/ | grep -i strict
```

Sulla VPS:
```bash
pm2 status cozza-ai-api
pm2 logs cozza-ai-api --lines 30
journalctl -u nginx -n 30
```

---

## 6. PWA install Pixel 10a (dal 2026-05-04)

1. `https://cozza-ai.vibecanyon.com` su Chrome Android
2. Menu → "Aggiungi alla schermata Home" / "Installa app"
3. Lancia da home screen → fullscreen, splash nero, status bar nascosta

### 6.1 — Test su Beast (dal 2026-05-07)
1. Pixel 10a → USB-C → Beast XR (DP Alt Mode automatico)
2. Lancia PWA
3. UI a schermo virtuale 174". Verifica:
   - Contenuto core entro `max-w-sweet-lg` (900px)
   - Font ≥18px leggibili
   - Tap target 44px+
   - Audio open-ear OK

---

## 7. Rollback

```bash
# Backend: PM2 conserva l'ultima versione in /var/www/cozza-ai/apps/api/dist
pm2 logs cozza-ai-api          # capisci se è il deploy a fare casino
pm2 restart cozza-ai-api

# Frontend: ripristina manualmente il dist precedente da git tag
git checkout v0.0.x -- apps/web/dist  # se tagghi i bundle (consigliato post-MVP)
# Oppure rideploya una versione precedente
git checkout <prev-sha>
bash deploy/deploy.sh
git checkout main
```

I dati IndexedDB lato client sono **isolati** dal deploy server, quindi un rollback API non perde la chat history.

---

## 8. Troubleshooting

| Sintomo | Cosa controllare |
|---|---|
| `502 Bad Gateway` su `/api/*` | `pm2 status` (riparti se stopped) → `pm2 logs cozza-ai-api` |
| `403` CORS in browser | `ALLOWED_ORIGINS` in `/var/www/cozza-ai/apps/api/.env` deve includere il dominio esatto |
| SSE che si interrompe a metà | nginx ha `proxy_buffering off` (verifica `cat /etc/nginx/sites-enabled/cozza-ai`) |
| Audio TTS non parte | Origin in chrome:// dev tools, verifica response `Content-Type: audio/mpeg` |
| `429` immediato | Riavvia PM2 (`_resetRateLimiter` non chiamato in prod, riavvio pulisce la mappa) |
| Certbot fallisce | Record A non propagato. Verifica con `dig cozza-ai.vibecanyon.com +short` (deve dare `188.213.170.214`) |

---

## 9. Definition of Done MVP

Vedi `docs/architecture-final.md §10` (code review checklist) e `prompts/claude-code-kickoff.md` (DoD).

Tag `v0.1.0-mvp` solo quando:
- [ ] `https://cozza-ai.vibecanyon.com` carica la PWA
- [ ] Chat Anthropic + OpenAI streaming live
- [ ] Voice loop funziona <2.5s
- [ ] Storage Dexie persiste cross-reload
- [ ] PM2 status `online`, log puliti
- [ ] SSL Let's Encrypt valido (≥30gg)
