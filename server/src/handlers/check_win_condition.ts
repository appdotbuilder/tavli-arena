import { type GameState, type GameVariant, type PlayerColor, type BoardPoint } from '../schema';

export const checkWinCondition = async (
  gameState: GameState,
  variant: GameVariant
): Promise<PlayerColor | null> => {
  try {
    const boardState = gameState.board_state;
    
    // Check if white player has won
    if (hasPlayerWon(boardState, 'white', variant)) {
      return 'white';
    }
    
    // Check if black player has won
    if (hasPlayerWon(boardState, 'black', variant)) {
      return 'black';
    }
    
    // No winner yet
    return null;
  } catch (error) {
    console.error('Win condition check failed:', error);
    throw error;
  }
};

/**
 * Checks if a specific player has won according to variant rules
 */
const hasPlayerWon = (
  boardState: BoardPoint[],
  playerColor: PlayerColor,
  variant: GameVariant
): boolean => {
  switch (variant) {
    case 'portes':
      return hasWonPortes(boardState, playerColor);
    case 'plakoto':
      return hasWonPlakoto(boardState, playerColor);
    case 'fevga':
      return hasWonFevga(boardState, playerColor);
    default:
      return false;
  }
};

/**
 * Portes (Backgammon): Player wins by bearing off all 15 pieces
 */
const hasWonPortes = (boardState: BoardPoint[], playerColor: PlayerColor): boolean => {
  // Count pieces on board and bar (points 0-24, point 25 is off board)
  let piecesOnBoard = 0;
  
  for (let i = 0; i <= 24; i++) {
    const point = boardState[i];
    if (point && point.color === playerColor) {
      piecesOnBoard += point.count;
    }
  }
  
  // Player wins if no pieces remain on board or bar
  return piecesOnBoard === 0;
};

/**
 * Plakoto: Player wins by bearing off all pieces OR by blocking opponent's mother point
 */
const hasWonPlakoto = (boardState: BoardPoint[], playerColor: PlayerColor): boolean => {
  // First check standard win condition (all pieces borne off)
  if (hasWonPortes(boardState, playerColor)) {
    return true;
  }
  
  // Check special Plakoto rule: blocking opponent's mother point
  const opponentColor = playerColor === 'white' ? 'black' : 'white';
  const opponentMotherPoint = opponentColor === 'white' ? 1 : 24; // White's home is points 1-6, Black's is 19-24
  
  // Check if opponent has pieces on bar (captured)
  const barPoint = boardState[0]; // Point 0 is the bar
  const opponentOnBar = barPoint && barPoint.color === opponentColor && barPoint.count > 0;
  
  if (opponentOnBar) {
    // Check if player controls opponent's mother point
    const motherPoint = boardState[opponentMotherPoint];
    if (motherPoint && motherPoint.color === playerColor && motherPoint.count >= 2) {
      return true; // Player wins by blocking opponent's mother point
    }
  }
  
  return false;
};

/**
 * Fevga: Player wins by bearing off all pieces (similar to Portes but with different movement rules)
 */
const hasWonFevga = (boardState: BoardPoint[], playerColor: PlayerColor): boolean => {
  // Fevga has same win condition as Portes - bear off all pieces
  return hasWonPortes(boardState, playerColor);
};