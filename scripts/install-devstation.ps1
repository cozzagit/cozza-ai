# scripts/install-devstation.ps1
# Sets up the Cozza Devstation as Windows Scheduled Tasks running in
# the user's profile (so SSH keys, fnm, pnpm, npm globals all work).
#
# Why Scheduled Tasks instead of NSSM/services:
#   - NSSM as LocalSystem can't read ~/.ssh and lacks the user PATH;
#     fixing it requires saving the user password somewhere or using
#     gMSA — overkill for a single-dev box.
#   - Scheduled Tasks support "At logon" + "Highest privileges" and
#     run inside the LUCA\lucap profile by default. Reboot-safe.
#
# Run once as admin:
#   pwsh -ExecutionPolicy Bypass -File ./scripts/install-devstation.ps1

param(
  [string]$TaskUser = "$env:USERDOMAIN\$env:USERNAME"
)

$ErrorActionPreference = 'Stop'

# Log to file so elevated runs can be inspected
$logFile = "$env:USERPROFILE\.config\cozza-cockpit\install.log"
New-Item -ItemType Directory -Force -Path (Split-Path $logFile) | Out-Null
Start-Transcript -Path $logFile -Append -Force | Out-Null

Write-Host ""
Write-Host "🛸 Cozza Devstation — installer (Scheduled Tasks)" -ForegroundColor Cyan
Write-Host ""

$identity = [System.Security.Principal.WindowsIdentity]::GetCurrent()
$principal = New-Object System.Security.Principal.WindowsPrincipal $identity
if (-not $principal.IsInRole([System.Security.Principal.WindowsBuiltInRole]::Administrator)) {
  Write-Warning "Lo script va lanciato come Administrator."
  Stop-Transcript | Out-Null
  exit 2
}

$repoRoot = Split-Path -Parent $PSScriptRoot
$pwshExe = (Get-Command pwsh -ErrorAction SilentlyContinue)?.Source
if (-not $pwshExe) { $pwshExe = "$env:ProgramFiles\PowerShell\7\pwsh.exe" }
if (-not (Test-Path $pwshExe)) { throw "pwsh non trovato. Installa PowerShell 7." }

$logDir = "$env:USERPROFILE\.config\cozza-cockpit"
New-Item -ItemType Directory -Force -Path $logDir | Out-Null

# Build wrapper scripts that activate fnm + run the target command, with
# stdout/stderr captured. The Scheduled Task launches pwsh on these.
$busWrapper = Join-Path $logDir 'run-bus.ps1'
@"
`$ErrorActionPreference = 'Stop'
Set-Location '$repoRoot'
# Activate fnm so node + pnpm are on PATH
`$fnmExe = "`$env:LOCALAPPDATA\Microsoft\WinGet\Packages\Schniz.fnm_Microsoft.Winget.Source_8wekyb3d8bbwe\fnm.exe"
if (Test-Path `$fnmExe) {
  `$env:PATH = "`$(Split-Path `$fnmExe);`$env:PATH"
  fnm env --use-on-cd | Out-String | Invoke-Expression
}
Start-Transcript -Path '$logDir\bus.log' -Append -Force
Write-Host "[bus] starting `$(Get-Date)"
& pnpm --filter cockpit-bus dev
"@ | Set-Content -Path $busWrapper -Encoding UTF8

$tunnelWrapper = Join-Path $logDir 'run-tunnel.ps1'
@"
`$ErrorActionPreference = 'Continue'
Set-Location '$repoRoot'
Start-Transcript -Path '$logDir\tunnel.log' -Append -Force
Write-Host "[tunnel] starting `$(Get-Date)"
& '$repoRoot\scripts\tunnel.ps1'
"@ | Set-Content -Path $tunnelWrapper -Encoding UTF8

