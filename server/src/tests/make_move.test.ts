import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { usersTable, matchesTable, gameStatesTable, movesTable } from '../db/schema';
import { type MakeMoveInput, type BoardPoint } from '../schema';
import { makeMove } from '../handlers/make_move';
import { eq } from 'drizzle-orm';

// Helper function to create initial board state
const createInitialBoardState = (): BoardPoint[] => {
  const board: BoardPoint[] = [];
  
  // Initialize all points as empty
  for (let i = 0; i <= 25; i++) {
    board.push({ point: i, color: null, count: 0 });
  }
  
  // Set up some test pieces
  board[1] = { point: 1, color: 'white', count: 2 }; // White pieces at point 1
  board[6] = { point: 6, color: 'black', count: 1 }; // Black piece at point 6
  board[24] = { point: 24, color: 'black', count: 2 }; // Black pieces at point 24
  board[13] = { point: 13, color: 'white', count: 3 }; // White pieces at point 13
  
  return board;
};

describe('makeMove', () => {
  let testUserId1: number;
  let testUserId2: number;
  let testMatchId: number;
  let testGameStateId: number;

  beforeEach(async () => {
    await createDB();

    // Create test users
    const user1Result = await db.insert(usersTable)
      .values({
        email: 'player1@test.com',
        username: 'player1',
        password_hash: 'hash1'
      })
      .returning()
      .execute();
    testUserId1 = user1Result[0].id;

    const user2Result = await db.insert(usersTable)
      .values({
        email: 'player2@test.com',
        username: 'player2',
        password_hash: 'hash2'
      })
      .returning()
      .execute();
    testUserId2 = user2Result[0].id;

    // Create test match
    const matchResult = await db.insert(matchesTable)
      .values({
        variant: 'portes',
        mode: 'online',
        status: 'active',
        white_player_id: testUserId1,
        black_player_id: testUserId2,
        current_player_color: 'white'
      })
      .returning()
      .execute();
    testMatchId = matchResult[0].id;

    // Create initial game state
    const gameStateResult = await db.insert(gameStatesTable)
      .values({
        match_id: testMatchId,
        board_state: createInitialBoardState(),
        dice: [3, 5],
        available_moves: [3, 5],
        turn_number: 1,
        phase: 'moving'
      })
      .returning()
      .execute();
    testGameStateId = gameStateResult[0].id;
  });

  afterEach(resetDB);

  it('should make a valid move', async () => {
    const input: MakeMoveInput = {
      match_id: testMatchId,
      player_color: 'white',
      from_point: 1,
      to_point: 4,
      dice_value: 3
    };

    const result = await makeMove(input);

    // Validate move record
    expect(result.match_id).toEqual(testMatchId);
    expect(result.player_color).toEqual('white');
    expect(result.from_point).toEqual(1);
    expect(result.to_point).toEqual(4);
    expect(result.dice_value).toEqual(3);
    expect(result.move_type).toEqual('move');
    expect(result.turn_number).toEqual(1);
    expect(result.id).toBeDefined();
    expect(result.created_at).toBeInstanceOf(Date);
  });

  it('should update board state correctly', async () => {
    const input: MakeMoveInput = {
      match_id: testMatchId,
      player_color: 'white',
      from_point: 1,
      to_point: 4,
      dice_value: 3
    };

    await makeMove(input);

    // Check updated game state
    const gameStates = await db.select()
      .from(gameStatesTable)
      .where(eq(gameStatesTable.match_id, testMatchId))
      .execute();

    expect(gameStates.length).toEqual(2); // Original + new state

    const latestState = gameStates[gameStates.length - 1];
    const boardState = latestState.board_state as any[];

    // Check source point (should have one less piece)
    const fromPoint = boardState.find(p => p.point === 1);
    expect(fromPoint.count).toEqual(1);
    expect(fromPoint.color).toEqual('white');

    // Check destination point (should have one more piece)
    const toPoint = boardState.find(p => p.point === 4);
    expect(toPoint.count).toEqual(1);
    expect(toPoint.color).toEqual('white');
  });

  it('should handle bear off move', async () => {
    // First, set up a position where bearing off is possible
    const bearOffBoard = createInitialBoardState();
    bearOffBoard[23] = { point: 23, color: 'white', count: 1 };

    await db.insert(gameStatesTable)
      .values({
        match_id: testMatchId,
        board_state: bearOffBoard,
        dice: [2, 4],
        available_moves: [2, 4],
        turn_number: 2,
        phase: 'moving'
      })
      .execute();

    const input: MakeMoveInput = {
      match_id: testMatchId,
      player_color: 'white',
      from_point: 23,
      to_point: 25, // Bear off
      dice_value: 2
    };

    const result = await makeMove(input);

    expect(result.move_type).toEqual('bear_off');
    expect(result.to_point).toEqual(25);
  });

  it('should handle nailing opponent piece', async () => {
    const input: MakeMoveInput = {
      match_id: testMatchId,
      player_color: 'white',
      from_point: 1,
      to_point: 6, // Black has one piece here
      dice_value: 5
    };

    const result = await makeMove(input);

    expect(result.move_type).toEqual('nail');

    // Check that opponent piece was moved to bar
    const gameStates = await db.select()
      .from(gameStatesTable)
      .where(eq(gameStatesTable.match_id, testMatchId))
      .execute();

    const latestState = gameStates[gameStates.length - 1];
    const boardState = latestState.board_state as any[];

    // Check bar (point 0) has the nailed piece
    const barPoint = boardState.find(p => p.point === 0);
    expect(barPoint.count).toEqual(1);
    expect(barPoint.color).toEqual('black');
  });

  it('should switch players when turn is complete', async () => {
    // Use the last die
    await db.insert(gameStatesTable)
      .values({
        match_id: testMatchId,
        board_state: createInitialBoardState(),
        dice: [3], // Only one die left
        available_moves: [3],
        turn_number: 1,
        phase: 'moving'
      })
      .execute();

    const input: MakeMoveInput = {
      match_id: testMatchId,
      player_color: 'white',
      from_point: 1,
      to_point: 4,
      dice_value: 3
    };

    await makeMove(input);

    // Check that current player switched to black
    const matches = await db.select()
      .from(matchesTable)
      .where(eq(matchesTable.id, testMatchId))
      .execute();

    expect(matches[0].current_player_color).toEqual('black');
  });

  it('should throw error for non-existent match', async () => {
    const input: MakeMoveInput = {
      match_id: 99999,
      player_color: 'white',
      from_point: 1,
      to_point: 4,
      dice_value: 3
    };

    await expect(makeMove(input)).rejects.toThrow(/match not found/i);
  });

  it('should throw error for inactive match', async () => {
    // Update match to completed status
    await db.update(matchesTable)
      .set({ status: 'completed' })
      .where(eq(matchesTable.id, testMatchId))
      .execute();

    const input: MakeMoveInput = {
      match_id: testMatchId,
      player_color: 'white',
      from_point: 1,
      to_point: 4,
      dice_value: 3
    };

    await expect(makeMove(input)).rejects.toThrow(/match is not active/i);
  });

  it('should throw error when not player\'s turn', async () => {
    const input: MakeMoveInput = {
      match_id: testMatchId,
      player_color: 'black', // White's turn
      from_point: 24,
      to_point: 21,
      dice_value: 3
    };

    await expect(makeMove(input)).rejects.toThrow(/not your turn/i);
  });

  it('should throw error for invalid dice value', async () => {
    const input: MakeMoveInput = {
      match_id: testMatchId,
      player_color: 'white',
      from_point: 1,
      to_point: 4,
      dice_value: 2 // Not in available dice [3, 5]
    };

    await expect(makeMove(input)).rejects.toThrow(/invalid dice value/i);
  });

  it('should throw error when no pieces at source point', async () => {
    const input: MakeMoveInput = {
      match_id: testMatchId,
      player_color: 'white',
      from_point: 5, // Empty point
      to_point: 8,
      dice_value: 3
    };

    await expect(makeMove(input)).rejects.toThrow(/no pieces available/i);
  });

  it('should throw error when move is blocked', async () => {
    // Set up blocked position
    const blockedBoard = createInitialBoardState();
    blockedBoard[7] = { point: 7, color: 'black', count: 2 }; // Two black pieces blocking

    await db.insert(gameStatesTable)
      .values({
        match_id: testMatchId,
        board_state: blockedBoard,
        dice: [6, 4],
        available_moves: [6, 4],
        turn_number: 1,
        phase: 'moving'
      })
      .execute();

    const input: MakeMoveInput = {
      match_id: testMatchId,
      player_color: 'white',
      from_point: 1,
      to_point: 7, // Blocked by two black pieces
      dice_value: 6
    };

    await expect(makeMove(input)).rejects.toThrow(/move is blocked/i);
  });

  it('should throw error during wrong phase', async () => {
    // Update game state to rolling phase
    await db.insert(gameStatesTable)
      .values({
        match_id: testMatchId,
        board_state: createInitialBoardState(),
        dice: [],
        available_moves: [],
        turn_number: 1,
        phase: 'rolling'
      })
      .execute();

    const input: MakeMoveInput = {
      match_id: testMatchId,
      player_color: 'white',
      from_point: 1,
      to_point: 4,
      dice_value: 3
    };

    await expect(makeMove(input)).rejects.toThrow(/cannot make move during this phase/i);
  });

  it('should save move to database', async () => {
    const input: MakeMoveInput = {
      match_id: testMatchId,
      player_color: 'white',
      from_point: 1,
      to_point: 4,
      dice_value: 3
    };

    const result = await makeMove(input);

    // Verify move was saved
    const moves = await db.select()
      .from(movesTable)
      .where(eq(movesTable.id, result.id))
      .execute();

    expect(moves).toHaveLength(1);
    expect(moves[0].match_id).toEqual(testMatchId);
    expect(moves[0].player_color).toEqual('white');
    expect(moves[0].from_point).toEqual(1);
    expect(moves[0].to_point).toEqual(4);
    expect(moves[0].dice_value).toEqual(3);
    expect(moves[0].created_at).toBeInstanceOf(Date);
  });
});