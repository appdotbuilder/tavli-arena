import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { usersTable, matchesTable, gameStatesTable } from '../db/schema';
import { type JoinMatchInput, type CreateUserInput } from '../schema';
import { joinMatch } from '../handlers/join_match';
import { eq, and } from 'drizzle-orm';

// Test data
const testUser1: CreateUserInput = {
  email: 'player1@example.com',
  username: 'player1',
  password: 'password123'
};

const testUser2: CreateUserInput = {
  email: 'player2@example.com',
  username: 'player2',
  password: 'password123'
};

describe('joinMatch', () => {
  let whitePlayerId: number;
  let blackPlayerId: number;
  let waitingMatchId: number;

  beforeEach(async () => {
    await createDB();
    // Create test users
    const user1Result = await db.insert(usersTable)
      .values({
        email: testUser1.email,
        username: testUser1.username,
        password_hash: 'hashed_password_1'
      })
      .returning()
      .execute();

    const user2Result = await db.insert(usersTable)
      .values({
        email: testUser2.email,
        username: testUser2.username,
        password_hash: 'hashed_password_2'
      })
      .returning()
      .execute();

    whitePlayerId = user1Result[0].id;
    blackPlayerId = user2Result[0].id;

    // Create a waiting match
    const matchResult = await db.insert(matchesTable)
      .values({
        variant: 'portes',
        mode: 'online',
        status: 'waiting',
        white_player_id: whitePlayerId,
        black_player_id: null,
        current_player_color: 'white'
      })
      .returning()
      .execute();

    waitingMatchId = matchResult[0].id;
  });

  afterEach(resetDB);

  it('should join a match successfully', async () => {
    const input: JoinMatchInput = {
      match_id: waitingMatchId,
      black_player_id: blackPlayerId
    };

    const result = await joinMatch(input);

    // Verify match details
    expect(result.id).toEqual(waitingMatchId);
    expect(result.variant).toEqual('portes');
    expect(result.mode).toEqual('online');
    expect(result.status).toEqual('active');
    expect(result.white_player_id).toEqual(whitePlayerId);
    expect(result.black_player_id).toEqual(blackPlayerId);
    expect(result.current_player_color).toEqual('white');
    expect(result.winner_color).toBeNull();
    expect(result.created_at).toBeInstanceOf(Date);
    expect(result.updated_at).toBeInstanceOf(Date);
  });

  it('should update match status in database', async () => {
    const input: JoinMatchInput = {
      match_id: waitingMatchId,
      black_player_id: blackPlayerId
    };

    await joinMatch(input);

    // Check database state
    const matches = await db.select()
      .from(matchesTable)
      .where(eq(matchesTable.id, waitingMatchId))
      .execute();

    expect(matches).toHaveLength(1);
    expect(matches[0].status).toEqual('active');
    expect(matches[0].black_player_id).toEqual(blackPlayerId);
    expect(matches[0].updated_at).toBeInstanceOf(Date);
  });

  it('should create initial game state', async () => {
    const input: JoinMatchInput = {
      match_id: waitingMatchId,
      black_player_id: blackPlayerId
    };

    await joinMatch(input);

    // Check game state creation
    const gameStates = await db.select()
      .from(gameStatesTable)
      .where(eq(gameStatesTable.match_id, waitingMatchId))
      .execute();

    expect(gameStates).toHaveLength(1);
    
    const gameState = gameStates[0];
    expect(gameState.match_id).toEqual(waitingMatchId);
    expect(gameState.turn_number).toEqual(1);
    expect(gameState.phase).toEqual('rolling');
    expect(gameState.created_at).toBeInstanceOf(Date);

    // Verify board state structure
    const boardState = gameState.board_state as any[];
    expect(Array.isArray(boardState)).toBe(true);
    expect(boardState).toHaveLength(26); // 26 points (0-25)

    // Check initial piece positions
    expect(boardState[1]).toEqual({ point: 1, color: 'white', count: 2 });
    expect(boardState[6]).toEqual({ point: 6, color: 'black', count: 5 });
    expect(boardState[8]).toEqual({ point: 8, color: 'black', count: 3 });
    expect(boardState[12]).toEqual({ point: 12, color: 'white', count: 5 });
    expect(boardState[13]).toEqual({ point: 13, color: 'black', count: 5 });
    expect(boardState[17]).toEqual({ point: 17, color: 'white', count: 3 });
    expect(boardState[19]).toEqual({ point: 19, color: 'white', count: 5 });
    expect(boardState[24]).toEqual({ point: 24, color: 'black', count: 2 });

    // Verify dice and moves initialization
    const dice = gameState.dice as number[];
    const availableMoves = gameState.available_moves as number[];
    
    expect(Array.isArray(dice)).toBe(true);
    expect(dice).toHaveLength(2);
    expect(Array.isArray(availableMoves)).toBe(true);
    expect(availableMoves).toHaveLength(0);
  });

  it('should throw error for non-existent match', async () => {
    const input: JoinMatchInput = {
      match_id: 99999,
      black_player_id: blackPlayerId
    };

    await expect(joinMatch(input)).rejects.toThrow(/Match not found or not available for joining/i);
  });

  it('should throw error for match that is not waiting', async () => {
    // Update match to active status
    await db.update(matchesTable)
      .set({ status: 'active' })
      .where(eq(matchesTable.id, waitingMatchId))
      .execute();

    const input: JoinMatchInput = {
      match_id: waitingMatchId,
      black_player_id: blackPlayerId
    };

    await expect(joinMatch(input)).rejects.toThrow(/Match not found or not available for joining/i);
  });

  it('should throw error when match already has black player', async () => {
    // Update match to have a black player already
    await db.update(matchesTable)
      .set({ black_player_id: blackPlayerId })
      .where(eq(matchesTable.id, waitingMatchId))
      .execute();

    const input: JoinMatchInput = {
      match_id: waitingMatchId,
      black_player_id: blackPlayerId
    };

    await expect(joinMatch(input)).rejects.toThrow(/Match is already full/i);
  });

  it('should throw error when player tries to join their own match', async () => {
    const input: JoinMatchInput = {
      match_id: waitingMatchId,
      black_player_id: whitePlayerId // Same as white player
    };

    await expect(joinMatch(input)).rejects.toThrow(/Cannot join your own match/i);
  });

  it('should handle different game variants correctly', async () => {
    // Create matches with different variants
    const plakotoMatch = await db.insert(matchesTable)
      .values({
        variant: 'plakoto',
        mode: 'online',
        status: 'waiting',
        white_player_id: whitePlayerId,
        black_player_id: null,
        current_player_color: 'white'
      })
      .returning()
      .execute();

    const fevgaMatch = await db.insert(matchesTable)
      .values({
        variant: 'fevga',
        mode: 'online',
        status: 'waiting',
        white_player_id: whitePlayerId,
        black_player_id: null,
        current_player_color: 'white'
      })
      .returning()
      .execute();

    // Test plakoto variant
    const plakotoResult = await joinMatch({
      match_id: plakotoMatch[0].id,
      black_player_id: blackPlayerId
    });
    expect(plakotoResult.variant).toEqual('plakoto');

    // Create new black player for second match
    const user3Result = await db.insert(usersTable)
      .values({
        email: 'player3@example.com',
        username: 'player3',
        password_hash: 'hashed_password_3'
      })
      .returning()
      .execute();

    // Test fevga variant
    const fevgaResult = await joinMatch({
      match_id: fevgaMatch[0].id,
      black_player_id: user3Result[0].id
    });
    expect(fevgaResult.variant).toEqual('fevga');
  });

  it('should preserve existing match timestamps', async () => {
    const input: JoinMatchInput = {
      match_id: waitingMatchId,
      black_player_id: blackPlayerId
    };

    // Get original created_at timestamp
    const originalMatches = await db.select()
      .from(matchesTable)
      .where(eq(matchesTable.id, waitingMatchId))
      .execute();
    
    const originalCreatedAt = originalMatches[0].created_at;

    const result = await joinMatch(input);

    // Verify created_at is preserved but updated_at is new
    expect(result.created_at).toEqual(originalCreatedAt);
    expect(result.updated_at.getTime()).toBeGreaterThan(originalCreatedAt.getTime());
  });
});