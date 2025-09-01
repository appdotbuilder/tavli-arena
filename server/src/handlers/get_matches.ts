import { db } from '../db';
import { matchesTable } from '../db/schema';
import { type Match, type MatchFilters } from '../schema';
import { eq, and, type SQL } from 'drizzle-orm';

export const getMatches = async (filters?: MatchFilters): Promise<Match[]> => {
  try {
    // Build conditions array for filtering
    const conditions: SQL<unknown>[] = [];

    if (filters?.variant) {
      conditions.push(eq(matchesTable.variant, filters.variant));
    }

    if (filters?.mode) {
      conditions.push(eq(matchesTable.mode, filters.mode));
    }

    if (filters?.status) {
      conditions.push(eq(matchesTable.status, filters.status));
    }

    // Build query based on whether we have conditions
    const results = conditions.length > 0
      ? await db.select()
          .from(matchesTable)
          .where(conditions.length === 1 ? conditions[0] : and(...conditions))
          .execute()
      : await db.select()
          .from(matchesTable)
          .execute();

    return results.map(match => ({
      ...match,
      created_at: match.created_at,
      updated_at: match.updated_at
    }));
  } catch (error) {
    console.error('Get matches failed:', error);
    throw error;
  }
};