import { db } from '../db';
import { usersTable } from '../db/schema';
import { eq } from 'drizzle-orm';
import { type User, type PlayerColor } from '../schema';

const K_FACTOR = 32; // Standard K-factor for ELO rating

/**
 * Calculate expected score for a player based on ELO ratings
 * Formula: E = 1 / (1 + 10^((Rb - Ra) / 400))
 */
const calculateExpectedScore = (playerRating: number, opponentRating: number): number => {
  return 1 / (1 + Math.pow(10, (opponentRating - playerRating) / 400));
};

/**
 * Calculate new ELO rating after a match
 * Formula: R' = R + K * (S - E)
 * where S is actual score (1 for win, 0 for loss) and E is expected score
 */
const calculateNewRating = (currentRating: number, expectedScore: number, actualScore: number): number => {
  const newRating = currentRating + K_FACTOR * (actualScore - expectedScore);
  return Math.round(newRating);
};

export const updateEloRating = async (
  whitePlayer: User,
  blackPlayer: User,
  winnerColor: PlayerColor
): Promise<{ whitePlayer: User; blackPlayer: User }> => {
  try {
    // Calculate expected scores for both players
    const whiteExpectedScore = calculateExpectedScore(whitePlayer.elo_rating, blackPlayer.elo_rating);
    const blackExpectedScore = calculateExpectedScore(blackPlayer.elo_rating, whitePlayer.elo_rating);

    // Determine actual scores based on winner
    const whiteActualScore = winnerColor === 'white' ? 1 : 0;
    const blackActualScore = winnerColor === 'black' ? 1 : 0;

    // Calculate new ratings
    const newWhiteRating = calculateNewRating(whitePlayer.elo_rating, whiteExpectedScore, whiteActualScore);
    const newBlackRating = calculateNewRating(blackPlayer.elo_rating, blackExpectedScore, blackActualScore);

    // Update win/loss counts
    const whiteWins = whitePlayer.wins + (winnerColor === 'white' ? 1 : 0);
    const whiteLosses = whitePlayer.losses + (winnerColor === 'black' ? 1 : 0);
    const blackWins = blackPlayer.wins + (winnerColor === 'black' ? 1 : 0);
    const blackLosses = blackPlayer.losses + (winnerColor === 'white' ? 1 : 0);

    // Update white player in database
    const updatedWhitePlayer = await db
      .update(usersTable)
      .set({
        elo_rating: newWhiteRating,
        wins: whiteWins,
        losses: whiteLosses,
        updated_at: new Date()
      })
      .where(eq(usersTable.id, whitePlayer.id))
      .returning()
      .execute();

    // Update black player in database
    const updatedBlackPlayer = await db
      .update(usersTable)
      .set({
        elo_rating: newBlackRating,
        wins: blackWins,
        losses: blackLosses,
        updated_at: new Date()
      })
      .where(eq(usersTable.id, blackPlayer.id))
      .returning()
      .execute();

    return {
      whitePlayer: updatedWhitePlayer[0],
      blackPlayer: updatedBlackPlayer[0]
    };
  } catch (error) {
    console.error('ELO rating update failed:', error);
    throw error;
  }
};