import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { usersTable, matchesTable, gameStatesTable } from '../db/schema';
import { type RollDiceInput } from '../schema';
import { rollDice } from '../handlers/roll_dice';
import { eq } from 'drizzle-orm';

describe('rollDice', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  let testUser: any;
  let testMatch: any;
  let testGameState: any;

  beforeEach(async () => {
    // Create test user
    const userResult = await db.insert(usersTable)
      .values({
        email: 'player@test.com',
        username: 'testplayer',
        password_hash: 'hashedpassword',
        elo_rating: 1200,
        wins: 0,
        losses: 0
      })
      .returning()
      .execute();
    testUser = userResult[0];

    // Create test match
    const matchResult = await db.insert(matchesTable)
      .values({
        variant: 'portes',
        mode: 'online',
        status: 'active',
        white_player_id: testUser.id,
        black_player_id: testUser.id, // Same user for simplicity
        current_player_color: 'white'
      })
      .returning()
      .execute();
    testMatch = matchResult[0];

    // Create initial game state in rolling phase
    const gameStateResult = await db.insert(gameStatesTable)
      .values({
        match_id: testMatch.id,
        board_state: [],
        dice: [1, 1],
        available_moves: [],
        turn_number: 1,
        phase: 'rolling'
      })
      .returning()
      .execute();
    testGameState = gameStateResult[0];
  });

  it('should roll dice and create new game state', async () => {
    const input: RollDiceInput = {
      match_id: testMatch.id,
      player_color: 'white'
    };

    const result = await rollDice(input);

    // Verify the result structure
    expect(result.id).toBeDefined();
    expect(result.match_id).toEqual(testMatch.id);
    expect(result.dice).toHaveLength(2);
    expect(result.dice[0]).toBeGreaterThanOrEqual(1);
    expect(result.dice[0]).toBeLessThanOrEqual(6);
    expect(result.dice[1]).toBeGreaterThanOrEqual(1);
    expect(result.dice[1]).toBeLessThanOrEqual(6);
    expect(result.phase).toEqual('moving');
    expect(result.turn_number).toEqual(1);
    expect(result.available_moves).toEqual([]);
    expect(result.created_at).toBeInstanceOf(Date);
  });

  it('should save new game state to database', async () => {
    const input: RollDiceInput = {
      match_id: testMatch.id,
      player_color: 'white'
    };

    const result = await rollDice(input);

    // Query the database to verify the new state was saved
    const savedStates = await db.select()
      .from(gameStatesTable)
      .where(eq(gameStatesTable.id, result.id))
      .execute();

    expect(savedStates).toHaveLength(1);
    const savedState = savedStates[0];
    expect(savedState.match_id).toEqual(testMatch.id);
    expect(savedState.phase).toEqual('moving');
    expect(Array.isArray(savedState.dice)).toBe(true);
    expect((savedState.dice as number[]).length).toBe(2);
  });

  it('should throw error if match not found', async () => {
    const input: RollDiceInput = {
      match_id: 99999,
      player_color: 'white'
    };

    await expect(rollDice(input)).rejects.toThrow(/match not found/i);
  });

  it('should throw error if match is not active', async () => {
    // Update match status to completed
    await db.update(matchesTable)
      .set({ status: 'completed' })
      .where(eq(matchesTable.id, testMatch.id))
      .execute();

    const input: RollDiceInput = {
      match_id: testMatch.id,
      player_color: 'white'
    };

    await expect(rollDice(input)).rejects.toThrow(/match is not active/i);
  });

  it('should throw error if not player\'s turn', async () => {
    const input: RollDiceInput = {
      match_id: testMatch.id,
      player_color: 'black' // Wrong player color
    };

    await expect(rollDice(input)).rejects.toThrow(/not your turn/i);
  });

  it('should throw error if no game state exists', async () => {
    // Delete the game state
    await db.delete(gameStatesTable)
      .where(eq(gameStatesTable.match_id, testMatch.id))
      .execute();

    const input: RollDiceInput = {
      match_id: testMatch.id,
      player_color: 'white'
    };

    await expect(rollDice(input)).rejects.toThrow(/no game state found/i);
  });

  it('should throw error if game is not in rolling phase', async () => {
    // Update game state to moving phase
    await db.update(gameStatesTable)
      .set({ phase: 'moving' })
      .where(eq(gameStatesTable.id, testGameState.id))
      .execute();

    const input: RollDiceInput = {
      match_id: testMatch.id,
      player_color: 'white'
    };

    await expect(rollDice(input)).rejects.toThrow(/cannot roll dice - game is not in rolling phase/i);
  });

  it('should preserve board state from previous game state', async () => {
    // Update the game state with a specific board state
    const testBoardState = [
      { point: 1, color: 'white' as const, count: 2 },
      { point: 6, color: 'black' as const, count: 5 }
    ];

    await db.update(gameStatesTable)
      .set({ board_state: testBoardState })
      .where(eq(gameStatesTable.id, testGameState.id))
      .execute();

    const input: RollDiceInput = {
      match_id: testMatch.id,
      player_color: 'white'
    };

    const result = await rollDice(input);

    expect(result.board_state).toEqual(testBoardState);
  });

  it('should handle black player turn correctly', async () => {
    // Update match to be black player's turn
    await db.update(matchesTable)
      .set({ current_player_color: 'black' })
      .where(eq(matchesTable.id, testMatch.id))
      .execute();

    const input: RollDiceInput = {
      match_id: testMatch.id,
      player_color: 'black'
    };

    const result = await rollDice(input);

    expect(result.match_id).toEqual(testMatch.id);
    expect(result.phase).toEqual('moving');
    expect(result.dice).toHaveLength(2);
  });

  it('should generate different dice values on multiple rolls', async () => {
    const input: RollDiceInput = {
      match_id: testMatch.id,
      player_color: 'white'
    };

    // Collect dice values from multiple rolls
    const diceResults: number[][] = [];
    
    for (let i = 0; i < 10; i++) {
      // Reset game state to rolling phase for each test
      await db.update(gameStatesTable)
        .set({ phase: 'rolling' })
        .where(eq(gameStatesTable.match_id, testMatch.id))
        .execute();

      const result = await rollDice(input);
      diceResults.push([...result.dice]);
    }

    // Check that we got some variation in dice rolls
    // (Very unlikely to get the same result 10 times in a row)
    const uniqueResults = new Set(diceResults.map(dice => `${dice[0]}-${dice[1]}`));
    expect(uniqueResults.size).toBeGreaterThan(1);
  });
});