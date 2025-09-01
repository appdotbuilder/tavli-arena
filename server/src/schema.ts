import { z } from 'zod';

// Enums for game variants and statuses
export const gameVariantEnum = z.enum(['portes', 'plakoto', 'fevga']);
export type GameVariant = z.infer<typeof gameVariantEnum>;

export const gameModeEnum = z.enum(['ai', 'online', 'pass_and_play']);
export type GameMode = z.infer<typeof gameModeEnum>;

export const matchStatusEnum = z.enum(['waiting', 'active', 'completed', 'abandoned']);
export type MatchStatus = z.infer<typeof matchStatusEnum>;

export const playerColorEnum = z.enum(['white', 'black']);
export type PlayerColor = z.infer<typeof playerColorEnum>;

export const moveTypeEnum = z.enum(['move', 'bear_off', 'enter_from_bar', 'nail', 'blocked']);
export type MoveType = z.infer<typeof moveTypeEnum>;

// User schemas
export const userSchema = z.object({
  id: z.number(),
  email: z.string().email(),
  username: z.string(),
  password_hash: z.string(),
  elo_rating: z.number(),
  wins: z.number().int(),
  losses: z.number().int(),
  created_at: z.coerce.date(),
  updated_at: z.coerce.date()
});

export type User = z.infer<typeof userSchema>;

export const createUserInputSchema = z.object({
  email: z.string().email(),
  username: z.string().min(3).max(20),
  password: z.string().min(6)
});

export type CreateUserInput = z.infer<typeof createUserInputSchema>;

export const loginInputSchema = z.object({
  email: z.string().email(),
  password: z.string()
});

export type LoginInput = z.infer<typeof loginInputSchema>;

// Match schemas
export const matchSchema = z.object({
  id: z.number(),
  variant: gameVariantEnum,
  mode: gameModeEnum,
  status: matchStatusEnum,
  white_player_id: z.number(),
  black_player_id: z.number().nullable(),
  current_player_color: playerColorEnum,
  winner_color: playerColorEnum.nullable(),
  created_at: z.coerce.date(),
  updated_at: z.coerce.date()
});

export type Match = z.infer<typeof matchSchema>;

export const createMatchInputSchema = z.object({
  variant: gameVariantEnum,
  mode: gameModeEnum,
  white_player_id: z.number()
});

export type CreateMatchInput = z.infer<typeof createMatchInputSchema>;

export const joinMatchInputSchema = z.object({
  match_id: z.number(),
  black_player_id: z.number()
});

export type JoinMatchInput = z.infer<typeof joinMatchInputSchema>;

// Game state schemas
export const boardPointSchema = z.object({
  point: z.number().int().min(0).max(25), // 0 = bar, 25 = off board
  color: playerColorEnum.nullable(),
  count: z.number().int().min(0)
});

export type BoardPoint = z.infer<typeof boardPointSchema>;

export const gameStateSchema = z.object({
  id: z.number(),
  match_id: z.number(),
  board_state: z.array(boardPointSchema), // 26 points (0-25)
  dice: z.array(z.number().int().min(1).max(6)).length(2),
  available_moves: z.array(z.number().int()),
  turn_number: z.number().int(),
  phase: z.enum(['rolling', 'moving', 'waiting']),
  created_at: z.coerce.date()
});

export type GameState = z.infer<typeof gameStateSchema>;

export const createGameStateInputSchema = z.object({
  match_id: z.number(),
  board_state: z.array(boardPointSchema),
  dice: z.array(z.number().int().min(1).max(6)).length(2),
  available_moves: z.array(z.number().int()),
  turn_number: z.number().int(),
  phase: z.enum(['rolling', 'moving', 'waiting'])
});

export type CreateGameStateInput = z.infer<typeof createGameStateInputSchema>;

// Move schemas
export const moveSchema = z.object({
  id: z.number(),
  match_id: z.number(),
  player_color: playerColorEnum,
  from_point: z.number().int().min(0).max(25),
  to_point: z.number().int().min(0).max(25),
  dice_value: z.number().int().min(1).max(6),
  move_type: moveTypeEnum,
  turn_number: z.number().int(),
  created_at: z.coerce.date()
});

export type Move = z.infer<typeof moveSchema>;

export const makeMoveInputSchema = z.object({
  match_id: z.number(),
  player_color: playerColorEnum,
  from_point: z.number().int().min(0).max(25),
  to_point: z.number().int().min(0).max(25),
  dice_value: z.number().int().min(1).max(6)
});

export type MakeMoveInput = z.infer<typeof makeMoveInputSchema>;

// Chat message schemas
export const chatMessageSchema = z.object({
  id: z.number(),
  match_id: z.number(),
  user_id: z.number(),
  message: z.string(),
  created_at: z.coerce.date()
});

export type ChatMessage = z.infer<typeof chatMessageSchema>;

export const sendMessageInputSchema = z.object({
  match_id: z.number(),
  user_id: z.number(),
  message: z.string().min(1).max(500)
});

export type SendMessageInput = z.infer<typeof sendMessageInputSchema>;

// Dice roll schema
export const rollDiceInputSchema = z.object({
  match_id: z.number(),
  player_color: playerColorEnum
});

export type RollDiceInput = z.infer<typeof rollDiceInputSchema>;

// Match filters schema
export const matchFiltersSchema = z.object({
  variant: gameVariantEnum.optional(),
  mode: gameModeEnum.optional(),
  status: matchStatusEnum.optional()
});

export type MatchFilters = z.infer<typeof matchFiltersSchema>;

// Auth response schemas
export const authResponseSchema = z.object({
  user: userSchema,
  token: z.string()
});

export type AuthResponse = z.infer<typeof authResponseSchema>;