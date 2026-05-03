# 🛸 Cozza Cockpit — manuale

Sistema operativo personale di sviluppo: VS Code + browser + Viture Beast + Pixel = una sola plancia di comando per i 25+ progetti della piattaforma.

## TL;DR

```pwsh
# Setup una tantum (chiave SSH dedicata + autorizzazione VPS)
pwsh ./scripts/install-tunnel.ps1

# Lancio quotidiano del cockpit
pwsh ./scripts/cockpit.ps1            # apre VS Code col workspace cozza-ai
pwsh ./scripts/cockpit.ps1 -Tunnel    # idem + apre il tunnel SSH inverso
pwsh ./scripts/cockpit.ps1 -All       # apre il workspace multiverse (tutti i 25)
```

In VS Code: `Ctrl+Shift+B` → lancia il task **🚀 cockpit:up** → si aprono in parallelo web, api, cockpit-bus, hud, remote, tail VPS, terminale Claude Code.

## Architettura

```
+-----------+    +----------------+    +-----------+
| Pixel 10a |    |  PC casa Win   |    |    VPS    |
| HUD/Remote| ── │  cockpit-bus   │ ── │   nginx   │
| trackpad  |    │  + autossh -R  │    │  proxy    │
+-----------+    +----------------+    +-----------+
                                        cozza-ai.vibecanyon.com/cockpit/...
```

- **cockpit-bus** (porta 3030, sul tuo PC): Hono + WebSocket. Aggrega healthz, git watcher, PM2 logs, quota provider, Claude session log. Espone `/api/*` REST + `/ws` WebSocket.
- **autossh** apre un reverse tunnel `vps:3031 ⇄ pc:3030`. nginx sul VPS proxy-passa `/cockpit/api/*` e `/cockpit/ws` al tunnel. Se il PC è offline → 502 grazioso.
- **cockpit-hud** (Vite, porta 5174 dev): PWA per Viture Beast e desktop. 6 modalità (Vitals/Stream/Logs/Diff/Metrics/Ambient) e doppio tema (Cyberpunk neon + Bauhaus mono).
- **cockpit-remote** (Vite, porta 5175 dev): PWA mobile. 5 viste (Home/Trackpad/Switcher/Actions/Voice). Trackpad multitouch invia eventi mouse/keyboard al bus → nut.js sul PC esegue.

## File chiave

| Path                                 | Cosa                                                                     |
| ------------------------------------ | ------------------------------------------------------------------------ |
| `cozza-ai.code-workspace`            | workspace single-project con 9 folder root                               |
| `../cozza-multiverse.code-workspace` | workspace multi-project con tutti i 25                                   |
| `.vscode/tasks.json`                 | task `cockpit:up`, `tunnel:up`, `deploy:vps` ecc.                        |
| `.vscode/launch.json`                | debug compound web+api+bus+hud                                           |
| `.vscode/settings.json`              | tema Synthwave, font Geist Mono, error lens                              |
| `.vscode/cozza.code-snippets`        | snippet per pattern ricorrenti                                           |
| `apps/cockpit-bus/`                  | servizio Hono+WS che monitora tutto                                      |
| `apps/cockpit-hud/`                  | PWA HUD per Viture+desktop                                               |
| `apps/cockpit-remote/`               | PWA mobile remote+trackpad                                               |
| `scripts/cockpit.ps1`                | one-shot launcher                                                        |
| `scripts/install-tunnel.ps1`         | setup chiave SSH dedicata + autorizzazione VPS                           |
| `scripts/tunnel.ps1`                 | apre il reverse SSH tunnel persistente                                   |
| `deploy/nginx-cozza-ai.conf`         | location `/cockpit/`, `/cockpit/remote/`, `/cockpit/api/`, `/cockpit/ws` |

## SSH Tunnel — primo setup

```pwsh
pwsh ./scripts/install-tunnel.ps1
```

Lo script:

1. genera `~/.ssh/cozza_cockpit_ed25519` (chiave **dedicata**, no passphrase)
2. usa la tua chiave admin `~/.ssh/aruba_vps` per copiare la chiave nuova in `authorized_keys` sul VPS, con scope ristretto (`command="echo cockpit-only", no-pty, permitopen="localhost:3031"`) → la chiave nuova **non può fare shell**, può solo aprire il forward
3. fa un test del tunnel
4. stampa istruzioni per registrarlo come servizio Windows via NSSM (parte al boot)

Dopodiché: `pwsh ./scripts/tunnel.ps1` apre e mantiene il tunnel.

Per registrarlo come servizio (parte al boot):

