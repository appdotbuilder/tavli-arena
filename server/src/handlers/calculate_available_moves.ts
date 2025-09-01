import { type GameState, type GameVariant, type PlayerColor, type BoardPoint } from '../schema';

interface Move {
  from: number;
  to: number;
  dice: number;
}

export const calculateAvailableMoves = async (
  gameState: GameState,
  variant: GameVariant,
  playerColor: PlayerColor,
  dice: number[]
): Promise<number[]> => {
  try {
    const board = gameState.board_state;
    const availableMoves: Move[] = [];
    
    // Get unique dice values and their counts for move calculation
    const diceValues = [...dice].sort((a, b) => b - a); // Sort descending for better move priority
    const uniqueDice = [...new Set(diceValues)];
    
    // Check if player has pieces on the bar (point 0 for white, point 25 for black)
    const barPoint = playerColor === 'white' ? 0 : 25;
    const hasBarPieces = board.find(p => p.point === barPoint && p.color === playerColor && p.count > 0);
    
    if (hasBarPieces) {
      // Must enter from bar first - can only move from bar
      availableMoves.push(...getBarMoves(board, playerColor, uniqueDice, variant));
    } else {
      // Check if player can bear off (all pieces in home board)
      const canBearOff = checkCanBearOff(board, playerColor);
      
      if (canBearOff) {
        // Add bear-off moves
        availableMoves.push(...getBearOffMoves(board, playerColor, uniqueDice));
      }
      
      // Add regular moves from all points
      for (let point = 1; point <= 24; point++) {
        const boardPoint = board.find(p => p.point === point);
        if (boardPoint && boardPoint.color === playerColor && boardPoint.count > 0) {
          availableMoves.push(...getMovesFromPoint(board, point, playerColor, uniqueDice, variant));
        }
      }
    }
    
    // Filter moves based on dice usage - ensure we can use all dice optimally
    const validMoves = filterOptimalMoves(availableMoves, diceValues);
    
    // Convert moves to indices for frontend (hash-based to ensure uniqueness)
    return validMoves.map((move, index) => {
      // Create a unique identifier based on move properties
      return (move.from * 1000) + (move.to * 100) + move.dice + index;
    });
  } catch (error) {
    console.error('Move calculation failed:', error);
    throw error;
  }
};

function getBarMoves(
  board: BoardPoint[], 
  playerColor: PlayerColor, 
  dice: number[], 
  variant: GameVariant
): Move[] {
  const moves: Move[] = [];
  const direction = playerColor === 'white' ? 1 : -1;
  const startPoint = playerColor === 'white' ? 0 : 25;
  
  for (const die of dice) {
    const targetPoint = playerColor === 'white' ? die : 25 - die;
    
    if (canMoveToPoint(board, targetPoint, playerColor, variant)) {
      moves.push({
        from: startPoint,
        to: targetPoint,
        dice: die
      });
    }
  }
  
  return moves;
}

function getBearOffMoves(board: BoardPoint[], playerColor: PlayerColor, dice: number[]): Move[] {
  const moves: Move[] = [];
  const homeStart = playerColor === 'white' ? 19 : 1;
  const homeEnd = playerColor === 'white' ? 24 : 6;
  const bearOffPoint = playerColor === 'white' ? 25 : 0;
  
  for (const die of dice) {
    // Direct bear-off moves
    const exactPoint = playerColor === 'white' ? 25 - die : die;
    
    if (exactPoint >= homeStart && exactPoint <= homeEnd) {
      const boardPoint = board.find(p => p.point === exactPoint);
      if (boardPoint && boardPoint.color === playerColor && boardPoint.count > 0) {
        moves.push({
          from: exactPoint,
          to: bearOffPoint,
          dice: die
        });
      }
    }
    
    // Bear-off with higher dice (if no pieces on higher points)
    if (playerColor === 'white') {
      const targetPoint = 25 - die;
      if (targetPoint < homeStart) {
        // Find highest point with pieces
        for (let point = homeEnd; point >= homeStart; point--) {
          const boardPoint = board.find(p => p.point === point);
          if (boardPoint && boardPoint.color === playerColor && boardPoint.count > 0) {
            moves.push({
              from: point,
              to: bearOffPoint,
              dice: die
            });
            break;
          }
        }
      }
    } else {
      const targetPoint = die;
      if (targetPoint > homeEnd) {
        // Find highest point with pieces for black
        for (let point = homeStart; point <= homeEnd; point++) {
          const boardPoint = board.find(p => p.point === point);
          if (boardPoint && boardPoint.color === playerColor && boardPoint.count > 0) {
            moves.push({
              from: point,
              to: bearOffPoint,
              dice: die
            });
            break;
          }
        }
      }
    }
  }
  
  return moves;
}

function getMovesFromPoint(
  board: BoardPoint[], 
  fromPoint: number, 
  playerColor: PlayerColor, 
  dice: number[], 
  variant: GameVariant
): Move[] {
  const moves: Move[] = [];
  const direction = playerColor === 'white' ? 1 : -1;
  
  for (const die of dice) {
    const toPoint = fromPoint + (die * direction);
    
    // Check bounds
    if (toPoint < 1 || toPoint > 24) continue;
    
    if (canMoveToPoint(board, toPoint, playerColor, variant)) {
      moves.push({
        from: fromPoint,
        to: toPoint,
        dice: die
      });
    }
  }
  
  return moves;
}

function canMoveToPoint(
  board: BoardPoint[], 
  toPoint: number, 
  playerColor: PlayerColor, 
  variant: GameVariant
): boolean {
  const targetPoint = board.find(p => p.point === toPoint);
  
  if (!targetPoint) return true; // Empty point
  if (targetPoint.color === playerColor) return true; // Own pieces
  if (targetPoint.color === null) return true; // Empty point
  
  // Opponent pieces
  const opponentColor = playerColor === 'white' ? 'black' : 'white';
  if (targetPoint.color === opponentColor) {
    // Different rules for different variants
    switch (variant) {
      case 'portes':
        return targetPoint.count === 1; // Can hit single opponent piece
      case 'plakoto':
        return false; // Cannot move to opponent's point in Plakoto
      case 'fevga':
        return targetPoint.count === 1; // Can hit single opponent piece in Fevga
      default:
        return targetPoint.count === 1;
    }
  }
  
  return false;
}

function checkCanBearOff(board: BoardPoint[], playerColor: PlayerColor): boolean {
  const homeStart = playerColor === 'white' ? 19 : 1;
  const homeEnd = playerColor === 'white' ? 24 : 6;
  
  // Check if all pieces are in home board or already borne off
  for (const point of board) {
    if (point.color === playerColor && point.count > 0) {
      if (point.point < homeStart || point.point > homeEnd) {
        // Exception: point 0 (bar) and point 25 (off) are allowed
        if (point.point !== 0 && point.point !== 25) {
          return false;
        }
      }
    }
  }
  
  return true;
}

function filterOptimalMoves(moves: Move[], dice: number[]): Move[] {
  // For now, return all valid moves - advanced filtering for forced moves
  // and optimal dice usage can be implemented later
  const uniqueMoves = moves.filter((move, index, self) => 
    self.findIndex(m => m.from === move.from && m.to === move.to && m.dice === move.dice) === index
  );
  
  return uniqueMoves;
}