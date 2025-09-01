import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { type MakeMoveInput, type GameState, type BoardPoint } from '../schema';
import { validateMove } from '../handlers/validate_move';

// Helper to create a basic board state
const createBasicBoardState = (): BoardPoint[] => {
  const board: BoardPoint[] = [];
  
  // Initialize all points as empty
  for (let i = 0; i <= 25; i++) {
    board.push({ point: i, color: null, count: 0 });
  }

  // Set up initial backgammon position
  board[1] = { point: 1, color: 'black', count: 2 };   // Black's 1-point
  board[6] = { point: 6, color: 'white', count: 5 };   // White's 6-point
  board[8] = { point: 8, color: 'white', count: 3 };   // White's 8-point
  board[12] = { point: 12, color: 'black', count: 5 }; // Black's 12-point
  board[13] = { point: 13, color: 'white', count: 5 }; // White's 13-point
  board[17] = { point: 17, color: 'black', count: 3 }; // Black's 17-point
  board[19] = { point: 19, color: 'black', count: 5 }; // Black's 19-point
  board[24] = { point: 24, color: 'white', count: 2 }; // White's 24-point

  return board;
};

const createTestGameState = (boardState?: BoardPoint[]): GameState => ({
  id: 1,
  match_id: 1,
  board_state: boardState || createBasicBoardState(),
  dice: [3, 5],
  available_moves: [3, 5],
  turn_number: 1,
  phase: 'moving',
  created_at: new Date()
});

const createTestMoveInput = (overrides?: Partial<MakeMoveInput>): MakeMoveInput => ({
  match_id: 1,
  player_color: 'white',
  from_point: 13,
  to_point: 18,
  dice_value: 5,
  ...overrides
});

