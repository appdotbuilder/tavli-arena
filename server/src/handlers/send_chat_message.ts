import { db } from '../db';
import { chatMessagesTable, matchesTable, usersTable } from '../db/schema';
import { type SendMessageInput, type ChatMessage } from '../schema';
import { eq, and } from 'drizzle-orm';

export const sendChatMessage = async (input: SendMessageInput): Promise<ChatMessage> => {
  try {
    // Validate that the match exists
    const matchExists = await db.select({ id: matchesTable.id })
      .from(matchesTable)
      .where(eq(matchesTable.id, input.match_id))
      .execute();

    if (matchExists.length === 0) {
      throw new Error(`Match with id ${input.match_id} not found`);
    }

    // Validate that the user exists
    const userExists = await db.select({ id: usersTable.id })
      .from(usersTable)
      .where(eq(usersTable.id, input.user_id))
      .execute();

    if (userExists.length === 0) {
      throw new Error(`User with id ${input.user_id} not found`);
    }

    // Validate that the user is a participant in the match
    const matchParticipation = await db.select()
      .from(matchesTable)
      .where(
        and(
          eq(matchesTable.id, input.match_id),
          eq(matchesTable.white_player_id, input.user_id)
        )
      )
      .execute();

    const blackPlayerParticipation = await db.select()
      .from(matchesTable)
      .where(
        and(
          eq(matchesTable.id, input.match_id),
          eq(matchesTable.black_player_id, input.user_id)
        )
      )
      .execute();

    if (matchParticipation.length === 0 && blackPlayerParticipation.length === 0) {
      throw new Error(`User ${input.user_id} is not a participant in match ${input.match_id}`);
    }

    // Insert the chat message
    const result = await db.insert(chatMessagesTable)
      .values({
        match_id: input.match_id,
        user_id: input.user_id,
        message: input.message
      })
      .returning()
      .execute();

    return result[0];
  } catch (error) {
    console.error('Chat message creation failed:', error);
    throw error;
  }
};