import { db } from '../db';
import { matchesTable, usersTable } from '../db/schema';
import { type CreateMatchInput, type Match } from '../schema';
import { eq } from 'drizzle-orm';

export const createMatch = async (input: CreateMatchInput): Promise<Match> => {
  try {
    // Verify the white player exists first to prevent foreign key constraint violation
    const whitePlayer = await db.select()
      .from(usersTable)
      .where(eq(usersTable.id, input.white_player_id))
      .execute();

    if (whitePlayer.length === 0) {
      throw new Error(`User with id ${input.white_player_id} does not exist`);
    }

    // Insert match record
    const result = await db.insert(matchesTable)
      .values({
        variant: input.variant,
        mode: input.mode,
        white_player_id: input.white_player_id,
        status: 'waiting',
        current_player_color: 'white',
        black_player_id: null,
        winner_color: null
      })
      .returning()
      .execute();

    return result[0];
  } catch (error) {
    console.error('Match creation failed:', error);
    throw error;
  }
};