import { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Alert, AlertDescription } from '@/components/ui/alert';

import { GameBoard } from './game/GameBoard';
import { ChatPanel } from './game/ChatPanel';
import { MoveHistory } from './game/MoveHistory';
import { GameControls } from './game/GameControls';
import { trpc } from '@/utils/trpc';
import type { User, Match, GameState, Move, ChatMessage } from '../../../server/src/schema';

interface GameViewProps {
  user: User;
  matchId: number;
  onLeaveMatch: () => void;
}

export function GameView({ user, matchId, onLeaveMatch }: GameViewProps) {
  const [match, setMatch] = useState<Match | null>(null);
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [moves, setMoves] = useState<Move[]>([]);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isRollingDice, setIsRollingDice] = useState(false);
  const [isMoving, setIsMoving] = useState(false);

  const loadGameData = useCallback(async () => {
    try {
      setError(null);
      
      // Load match data
      const matchData = await trpc.getMatch.query({ matchId });
      setMatch(matchData);

      // Load game state
      const gameStateData = await trpc.getGameState.query({ matchId });
      setGameState(gameStateData);

      // Load moves
      const movesData = await trpc.getMoves.query({ matchId });
      setMoves(movesData);

      // Load chat messages
      const chatData = await trpc.getChatMessages.query({ matchId });
      setChatMessages(chatData);

    } catch (error) {
      console.error('Failed to load game data:', error);
      setError('Failed to load game data. Please try again.');
    } finally {
      setIsLoading(false);
    }
  }, [matchId]);

  useEffect(() => {
    loadGameData();
  }, [loadGameData]);

  // Poll for updates every 2 seconds during active games
  useEffect(() => {
    if (match?.status === 'active') {
      const interval = setInterval(loadGameData, 2000);
      return () => clearInterval(interval);
    }
  }, [match?.status, loadGameData]);

  const handleRollDice = async () => {
    if (!match || !gameState) return;
    
    const playerColor = user.id === match.white_player_id ? 'white' : 'black';
    
    setIsRollingDice(true);
    try {
      await trpc.rollDice.mutate({
        match_id: matchId,
        player_color: playerColor
      });
      await loadGameData(); // Refresh game state
    } catch (error) {
      console.error('Failed to roll dice:', error);
      setError('Failed to roll dice. Please try again.');
    } finally {
      setIsRollingDice(false);
    }
  };

  const handleMove = async (fromPoint: number, toPoint: number, diceValue: number) => {
    if (!match || !gameState) return;
    
    const playerColor = user.id === match.white_player_id ? 'white' : 'black';
    
    setIsMoving(true);
    try {
      await trpc.makeMove.mutate({
        match_id: matchId,
        player_color: playerColor,
        from_point: fromPoint,
        to_point: toPoint,
        dice_value: diceValue
      });
      await loadGameData(); // Refresh game state
    } catch (error) {
      console.error('Failed to make move:', error);
      setError('Invalid move. Please try again.');
    } finally {
      setIsMoving(false);
    }
  };

  const handleSendMessage = async (message: string) => {
    try {
      await trpc.sendChatMessage.mutate({
        match_id: matchId,
        user_id: user.id,
        message
      });
      await loadGameData(); // Refresh chat messages
    } catch (error) {
      console.error('Failed to send message:', error);
      setError('Failed to send message. Please try again.');
    }
  };

  const handleAiMove = async () => {
    if (!match || !gameState) return;
    
    try {
      await trpc.makeAiMove.mutate({
        matchId: matchId,
        variant: match.variant
      });
      await loadGameData(); // Refresh game state
    } catch (error) {
      console.error('AI move failed:', error);
      setError('AI move failed. Please try again.');
    }
  };

  const isPlayerTurn = () => {
    if (!match || !gameState) return false;
    const playerColor = user.id === match.white_player_id ? 'white' : 'black';
    return match.current_player_color === playerColor;
  };

  const getPlayerColor = () => {
    if (!match) return null;
    return user.id === match.white_player_id ? 'white' : 'black';
  };

  const getOpponentName = () => {
    if (!match) return 'Unknown';
    if (match.mode === 'ai') return 'AI Bot';
    if (match.mode === 'pass_and_play') return 'Player 2';
    
    const isWhite = user.id === match.white_player_id;
    return isWhite ? `Player #${match.black_player_id}` : `Player #${match.white_player_id}`;
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <div className="text-4xl mb-4">⏳</div>
          <p className="text-gray-600">Loading game...</p>
        </div>
      </div>
    );
  }

  if (!match || !gameState) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <div className="text-4xl mb-4">❌</div>
          <p className="text-gray-600 mb-4">Game not found</p>
          <Button onClick={onLeaveMatch}>Return to Lobby</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Game Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-3">
            🎲 {match.variant.toUpperCase()} Match
            <Badge 
              className={
                match.status === 'active' ? 'bg-green-100 text-green-800' :
                match.status === 'completed' ? 'bg-blue-100 text-blue-800' :
                'bg-yellow-100 text-yellow-800'
              }
            >
              {match.status}
            </Badge>
          </h1>
          <div className="text-gray-600 mt-2 flex items-center gap-4">
            <span>🤍 {user.id === match.white_player_id ? 'You' : getOpponentName()}</span>
            <span>vs</span>
            <span>🖤 {user.id === match.black_player_id ? 'You' : getOpponentName()}</span>
            <Separator orientation="vertical" className="h-4" />
            <span>Turn: {match.current_player_color}</span>
          </div>
        </div>
        <Button variant="outline" onClick={onLeaveMatch}>
          ← Back to Lobby
        </Button>
      </div>

      {error && (
        <Alert className="border-red-200 bg-red-50">
          <AlertDescription className="text-red-800">
            {error}
          </AlertDescription>
        </Alert>
      )}

      {/* Main Game Layout */}
      <div className="grid grid-cols-1 xl:grid-cols-4 gap-6">
        {/* Game Board - Takes up most space */}
        <div className="xl:col-span-3">
          <Card>
            <CardContent className="p-6">
              <GameBoard
                gameState={gameState}
                match={match}
                playerColor={getPlayerColor()}
                onMove={handleMove}
                isPlayerTurn={isPlayerTurn()}
                isMoving={isMoving}
              />
            </CardContent>
          </Card>

          {/* Game Controls */}
          <div className="mt-4">
            <GameControls
              match={match}
              gameState={gameState}
              isPlayerTurn={isPlayerTurn()}
              isRollingDice={isRollingDice}
              onRollDice={handleRollDice}
              onAiMove={handleAiMove}
              playerColor={getPlayerColor()}
            />
          </div>
        </div>

        {/* Side Panel */}
        <div className="space-y-6">
          {/* Game Info */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Game Info</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <p className="text-sm text-gray-600">Variant</p>
                <p className="font-medium">{match.variant.toUpperCase()}</p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Mode</p>
                <p className="font-medium">{match.mode}</p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Turn</p>
                <p className="font-medium">#{gameState.turn_number}</p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Phase</p>
                <p className="font-medium capitalize">{gameState.phase}</p>
              </div>
              {gameState.dice.length > 0 && (
                <div>
                  <p className="text-sm text-gray-600">Dice</p>
                  <div className="flex gap-2">
                    {gameState.dice.map((die, index) => (
                      <div key={index} className="w-8 h-8 bg-white border-2 border-gray-800 rounded flex items-center justify-center font-bold">
                        {die}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Move History */}
          <MoveHistory moves={moves} />

          {/* Chat Panel */}
          {(match.mode === 'online' || match.mode === 'pass_and_play') && (
            <ChatPanel
              messages={chatMessages}
              onSendMessage={handleSendMessage}
              currentUserId={user.id}
            />
          )}
        </div>
      </div>
    </div>
  );
}