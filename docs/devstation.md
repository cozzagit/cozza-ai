# 💻 Cozza Devstation — manuale

Modalità HUD #1 del Cockpit. Trasforma le Viture Beast (o qualsiasi browser) in una **stazione di lavoro mobile** che proietta il VS Code, il terminale e i preview live del PC di casa, con continuità totale rispetto a quello che stavi facendo da scrivania.

## Cosa vedi

Apri https://cozza-ai.vibecanyon.com/cockpit/ → click su **💻 Devstation** (o premi `1`).

Una griglia di iframe configurabile, layout switchabili dal menu in alto:

| Layout       | Pensato per                                                  |
| ------------ | ------------------------------------------------------------ | -------- |
| 2×2          | uso standard: code + preview + terminal + HUD                |
| Code maxi    | quando scrivi tanto e dai un'occhiata di lato a preview/term |
| Preview maxi | UI tweaking, vedi il sito grande mentre editi                |
| Triple H     | tre iframe affiancati a tutta altezza                        |
| Split V      | due colonne (es. code                                        | preview) |
| Single       | immersione totale su una sola sorgente                       |

In ogni cella c'è una pill "**+ scegli sorgente**" → si apre il picker:

- **💻 VS Code** — code-server attaccato al filesystem `c:\work\Cozza\` del PC, stesse estensioni e settings (via VS Code Settings Sync)
- **⌨ Terminal** — ttyd con PowerShell 7 ristretto a `c:\work\Cozza\`, dove lanciare `claude`, `pnpm dev`, `git`, ecc.
- **🌐 cozza-ai dev** — preview live di `localhost:5173` del PC casa, HMR funzionante
- **🛸 HUD dev** — preview live del cockpit-hud Vite (`localhost:5174`)
- **📱 Remote dev** — preview live del cockpit-remote (`localhost:5175`)
- **◉ HUD live** — il cockpit HUD stesso embed
- **💬 Chat AI** — la chat cozza-ai principale embed
- **URL custom** — qualsiasi cosa (Linear, Notion, ChatGPT, Anthropic console…)

I preset di slot (quale sorgente dove) sono persistiti per device. Tu da Viture puoi avere layout 2×2, dal Pixel layout single, ecc.

## Setup una tantum (PC casa)

1. **Installa code-server, ttyd, nssm** + crea i due servizi Windows che li tengono su al boot:

   ```pwsh
   pwsh -ExecutionPolicy Bypass -File ./scripts/install-devstation.ps1
   ```

   Lo script:
   - Installa `code-server` via winget
   - Installa `ttyd` via scoop
   - Installa `nssm` via winget
   - Crea servizio `cozza-code-server` su `127.0.0.1:8444`, working dir `c:\work\Cozza`
   - Crea servizio `cozza-ttyd` su `127.0.0.1:7681`, shell PowerShell 7, working dir `c:\work\Cozza`
   - Entrambi auto-start al boot Windows

2. **Aggiorna autorizzazione SSH** sul VPS per i nuovi port-forward (8444, 7681, 5173, 5174, 5175). Già fatto durante il deploy iniziale; se serve rifarlo:

   ```pwsh
   pwsh ./scripts/install-tunnel.ps1
   ```

3. **Ri-lancia il tunnel** con i nuovi forward (`tunnel.ps1` è stato aggiornato):

   ```pwsh
   pwsh ./scripts/tunnel.ps1
   ```

   Oppure se hai il servizio NSSM `cozza-cockpit-tunnel`:

   ```pwsh
   nssm stop cozza-cockpit-tunnel
   nssm start cozza-cockpit-tunnel
   ```

4. **Vite dev servers**: lancia `pnpm cockpit` o singolarmente `pnpm dev:web`/`dev:hud`/`dev:remote`. Quando girano, le preview Vite sono raggiungibili via Devstation. Se non sono up, l'iframe corrispondente mostra "connection refused" — è normale.

## Continuità con VS Code desktop

- **Filesystem**: stessa cartella `c:\work\Cozza\`. Modifichi un file da Viture, viene immediatamente disponibile a VS Code desktop e viceversa al successivo salvataggio.
- **Settings/extensions**: usa **VS Code Settings Sync** (built-in, account GitHub/Microsoft). Attiva sync su entrambi (desktop + code-server). Il primo avvio sincronizza tema, keybinding, snippet, estensioni. **Claude Code extension** sincronizzata anche lei.
- **Recent workspaces**: code-server ricorda i tuoi multi-root workspace recenti.
- **Terminal**: ttyd con PowerShell 7 con fnm/pnpm già nel profilo. `claude` partirà subito se l'hai già installato.

> ⚠ Limitazione: **VS Code desktop e code-server NON possono usare lo stesso `user-data-dir`** (file di lock). Sono due sessioni separate ma sincronizzate via Settings Sync. Le **modifiche ai file** sono condivise istantaneamente (filesystem), le **modifiche a settings/extensions** dopo il sync (alcuni secondi).

## Architettura

```
PC casa (sempre acceso)
├─ VS Code desktop (la tua sessione principale)
├─ cozza-code-server :8444   (servizio NSSM, VS Code web)
├─ cozza-ttyd :7681          (servizio NSSM, ttyd + pwsh)
├─ Vite :5173/74/75          (lanciati da pnpm cockpit)
├─ cockpit-bus :3030         (servizio o pnpm dev)
└─ autossh -R                  (servizio NSSM cozza-cockpit-tunnel)
                  ↓
              VPS Aruba
              ├─ nginx /cockpit/code/   → :8444
              ├─ nginx /cockpit/term/   → :7681
              ├─ nginx /cockpit/dev/N/  → :5173/74/75
              ├─ nginx /cockpit/api/    → :3031 (bus)
              └─ nginx /cockpit/ws      → :3031 (bus WS)
                  ↓
              cozza-ai.vibecanyon.com/cockpit/devstation
                  ↓
              Viture Beast / Pixel / qualsiasi browser
