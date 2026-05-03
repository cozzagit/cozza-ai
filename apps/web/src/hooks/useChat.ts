import { useCallback, useRef, useState } from 'react';
import { v7 as uuidv7 } from 'uuid';
import { streamChat, enrichVisuals, ApiError } from '@/lib/api';
import { db, type MessageRecord, type Conversation } from '@/lib/db';
import { PROVIDER_BY_MODEL, type ChatModel, type ChatMessage } from '@cozza/shared';
import { useSettingsStore } from '@/stores/settings';
import { log } from '@/lib/debug-log';
import { stripFencesForTts } from '@/lib/artifacts';

export type ChatStatus = 'idle' | 'streaming' | 'error';

interface EnrichArgs {
  messageId: string;
  assistantText: string;
  userPrompt: string;
  hasImagePrompt: boolean;
  hasMermaid: boolean;
}

/**
 * Removes the persona section that instructs the model to emit visual
 * fences (image-prompt / mermaid / svg) when the user has the visuals
 * toggle OFF. We delete the "REGOLA CRITICA" block (delimited by the
 * box-drawing dividers) and append an explicit suppression note.
 */
function stripVisualsInstruction(persona: string): string {
  if (!persona) return persona;
  // The default persona uses ════ box-drawing dividers around the
  // critical visuals rule. We strip both the rule block and the
  // POSITIVE / NEGATIVE example blocks that follow it.
  const cleaned = persona
    .replace(
      /═{30,}\s*\n\s*REGOLA CRITICA[\s\S]*?(?=(═{30,}\s*\n\s*DOMANDE SU INFO RECENTI)|$)/u,
      '',
    )
    .replace(/═{30,}\s*\n\s*ESEMPIO POSITIVO[\s\S]*?(?=(═{30,}\s*\n\s*ESEMPIO NEGATIVO)|$)/u, '')
    .replace(
      /═{30,}\s*\n\s*ESEMPIO NEGATIVO[\s\S]*?(?=(═{30,}\s*\n\s*DOMANDE SU INFO RECENTI)|$)/u,
      '',
    )
    .trim();
  const suppress =
    '\n\nIMPORTANTE: NON includere mai blocchi `image-prompt`, `mermaid`, `svg`, `html` o link a immagini Markdown nelle risposte. Rispondi in solo testo, eventualmente con tabelle Markdown e elenchi.';
  return cleaned + suppress;
}

/**
 * Background enrichment: asks /api/enrich for missing visual blocks and
 * appends them to the persisted message. Live-query in the UI picks up
 * the change automatically and the artifacts panel shows the new
 * image/mermaid card. Silently no-ops on errors.
 */
async function enrichInBackground(args: EnrichArgs): Promise<void> {
  try {
    log.info('enrich.bg', 'start', {
      hasImagePrompt: args.hasImagePrompt,
      hasMermaid: args.hasMermaid,
    });
    const { blocks, provider } = await enrichVisuals({
      assistantText: args.assistantText,
      userPrompt: args.userPrompt,
      hasImagePrompt: args.hasImagePrompt,
      hasMermaid: args.hasMermaid,
    });
    if (!blocks.trim()) {
      log.info('enrich.bg', 'no blocks');
      return;
    }
    // Append to the persisted message — the artifacts extractor picks
    // up the new fenced blocks on the next render.
    const current = await db.messages.get(args.messageId);
    if (!current) return;
    const newContent = `${current.content}\n\n${blocks.trim()}\n`;
    await db.messages.update(args.messageId, { content: newContent });
    log.info('enrich.bg', 'appended', { provider, len: blocks.length });
  } catch (e) {
    log.warn('enrich.bg', 'failed (silent)', {
      msg: e instanceof Error ? e.message : 'unknown',
    });
  }
}

export interface UseChatOptions {
  conversationId: string | null;
  model: ChatModel;
  onAssistantSentence?: (sentence: string) => void;
  onAssistantDone?: (fullText: string) => void;
  onConversationCreated?: (id: string) => void;
}

