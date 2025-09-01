import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import type { Move } from '../../../../server/src/schema';

interface MoveHistoryProps {
  moves: Move[];
}

export function MoveHistory({ moves }: MoveHistoryProps) {
  const formatMoveType = (moveType: string) => {
    switch (moveType) {
      case 'move':
        return { icon: '🎯', label: 'Move' };
      case 'bear_off':
        return { icon: '🏁', label: 'Bear Off' };
      case 'enter_from_bar':
        return { icon: '🔄', label: 'Enter' };
      case 'nail':
        return { icon: '📌', label: 'Nail' };
      case 'blocked':
        return { icon: '🚫', label: 'Blocked' };
      default:
        return { icon: '❓', label: moveType };
    }
  };

  const getPlayerIcon = (color: string) => {
    return color === 'white' ? '⚪' : '⚫';
  };

  const formatPoint = (point: number) => {
    if (point === 0) return 'Bar';
    if (point === 25) return 'Off';
    return point.toString();
  };

  const groupedMoves = moves.reduce((groups: { [key: number]: Move[] }, move: Move) => {
    if (!groups[move.turn_number]) {
      groups[move.turn_number] = [];
    }
    groups[move.turn_number].push(move);
    return groups;
  }, {});

  const sortedTurns = Object.keys(groupedMoves)
    .map(Number)
    .sort((a, b) => b - a); // Most recent first

  return (
    <Card className="h-80">
      <CardHeader className="pb-3">
        <CardTitle className="text-lg flex items-center gap-2">
          📜 Move History
          {moves.length > 0 && (
            <Badge variant="secondary">{moves.length}</Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <ScrollArea className="h-60">
          {moves.length === 0 ? (
            <div className="text-center text-gray-500 text-sm py-8">
              <div className="text-2xl mb-2">🎯</div>
              <p>No moves yet.</p>
              <p>Make the first move!</p>
            </div>
          ) : (
            <div className="space-y-4">
              {sortedTurns.map((turnNumber: number) => (
                <div key={turnNumber} className="border-l-2 border-gray-200 pl-4">
                  <div className="text-sm font-medium text-gray-700 mb-2">
                    Turn #{turnNumber}
                  </div>
                  <div className="space-y-2">
                    {groupedMoves[turnNumber].map((move: Move) => {
                      const moveInfo = formatMoveType(move.move_type);
                      return (
                        <div key={move.id} className="bg-gray-50 rounded-lg p-3 text-sm">
                          <div className="flex items-center justify-between mb-1">
                            <div className="flex items-center gap-2">
                              <span>{getPlayerIcon(move.player_color)}</span>
                              <span className="font-medium capitalize">
                                {move.player_color}
                              </span>
                              <Badge variant="outline" className="text-xs">
                                {moveInfo.icon} {moveInfo.label}
                              </Badge>
                            </div>
                            <Badge variant="secondary" className="text-xs">
                              🎲 {move.dice_value}
                            </Badge>
                          </div>
                          <div className="text-gray-600">
                            {formatPoint(move.from_point)} → {formatPoint(move.to_point)}
                          </div>
                          <div className="text-xs text-gray-500 mt-1">
                            {move.created_at.toLocaleTimeString()}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </ScrollArea>
      </CardContent>
    </Card>
  );
}