```

## Scorciatoie utili nel terminale

```pwsh
# Avvia il dev di tutto cozza-ai (bus + web + api + hud + remote)
pnpm cockpit

# Solo Vite dei singoli pacchetti
pnpm dev:web
pnpm dev:hud
pnpm dev:remote

# Claude Code interattivo
claude

# Deploy cozza-ai sul VPS
pnpm deploy:vps
```

## Sicurezza

- code-server e ttyd ascoltano **solo su 127.0.0.1**, mai esposti direttamente
- Raggiungibili dall'esterno solo via il tunnel SSH inverso (chiave dedicata, scope ristretto)
- nginx VPS proxa via path: chi non ha accesso al cockpit non vede né VS Code né terminale
- ttyd ha working dir `c:\work\Cozza\` — può comunque eseguire qualsiasi comando con i privilegi del tuo utente Windows. **Non condividere il token JWT**.

## Troubleshooting

| Sintomo                                   | Causa probabile                         | Fix                                                                                                                                 |
| ----------------------------------------- | --------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| Cella iframe vuota / "refused to connect" | servizio NSSM non up                    | `nssm status cozza-code-server` / `cozza-ttyd` / `cozza-cockpit-tunnel`                                                             |
| code-server mostra splash ma non carica   | il proxy basepath va riconfigurato      | code-server già supporta `--proxy-domain` ma per path-based prova `~/.config/code-server/config.yaml` con `app-name: cozza-cockpit` |
| Terminale connette ma chiude subito       | pwsh.exe non in PATH                    | aggiorna `cozza-ttyd` con `nssm set cozza-ttyd AppParameters` puntando a `C:\Program Files\PowerShell\7\pwsh.exe`                   |
| HMR Vite si disconnette ogni minuto       | nginx `proxy_read_timeout` troppo basso | già impostato a 1h nella config — verifica deploy aggiornato                                                                        |
| Preview Vite 502                          | il `pnpm dev` non è in esecuzione       | lancia il task corrispondente in VS Code                                                                                            |
