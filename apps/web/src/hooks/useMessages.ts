import { useLiveQuery } from 'dexie-react-hooks';
import { db, type MessageRecord } from '@/lib/db';

export function useMessages(conversationId: string | null): MessageRecord[] {
  return (
    useLiveQuery(
      async () => {
        if (!conversationId) return [];
        return db.messages
          .where('[conversationId+createdAt]')
          .between([conversationId, 0], [conversationId, Date.now() + 1])
          .toArray();
      },
      [conversationId],
    ) ?? []
  );
}
