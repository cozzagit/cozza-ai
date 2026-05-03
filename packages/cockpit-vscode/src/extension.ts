import * as vscode from 'vscode';
import { ProjectsProvider } from './tree';
import { startBusClient, type BusClient } from './bus';
import { layoutCommands } from './layouts';
import { openHudWebview } from './hud-webview';

let bus: BusClient | null = null;
let statusBar: vscode.StatusBarItem | null = null;

export function activate(ctx: vscode.ExtensionContext): void {
  const cfg = (): vscode.WorkspaceConfiguration =>
    vscode.workspace.getConfiguration('cozzaCockpit');

  // Status bar
  statusBar = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 200);
  statusBar.text = '🛸 cozza · …';
  statusBar.tooltip = 'Cozza Cockpit — click to open HUD';
  statusBar.command = 'cozza.cockpit.openHud';
  statusBar.show();
  ctx.subscriptions.push(statusBar);

  // Tree
  const provider = new ProjectsProvider();
  ctx.subscriptions.push(
    vscode.window.registerTreeDataProvider('cozza.cockpit.tree', provider),
    vscode.commands.registerCommand('cozza.cockpit.refreshTree', () => provider.refresh()),
    vscode.commands.registerCommand('cozza.cockpit.openProject', (it: { url?: string }) => {
      if (it?.url) void vscode.env.openExternal(vscode.Uri.parse(it.url));
    }),
  );

  // Bus connect
  const start = (): void => {
    const token = cfg().get<string>('token') ?? '';
    const url = cfg().get<string>('busUrl') ?? 'http://localhost:3030';
    if (!token) {
      if (statusBar) statusBar.text = '🛸 cozza · no token';
      return;
    }
    bus?.dispose();
    bus = startBusClient(url, token, {
      onState: (s) => {
        if (!statusBar) return;
        if (s === 'open') {
          statusBar.text = '🛸 cozza · ✓ connected';
        } else if (s === 'connecting') {
          statusBar.text = '🛸 cozza · …';
        } else {
          statusBar.text = '🛸 cozza · ○ offline';
        }
      },
      onEvent: (e) => provider.handleEvent(e),
    });
  };
  start();

  ctx.subscriptions.push(
    vscode.workspace.onDidChangeConfiguration((e) => {
      if (
        e.affectsConfiguration('cozzaCockpit.token') ||
        e.affectsConfiguration('cozzaCockpit.busUrl')
      ) {
        start();
      }
    }),
  );

  // Commands
  ctx.subscriptions.push(
    vscode.commands.registerCommand('cozza.cockpit.setToken', async () => {
      const v = await vscode.window.showInputBox({
        prompt: 'JWT bus token',
        password: true,
        ignoreFocusOut: true,
      });
      if (!v) return;
      await cfg().update('token', v, vscode.ConfigurationTarget.Global);
      void vscode.window.showInformationMessage('Cozza: token saved.');
    }),
    vscode.commands.registerCommand('cozza.cockpit.openHud', () => {
      const url = cfg().get<string>('busUrl') ?? 'http://localhost:3030';
      const token = cfg().get<string>('token') ?? '';
      const hudUrl = url.replace('3030', '5174');
      openHudWebview(ctx, hudUrl, token);
    }),
    vscode.commands.registerCommand('cozza.cockpit.switchLayout', () => layoutCommands.switch()),
    vscode.commands.registerCommand('cozza.cockpit.deployCurrent', () => {
      const term = vscode.window.createTerminal('cozza:deploy');
      term.show();
      term.sendText('bash deploy/deploy.sh');
    }),
    vscode.commands.registerCommand('cozza.cockpit.armInput', async () => {
      const url = cfg().get<string>('busUrl') ?? '';
      const token = cfg().get<string>('token') ?? '';
      const res = await fetch(`${url}/api/input/arm`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      void vscode.window.showInformationMessage(
        `Input plane: ${res.ok ? 'ARMED' : `error ${res.status}`}`,
      );
    }),
    vscode.commands.registerCommand('cozza.cockpit.disarmInput', async () => {
      const url = cfg().get<string>('busUrl') ?? '';
      const token = cfg().get<string>('token') ?? '';
      const res = await fetch(`${url}/api/input/disarm`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      void vscode.window.showInformationMessage(
        `Input plane: ${res.ok ? 'DISARMED' : `error ${res.status}`}`,
      );
    }),
  );
}

export function deactivate(): void {
  bus?.dispose();
  bus = null;
  statusBar?.dispose();
  statusBar = null;
}
