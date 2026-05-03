/**
 * D-pad navigator — Netflix-style focus traversal.
 *
 * Sends arrow keys + Enter/Escape to the cockpit-bus via WebSocket;
 * the HUD's PointerOverlay listens and moves DOM focus accordingly.
 *
 * Useful when the user wants to navigate the HUD shell (mode tabs,
 * Devstation slot picker, theme toggle) from the couch or with the
 * Viture mounted, without holding the phone like a trackpad.
 */
interface DpadProps {
  onKey: (key: string) => void;
}

export function Dpad({ onKey }: DpadProps) {
  return (
    <div className="space-y-4 max-w-sm mx-auto">
      <h2 className="display text-sm opacity-70 uppercase tracking-wider text-center">
        D-pad navigator
      </h2>
      <p className="text-xs opacity-60 text-center px-2">
        Frecce muovono il fuoco fra i bottoni dell&apos;HUD. <strong>OK</strong> seleziona,{' '}
        <strong>Esc</strong> esce.
      </p>

      <div className="grid grid-cols-3 grid-rows-3 gap-2 aspect-square">
        <div />
        <DpadButton label="▲" onClick={() => onKey('ArrowUp')} />
        <div />
        <DpadButton label="◀" onClick={() => onKey('ArrowLeft')} />
        <DpadButton label="OK" big onClick={() => onKey('Enter')} />
        <DpadButton label="▶" onClick={() => onKey('ArrowRight')} />
        <div />
        <DpadButton label="▼" onClick={() => onKey('ArrowDown')} />
        <div />
      </div>

      <div className="flex gap-2 pt-2">
        <button
          type="button"
          onClick={() => onKey('Escape')}
          className="flex-1 surface rounded-xl py-3 font-mono text-sm"
        >
          Esc
        </button>
        <button
          type="button"
          onClick={() => onKey('Tab')}
          className="flex-1 surface rounded-xl py-3 font-mono text-sm"
        >
          Tab →
        </button>
      </div>
    </div>
  );
}

function DpadButton({
  label,
  onClick,
  big,
}: {
  label: string;
  onClick: () => void;
  big?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`surface rounded-2xl flex items-center justify-center font-mono ${
        big ? 'text-xl glow-cyan' : 'text-2xl'
      }`}
    >
      {label}
    </button>
  );
}
