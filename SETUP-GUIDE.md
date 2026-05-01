# cozza-ai — Setup Guide

> **Scopo:** preparare tutto l'ambiente operativo per essere pronti al Day 1 quando arrivano Pixel 10a e Viture Beast.
> **Tempo totale stimato:** ~2 ore di setup pre-arrivo + ~2 ore Day 1.
> **Prerequisito:** PC Windows 11 (consigliato) o Windows 10 21H2+.
>
> **Stato 2026-05-01:** lo scaffold Phase 1 è committato in repo. Vedi `docs/architecture-final.md`, `docs/DEPLOY.md`, `docs/TESTING.md` per le procedure operative aggiornate. Le sezioni A–D di questa guida restano valide, le E–H sono superate dal nuovo flusso `pnpm install + pnpm dev`.

Lavora in ordine. Ogni sezione è autonoma e marcabile come fatta. Quando hai tutto verde, sei pronto a incollare il kickoff prompt in Claude Code (vedi `prompts/claude-code-kickoff.md`).

---

## Indice

- [Fase A — Account e subscription (15 min)](#fase-a)
- [Fase B — Setup PC Windows (45 min)](#fase-b)
- [Fase C — Codice e tooling dev (30 min)](#fase-c)
- [Fase D — Accessori da ordinare (15 min)](#fase-d)
- [Fase E — Day 1 con Pixel 10a (45 min)](#fase-e)
- [Fase F — Day 1 con Viture Beast (30 min)](#fase-f)
- [Fase G — Test integrato end-to-end (30 min)](#fase-g)
- [Fase H — Avvio Phase 1 cozza-ai](#fase-h)
- [Troubleshooting comuni](#troubleshooting)

---

<a id="fase-a"></a>
## Fase A — Account e subscription (15 min)

Tutto questo si fa da PC, anche prima dell'arrivo dei pacchi. Apri 5 tab del browser.

### A.1 — ElevenLabs Creator ($22/mese) `[ ]`

1. Vai su [elevenlabs.io](https://elevenlabs.io) e crea account
2. Sottoscrivi piano **Creator** ($22/mese, 100k caratteri/mese)
3. In **Voice Library** filtra per `Italian` lingua
4. Ascolta almeno queste voci e segna i loro **Voice ID**:
   - "Sara" (calda, naturale)
   - "Matilda" (giovane, energica)
   - "Federico" (maschile, autorevole)
5. Salva 2 Voice ID candidati per i test futuri:
   ```
   VOICE_ID_PRIMARY=____________________
   VOICE_ID_SECONDARY=__________________
   ```
6. Genera **API key** in **Profile → API Keys** e salva sicuro:
   ```
   ELEVENLABS_API_KEY=sk_______________
   ```

### A.2 — Anthropic Console (€0 setup, pay-per-use) `[ ]`

1. Vai su [console.anthropic.com](https://console.anthropic.com), accedi con Google
2. **Settings → Billing**: aggiungi metodo di pagamento, imposta **Spending limit a $20/mese** (safety)
3. **Settings → API Keys → Create Key**: dai un nome `cozza-ai-prod`
4. Salva la chiave (non la rivedrai più):
   ```
   ANTHROPIC_API_KEY=sk-ant-______________
   ```
5. **Settings → Workspace → Rate Limits**: lascia default per ora

### A.3 — OpenAI Platform (€0 setup, pay-per-use) `[ ]`

1. Vai su [platform.openai.com](https://platform.openai.com), accedi
2. **Settings → Billing**: aggiungi $10 di credito iniziale + **monthly cap a $10**
3. **Project → API Keys → Create**: nome `cozza-ai`
4. Salva:
   ```
   OPENAI_API_KEY=sk-proj-_______________
   ```

### A.4 — Cloudflare (free tier sufficiente) `[ ]`

1. Vai su [dash.cloudflare.com](https://dash.cloudflare.com), crea account
2. Conferma email
3. Non serve aggiungere nessun dominio per ora — userai il subdomain `*.workers.dev` e `*.pages.dev` gratuiti
4. Annota lo username Cloudflare (servirà per `wrangler`)

### A.5 — Tailscale (free tier sufficiente) `[ ]`

1. Vai su [login.tailscale.com](https://login.tailscale.com)
2. Accedi con lo stesso account Google del Pixel (importante: deve combaciare)
3. Conferma il device (per ora vuoto, lo aggiungerai dal PC)

### A.6 — GitHub repo `[ ]`

1. [github.com/new](https://github.com/new)
2. Nome: `cozza-ai`
3. Visibilità: **Private**
4. Inizializza con README, .gitignore (Node), licenza MIT
5. Crea repo e annota URL clone:
   ```
   git@github.com:luca-cozza/cozza-ai.git
   ```

### Salvataggio sicuro delle chiavi

Apri Bitwarden / 1Password / KeePass e crea un nuovo "Secure Note" intitolato `cozza-ai-secrets` con tutte le chiavi sopra. **NON metterle mai in file di testo nella cartella di progetto.**

---

<a id="fase-b"></a>
## Fase B — Setup PC Windows (45 min)

Tutto va fatto sul PC Windows che resterà acceso a casa quando esci col Beast.

### B.1 — Update Windows `[ ]`

```powershell
# Apri PowerShell come admin, verifica build
winver
```

Se sei sotto Windows 11 24H2, fai update da Impostazioni → Windows Update.

### B.2 — Tailscale Windows `[ ]`

1. Scarica installer da [tailscale.com/download/windows](https://tailscale.com/download/windows)
2. Installa con default
3. Login con lo stesso account dell'A.5
4. Verifica che il PC compaia in [login.tailscale.com](https://login.tailscale.com) → Machines
5. **Annota l'IP Tailscale assegnato**:
   ```
   PC_TAILSCALE_IP=100.___.___.___
   ```
   Sarà nel formato `100.x.y.z` o `100.64.x.y` ecc.

### B.3 — Abilita OpenSSH Server `[ ]`

```powershell
# In PowerShell admin
Add-WindowsCapability -Online -Name OpenSSH.Server~~~~0.0.1.0

# Avvia il servizio
Start-Service sshd

# Imposta avvio automatico
Set-Service -Name sshd -StartupType Automatic

# Configura firewall
New-NetFirewallRule -Name sshd -DisplayName 'OpenSSH Server (sshd)' -Enabled True -Direction Inbound -Protocol TCP -Action Allow -LocalPort 22
```

Test rapido (dallo stesso PC):
```powershell
ssh localhost
# Inserisci la password del tuo utente Windows. Devi vedere il prompt PowerShell remoto.
exit
```

### B.4 — Installa WSL2 + Ubuntu 24.04 `[ ]`

```powershell
# In PowerShell admin
wsl --install -d Ubuntu-24.04
```

Riavvia il PC quando richiesto. Al primo boot di Ubuntu:
- Crea username Linux (puoi usare lo stesso `luca`)
- Imposta una password (segnala in Bitwarden)
- Aspetta che finisca il setup iniziale

Verifica:
```bash
# Dentro WSL
lsb_release -a
# Deve mostrare Ubuntu 24.04 LTS
```

### B.5 — Node 20 + pnpm dentro WSL `[ ]`

```bash
# Dentro WSL Ubuntu
sudo apt update && sudo apt upgrade -y
sudo apt install -y curl git build-essential

# Installa nvm
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.7/install.sh | bash
source ~/.bashrc

# Installa Node 20 LTS
nvm install 20
nvm use 20
node --version  # v20.x.x

# Installa pnpm
npm install -g pnpm
pnpm --version

# Installa wrangler (Cloudflare CLI)
npm install -g wrangler
wrangler --version
```

### B.6 — tmux per sessioni persistenti `[ ]`

```bash
# Dentro WSL
sudo apt install -y tmux

# Configura tmux con prefix più comodo (Ctrl+a invece di Ctrl+b)
cat > ~/.tmux.conf << 'EOF'
set -g prefix C-a
unbind C-b
bind C-a send-prefix
set -g mouse on
set -g default-terminal "screen-256color"
set -g history-limit 10000
EOF

# Test
tmux new -s test
# Premi Ctrl+a poi d per disconnetterti
tmux ls  # Deve mostrare la sessione "test"
tmux kill-session -t test
```

### B.7 — Configura Git globale `[ ]`

```bash
# Dentro WSL
git config --global user.name "Luca Cozza"
git config --global user.email "luca.cozza@gmail.com"
git config --global init.defaultBranch main
git config --global pull.rebase true

# Genera SSH key per GitHub
ssh-keygen -t ed25519 -C "luca.cozza@gmail.com" -f ~/.ssh/id_ed25519_github -N ""
cat ~/.ssh/id_ed25519_github.pub
# Copia l'output e incollalo su https://github.com/settings/keys come "Authentication Key"

# Configura ~/.ssh/config per GitHub
cat >> ~/.ssh/config << 'EOF'
Host github.com
  HostName github.com
  User git
  IdentityFile ~/.ssh/id_ed25519_github
EOF

# Test
ssh -T git@github.com
# Deve restituire: "Hi luca-cozza! You've successfully authenticated..."
```

### B.8 — Installa Claude Code globalmente `[ ]`

```bash
# Dentro WSL
npm install -g @anthropic-ai/claude-code
claude --version

# Login con il tuo account Anthropic Console
claude login
# Segui le istruzioni
```

### B.9 — Tailscale dentro WSL (opzionale ma utile) `[ ]`

```bash
curl -fsSL https://tailscale.com/install.sh | sh
sudo tailscale up
# Apri il link suggerito nel browser e autorizza
tailscale ip -4
```

---

<a id="fase-c"></a>
## Fase C — Codice e tooling dev (30 min)

### C.1 — Clona repo cozza-ai vuoto `[ ]`

```bash
# Dentro WSL
cd ~
mkdir -p projects && cd projects
git clone git@github.com:luca-cozza/cozza-ai.git
cd cozza-ai
```

### C.2 — Copia il brainstorming bundle nel repo `[ ]`

```bash
# Dentro WSL: copia i file dal mount Windows
cp -r /mnt/c/work/Cozza/cozza-ai/* ~/projects/cozza-ai/
cd ~/projects/cozza-ai
git add .
git commit -m "docs: import phase 0 brainstorming bundle"
git push
```

### C.3 — VS Code + estensioni essenziali `[ ]`

Su Windows installa **VS Code** ([code.visualstudio.com](https://code.visualstudio.com)) e aggiungi le estensioni:

- **WSL** (Microsoft) — apri progetti Linux nativi
- **ESLint**
- **Prettier**
- **Tailwind CSS IntelliSense**
- **TypeScript and JavaScript Language Features** (built-in)
- **GitLens**
- **Cloudflare Workers** (per `wrangler.toml`)
- **Claude Code for VS Code** (se esiste)

Test:
```bash
# Da WSL
cd ~/projects/cozza-ai
code .
# Si apre VS Code in modalità WSL Remote
```

### C.4 — Crea file `.env.example` di riferimento `[ ]`

```bash
cat > ~/projects/cozza-ai/.env.example << 'EOF'
# === Frontend (apps/web/.env) ===
VITE_API_BASE_URL=http://localhost:8787
VITE_ELEVENLABS_VOICE_ID=PASTE_VOICE_ID_HERE
VITE_DEFAULT_MODEL=claude-haiku-4-5

# === Backend (apps/api/.dev.vars - mai committato) ===
ANTHROPIC_API_KEY=sk-ant-PASTE_HERE
OPENAI_API_KEY=sk-proj-PASTE_HERE
ELEVENLABS_API_KEY=sk_PASTE_HERE
ALLOWED_ORIGINS=http://localhost:5173,https://cozza-ai.pages.dev
EOF

git add .env.example
git commit -m "docs: add env vars template"
git push
```

### C.5 — Verifica accesso SSH dal mio PC al mio PC (sì, prove generali) `[ ]`

```bash
# Dentro WSL
ssh luca@PC_TAILSCALE_IP
# Inserisci password Windows
# Sei dentro PowerShell remoto via Tailscale
exit
```

Se funziona, sei pronto per il giorno in cui replicherai il comando dal Pixel 10a.

---

<a id="fase-d"></a>
## Fase D — Accessori da ordinare (15 min)

### D.1 — Tastiera Bluetooth tascabile (€60-90) `[ ]`

Scelte consigliate in ordine:
1. **Logitech Keys-To-Go 2** (~€80) — pieghevole, sottilissima, layout italiano disponibile
2. **Keychron K7 Pro** (~€90) — meccanica low-profile, più "tattile" per coding
3. **Microsoft Designer Compact** (~€90) — buon compromesso, brutta solo nel nome

Ordina su Amazon.it. Tempi 1-2 giorni con Prime.

### D.2 — Power bank PD 65W+ (€40-60) `[ ]`

Il Beast collegato al Pixel consuma ~3-5W aggiuntivi. Per sessioni di 2+ ore è obbligatorio.

Scelte:
1. **Anker 737** 24000 mAh, 140W — €100 ma future-proof per qualsiasi laptop futuro
2. **Anker Nano 30W** 10000 mAh — €40, basta per 1.5 cariche del Pixel
3. **Ugreen Nexode 100W** 20000 mAh — €70, ottimo compromesso

### D.3 — Auricolare BT open-ear (opzionale, €100-150) `[ ]`

Il Beast ha speaker integrati ma in ambiente rumoroso un open-ear è meglio:
- **Shokz OpenFit** (~€150) — il top
- **Soundcore AeroFit Pro** (~€100) — alternative valida

Salta se preferisci usare gli speaker integrati del Beast.

### D.4 — Cavo USB-C extra alto bitrate (opzionale, €15) `[ ]`

Solo se il cavo incluso col Beast è troppo corto o di bassa qualità. Specifiche minime: USB 3.2 Gen 1, supporto DP Alt Mode esplicito, 1.5m+. Es. **Anker 333 USB-C** o **Ugreen 4K@60Hz**.

---

<a id="fase-e"></a>
## Fase E — Day 1 con Pixel 10a (45 min)

### E.1 — Setup iniziale `[ ]`

1. Accendi il Pixel 10a
2. Connetti al Wi-Fi di casa
3. Accedi con il tuo account Google (lo stesso usato per le subscription)
4. **Trasferimento dati dal Pixel 4**: usa il cavo USB-C-to-USB-C in dotazione, segui il wizard Google. Trasferisce app, contatti, foto.
5. Imposta blocco schermo (PIN minimo 6 cifre + impronta)
6. Aggiorna Android se ci sono update pendenti

### E.2 — Verifica USB-C DisplayPort Alt Mode `[ ]`

Prima di toccare il Beast, conferma che il phone funzioni con un display normale.

1. Procurati un cavo **USB-C → HDMI** (anche economico, €10) o un USB-C hub con uscita HDMI
2. Collegalo al phone e ad un monitor TV
3. Vai su **Impostazioni → Sistema → Modalità desktop** e abilitala
4. Devi vedere il desktop Android su TV

Se non funziona, contatta Amazon per RMA prima di rompere il packaging Beast.

### E.3 — Installa app essenziali `[ ]`

Dal Play Store:
- **Termius** o **Termux** (consiglio Termux: F-Droid se vuoi la versione completa)
- **Tailscale** — accedi con lo stesso account
- **Bitwarden** o il password manager che usi
- **Google Authenticator** o **Authy** per 2FA
- **Chrome** stabile (default Pixel)
- **SpaceWalker** by VITURE (per il Beast quando arriva)

### E.4 — Configura Termux + SSH `[ ]`

In Termux:
```bash
# Aggiorna pacchetti
pkg update && pkg upgrade

# Installa SSH e tmux
pkg install openssh tmux

# Crea SSH key
ssh-keygen -t ed25519 -f ~/.ssh/id_ed25519 -N ""
cat ~/.ssh/id_ed25519.pub
# Copia il contenuto: dovrai aggiungerlo ad ~/.ssh/authorized_keys del PC Windows
```

Sul PC Windows:
```powershell
# In PowerShell del PC, ESEGUI dopo aver copiato la chiave dal phone
mkdir C:\Users\luca\.ssh -ErrorAction SilentlyContinue
notepad C:\Users\luca\.ssh\authorized_keys
# Incolla la chiave del phone, salva.

# Permessi corretti
icacls C:\Users\luca\.ssh\authorized_keys /inheritance:r
icacls C:\Users\luca\.ssh\authorized_keys /grant luca:F
```

In Termux (di nuovo):
```bash
# Test SSH al PC senza password
ssh luca@PC_TAILSCALE_IP
# Deve entrare diretto senza chiedere password.
exit
```

### E.5 — Installa Cozza-AI PWA "scheletro" (per ora niente) `[ ]`

Salta finché non hai costruito la PWA con Claude Code. Tornerai qui dopo l'MVP per fare "Aggiungi a schermata Home" da Chrome.

### E.6 — Verifica audio `[ ]`

Apri YouTube, controlla:
- Volume principale e media
- Connessione auricolare BT (se l'hai ordinato)
- Microfono (registra una nota vocale veloce)

---

<a id="fase-f"></a>
## Fase F — Day 1 con Viture Beast (30 min)

### F.1 — Unboxing e ispezione `[ ]`

1. Apri scatola, controlla contenuto: occhiali, cavo USB-C-to-USB-C ufficiale, adattatori, custodia, documentazione
2. Verifica niente graffi sulle lenti, montatura integra
3. Tieni la scatola almeno per 30 giorni (eventuale reso Amazon)

### F.2 — Pairing iniziale col Pixel 10a `[ ]`

1. Sul Pixel: apri **SpaceWalker**, segui wizard
2. Collega il cavo USB-C del Beast al phone (assicurati che il cavo sia quello giusto, alcuni hanno chip dedicato)
3. Indossa gli occhiali — dovresti vedere il desktop Android proiettato
4. Calibra IPD (interpupillary distance) come da istruzioni

### F.3 — Aggiornamento firmware `[ ]`

In SpaceWalker → Impostazioni Beast → Aggiorna firmware. Aspetta sempre l'ultima versione prima di testare.

### F.4 — Test funzioni base `[ ]`

- [ ] **Netflix**: apri l'app sul Pixel, riproduci un episodio. Verifica fluidità su 174".
- [ ] **YouTube**: video 4K, verifica HDR se hai contenuto compatibile
- [ ] **Modalità 3DoF**: in SpaceWalker prova le tre modalità:
  - **Spatial Anchor**: muovi la testa, lo schermo resta inchiodato in un punto
  - **Smooth Follow**: lo schermo segue dolcemente
  - **0DoF**: schermo fisso al campo visivo (per camminare)
- [ ] **Oscuramento elettrocromico**: prova i 9 livelli di tinta in SpaceWalker. Vedrai le lenti scurirsi gradualmente.
- [ ] **Audio HARMAN**: apri Spotify, verifica qualità speaker integrati open-ear.

### F.5 — Ergonomia e adattamento `[ ]`

- Indossa gli occhiali per 15 minuti continui
- Verifica che non ti faccia mal di testa o di occhi
- Eventuali cuscinetti naso da regolare
- Pausa di 5 minuti se senti fatica oculare (è normale i primi giorni)

---

<a id="fase-g"></a>
## Fase G — Test integrato end-to-end (30 min)

Questo è il momento "wow": Beast collegato al Pixel, tastiera BT, SSH al PC casa via Tailscale.

### G.1 — Stack completo collegato `[ ]`

1. Indossa Beast, connesso al Pixel 10a via USB-C
2. Accendi tastiera Bluetooth, accoppiala al Pixel
3. Power bank attaccato al Pixel via secondo cavo USB-C (per non scaricarlo)
4. Auricolare BT acceso (se l'hai)

### G.2 — SSH al PC casa via Termux `[ ]`

```bash
# Dentro Termux sul Pixel
ssh luca@PC_TAILSCALE_IP
tmux new -s claude
# Sei dentro una sessione Linux che vive sul tuo PC casa
```

### G.3 — Verifica latency end-to-end `[ ]`

Nel terminal SSH:
```bash
# Esegui un comando che produce output continuo
ping -c 5 google.com
```

Guarda la latency: dovrebbe essere sotto 50ms per ping (rete domestica fluida via Tailscale).

### G.4 — VS Code mobile via vscode.dev `[ ]`

Sul Pixel apri Chrome → [vscode.dev](https://vscode.dev). Verifica:
- Editor carica correttamente
- Tastiera BT funziona (cmd+shift+p apre command palette)
- Puoi fare login GitHub e clonare un repo

### G.5 — Test prompt rapido a Claude da Termux `[ ]`

```bash
# Dentro la sessione SSH
cd ~/projects/cozza-ai
claude
# Apri Claude Code, prova: "Spiega cosa contiene questo repo"
```

Se Claude risponde leggendo i file di docs/, sei completamente operativo.

### G.6 — Detach + walk away test `[ ]`

```bash
# Dentro SSH+tmux
# Premi Ctrl+a poi d (detach tmux)
exit  # Esci dalla sessione SSH
```

Togli gli occhiali, metti via il phone, fai una pausa caffè di 10 minuti.

Torna, riconnetti tutto, e:
```bash
ssh luca@PC_TAILSCALE_IP
tmux attach -t claude
# Ritrovi Claude esattamente dove l'hai lasciato
```

**Questo è il momento in cui il setup ha senso.** Hai dimostrato che puoi staccare e riattaccare in 30 secondi.

---

<a id="fase-h"></a>
## Fase H — Avvio Phase 1 cozza-ai

A questo punto sei pronto per iniziare il coding vero. Procedura:

### H.1 — Apri Claude Code nella cartella `[ ]`

```bash
# Dentro WSL sul PC (o via SSH dal Beast)
cd ~/projects/cozza-ai
claude
```

### H.2 — Incolla il kickoff prompt `[ ]`

Apri il file `prompts/claude-code-kickoff.md`, copia il blocco di codice (quello dentro i tre backtick), e incollalo in Claude Code come primo messaggio.

### H.3 — Segui i 25 agenti CLAUDE.md `[ ]`

Da qui in poi sono i tuoi agenti specialisti a guidare. Tu approvi step-by-step, fai code review, e ogni 1-2 ore fai commit + push.

---

<a id="troubleshooting"></a>
## Troubleshooting comuni

### "WSL non si installa o errore Hypervisor"

```powershell
# In PowerShell admin
bcdedit /set hypervisorlaunchtype auto
# Riavvia
```

Verifica anche che la virtualizzazione sia abilitata in BIOS (Intel VT-x / AMD-V).

### "OpenSSH Server non si avvia"

```powershell
Get-Service sshd
# Se Status = Stopped:
Start-Service sshd
# Se errore: controlla Event Viewer → Applications and Services Logs → OpenSSH
```

### "Tailscale non vede il PC dal phone"

- Verifica che entrambi siano loggati con lo stesso account Tailscale
- Su [login.tailscale.com](https://login.tailscale.com) → Machines, controlla che entrambi siano "Active"
- Sul phone: forza disconnessione/riconnessione Tailscale

### "Beast: schermo nero quando collego al phone"

- Cavo USB-C non compatibile DP Alt Mode → usa SOLO il cavo Viture incluso
- Modalità desktop disabilitata → Impostazioni Pixel → Sistema → Modalità desktop
- Beast ha bisogno di update firmware → connettilo a SpaceWalker via Wi-Fi

### "Termux: ssh chiede sempre la password"

```bash
# In Termux verifica permessi della key
chmod 600 ~/.ssh/id_ed25519
# Verifica che sia copiata correttamente sul PC Windows in
# C:\Users\luca\.ssh\authorized_keys (senza spazi extra, intera in una riga)
```

### "Latency SSH alta in 4G/5G"

- Switch a Mosh invece di SSH (sopravvive a roaming):
  ```bash
  pkg install mosh   # In Termux
  # Sul PC Windows installa mosh-server tramite WSL
  mosh luca@PC_TAILSCALE_IP
  ```

### "Costi API che esplodono"

- Vai immediatamente su Anthropic Console → Settings → Spending Limit, abbassa
- Stessa cosa OpenAI Platform → Billing → Usage limits
- ElevenLabs: il piano Creator è capped a 100k chars/mese, oltre ti blocca o ti chiede upgrade

---

## Sintesi finale

Quando tutte le caselle sopra sono spuntate, hai:

- ✓ Tutti gli account e API key necessari
- ✓ PC Windows con Tailscale, OpenSSH, WSL2 Ubuntu, Node, Claude Code
- ✓ Pixel 10a configurato con Termux/SSH al PC
- ✓ Viture Beast funzionante con il Pixel via USB-C
- ✓ Tastiera BT, power bank, accessori pronti
- ✓ SSH end-to-end testato Beast→Pixel→Tailscale→PC

**Tempo totale investito: ~3-4 ore distribuite. Setup che ti durerà 4-5 anni.**

A questo punto: apri `prompts/claude-code-kickoff.md` e parti con la Phase 1.

Forza Cozza, attacchiamo W1.

---

*Ultimo aggiornamento: 2026-05-01. Per modifiche o problemi, apri issue su GitHub.*
