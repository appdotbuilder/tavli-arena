import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { usersTable } from '../db/schema';
import { type User, type PlayerColor } from '../schema';
import { updateEloRating } from '../handlers/update_elo_rating';
import { eq } from 'drizzle-orm';

// Test users with different ELO ratings
const createTestUser = async (email: string, username: string, elo: number = 1200): Promise<User> => {
  const result = await db
    .insert(usersTable)
    .values({
      email,
      username,
      password_hash: 'test_hash',
      elo_rating: elo,
      wins: 0,
      losses: 0
    })
    .returning()
    .execute();
  
  return result[0];
};

describe('updateEloRating', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  it('should update ELO ratings when white player wins', async () => {
    // Create two players with equal ratings
    const whitePlayer = await createTestUser('white@test.com', 'white_player', 1200);
    const blackPlayer = await createTestUser('black@test.com', 'black_player', 1200);

    const result = await updateEloRating(whitePlayer, blackPlayer, 'white');

    // With equal ratings, winner gains 16 points, loser loses 16 points (K=32, expected=0.5)
    expect(result.whitePlayer.elo_rating).toBe(1216);
    expect(result.blackPlayer.elo_rating).toBe(1184);
    
    // Check win/loss counts
    expect(result.whitePlayer.wins).toBe(1);
    expect(result.whitePlayer.losses).toBe(0);
    expect(result.blackPlayer.wins).toBe(0);
    expect(result.blackPlayer.losses).toBe(1);
  });

  it('should update ELO ratings when black player wins', async () => {
    const whitePlayer = await createTestUser('white@test.com', 'white_player', 1200);
    const blackPlayer = await createTestUser('black@test.com', 'black_player', 1200);

    const result = await updateEloRating(whitePlayer, blackPlayer, 'black');

    // Black player wins, white player loses
    expect(result.whitePlayer.elo_rating).toBe(1184);
    expect(result.blackPlayer.elo_rating).toBe(1216);
    
    // Check win/loss counts
    expect(result.whitePlayer.wins).toBe(0);
    expect(result.whitePlayer.losses).toBe(1);
    expect(result.blackPlayer.wins).toBe(1);
    expect(result.blackPlayer.losses).toBe(0);
  });

  it('should handle rating changes when higher-rated player wins', async () => {
    // Higher-rated player (expected to win) vs lower-rated player
    const whitePlayer = await createTestUser('white@test.com', 'white_player', 1400);
    const blackPlayer = await createTestUser('black@test.com', 'black_player', 1200);

    const result = await updateEloRating(whitePlayer, blackPlayer, 'white');

    // Higher-rated player should gain fewer points when winning against lower-rated opponent
    expect(result.whitePlayer.elo_rating).toBe(1408); // Gains ~8 points
    expect(result.blackPlayer.elo_rating).toBe(1192); // Loses ~8 points
    
    // Verify the rating change is less than the equal-rating scenario
    expect(result.whitePlayer.elo_rating - whitePlayer.elo_rating).toBeLessThan(16);
    expect(blackPlayer.elo_rating - result.blackPlayer.elo_rating).toBeLessThan(16);
  });

  it('should handle rating changes when lower-rated player wins (upset)', async () => {
    // Lower-rated player beats higher-rated player (upset)
    const whitePlayer = await createTestUser('white@test.com', 'white_player', 1200);
    const blackPlayer = await createTestUser('black@test.com', 'black_player', 1400);

    const result = await updateEloRating(whitePlayer, blackPlayer, 'white');

    // Lower-rated player should gain more points for the upset win
    expect(result.whitePlayer.elo_rating).toBe(1224); // Gains ~24 points
    expect(result.blackPlayer.elo_rating).toBe(1376); // Loses ~24 points
    
    // Verify the rating change is more than the equal-rating scenario
    expect(result.whitePlayer.elo_rating - whitePlayer.elo_rating).toBeGreaterThan(16);
    expect(blackPlayer.elo_rating - result.blackPlayer.elo_rating).toBeGreaterThan(16);
  });

  it('should preserve existing win/loss counts', async () => {
    // Create players with existing win/loss records
    const whitePlayerResult = await db
      .insert(usersTable)
      .values({
        email: 'white@test.com',
        username: 'white_player',
        password_hash: 'test_hash',
        elo_rating: 1300,
        wins: 5,
        losses: 3
      })
      .returning()
      .execute();

    const blackPlayerResult = await db
      .insert(usersTable)
      .values({
        email: 'black@test.com',
        username: 'black_player',
        password_hash: 'test_hash',
        elo_rating: 1250,
        wins: 7,
        losses: 4
      })
      .returning()
      .execute();

    const whitePlayer = whitePlayerResult[0];
    const blackPlayer = blackPlayerResult[0];

    const result = await updateEloRating(whitePlayer, blackPlayer, 'black');

    // Check that existing counts are preserved and incremented correctly
    expect(result.whitePlayer.wins).toBe(5); // No change
    expect(result.whitePlayer.losses).toBe(4); // +1
    expect(result.blackPlayer.wins).toBe(8); // +1
    expect(result.blackPlayer.losses).toBe(4); // No change
  });

  it('should persist changes to the database', async () => {
    const whitePlayer = await createTestUser('white@test.com', 'white_player', 1200);
    const blackPlayer = await createTestUser('black@test.com', 'black_player', 1200);

    await updateEloRating(whitePlayer, blackPlayer, 'white');

    // Verify changes were persisted to database
    const updatedWhitePlayer = await db
      .select()
      .from(usersTable)
      .where(eq(usersTable.id, whitePlayer.id))
      .execute();

    const updatedBlackPlayer = await db
      .select()
      .from(usersTable)
      .where(eq(usersTable.id, blackPlayer.id))
      .execute();

    expect(updatedWhitePlayer[0].elo_rating).toBe(1216);
    expect(updatedWhitePlayer[0].wins).toBe(1);
    expect(updatedWhitePlayer[0].losses).toBe(0);

    expect(updatedBlackPlayer[0].elo_rating).toBe(1184);
    expect(updatedBlackPlayer[0].wins).toBe(0);
    expect(updatedBlackPlayer[0].losses).toBe(1);
  });

  it('should update the updated_at timestamp', async () => {
    const whitePlayer = await createTestUser('white@test.com', 'white_player', 1200);
    const blackPlayer = await createTestUser('black@test.com', 'black_player', 1200);

    const beforeUpdate = new Date();
    // Add small delay to ensure timestamp difference
    await new Promise(resolve => setTimeout(resolve, 10));
    const result = await updateEloRating(whitePlayer, blackPlayer, 'white');

    // Check that updated_at is newer than the original creation time
    expect(result.whitePlayer.updated_at.getTime()).toBeGreaterThan(whitePlayer.updated_at.getTime());
    expect(result.blackPlayer.updated_at.getTime()).toBeGreaterThan(blackPlayer.updated_at.getTime());
  });

  it('should handle extreme rating differences correctly', async () => {
    // Very high rated player vs beginner
    const whitePlayer = await createTestUser('white@test.com', 'white_player', 2000);
    const blackPlayer = await createTestUser('black@test.com', 'black_player', 800);

    // High-rated player wins (expected outcome)
    const result1 = await updateEloRating(whitePlayer, blackPlayer, 'white');
    
    // Should gain very few points (less than 2)
    expect(result1.whitePlayer.elo_rating - whitePlayer.elo_rating).toBeLessThan(2);
    expect(blackPlayer.elo_rating - result1.blackPlayer.elo_rating).toBeLessThan(2);

    // Reset for second test - beginner wins (major upset)
    const whitePlayer2 = await createTestUser('white2@test.com', 'white_player2', 2000);
    const blackPlayer2 = await createTestUser('black2@test.com', 'black_player2', 800);
    
    const result2 = await updateEloRating(whitePlayer2, blackPlayer2, 'black');
    
    // Should have major rating swing (close to 32 points)
    expect(result2.blackPlayer.elo_rating - blackPlayer2.elo_rating).toBeGreaterThan(30);
    expect(whitePlayer2.elo_rating - result2.whitePlayer.elo_rating).toBeGreaterThan(30);
  });
});