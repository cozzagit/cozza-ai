import { useCallback, useRef, useState } from 'react';
import { v7 as uuidv7 } from 'uuid';
import { streamChat, ApiError } from '@/lib/api';
import { db, type MessageRecord, type Conversation } from '@/lib/db';
import { PROVIDER_BY_MODEL, type ChatModel, type ChatMessage } from '@cozza/shared';
import { useSettingsStore } from '@/stores/settings';
import { log } from '@/lib/debug-log';

export type ChatStatus = 'idle' | 'streaming' | 'error';

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
        const persona = (settings.personaPrompt ?? '').trim();
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

        let lastFlushIdx = 0;
        let inputTokens = 0;
        let outputTokens = 0;

        const stream = streamChat({ provider, model, messages, temperature }, ctrl.signal);
        for await (const evt of stream) {
          if (evt.type === 'delta') {
            buf += evt.text;
            setStreamingText(buf);
            const slice = buf.slice(lastFlushIdx);
            const match = slice.match(/[.!?]\s/);
            if (match && match.index !== undefined) {
              const end = lastFlushIdx + match.index + 1;
              const sentence = buf.slice(lastFlushIdx, end).trim();
              if (sentence.length > 0) sentenceRef.current?.(sentence);
              lastFlushIdx = end;
            }
          } else if (evt.type === 'done') {
            inputTokens = evt.usage?.inputTokens ?? 0;
            outputTokens = evt.usage?.outputTokens ?? 0;
          } else {
            throw new ApiError(evt.message, 500, evt.code);
          }
        }
        const tail = buf.slice(lastFlushIdx).trim();
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
