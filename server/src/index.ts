import { initTRPC } from '@trpc/server';
import { createHTTPServer } from '@trpc/server/adapters/standalone';
import 'dotenv/config';
import cors from 'cors';
import superjson from 'superjson';
import { z } from 'zod';

// Import all schemas
import {
  createUserInputSchema,
  loginInputSchema,
  createMatchInputSchema,
  joinMatchInputSchema,
  makeMoveInputSchema,
  rollDiceInputSchema,
  sendMessageInputSchema,
  matchFiltersSchema
} from './schema';

// Import all handlers
import { createUser } from './handlers/create_user';
import { login } from './handlers/login';
import { createMatch } from './handlers/create_match';
import { joinMatch } from './handlers/join_match';
import { getMatches } from './handlers/get_matches';
import { getMatch } from './handlers/get_match';
import { getGameState } from './handlers/get_game_state';
import { rollDice } from './handlers/roll_dice';
import { makeMove } from './handlers/make_move';
import { getMoves } from './handlers/get_moves';
import { sendChatMessage } from './handlers/send_chat_message';
import { getChatMessages } from './handlers/get_chat_messages';
import { getUserProfile } from './handlers/get_user_profile';
import { initializeGameBoard } from './handlers/initialize_game_board';
import { validateMove } from './handlers/validate_move';
import { calculateAvailableMoves } from './handlers/calculate_available_moves';
import { checkWinCondition } from './handlers/check_win_condition';
import { updateEloRating } from './handlers/update_elo_rating';
import { makeAiMove } from './handlers/make_ai_move';

const t = initTRPC.create({
  transformer: superjson,
});

const publicProcedure = t.procedure;
const router = t.router;

const appRouter = router({
  // Health check
  healthcheck: publicProcedure.query(() => {
    return { status: 'ok', timestamp: new Date().toISOString() };
  }),

  // Authentication routes
  register: publicProcedure
    .input(createUserInputSchema)
    .mutation(({ input }) => createUser(input)),

  login: publicProcedure
    .input(loginInputSchema)
    .mutation(({ input }) => login(input)),

  // User profile routes
  getUserProfile: publicProcedure
    .input(z.object({ userId: z.number() }))
    .query(({ input }) => getUserProfile(input.userId)),

  // Match management routes
  createMatch: publicProcedure
    .input(createMatchInputSchema)
    .mutation(({ input }) => createMatch(input)),

  joinMatch: publicProcedure
    .input(joinMatchInputSchema)
    .mutation(({ input }) => joinMatch(input)),

  getMatches: publicProcedure
    .input(matchFiltersSchema.optional())
    .query(({ input }) => getMatches(input)),

  getMatch: publicProcedure
    .input(z.object({ matchId: z.number() }))
    .query(({ input }) => getMatch(input.matchId)),

  // Game state routes
  getGameState: publicProcedure
    .input(z.object({ matchId: z.number() }))
    .query(({ input }) => getGameState(input.matchId)),

  initializeGameBoard: publicProcedure
    .input(z.object({ 
      matchId: z.number(), 
      variant: z.enum(['portes', 'plakoto', 'fevga'])
    }))
    .mutation(({ input }) => initializeGameBoard(input.matchId, input.variant)),

  // Dice and move routes
  rollDice: publicProcedure
    .input(rollDiceInputSchema)
    .mutation(({ input }) => rollDice(input)),

  makeMove: publicProcedure
    .input(makeMoveInputSchema)
    .mutation(({ input }) => makeMove(input)),

  getMoves: publicProcedure
    .input(z.object({ matchId: z.number() }))
    .query(({ input }) => getMoves(input.matchId)),

  // Chat routes
  sendChatMessage: publicProcedure
    .input(sendMessageInputSchema)
    .mutation(({ input }) => sendChatMessage(input)),

  getChatMessages: publicProcedure
    .input(z.object({ matchId: z.number() }))
    .query(({ input }) => getChatMessages(input.matchId)),

  // Game logic utility routes (for internal use)
  validateMove: publicProcedure
    .input(z.object({
      moveInput: makeMoveInputSchema,
      gameStateId: z.number(),
      variant: z.enum(['portes', 'plakoto', 'fevga'])
    }))
    .query(async ({ input }) => {
      const gameState = await getGameState(input.moveInput.match_id);
      if (!gameState) return false;
      return validateMove(input.moveInput, gameState, input.variant);
    }),

  calculateAvailableMoves: publicProcedure
    .input(z.object({
      matchId: z.number(),
      variant: z.enum(['portes', 'plakoto', 'fevga']),
      playerColor: z.enum(['white', 'black']),
      dice: z.array(z.number().int().min(1).max(6))
    }))
    .query(async ({ input }) => {
      const gameState = await getGameState(input.matchId);
      if (!gameState) return [];
      return calculateAvailableMoves(gameState, input.variant, input.playerColor, input.dice);
    }),

  checkWinCondition: publicProcedure
    .input(z.object({
      matchId: z.number(),
      variant: z.enum(['portes', 'plakoto', 'fevga'])
    }))
    .query(async ({ input }) => {
      const gameState = await getGameState(input.matchId);
      if (!gameState) return null;
      return checkWinCondition(gameState, input.variant);
    }),

  // AI move route
  makeAiMove: publicProcedure
    .input(z.object({
      matchId: z.number(),
      variant: z.enum(['portes', 'plakoto', 'fevga'])
    }))
    .mutation(async ({ input }) => {
      const gameState = await getGameState(input.matchId);
      if (!gameState) return null;
      return makeAiMove(gameState, input.variant, input.matchId);
    })
});

export type AppRouter = typeof appRouter;

async function start() {
  const port = process.env['SERVER_PORT'] || 2022;
  const server = createHTTPServer({
    middleware: (req, res, next) => {
      cors({
        origin: process.env['FRONTEND_URL'] || 'http://localhost:3000',
        credentials: true
      })(req, res, next);
    },
    router: appRouter,
    createContext() {
      return {};
    },
  });
  server.listen(port);
  console.log(`Tavli Arena TRPC server listening at port: ${port}`);
  console.log(`Available routes: ${Object.keys(appRouter._def.procedures).join(', ')}`);
}

start();