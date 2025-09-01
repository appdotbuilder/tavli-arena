import { type GameState, type GameVariant, type Move, type BoardPoint, type PlayerColor, type MoveType } from '../schema';

interface PossibleMove {
  from_point: number;
  to_point: number;
  dice_value: number;
  move_type: MoveType;
  score: number;
}

interface GamePosition {
  board: BoardPoint[];
  dice: number[];
  aiColor: PlayerColor;
  opponentColor: PlayerColor;
}

export const makeAiMove = async (
  gameState: GameState,
  variant: GameVariant,
  matchId: number
): Promise<Move | null> => {
  try {
    // Determine AI color (assume AI is always black for now)
    const aiColor: PlayerColor = 'black';
    const opponentColor: PlayerColor = aiColor === 'black' ? 'white' : 'black';
    
    const position: GamePosition = {
      board: gameState.board_state,
      dice: gameState.dice,
      aiColor,
      opponentColor
    };

    // Generate all possible moves
    const possibleMoves = generatePossibleMoves(position, variant);
    
    if (possibleMoves.length === 0) {
      return null; // No moves available
    }

    // Evaluate and select the best move
    const bestMove = selectBestMove(possibleMoves, position, variant);
    
    return {
      id: 0, // Will be set by database
      match_id: matchId,
      player_color: aiColor,
      from_point: bestMove.from_point,
      to_point: bestMove.to_point,
      dice_value: bestMove.dice_value,
      move_type: bestMove.move_type,
      turn_number: gameState.turn_number,
      created_at: new Date()
    };
  } catch (error) {
    console.error('AI move generation failed:', error);
    throw error;
  }
};

function generatePossibleMoves(position: GamePosition, variant: GameVariant): PossibleMove[] {
  const moves: PossibleMove[] = [];
  const { board, dice, aiColor } = position;
  
  // Check if AI has pieces on the bar (point 0 for black, point 25 for white)
  const barPoint = aiColor === 'black' ? 0 : 25;
  const hasBarPieces = board.find(point => point.point === barPoint && point.color === aiColor && point.count > 0);
  
  for (const diceValue of dice) {
    if (hasBarPieces) {
      // Must enter from bar first
      const enterMoves = generateEnterMoves(position, diceValue, variant);
      moves.push(...enterMoves);
    } else {
      // Regular moves
      const regularMoves = generateRegularMoves(position, diceValue, variant);
      moves.push(...regularMoves);
      
      // Bear off moves (if in home board)
      const bearOffMoves = generateBearOffMoves(position, diceValue, variant);
      moves.push(...bearOffMoves);
    }
  }
  
  return moves;
}

function generateEnterMoves(position: GamePosition, diceValue: number, variant: GameVariant): PossibleMove[] {
  const moves: PossibleMove[] = [];
  const { board, aiColor, opponentColor } = position;
  
  // Calculate entry point based on AI color and dice value
  const entryPoint = aiColor === 'black' ? (25 - diceValue) : diceValue;
  const targetPoint = board.find(point => point.point === entryPoint);
  
  if (!targetPoint) return moves;
  
  // Check if move is legal
  if (targetPoint.color !== opponentColor || targetPoint.count <= 1) {
    const moveType: MoveType = targetPoint.color === opponentColor && targetPoint.count === 1 ? 'nail' : 'enter_from_bar';
    const score = evaluateEnterMove(position, entryPoint, variant);
    
    moves.push({
      from_point: aiColor === 'black' ? 0 : 25,
      to_point: entryPoint,
      dice_value: diceValue,
      move_type: moveType,
      score
    });
  }
  
  return moves;
}

function generateRegularMoves(position: GamePosition, diceValue: number, variant: GameVariant): PossibleMove[] {
  const moves: PossibleMove[] = [];
  const { board, aiColor, opponentColor } = position;
  
  for (const point of board) {
    if (point.color === aiColor && point.count > 0) {
      // Calculate destination
      const toPoint = aiColor === 'black' ? point.point - diceValue : point.point + diceValue;
      
      // Check bounds
      if (toPoint < 1 || toPoint > 24) continue;
      
      const targetPoint = board.find(p => p.point === toPoint);
      if (!targetPoint) continue;
      
      // Check if move is legal
      if (targetPoint.color !== opponentColor || targetPoint.count <= 1) {
        const moveType: MoveType = targetPoint.color === opponentColor && targetPoint.count === 1 ? 'nail' : 'move';
        const score = evaluateRegularMove(position, point.point, toPoint, variant);
        
        moves.push({
          from_point: point.point,
          to_point: toPoint,
          dice_value: diceValue,
          move_type: moveType,
          score
        });
      }
    }
  }
  
  return moves;
}

