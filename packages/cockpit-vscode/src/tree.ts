import * as vscode from 'vscode';
import type { CockpitEventLike } from './bus';

interface ProjectVital {
  name: string;
  status: 'ok' | 'warn' | 'down' | 'unknown';
  url?: string | undefined;
  latency?: number | undefined;
  ts: number;
}

class ProjectItem extends vscode.TreeItem {
  public readonly url: string | undefined;
  constructor(public readonly v: ProjectVital) {
    super(v.name, vscode.TreeItemCollapsibleState.None);
    this.description =
      (v.latency !== undefined ? `${v.latency}ms` : '') + (v.url ? ` · ${shortHost(v.url)}` : '');
    this.tooltip = `${v.name}\n${v.url ?? ''}\nstatus: ${v.status}`;
    this.iconPath = new vscode.ThemeIcon(iconFor(v.status));
    this.contextValue = 'project';
    this.url = v.url;
    if (v.url) {
      this.command = {
        command: 'cozza.cockpit.openProject',
        title: 'Open',
        arguments: [{ url: v.url }],
      };
    }
  }
}

function iconFor(s: ProjectVital['status']): string {
  switch (s) {
    case 'ok':
      return 'pass-filled';
    case 'warn':
      return 'warning';
    case 'down':
      return 'error';
    default:
      return 'circle-outline';
  }
}

function shortHost(url: string): string {
  try {
    return new URL(url).hostname;
  } catch {
    return url;
  }
}

export class ProjectsProvider implements vscode.TreeDataProvider<ProjectItem> {
  private map = new Map<string, ProjectVital>();
  private _onDidChange = new vscode.EventEmitter<ProjectItem | undefined>();
  readonly onDidChangeTreeData = this._onDidChange.event;

  refresh(): void {
    this._onDidChange.fire(undefined);
  }

  handleEvent(e: CockpitEventLike): void {
    if (e.type !== 'health' || !e.project) return;
    const status = (e.status as ProjectVital['status']) ?? 'unknown';
    this.map.set(e.project, {
      name: e.project,
      status,
      url: typeof e.url === 'string' ? e.url : undefined,
      latency: typeof e.latencyMs === 'number' ? e.latencyMs : undefined,
      ts: e.ts,
    });
    this._onDidChange.fire(undefined);
  }

  getTreeItem(element: ProjectItem): vscode.TreeItem {
    return element;
  }

  getChildren(): ProjectItem[] {
    const list = [...this.map.values()].sort((a, b) => {
      const order = { down: 0, warn: 1, unknown: 2, ok: 3 } as const;
      return order[a.status] - order[b.status] || a.name.localeCompare(b.name);
    });
    return list.map((v) => new ProjectItem(v));
  }
}