```pwsh
winget install nssm.nssm
nssm install cozza-cockpit-tunnel pwsh.exe "-NoProfile -ExecutionPolicy Bypass -File C:\work\Cozza\cozza-ai\scripts\tunnel.ps1"
nssm start cozza-cockpit-tunnel
```

## VS Code layout

6 layout interscambiabili (palette → "Cozza: Switch Layout" — TODO estensione VS Code):

| #   | Nome            | Quando usarlo                               |
| --- | --------------- | ------------------------------------------- |
| 1   | Mission Control | default — codice + AI + preview + terminali |
| 2   | Code Tunnel     | editor full + AI laterale, niente preview   |
| 3   | Visual Lab      | preview enorme + small editor               |
| 4   | Debug Bay       | breakpoint compound web+api+bus             |
| 5   | Ops Bridge      | log VPS + pm2 + healthz, niente codice      |
| 6   | Zen             | solo editor centrato                        |

Per ora cambia manualmente i pannelli; l'estensione `cozza-cockpit-vscode` arriva in F4 e li switcha con `Ctrl+K Ctrl+1..6`.

## HUD — temi

- **🌆 Cyberpunk** (default) — palette ciano #00E5FF + magenta #FF00AA + ambra, scanlines, grid, font Orbitron, glow, archi angolari
- **⚪ Bauhaus** — bianco/nero, font Geist 900 maiuscolo, nessun glow, contrasto AAA, surfaces con border 2px e shadow 6px offset

Switch on-the-fly: tasto `T` da tastiera, oppure pill in alto a destra. Persisted in `localStorage`.

## HUD — modalità

