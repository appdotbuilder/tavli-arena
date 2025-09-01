import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { type GameState, type GameVariant, type BoardPoint } from '../schema';
import { makeAiMove } from '../handlers/make_ai_move';

// Helper function to create test board state
function createBoardState(points: Partial<BoardPoint>[] = []): BoardPoint[] {
  // Initialize empty board with 26 points (0-25)
  const board: BoardPoint[] = [];
  for (let i = 0; i <= 25; i++) {
    board.push({
      point: i,
      color: null,
      count: 0
    });
  }
  
  // Apply custom points
  points.forEach(point => {
    if (point.point !== undefined) {
      board[point.point] = {
        point: point.point,
        color: point.color || null,
        count: point.count || 0
      };
    }
  });
  
  return board;
}

// Test game state with basic setup
const createTestGameState = (
  boardPoints: Partial<BoardPoint>[] = [],
  dice: [number, number] = [6, 4]
): GameState => ({
  id: 1,
  match_id: 1,
  board_state: createBoardState(boardPoints),
  dice,
  available_moves: [],
  turn_number: 1,
  phase: 'moving',
  created_at: new Date()
});

describe('makeAiMove', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  it('should return null when no moves are available', async () => {
    const gameState = createTestGameState([
      // AI pieces completely blocked
      { point: 24, color: 'black', count: 2 },
      // White pieces blocking
      { point: 18, color: 'white', count: 6 },
      { point: 20, color: 'white', count: 6 }
    ], [6, 4]);

    const result = await makeAiMove(gameState, 'portes', 1);

    expect(result).toBeNull();
  });

  it('should generate a move when moves are available', async () => {
    const gameState = createTestGameState([
      // AI pieces that can move
      { point: 13, color: 'black', count: 2 },
      { point: 8, color: 'black', count: 3 }
    ], [5, 3]);

    const result = await makeAiMove(gameState, 'portes', 1);

    expect(result).not.toBeNull();
    expect(result?.match_id).toBe(1);
    expect(result?.player_color).toBe('black');
    expect(result?.turn_number).toBe(1);
    expect(result?.created_at).toBeInstanceOf(Date);
    expect([1, 2, 3, 4, 5, 6]).toContain(result?.dice_value);
  });

  it('should prefer hitting opponent blots', async () => {
    const gameState = createTestGameState([
      // AI piece that can hit
      { point: 13, color: 'black', count: 2 },
      // Opponent blot (single piece)
      { point: 8, color: 'white', count: 1 },
      // Regular empty point
      { point: 10, color: null, count: 0 }
    ], [5, 3]);

    const result = await makeAiMove(gameState, 'portes', 1);

    expect(result).not.toBeNull();
    // Should prefer hitting the blot on point 8 with dice value 5
    expect(result?.from_point).toBe(13);
    expect(result?.to_point).toBe(8);
    expect(result?.dice_value).toBe(5);
    expect(result?.move_type).toBe('nail');
  });

  it('should handle entering from bar', async () => {
    const gameState = createTestGameState([
      // AI piece on bar
      { point: 0, color: 'black', count: 1 },
      // Some opponent pieces
      { point: 22, color: 'white', count: 3 },
      // Open entry points
      { point: 19, color: null, count: 0 },
      { point: 21, color: null, count: 0 }
    ], [6, 4]);

    const result = await makeAiMove(gameState, 'portes', 1);

    expect(result).not.toBeNull();
    expect(result?.from_point).toBe(0); // From bar
    expect([19, 21]).toContain(result?.to_point); // Should enter to point 19 or 21
    expect(result?.move_type).toBe('enter_from_bar');
  });

  it('should handle bear off moves when all pieces are home', async () => {
    const gameState = createTestGameState([
      // All AI pieces in home board (points 1-6 for black)
      { point: 6, color: 'black', count: 3 },
      { point: 5, color: 'black', count: 4 },
      { point: 4, color: 'black', count: 2 },
      { point: 3, color: 'black', count: 3 },
      { point: 2, color: 'black', count: 2 },
      { point: 1, color: 'black', count: 1 }
    ], [6, 4]);

    const result = await makeAiMove(gameState, 'portes', 1);

    expect(result).not.toBeNull();
    expect([1, 2, 3, 4, 5, 6]).toContain(result?.from_point);
    expect(result?.to_point).toBe(0); // Bear off to point 0
    expect(result?.move_type).toBe('bear_off');
  });

  it('should handle exact bear off', async () => {
    const gameState = createTestGameState([
      // Piece on exact point for bear off
      { point: 4, color: 'black', count: 2 },
      { point: 3, color: 'black', count: 3 },
      { point: 2, color: 'black', count: 4 }
    ], [4, 2]);

    const result = await makeAiMove(gameState, 'portes', 1);

    expect(result).not.toBeNull();
    if (result) {
      if (result.dice_value === 4) {
        expect(result.from_point).toBe(4);
      } else {
        expect(result.from_point).toBe(2);
      }
      expect(result.to_point).toBe(0);
      expect(result.move_type).toBe('bear_off');
    }
  });

  it('should handle bear off from highest point when no exact match', async () => {
    const gameState = createTestGameState([
      // No piece on point 6, but pieces on lower points
      { point: 4, color: 'black', count: 2 },
      { point: 3, color: 'black', count: 3 },
      { point: 1, color: 'black', count: 2 }
    ], [6, 5]);

    const result = await makeAiMove(gameState, 'portes', 1);

    expect(result).not.toBeNull();
    if (result) {
      // Should bear off from highest point (4) when rolling higher than available points
      if (result.dice_value === 6) {
        expect(result.from_point).toBe(4);
      }
      expect(result.move_type).toBe('bear_off');
    }
  });

  it('should work with different game variants', async () => {
    const gameState = createTestGameState([
      { point: 13, color: 'black', count: 2 }
    ], [5, 3]);

    const portesResult = await makeAiMove(gameState, 'portes', 1);
    const plakotoResult = await makeAiMove(gameState, 'plakoto', 2);
    const fevgaResult = await makeAiMove(gameState, 'fevga', 3);

    expect(portesResult).not.toBeNull();
    expect(plakotoResult).not.toBeNull();
    expect(fevgaResult).not.toBeNull();

    // Each should have correct match_id
    expect(portesResult?.match_id).toBe(1);
    expect(plakotoResult?.match_id).toBe(2);
    expect(fevgaResult?.match_id).toBe(3);
  });

  it('should handle blocked moves correctly', async () => {
    const gameState = createTestGameState([
      // AI piece
      { point: 20, color: 'black', count: 1 },
      // Opponent blocking destination points
      { point: 15, color: 'white', count: 6 }, // blocks dice 5
      { point: 17, color: 'white', count: 6 }  // blocks dice 3
    ], [5, 3]);

    const result = await makeAiMove(gameState, 'portes', 1);

    // Should return null since all moves are blocked
    expect(result).toBeNull();
  });

  it('should prefer making points over single moves', async () => {
    const gameState = createTestGameState([
      // AI pieces
      { point: 13, color: 'black', count: 1 },
      { point: 8, color: 'black', count: 1 }, // Can make point with another piece
      { point: 11, color: 'black', count: 1 },
      // Empty destination
      { point: 8, color: null, count: 0 }
    ], [5, 3]);

    const result = await makeAiMove(gameState, 'portes', 1);

    expect(result).not.toBeNull();
    // Should prefer making a point when possible
    expect(result?.move_type).toBe('move');
  });

  it('should handle dice doubles correctly', async () => {
    const gameState = createTestGameState([
      // AI pieces that can move
      { point: 13, color: 'black', count: 4 },
      { point: 8, color: 'black', count: 2 }
    ], [4, 4]); // Double 4s

    const result = await makeAiMove(gameState, 'portes', 1);

    expect(result).not.toBeNull();
    expect(result?.dice_value).toBe(4);
    expect(result?.from_point).toBeGreaterThan(0);
    expect(result?.to_point).toBeGreaterThan(0);
  });

  it('should handle error cases gracefully', async () => {
    const invalidGameState = createTestGameState();
    invalidGameState.board_state = []; // Invalid empty board

    try {
      const result = await makeAiMove(invalidGameState, 'portes', 1);
      expect(result).toBeNull();
    } catch (error) {
      expect(error).toBeDefined();
    }
  });

  it('should set correct turn number from game state', async () => {
    const gameState = createTestGameState([
      { point: 13, color: 'black', count: 2 }
    ], [6, 4]);
    gameState.turn_number = 5;

    const result = await makeAiMove(gameState, 'portes', 1);

    expect(result).not.toBeNull();
    expect(result?.turn_number).toBe(5);
  });

  it('should evaluate moves and select best one', async () => {
    const gameState = createTestGameState([
      // AI piece that can hit opponent blot (high value move)
      { point: 13, color: 'black', count: 1 },
      // Opponent blot
      { point: 8, color: 'white', count: 1 },
      // AI piece that can make safe move (lower value)
      { point: 20, color: 'black', count: 1 },
      // Safe destination
      { point: 17, color: null, count: 0 }
    ], [5, 3]);

    const result = await makeAiMove(gameState, 'portes', 1);

    expect(result).not.toBeNull();
    // Should prefer the hitting move over the safe move
    expect(result?.from_point).toBe(13);
    expect(result?.to_point).toBe(8);
    expect(result?.move_type).toBe('nail');
  });
});