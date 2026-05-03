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
  [int]   $LocalPort  = 3030,
  [int]   $RemotePort = 3031,
  [string]$VpsHost    = '188.213.170.214',
  [string]$VpsUser    = 'root',
  [string]$KeyPath    = "$env:USERPROFILE\.ssh\cozza_cockpit_ed25519"
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

# autossh = ssh con auto-restart on disconnect.
# Se non installato, fallback a ssh -N nudo (riconnessione manuale).
$autossh = (Get-Command autossh -ErrorAction SilentlyContinue)?.Source
if ($autossh) {
  Write-Host "▶ autossh trovato → tunnel persistente con keepalive" -ForegroundColor Green
  $env:AUTOSSH_POLL    = '30'
  $env:AUTOSSH_GATETIME = '0'
  & $autossh `
    -M 0 `
    -N `
    -i $KeyPath `
    -o ServerAliveInterval=15 `
    -o ServerAliveCountMax=3 `
    -o ExitOnForwardFailure=yes `
    -o StrictHostKeyChecking=accept-new `
    -R "${RemotePort}:localhost:${LocalPort}" `
    "$VpsUser@$VpsHost"
} else {
  Write-Host "▶ autossh NON installato → uso ssh nativo con loop riavvio" -ForegroundColor Yellow
  while ($true) {
    & ssh `
      -N `
      -i $KeyPath `
      -o ServerAliveInterval=15 `
      -o ServerAliveCountMax=3 `
      -o ExitOnForwardFailure=yes `
      -o StrictHostKeyChecking=accept-new `
      -R "${RemotePort}:localhost:${LocalPort}" `
      "$VpsUser@$VpsHost"
    Write-Host "  ⚠ tunnel caduto, riconnetto in 5s…" -ForegroundColor Yellow
    Start-Sleep -Seconds 5
  }
}