# Helper: register or update a scheduled task
function Set-CockpitTask {
  param([string]$Name, [string]$Wrapper, [string]$Description)
  Unregister-ScheduledTask -TaskName $Name -Confirm:$false -ErrorAction SilentlyContinue

  $action = New-ScheduledTaskAction -Execute $pwshExe `
    -Argument "-NoLogo -NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File `"$Wrapper`""
  # Trigger: at user logon AND at boot (in case PC is rebooted while logged in)
  $triggers = @(
    New-ScheduledTaskTrigger -AtLogOn -User $TaskUser
    New-ScheduledTaskTrigger -AtStartup
  )
  $principalObj = New-ScheduledTaskPrincipal -UserId $TaskUser -LogonType S4U -RunLevel Highest
  $settings = New-ScheduledTaskSettingsSet `
    -AllowStartIfOnBatteries `
    -DontStopIfGoingOnBatteries `
    -ExecutionTimeLimit ([TimeSpan]::Zero) `
    -RestartCount 99 `
    -RestartInterval (New-TimeSpan -Minutes 1) `
    -StartWhenAvailable
  Register-ScheduledTask -TaskName $Name -Action $action -Trigger $triggers `
    -Principal $principalObj -Settings $settings -Description $Description | Out-Null
  Start-ScheduledTask -TaskName $Name
  Write-Host "✓ Scheduled Task '$Name' registrato e avviato" -ForegroundColor Green
}

# 1. cozza-cockpit-bus
Set-CockpitTask `
  -Name 'CozzaCockpit-Bus' `
  -Wrapper $busWrapper `
  -Description 'Cozza Cockpit Bus (Hono + WS + adapters healthz/git/pm2/quota/claude)'

# 2. cozza-cockpit-tunnel
Set-CockpitTask `
  -Name 'CozzaCockpit-Tunnel' `
  -Wrapper $tunnelWrapper `
  -Description 'Reverse SSH tunnel PC -> VPS Aruba (esponi cockpit-bus + Vite + code-server)'

Write-Host ""
Write-Host "── VS Code Tunnel ──────────────────────────────────────────" -ForegroundColor Cyan
Write-Host ""
$codeTunnel = (Get-ChildItem -Path "$env:LOCALAPPDATA\Programs\Microsoft VS Code\bin\code-tunnel.exe" -ErrorAction SilentlyContinue)?.FullName
if ($codeTunnel) {
  Write-Host "Per attivare il VS Code Tunnel (interattivo, una volta sola, login GitHub):" -ForegroundColor Yellow
  Write-Host "  & '$codeTunnel' tunnel rename cozza-pc" -ForegroundColor White
  Write-Host "  & '$codeTunnel' tunnel service install --name cozza-pc" -ForegroundColor White
  Write-Host ""
  Write-Host "Da quel momento parte al boot. URL fisso: https://vscode.dev/tunnel/cozza-pc" -ForegroundColor Gray
}

Write-Host ""
Write-Host "── Stato finale ────────────────────────────────────────────" -ForegroundColor Cyan
Get-ScheduledTask -TaskName 'CozzaCockpit-*' | Format-Table TaskName,State

Write-Host ""
Write-Host "URL pubblici:" -ForegroundColor Gray
Write-Host "  https://cozza-ai.vibecanyon.com/                  (chat)"
Write-Host "  https://cozza-ai.vibecanyon.com/cockpit/           (HUD)"
Write-Host "  https://cozza-ai.vibecanyon.com/cockpit/remote/    (Pixel remote)"
Write-Host "  https://cozza-ai.vibecanyon.com/cockpit/dev/5173/  (preview Vite cozza-ai)"
Write-Host ""
Write-Host "Log di servizio:" -ForegroundColor Gray
Write-Host "  $logDir\bus.log"
Write-Host "  $logDir\tunnel.log"
Write-Host ""
Write-Host "✅ Devstation pronta. Riavvia per verificare l'auto-start." -ForegroundColor Green
Stop-Transcript | Out-Null
