import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { usersTable } from '../db/schema';
import { type CreateUserInput } from '../schema';
import { createUser } from '../handlers/create_user';
import { eq } from 'drizzle-orm';
import { compare } from 'bcrypt';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env['JWT_SECRET'] || 'fallback-secret-key';

// Test input data
const testInput: CreateUserInput = {
  email: 'test@example.com',
  username: 'testuser',
  password: 'securepassword123'
};

describe('createUser', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  it('should create a user with correct data', async () => {
    const result = await createUser(testInput);

    // Validate user fields
    expect(result.user.email).toEqual('test@example.com');
    expect(result.user.username).toEqual('testuser');
    expect(result.user.elo_rating).toEqual(1200);
    expect(result.user.wins).toEqual(0);
    expect(result.user.losses).toEqual(0);
    expect(result.user.id).toBeDefined();
    expect(typeof result.user.id).toBe('number');
    expect(result.user.created_at).toBeInstanceOf(Date);
    expect(result.user.updated_at).toBeInstanceOf(Date);

    // Validate password is hashed (not plain text)
    expect(result.user.password_hash).toBeDefined();
    expect(result.user.password_hash).not.toEqual('securepassword123');
    expect(result.user.password_hash.length).toBeGreaterThan(50);

    // Validate JWT token is provided
    expect(result.token).toBeDefined();
    expect(typeof result.token).toBe('string');
    expect(result.token.length).toBeGreaterThan(20);
  });

  it('should save user to database correctly', async () => {
    const result = await createUser(testInput);

    // Query database to verify user was saved
    const users = await db.select()
      .from(usersTable)
      .where(eq(usersTable.id, result.user.id))
      .execute();

    expect(users).toHaveLength(1);
    const savedUser = users[0];
    
    expect(savedUser.email).toEqual('test@example.com');
    expect(savedUser.username).toEqual('testuser');
    expect(savedUser.elo_rating).toEqual(1200);
    expect(savedUser.wins).toEqual(0);
    expect(savedUser.losses).toEqual(0);
    expect(savedUser.password_hash).toBeDefined();
    expect(savedUser.created_at).toBeInstanceOf(Date);
    expect(savedUser.updated_at).toBeInstanceOf(Date);
  });

  it('should hash password correctly', async () => {
    const result = await createUser(testInput);

    // Verify password was hashed using bcrypt
    const isValidHash = await compare('securepassword123', result.user.password_hash);
    expect(isValidHash).toBe(true);

    // Verify wrong password doesn't match
    const isWrongPassword = await compare('wrongpassword', result.user.password_hash);
    expect(isWrongPassword).toBe(false);
  });

  it('should generate valid JWT token', async () => {
    const result = await createUser(testInput);

    // Decode and verify JWT token
    const decoded = jwt.verify(result.token, JWT_SECRET) as any;
    
    expect(decoded.userId).toEqual(result.user.id);
    expect(decoded.email).toEqual('test@example.com');
    expect(decoded.username).toEqual('testuser');
    expect(decoded.exp).toBeDefined();
    
    // Token should be valid for 24 hours
    const expirationTime = decoded.exp * 1000; // Convert to milliseconds
    const now = Date.now();
    const hoursUntilExpiration = (expirationTime - now) / (1000 * 60 * 60);
    
    expect(hoursUntilExpiration).toBeGreaterThan(23);
    expect(hoursUntilExpiration).toBeLessThan(25);
  });

  it('should reject duplicate email addresses', async () => {
    // Create first user
    await createUser(testInput);

    // Attempt to create user with same email
    const duplicateEmailInput: CreateUserInput = {
      email: 'test@example.com', // Same email
      username: 'differentuser',
      password: 'anotherpassword'
    };

    await expect(createUser(duplicateEmailInput)).rejects.toThrow();
  });

  it('should reject duplicate usernames', async () => {
    // Create first user
    await createUser(testInput);

    // Attempt to create user with same username
    const duplicateUsernameInput: CreateUserInput = {
      email: 'different@example.com',
      username: 'testuser', // Same username
      password: 'anotherpassword'
    };

    await expect(createUser(duplicateUsernameInput)).rejects.toThrow();
  });

  it('should handle different password lengths', async () => {
    const shortPasswordInput: CreateUserInput = {
      email: 'short@example.com',
      username: 'shortuser',
      password: '123456' // Minimum length
    };

    const result = await createUser(shortPasswordInput);
    
    expect(result.user.email).toEqual('short@example.com');
    expect(result.user.username).toEqual('shortuser');
    
    // Verify password was hashed correctly
    const isValidHash = await compare('123456', result.user.password_hash);
    expect(isValidHash).toBe(true);
  });

  it('should create multiple unique users successfully', async () => {
    const user1Input: CreateUserInput = {
      email: 'user1@example.com',
      username: 'user1',
      password: 'password1'
    };

    const user2Input: CreateUserInput = {
      email: 'user2@example.com',
      username: 'user2',
      password: 'password2'
    };

    const result1 = await createUser(user1Input);
    const result2 = await createUser(user2Input);

    // Verify both users were created with unique IDs
    expect(result1.user.id).not.toEqual(result2.user.id);
    expect(result1.user.email).toEqual('user1@example.com');
    expect(result2.user.email).toEqual('user2@example.com');
    expect(result1.user.username).toEqual('user1');
    expect(result2.user.username).toEqual('user2');

    // Verify both have valid tokens
    expect(result1.token).toBeDefined();
    expect(result2.token).toBeDefined();
    expect(result1.token).not.toEqual(result2.token);
  });
});