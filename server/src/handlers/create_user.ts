import { db } from '../db';
import { usersTable } from '../db/schema';
import { type CreateUserInput, type AuthResponse } from '../schema';
import { hash } from 'bcrypt';
import jwt from 'jsonwebtoken';

const SALT_ROUNDS = 12;
const JWT_SECRET = process.env['JWT_SECRET'] || 'fallback-secret-key';

export const createUser = async (input: CreateUserInput): Promise<AuthResponse> => {
  try {
    // Hash the password
    const password_hash = await hash(input.password, SALT_ROUNDS);

    // Insert user record
    const result = await db.insert(usersTable)
      .values({
        email: input.email,
        username: input.username,
        password_hash,
        elo_rating: 1200,
        wins: 0,
        losses: 0
      })
      .returning()
      .execute();

    const user = result[0];

    // Generate JWT token
    const token = jwt.sign(
      { 
        userId: user.id, 
        email: user.email,
        username: user.username 
      },
      JWT_SECRET,
      { expiresIn: '24h' }
    );

    return {
      user,
      token
    };
  } catch (error) {
    console.error('User creation failed:', error);
    throw error;
  }
};