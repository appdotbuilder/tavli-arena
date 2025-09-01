import { type MakeMoveInput, type GameState, type GameVariant, type BoardPoint } from '../schema';

export const validateMove = async (
  input: MakeMoveInput, 
  gameState: GameState, 
  variant: GameVariant
): Promise<boolean> => {
  try {
    const { from_point, to_point, dice_value, player_color } = input;
    const { board_state, dice, available_moves } = gameState;

    // Check if dice value is available for use
    if (!dice.includes(dice_value)) {
      return false;
    }

    // Check if this dice value is still available in available_moves array
    // available_moves contains unused dice values
    if (!available_moves.includes(dice_value)) {
      return false;
    }

    // Validate point numbers
    if (from_point < 0 || from_point > 25 || to_point < 0 || to_point > 25) {
      return false;
    }

    // Get source point
    const sourcePoint = board_state.find(p => p.point === from_point);
    if (!sourcePoint || sourcePoint.color !== player_color || sourcePoint.count === 0) {
      return false;
    }

    // Check if player has pieces on the bar that must be entered first
    const barPoint = board_state.find(p => p.point === 0);
    if (barPoint && barPoint.color === player_color && barPoint.count > 0 && from_point !== 0) {
      return false;
    }

    // Handle bearing off (moving to point 25)
    if (to_point === 25) {
      return validateBearOff(from_point, dice_value, player_color, board_state, variant);
    }

    // Calculate expected destination based on player color and direction
    const expectedDestination = calculateDestination(from_point, dice_value, player_color);
    
    // Check if destination matches calculated position
    if (to_point !== expectedDestination) {
      return false;
    }

    // Check if calculated destination is within valid bounds (1-24)
    if (expectedDestination < 1 || expectedDestination > 24) {
      return false;
    }

    // Get destination point
    const destPoint = board_state.find(p => p.point === to_point);
    if (!destPoint) {
      return false;
    }

    // Check if destination is blocked (2 or more opponent pieces)
    if (destPoint.color && destPoint.color !== player_color && destPoint.count > 1) {
      return false;
    }

    // Variant-specific rules
    return validateVariantRules(input, gameState, variant, sourcePoint, destPoint);

  } catch (error) {
    console.error('Move validation failed:', error);
    return false;
  }
};

const calculateDestination = (fromPoint: number, diceValue: number, playerColor: string): number => {
  if (fromPoint === 0) {
    // Entering from bar
    return playerColor === 'white' ? diceValue : (25 - diceValue);
  }

  // Regular moves
  if (playerColor === 'white') {
    return fromPoint + diceValue;
  } else {
    return fromPoint - diceValue;
  }
};

const validateBearOff = (
  fromPoint: number, 
  diceValue: number, 
  playerColor: string, 
  boardState: BoardPoint[], 
  variant: GameVariant
): boolean => {
  // Check if player is in bearing off position (all pieces in home board)
  const homeBoard = getHomeBoardPoints(playerColor);
  
  // Check if all player's pieces are in home board or already off
  const playerPieces = boardState.filter(p => p.color === playerColor && p.count > 0);
  const allInHomeBoard = playerPieces.every(p => 
    homeBoard.includes(p.point) || p.point === 25
  );

  if (!allInHomeBoard) {
    return false;
  }

  // Check if the move is from home board
  if (!homeBoard.includes(fromPoint)) {
    return false;
  }

  // For exact bear off, check if dice matches distance to bear off
  const distanceToBearOff = playerColor === 'white' 
    ? (25 - fromPoint) 
    : fromPoint;

  if (distanceToBearOff === diceValue) {
    return true;
  }

  // For over-bearing (dice higher than needed), check if no pieces behind
  if (distanceToBearOff < diceValue) {
    const piecesOnBoard = playerPieces.filter(p => p.point !== 25 && p.point !== 0);
    if (piecesOnBoard.length === 0) return false;
    
    const furthestPoint = playerColor === 'white' 
      ? Math.min(...piecesOnBoard.map(p => p.point))
      : Math.max(...piecesOnBoard.map(p => p.point));
    
    return fromPoint === furthestPoint;
  }

  return false;
};

const getHomeBoardPoints = (playerColor: string): number[] => {
  return playerColor === 'white' ? [19, 20, 21, 22, 23, 24] : [1, 2, 3, 4, 5, 6];
};

const validateVariantRules = (
  input: MakeMoveInput,
  gameState: GameState,
  variant: GameVariant,
  sourcePoint: BoardPoint,
  destPoint: BoardPoint
): boolean => {
  const { from_point, to_point, player_color } = input;

  switch (variant) {
    case 'portes':
      // Standard backgammon rules - hitting is allowed
      return true;

    case 'plakoto':
      // Plakoto rules - no hitting, pieces are pinned instead
      // Cannot move to a point occupied by opponent
      if (destPoint.color !== null && destPoint.color !== player_color) {
        return false;
      }
      return true;

    case 'fevga':
      // Fevga rules - no hitting, cannot create blocks of 6 consecutive points
      if (destPoint.color !== null && destPoint.color !== player_color) {
        return false;
      }

      // Check for creating illegal consecutive blocks
      if (destPoint.color === player_color || destPoint.color === null) {
        // Simulate the move and check for 6 consecutive points
        return !wouldCreateIllegalBlock(to_point, player_color, gameState.board_state);
      }
      return true;

    default:
      return false;
  }
};

const wouldCreateIllegalBlock = (
  toPoint: number, 
  playerColor: string, 
  boardState: BoardPoint[]
): boolean => {
  // Create a copy of board state with the move applied
  const simulatedBoard = boardState.map(p => ({ ...p }));
  const destPoint = simulatedBoard.find(p => p.point === toPoint);
  
  if (destPoint) {
    if (destPoint.color === playerColor) {
      destPoint.count += 1;
    } else {
      destPoint.color = playerColor as 'white' | 'black';
      destPoint.count = 1;
    }
  }

  // Check for 6 consecutive points controlled by the player
  let consecutiveCount = 0;
  let maxConsecutive = 0;
  
  // Check points 1-24 (exclude bar and bear-off)
  for (let point = 1; point <= 24; point++) {
    const boardPoint = simulatedBoard.find(p => p.point === point);
    
    if (boardPoint && boardPoint.color === playerColor && boardPoint.count > 0) {
      consecutiveCount++;
      maxConsecutive = Math.max(maxConsecutive, consecutiveCount);
    } else {
      consecutiveCount = 0;
    }
  }

  return maxConsecutive >= 6;
};