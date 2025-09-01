import { db } from '../db';
import { chatMessagesTable } from '../db/schema';
import { type ChatMessage } from '../schema';
import { eq, asc } from 'drizzle-orm';

export const getChatMessages = async (matchId: number): Promise<ChatMessage[]> => {
  try {
    const messages = await db.select()
      .from(chatMessagesTable)
      .where(eq(chatMessagesTable.match_id, matchId))
      .orderBy(asc(chatMessagesTable.created_at))
      .execute();

    return messages;
  } catch (error) {
    console.error('Failed to fetch chat messages:', error);
    throw error;
  }
};