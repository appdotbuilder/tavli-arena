import { db } from '../db';
import { matchesTable, gameStatesTable, movesTable } from '../db/schema';
import { type MakeMoveInput, type Move, type MoveType } from '../schema';
import { eq, and, desc } from 'drizzle-orm';

export const makeMove = async (input: MakeMoveInput): Promise<Move> => {
  try {
    // Validate that the match exists and is active
    const matches = await db.select()
      .from(matchesTable)
      .where(eq(matchesTable.id, input.match_id))
      .execute();

    if (matches.length === 0) {
      throw new Error('Match not found');
    }

    const match = matches[0];
    if (match.status !== 'active') {
      throw new Error('Match is not active');
    }

    // Validate it's the correct player's turn
    if (match.current_player_color !== input.player_color) {
      throw new Error('Not your turn');
    }

    // Get the latest game state
    const gameStates = await db.select()
      .from(gameStatesTable)
      .where(eq(gameStatesTable.match_id, input.match_id))
      .orderBy(desc(gameStatesTable.created_at))
      .limit(1)
      .execute();

    if (gameStates.length === 0) {
      throw new Error('Game state not found');
    }

    const gameState = gameStates[0];

    // Validate game phase
    if (gameState.phase !== 'moving') {
      throw new Error('Cannot make move during this phase');
    }

    // Parse board state and validate the move
    const boardState = gameState.board_state as any[];
    const dice = gameState.dice as number[];
    const availableMoves = gameState.available_moves as number[];

    // Validate dice value is available
    if (!dice.includes(input.dice_value)) {
      throw new Error('Invalid dice value');
    }

    // Validate move is legal based on board state
    const fromPoint = boardState.find(p => p.point === input.from_point);
    if (!fromPoint || fromPoint.color !== input.player_color || fromPoint.count === 0) {
      throw new Error('No pieces available at source point');
    }

    // Determine move type
    let moveType: MoveType = 'move';
    
    if (input.to_point === 25) { // Bear off
      moveType = 'bear_off';
    } else if (input.from_point === 0) { // Enter from bar
      moveType = 'enter_from_bar';
    } else {
      // Check if destination has opponent pieces (potential nail)
      const toPoint = boardState.find(p => p.point === input.to_point);
      if (toPoint && toPoint.color && toPoint.color !== input.player_color) {
        if (toPoint.count === 1) {
          moveType = 'nail';
        } else {
          moveType = 'blocked';
          throw new Error('Move is blocked by opponent pieces');
        }
      }
    }

    // Update board state
    const newBoardState = boardState.map(point => {
      if (point.point === input.from_point) {
        return {
          ...point,
          count: point.count - 1,
          color: point.count === 1 ? null : point.color
        };
      } else if (point.point === input.to_point) {
        if (moveType === 'nail' && point.color !== input.player_color) {
          // Move opponent piece to bar (point 0)
          const barPoint = boardState.find(p => p.point === 0);
          if (barPoint) {
            barPoint.count = barPoint.count + 1;
            barPoint.color = point.color;
          }
          return {
            ...point,
            count: 1,
            color: input.player_color
          };
        } else {
          return {
            ...point,
            count: point.count + 1,
            color: input.player_color
          };
        }
      }
      return point;
    });

    // Remove used dice value
    const newDice = dice.filter((d, i) => i !== dice.indexOf(input.dice_value));
    
    // Determine next phase
    const nextPhase = newDice.length === 0 ? 'waiting' : 'moving';
    
    // Update game state
    await db.insert(gameStatesTable)
      .values({
        match_id: input.match_id,
        board_state: newBoardState,
        dice: newDice,
        available_moves: [], // Will be calculated based on new state
        turn_number: gameState.turn_number,
        phase: nextPhase
      })
      .execute();

    // If turn is complete, switch players
    if (nextPhase === 'waiting') {
      const nextPlayer = input.player_color === 'white' ? 'black' : 'white';
      await db.update(matchesTable)
        .set({ 
          current_player_color: nextPlayer,
          updated_at: new Date()
        })
        .where(eq(matchesTable.id, input.match_id))
        .execute();
    }

    // Record the move
    const result = await db.insert(movesTable)
      .values({
        match_id: input.match_id,
        player_color: input.player_color,
        from_point: input.from_point,
        to_point: input.to_point,
        dice_value: input.dice_value,
        move_type: moveType,
        turn_number: gameState.turn_number
      })
      .returning()
      .execute();

    return result[0];
  } catch (error) {
    console.error('Move creation failed:', error);
    throw error;
  }
};