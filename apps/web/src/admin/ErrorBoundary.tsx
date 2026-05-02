import { Component, type ErrorInfo, type ReactNode } from 'react';

interface Props {
  children: ReactNode;
  /** Tab/section name shown in the fallback UI for context */
  label?: string;
}

interface State {
  error: Error | null;
  info: ErrorInfo | null;
}

/**
 * Catches render errors inside the admin panel so a single broken page
 * doesn't blank the whole UI. Shows the stack so the issue is debuggable
 * even on a phone where DevTools is awkward.
 */
export class AdminErrorBoundary extends Component<Props, State> {
  override state: State = { error: null, info: null };

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { error };
  }

  override componentDidCatch(error: Error, info: ErrorInfo): void {
    this.setState({ error, info });
    console.error('[admin] crash:', error, info);
  }

  reset = (): void => {
    this.setState({ error: null, info: null });
  };

  override render(): ReactNode {
    const { error, info } = this.state;
    if (!error) return this.props.children;
    return (
      <div className="rounded-xl border border-red-900/40 bg-red-950/30 p-4 space-y-3">
        <div className="flex items-center gap-2">
          <span className="text-2xl" aria-hidden>
            💥
          </span>
          <h3 className="font-semibold text-red-200">
            Errore in {this.props.label ?? 'questa sezione'}
          </h3>
        </div>
        <p className="text-sm text-red-200/90">{error.message}</p>
        <details className="text-xs">
          <summary className="cursor-pointer text-red-200/70 hover:text-red-200">
            Stack trace
          </summary>
          <pre className="mt-2 whitespace-pre-wrap text-red-300/70 font-mono text-[10px] leading-snug">
            {error.stack ?? '(no stack)'}
            {info?.componentStack ? `\n\nComponent stack:${info.componentStack}` : ''}
          </pre>
        </details>
        <button
          type="button"
          onClick={this.reset}
          className="rounded-md px-3 py-1.5 text-sm bg-white/10 hover:bg-white/15"
        >
          Riprova
        </button>
      </div>
    );
  }
}
