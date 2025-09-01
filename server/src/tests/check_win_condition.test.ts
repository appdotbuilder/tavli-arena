import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { type GameState, type BoardPoint } from '../schema';
import { checkWinCondition } from '../handlers/check_win_condition';

// Helper function to create empty board state
const createEmptyBoard = (): BoardPoint[] => {
  return Array.from({ length: 26 }, (_, i) => ({
    point: i,
    color: null,
    count: 0
  }));
};

// Helper function to create standard starting position for Portes/Backgammon
const createStartingPosition = (): BoardPoint[] => {
  const board = createEmptyBoard();
  
  // White pieces starting position
  board[1] = { point: 1, color: 'white', count: 2 };   // 2 pieces on point 1
  board[12] = { point: 12, color: 'white', count: 5 }; // 5 pieces on point 12
  board[17] = { point: 17, color: 'white', count: 3 }; // 3 pieces on point 17
  board[19] = { point: 19, color: 'white', count: 5 }; // 5 pieces on point 19
  
  // Black pieces starting position
  board[24] = { point: 24, color: 'black', count: 2 }; // 2 pieces on point 24
  board[13] = { point: 13, color: 'black', count: 5 }; // 5 pieces on point 13
  board[8] = { point: 8, color: 'black', count: 3 };   // 3 pieces on point 8
  board[6] = { point: 6, color: 'black', count: 5 };   // 5 pieces on point 6
  
  return board;
};

// Test game state with all pieces borne off for white
const createWhiteWinBoard = (): BoardPoint[] => {
  const board = createEmptyBoard();
  // White has no pieces on board (all on point 25 - off board)
  
  // Black still has pieces on board
  board[6] = { point: 6, color: 'black', count: 2 };
  board[8] = { point: 8, color: 'black', count: 3 };
  
  return board;
};

// Test game state for Plakoto special win condition
const createPlakotoSpecialWinBoard = (): BoardPoint[] => {
  const board = createEmptyBoard();
  
  // Black piece on bar (captured)
  board[0] = { point: 0, color: 'black', count: 1 };
  
  // White controls black's mother point (point 24) with 2+ pieces
  board[24] = { point: 24, color: 'white', count: 2 };
  
  // Both players have remaining pieces on board
  board[6] = { point: 6, color: 'white', count: 5 };
  board[13] = { point: 13, color: 'black', count: 5 };
  
  return board;
};

const createTestGameState = (boardState: BoardPoint[]): GameState => ({
  id: 1,
  match_id: 1,
  board_state: boardState,
  dice: [3, 4],
  available_moves: [],
  turn_number: 10,
  phase: 'moving' as const,
  created_at: new Date()
});

