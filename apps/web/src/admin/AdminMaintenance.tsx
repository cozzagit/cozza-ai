import { useEffect, useState } from 'react';
import { db } from '@/lib/db';
import { fetchAdminInfo, fetchVoicePreview, type AdminInfo } from '@/lib/admin-api';
import { StreamingAudioPlayer } from '@/lib/audio';
import { useSettingsStore } from '@/stores/settings';
import { getDebugLog, subscribeDebugLog, clearDebugLog, type DebugEntry } from '@/lib/debug-log';

export function AdminMaintenance() {
  const [info, setInfo] = useState<AdminInfo | null>(null);
  const [conversationCount, setConversationCount] = useState(0);
  const [messageCount, setMessageCount] = useState(0);
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    fetchAdminInfo()
      .then(setInfo)
      .catch(() => undefined);
    void Promise.all([db.conversations.count(), db.messages.count()]).then(([c, m]) => {
      setConversationCount(c);
      setMessageCount(m);
    });
  }, [busy]);

  const exportConversations = async (): Promise<void> => {
    setBusy('export');
    try {
      const conversations = await db.conversations.toArray();
      const messages = await db.messages.toArray();
      const blob = new Blob(
        [
          JSON.stringify(
            { exportedAt: new Date().toISOString(), conversations, messages },
            null,
            2,
          ),
        ],
        { type: 'application/json' },
      );
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `cozza-ai-conversations-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
      setMsg(`Esportate ${conversations.length} conversazioni · ${messages.length} messaggi`);
    } finally {
      setBusy(null);
    }
  };

  const clearHistory = async (): Promise<void> => {
    if (!confirm("Cancellare TUTTE le conversazioni? L'azione è irreversibile.")) return;
    setBusy('clear');
    try {
      await db.transaction('rw', [db.conversations, db.messages, db.audioBlobs], async () => {
        await db.conversations.clear();
        await db.messages.clear();
        await db.audioBlobs.clear();
      });
      setMsg('Cronologia cancellata');
    } finally {
      setBusy(null);
    }
  };

  const reloadSW = async (): Promise<void> => {
    setBusy('sw');
    try {
      if ('serviceWorker' in navigator) {
        const regs = await navigator.serviceWorker.getRegistrations();
        await Promise.all(regs.map((r) => r.update()));
      }
      if ('caches' in window) {
        const keys = await caches.keys();
        await Promise.all(keys.map((k) => caches.delete(k)));
      }
      setMsg('Service worker aggiornato. Ricarica la pagina per applicare.');
    } finally {
      setBusy(null);
    }
  };

  const testAudio = async (): Promise<void> => {
    setBusy('audio');
    setMsg(null);
    try {
      const voiceId = useSettingsStore.getState().voiceId;
      if (!voiceId) {
        setMsg('Nessuna voce impostata. Vai in Voci e scegline una.');
        return;
      }
      // Unlock first (gesture user)
      await StreamingAudioPlayer.unlock();
      const blob = await fetchVoicePreview(
        voiceId,
        'Test audio. Se senti questa frase, il sistema TTS funziona correttamente.',
      );
      const url = URL.createObjectURL(blob);
      const a = new Audio(url);
      a.setAttribute('playsinline', '');
      a.preload = 'auto';
      a.onerror = (): void => {
        setMsg(`Errore audio element: ${String(a.error?.code ?? 'sconosciuto')}`);
      };
      a.onended = (): void => {
        URL.revokeObjectURL(url);
        setMsg('Test audio completato. Funziona ✓');
      };
      try {
        await a.play();
        setMsg(`Riproduzione partita (${blob.size} bytes MP3, voiceId ${voiceId.slice(0, 8)}…)`);
      } catch (e) {
        setMsg(
          `play() bloccato: ${e instanceof Error ? e.message : 'errore'}. ` +
            `Probabile autoplay policy: prova a toccare il bottone microfono prima.`,
        );
      }
    } catch (e) {
      setMsg(`Test audio fallito: ${e instanceof Error ? e.message : 'errore'}`);
    } finally {
      setBusy(null);
    }
  };

  const requestMic = async (): Promise<void> => {
    setBusy('mic');
    setMsg(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.getTracks().forEach((t) => t.stop());
      setMsg('Permesso microfono concesso ✓');
    } catch (e) {
      setMsg(
        `Permesso microfono negato: ${e instanceof Error ? e.message : 'errore'}. ` +
          `Apri Impostazioni Chrome → Sito → Microfono → Consenti.`,
      );
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="space-y-6">
      <section className="rounded-xl glass-surface p-4 space-y-2">
        <h3 className="text-sm font-semibold">Sistema</h3>
        <dl className="grid grid-cols-2 gap-y-1 text-sm">
          <dt className="text-muted-fg/70">Commit API</dt>
          <dd className="font-mono">{info?.commit ?? '…'}</dd>
          <dt className="text-muted-fg/70">Env</dt>
          <dd className="font-mono">{info?.env ?? '…'}</dd>
          <dt className="text-muted-fg/70">Rate limit</dt>
          <dd className="font-mono">{info?.rateLimitPerMin ?? '…'} req/min/IP</dd>
          <dt className="text-muted-fg/70">Token TTL admin</dt>
          <dd className="font-mono">
            {info?.tokenTtlSeconds ? `${Math.round(info.tokenTtlSeconds / 3600)}h` : '…'}
          </dd>
          <dt className="text-muted-fg/70">Conversazioni locali</dt>
          <dd className="font-mono">{conversationCount}</dd>
          <dt className="text-muted-fg/70">Messaggi locali</dt>
          <dd className="font-mono">{messageCount}</dd>
        </dl>
      </section>

      {msg && (
        <div className="text-sm text-emerald-300 bg-emerald-950/40 border border-emerald-900/40 rounded-md px-3 py-2">
          {msg}
        </div>
      )}

      <section className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <Action
          title="Test audio TTS"
          desc="Verifica che la voce attuale si riproduca su questo device"
          onClick={testAudio}
          busy={busy === 'audio'}
        />
        <Action
          title="Test microfono"
          desc="Richiedi e verifica permesso microfono"
          onClick={requestMic}
          busy={busy === 'mic'}
        />
        <Action
          title="Esporta conversazioni"
          desc="Backup JSON di tutte le chat e messaggi"
          onClick={exportConversations}
          busy={busy === 'export'}
        />
        <Action
          title="Aggiorna service worker"
          desc="Forza il refresh della PWA installata"
          onClick={reloadSW}
          busy={busy === 'sw'}
        />
        <Action
          title="Cancella cronologia"
          desc="Rimuovi conversazioni, messaggi, audio (locale)"
          onClick={clearHistory}
          busy={busy === 'clear'}
          danger
        />
      </section>

      <DebugLogPanel />

      <section className="rounded-xl glass-surface p-4 space-y-2">
        <h3 className="text-sm font-semibold">Diagnostica device</h3>
        <dl className="grid grid-cols-2 gap-y-1 text-xs">
          <dt className="text-muted-fg/70">User-Agent</dt>
          <dd className="font-mono text-[10px] truncate">{navigator.userAgent}</dd>
          <dt className="text-muted-fg/70">Audio sbloccato</dt>
          <dd className="font-mono">{StreamingAudioPlayer.isUnlocked ? '✓ sì' : '✗ no'}</dd>
          <dt className="text-muted-fg/70">MediaSource MP3</dt>
          <dd className="font-mono">
            {typeof MediaSource !== 'undefined' && MediaSource.isTypeSupported('audio/mpeg')
              ? '✓ sì'
              : '✗ no (Blob fallback)'}
          </dd>
          <dt className="text-muted-fg/70">Web Speech API</dt>
          <dd className="font-mono">
            {typeof window.SpeechRecognition !== 'undefined' ||
            typeof window.webkitSpeechRecognition !== 'undefined'
              ? '✓ sì'
              : '✗ no'}
          </dd>
          <dt className="text-muted-fg/70">Voce attuale</dt>
          <dd className="font-mono text-[10px] truncate">
            {useSettingsStore.getState().voiceId || '— non impostata —'}
          </dd>
        </dl>
      </section>
    </div>
  );
}

function DebugLogPanel() {
  const [entries, setEntries] = useState<DebugEntry[]>(() => getDebugLog());

  useEffect(() => {
    const unsub = subscribeDebugLog(() => setEntries(getDebugLog()));
    setEntries(getDebugLog());
    return () => {
      unsub();
    };
  }, []);

  const copyAll = async (): Promise<void> => {
    const text = entries
      .map(
        (e) =>
          `[${new Date(e.ts).toLocaleTimeString()}] ${e.level.toUpperCase()} ${e.scope}: ${e.message}` +
          (e.data ? ` ${JSON.stringify(e.data)}` : ''),
      )
      .join('\n');
    await navigator.clipboard.writeText(text);
  };

  return (
    <section className="rounded-xl glass-surface p-4 space-y-2">
      <header className="flex items-center justify-between">
        <h3 className="text-sm font-semibold">Log eventi runtime</h3>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => void copyAll()}
            disabled={entries.length === 0}
            className="text-xs rounded-md px-2 py-1 bg-white/5 hover:bg-white/10 disabled:opacity-40"
          >
            Copia
          </button>
          <button
            type="button"
            onClick={() => clearDebugLog()}
            disabled={entries.length === 0}
            className="text-xs rounded-md px-2 py-1 bg-white/5 hover:bg-white/10 disabled:opacity-40"
          >
            Pulisci
          </button>
        </div>
      </header>
      {entries.length === 0 ? (
        <p className="text-xs text-muted-fg/60 py-3">
          Nessun evento. Quando interagisci con la chat, qui appariranno gli ultimi {80} eventi
          (chat send, tts speak, audio unlock, errori).
        </p>
      ) : (
        <ul className="text-[11px] font-mono max-h-[280px] overflow-y-auto space-y-0.5 bg-oled-100/60 rounded-md p-2">
          {entries
            .slice()
            .reverse()
            .map((e, i) => (
              <li
                key={`${e.ts}-${i}`}
                className={
                  e.level === 'error'
                    ? 'text-red-300'
                    : e.level === 'warn'
                      ? 'text-amber-300'
                      : 'text-muted-fg/80'
                }
              >
                <span className="text-muted-fg/50 mr-1">{new Date(e.ts).toLocaleTimeString()}</span>
                <span className="text-accent/70 mr-1">{e.scope}</span>
                {e.message}
                {e.data ? (
                  <span className="text-muted-fg/40 ml-1">{JSON.stringify(e.data)}</span>
                ) : null}
              </li>
            ))}
        </ul>
      )}
    </section>
  );
}

function Action({
  title,
  desc,
  onClick,
  busy,
  danger,
}: {
  title: string;
  desc: string;
  onClick: () => void;
  busy: boolean;
  danger?: boolean;
}) {
  return (
    <button
      type="button"
      disabled={busy}
      onClick={onClick}
      className={[
        'focus-accent text-left rounded-xl glass-surface p-4 hover:bg-white/5 disabled:opacity-50',
        danger ? 'hover:bg-red-950/40 hover:border-red-900/40' : '',
      ].join(' ')}
    >
      <div className={`font-medium text-sm ${danger ? 'text-red-300' : ''}`}>{title}</div>
      <div className="text-xs text-muted-fg/70 mt-0.5">{desc}</div>
      {busy && <div className="text-xs text-accent mt-2">in corso…</div>}
    </button>
  );
}
