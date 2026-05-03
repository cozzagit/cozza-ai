# scripts/install-devstation.ps1
# Installa code-server (VS Code via browser) + ttyd (terminale via browser)
# come servizi Windows, integrati nel tunnel SSH esistente del cockpit.
#
# Una volta lanciato, sulle Viture (o qualsiasi browser) puoi aprire:
#   https://cozza-ai.vibecanyon.com/cockpit/devstation
# e avere VS Code + terminale + preview live del PC di casa, tutti
# dietro auth JWT del cockpit-bus.
#
# Lancio una tantum (admin):
#   pwsh -ExecutionPolicy Bypass -File ./scripts/install-devstation.ps1

param(
  [int]$CodePort = 8444,
  [int]$TermPort = 7681
)

$ErrorActionPreference = 'Stop'
Write-Host ""
Write-Host "🛸 Cozza Devstation — installer" -ForegroundColor Cyan
Write-Host ""

# 1. winget code-server install
$cs = Get-Command code-server -ErrorAction SilentlyContinue
if (-not $cs) {
  Write-Host "▶ Installo code-server via winget" -ForegroundColor Green
  winget install --id Coder.code-server --silent --accept-source-agreements --accept-package-agreements
} else {
  Write-Host "✓ code-server già presente: $($cs.Source)" -ForegroundColor DarkGray
}

# 2. ttyd install via scoop (più rapido di winget per binari unsigned)
$ttyd = Get-Command ttyd -ErrorAction SilentlyContinue
if (-not $ttyd) {
  $scoop = Get-Command scoop -ErrorAction SilentlyContinue
  if (-not $scoop) {
    Write-Host "▶ Installo scoop (necessario per ttyd)" -ForegroundColor Green
    Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser -Force
    Invoke-RestMethod -Uri https://get.scoop.sh | Invoke-Expression
  }
  Write-Host "▶ Installo ttyd via scoop" -ForegroundColor Green
  scoop install ttyd
} else {
  Write-Host "✓ ttyd già presente: $($ttyd.Source)" -ForegroundColor DarkGray
}

# 3. nssm install (per registrare i servizi Windows)
$nssm = Get-Command nssm -ErrorAction SilentlyContinue
if (-not $nssm) {
  Write-Host "▶ Installo nssm via winget" -ForegroundColor Green
  winget install --id NSSM.NSSM --silent --accept-source-agreements --accept-package-agreements
}

# 4. Trova il path reale degli eseguibili (winget aggiunge a PATH solo dopo restart shell)
$csPath = (Get-Command code-server -ErrorAction SilentlyContinue)?.Source
if (-not $csPath) {
  $csPath = (Get-ChildItem -Path "$env:LOCALAPPDATA\Programs\code-server\bin" -Filter 'code-server.cmd' -ErrorAction SilentlyContinue | Select-Object -First 1)?.FullName
}
$ttydPath = (Get-Command ttyd -ErrorAction SilentlyContinue)?.Source
if (-not $ttydPath) {
  $ttydPath = (Get-ChildItem -Path "$env:USERPROFILE\scoop\apps\ttyd\current\ttyd.exe" -ErrorAction SilentlyContinue)?.FullName
}
$nssmPath = (Get-Command nssm -ErrorAction SilentlyContinue)?.Source

Write-Host ""
Write-Host "Paths individuati:" -ForegroundColor Cyan
Write-Host "  code-server: $csPath"
Write-Host "  ttyd:        $ttydPath"
Write-Host "  nssm:        $nssmPath"
Write-Host ""

if (-not $csPath -or -not $ttydPath -or -not $nssmPath) {
  Write-Warning "Alcuni binari non trovati. Riavvia la shell (winget aggiunge PATH solo dopo) e rilancia."
  exit 1
}

# 5. code-server config (auth: nginx la fa via JWT, qui mettiamo `none` ma binding 127.0.0.1)
$csConfigDir = "$env:USERPROFILE\.config\code-server"
New-Item -ItemType Directory -Force -Path $csConfigDir | Out-Null
$csConfig = @"
bind-addr: 127.0.0.1:$CodePort
auth: none
cert: false
disable-telemetry: true
"@
Set-Content -Path "$csConfigDir\config.yaml" -Value $csConfig -Encoding UTF8
Write-Host "▶ code-server config: $csConfigDir\config.yaml" -ForegroundColor Green

# 6. NSSM service: cozza-code-server
& $nssmPath stop cozza-code-server 2>$null
& $nssmPath remove cozza-code-server confirm 2>$null
& $nssmPath install cozza-code-server $csPath
& $nssmPath set cozza-code-server AppDirectory "C:\work\Cozza"
& $nssmPath set cozza-code-server AppEnvironmentExtra "PASSWORD="
& $nssmPath set cozza-code-server Start SERVICE_AUTO_START
& $nssmPath set cozza-code-server AppStdout "$env:USERPROFILE\.config\code-server\out.log"
& $nssmPath set cozza-code-server AppStderr "$env:USERPROFILE\.config\code-server\err.log"
& $nssmPath start cozza-code-server
Write-Host "✓ Servizio cozza-code-server attivo su 127.0.0.1:$CodePort" -ForegroundColor Green

# 7. NSSM service: cozza-ttyd (PowerShell 7 ristretto a c:\work\Cozza)
& $nssmPath stop cozza-ttyd 2>$null
& $nssmPath remove cozza-ttyd confirm 2>$null
& $nssmPath install cozza-ttyd $ttydPath
& $nssmPath set cozza-ttyd AppParameters "-p $TermPort -i 127.0.0.1 -W -t titleFixed=cozza-cockpit -t fontSize=13 pwsh.exe -NoLogo"
& $nssmPath set cozza-ttyd AppDirectory "C:\work\Cozza"
& $nssmPath set cozza-ttyd Start SERVICE_AUTO_START
& $nssmPath set cozza-ttyd AppStdout "$env:USERPROFILE\.config\code-server\ttyd.out.log"
& $nssmPath set cozza-ttyd AppStderr "$env:USERPROFILE\.config\code-server\ttyd.err.log"
& $nssmPath start cozza-ttyd
Write-Host "✓ Servizio cozza-ttyd attivo su 127.0.0.1:$TermPort (pwsh)" -ForegroundColor Green

Write-Host ""
Write-Host "✅ Devstation locale pronta." -ForegroundColor Green
Write-Host ""
Write-Host "Test locale:" -ForegroundColor Cyan
Write-Host "  Browser → http://localhost:$CodePort  (VS Code)"
Write-Host "  Browser → http://localhost:$TermPort  (terminale)"
Write-Host ""
Write-Host "Step successivo: aggiungi questi port-forward al tunnel SSH:" -ForegroundColor Cyan
Write-Host "  -R $CodePort`:localhost:$CodePort"
Write-Host "  -R $TermPort`:localhost:$TermPort"
Write-Host "  -R 5173:localhost:5173    (Vite cozza-ai web)"
Write-Host "  -R 5174:localhost:5174    (Vite HUD)"
Write-Host "  -R 5175:localhost:5175    (Vite Remote)"
Write-Host ""
Write-Host "Lo script tunnel.ps1 viene aggiornato automaticamente." -ForegroundColor DarkGray
