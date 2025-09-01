import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { usersTable, matchesTable, gameStatesTable } from '../db/schema';
import { type BoardPoint } from '../schema';
import { getGameState } from '../handlers/get_game_state';

describe('getGameState', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  it('should return null when no game state exists for match', async () => {
    const result = await getGameState(999);
    expect(result).toBeNull();
  });

  it('should return the most recent game state for a match', async () => {
    // Create test user
    const userResult = await db.insert(usersTable)
      .values({
        email: 'test@example.com',
        username: 'testuser',
        password_hash: 'hash123'
      })
      .returning()
      .execute();

    const userId = userResult[0].id;

    // Create test match
    const matchResult = await db.insert(matchesTable)
      .values({
        variant: 'portes',
        mode: 'online',
        white_player_id: userId
      })
      .returning()
      .execute();

    const matchId = matchResult[0].id;

    // Create sample board state
    const boardState: BoardPoint[] = [
      { point: 0, color: null, count: 0 }, // bar
      { point: 1, color: 'white', count: 2 },
      { point: 2, color: null, count: 0 },
      { point: 3, color: 'black', count: 3 },
      // ... simplified for testing
      { point: 25, color: null, count: 0 } // off board
    ];

    // Create older game state
    await db.insert(gameStatesTable)
      .values({
        match_id: matchId,
        board_state: JSON.stringify([]),
        dice: JSON.stringify([1, 1]),
        available_moves: JSON.stringify([]),
        turn_number: 1,
        phase: 'rolling'
      })
      .execute();

    // Wait a moment to ensure different timestamps
    await new Promise(resolve => setTimeout(resolve, 10));

    // Create newer game state
    const newerGameStateResult = await db.insert(gameStatesTable)
      .values({
        match_id: matchId,
        board_state: JSON.stringify(boardState),
        dice: JSON.stringify([3, 5]),
        available_moves: JSON.stringify([1, 2, 3]),
        turn_number: 2,
        phase: 'moving'
      })
      .returning()
      .execute();

    const result = await getGameState(matchId);

    expect(result).not.toBeNull();
    expect(result!.id).toEqual(newerGameStateResult[0].id);
    expect(result!.match_id).toEqual(matchId);
    expect(result!.dice).toEqual([3, 5]);
    expect(result!.available_moves).toEqual([1, 2, 3]);
    expect(result!.turn_number).toEqual(2);
    expect(result!.phase).toEqual('moving');
    expect(result!.created_at).toBeInstanceOf(Date);
    expect(Array.isArray(result!.board_state)).toBe(true);
  });

  it('should handle complete board state correctly', async () => {
    // Create test user
    const userResult = await db.insert(usersTable)
      .values({
        email: 'test@example.com',
        username: 'testuser',
        password_hash: 'hash123'
      })
      .returning()
      .execute();

    const userId = userResult[0].id;

    // Create test match
    const matchResult = await db.insert(matchesTable)
      .values({
        variant: 'portes',
        mode: 'online',
        white_player_id: userId
      })
      .returning()
      .execute();

    const matchId = matchResult[0].id;

    // Create full board state (26 points: 0-25)
    const fullBoardState: BoardPoint[] = [];
    for (let i = 0; i <= 25; i++) {
      fullBoardState.push({
        point: i,
        color: i % 2 === 0 ? 'white' : 'black',
        count: i === 0 || i === 25 ? 0 : 2 // bar and off-board have no pieces
      });
    }

    await db.insert(gameStatesTable)
      .values({
        match_id: matchId,
        board_state: JSON.stringify(fullBoardState),
        dice: JSON.stringify([6, 4]),
        available_moves: JSON.stringify([4, 6, 10]),
        turn_number: 5,
        phase: 'waiting'
      })
      .execute();

    const result = await getGameState(matchId);

    expect(result).not.toBeNull();
    expect(result!.board_state).toHaveLength(26);
    expect(result!.board_state[0].point).toEqual(0); // bar
    expect(result!.board_state[25].point).toEqual(25); // off board
    expect(result!.dice).toEqual([6, 4]);
    expect(result!.available_moves).toEqual([4, 6, 10]);
    expect(result!.turn_number).toEqual(5);
    expect(result!.phase).toEqual('waiting');
  });

  it('should handle different game phases correctly', async () => {
    // Create test user
    const userResult = await db.insert(usersTable)
      .values({
        email: 'test@example.com',
        username: 'testuser',
        password_hash: 'hash123'
      })
      .returning()
      .execute();

    const userId = userResult[0].id;

    // Create test match
    const matchResult = await db.insert(matchesTable)
      .values({
        variant: 'portes',
        mode: 'online',
        white_player_id: userId
      })
      .returning()
      .execute();

    const matchId = matchResult[0].id;

    // Test rolling phase
    await db.insert(gameStatesTable)
      .values({
        match_id: matchId,
        board_state: JSON.stringify([]),
        dice: JSON.stringify([0, 0]), // Not rolled yet
        available_moves: JSON.stringify([]),
        turn_number: 1,
        phase: 'rolling'
      })
      .execute();

    const rollingResult = await getGameState(matchId);
    expect(rollingResult!.phase).toEqual('rolling');
    expect(rollingResult!.dice).toEqual([0, 0]);
    expect(rollingResult!.available_moves).toEqual([]);
  });

  it('should return game state with valid board point structure', async () => {
    // Create test user
    const userResult = await db.insert(usersTable)
      .values({
        email: 'test@example.com',
        username: 'testuser',
        password_hash: 'hash123'
      })
      .returning()
      .execute();

    const userId = userResult[0].id;

    // Create test match
    const matchResult = await db.insert(matchesTable)
      .values({
        variant: 'portes',
        mode: 'online',
        white_player_id: userId
      })
      .returning()
      .execute();

    const matchId = matchResult[0].id;

    const testBoardPoints: BoardPoint[] = [
      { point: 0, color: null, count: 0 }, // bar
      { point: 1, color: 'white', count: 2 },
      { point: 6, color: 'black', count: 5 },
      { point: 12, color: 'white', count: 3 },
      { point: 19, color: 'black', count: 2 },
      { point: 25, color: null, count: 0 } // off board
    ];

    await db.insert(gameStatesTable)
      .values({
        match_id: matchId,
        board_state: JSON.stringify(testBoardPoints),
        dice: JSON.stringify([2, 4]),
        available_moves: JSON.stringify([2, 4, 6]),
        turn_number: 3,
        phase: 'moving'
      })
      .execute();

    const result = await getGameState(matchId);

    expect(result).not.toBeNull();
    expect(Array.isArray(result!.board_state)).toBe(true);
    
    // Verify board point structure
    const boardState = result!.board_state as BoardPoint[];
    expect(boardState).toHaveLength(6);
    
    // Check specific points
    expect(boardState[0]).toEqual({ point: 0, color: null, count: 0 });
    expect(boardState[1]).toEqual({ point: 1, color: 'white', count: 2 });
    expect(boardState[2]).toEqual({ point: 6, color: 'black', count: 5 });
  });
});