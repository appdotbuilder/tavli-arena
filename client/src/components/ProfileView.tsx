import { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { trpc } from '@/utils/trpc';
import type { User, Match } from '../../../server/src/schema';

interface ProfileViewProps {
  user: User;
}

export function ProfileView({ user }: ProfileViewProps) {
  const [userProfile, setUserProfile] = useState<User>(user);
  const [userMatches, setUserMatches] = useState<Match[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadProfileData = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);

      // Load updated user profile
      const profile = await trpc.getUserProfile.query({ userId: user.id });
      if (profile) {
        setUserProfile(profile);
      }

      // Load user's matches
      const matches = await trpc.getMatches.query();
      // Filter matches where user participated
      const filteredMatches = matches.filter(
        (match: Match) => match.white_player_id === user.id || match.black_player_id === user.id
      );
      setUserMatches(filteredMatches);

    } catch (error) {
      console.error('Failed to load profile data:', error);
      setError('Failed to load profile data. Please try again.');
    } finally {
      setIsLoading(false);
    }
  }, [user.id]);

  useEffect(() => {
    loadProfileData();
  }, [loadProfileData]);

  const calculateStats = () => {
    const totalGames = userMatches.length;
    const completedGames = userMatches.filter(match => match.status === 'completed');
    const wins = completedGames.filter(match => {
      const playerColor = match.white_player_id === user.id ? 'white' : 'black';
      return match.winner_color === playerColor;
    }).length;
    const losses = completedGames.filter(match => {
      const playerColor = match.white_player_id === user.id ? 'white' : 'black';
      return match.winner_color && match.winner_color !== playerColor;
    }).length;
    const draws = completedGames.filter(match => !match.winner_color).length;
    
    const winRate = completedGames.length > 0 ? (wins / completedGames.length) * 100 : 0;

    return {
      totalGames,
      completedGames: completedGames.length,
      wins,
      losses,
      draws,
      winRate
    };
  };

  const getVariantStats = () => {
    const variants = ['portes', 'plakoto', 'fevga'] as const;
    return variants.map(variant => {
      const variantMatches = userMatches.filter(match => match.variant === variant);
      const completedVariantMatches = variantMatches.filter(match => match.status === 'completed');
      const wins = completedVariantMatches.filter(match => {
        const playerColor = match.white_player_id === user.id ? 'white' : 'black';
        return match.winner_color === playerColor;
      }).length;
      
      return {
        variant,
        total: variantMatches.length,
        completed: completedVariantMatches.length,
        wins,
        winRate: completedVariantMatches.length > 0 ? (wins / completedVariantMatches.length) * 100 : 0
      };
    });
  };

  const getRecentMatches = () => {
    return userMatches
      .filter(match => match.status === 'completed')
      .sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime())
      .slice(0, 10);
  };

  const getEloTier = (elo: number) => {
    if (elo >= 2000) return { tier: 'Master', color: 'text-purple-700', bg: 'bg-purple-100' };
    if (elo >= 1800) return { tier: 'Expert', color: 'text-blue-700', bg: 'bg-blue-100' };
    if (elo >= 1600) return { tier: 'Advanced', color: 'text-green-700', bg: 'bg-green-100' };
    if (elo >= 1400) return { tier: 'Intermediate', color: 'text-yellow-700', bg: 'bg-yellow-100' };
    if (elo >= 1200) return { tier: 'Beginner', color: 'text-orange-700', bg: 'bg-orange-100' };
    return { tier: 'Novice', color: 'text-gray-700', bg: 'bg-gray-100' };
  };

  const stats = calculateStats();
  const variantStats = getVariantStats();
  const recentMatches = getRecentMatches();
  const eloTier = getEloTier(userProfile.elo_rating);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <div className="text-4xl mb-4">⏳</div>
          <p className="text-gray-600">Loading profile...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Profile Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-3">
            👤 Player Profile
          </h1>
          <p className="text-gray-600 mt-2">
            View your game statistics and match history
          </p>
        </div>
        <Button onClick={loadProfileData} variant="outline" disabled={isLoading}>
          🔄 Refresh
        </Button>
      </div>

      {error && (
        <Alert className="border-red-200 bg-red-50">
          <AlertDescription className="text-red-800">
            {error}
          </AlertDescription>
        </Alert>
      )}

      {/* Profile Overview */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card>
          <CardHeader className="text-center">
            <div className="text-4xl mb-2">🎯</div>
            <CardTitle className="text-xl">{userProfile.username}</CardTitle>
            <CardDescription>
              Member since {userProfile.created_at.toLocaleDateString()}
            </CardDescription>
          </CardHeader>
          <CardContent className="text-center space-y-3">
            <div>
              <div className="text-2xl font-bold text-blue-600">
                {userProfile.elo_rating}
              </div>
              <div className={`text-sm px-3 py-1 rounded-full ${eloTier.bg} ${eloTier.color} inline-block`}>
                {eloTier.tier}
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="text-center">
            <div className="text-4xl mb-2">🏆</div>
            <CardTitle className="text-xl">Game Record</CardTitle>
            <CardDescription>Overall performance</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex justify-between">
              <span>Total Games:</span>
              <Badge variant="outline">{stats.totalGames}</Badge>
            </div>
            <div className="flex justify-between">
              <span>Wins:</span>
              <Badge className="bg-green-100 text-green-800">{stats.wins}</Badge>
            </div>
            <div className="flex justify-between">
              <span>Losses:</span>
              <Badge className="bg-red-100 text-red-800">{stats.losses}</Badge>
            </div>
            <div className="flex justify-between">
              <span>Draws:</span>
              <Badge className="bg-gray-100 text-gray-800">{stats.draws}</Badge>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="text-center">
            <div className="text-4xl mb-2">📊</div>
            <CardTitle className="text-xl">Win Rate</CardTitle>
            <CardDescription>Success percentage</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="text-center">
              <div className="text-3xl font-bold text-green-600">
                {stats.winRate.toFixed(1)}%
              </div>
            </div>
            <Progress value={stats.winRate} className="w-full" />
            <div className="text-sm text-gray-600 text-center">
              {stats.wins} wins out of {stats.completedGames} completed games
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Detailed Statistics */}
      <Tabs defaultValue="variants" className="w-full">
        <TabsList className="grid w-fit grid-cols-3">
          <TabsTrigger value="variants">By Variant</TabsTrigger>
          <TabsTrigger value="recent">Recent Matches</TabsTrigger>
          <TabsTrigger value="achievements">Achievements</TabsTrigger>
        </TabsList>

        <TabsContent value="variants" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {variantStats.map((stat) => (
              <Card key={stat.variant}>
                <CardHeader>
                  <CardTitle className="text-lg capitalize flex items-center gap-2">
                    {stat.variant === 'portes' && '🎯'}
                    {stat.variant === 'plakoto' && '🛡️'}
                    {stat.variant === 'fevga' && '🏃'}
                    {stat.variant}
                  </CardTitle>
                  <CardDescription>
                    {stat.variant === 'portes' && 'Classic backgammon'}
                    {stat.variant === 'plakoto' && 'Blocking variant'}
                    {stat.variant === 'fevga' && 'Chase variant'}
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex justify-between">
                    <span>Games:</span>
                    <Badge variant="outline">{stat.total}</Badge>
                  </div>
                  <div className="flex justify-between">
                    <span>Completed:</span>
                    <Badge variant="secondary">{stat.completed}</Badge>
                  </div>
                  <div className="flex justify-between">
                    <span>Wins:</span>
                    <Badge className="bg-green-100 text-green-800">{stat.wins}</Badge>
                  </div>
                  <div>
                    <div className="flex justify-between items-center mb-1">
                      <span className="text-sm">Win Rate:</span>
                      <span className="text-sm font-medium">{stat.winRate.toFixed(1)}%</span>
                    </div>
                    <Progress value={stat.winRate} className="w-full" />
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="recent" className="space-y-4">
          {recentMatches.length === 0 ? (
            <Card>
              <CardContent className="text-center py-8">
                <div className="text-4xl mb-4">🎯</div>
                <p className="text-gray-600">No completed matches yet.</p>
                <p className="text-sm text-gray-500">Play some games to see your match history!</p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {recentMatches.map((match: Match) => {
                const playerColor = match.white_player_id === user.id ? 'white' : 'black';
                const isWin = match.winner_color === playerColor;
                const isDraw = !match.winner_color;
                
                return (
                  <Card key={match.id} className="p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="text-2xl">
                          {match.variant === 'portes' && '🎯'}
                          {match.variant === 'plakoto' && '🛡️'}
                          {match.variant === 'fevga' && '🏃'}
                        </div>
                        <div>
                          <div className="font-medium capitalize">
                            {match.variant} • {match.mode}
                          </div>
                          <div className="text-sm text-gray-600">
                            {match.updated_at.toLocaleDateString()} • 
                            You played as {playerColor}
                          </div>
                        </div>
                      </div>
                      <div className="text-right">
                        <Badge 
                          className={
                            isWin ? 'bg-green-100 text-green-800' :
                            isDraw ? 'bg-gray-100 text-gray-800' :
                            'bg-red-100 text-red-800'
                          }
                        >
                          {isWin ? '🏆 Win' : isDraw ? '🤝 Draw' : '💔 Loss'}
                        </Badge>
                        <div className="text-xs text-gray-500 mt-1">
                          Match #{match.id}
                        </div>
                      </div>
                    </div>
                  </Card>
                );
              })}
            </div>
          )}
        </TabsContent>

        <TabsContent value="achievements" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {/* Achievement cards */}
            <Card className={stats.wins >= 1 ? 'border-green-200 bg-green-50' : 'opacity-50'}>
              <CardContent className="p-6 text-center">
                <div className="text-3xl mb-2">🎯</div>
                <div className="font-medium">First Victory</div>
                <div className="text-sm text-gray-600">Win your first game</div>
                {stats.wins >= 1 && <Badge className="mt-2 bg-green-100 text-green-800">Unlocked!</Badge>}
              </CardContent>
            </Card>

            <Card className={stats.wins >= 10 ? 'border-blue-200 bg-blue-50' : 'opacity-50'}>
              <CardContent className="p-6 text-center">
                <div className="text-3xl mb-2">🏆</div>
                <div className="font-medium">Veteran Player</div>
                <div className="text-sm text-gray-600">Win 10 games</div>
                {stats.wins >= 10 && <Badge className="mt-2 bg-blue-100 text-blue-800">Unlocked!</Badge>}
              </CardContent>
            </Card>

            <Card className={stats.winRate >= 70 && stats.completedGames >= 10 ? 'border-purple-200 bg-purple-50' : 'opacity-50'}>
              <CardContent className="p-6 text-center">
                <div className="text-3xl mb-2">👑</div>
                <div className="font-medium">Dominant</div>
                <div className="text-sm text-gray-600">70%+ win rate (10+ games)</div>
                {stats.winRate >= 70 && stats.completedGames >= 10 && (
                  <Badge className="mt-2 bg-purple-100 text-purple-800">Unlocked!</Badge>
                )}
              </CardContent>
            </Card>

            <Card className={userProfile.elo_rating >= 1600 ? 'border-orange-200 bg-orange-50' : 'opacity-50'}>
              <CardContent className="p-6 text-center">
                <div className="text-3xl mb-2">📈</div>
                <div className="font-medium">Rising Star</div>
                <div className="text-sm text-gray-600">Reach 1600 ELO</div>
                {userProfile.elo_rating >= 1600 && (
                  <Badge className="mt-2 bg-orange-100 text-orange-800">Unlocked!</Badge>
                )}
              </CardContent>
            </Card>

            <Card className={variantStats.every(s => s.completed > 0) ? 'border-teal-200 bg-teal-50' : 'opacity-50'}>
              <CardContent className="p-6 text-center">
                <div className="text-3xl mb-2">🎨</div>
                <div className="font-medium">Versatile</div>
                <div className="text-sm text-gray-600">Play all variants</div>
                {variantStats.every(s => s.completed > 0) && (
                  <Badge className="mt-2 bg-teal-100 text-teal-800">Unlocked!</Badge>
                )}
              </CardContent>
            </Card>

            <Card className={stats.totalGames >= 50 ? 'border-indigo-200 bg-indigo-50' : 'opacity-50'}>
              <CardContent className="p-6 text-center">
                <div className="text-3xl mb-2">🎮</div>
                <div className="font-medium">Enthusiast</div>
                <div className="text-sm text-gray-600">Play 50+ games</div>
                {stats.totalGames >= 50 && (
                  <Badge className="mt-2 bg-indigo-100 text-indigo-800">Unlocked!</Badge>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}