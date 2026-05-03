# scripts/cockpit.ps1
# One-shot launcher del Cozza Cockpit.
#
# Cosa fa:
#  1. Verifica fnm/Node + pnpm
#  2. pnpm install se serve
#  3. Lancia VS Code col workspace cozza-ai (o multiverse con flag -All)
#  4. Aspetta che web (5173) + bus (3030) siano up via probe
#  5. Apre Simple Browser interno su tutti i pannelli
#
# Lancio:
#   pwsh ./scripts/cockpit.ps1            # cozza-ai workspace
#   pwsh ./scripts/cockpit.ps1 -All       # multiverse workspace (25 progetti)
#   pwsh ./scripts/cockpit.ps1 -Tunnel    # apre anche il reverse SSH tunnel

param(
  [switch]$All,
  [switch]$Tunnel,
  [switch]$NoInstall
)

$ErrorActionPreference = 'Stop'
$repoRoot = Split-Path -Parent $PSScriptRoot
$cozzaRoot = Split-Path -Parent $repoRoot

Write-Host ""
Write-Host "🛸 ========================================" -ForegroundColor Cyan
Write-Host "🛸  COZZA COCKPIT — launcher" -ForegroundColor Cyan
Write-Host "🛸 ========================================" -ForegroundColor Cyan
Write-Host ""

# 1. fnm
$fnm = Get-Command fnm -ErrorAction SilentlyContinue
if ($fnm) {
  Write-Host "▶ fnm trovato → attivo Node" -ForegroundColor Green
  fnm env --use-on-cd | Out-String | Invoke-Expression
}

# 2. pnpm
$pnpm = Get-Command pnpm -ErrorAction SilentlyContinue
if (-not $pnpm) {
  Write-Host "❌ pnpm non trovato. Installa con: npm i -g pnpm@9" -ForegroundColor Red
  exit 1
}

# 3. install
if (-not $NoInstall) {
  Push-Location $repoRoot
  try {
    if (-not (Test-Path 'node_modules')) {
      Write-Host "▶ pnpm install (workspace)" -ForegroundColor Green
      pnpm install
    } else {
      Write-Host "✓ node_modules presente, skip install (usa -NoInstall per forzare)" -ForegroundColor DarkGray
    }
  } finally {
    Pop-Location
  }
}

# 4. apri VS Code
$workspace = if ($All) {
  Join-Path $cozzaRoot 'cozza-multiverse.code-workspace'
} else {
  Join-Path $repoRoot 'cozza-ai.code-workspace'
}
if (-not (Test-Path $workspace)) {
  Write-Warning "Workspace non trovato: $workspace"
} else {
  Write-Host "▶ Apro VS Code: $workspace" -ForegroundColor Green
  Start-Process code -ArgumentList "`"$workspace`""
}

# 5. tunnel
if ($Tunnel) {
  Write-Host "▶ Apro tunnel SSH inverso (background)" -ForegroundColor Green
  Start-Process pwsh -ArgumentList @('-NoProfile','-File',(Join-Path $repoRoot 'scripts/tunnel.ps1')) -WindowStyle Minimized
}

# 6. aspetta che VS Code lanci i task `cockpit:up` (web/api/bus)
Write-Host ""
Write-Host "▶ Aspetto che web (5173) + bus (3030) siano up…" -ForegroundColor Green
$ports = @(5173, 3030)
$timeout = (Get-Date).AddSeconds(45)
foreach ($p in $ports) {
  while ((Get-Date) -lt $timeout) {
    $up = Test-NetConnection -ComputerName 'localhost' -Port $p -InformationLevel Quiet -WarningAction SilentlyContinue
    if ($up) {
      Write-Host "  ✓ porta $p UP" -ForegroundColor Green
      break
    }
    Start-Sleep -Milliseconds 500
  }
  if (-not $up) {
    Write-Warning "  porta $p ancora down, continua manualmente"
  }
}

Write-Host ""
Write-Host "🛸 Cockpit pronto." -ForegroundColor Cyan
Write-Host ""
Write-Host "URL locali:" -ForegroundColor Gray
Write-Host "  Web (chat):    http://localhost:5173" -ForegroundColor White
Write-Host "  HUD:           http://localhost:5174" -ForegroundColor White
Write-Host "  Remote:        http://localhost:5175" -ForegroundColor White
Write-Host "  Bus:           http://localhost:3030" -ForegroundColor White
Write-Host "  Bus WS:        ws://localhost:3030/ws" -ForegroundColor White
Write-Host ""
Write-Host "Hot keys VS Code:" -ForegroundColor Gray
Write-Host "  Ctrl+Shift+B   → cockpit:up (lancia tutto)" -ForegroundColor White
Write-Host "  F5             → debug compound" -ForegroundColor White
Write-Host ""