describe('validateMove', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  describe('Basic validation', () => {
    it('should validate a legal move', async () => {
      const gameState = createTestGameState();
      const input = createTestMoveInput();

      const result = await validateMove(input, gameState, 'portes');
      expect(result).toBe(true);
    });

    it('should reject move with unavailable dice value', async () => {
      const gameState = createTestGameState();
      gameState.dice = [2, 4];
      const input = createTestMoveInput({ dice_value: 6 });

      const result = await validateMove(input, gameState, 'portes');
      expect(result).toBe(false);
    });

    it('should reject move from empty point', async () => {
      const gameState = createTestGameState();
      const input = createTestMoveInput({ from_point: 7 }); // Empty point

      const result = await validateMove(input, gameState, 'portes');
      expect(result).toBe(false);
    });

    it('should reject move from opponent piece', async () => {
      const gameState = createTestGameState();
      const input = createTestMoveInput({ 
        from_point: 1, // Black piece
        to_point: 4
      });

      const result = await validateMove(input, gameState, 'portes');
      expect(result).toBe(false);
    });

    it('should reject move to blocked point', async () => {
      const board = createBasicBoardState();
      board[18] = { point: 18, color: 'black', count: 2 }; // Block destination
      
      const gameState = createTestGameState(board);
      const input = createTestMoveInput();

      const result = await validateMove(input, gameState, 'portes');
      expect(result).toBe(false);
    });

    it('should allow move to point with single opponent piece', async () => {
      const board = createBasicBoardState();
      board[18] = { point: 18, color: 'black', count: 1 }; // Single black piece
      
      const gameState = createTestGameState(board);
      const input = createTestMoveInput();

      const result = await validateMove(input, gameState, 'portes');
      expect(result).toBe(true);
    });
  });

  describe('Bar entry validation', () => {
    it('should require entering from bar when pieces are on bar', async () => {
      const board = createBasicBoardState();
      board[0] = { point: 0, color: 'white', count: 1 }; // White piece on bar
      
      const gameState = createTestGameState(board);
      const input = createTestMoveInput(); // Not from bar

      const result = await validateMove(input, gameState, 'portes');
      expect(result).toBe(false);
    });

    it('should validate entering from bar', async () => {
      const board = createBasicBoardState();
      board[0] = { point: 0, color: 'white', count: 1 }; // White piece on bar
      
      const gameState = createTestGameState(board);
      const input = createTestMoveInput({
        from_point: 0,
        to_point: 3,
        dice_value: 3
      });

      const result = await validateMove(input, gameState, 'portes');
      expect(result).toBe(true);
    });

    it('should reject bar entry to blocked point', async () => {
      const board = createBasicBoardState();
      board[0] = { point: 0, color: 'white', count: 1 }; // White piece on bar
      board[3] = { point: 3, color: 'black', count: 2 }; // Blocked entry point
      
      const gameState = createTestGameState(board);
      const input = createTestMoveInput({
        from_point: 0,
        to_point: 3,
        dice_value: 3
      });

      const result = await validateMove(input, gameState, 'portes');
      expect(result).toBe(false);
    });
  });

  describe('Bearing off validation', () => {
    it('should allow bearing off when all pieces in home board', async () => {
      const board: BoardPoint[] = [];
      for (let i = 0; i <= 25; i++) {
        board.push({ point: i, color: null, count: 0 });
      }
      
      // All white pieces in home board
      board[19] = { point: 19, color: 'white', count: 2 };
      board[20] = { point: 20, color: 'white', count: 3 };
      board[22] = { point: 22, color: 'white', count: 2 };
      
      const gameState = createTestGameState(board);
      const input = createTestMoveInput({
        from_point: 22,
        to_point: 25, // Bear off
        dice_value: 3
      });

      const result = await validateMove(input, gameState, 'portes');
      expect(result).toBe(true);
    });

    it('should reject bearing off with pieces outside home board', async () => {
      const board = createBasicBoardState(); // Has pieces outside home board
      
      const gameState = createTestGameState(board);
      const input = createTestMoveInput({
        from_point: 24,
        to_point: 25,
        dice_value: 1
      });

      const result = await validateMove(input, gameState, 'portes');
      expect(result).toBe(false);
    });

    it('should allow over-bearing from furthest point', async () => {
      const board: BoardPoint[] = [];
      for (let i = 0; i <= 25; i++) {
        board.push({ point: i, color: null, count: 0 });
      }
      
      // White pieces only in home board, furthest at point 20
      board[20] = { point: 20, color: 'white', count: 1 };
      board[23] = { point: 23, color: 'white', count: 2 };
      
      const gameState = createTestGameState(board);
      gameState.dice = [6, 4];
      gameState.available_moves = [6, 4];
      const input = createTestMoveInput({
        from_point: 20,
        to_point: 25,
        dice_value: 6 // Over-bearing (need 5 but rolled 6)
      });

      const result = await validateMove(input, gameState, 'portes');
      expect(result).toBe(true);
    });
  });

  describe('Variant-specific rules', () => {
    describe('Portes (standard backgammon)', () => {
      it('should allow hitting opponent pieces', async () => {
        const board = createBasicBoardState();
        board[18] = { point: 18, color: 'black', count: 1 };
        
        const gameState = createTestGameState(board);
        const input = createTestMoveInput();

        const result = await validateMove(input, gameState, 'portes');
        expect(result).toBe(true);
      });
    });

    describe('Plakoto', () => {
      it('should not allow moving to point with opponent piece', async () => {
        const board = createBasicBoardState();
        board[18] = { point: 18, color: 'black', count: 1 };
        
        const gameState = createTestGameState(board);
        const input = createTestMoveInput();

        const result = await validateMove(input, gameState, 'plakoto');
        expect(result).toBe(false);
      });

      it('should allow moving to empty point', async () => {
        const board = createBasicBoardState();
        
        const gameState = createTestGameState(board);
        const input = createTestMoveInput({ to_point: 18 }); // Empty point, 13 + 5 = 18

        const result = await validateMove(input, gameState, 'plakoto');
        expect(result).toBe(true);
      });
    });

    describe('Fevga', () => {
      it('should not allow moving to point with opponent piece', async () => {
        const board = createBasicBoardState();
        board[18] = { point: 18, color: 'black', count: 1 };
        
        const gameState = createTestGameState(board);
        const input = createTestMoveInput();

        const result = await validateMove(input, gameState, 'fevga');
        expect(result).toBe(false);
      });

      it('should prevent creating 6 consecutive points', async () => {
        const board: BoardPoint[] = [];
        for (let i = 0; i <= 25; i++) {
          board.push({ point: i, color: null, count: 0 });
        }
        
        // Create 5 consecutive white points
        for (let i = 10; i <= 14; i++) {
          board[i] = { point: i, color: 'white', count: 1 };
        }
        board[9] = { point: 9, color: 'white', count: 1 }; // Source piece
        
        const gameState = createTestGameState(board);
        const input = createTestMoveInput({
          from_point: 9,
          to_point: 15, // Would create 6 consecutive points (10-15)
          dice_value: 6
        });

        const result = await validateMove(input, gameState, 'fevga');
        expect(result).toBe(false);
      });

      it('should allow creating less than 6 consecutive points', async () => {
        const board: BoardPoint[] = [];
        for (let i = 0; i <= 25; i++) {
          board.push({ point: i, color: null, count: 0 });
        }
        
        // Create 3 consecutive white points
        for (let i = 10; i <= 12; i++) {
          board[i] = { point: i, color: 'white', count: 1 };
        }
        board[9] = { point: 9, color: 'white', count: 1 }; // Source piece
        
        const gameState = createTestGameState(board);
        gameState.dice = [4, 2];
        gameState.available_moves = [4, 2];
        const input = createTestMoveInput({
          from_point: 9,
          to_point: 13,
          dice_value: 4
        });

        const result = await validateMove(input, gameState, 'fevga');
        expect(result).toBe(true);
      });
    });
  });

  describe('Direction and calculation validation', () => {
    it('should validate white player forward movement', async () => {
      const gameState = createTestGameState();
      const input = createTestMoveInput({
        from_point: 6,
        to_point: 9,
        dice_value: 3
      });

      const result = await validateMove(input, gameState, 'portes');
      expect(result).toBe(true);
    });

    it('should validate black player backward movement', async () => {
      const gameState = createTestGameState();
      const input = createTestMoveInput({
        player_color: 'black',
        from_point: 19,
        to_point: 16,
        dice_value: 3
      });

      const result = await validateMove(input, gameState, 'portes');
      expect(result).toBe(true);
    });

    it('should reject wrong direction movement', async () => {
      const gameState = createTestGameState();
      const input = createTestMoveInput({
        from_point: 13,
        to_point: 10, // Wrong direction for white
        dice_value: 3
      });

      const result = await validateMove(input, gameState, 'portes');
      expect(result).toBe(false);
    });
  });

  describe('Edge cases', () => {
    it('should handle invalid point numbers', async () => {
      const gameState = createTestGameState();
      const input = createTestMoveInput({
        from_point: -1,
        to_point: 5
      });

      const result = await validateMove(input, gameState, 'portes');
      expect(result).toBe(false);
    });

    it('should handle dice value already used', async () => {
      const gameState = createTestGameState();
      gameState.available_moves = [3]; // Only 3 is available, 5 has been used
      
      const input = createTestMoveInput({ dice_value: 5 });

      const result = await validateMove(input, gameState, 'portes');
      expect(result).toBe(false); // 5 is not available
    });

    it('should handle error gracefully', async () => {
      const gameState = createTestGameState();
      gameState.board_state = []; // Invalid board state
      
      const input = createTestMoveInput();

      const result = await validateMove(input, gameState, 'portes');
      expect(result).toBe(false);
    });
  });
});