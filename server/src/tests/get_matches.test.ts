import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { usersTable, matchesTable } from '../db/schema';
import { type MatchFilters, type CreateUserInput, type CreateMatchInput } from '../schema';
import { getMatches } from '../handlers/get_matches';

// Test data setup
const testUser1: CreateUserInput = {
  email: 'user1@test.com',
  username: 'user1',
  password: 'password123'
};

const testUser2: CreateUserInput = {
  email: 'user2@test.com',
  username: 'user2',
  password: 'password123'
};

describe('getMatches', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  let userId1: number;
  let userId2: number;

  beforeEach(async () => {
    // Create test users first
    const user1Result = await db.insert(usersTable)
      .values({
        email: testUser1.email,
        username: testUser1.username,
        password_hash: 'hashed_password1'
      })
      .returning()
      .execute();

    const user2Result = await db.insert(usersTable)
      .values({
        email: testUser2.email,
        username: testUser2.username,
        password_hash: 'hashed_password2'
      })
      .returning()
      .execute();

    userId1 = user1Result[0].id;
    userId2 = user2Result[0].id;
  });

  it('should return all matches when no filters are applied', async () => {
    // Create test matches
    await db.insert(matchesTable).values([
      {
        variant: 'portes',
        mode: 'online',
        status: 'waiting',
        white_player_id: userId1,
        black_player_id: null,
        current_player_color: 'white'
      },
      {
        variant: 'plakoto',
        mode: 'ai',
        status: 'active',
        white_player_id: userId1,
        black_player_id: userId2,
        current_player_color: 'black'
      },
      {
        variant: 'fevga',
        mode: 'pass_and_play',
        status: 'completed',
        white_player_id: userId2,
        black_player_id: userId1,
        current_player_color: 'white',
        winner_color: 'white'
      }
    ]).execute();

    const result = await getMatches();

    expect(result).toHaveLength(3);
    expect(result[0].variant).toBeDefined();
    expect(result[0].mode).toBeDefined();
    expect(result[0].status).toBeDefined();
    expect(result[0].white_player_id).toBeDefined();
    expect(result[0].created_at).toBeInstanceOf(Date);
    expect(result[0].updated_at).toBeInstanceOf(Date);
  });

  it('should filter matches by variant', async () => {
    // Create matches with different variants
    await db.insert(matchesTable).values([
      {
        variant: 'portes',
        mode: 'online',
        status: 'waiting',
        white_player_id: userId1,
        black_player_id: null,
        current_player_color: 'white'
      },
      {
        variant: 'plakoto',
        mode: 'online',
        status: 'waiting',
        white_player_id: userId2,
        black_player_id: null,
        current_player_color: 'white'
      }
    ]).execute();

    const filters: MatchFilters = { variant: 'portes' };
    const result = await getMatches(filters);

    expect(result).toHaveLength(1);
    expect(result[0].variant).toEqual('portes');
  });

  it('should filter matches by mode', async () => {
    // Create matches with different modes
    await db.insert(matchesTable).values([
      {
        variant: 'portes',
        mode: 'online',
        status: 'waiting',
        white_player_id: userId1,
        black_player_id: null,
        current_player_color: 'white'
      },
      {
        variant: 'portes',
        mode: 'ai',
        status: 'waiting',
        white_player_id: userId2,
        black_player_id: null,
        current_player_color: 'white'
      }
    ]).execute();

    const filters: MatchFilters = { mode: 'ai' };
    const result = await getMatches(filters);

    expect(result).toHaveLength(1);
    expect(result[0].mode).toEqual('ai');
  });

  it('should filter matches by status', async () => {
    // Create matches with different statuses
    await db.insert(matchesTable).values([
      {
        variant: 'portes',
        mode: 'online',
        status: 'waiting',
        white_player_id: userId1,
        black_player_id: null,
        current_player_color: 'white'
      },
      {
        variant: 'portes',
        mode: 'online',
        status: 'active',
        white_player_id: userId2,
        black_player_id: userId1,
        current_player_color: 'white'
      }
    ]).execute();

    const filters: MatchFilters = { status: 'active' };
    const result = await getMatches(filters);

    expect(result).toHaveLength(1);
    expect(result[0].status).toEqual('active');
  });

  it('should filter matches by multiple criteria', async () => {
    // Create matches with various combinations
    await db.insert(matchesTable).values([
      {
        variant: 'portes',
        mode: 'online',
        status: 'waiting',
        white_player_id: userId1,
        black_player_id: null,
        current_player_color: 'white'
      },
      {
        variant: 'portes',
        mode: 'ai',
        status: 'waiting',
        white_player_id: userId2,
        black_player_id: null,
        current_player_color: 'white'
      },
      {
        variant: 'plakoto',
        mode: 'online',
        status: 'waiting',
        white_player_id: userId1,
        black_player_id: null,
        current_player_color: 'white'
      }
    ]).execute();

    const filters: MatchFilters = { 
      variant: 'portes', 
      mode: 'online',
      status: 'waiting'
    };
    const result = await getMatches(filters);

    expect(result).toHaveLength(1);
    expect(result[0].variant).toEqual('portes');
    expect(result[0].mode).toEqual('online');
    expect(result[0].status).toEqual('waiting');
  });

  it('should return empty array when no matches exist', async () => {
    const result = await getMatches();

    expect(result).toHaveLength(0);
    expect(Array.isArray(result)).toBe(true);
  });

  it('should return empty array when filters match no matches', async () => {
    // Create a match that won't match the filter
    await db.insert(matchesTable).values({
      variant: 'portes',
      mode: 'online',
      status: 'waiting',
      white_player_id: userId1,
      black_player_id: null,
      current_player_color: 'white'
    }).execute();

    const filters: MatchFilters = { variant: 'plakoto' };
    const result = await getMatches(filters);

    expect(result).toHaveLength(0);
  });

  it('should handle matches with null black_player_id and winner_color', async () => {
    await db.insert(matchesTable).values({
      variant: 'portes',
      mode: 'online',
      status: 'waiting',
      white_player_id: userId1,
      black_player_id: null,
      current_player_color: 'white',
      winner_color: null
    }).execute();

    const result = await getMatches();

    expect(result).toHaveLength(1);
    expect(result[0].black_player_id).toBeNull();
    expect(result[0].winner_color).toBeNull();
  });
});