| Tasto | Mode    | Cosa mostra                                          |
| ----- | ------- | ---------------------------------------------------- |
| 1     | Vitals  | health di tutti i progetti, latency, status counts   |
| 2     | Stream  | feed live di Claude Code (cosa sta facendo l'agente) |
| 3     | Logs    | tail aggregato con filtro testuale                   |
| 4     | Diff    | git activity (commit, branch change)                 |
| 5     | Metrics | CPU/RAM PM2 dei processi sul VPS                     |
| 6     | Ambient | wallpaper generativo per pause                       |

## Mobile Remote — modalità

- **Home** — lista progetti con badge healthz, tap per drill-down
- **Trackpad** — multitouch full screen: 1-finger drag = move, tap = left click, 2-finger tap = right click, 2-finger drag verticale = scroll, 3-finger tap = middle click. Sensibilità configurabile (default 1.5x).
- **Switcher** — cambia la modalità HUD sulle Viture (broadcast via bus — TODO completamento)
- **Actions** — pad rapido per deploy/restart/lighthouse
- **Voice** — mic → cozza-ai (riusa pipeline esistente)

**Killswitch**: in Trackpad mode, bottone rosso ⛔ in basso. Disarma il modulo input lato bus, qualunque sia lo stato. Codice di conferma in `COCKPIT_KILL_CODE` (env del bus).

## Cockpit Bus — env vars

```ini
# apps/cockpit-bus/.env
PORT=3030
COCKPIT_JWT_SECRET=<32+ char random>
COCKPIT_ALLOWED_ORIGINS=https://cozza-ai.vibecanyon.com,http://localhost:5174,http://localhost:5175
COCKPIT_DB_PATH=./cockpit.db
COCKPIT_PROJECTS_CATALOG=C:/Users/lucap/.claude/projects/c--work-Cozza/memory/all-projects.md
COCKPIT_VPS_HOST=188.213.170.214
COCKPIT_VPS_USER=root
COCKPIT_VPS_KEY=C:/Users/lucap/.ssh/aruba_vps
COCKPIT_HEALTH_POLL_SECONDS=30
COCKPIT_INPUT_ENABLED=true
COCKPIT_KILL_CODE=<random>
COCKPIT_PIN=<numeric pin per ottenere il primo token via /auth/token>

# Ottimizzazione: keys per lo stato quota
ANTHROPIC_API_KEY=...
OPENAI_API_KEY=...
ELEVENLABS_API_KEY=...
```

Per il modulo input nut.js (mouse/keyboard remoto):

```pwsh
pnpm --filter cockpit-bus add @nut-tree-fork/nut-js
```

(È un dep opzionale; se manca, l'input plane logga warning e disabilita silenziosamente.)

## Token JWT — ottenere il primo

```pwsh
$pin = "tuo-pin-numerico"
curl -X POST http://localhost:3030/auth/token `
  -H "content-type: application/json" `
  -d "{`"pin`":`"$pin`",`"scopes`":[`"cockpit:read`",`"input:write`"]}"
```

Risponde `{ token, expiresIn }`. Incolla il token nel form di login HUD/Remote.

In produzione (via VPS): `POST https://cozza-ai.vibecanyon.com/cockpit/api/auth/token`.

## Roadmap fasi

| Fase                                                                   | Status  |
| ---------------------------------------------------------------------- | ------- |
| F0 — Workspace + tasks + layouts                                       | ✅ done |
| F1 — Cockpit bus + adapter healthz/git/pm2/quota + WS gateway + tunnel | ✅ done |
| F2 — HUD PWA con 8 modalità + doppio tema                              | ✅ done |
| F3 — Mobile Remote + Trackpad input plane                              | ✅ done |
| F3.5 — Cursor handoff + command broadcast cross-superfici              | ✅ done |
| F4 — Estensione VS Code `cozza-cockpit-vscode`                         | ✅ done |
| F5 — Multiverse adapter + Claude session log adapter                   | ✅ done |
| F6 — Scaffolding generator (`pnpm new <name>`)                         | ✅ done |
| F7 — XR avanzato (Pomodoro, Spend/budget API)                          | ✅ done |
| F8 — Voice command end-to-end (Web Speech IT)                          | ✅ done |

## VS Code extension

Build e usa il `.vsix`:

```pwsh
pnpm -C packages/cockpit-vscode build
pnpm -C packages/cockpit-vscode package    # crea cozza-cockpit-vscode.vsix
code --install-extension packages/cockpit-vscode/cozza-cockpit-vscode.vsix
```

Comandi command palette principali:

- `Cozza: Open HUD (webview)` — embed dell'HUD dentro VS Code (auto-token via fragment)
- `Cozza: Switch Layout…` — quickpick fra Mission/Tunnel/Visual/Debug/Ops/Zen
- `Cozza: Deploy current project` — lancia `bash deploy/deploy.sh` in terminal dedicato
- `Cozza: Arm input plane` / `Cozza: Disarm input plane` — controlla nut.js
- `Cozza: Set bus token` — incolla JWT in modo sicuro

Tasti: `Ctrl+K Ctrl+L` → switch layout, `Ctrl+K Ctrl+H` → apri HUD webview.

Status bar: `🛸 cozza · ✓ connected`. Sidebar custom "Cozza Cockpit" con tutti i progetti live, ordinati per stato (down → warn → unknown → ok).

## Voice command (Pixel)

Apri Remote PWA → mode `🎤 Voice` → tap il bottone mic → parla in italiano.

Frasi riconosciute (regex best-effort):

| Dico…                            | Cockpit fa…                    |
| -------------------------------- | ------------------------------ |
| vitals / stato / salute / health | HUD → Vitals                   |
| stream                           | HUD → Stream                   |
| log / logs                       | HUD → Logs                     |
| metric / metriche                | HUD → Metrics                  |
| diff / git                       | HUD → Diff                     |
| ambient / pausa / relax          | HUD → Ambient                  |
| pomodoro / pomo                  | HUD → Pomodoro                 |
| budget / spesa / spend / costo   | HUD → Spend                    |
| tema / cambia tema               | HUD toggle Cyber↔Bauhaus       |
| cyber / cyberpunk                | HUD theme = Cyberpunk          |
| bauhaus / mono                   | HUD theme = Bauhaus            |
| deploy                           | desktop ext esegue bash deploy |
| stop / kill                      | killswitch globale             |

## Scaffolding generator

```pwsh
pnpm new my-new-app --type=pwa --port=3045
# tipi disponibili: pwa | api | saas | game | mkt
```

Crea `c:/work/Cozza/<name>/` con README, CLAUDE.md, package.json, tsconfig, .vscode/extensions.json, nginx config preconfigurato per `<name>.vibecanyon.com`.

## Troubleshooting

- **HUD/Remote dice "no token"**: ottieni token con curl sopra, incollalo nel form
- **Bus non parte**: verifica `apps/cockpit-bus/.env` e che `better-sqlite3` sia compilato (`pnpm rebuild better-sqlite3`)
- **Tunnel cade ogni N minuti**: aumenta `ServerAliveInterval` in `tunnel.ps1`, o usa `autossh`
- **nginx 502 su /cockpit/api/**: il PC è offline o autossh è giù
- **Trackpad non muove cursore**: `COCKPIT_INPUT_ENABLED=true` + `pnpm --filter cockpit-bus add @nut-tree-fork/nut-js` + chiamare `POST /api/input/arm` (o usa il bottone "arma input" — TODO)
