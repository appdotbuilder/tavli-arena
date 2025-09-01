import { db } from '../db';
import { gameStatesTable } from '../db/schema';
import { type GameState } from '../schema';
import { eq, desc } from 'drizzle-orm';

export const getGameState = async (matchId: number): Promise<GameState | null> => {
  try {
    // Get the most recent game state for the match
    const result = await db.select()
      .from(gameStatesTable)
      .where(eq(gameStatesTable.match_id, matchId))
      .orderBy(desc(gameStatesTable.created_at))
      .limit(1)
      .execute();

    if (result.length === 0) {
      return null;
    }

    const gameState = result[0];
    
    return {
      id: gameState.id,
      match_id: gameState.match_id,
      board_state: gameState.board_state as any, // JSONB field - already parsed
      dice: gameState.dice as [number, number], // JSONB field - already parsed as array
      available_moves: gameState.available_moves as number[], // JSONB field - already parsed
      turn_number: gameState.turn_number,
      phase: gameState.phase as 'rolling' | 'moving' | 'waiting',
      created_at: gameState.created_at
    };
  } catch (error) {
    console.error('Failed to get game state:', error);
    throw error;
  }
};