describe('checkWinCondition', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  describe('Portes variant', () => {
    it('should return null when game is ongoing', async () => {
      const gameState = createTestGameState(createStartingPosition());
      const result = await checkWinCondition(gameState, 'portes');
      expect(result).toBeNull();
    });

    it('should return white when white has borne off all pieces', async () => {
      const gameState = createTestGameState(createWhiteWinBoard());
      const result = await checkWinCondition(gameState, 'portes');
      expect(result).toEqual('white');
    });

    it('should return black when black has borne off all pieces', async () => {
      const board = createEmptyBoard();
      // Black has no pieces on board
      // White still has pieces
      board[1] = { point: 1, color: 'white', count: 3 };
      
      const gameState = createTestGameState(board);
      const result = await checkWinCondition(gameState, 'portes');
      expect(result).toEqual('black');
    });

    it('should handle pieces on bar correctly', async () => {
      const board = createEmptyBoard();
      // White has piece on bar (not borne off)
      board[0] = { point: 0, color: 'white', count: 1 };
      // Black also has pieces to make it a valid ongoing game
      board[13] = { point: 13, color: 'black', count: 2 };
      
      const gameState = createTestGameState(board);
      const result = await checkWinCondition(gameState, 'portes');
      expect(result).toBeNull(); // Game continues
    });
  });

  describe('Plakoto variant', () => {
    it('should return null when game is ongoing', async () => {
      const gameState = createTestGameState(createStartingPosition());
      const result = await checkWinCondition(gameState, 'plakoto');
      expect(result).toBeNull();
    });

    it('should return white when white has borne off all pieces', async () => {
      const gameState = createTestGameState(createWhiteWinBoard());
      const result = await checkWinCondition(gameState, 'plakoto');
      expect(result).toEqual('white');
    });

    it('should return white with special Plakoto rule - blocking black mother point', async () => {
      const gameState = createTestGameState(createPlakotoSpecialWinBoard());
      const result = await checkWinCondition(gameState, 'plakoto');
      expect(result).toEqual('white');
    });

    it('should return black with special Plakoto rule - blocking white mother point', async () => {
      const board = createEmptyBoard();
      
      // White piece on bar
      board[0] = { point: 0, color: 'white', count: 1 };
      
      // Black controls white's mother point (point 1) with 2+ pieces
      board[1] = { point: 1, color: 'black', count: 2 };
      
      // Both players have remaining pieces on board
      board[6] = { point: 6, color: 'white', count: 5 };
      board[13] = { point: 13, color: 'black', count: 5 };
      
      const gameState = createTestGameState(board);
      const result = await checkWinCondition(gameState, 'plakoto');
      expect(result).toEqual('black');
    });

    it('should not trigger special win if opponent not on bar', async () => {
      const board = createEmptyBoard();
      
      // No pieces on bar
      board[0] = { point: 0, color: null, count: 0 };
      
      // White controls black's mother point but black not on bar
      board[24] = { point: 24, color: 'white', count: 2 };
      board[6] = { point: 6, color: 'white', count: 5 };
      board[13] = { point: 13, color: 'black', count: 5 };
      
      const gameState = createTestGameState(board);
      const result = await checkWinCondition(gameState, 'plakoto');
      expect(result).toBeNull();
    });

    it('should not trigger special win if blocking with only one piece', async () => {
      const board = createEmptyBoard();
      
      // Black piece on bar
      board[0] = { point: 0, color: 'black', count: 1 };
      
      // White controls black's mother point with only 1 piece (need 2+)
      board[24] = { point: 24, color: 'white', count: 1 };
      board[6] = { point: 6, color: 'white', count: 5 };
      board[13] = { point: 13, color: 'black', count: 5 };
      
      const gameState = createTestGameState(board);
      const result = await checkWinCondition(gameState, 'plakoto');
      expect(result).toBeNull();
    });
  });

  describe('Fevga variant', () => {
    it('should return null when game is ongoing', async () => {
      const gameState = createTestGameState(createStartingPosition());
      const result = await checkWinCondition(gameState, 'fevga');
      expect(result).toBeNull();
    });

    it('should return white when white has borne off all pieces', async () => {
      const gameState = createTestGameState(createWhiteWinBoard());
      const result = await checkWinCondition(gameState, 'fevga');
      expect(result).toEqual('white');
    });

    it('should return black when black has borne off all pieces', async () => {
      const board = createEmptyBoard();
      // Black has no pieces on board
      // White still has pieces
      board[1] = { point: 1, color: 'white', count: 3 };
      
      const gameState = createTestGameState(board);
      const result = await checkWinCondition(gameState, 'fevga');
      expect(result).toEqual('black');
    });
  });

  describe('Edge cases', () => {
    it('should handle empty board state', async () => {
      const gameState = createTestGameState(createEmptyBoard());
      const result = await checkWinCondition(gameState, 'portes');
      // Both players have 0 pieces, but this would be invalid game state
      // White wins by default (no pieces left)
      expect(result).toEqual('white');
    });

    it('should handle mixed pieces on same point', async () => {
      const board = createEmptyBoard();
      // Only white pieces remain (black has 0)
      board[1] = { point: 1, color: 'white', count: 2 };
      
      const gameState = createTestGameState(board);
      const result = await checkWinCondition(gameState, 'portes');
      expect(result).toEqual('black'); // Black wins (has no pieces left)
    });

    it('should count all pieces correctly across multiple points', async () => {
      const board = createEmptyBoard();
      
      // White has pieces scattered across board
      board[1] = { point: 1, color: 'white', count: 1 };
      board[5] = { point: 5, color: 'white', count: 1 };
      board[10] = { point: 10, color: 'white', count: 1 };
      board[0] = { point: 0, color: 'white', count: 1 }; // On bar
      
      // Black has no pieces
      
      const gameState = createTestGameState(board);
      const result = await checkWinCondition(gameState, 'portes');
      expect(result).toEqual('black'); // Black wins (no pieces left)
    });
  });
});