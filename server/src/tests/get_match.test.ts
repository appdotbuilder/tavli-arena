import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { usersTable, matchesTable } from '../db/schema';
import { getMatch } from '../handlers/get_match';

describe('getMatch', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  it('should get a match by id', async () => {
    // Create test users first
    const whitePlayerResult = await db.insert(usersTable)
      .values({
        email: 'white@example.com',
        username: 'whiteplayer',
        password_hash: 'hashed_password'
      })
      .returning()
      .execute();

    const blackPlayerResult = await db.insert(usersTable)
      .values({
        email: 'black@example.com',
        username: 'blackplayer',
        password_hash: 'hashed_password'
      })
      .returning()
      .execute();

    // Create test match
    const matchResult = await db.insert(matchesTable)
      .values({
        variant: 'portes',
        mode: 'online',
        status: 'active',
        white_player_id: whitePlayerResult[0].id,
        black_player_id: blackPlayerResult[0].id,
        current_player_color: 'white'
      })
      .returning()
      .execute();

    const result = await getMatch(matchResult[0].id);

    // Verify match data
    expect(result).toBeDefined();
    expect(result!.id).toEqual(matchResult[0].id);
    expect(result!.variant).toEqual('portes');
    expect(result!.mode).toEqual('online');
    expect(result!.status).toEqual('active');
    expect(result!.white_player_id).toEqual(whitePlayerResult[0].id);
    expect(result!.black_player_id).toEqual(blackPlayerResult[0].id);
    expect(result!.current_player_color).toEqual('white');
    expect(result!.winner_color).toBeNull();
    expect(result!.created_at).toBeInstanceOf(Date);
    expect(result!.updated_at).toBeInstanceOf(Date);
  });

  it('should return null for non-existent match', async () => {
    const result = await getMatch(999);

    expect(result).toBeNull();
  });

  it('should handle match with only white player (waiting for black)', async () => {
    // Create test user
    const whitePlayerResult = await db.insert(usersTable)
      .values({
        email: 'white@example.com',
        username: 'whiteplayer',
        password_hash: 'hashed_password'
      })
      .returning()
      .execute();

    // Create match with only white player
    const matchResult = await db.insert(matchesTable)
      .values({
        variant: 'fevga',
        mode: 'online',
        status: 'waiting',
        white_player_id: whitePlayerResult[0].id,
        black_player_id: null,
        current_player_color: 'white'
      })
      .returning()
      .execute();

    const result = await getMatch(matchResult[0].id);

    expect(result).toBeDefined();
    expect(result!.status).toEqual('waiting');
    expect(result!.white_player_id).toEqual(whitePlayerResult[0].id);
    expect(result!.black_player_id).toBeNull();
    expect(result!.variant).toEqual('fevga');
  });

  it('should handle completed match with winner', async () => {
    // Create test users
    const whitePlayerResult = await db.insert(usersTable)
      .values({
        email: 'white@example.com',
        username: 'whiteplayer',
        password_hash: 'hashed_password'
      })
      .returning()
      .execute();

    const blackPlayerResult = await db.insert(usersTable)
      .values({
        email: 'black@example.com',
        username: 'blackplayer',
        password_hash: 'hashed_password'
      })
      .returning()
      .execute();

    // Create completed match with winner
    const matchResult = await db.insert(matchesTable)
      .values({
        variant: 'plakoto',
        mode: 'pass_and_play',
        status: 'completed',
        white_player_id: whitePlayerResult[0].id,
        black_player_id: blackPlayerResult[0].id,
        current_player_color: 'black',
        winner_color: 'black'
      })
      .returning()
      .execute();

    const result = await getMatch(matchResult[0].id);

    expect(result).toBeDefined();
    expect(result!.status).toEqual('completed');
    expect(result!.winner_color).toEqual('black');
    expect(result!.variant).toEqual('plakoto');
    expect(result!.mode).toEqual('pass_and_play');
  });

  it('should handle AI match mode', async () => {
    // Create test user
    const playerResult = await db.insert(usersTable)
      .values({
        email: 'player@example.com',
        username: 'player',
        password_hash: 'hashed_password'
      })
      .returning()
      .execute();

    // Create AI match (typically black_player_id would be null for AI)
    const matchResult = await db.insert(matchesTable)
      .values({
        variant: 'portes',
        mode: 'ai',
        status: 'active',
        white_player_id: playerResult[0].id,
        black_player_id: null,
        current_player_color: 'white'
      })
      .returning()
      .execute();

    const result = await getMatch(matchResult[0].id);

    expect(result).toBeDefined();
    expect(result!.mode).toEqual('ai');
    expect(result!.black_player_id).toBeNull();
    expect(result!.status).toEqual('active');
  });

  it('should handle abandoned match', async () => {
    // Create test users
    const whitePlayerResult = await db.insert(usersTable)
      .values({
        email: 'white@example.com',
        username: 'whiteplayer',
        password_hash: 'hashed_password'
      })
      .returning()
      .execute();

    const blackPlayerResult = await db.insert(usersTable)
      .values({
        email: 'black@example.com',
        username: 'blackplayer',
        password_hash: 'hashed_password'
      })
      .returning()
      .execute();

    // Create abandoned match
    const matchResult = await db.insert(matchesTable)
      .values({
        variant: 'portes',
        mode: 'online',
        status: 'abandoned',
        white_player_id: whitePlayerResult[0].id,
        black_player_id: blackPlayerResult[0].id,
        current_player_color: 'white'
      })
      .returning()
      .execute();

    const result = await getMatch(matchResult[0].id);

    expect(result).toBeDefined();
    expect(result!.status).toEqual('abandoned');
    expect(result!.winner_color).toBeNull();
  });
});