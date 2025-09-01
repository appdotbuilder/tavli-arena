import { db } from '../db';
import { usersTable } from '../db/schema';
import { type User } from '../schema';
import { eq } from 'drizzle-orm';

export const getUserProfile = async (userId: number): Promise<User | null> => {
  try {
    // Query user profile by ID
    const users = await db.select()
      .from(usersTable)
      .where(eq(usersTable.id, userId))
      .execute();

    // Return null if user not found
    if (users.length === 0) {
      return null;
    }

    // Return the user profile
    return users[0];
  } catch (error) {
    console.error('User profile fetch failed:', error);
    throw error;
  }
};