export function useChat(opts: UseChatOptions) {
  const {
    conversationId: optConvId,
    model,
    onAssistantSentence,
    onAssistantDone,
    onConversationCreated,
  } = opts;
  const [status, setStatus] = useState<ChatStatus>('idle');
  const [error, setError] = useState<string | null>(null);
  const [streamingText, setStreamingText] = useState('');
  const [lastUserText, setLastUserText] = useState('');
  const abortRef = useRef<AbortController | null>(null);

  // Keep latest callbacks in refs so `send` identity stays stable
  const sentenceRef = useRef(onAssistantSentence);
  const doneRef = useRef(onAssistantDone);
  const createdRef = useRef(onConversationCreated);
  sentenceRef.current = onAssistantSentence;
  doneRef.current = onAssistantDone;
  createdRef.current = onConversationCreated;

  const send = useCallback(
    async (userText: string): Promise<void> => {
      if (!userText.trim()) return;
      setError(null);
      setStreamingText('');
      setLastUserText(userText);
      log.info('chat.send', 'start', { model, len: userText.length });

      let conversationId = optConvId;
      let buf = '';
      const ctrl = new AbortController();
      abortRef.current = ctrl;
      const assistantId = uuidv7();

      try {
        const provider = PROVIDER_BY_MODEL[model];
        if (!provider) throw new Error(`unknown model ${model}`);

        const now = Date.now();
        const userId = uuidv7();

        if (!conversationId) {
          conversationId = uuidv7();
          const conv: Conversation = {
            id: conversationId,
            title: userText.slice(0, 60),
            provider,
            model,
            createdAt: now,
            lastMessageAt: now,
            messageCount: 0,
          };
          await db.conversations.put(conv);
          createdRef.current?.(conversationId);
          log.info('chat.send', 'new conversation', { id: conversationId.slice(0, 8) });
        }

        const userMsg: MessageRecord = {
          id: userId,
          conversationId,
          role: 'user',
          content: userText,
          createdAt: now,
        };
        await db.messages.add(userMsg);

        const history = await db.messages
          .where('[conversationId+createdAt]')
          .between([conversationId, 0], [conversationId, Date.now() + 1])
          .toArray();

        // Defensive: settings values may be undefined right after a migration.
        const settings = useSettingsStore.getState();
        const rawPersona = (settings.personaPrompt ?? '').trim();
        // When the user has visuals OFF, strip the "REGOLA CRITICA" block
        // from the persona prompt and append a counter-instruction. This
        // way the model returns plain text without trying to inject
        // image-prompt/mermaid/svg fences.
        const persona = settings.autoEnrichVisuals
          ? rawPersona
          : stripVisualsInstruction(rawPersona);
        const temperature =
          typeof settings.temperature === 'number' && Number.isFinite(settings.temperature)
            ? settings.temperature
            : 0.7;

        const messages: ChatMessage[] = [];
        if (persona) messages.push({ role: 'system', content: persona });
        for (const m of history) messages.push({ role: m.role, content: m.content });

        await db.conversations.update(conversationId, {
          lastMessageAt: now,
          messageCount: history.length,
        });

        setStatus('streaming');
        log.info('chat.stream', 'open', { provider, msgCount: messages.length });

        // We track sentence boundaries on a TTS-eligible view of the buffer:
        // fenced code blocks (image-prompt, mermaid, svg, html, …) are stripped
        // so TTS NEVER reads them aloud. `buf` keeps the full original text
        // for chat rendering / persistence.
        let ttsLastFlushIdx = 0;
        let inputTokens = 0;
        let outputTokens = 0;

        const stream = streamChat({ provider, model, messages, temperature }, ctrl.signal);
        for await (const evt of stream) {
          if (evt.type === 'delta') {
            buf += evt.text;
            setStreamingText(buf);
            const ttsView = stripFencesForTts(buf);
            const slice = ttsView.slice(ttsLastFlushIdx);
            const match = slice.match(/[.!?]\s/);
            if (match && match.index !== undefined) {
              const end = ttsLastFlushIdx + match.index + 1;
              const sentence = ttsView.slice(ttsLastFlushIdx, end).trim();
              if (sentence.length > 0) sentenceRef.current?.(sentence);
              ttsLastFlushIdx = end;
            }
          } else if (evt.type === 'done') {
            inputTokens = evt.usage?.inputTokens ?? 0;
            outputTokens = evt.usage?.outputTokens ?? 0;
          } else {
            throw new ApiError(evt.message, 500, evt.code);
          }
        }
        const ttsViewFinal = stripFencesForTts(buf);
        const tail = ttsViewFinal.slice(ttsLastFlushIdx).trim();
        if (tail.length > 0) sentenceRef.current?.(tail);

        if (!buf.trim()) {
          throw new Error('Risposta vuota dal modello');
        }

        const assistantMsg: MessageRecord = {
          id: assistantId,
          conversationId,
          role: 'assistant',
          content: buf,
          createdAt: Date.now(),
          inputTokens,
          outputTokens,
        };
        await db.messages.add(assistantMsg);
        const newCount = await db.messages.where('conversationId').equals(conversationId).count();
        await db.conversations.update(conversationId, {
          lastMessageAt: Date.now(),
          messageCount: newCount,
        });
        doneRef.current?.(buf);
        setStatus('idle');
        setStreamingText('');
        log.info('chat.send', 'done', { tokens: { inputTokens, outputTokens } });

        // Post-stream auto-enrich: if the response is meaningful AND has no
        // visual blocks yet, ask the art-director model in background to add
        // an image-prompt (and optional mermaid). Failures are silent — the
        // chat still works, the user just doesn't get auto-visuals.
        if (settings.autoEnrichVisuals !== false && buf.trim().length >= 80) {
          const hasImagePrompt = /```image[-_]?prompt\s*\n/i.test(buf);
          const hasMermaid = /```mermaid\s*\n/i.test(buf);
          if (!hasImagePrompt || !hasMermaid) {
            void enrichInBackground({
              messageId: assistantId,
              assistantText: buf,
              userPrompt: userText,
              hasImagePrompt,
              hasMermaid,
            });
          }
        }
      } catch (e) {
        if (ctrl.signal.aborted) {
          log.warn('chat.send', 'aborted by user');
          if (conversationId && buf.length > 0) {
            await db.messages.add({
              id: assistantId,
              conversationId,
              role: 'assistant',
              content: buf + ' …(interrotto)',
              createdAt: Date.now(),
            });
          }
          setStatus('idle');
          setStreamingText('');
          return;
        }
        const msg = e instanceof Error ? e.message : 'errore sconosciuto';
        log.error('chat.send', 'failed', { msg });
        setError(msg);
        setStatus('error');
      } finally {
        abortRef.current = null;
      }
    },
    [optConvId, model],
  );

  const cancel = useCallback(() => {
    if (abortRef.current && !abortRef.current.signal.aborted) {
      abortRef.current.abort();
      log.info('chat.send', 'cancel requested');
    }
  }, []);

  const retry = useCallback(async (): Promise<void> => {
    if (!lastUserText.trim()) return;
    log.info('chat.send', 'retry');
    await send(lastUserText);
  }, [lastUserText, send]);

  return { send, cancel, retry, status, error, streamingText, lastUserText };
}
