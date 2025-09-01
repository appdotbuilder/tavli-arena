import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { usersTable } from '../db/schema';
import { type LoginInput } from '../schema';
import { login } from '../handlers/login';
import * as bcrypt from 'bcrypt';
import * as jwt from 'jsonwebtoken';

// Test data
const testUser = {
  email: 'test@example.com',
  username: 'testuser',
  password: 'password123'
};

const loginInput: LoginInput = {
  email: testUser.email,
  password: testUser.password
};

describe('login', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  beforeEach(async () => {
    // Create test user with hashed password
    const passwordHash = await bcrypt.hash(testUser.password, 10);
    await db.insert(usersTable)
      .values({
        email: testUser.email,
        username: testUser.username,
        password_hash: passwordHash,
        elo_rating: 1350,
        wins: 5,
        losses: 3
      })
      .execute();
  });

  it('should authenticate user with valid credentials', async () => {
    const result = await login(loginInput);

    // Verify user data
    expect(result.user.email).toEqual(testUser.email);
    expect(result.user.username).toEqual(testUser.username);
    expect(result.user.elo_rating).toEqual(1350);
    expect(result.user.wins).toEqual(5);
    expect(result.user.losses).toEqual(3);
    expect(result.user.id).toBeDefined();
    expect(result.user.created_at).toBeInstanceOf(Date);
    expect(result.user.updated_at).toBeInstanceOf(Date);

    // Verify token exists
    expect(result.token).toBeDefined();
    expect(typeof result.token).toBe('string');
    expect(result.token.length).toBeGreaterThan(0);
  });

  it('should generate valid JWT token', async () => {
    const result = await login(loginInput);
    
    const jwtSecret = process.env['JWT_SECRET'] || 'default-secret-key-for-development';
    const decoded = jwt.verify(result.token, jwtSecret) as any;

    expect(decoded.userId).toEqual(result.user.id);
    expect(decoded.email).toEqual(testUser.email);
    expect(decoded.exp).toBeDefined(); // Token should have expiration
  });

  it('should reject login with invalid email', async () => {
    const invalidInput: LoginInput = {
      email: 'nonexistent@example.com',
      password: testUser.password
    };

    await expect(login(invalidInput)).rejects.toThrow(/invalid email or password/i);
  });

  it('should reject login with invalid password', async () => {
    const invalidInput: LoginInput = {
      email: testUser.email,
      password: 'wrongpassword'
    };

    await expect(login(invalidInput)).rejects.toThrow(/invalid email or password/i);
  });

  it('should verify password hash correctly', async () => {
    // Create user with known password hash
    const knownPassword = 'knownpass123';
    const knownHash = await bcrypt.hash(knownPassword, 10);
    
    await db.insert(usersTable)
      .values({
        email: 'known@example.com',
        username: 'knownuser',
        password_hash: knownHash,
        elo_rating: 1200,
        wins: 0,
        losses: 0
      })
      .execute();

    const validLogin: LoginInput = {
      email: 'known@example.com',
      password: knownPassword
    };

    const result = await login(validLogin);
    expect(result.user.email).toEqual('known@example.com');

    // Test wrong password fails
    const invalidLogin: LoginInput = {
      email: 'known@example.com',
      password: 'wrongpassword'
    };

    await expect(login(invalidLogin)).rejects.toThrow(/invalid email or password/i);
  });

  it('should handle case-sensitive email matching', async () => {
    const uppercaseEmailInput: LoginInput = {
      email: 'TEST@EXAMPLE.COM',
      password: testUser.password
    };

    // Should fail since email case doesn't match
    await expect(login(uppercaseEmailInput)).rejects.toThrow(/invalid email or password/i);
  });
});