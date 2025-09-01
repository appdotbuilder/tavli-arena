import { db } from '../db';
import { matchesTable } from '../db/schema';
import { type Match } from '../schema';
import { eq } from 'drizzle-orm';

export const getMatch = async (matchId: number): Promise<Match | null> => {
  try {
    // Query for the specific match
    const results = await db.select()
      .from(matchesTable)
      .where(eq(matchesTable.id, matchId))
      .execute();

    if (results.length === 0) {
      return null;
    }

    const match = results[0];
    
    return {
      id: match.id,
      variant: match.variant,
      mode: match.mode,
      status: match.status,
      white_player_id: match.white_player_id,
      black_player_id: match.black_player_id,
      current_player_color: match.current_player_color,
      winner_color: match.winner_color,
      created_at: match.created_at,
      updated_at: match.updated_at
    };
  } catch (error) {
    console.error('Get match failed:', error);
    throw error;
  }
};