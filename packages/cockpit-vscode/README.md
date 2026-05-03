# 🛸 Cozza Cockpit — VS Code extension

Status bar + tree view + webview HUD + layout switcher per il Cozza dev cockpit.

## Install

Build locale e install:

```pwsh
pnpm -C packages/cockpit-vscode build
pnpm -C packages/cockpit-vscode package
code --install-extension packages/cockpit-vscode/cozza-cockpit-vscode.vsix
```

## Setup

1. Avvia il cockpit-bus locale: `pnpm dev:bus`
2. Ottieni un token JWT (vedi `docs/cockpit-readme.md`)
3. Command palette → `Cozza: Set bus token` → incolla token

Lo status bar in basso a destra dovrebbe diventare `🛸 cozza · ✓ connected`.

## Comandi

- `Cozza: Open HUD (webview)` — embed dell'HUD dentro VS Code (Ctrl+K Ctrl+H)
- `Cozza: Switch Layout…` — quickpick fra 6 layout (Ctrl+K Ctrl+L)
- `Cozza: Deploy current project`
- `Cozza: Arm/Disarm input plane`
- `Cozza: Set bus token`

## Sidebar

Vista "Cozza Cockpit" mostra tutti i progetti con healthz live, ordinati per stato.
