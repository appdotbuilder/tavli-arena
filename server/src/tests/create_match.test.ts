import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { matchesTable, usersTable } from '../db/schema';
import { type CreateMatchInput } from '../schema';
import { createMatch } from '../handlers/create_match';
import { eq } from 'drizzle-orm';

// Test user data
const testUser = {
  email: 'test@example.com',
  username: 'testuser',
  password_hash: 'hashedpassword',
  elo_rating: 1200,
  wins: 0,
  losses: 0
};

// Test match input
const testMatchInput: CreateMatchInput = {
  variant: 'portes',
  mode: 'online',
  white_player_id: 1 // Will be set after creating user
};

describe('createMatch', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  it('should create a match with correct fields', async () => {
    // Create test user first
    const userResult = await db.insert(usersTable)
      .values(testUser)
      .returning()
      .execute();
    
    const userId = userResult[0].id;
    const matchInput = { ...testMatchInput, white_player_id: userId };

    const result = await createMatch(matchInput);

    // Verify match properties
    expect(result.id).toBeDefined();
    expect(result.variant).toEqual('portes');
    expect(result.mode).toEqual('online');
    expect(result.status).toEqual('waiting');
    expect(result.white_player_id).toEqual(userId);
    expect(result.black_player_id).toBeNull();
    expect(result.current_player_color).toEqual('white');
    expect(result.winner_color).toBeNull();
    expect(result.created_at).toBeInstanceOf(Date);
    expect(result.updated_at).toBeInstanceOf(Date);
  });

  it('should save match to database correctly', async () => {
    // Create test user
    const userResult = await db.insert(usersTable)
      .values(testUser)
      .returning()
      .execute();
    
    const userId = userResult[0].id;
    const matchInput = { ...testMatchInput, white_player_id: userId };

    const result = await createMatch(matchInput);

    // Query the database to verify the match was saved
    const matches = await db.select()
      .from(matchesTable)
      .where(eq(matchesTable.id, result.id))
      .execute();

    expect(matches).toHaveLength(1);
    const savedMatch = matches[0];
    expect(savedMatch.variant).toEqual('portes');
    expect(savedMatch.mode).toEqual('online');
    expect(savedMatch.status).toEqual('waiting');
    expect(savedMatch.white_player_id).toEqual(userId);
    expect(savedMatch.black_player_id).toBeNull();
    expect(savedMatch.current_player_color).toEqual('white');
    expect(savedMatch.winner_color).toBeNull();
  });

  it('should create matches with different variants', async () => {
    // Create test user
    const userResult = await db.insert(usersTable)
      .values(testUser)
      .returning()
      .execute();
    
    const userId = userResult[0].id;

    // Test all game variants
    const variants = ['portes', 'plakoto', 'fevga'] as const;
    
    for (const variant of variants) {
      const matchInput: CreateMatchInput = {
        variant,
        mode: 'online',
        white_player_id: userId
      };

      const result = await createMatch(matchInput);
      expect(result.variant).toEqual(variant);
    }
  });

  it('should create matches with different modes', async () => {
    // Create test user
    const userResult = await db.insert(usersTable)
      .values(testUser)
      .returning()
      .execute();
    
    const userId = userResult[0].id;

    // Test all game modes
    const modes = ['ai', 'online', 'pass_and_play'] as const;
    
    for (const mode of modes) {
      const matchInput: CreateMatchInput = {
        variant: 'portes',
        mode,
        white_player_id: userId
      };

      const result = await createMatch(matchInput);
      expect(result.mode).toEqual(mode);
    }
  });

  it('should throw error when white player does not exist', async () => {
    const invalidMatchInput: CreateMatchInput = {
      variant: 'portes',
      mode: 'online',
      white_player_id: 999 // Non-existent user ID
    };

    await expect(createMatch(invalidMatchInput)).rejects.toThrow(/user with id 999 does not exist/i);
  });

  it('should create multiple matches for the same user', async () => {
    // Create test user
    const userResult = await db.insert(usersTable)
      .values(testUser)
      .returning()
      .execute();
    
    const userId = userResult[0].id;

    // Create multiple matches
    const match1Input: CreateMatchInput = {
      variant: 'portes',
      mode: 'online',
      white_player_id: userId
    };

    const match2Input: CreateMatchInput = {
      variant: 'plakoto',
      mode: 'ai',
      white_player_id: userId
    };

    const result1 = await createMatch(match1Input);
    const result2 = await createMatch(match2Input);

    // Verify both matches were created with different IDs
    expect(result1.id).not.toEqual(result2.id);
    expect(result1.white_player_id).toEqual(userId);
    expect(result2.white_player_id).toEqual(userId);
    expect(result1.variant).toEqual('portes');
    expect(result2.variant).toEqual('plakoto');
  });

  it('should set default values correctly', async () => {
    // Create test user
    const userResult = await db.insert(usersTable)
      .values(testUser)
      .returning()
      .execute();
    
    const userId = userResult[0].id;
    const matchInput = { ...testMatchInput, white_player_id: userId };

    const result = await createMatch(matchInput);

    // Verify default values are set correctly
    expect(result.status).toEqual('waiting');
    expect(result.current_player_color).toEqual('white');
    expect(result.black_player_id).toBeNull();
    expect(result.winner_color).toBeNull();
    expect(result.created_at).toBeInstanceOf(Date);
    expect(result.updated_at).toBeInstanceOf(Date);
  });
});