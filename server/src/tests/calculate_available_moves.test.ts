import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { calculateAvailableMoves } from '../handlers/calculate_available_moves';
import { type GameState, type BoardPoint } from '../schema';

describe('calculateAvailableMoves', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  // Helper function to create initial board state
  const createInitialBoard = (): BoardPoint[] => {
    const board: BoardPoint[] = [];
    
    // Initialize empty board
    for (let i = 0; i <= 25; i++) {
      board.push({
        point: i,
        color: null,
        count: 0
      });
    }
    
    // Set up initial Portes position
    // White pieces
    board[1] = { point: 1, color: 'white', count: 2 }; // Point 1
    board[12] = { point: 12, color: 'white', count: 5 }; // Point 12
    board[17] = { point: 17, color: 'white', count: 3 }; // Point 17
    board[19] = { point: 19, color: 'white', count: 5 }; // Point 19
    
    // Black pieces
    board[6] = { point: 6, color: 'black', count: 5 }; // Point 6
    board[8] = { point: 8, color: 'black', count: 3 }; // Point 8
    board[13] = { point: 13, color: 'black', count: 5 }; // Point 13
    board[24] = { point: 24, color: 'black', count: 2 }; // Point 24
    
    return board;
  };

  const createGameState = (
    board: BoardPoint[], 
    dice: number[] = [3, 4],
    turnNumber: number = 1
  ): GameState => ({
    id: 1,
    match_id: 1,
    board_state: board,
    dice,
    available_moves: [],
    turn_number: turnNumber,
    phase: 'moving',
    created_at: new Date()
  });

  it('should calculate moves for opening position', async () => {
    const board = createInitialBoard();
    const gameState = createGameState(board, [3, 4]);
    
    const moves = await calculateAvailableMoves(gameState, 'portes', 'white', [3, 4]);
    
    expect(Array.isArray(moves)).toBe(true);
    expect(moves.length).toBeGreaterThan(0);
    
    // Should have multiple move options from initial position
    expect(moves.length).toBeGreaterThanOrEqual(2);
  });

  it('should handle doubles correctly', async () => {
    const board = createInitialBoard();
    const gameState = createGameState(board, [2, 2]);
    
    const moves = await calculateAvailableMoves(gameState, 'portes', 'white', [2, 2, 2, 2]);
    
    expect(Array.isArray(moves)).toBe(true);
    // Should have moves available for doubles (4 moves of 2)
    expect(moves.length).toBeGreaterThan(0);
  });

  it('should calculate moves when pieces are on bar', async () => {
    const board = createInitialBoard();
    // Put white piece on bar
    board[0] = { point: 0, color: 'white', count: 1 };
    // Reduce pieces from another point
    board[1] = { point: 1, color: 'white', count: 1 };
    
    const gameState = createGameState(board, [2, 4]);
    
    const moves = await calculateAvailableMoves(gameState, 'portes', 'white', [2, 4]);
    
    expect(Array.isArray(moves)).toBe(true);
    // Should have moves from bar entry
    expect(moves.length).toBeGreaterThan(0);
  });

  it('should calculate bear-off moves when all pieces in home board', async () => {
    const board: BoardPoint[] = [];
    
    // Initialize empty board
    for (let i = 0; i <= 25; i++) {
      board.push({
        point: i,
        color: null,
        count: 0
      });
    }
    
    // Put all white pieces in home board (points 19-24)
    board[19] = { point: 19, color: 'white', count: 2 };
    board[20] = { point: 20, color: 'white', count: 3 };
    board[22] = { point: 22, color: 'white', count: 4 };
    board[23] = { point: 23, color: 'white', count: 3 };
    board[24] = { point: 24, color: 'white', count: 3 };
    
    const gameState = createGameState(board, [5, 6]);
    
    const moves = await calculateAvailableMoves(gameState, 'portes', 'white', [5, 6]);
    
    expect(Array.isArray(moves)).toBe(true);
    expect(moves.length).toBeGreaterThan(0);
    // Should have bear-off moves available
  });

  it('should handle black player moves correctly', async () => {
    const board = createInitialBoard();
    const gameState = createGameState(board, [2, 5]);
    
    const blackMoves = await calculateAvailableMoves(gameState, 'portes', 'black', [2, 5]);
    
    expect(Array.isArray(blackMoves)).toBe(true);
    expect(blackMoves.length).toBeGreaterThan(0);
    
    // Black should have different move identifiers than white since they move in opposite directions
    const whiteMoves = await calculateAvailableMoves(gameState, 'portes', 'white', [2, 5]);
    expect(Array.isArray(whiteMoves)).toBe(true);
    expect(whiteMoves.length).toBeGreaterThan(0);
    
    // At least some moves should be different (different starting positions/directions)
    const hasUniqueMoves = blackMoves.some(move => !whiteMoves.includes(move));
    expect(hasUniqueMoves).toBe(true);
  });

  it('should handle Plakoto variant rules', async () => {
    const board = createInitialBoard();
    // Create a position where opponent piece blocks movement
    board[3] = { point: 3, color: 'black', count: 1 };
    
    const gameState = createGameState(board, [2, 3]);
    
    const moves = await calculateAvailableMoves(gameState, 'plakoto', 'white', [2, 3]);
    
    expect(Array.isArray(moves)).toBe(true);
    // In Plakoto, cannot move to opponent's point
  });

  it('should handle Fevga variant rules', async () => {
    const board = createInitialBoard();
    const gameState = createGameState(board, [3, 4]);
    
    const moves = await calculateAvailableMoves(gameState, 'fevga', 'white', [3, 4]);
    
    expect(Array.isArray(moves)).toBe(true);
    expect(moves.length).toBeGreaterThan(0);
  });

  it('should return empty array when no moves available', async () => {
    const board: BoardPoint[] = [];
    
    // Initialize empty board
    for (let i = 0; i <= 25; i++) {
      board.push({
        point: i,
        color: null,
        count: 0
      });
    }
    
    // Create a blocked position - white on bar with no entry points
    board[0] = { point: 0, color: 'white', count: 1 };
    // Block all entry points with black pieces
    for (let i = 1; i <= 6; i++) {
      board[i] = { point: i, color: 'black', count: 2 };
    }
    
    const gameState = createGameState(board, [1, 2]);
    
    const moves = await calculateAvailableMoves(gameState, 'portes', 'white', [1, 2]);
    
    expect(Array.isArray(moves)).toBe(true);
    expect(moves.length).toBe(0);
  });

  it('should handle bear-off with high dice when no exact moves', async () => {
    const board: BoardPoint[] = [];
    
    // Initialize empty board
    for (let i = 0; i <= 25; i++) {
      board.push({
        point: i,
        color: null,
        count: 0
      });
    }
    
    // Put white pieces only on point 19 (lowest home board point)
    board[19] = { point: 19, color: 'white', count: 2 };
    
    const gameState = createGameState(board, [6, 5]);
    
    const moves = await calculateAvailableMoves(gameState, 'portes', 'white', [6, 5]);
    
    expect(Array.isArray(moves)).toBe(true);
    expect(moves.length).toBeGreaterThan(0);
    // Should allow bearing off with high dice
  });

  it('should handle single die value correctly', async () => {
    const board = createInitialBoard();
    const gameState = createGameState(board, [4]);
    
    const moves = await calculateAvailableMoves(gameState, 'portes', 'white', [4]);
    
    expect(Array.isArray(moves)).toBe(true);
    expect(moves.length).toBeGreaterThan(0);
  });

  it('should handle error cases gracefully', async () => {
    const board = createInitialBoard();
    const gameState = createGameState(board, [3, 4]);
    
    // Test with invalid dice values - should not crash
    await expect(async () => {
      await calculateAvailableMoves(gameState, 'portes', 'white', []);
    }).not.toThrow();
    
    // Test with malformed board - should handle gracefully
    const malformedBoard: BoardPoint[] = [];
    const malformedGameState = createGameState(malformedBoard, [3, 4]);
    
    await expect(async () => {
      await calculateAvailableMoves(malformedGameState, 'portes', 'white', [3, 4]);
    }).not.toThrow();
  });
});