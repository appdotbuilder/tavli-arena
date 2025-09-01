import { type JoinMatchInput, type Match } from '../schema';

export const joinMatch = async (input: JoinMatchInput): Promise<Match> => {
  // This is a placeholder declaration! Real code should be implemented here.
  // The goal of this handler is allowing a player to join an existing match,
  // updating match status to 'active', and initializing the game board state.
  return Promise.resolve({
    id: input.match_id,
    variant: 'portes', // Will be fetched from DB
    mode: 'online', // Will be fetched from DB
    status: 'active',
    white_player_id: 1, // Will be fetched from DB
    black_player_id: input.black_player_id,
    current_player_color: 'white',
    winner_color: null,
    created_at: new Date(),
    updated_at: new Date()
  });
};