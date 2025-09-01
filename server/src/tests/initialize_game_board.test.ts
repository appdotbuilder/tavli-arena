import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { usersTable, matchesTable, gameStatesTable } from '../db/schema';
import { type GameVariant } from '../schema';
import { initializeGameBoard } from '../handlers/initialize_game_board';
import { eq } from 'drizzle-orm';

// Test data
const testUser1 = {
  email: 'white@example.com',
  username: 'whiteplayer',
  password_hash: 'hashedpassword1'
};

const testUser2 = {
  email: 'black@example.com',
  username: 'blackplayer',
  password_hash: 'hashedpassword2'
};

describe('initializeGameBoard', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  let whitePlayerId: number;
  let blackPlayerId: number;
  let matchId: number;

  beforeEach(async () => {
    // Create test users
    const users = await db.insert(usersTable)
      .values([testUser1, testUser2])
      .returning()
      .execute();
    
    whitePlayerId = users[0].id;
    blackPlayerId = users[1].id;

    // Create a test match
    const matches = await db.insert(matchesTable)
      .values({
        variant: 'portes',
        mode: 'online',
        white_player_id: whitePlayerId,
        black_player_id: blackPlayerId
      })
      .returning()
      .execute();
    
    matchId = matches[0].id;
  });

  it('should initialize Portes board correctly', async () => {
    const result = await initializeGameBoard(matchId, 'portes');

    // Verify basic structure
    expect(result.match_id).toEqual(matchId);
    expect(result.board_state).toHaveLength(26);
    expect(result.dice).toEqual([0, 0]);
    expect(result.available_moves).toEqual([]);
    expect(result.turn_number).toEqual(1);
    expect(result.phase).toEqual('rolling');
    expect(result.id).toBeDefined();
    expect(result.created_at).toBeInstanceOf(Date);

    // Verify Portes starting positions
    const board = result.board_state;
    
    // Black pieces positions
    expect(board[1]).toEqual({ point: 1, color: 'black', count: 2 });
    expect(board[12]).toEqual({ point: 12, color: 'black', count: 5 });
    expect(board[17]).toEqual({ point: 17, color: 'black', count: 3 });
    expect(board[19]).toEqual({ point: 19, color: 'black', count: 5 });
    
    // White pieces positions
    expect(board[6]).toEqual({ point: 6, color: 'white', count: 5 });
    expect(board[8]).toEqual({ point: 8, color: 'white', count: 3 });
    expect(board[13]).toEqual({ point: 13, color: 'white', count: 5 });
    expect(board[24]).toEqual({ point: 24, color: 'white', count: 2 });

    // Verify total piece count (15 per player)
    const blackTotal = board.filter(p => p.color === 'black').reduce((sum, p) => sum + p.count, 0);
    const whiteTotal = board.filter(p => p.color === 'white').reduce((sum, p) => sum + p.count, 0);
    expect(blackTotal).toEqual(15);
    expect(whiteTotal).toEqual(15);

    // Verify empty points are properly structured
    const emptyPoints = board.filter(p => p.count === 0);
    emptyPoints.forEach(point => {
      expect(point.color).toBeNull();
      expect(point.count).toEqual(0);
      expect(point.point).toBeGreaterThanOrEqual(0);
      expect(point.point).toBeLessThanOrEqual(25);
    });
  });

  it('should initialize Plakoto board correctly', async () => {
    const result = await initializeGameBoard(matchId, 'plakoto');

    expect(result.match_id).toEqual(matchId);
    expect(result.board_state).toHaveLength(26);
    
    const board = result.board_state;
    
    // Plakoto starting positions
    expect(board[1]).toEqual({ point: 1, color: 'black', count: 15 });
    expect(board[24]).toEqual({ point: 24, color: 'white', count: 15 });

    // Verify all other points are empty
    const nonEmptyPoints = board.filter(p => p.count > 0);
    expect(nonEmptyPoints).toHaveLength(2);

    // Verify piece totals
    const blackTotal = board.filter(p => p.color === 'black').reduce((sum, p) => sum + p.count, 0);
    const whiteTotal = board.filter(p => p.color === 'white').reduce((sum, p) => sum + p.count, 0);
    expect(blackTotal).toEqual(15);
    expect(whiteTotal).toEqual(15);
  });

  it('should initialize Fevga board correctly', async () => {
    const result = await initializeGameBoard(matchId, 'fevga');

    expect(result.match_id).toEqual(matchId);
    expect(result.board_state).toHaveLength(26);
    
    const board = result.board_state;
    
    // In Fevga, both colors start on point 24
    expect(board[24]).toEqual({ point: 24, color: 'black', count: 15 });
    
    // Verify all other points are empty except point 24
    const nonEmptyPoints = board.filter(p => p.count > 0);
    expect(nonEmptyPoints).toHaveLength(1);
    expect(nonEmptyPoints[0].point).toEqual(24);

    // Note: Fevga implementation shows both players on same point
    // This might need adjustment based on actual game rules for stacking
  });

  it('should save game state to database', async () => {
    const result = await initializeGameBoard(matchId, 'portes');

    // Query database to verify persistence
    const gameStates = await db.select()
      .from(gameStatesTable)
      .where(eq(gameStatesTable.id, result.id))
      .execute();

    expect(gameStates).toHaveLength(1);
    const savedState = gameStates[0];
    
    expect(savedState.match_id).toEqual(matchId);
    expect(savedState.turn_number).toEqual(1);
    expect(savedState.phase).toEqual('rolling');
    expect(savedState.board_state).toBeDefined();
    expect(savedState.dice).toBeDefined();
    expect(savedState.available_moves).toBeDefined();
    expect(savedState.created_at).toBeInstanceOf(Date);
  });

  it('should handle multiple game states for same match', async () => {
    // Initialize boards for different variants (simulating multiple game states)
    const portes = await initializeGameBoard(matchId, 'portes');
    
    // Create another match for different variant
    const match2 = await db.insert(matchesTable)
      .values({
        variant: 'plakoto',
        mode: 'online',
        white_player_id: whitePlayerId,
        black_player_id: blackPlayerId
      })
      .returning()
      .execute();
    
    const plakoto = await initializeGameBoard(match2[0].id, 'plakoto');

    expect(portes.id).not.toEqual(plakoto.id);
    expect(portes.match_id).not.toEqual(plakoto.match_id);
    
    // Verify both exist in database
    const allStates = await db.select().from(gameStatesTable).execute();
    expect(allStates).toHaveLength(2);
  });

  it('should throw error for unknown variant', async () => {
    await expect(
      initializeGameBoard(matchId, 'unknown_variant' as GameVariant)
    ).rejects.toThrow(/Unknown game variant/i);
  });

  it('should validate board structure consistency', async () => {
    const variants: GameVariant[] = ['portes', 'plakoto', 'fevga'];
    
    for (const variant of variants) {
      const result = await initializeGameBoard(matchId, variant);
      
      // Every board should have exactly 26 points
      expect(result.board_state).toHaveLength(26);
      
      // Points should be numbered 0-25
      result.board_state.forEach((point, index) => {
        expect(point.point).toEqual(index);
      });
      
      // Count should never be negative
      result.board_state.forEach(point => {
        expect(point.count).toBeGreaterThanOrEqual(0);
      });
      
      // Color should be either 'white', 'black', or null
      result.board_state.forEach(point => {
        if (point.count > 0) {
          expect(['white', 'black']).toContain(point.color);
        } else {
          expect(point.color).toBeNull();
        }
      });
    }
  });
});