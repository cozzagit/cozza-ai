import { useLiveQuery } from 'dexie-react-hooks';
import { db, type MessageRecord } from '@/lib/db';

/**
 * Use `Number.MAX_SAFE_INTEGER` (not Date.now()+1) as upper bound so
 * messages added AFTER the live query was created are still picked up.
 * Otherwise Dexie's liveQuery freezes the bound at first invocation
 * and new assistant replies disappear from the list until the user
 * switches conversation.
 */
export function useMessages(conversationId: string | null): MessageRecord[] {
  return (
    useLiveQuery(async () => {
      if (!conversationId) return [];
      return db.messages
        .where('[conversationId+createdAt]')
        .between([conversationId, 0], [conversationId, Number.MAX_SAFE_INTEGER])
        .toArray();
    }, [conversationId]) ?? []
  );
}
