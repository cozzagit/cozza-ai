import { useLiveQuery } from 'dexie-react-hooks';
import { db, type Conversation } from '@/lib/db';

export function useConversations(): Conversation[] {
  return (
    useLiveQuery(async () =>
      db.conversations.orderBy('lastMessageAt').reverse().limit(50).toArray(),
    ) ?? []
  );
}
