import { db } from '../db';
import { movesTable } from '../db/schema';
import { type Move } from '../schema';
import { eq, asc } from 'drizzle-orm';

export const getMoves = async (matchId: number): Promise<Move[]> => {
  try {
    // Fetch all moves for the specified match
    // Order by turn_number first, then by created_at for proper chronological order
    const results = await db.select()
      .from(movesTable)
      .where(eq(movesTable.match_id, matchId))
      .orderBy(asc(movesTable.turn_number), asc(movesTable.created_at))
      .execute();

    return results;
  } catch (error) {
    console.error('Failed to fetch moves:', error);
    throw error;
  }
};