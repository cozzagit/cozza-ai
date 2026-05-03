import * as vscode from 'vscode';

/**
 * "Layouts" — preset combinations of editor groups, panel, sidebar visibility
 * tuned for different work modes. Implemented via VS Code commands so we
 * don't depend on extension-host-only APIs.
 */

interface Layout {
  id: string;
  label: string;
  detail: string;
  apply(): Promise<void>;
}

const LAYOUTS: Layout[] = [
  {
    id: 'mission',
    label: '1 · Mission Control',
    detail: 'Default — code + AI + preview + terminals',
    apply: async () => {
      await vscode.commands.executeCommand('workbench.action.closeAllGroups');
      await vscode.commands.executeCommand('workbench.action.toggleSidebarVisibility'); // ensure visible
      await vscode.commands.executeCommand('workbench.action.toggleSidebarVisibility');
      await vscode.commands.executeCommand('workbench.action.terminal.focus');
      await vscode.commands.executeCommand('workbench.action.editorLayoutTwoColumns');
    },
  },
  {
    id: 'tunnel',
    label: '2 · Code Tunnel',
    detail: 'Editor full + AI side panel, no preview',
    apply: async () => {
      await vscode.commands.executeCommand('workbench.action.closeAllGroups');
      await vscode.commands.executeCommand('workbench.action.editorLayoutSingle');
      await vscode.commands.executeCommand('workbench.action.closePanel');
    },
  },
  {
    id: 'visual',
    label: '3 · Visual Lab',
    detail: 'Big preview + small editor (UI tweaking)',
    apply: async () => {
      await vscode.commands.executeCommand('workbench.action.closeAllGroups');
      await vscode.commands.executeCommand('simpleBrowser.show', 'http://localhost:5173');
      await vscode.commands.executeCommand('workbench.action.editorLayoutTwoColumns');
    },
  },
  {
    id: 'debug',
    label: '4 · Debug Bay',
    detail: 'Compound debug web+api+bus',
    apply: async () => {
      await vscode.commands.executeCommand('workbench.action.debug.start');
    },
  },
  {
    id: 'ops',
    label: '5 · Ops Bridge',
    detail: 'VPS logs + healthz + pm2, no code',
    apply: async () => {
      await vscode.commands.executeCommand('workbench.action.closeAllGroups');
      await vscode.commands.executeCommand('workbench.action.terminal.toggleTerminal');
      await vscode.commands.executeCommand('workbench.action.tasks.runTask', 'vps:tail');
    },
  },
  {
    id: 'zen',
    label: '6 · Zen',
    detail: 'Just the editor, centered',
    apply: async () => {
      await vscode.commands.executeCommand('workbench.action.toggleZenMode');
    },
  },
];

export const layoutCommands = {
  async switch(): Promise<void> {
    const pick = await vscode.window.showQuickPick(
      LAYOUTS.map((l) => ({ label: l.label, detail: l.detail, id: l.id })),
      { placeHolder: 'Cozza: Switch Layout' },
    );
    if (!pick) return;
    const layout = LAYOUTS.find((l) => l.id === pick.id);
    if (layout) await layout.apply();
  },
};