function generateBearOffMoves(position: GamePosition, diceValue: number, variant: GameVariant): PossibleMove[] {
  const moves: PossibleMove[] = [];
  const { board, aiColor } = position;
  
  // Check if all pieces are in home board
  if (!allPiecesInHomeBoard(position)) return moves;
  
  const homeStart = aiColor === 'black' ? 1 : 19;
  const homeEnd = aiColor === 'black' ? 6 : 24;
  const bearOffPoint = aiColor === 'black' ? 0 : 25;
  
  // Try exact bear off
  const exactPoint = aiColor === 'black' ? diceValue : (25 - diceValue);
  if (exactPoint >= homeStart && exactPoint <= homeEnd) {
    const sourcePoint = board.find(point => point.point === exactPoint);
    if (sourcePoint && sourcePoint.color === aiColor && sourcePoint.count > 0) {
      const score = evaluateBearOffMove(position, exactPoint, variant);
      moves.push({
        from_point: exactPoint,
        to_point: bearOffPoint,
        dice_value: diceValue,
        move_type: 'bear_off',
        score
      });
    }
  }
  
  // Try bear off from highest point if no piece on exact point
  if (moves.length === 0) {
    const highestPoint = findHighestPointWithPieces(position);
    if (highestPoint !== null && 
        ((aiColor === 'black' && highestPoint < exactPoint) || 
         (aiColor === 'white' && highestPoint > exactPoint))) {
      const score = evaluateBearOffMove(position, highestPoint, variant);
      moves.push({
        from_point: highestPoint,
        to_point: bearOffPoint,
        dice_value: diceValue,
        move_type: 'bear_off',
        score
      });
    }
  }
  
  return moves;
}

function allPiecesInHomeBoard(position: GamePosition): boolean {
  const { board, aiColor } = position;
  const homeStart = aiColor === 'black' ? 1 : 19;
  const homeEnd = aiColor === 'black' ? 6 : 24;
  
  for (const point of board) {
    if (point.color === aiColor && point.count > 0) {
      if (point.point < homeStart || point.point > homeEnd) {
        // Also check bar
        const barPoint = aiColor === 'black' ? 0 : 25;
        if (point.point !== barPoint) {
          return false;
        }
      }
    }
  }
  return true;
}

function findHighestPointWithPieces(position: GamePosition): number | null {
  const { board, aiColor } = position;
  const homeStart = aiColor === 'black' ? 1 : 19;
  const homeEnd = aiColor === 'black' ? 6 : 24;
  
  for (let point = homeEnd; point >= homeStart; point--) {
    const boardPoint = board.find(p => p.point === point);
    if (boardPoint && boardPoint.color === aiColor && boardPoint.count > 0) {
      return point;
    }
  }
  return null;
}

function selectBestMove(moves: PossibleMove[], position: GamePosition, variant: GameVariant): PossibleMove {
  // Sort moves by score (higher is better)
  moves.sort((a, b) => b.score - a.score);
  return moves[0];
}

// Evaluation functions for different move types
function evaluateEnterMove(position: GamePosition, toPoint: number, variant: GameVariant): number {
  let score = 50; // Base score for entering from bar
  
  // Prefer entering to safer points
  const { board, opponentColor } = position;
  const targetPoint = board.find(point => point.point === toPoint);
  
  if (targetPoint) {
    // Bonus for hitting opponent blot
    if (targetPoint.color === opponentColor && targetPoint.count === 1) {
      score += 30;
    }
    
    // Prefer points closer to home
    const distanceToHome = position.aiColor === 'black' ? toPoint : (25 - toPoint);
    score += (25 - distanceToHome);
  }
  
  return score;
}

function evaluateRegularMove(position: GamePosition, fromPoint: number, toPoint: number, variant: GameVariant): number {
  let score = 10; // Base score for regular move
  const { board, aiColor, opponentColor } = position;
  
  const sourcePoint = board.find(point => point.point === fromPoint);
  const targetPoint = board.find(point => point.point === toPoint);
  
  if (!sourcePoint || !targetPoint) return score;
  
  // Hitting opponent blot
  if (targetPoint.color === opponentColor && targetPoint.count === 1) {
    score += 50;
  }
  
  // Making points (having 2+ checkers)
  if (targetPoint.color === aiColor) {
    score += 20;
  }
  
  // Moving towards home board
  const homeDirection = aiColor === 'black' ? -1 : 1;
  if ((toPoint - fromPoint) * homeDirection > 0) {
    score += 15;
  }
  
  // Avoid leaving blots
  if (sourcePoint.count === 1) {
    score -= 10;
  }
  
  // Safety considerations based on variant
  if (variant === 'plakoto') {
    // In Plakoto, avoid being pinned
    const opponentThreats = countOpponentThreats(position, toPoint);
    score -= opponentThreats * 5;
  }
  
  return score;
}

function evaluateBearOffMove(position: GamePosition, fromPoint: number, variant: GameVariant): number {
  let score = 100; // High base score for bearing off
  
  // Prefer bearing off from higher points first
  score += fromPoint;
  
  return score;
}

function countOpponentThreats(position: GamePosition, targetPoint: number): number {
  const { board, opponentColor } = position;
  let threats = 0;
  
  // Check for opponent pieces that could hit this point
  for (let diceValue = 1; diceValue <= 6; diceValue++) {
    const threatPoint = position.aiColor === 'black' ? 
      targetPoint + diceValue : targetPoint - diceValue;
    
    const threatPiece = board.find(point => point.point === threatPoint);
    if (threatPiece && threatPiece.color === opponentColor && threatPiece.count > 0) {
      threats++;
    }
  }
  
  return threats;
}