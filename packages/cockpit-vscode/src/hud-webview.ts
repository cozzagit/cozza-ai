import * as vscode from 'vscode';

let panel: vscode.WebviewPanel | null = null;

/**
 * Embeds the HUD PWA inside a VS Code webview by sandboxed iframe pointing
 * at the dev (or VPS) URL. Useful for "I want the HUD without leaving the
 * editor" — typical Visual Lab layout.
 *
 * Auto-passes the JWT token via URL fragment so the HUD can hydrate
 * without prompting again.
 */
export function openHudWebview(ctx: vscode.ExtensionContext, hudUrl: string, token: string): void {
  if (panel) {
    panel.reveal(vscode.ViewColumn.Two);
    return;
  }
  panel = vscode.window.createWebviewPanel(
    'cozzaCockpitHud',
    '🛸 Cozza HUD',
    { viewColumn: vscode.ViewColumn.Two, preserveFocus: true },
    {
      enableScripts: true,
      retainContextWhenHidden: true,
    },
  );
  const url = `${hudUrl}#token=${encodeURIComponent(token)}`;
  panel.webview.html = renderHtml(url);
  panel.onDidDispose(() => {
    panel = null;
  });
  ctx.subscriptions.push(panel);
}

function renderHtml(url: string): string {
  return /* html */ `<!doctype html>
<html><head><meta charset="utf-8"><style>
  html,body,iframe { height:100%; width:100%; margin:0; padding:0; background:#000; color:#fff; }
  iframe { border:0; }
</style></head><body>
  <iframe src="${url}" allow="clipboard-read; clipboard-write; microphone; autoplay" referrerpolicy="origin"></iframe>
</body></html>`;
}
