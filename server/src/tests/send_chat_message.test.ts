import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { chatMessagesTable, matchesTable, usersTable } from '../db/schema';
import { type SendMessageInput } from '../schema';
import { sendChatMessage } from '../handlers/send_chat_message';
import { eq } from 'drizzle-orm';

describe('sendChatMessage', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  let testUser1: any;
  let testUser2: any;
  let testMatch: any;

  beforeEach(async () => {
    // Create test users
    const users = await db.insert(usersTable)
      .values([
        {
          email: 'player1@test.com',
          username: 'player1',
          password_hash: 'hash1'
        },
        {
          email: 'player2@test.com',
          username: 'player2',
          password_hash: 'hash2'
        }
      ])
      .returning()
      .execute();

    testUser1 = users[0];
    testUser2 = users[1];

    // Create test match
    const matches = await db.insert(matchesTable)
      .values({
        variant: 'portes',
        mode: 'online',
        white_player_id: testUser1.id,
        black_player_id: testUser2.id,
        status: 'active'
      })
      .returning()
      .execute();

    testMatch = matches[0];
  });

  it('should send a chat message from white player', async () => {
    const input: SendMessageInput = {
      match_id: testMatch.id,
      user_id: testUser1.id,
      message: 'Good luck!'
    };

    const result = await sendChatMessage(input);

    expect(result.id).toBeDefined();
    expect(result.match_id).toEqual(testMatch.id);
    expect(result.user_id).toEqual(testUser1.id);
    expect(result.message).toEqual('Good luck!');
    expect(result.created_at).toBeInstanceOf(Date);
  });

  it('should send a chat message from black player', async () => {
    const input: SendMessageInput = {
      match_id: testMatch.id,
      user_id: testUser2.id,
      message: 'Thanks, you too!'
    };

    const result = await sendChatMessage(input);

    expect(result.id).toBeDefined();
    expect(result.match_id).toEqual(testMatch.id);
    expect(result.user_id).toEqual(testUser2.id);
    expect(result.message).toEqual('Thanks, you too!');
    expect(result.created_at).toBeInstanceOf(Date);
  });

  it('should save message to database', async () => {
    const input: SendMessageInput = {
      match_id: testMatch.id,
      user_id: testUser1.id,
      message: 'Hello world!'
    };

    const result = await sendChatMessage(input);

    const messages = await db.select()
      .from(chatMessagesTable)
      .where(eq(chatMessagesTable.id, result.id))
      .execute();

    expect(messages).toHaveLength(1);
    expect(messages[0].match_id).toEqual(testMatch.id);
    expect(messages[0].user_id).toEqual(testUser1.id);
    expect(messages[0].message).toEqual('Hello world!');
    expect(messages[0].created_at).toBeInstanceOf(Date);
  });

  it('should handle multiple messages in sequence', async () => {
    const messages = [
      { user_id: testUser1.id, message: 'First message' },
      { user_id: testUser2.id, message: 'Second message' },
      { user_id: testUser1.id, message: 'Third message' }
    ];

    const results = [];
    for (const msg of messages) {
      const input: SendMessageInput = {
        match_id: testMatch.id,
        user_id: msg.user_id,
        message: msg.message
      };
      results.push(await sendChatMessage(input));
    }

    expect(results).toHaveLength(3);
    
    // Verify all messages are in database
    const allMessages = await db.select()
      .from(chatMessagesTable)
      .where(eq(chatMessagesTable.match_id, testMatch.id))
      .execute();

    expect(allMessages).toHaveLength(3);
    expect(allMessages[0].message).toEqual('First message');
    expect(allMessages[1].message).toEqual('Second message');
    expect(allMessages[2].message).toEqual('Third message');
  });

  it('should handle maximum length message', async () => {
    const longMessage = 'A'.repeat(500); // Max allowed length
    
    const input: SendMessageInput = {
      match_id: testMatch.id,
      user_id: testUser1.id,
      message: longMessage
    };

    const result = await sendChatMessage(input);

    expect(result.message).toEqual(longMessage);
    expect(result.message).toHaveLength(500);
  });

  it('should reject message for non-existent match', async () => {
    const input: SendMessageInput = {
      match_id: 99999,
      user_id: testUser1.id,
      message: 'This should fail'
    };

    await expect(sendChatMessage(input))
      .rejects.toThrow(/match.*not found/i);
  });

  it('should reject message for non-existent user', async () => {
    const input: SendMessageInput = {
      match_id: testMatch.id,
      user_id: 99999,
      message: 'This should fail'
    };

    await expect(sendChatMessage(input))
      .rejects.toThrow(/user.*not found/i);
  });

  it('should reject message from non-participant user', async () => {
    // Create a third user who is not part of the match
    const nonParticipant = await db.insert(usersTable)
      .values({
        email: 'outsider@test.com',
        username: 'outsider',
        password_hash: 'hash3'
      })
      .returning()
      .execute();

    const input: SendMessageInput = {
      match_id: testMatch.id,
      user_id: nonParticipant[0].id,
      message: 'I should not be able to send this'
    };

    await expect(sendChatMessage(input))
      .rejects.toThrow(/not a participant/i);
  });

  it('should allow messages in match with only white player', async () => {
    // Create match with only white player (waiting for black player)
    const waitingMatch = await db.insert(matchesTable)
      .values({
        variant: 'portes',
        mode: 'online',
        white_player_id: testUser1.id,
        black_player_id: null,
        status: 'waiting'
      })
      .returning()
      .execute();

    const input: SendMessageInput = {
      match_id: waitingMatch[0].id,
      user_id: testUser1.id,
      message: 'Looking for opponent'
    };

    const result = await sendChatMessage(input);

    expect(result.message).toEqual('Looking for opponent');
    expect(result.user_id).toEqual(testUser1.id);
  });

  it('should preserve message content exactly', async () => {
    const specialMessage = 'Special chars: !@#$%^&*()_+-={}[]|\\:";\'<>?,./';
    
    const input: SendMessageInput = {
      match_id: testMatch.id,
      user_id: testUser1.id,
      message: specialMessage
    };

    const result = await sendChatMessage(input);

    expect(result.message).toEqual(specialMessage);
  });
});