import { db } from '../db';
import { gameStatesTable } from '../db/schema';
import { type GameState, type GameVariant } from '../schema';

export const initializeGameBoard = async (matchId: number, variant: GameVariant): Promise<GameState> => {
  try {
    // Initialize empty board (26 points: 0=bar, 1-24=board points, 25=off board)
    const initialBoard = Array.from({ length: 26 }, (_, index) => ({
      point: index,
      color: null as any,
      count: 0
    }));

    // Set up initial positions based on game variant
    switch (variant) {
      case 'portes':
        // Portes (standard backgammon) starting positions
        initialBoard[1] = { point: 1, color: 'black', count: 2 };   // Black: 2 on point 1
        initialBoard[12] = { point: 12, color: 'black', count: 5 }; // Black: 5 on point 12
        initialBoard[17] = { point: 17, color: 'black', count: 3 }; // Black: 3 on point 17
        initialBoard[19] = { point: 19, color: 'black', count: 5 }; // Black: 5 on point 19
        
        initialBoard[6] = { point: 6, color: 'white', count: 5 };   // White: 5 on point 6
        initialBoard[8] = { point: 8, color: 'white', count: 3 };   // White: 3 on point 8
        initialBoard[13] = { point: 13, color: 'white', count: 5 }; // White: 5 on point 13
        initialBoard[24] = { point: 24, color: 'white', count: 2 }; // White: 2 on point 24
        break;
      
      case 'plakoto':
        // Plakoto starting positions - all checkers start on opposite ends
        initialBoard[1] = { point: 1, color: 'black', count: 15 };  // Black: all 15 on point 1
        initialBoard[24] = { point: 24, color: 'white', count: 15 }; // White: all 15 on point 24
        break;
      
      case 'fevga':
        // Fevga starting positions - all checkers start on point 24 for both players
        initialBoard[24] = { point: 24, color: 'white', count: 15 }; // White: all 15 on point 24
        initialBoard[24] = { point: 24, color: 'black', count: 15 }; // Black: all 15 on point 24
        // Note: In Fevga both players start on the same point (stacked)
        break;
      
      default:
        throw new Error(`Unknown game variant: ${variant}`);
    }

    // Insert the initial game state into database
    const result = await db.insert(gameStatesTable)
      .values({
        match_id: matchId,
        board_state: initialBoard,
        dice: [0, 0],
        available_moves: [],
        turn_number: 1,
        phase: 'rolling'
      })
      .returning()
      .execute();

    const gameState = result[0];
    return {
      ...gameState,
      board_state: gameState.board_state as any[], // Cast JSONB back to proper type
      dice: gameState.dice as number[],
      available_moves: gameState.available_moves as number[],
      phase: gameState.phase as 'rolling' | 'moving' | 'waiting'
    };
  } catch (error) {
    console.error('Game board initialization failed:', error);
    throw error;
  }
};