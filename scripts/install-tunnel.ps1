# scripts/install-tunnel.ps1
# One-shot setup del tunnel SSH inverso PC↔VPS.
#
# Cosa fa:
#  1. Genera chiave dedicata ~/.ssh/cozza_cockpit_ed25519 (no passphrase)
#  2. Installa la chiave pubblica sul VPS in authorized_keys con scope ristretto
#     (no shell, solo port-forward 3031)
#  3. Verifica che il forward funzioni
#  4. Stampa istruzioni per registrare il tunnel come servizio Windows via NSSM
#
# Lancia da repo root:
#   pwsh ./scripts/install-tunnel.ps1

param(
  [string]$VpsHost     = '188.213.170.214',
  [string]$VpsUser     = 'root',
  [string]$AdminKey    = "$env:USERPROFILE\.ssh\aruba_vps",
  [string]$CockpitKey  = "$env:USERPROFILE\.ssh\cozza_cockpit_ed25519",
  [int]   $RemotePort  = 3031
)

$ErrorActionPreference = 'Stop'

Write-Host "🛸 Cozza Cockpit Tunnel — setup" -ForegroundColor Cyan
Write-Host ""

# 1. Genera chiave dedicata se manca
if (-not (Test-Path $CockpitKey)) {
  Write-Host "▶ Genero chiave dedicata $CockpitKey" -ForegroundColor Green
  & ssh-keygen -t ed25519 -N '""' -C 'cozza-cockpit-tunnel' -f $CockpitKey
} else {
  Write-Host "✓ Chiave già presente: $CockpitKey" -ForegroundColor DarkGray
}

$pubKey = Get-Content "$CockpitKey.pub" -Raw
$pubKey = $pubKey.Trim()

# 2. Installa la chiave sul VPS con scope ristretto (no shell, solo port-forward)
$restrictedLine = "command=`"echo cockpit-only`",no-pty,no-X11-forwarding,no-agent-forwarding,permitopen=`"localhost:$RemotePort`",permitopen=`"127.0.0.1:$RemotePort`" $pubKey"

Write-Host "▶ Aggiungo chiave a authorized_keys del VPS (admin key necessaria)" -ForegroundColor Green

# Tmp file con la riga, lo scp, poi append idempotente lato VPS
$tmpFile = New-TemporaryFile
$restrictedLine | Set-Content -Path $tmpFile -NoNewline -Encoding ASCII

& scp -i $AdminKey -o StrictHostKeyChecking=accept-new $tmpFile "$VpsUser@${VpsHost}:/tmp/cozza_cockpit_pub"
Remove-Item $tmpFile

$bashCmd = @"
mkdir -p ~/.ssh
chmod 700 ~/.ssh
touch ~/.ssh/authorized_keys
chmod 600 ~/.ssh/authorized_keys
# Rimuovi righe vecchie cozza-cockpit, poi appendi la nuova
grep -v 'cozza-cockpit-tunnel' ~/.ssh/authorized_keys > ~/.ssh/authorized_keys.tmp || true
cat /tmp/cozza_cockpit_pub >> ~/.ssh/authorized_keys.tmp
echo '' >> ~/.ssh/authorized_keys.tmp
mv ~/.ssh/authorized_keys.tmp ~/.ssh/authorized_keys
chmod 600 ~/.ssh/authorized_keys
rm -f /tmp/cozza_cockpit_pub
echo 'authorized_keys aggiornato'
"@

& ssh -i $AdminKey -o StrictHostKeyChecking=accept-new "$VpsUser@$VpsHost" $bashCmd

# 3. Quick test
Write-Host ""
Write-Host "▶ Test tunnel (apertura 5s + chiusura)" -ForegroundColor Green
$proc = Start-Process -FilePath ssh -PassThru -WindowStyle Hidden -ArgumentList @(
  '-N','-i',$CockpitKey,
  '-o','ExitOnForwardFailure=yes',
  '-o','StrictHostKeyChecking=accept-new',
  '-R',"${RemotePort}:localhost:3030",
  "$VpsUser@$VpsHost"
)
Start-Sleep -Seconds 4
if (-not $proc.HasExited) {
  Write-Host "  ✓ Tunnel aperto correttamente (PID $($proc.Id))" -ForegroundColor Green
  Stop-Process -Id $proc.Id -Force
} else {
  Write-Warning "Tunnel chiuso prematuramente. Verifica config sul VPS."
}

Write-Host ""
Write-Host "✅ Setup completato." -ForegroundColor Green
Write-Host ""
Write-Host "Per lanciare il tunnel manualmente:" -ForegroundColor Cyan
Write-Host "   pwsh ./scripts/tunnel.ps1" -ForegroundColor White
Write-Host ""
Write-Host "Per registrarlo come servizio Windows (parte al boot):" -ForegroundColor Cyan
Write-Host "   1. winget install nssm.nssm" -ForegroundColor White
Write-Host "   2. nssm install cozza-cockpit-tunnel pwsh.exe ""-NoProfile -ExecutionPolicy Bypass -File $((Get-Location).Path)\scripts\tunnel.ps1""" -ForegroundColor White
Write-Host "   3. nssm start cozza-cockpit-tunnel" -ForegroundColor White
Write-Host ""
Write-Host "Step VPS (manuale, una volta):" -ForegroundColor Cyan
Write-Host "   - Verifica che nginx abbia il blocco /cockpit/ (aggiunto da deploy/deploy.sh)" -ForegroundColor White
Write-Host "   - Verifica autossh disponibile localmente (winget install Auth-Org.AutoSSH-Windows)" -ForegroundColor White
