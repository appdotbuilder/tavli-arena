import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { usersTable, matchesTable, chatMessagesTable } from '../db/schema';
import { getChatMessages } from '../handlers/get_chat_messages';

describe('getChatMessages', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  it('should return empty array when no messages exist for match', async () => {
    // Create a user and match without messages
    const user = await db.insert(usersTable)
      .values({
        email: 'test@example.com',
        username: 'testuser',
        password_hash: 'hashedpassword'
      })
      .returning()
      .execute();

    const match = await db.insert(matchesTable)
      .values({
        variant: 'portes',
        mode: 'online',
        white_player_id: user[0].id
      })
      .returning()
      .execute();

    const messages = await getChatMessages(match[0].id);

    expect(messages).toHaveLength(0);
    expect(Array.isArray(messages)).toBe(true);
  });

  it('should return chat messages for specific match', async () => {
    // Create users
    const users = await db.insert(usersTable)
      .values([
        {
          email: 'user1@example.com',
          username: 'user1',
          password_hash: 'hashedpassword1'
        },
        {
          email: 'user2@example.com',
          username: 'user2',
          password_hash: 'hashedpassword2'
        }
      ])
      .returning()
      .execute();

    // Create match
    const match = await db.insert(matchesTable)
      .values({
        variant: 'portes',
        mode: 'online',
        white_player_id: users[0].id,
        black_player_id: users[1].id
      })
      .returning()
      .execute();

    // Create chat messages with different timestamps
    await db.insert(chatMessagesTable)
      .values([
        {
          match_id: match[0].id,
          user_id: users[0].id,
          message: 'Hello!'
        },
        {
          match_id: match[0].id,
          user_id: users[1].id,
          message: 'Hi there!'
        },
        {
          match_id: match[0].id,
          user_id: users[0].id,
          message: 'Good luck!'
        }
      ])
      .execute();

    const messages = await getChatMessages(match[0].id);

    expect(messages).toHaveLength(3);
    expect(messages[0].message).toEqual('Hello!');
    expect(messages[0].user_id).toEqual(users[0].id);
    expect(messages[1].message).toEqual('Hi there!');
    expect(messages[1].user_id).toEqual(users[1].id);
    expect(messages[2].message).toEqual('Good luck!');
    expect(messages[2].user_id).toEqual(users[0].id);

    // Verify all messages belong to the correct match
    messages.forEach(message => {
      expect(message.match_id).toEqual(match[0].id);
      expect(message.created_at).toBeInstanceOf(Date);
      expect(message.id).toBeDefined();
    });
  });

  it('should return messages ordered by creation time', async () => {
    // Create user and match
    const user = await db.insert(usersTable)
      .values({
        email: 'test@example.com',
        username: 'testuser',
        password_hash: 'hashedpassword'
      })
      .returning()
      .execute();

    const match = await db.insert(matchesTable)
      .values({
        variant: 'portes',
        mode: 'online',
        white_player_id: user[0].id
      })
      .returning()
      .execute();

    // Create messages with slight delay to ensure different timestamps
    const message1 = await db.insert(chatMessagesTable)
      .values({
        match_id: match[0].id,
        user_id: user[0].id,
        message: 'First message'
      })
      .returning()
      .execute();

    // Small delay to ensure different timestamps
    await new Promise(resolve => setTimeout(resolve, 10));

    const message2 = await db.insert(chatMessagesTable)
      .values({
        match_id: match[0].id,
        user_id: user[0].id,
        message: 'Second message'
      })
      .returning()
      .execute();

    await new Promise(resolve => setTimeout(resolve, 10));

    const message3 = await db.insert(chatMessagesTable)
      .values({
        match_id: match[0].id,
        user_id: user[0].id,
        message: 'Third message'
      })
      .returning()
      .execute();

    const messages = await getChatMessages(match[0].id);

    expect(messages).toHaveLength(3);
    expect(messages[0].message).toEqual('First message');
    expect(messages[1].message).toEqual('Second message');
    expect(messages[2].message).toEqual('Third message');

    // Verify chronological order
    expect(messages[0].created_at.getTime()).toBeLessThanOrEqual(messages[1].created_at.getTime());
    expect(messages[1].created_at.getTime()).toBeLessThanOrEqual(messages[2].created_at.getTime());
  });

  it('should not return messages from other matches', async () => {
    // Create users
    const users = await db.insert(usersTable)
      .values([
        {
          email: 'user1@example.com',
          username: 'user1',
          password_hash: 'hashedpassword1'
        },
        {
          email: 'user2@example.com',
          username: 'user2',
          password_hash: 'hashedpassword2'
        }
      ])
      .returning()
      .execute();

    // Create two different matches
    const matches = await db.insert(matchesTable)
      .values([
        {
          variant: 'portes',
          mode: 'online',
          white_player_id: users[0].id
        },
        {
          variant: 'plakoto',
          mode: 'online',
          white_player_id: users[1].id
        }
      ])
      .returning()
      .execute();

    // Create messages for both matches
    await db.insert(chatMessagesTable)
      .values([
        {
          match_id: matches[0].id,
          user_id: users[0].id,
          message: 'Message for match 1'
        },
        {
          match_id: matches[1].id,
          user_id: users[1].id,
          message: 'Message for match 2'
        },
        {
          match_id: matches[0].id,
          user_id: users[0].id,
          message: 'Another message for match 1'
        }
      ])
      .execute();

    // Get messages for first match only
    const match1Messages = await getChatMessages(matches[0].id);

    expect(match1Messages).toHaveLength(2);
    expect(match1Messages[0].message).toEqual('Message for match 1');
    expect(match1Messages[0].match_id).toEqual(matches[0].id);
    expect(match1Messages[1].message).toEqual('Another message for match 1');
    expect(match1Messages[1].match_id).toEqual(matches[0].id);

    // Get messages for second match only
    const match2Messages = await getChatMessages(matches[1].id);

    expect(match2Messages).toHaveLength(1);
    expect(match2Messages[0].message).toEqual('Message for match 2');
    expect(match2Messages[0].match_id).toEqual(matches[1].id);
  });

  it('should handle non-existent match gracefully', async () => {
    const messages = await getChatMessages(999999);

    expect(messages).toHaveLength(0);
    expect(Array.isArray(messages)).toBe(true);
  });
});