import { db } from '../db';
import { usersTable } from '../db/schema';
import { type LoginInput, type AuthResponse } from '../schema';
import { eq } from 'drizzle-orm';
import * as bcrypt from 'bcrypt';
import * as jwt from 'jsonwebtoken';

export const login = async (input: LoginInput): Promise<AuthResponse> => {
  try {
    // Find user by email
    const users = await db.select()
      .from(usersTable)
      .where(eq(usersTable.email, input.email))
      .execute();

    if (users.length === 0) {
      throw new Error('Invalid email or password');
    }

    const user = users[0];

    // Verify password
    const isPasswordValid = await bcrypt.compare(input.password, user.password_hash);
    if (!isPasswordValid) {
      throw new Error('Invalid email or password');
    }

    // Generate JWT token
    const jwtSecret = process.env['JWT_SECRET'] || 'default-secret-key-for-development';
    const token = jwt.sign(
      { 
        userId: user.id, 
        email: user.email 
      }, 
      jwtSecret, 
      { 
        expiresIn: '7d' 
      }
    );

    // Return user data and token
    return {
      user: {
        id: user.id,
        email: user.email,
        username: user.username,
        password_hash: user.password_hash,
        elo_rating: user.elo_rating,
        wins: user.wins,
        losses: user.losses,
        created_at: user.created_at,
        updated_at: user.updated_at
      },
      token
    };
  } catch (error) {
    console.error('Login failed:', error);
    throw error;
  }
};