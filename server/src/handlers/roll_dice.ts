import { db } from '../db';
import { matchesTable, gameStatesTable } from '../db/schema';
import { type RollDiceInput, type GameState } from '../schema';
import { eq, and, desc } from 'drizzle-orm';

export const rollDice = async (input: RollDiceInput): Promise<GameState> => {
  try {
    // Verify the match exists and is active
    const matches = await db.select()
      .from(matchesTable)
      .where(eq(matchesTable.id, input.match_id))
      .execute();

    if (matches.length === 0) {
      throw new Error('Match not found');
    }

    const match = matches[0];

    if (match.status !== 'active') {
      throw new Error('Match is not active');
    }

    // Verify it's the correct player's turn
    if (match.current_player_color !== input.player_color) {
      throw new Error('Not your turn');
    }

    // Get the current game state (most recent)
    const currentStates = await db.select()
      .from(gameStatesTable)
      .where(eq(gameStatesTable.match_id, input.match_id))
      .orderBy(desc(gameStatesTable.created_at))
      .limit(1)
      .execute();

    if (currentStates.length === 0) {
      throw new Error('No game state found for this match');
    }

    const currentState = currentStates[0];

    // Verify the game is in rolling phase
    if (currentState.phase !== 'rolling') {
      throw new Error('Cannot roll dice - game is not in rolling phase');
    }

    // Generate dice rolls
    const dice = [
      Math.floor(Math.random() * 6) + 1,
      Math.floor(Math.random() * 6) + 1
    ];

    // Create new game state with rolled dice
    const newGameStateResult = await db.insert(gameStatesTable)
      .values({
        match_id: input.match_id,
        board_state: currentState.board_state,
        dice: dice,
        available_moves: [], // Will be calculated by game logic later
        turn_number: currentState.turn_number,
        phase: 'moving' // Change phase to moving after rolling
      })
      .returning()
      .execute();

    const newGameState = newGameStateResult[0];

    return {
      id: newGameState.id,
      match_id: newGameState.match_id,
      board_state: newGameState.board_state as any, // JSON field
      dice: newGameState.dice as [number, number],
      available_moves: newGameState.available_moves as number[],
      turn_number: newGameState.turn_number,
      phase: newGameState.phase as 'rolling' | 'moving' | 'waiting',
      created_at: newGameState.created_at
    };
  } catch (error) {
    console.error('Roll dice failed:', error);
    throw error;
  }
};