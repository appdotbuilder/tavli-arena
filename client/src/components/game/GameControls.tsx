import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import type { Match, GameState, PlayerColor } from '../../../../server/src/schema';

interface GameControlsProps {
  match: Match;
  gameState: GameState;
  isPlayerTurn: boolean;
  isRollingDice: boolean;
  onRollDice: () => void;
  onAiMove: () => void;
  playerColor: PlayerColor | null;
}

export function GameControls({
  match,
  gameState,
  isPlayerTurn,
  isRollingDice,
  onRollDice,
  onAiMove,
  playerColor
}: GameControlsProps) {
  const canRollDice = () => {
    return isPlayerTurn && gameState.phase === 'rolling' && !isRollingDice;
  };

  const canTriggerAi = () => {
    return match.mode === 'ai' && !isPlayerTurn && match.status === 'active';
  };

  const getGamePhaseDescription = () => {
    switch (gameState.phase) {
      case 'rolling':
        return isPlayerTurn ? 'Roll the dice to start your turn' : 'Waiting for opponent to roll dice';
      case 'moving':
        return isPlayerTurn ? 'Make your moves with the dice shown' : 'Opponent is making their moves';
      case 'waiting':
        return 'Waiting for game to continue';
      default:
        return 'Game in progress';
    }
  };

  const getVariantRules = () => {
    switch (match.variant) {
      case 'portes':
        return [
          'Standard backgammon rules',
          'Hit opponent blots to send them to the bar',
          'Re-enter from bar before making other moves',
          'Bear off checkers from your home board'
        ];
      case 'plakoto':
        return [
          'No hitting - block opponent pieces instead',
          'A single checker nails the opponent piece',
          'Nailing the mother checker wins instantly',
          'Blocked pieces cannot move until freed'
        ];
      case 'fevga':
        return [
          'Both players move in the same direction',
          'No hitting or blocking allowed',
          'Must always leave at least one point open',
          'Cannot create a complete prime'
        ];
    }
  };

  const getCurrentTurnInfo = () => {
    if (match.winner_color) {
      return {
        title: 'Game Complete! 🎉',
        description: `${match.winner_color === playerColor ? 'You win!' : 'You lose!'} Winner: ${match.winner_color}`,
        color: match.winner_color === playerColor ? 'text-green-700' : 'text-red-700'
      };
    }

    if (isPlayerTurn) {
      return {
        title: 'Your Turn 🎯',
        description: getGamePhaseDescription(),
        color: 'text-blue-700'
      };
    }

    return {
      title: 'Opponent\'s Turn ⏳',
      description: getGamePhaseDescription(),
      color: 'text-gray-700'
    };
  };

  const turnInfo = getCurrentTurnInfo();

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
      {/* Turn Information */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className={`text-lg ${turnInfo.color}`}>
            {turnInfo.title}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-gray-600 mb-3">{turnInfo.description}</p>
          <div className="flex items-center gap-2">
            <Badge variant="outline">
              Turn #{gameState.turn_number}
            </Badge>
            <Badge variant={isPlayerTurn ? 'default' : 'secondary'}>
              You are {playerColor}
            </Badge>
          </div>
        </CardContent>
      </Card>

      {/* Game Actions */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg">Actions</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <Button
            onClick={onRollDice}
            disabled={!canRollDice()}
            className="w-full"
            size="lg"
          >
            {isRollingDice ? (
              <>🎲 Rolling...</>
            ) : (
              <>🎲 Roll Dice</>
            )}
          </Button>

          {canTriggerAi() && (
            <Button
              onClick={onAiMove}
              variant="outline"
              className="w-full"
            >
              🤖 Trigger AI Move
            </Button>
          )}

          {match.status === 'completed' && (
            <Alert className="bg-green-50 border-green-200">
              <AlertDescription className="text-green-800">
                Game completed! {match.winner_color ? `Winner: ${match.winner_color}` : 'Draw'}
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      {/* Game Rules */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg">
            {match.variant.toUpperCase()} Rules
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="space-y-1 text-sm">
            {getVariantRules().map((rule, index) => (
              <li key={index} className="flex items-start">
                <span className="w-1 h-1 bg-blue-500 rounded-full mr-2 mt-2 flex-shrink-0"></span>
                <span className="text-gray-600">{rule}</span>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}