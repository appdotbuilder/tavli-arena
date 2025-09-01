import { serial, text, pgTable, timestamp, integer, jsonb, pgEnum } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';

// Define enums for PostgreSQL
export const gameVariantEnum = pgEnum('game_variant', ['portes', 'plakoto', 'fevga']);
export const gameModeEnum = pgEnum('game_mode', ['ai', 'online', 'pass_and_play']);
export const matchStatusEnum = pgEnum('match_status', ['waiting', 'active', 'completed', 'abandoned']);
export const playerColorEnum = pgEnum('player_color', ['white', 'black']);
export const moveTypeEnum = pgEnum('move_type', ['move', 'bear_off', 'enter_from_bar', 'nail', 'blocked']);

// Users table
export const usersTable = pgTable('users', {
  id: serial('id').primaryKey(),
  email: text('email').notNull().unique(),
  username: text('username').notNull().unique(),
  password_hash: text('password_hash').notNull(),
  elo_rating: integer('elo_rating').notNull().default(1200),
  wins: integer('wins').notNull().default(0),
  losses: integer('losses').notNull().default(0),
  created_at: timestamp('created_at').defaultNow().notNull(),
  updated_at: timestamp('updated_at').defaultNow().notNull()
});

// Matches table
export const matchesTable = pgTable('matches', {
  id: serial('id').primaryKey(),
  variant: gameVariantEnum('variant').notNull(),
  mode: gameModeEnum('mode').notNull(),
  status: matchStatusEnum('status').notNull().default('waiting'),
  white_player_id: integer('white_player_id').notNull().references(() => usersTable.id),
  black_player_id: integer('black_player_id').references(() => usersTable.id),
  current_player_color: playerColorEnum('current_player_color').notNull().default('white'),
  winner_color: playerColorEnum('winner_color'),
  created_at: timestamp('created_at').defaultNow().notNull(),
  updated_at: timestamp('updated_at').defaultNow().notNull()
});

// Game states table - stores current state of each match
export const gameStatesTable = pgTable('game_states', {
  id: serial('id').primaryKey(),
  match_id: integer('match_id').notNull().references(() => matchesTable.id),
  board_state: jsonb('board_state').notNull(), // Array of board points
  dice: jsonb('dice').notNull(), // Array of two dice values
  available_moves: jsonb('available_moves').notNull(), // Array of available move indices
  turn_number: integer('turn_number').notNull().default(1),
  phase: text('phase').notNull().default('rolling'), // 'rolling', 'moving', 'waiting'
  created_at: timestamp('created_at').defaultNow().notNull()
});

// Moves table - stores all moves made in each match
export const movesTable = pgTable('moves', {
  id: serial('id').primaryKey(),
  match_id: integer('match_id').notNull().references(() => matchesTable.id),
  player_color: playerColorEnum('player_color').notNull(),
  from_point: integer('from_point').notNull(),
  to_point: integer('to_point').notNull(),
  dice_value: integer('dice_value').notNull(),
  move_type: moveTypeEnum('move_type').notNull(),
  turn_number: integer('turn_number').notNull(),
  created_at: timestamp('created_at').defaultNow().notNull()
});

// Chat messages table
export const chatMessagesTable = pgTable('chat_messages', {
  id: serial('id').primaryKey(),
  match_id: integer('match_id').notNull().references(() => matchesTable.id),
  user_id: integer('user_id').notNull().references(() => usersTable.id),
  message: text('message').notNull(),
  created_at: timestamp('created_at').defaultNow().notNull()
});

// Define relations
export const usersRelations = relations(usersTable, ({ many }) => ({
  whiteMatches: many(matchesTable, { relationName: 'whitePlayer' }),
  blackMatches: many(matchesTable, { relationName: 'blackPlayer' }),
  chatMessages: many(chatMessagesTable)
}));

export const matchesRelations = relations(matchesTable, ({ one, many }) => ({
  whitePlayer: one(usersTable, {
    fields: [matchesTable.white_player_id],
    references: [usersTable.id],
    relationName: 'whitePlayer'
  }),
  blackPlayer: one(usersTable, {
    fields: [matchesTable.black_player_id],
    references: [usersTable.id],
    relationName: 'blackPlayer'
  }),
  gameStates: many(gameStatesTable),
  moves: many(movesTable),
  chatMessages: many(chatMessagesTable)
}));

export const gameStatesRelations = relations(gameStatesTable, ({ one }) => ({
  match: one(matchesTable, {
    fields: [gameStatesTable.match_id],
    references: [matchesTable.id]
  })
}));

export const movesRelations = relations(movesTable, ({ one }) => ({
  match: one(matchesTable, {
    fields: [movesTable.match_id],
    references: [matchesTable.id]
  })
}));

export const chatMessagesRelations = relations(chatMessagesTable, ({ one }) => ({
  match: one(matchesTable, {
    fields: [chatMessagesTable.match_id],
    references: [matchesTable.id]
  }),
  user: one(usersTable, {
    fields: [chatMessagesTable.user_id],
    references: [usersTable.id]
  })
}));

// TypeScript types for the table schemas
export type User = typeof usersTable.$inferSelect;
export type NewUser = typeof usersTable.$inferInsert;

export type Match = typeof matchesTable.$inferSelect;
export type NewMatch = typeof matchesTable.$inferInsert;

export type GameState = typeof gameStatesTable.$inferSelect;
export type NewGameState = typeof gameStatesTable.$inferInsert;

export type Move = typeof movesTable.$inferSelect;
export type NewMove = typeof movesTable.$inferInsert;

export type ChatMessage = typeof chatMessagesTable.$inferSelect;
export type NewChatMessage = typeof chatMessagesTable.$inferInsert;

// Export all tables and relations for proper query building
export const tables = {
  users: usersTable,
  matches: matchesTable,
  gameStates: gameStatesTable,
  moves: movesTable,
  chatMessages: chatMessagesTable
};