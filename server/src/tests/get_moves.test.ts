import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { usersTable, matchesTable, movesTable } from '../db/schema';
import { getMoves } from '../handlers/get_moves';

describe('getMoves', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  it('should return moves for a specific match', async () => {
    // Create test user
    const userResult = await db.insert(usersTable)
      .values({
        email: 'test@example.com',
        username: 'testuser',
        password_hash: 'hashedpassword'
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

    // Create test moves
    await db.insert(movesTable)
      .values([
        {
          match_id: matchId,
          player_color: 'white',
          from_point: 24,
          to_point: 21,
          dice_value: 3,
          move_type: 'move',
          turn_number: 1
        },
        {
          match_id: matchId,
          player_color: 'white',
          from_point: 13,
          to_point: 10,
          dice_value: 3,
          move_type: 'move',
          turn_number: 1
        },
        {
          match_id: matchId,
          player_color: 'black',
          from_point: 1,
          to_point: 4,
          dice_value: 3,
          move_type: 'move',
          turn_number: 2
        }
      ])
      .execute();

    const result = await getMoves(matchId);

    expect(result).toHaveLength(3);
    expect(result[0].match_id).toEqual(matchId);
    expect(result[0].player_color).toEqual('white');
    expect(result[0].from_point).toEqual(24);
    expect(result[0].to_point).toEqual(21);
    expect(result[0].dice_value).toEqual(3);
    expect(result[0].move_type).toEqual('move');
    expect(result[0].turn_number).toEqual(1);
    expect(result[0].created_at).toBeInstanceOf(Date);
    expect(result[0].id).toBeDefined();
  });

  it('should return empty array for match with no moves', async () => {
    // Create test user
    const userResult = await db.insert(usersTable)
      .values({
        email: 'test@example.com',
        username: 'testuser',
        password_hash: 'hashedpassword'
      })
      .returning()
      .execute();
    const userId = userResult[0].id;

    // Create test match without moves
    const matchResult = await db.insert(matchesTable)
      .values({
        variant: 'portes',
        mode: 'online',
        white_player_id: userId
      })
      .returning()
      .execute();
    const matchId = matchResult[0].id;

    const result = await getMoves(matchId);

    expect(result).toHaveLength(0);
  });

  it('should return moves ordered by turn number and creation time', async () => {
    // Create test user
    const userResult = await db.insert(usersTable)
      .values({
        email: 'test@example.com',
        username: 'testuser',
        password_hash: 'hashedpassword'
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

    // Create moves in different turns
    // Insert in non-chronological order to test ordering
    await db.insert(movesTable)
      .values([
        {
          match_id: matchId,
          player_color: 'black',
          from_point: 1,
          to_point: 4,
          dice_value: 3,
          move_type: 'move',
          turn_number: 3
        },
        {
          match_id: matchId,
          player_color: 'white',
          from_point: 24,
          to_point: 21,
          dice_value: 3,
          move_type: 'move',
          turn_number: 1
        },
        {
          match_id: matchId,
          player_color: 'white',
          from_point: 13,
          to_point: 10,
          dice_value: 3,
          move_type: 'move',
          turn_number: 1
        },
        {
          match_id: matchId,
          player_color: 'black',
          from_point: 12,
          to_point: 9,
          dice_value: 3,
          move_type: 'move',
          turn_number: 2
        }
      ])
      .execute();

    const result = await getMoves(matchId);

    expect(result).toHaveLength(4);
    
    // Verify ordering by turn number
    expect(result[0].turn_number).toEqual(1);
    expect(result[1].turn_number).toEqual(1);
    expect(result[2].turn_number).toEqual(2);
    expect(result[3].turn_number).toEqual(3);
    
    // Verify moves from same turn are ordered by creation time
    expect(result[0].created_at <= result[1].created_at).toBe(true);
  });

  it('should only return moves for the specified match', async () => {
    // Create test user
    const userResult = await db.insert(usersTable)
      .values({
        email: 'test@example.com',
        username: 'testuser',
        password_hash: 'hashedpassword'
      })
      .returning()
      .execute();
    const userId = userResult[0].id;

    // Create two test matches
    const match1Result = await db.insert(matchesTable)
      .values({
        variant: 'portes',
        mode: 'online',
        white_player_id: userId
      })
      .returning()
      .execute();
    const match1Id = match1Result[0].id;

    const match2Result = await db.insert(matchesTable)
      .values({
        variant: 'plakoto',
        mode: 'ai',
        white_player_id: userId
      })
      .returning()
      .execute();
    const match2Id = match2Result[0].id;

    // Create moves for both matches
    await db.insert(movesTable)
      .values([
        {
          match_id: match1Id,
          player_color: 'white',
          from_point: 24,
          to_point: 21,
          dice_value: 3,
          move_type: 'move',
          turn_number: 1
        },
        {
          match_id: match1Id,
          player_color: 'white',
          from_point: 13,
          to_point: 10,
          dice_value: 3,
          move_type: 'move',
          turn_number: 1
        },
        {
          match_id: match2Id,
          player_color: 'white',
          from_point: 6,
          to_point: 3,
          dice_value: 3,
          move_type: 'move',
          turn_number: 1
        }
      ])
      .execute();

    const result = await getMoves(match1Id);

    expect(result).toHaveLength(2);
    result.forEach(move => {
      expect(move.match_id).toEqual(match1Id);
    });
  });

  it('should handle different move types correctly', async () => {
    // Create test user
    const userResult = await db.insert(usersTable)
      .values({
        email: 'test@example.com',
        username: 'testuser',
        password_hash: 'hashedpassword'
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

    // Create moves with different move types
    await db.insert(movesTable)
      .values([
        {
          match_id: matchId,
          player_color: 'white',
          from_point: 0,
          to_point: 20,
          dice_value: 4,
          move_type: 'enter_from_bar',
          turn_number: 1
        },
        {
          match_id: matchId,
          player_color: 'white',
          from_point: 6,
          to_point: 25,
          dice_value: 6,
          move_type: 'bear_off',
          turn_number: 2
        },
        {
          match_id: matchId,
          player_color: 'black',
          from_point: 1,
          to_point: 6,
          dice_value: 5,
          move_type: 'nail',
          turn_number: 3
        }
      ])
      .execute();

    const result = await getMoves(matchId);

    expect(result).toHaveLength(3);
    expect(result[0].move_type).toEqual('enter_from_bar');
    expect(result[1].move_type).toEqual('bear_off');
    expect(result[2].move_type).toEqual('nail');
  });
});