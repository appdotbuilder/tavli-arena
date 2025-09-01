import { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

import { Alert, AlertDescription } from '@/components/ui/alert';
import { trpc } from '@/utils/trpc';
import { CreateMatchDialog } from './CreateMatchDialog';
import type { User, Match, MatchFilters, GameVariant, GameMode, MatchStatus } from '../../../server/src/schema';

interface LobbyViewProps {
  user: User;
  onJoinMatch: (matchId: number) => void;
}

export function LobbyView({ user, onJoinMatch }: LobbyViewProps) {
  const [matches, setMatches] = useState<Match[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isJoining, setIsJoining] = useState<number | null>(null);
  
  const [filters, setFilters] = useState<MatchFilters>({
    variant: undefined,
    mode: undefined,
    status: undefined
  });

  const loadMatches = useCallback(async () => {
    try {
      setIsLoading(true);
      const result = await trpc.getMatches.query(filters);
      setMatches(result);
      setError(null);
    } catch (error) {
      console.error('Failed to load matches:', error);
      setError('Failed to load matches. Please try again.');
    } finally {
      setIsLoading(false);
    }
  }, [filters]);

  useEffect(() => {
    loadMatches();
  }, [loadMatches]);

  // Poll for updates every 5 seconds
  useEffect(() => {
    const interval = setInterval(loadMatches, 5000);
    return () => clearInterval(interval);
  }, [loadMatches]);

  const handleJoinMatch = async (match: Match) => {
    if (match.black_player_id !== null) {
      // Match is full, just view it
      onJoinMatch(match.id);
      return;
    }

    setIsJoining(match.id);
    try {
      await trpc.joinMatch.mutate({
        match_id: match.id,
        black_player_id: user.id
      });
      onJoinMatch(match.id);
    } catch (error) {
      console.error('Failed to join match:', error);
      setError('Failed to join match. Please try again.');
    } finally {
      setIsJoining(null);
    }
  };

  const handleCreateMatch = () => {
    setIsCreateDialogOpen(true);
  };

  const handleMatchCreated = (matchId: number) => {
    setIsCreateDialogOpen(false);
    loadMatches(); // Refresh the list
    onJoinMatch(matchId);
  };

  const getVariantDescription = (variant: GameVariant) => {
    switch (variant) {
      case 'portes':
        return 'Classic backgammon with hitting and bearing off';
      case 'plakoto':
        return 'No hitting - block opponent pieces instead';
      case 'fevga':
        return 'Both players move in same direction';
    }
  };

  const getStatusColor = (status: MatchStatus) => {
    switch (status) {
      case 'waiting':
        return 'bg-yellow-100 text-yellow-800';
      case 'active':
        return 'bg-green-100 text-green-800';
      case 'completed':
        return 'bg-blue-100 text-blue-800';
      case 'abandoned':
        return 'bg-red-100 text-red-800';
    }
  };

  const getModeIcon = (mode: GameMode) => {
    switch (mode) {
      case 'ai':
        return '🤖';
      case 'online':
        return '🌐';
      case 'pass_and_play':
        return '👥';
    }
  };

  const filteredMatches = matches.filter(match => {
    if (filters.variant && match.variant !== filters.variant) return false;
    if (filters.mode && match.mode !== filters.mode) return false;
    if (filters.status && match.status !== filters.status) return false;
    return true;
  });

  const waitingMatches = filteredMatches.filter(match => match.status === 'waiting');
  const activeMatches = filteredMatches.filter(match => match.status === 'active');
  const completedMatches = filteredMatches.filter(match => match.status === 'completed');

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Game Lobby</h1>
          <p className="text-gray-600 mt-2">
            Welcome back, {user.username}! Choose a match or create a new one.
          </p>
        </div>
        <Button onClick={handleCreateMatch} size="lg" className="bg-blue-600 hover:bg-blue-700">
          🎯 Create New Match
        </Button>
      </div>

      {error && (
        <Alert className="border-red-200 bg-red-50">
          <AlertDescription className="text-red-800">
            {error}
          </AlertDescription>
        </Alert>
      )}

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Filter Matches</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="text-sm font-medium mb-2 block">Variant</label>
              <Select 
                value={filters.variant || 'all'} 
                onValueChange={(value: string) => 
                  setFilters((prev: MatchFilters) => ({ 
                    ...prev, 
                    variant: value === 'all' ? undefined : value as GameVariant 
                  }))
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Variants</SelectItem>
                  <SelectItem value="portes">Portes (Classic)</SelectItem>
                  <SelectItem value="plakoto">Plakoto (Blocking)</SelectItem>
                  <SelectItem value="fevga">Fevga (Chase)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-sm font-medium mb-2 block">Mode</label>
              <Select 
                value={filters.mode || 'all'} 
                onValueChange={(value: string) => 
                  setFilters((prev: MatchFilters) => ({ 
                    ...prev, 
                    mode: value === 'all' ? undefined : value as GameMode 
                  }))
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Modes</SelectItem>
                  <SelectItem value="ai">🤖 vs AI</SelectItem>
                  <SelectItem value="online">🌐 Online</SelectItem>
                  <SelectItem value="pass_and_play">👥 Pass & Play</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-sm font-medium mb-2 block">Status</label>
              <Select 
                value={filters.status || 'all'} 
                onValueChange={(value: string) => 
                  setFilters((prev: MatchFilters) => ({ 
                    ...prev, 
                    status: value === 'all' ? undefined : value as MatchStatus 
                  }))
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Statuses</SelectItem>
                  <SelectItem value="waiting">Waiting</SelectItem>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="completed">Completed</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Waiting Matches */}
      {waitingMatches.length > 0 && (
        <div>
          <h2 className="text-xl font-semibold mb-4 text-green-700">
            🟢 Waiting for Players ({waitingMatches.length})
          </h2>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {waitingMatches.map((match: Match) => (
              <Card key={match.id} className="hover:shadow-md transition-shadow border-green-200">
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-lg flex items-center gap-2">
                      {getModeIcon(match.mode)} {match.variant.toUpperCase()}
                    </CardTitle>
                    <Badge className={getStatusColor(match.status)}>
                      {match.status}
                    </Badge>
                  </div>
                  <CardDescription>
                    {getVariantDescription(match.variant)}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    <div className="text-sm">
                      <p><strong>Created:</strong> {match.created_at.toLocaleString()}</p>
                      <p><strong>White Player:</strong> Player #{match.white_player_id}</p>
                      <p><strong>Looking for:</strong> Black Player</p>
                    </div>
                    <Button 
                      className="w-full bg-green-600 hover:bg-green-700"
                      onClick={() => handleJoinMatch(match)}
                      disabled={isJoining === match.id}
                    >
                      {isJoining === match.id ? 'Joining...' : '🎮 Join Match'}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* Active Matches */}
      {activeMatches.length > 0 && (
        <div>
          <h2 className="text-xl font-semibold mb-4 text-blue-700">
            🔵 Active Games ({activeMatches.length})
          </h2>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {activeMatches.map((match: Match) => (
              <Card key={match.id} className="hover:shadow-md transition-shadow border-blue-200">
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-lg flex items-center gap-2">
                      {getModeIcon(match.mode)} {match.variant.toUpperCase()}
                    </CardTitle>
                    <Badge className={getStatusColor(match.status)}>
                      {match.status}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    <div className="text-sm">
                      <p><strong>White:</strong> Player #{match.white_player_id}</p>
                      <p><strong>Black:</strong> Player #{match.black_player_id}</p>
                      <p><strong>Turn:</strong> {match.current_player_color}</p>
                    </div>
                    <Button 
                      variant="outline" 
                      className="w-full"
                      onClick={() => handleJoinMatch(match)}
                    >
                      👀 Spectate
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* Completed Matches */}
      {completedMatches.length > 0 && (
        <div>
          <h2 className="text-xl font-semibold mb-4 text-gray-700">
            📊 Recent Matches ({completedMatches.length})
          </h2>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {completedMatches.slice(0, 6).map((match: Match) => (
              <Card key={match.id} className="hover:shadow-md transition-shadow">
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-lg flex items-center gap-2">
                      {getModeIcon(match.mode)} {match.variant.toUpperCase()}
                    </CardTitle>
                    <Badge className={getStatusColor(match.status)}>
                      Completed
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    <div className="text-sm">
                      <p><strong>Winner:</strong> {match.winner_color ? `${match.winner_color} player` : 'Draw'}</p>
                      <p><strong>Finished:</strong> {match.updated_at.toLocaleDateString()}</p>
                    </div>
                    <Button 
                      variant="outline" 
                      className="w-full"
                      onClick={() => handleJoinMatch(match)}
                    >
                      📖 View Replay
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* Empty State */}
      {isLoading ? (
        <div className="text-center py-12">
          <div className="text-4xl mb-4">⏳</div>
          <p className="text-gray-600">Loading matches...</p>
        </div>
      ) : filteredMatches.length === 0 ? (
        <div className="text-center py-12">
          <div className="text-4xl mb-4">🎯</div>
          <p className="text-gray-600 mb-4">No matches found with current filters.</p>
          <Button onClick={handleCreateMatch} className="bg-blue-600 hover:bg-blue-700">
            Create the First Match
          </Button>
        </div>
      ) : null}

      <CreateMatchDialog
        isOpen={isCreateDialogOpen}
        onClose={() => setIsCreateDialogOpen(false)}
        onMatchCreated={handleMatchCreated}
        userId={user.id}
      />
    </div>
  );
}