import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { usersTable } from '../db/schema';
import { getUserProfile } from '../handlers/get_user_profile';

describe('getUserProfile', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  it('should return user profile when user exists', async () => {
    // Create a test user
    const testUser = await db.insert(usersTable)
      .values({
        email: 'test@example.com',
        username: 'testplayer',
        password_hash: 'hashedpassword123',
        elo_rating: 1350,
        wins: 10,
        losses: 5
      })
      .returning()
      .execute();

    const userId = testUser[0].id;

    // Fetch user profile
    const result = await getUserProfile(userId);

    expect(result).not.toBeNull();
    expect(result!.id).toBe(userId);
    expect(result!.email).toBe('test@example.com');
    expect(result!.username).toBe('testplayer');
    expect(result!.password_hash).toBe('hashedpassword123');
    expect(result!.elo_rating).toBe(1350);
    expect(result!.wins).toBe(10);
    expect(result!.losses).toBe(5);
    expect(result!.created_at).toBeInstanceOf(Date);
    expect(result!.updated_at).toBeInstanceOf(Date);
  });

  it('should return null when user does not exist', async () => {
    // Try to fetch a non-existent user
    const result = await getUserProfile(99999);

    expect(result).toBeNull();
  });

  it('should return user with default values when created with defaults', async () => {
    // Create a user with minimal required fields (defaults applied)
    const testUser = await db.insert(usersTable)
      .values({
        email: 'minimal@example.com',
        username: 'minimal',
        password_hash: 'hash123'
        // elo_rating, wins, losses will use default values
      })
      .returning()
      .execute();

    const userId = testUser[0].id;

    // Fetch user profile
    const result = await getUserProfile(userId);

    expect(result).not.toBeNull();
    expect(result!.id).toBe(userId);
    expect(result!.email).toBe('minimal@example.com');
    expect(result!.username).toBe('minimal');
    expect(result!.elo_rating).toBe(1200); // Default value
    expect(result!.wins).toBe(0); // Default value
    expect(result!.losses).toBe(0); // Default value
    expect(result!.created_at).toBeInstanceOf(Date);
    expect(result!.updated_at).toBeInstanceOf(Date);
  });

  it('should fetch correct user when multiple users exist', async () => {
    // Create multiple test users
    const user1 = await db.insert(usersTable)
      .values({
        email: 'user1@example.com',
        username: 'player1',
        password_hash: 'hash1',
        elo_rating: 1100,
        wins: 2,
        losses: 8
      })
      .returning()
      .execute();

    const user2 = await db.insert(usersTable)
      .values({
        email: 'user2@example.com',
        username: 'player2',
        password_hash: 'hash2',
        elo_rating: 1500,
        wins: 15,
        losses: 3
      })
      .returning()
      .execute();

    // Fetch the second user's profile
    const result = await getUserProfile(user2[0].id);

    expect(result).not.toBeNull();
    expect(result!.id).toBe(user2[0].id);
    expect(result!.email).toBe('user2@example.com');
    expect(result!.username).toBe('player2');
    expect(result!.elo_rating).toBe(1500);
    expect(result!.wins).toBe(15);
    expect(result!.losses).toBe(3);
  });
});