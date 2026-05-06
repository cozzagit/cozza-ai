# scripts/tunnel.ps1
# Reverse SSH tunnel: PC casa → VPS Aruba.
# Esponi cockpit-bus locale (porta 3030) come :3031 sul VPS,
# che nginx proxy-passa a https://cozza-ai.vibecanyon.com/cockpit/ (api+ws).
#
# Prima esecuzione:
#   1. Lancia .\scripts\install-tunnel.ps1 (genera chiave + installa autossh + setup VPS)
#   2. Lancia questo script (apre il tunnel e lo tiene su)
#
# Lancio interattivo:  pwsh ./scripts/tunnel.ps1
# Lancio come servizio: nssm install cozza-cockpit-tunnel pwsh.exe -File ...

param(
  [int]   $LocalPort  = 3036,
  [int]   $RemotePort = 3031,
  [string]$VpsHost    = '188.213.170.214',
  [string]$VpsUser    = 'root',
  [string]$KeyPath    = "$env:USERPROFILE\.ssh\cozza_cockpit_ed25519"
)

# Devstation extra forwards: VS Code via code-server, terminale via ttyd,
# Vite dev servers per preview live (cozza-ai web, HUD, Remote).
$ExtraForwards = @(
  '-R', '8444:localhost:8444',   # code-server (VS Code web)
  '-R', '7681:localhost:7681',   # ttyd (terminale pwsh)
  '-R', '5173:localhost:5173',   # Vite cozza-ai web
  '-R', '5174:localhost:5174',   # Vite cockpit-hud
  '-R', '5175:localhost:5175'    # Vite cockpit-remote
)

$ErrorActionPreference = 'Stop'

Write-Host "🛸 Cozza Cockpit Tunnel" -ForegroundColor Cyan
Write-Host "   PC:$LocalPort  ⇄  VPS:$RemotePort  (via $VpsUser@$VpsHost)" -ForegroundColor DarkGray
Write-Host ""

if (-not (Test-Path $KeyPath)) {
  Write-Host "❌ Chiave SSH non trovata: $KeyPath" -ForegroundColor Red
  Write-Host "   Lancia: .\scripts\install-tunnel.ps1" -ForegroundColor Yellow
  exit 1
}

# Sanity check: il bus locale è up?
$busUp = Test-NetConnection -ComputerName 'localhost' -Port $LocalPort -InformationLevel Quiet -WarningAction SilentlyContinue
if (-not $busUp) {
  Write-Warning "cockpit-bus non risponde su localhost:$LocalPort. Lancia 'pnpm --filter cockpit-bus dev' prima."
  Write-Host "   (Il tunnel resta su comunque, il bus puo' partire dopo.)" -ForegroundColor DarkGray
}

# Pre-clean: kill any zombie sshd holding :$RemotePort on the VPS.
# Without this, our reverse forward fails with "remote port forwarding
# failed" because a stale sshd from a previous session still owns the
# port. Uses the admin key (~/.ssh/aruba_vps) since the cockpit key is
# scope-restricted (no shell). Best-effort: ignore failures.
$adminKey = "$env:USERPROFILE\.ssh\aruba_vps"
if (Test-Path $adminKey) {
  try {
    Write-Host "▶ Cleaning stale tunnels on VPS:$RemotePort…" -ForegroundColor DarkGray
    & ssh -i $adminKey -o ConnectTimeout=5 -o StrictHostKeyChecking=accept-new "$VpsUser@$VpsHost" `
      "pids=`$(ss -tlnp 2>/dev/null | grep ':$RemotePort' | grep -oP 'pid=\K[0-9]+' | sort -u); for p in `$pids; do kill -9 `$p 2>/dev/null; done; sleep 1; ss -tlnp | grep ':$RemotePort' || echo CLEAN"
  } catch {
    Write-Host "  (clean step skipped: $_)" -ForegroundColor DarkGray
  }
}

# autossh = ssh con auto-restart on disconnect.
# Se non installato, fallback a ssh -N nudo (riconnessione manuale).
$autossh = (Get-Command autossh -ErrorAction SilentlyContinue)?.Source
if ($autossh) {
  Write-Host "▶ autossh trovato → tunnel persistente con keepalive" -ForegroundColor Green
  $env:AUTOSSH_POLL    = '30'
  $env:AUTOSSH_GATETIME = '0'
  $autosshArgs = @(
    '-M', '0',
    '-N',
    '-i', $KeyPath,
    '-o', 'ServerAliveInterval=15',
    '-o', 'ServerAliveCountMax=3',
    '-o', 'ExitOnForwardFailure=yes',
    '-o', 'StrictHostKeyChecking=accept-new',
    '-R', "${RemotePort}:localhost:${LocalPort}"
  )
  $autosshArgs += $ExtraForwards
  $autosshArgs += "$VpsUser@$VpsHost"
  & $autossh @autosshArgs
} else {
  Write-Host "▶ autossh NON installato → uso ssh nativo con loop riavvio" -ForegroundColor Yellow
  while ($true) {
    $sshArgs = @(
      '-N',
      '-i', $KeyPath,
      '-o', 'ServerAliveInterval=15',
      '-o', 'ServerAliveCountMax=3',
      '-o', 'ExitOnForwardFailure=yes',
      '-o', 'StrictHostKeyChecking=accept-new',
      '-R', "${RemotePort}:localhost:${LocalPort}"
    )
    $sshArgs += $ExtraForwards
    $sshArgs += "$VpsUser@$VpsHost"
    & ssh @sshArgs
    Write-Host "  ⚠ tunnel caduto, riconnetto in 5s…" -ForegroundColor Yellow
    Start-Sleep -Seconds 5
  }
}
