import { db } from '../db';
import { matchesTable, gameStatesTable } from '../db/schema';
import { type JoinMatchInput, type Match } from '../schema';
import { eq, and } from 'drizzle-orm';

// Initialize backgammon board state for a new game
const initializeBoard = () => {
  const board = Array.from({ length: 26 }, (_, index) => ({
    point: index,
    color: null as 'white' | 'black' | null,
    count: 0
  }));

  // Set up initial backgammon positions
  // Point 1: 2 white pieces
  board[1] = { point: 1, color: 'white', count: 2 };
  // Point 6: 5 black pieces  
  board[6] = { point: 6, color: 'black', count: 5 };
  // Point 8: 3 black pieces
  board[8] = { point: 8, color: 'black', count: 3 };
  // Point 12: 5 white pieces
  board[12] = { point: 12, color: 'white', count: 5 };
  // Point 13: 5 black pieces
  board[13] = { point: 13, color: 'black', count: 5 };
  // Point 17: 3 white pieces
  board[17] = { point: 17, color: 'white', count: 3 };
  // Point 19: 5 white pieces
  board[19] = { point: 19, color: 'white', count: 5 };
  // Point 24: 2 black pieces
  board[24] = { point: 24, color: 'black', count: 2 };

  return board;
};

export const joinMatch = async (input: JoinMatchInput): Promise<Match> => {
  try {
    // First, verify the match exists and is waiting for a player
    const existingMatches = await db.select()
      .from(matchesTable)
      .where(
        and(
          eq(matchesTable.id, input.match_id),
          eq(matchesTable.status, 'waiting')
        )
      )
      .execute();

    if (existingMatches.length === 0) {
      throw new Error('Match not found or not available for joining');
    }

    const existingMatch = existingMatches[0];

    // Check if match already has a black player
    if (existingMatch.black_player_id !== null) {
      throw new Error('Match is already full');
    }

    // Check if the joining player is not the same as the white player
    if (existingMatch.white_player_id === input.black_player_id) {
      throw new Error('Cannot join your own match');
    }

    // Update the match with the black player and set status to active
    const updatedMatches = await db.update(matchesTable)
      .set({
        black_player_id: input.black_player_id,
        status: 'active',
        updated_at: new Date()
      })
      .where(eq(matchesTable.id, input.match_id))
      .returning()
      .execute();

    if (updatedMatches.length === 0) {
      throw new Error('Failed to update match');
    }

    const updatedMatch = updatedMatches[0];

    // Initialize the game board state
    const initialBoardState = initializeBoard();
    
    await db.insert(gameStatesTable)
      .values({
        match_id: input.match_id,
        board_state: initialBoardState, // Store as JSONB directly
        dice: [1, 1], // Store as JSONB directly
        available_moves: [], // Store as JSONB directly
        turn_number: 1,
        phase: 'rolling' // Game starts with rolling phase
      })
      .execute();

    return {
      id: updatedMatch.id,
      variant: updatedMatch.variant,
      mode: updatedMatch.mode,
      status: updatedMatch.status,
      white_player_id: updatedMatch.white_player_id,
      black_player_id: updatedMatch.black_player_id,
      current_player_color: updatedMatch.current_player_color,
      winner_color: updatedMatch.winner_color,
      created_at: updatedMatch.created_at,
      updated_at: updatedMatch.updated_at
    };
  } catch (error) {
    console.error('Join match failed:', error);
    throw error;
  }
};