import type { ChatModel } from '@cozza/shared';

interface ModelSelectorProps {
  value: ChatModel;
  onChange: (m: ChatModel) => void;
  disabled?: boolean;
}

const OPTIONS: { id: ChatModel; label: string; hint: string }[] = [
  { id: 'claude-haiku-4-5', label: 'Haiku', hint: 'rapido' },
  { id: 'claude-sonnet-4-6', label: 'Sonnet', hint: 'completo' },
  { id: 'gpt-4o-mini', label: '4o-mini', hint: 'economico' },
  { id: 'gpt-4o', label: '4o', hint: 'top OpenAI' },
];

export function ModelSelector({ value, onChange, disabled = false }: ModelSelectorProps) {
  return (
    <div
      role="radiogroup"
      aria-label="Modello AI"
      className="inline-flex glass-surface rounded-full p-1 gap-1 text-sm"
    >
      {OPTIONS.map((o) => {
        const active = o.id === value;
        return (
          <button
            key={o.id}
            type="button"
            role="radio"
            aria-checked={active}
            disabled={disabled}
            onClick={() => onChange(o.id)}
            className={[
              'focus-accent rounded-full px-3 py-1.5 transition-colors',
              active
                ? 'bg-accent text-black font-medium'
                : 'text-muted-fg hover:text-white',
              disabled ? 'opacity-50 cursor-not-allowed' : '',
            ].join(' ')}
            title={o.hint}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}
