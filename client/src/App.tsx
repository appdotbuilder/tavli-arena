import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { AuthView } from './components/AuthView';
import { LobbyView } from './components/LobbyView';
import { GameView } from './components/GameView';
import { ProfileView } from './components/ProfileView';
import { trpc } from './utils/trpc';
import type { User } from '../../server/src/schema';

type ViewType = 'auth' | 'lobby' | 'game' | 'profile';

function App() {
  const [currentView, setCurrentView] = useState<ViewType>('auth');
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [, setAuthToken] = useState<string | null>(null);
  const [currentMatchId, setCurrentMatchId] = useState<number | null>(null);
  const [isConnected, setIsConnected] = useState(true);

  // Load auth state from localStorage on mount
  useEffect(() => {
    const savedUser = localStorage.getItem('tavli_user');
    const savedToken = localStorage.getItem('tavli_token');
    
    if (savedUser && savedToken) {
      try {
        const user = JSON.parse(savedUser) as User;
        setCurrentUser(user);
        setAuthToken(savedToken);
        setCurrentView('lobby');
      } catch (error) {
        console.error('Failed to parse saved auth data:', error);
        localStorage.removeItem('tavli_user');
        localStorage.removeItem('tavli_token');
      }
    }
  }, []);

  // Check server health periodically
  useEffect(() => {
    const checkHealth = async () => {
      try {
        await trpc.healthcheck.query();
        setIsConnected(true);
      } catch {
        setIsConnected(false);
      }
    };

    checkHealth();
    const interval = setInterval(checkHealth, 30000); // Check every 30 seconds
    return () => clearInterval(interval);
  }, []);

  const handleLogin = (user: User, token: string) => {
    setCurrentUser(user);
    setAuthToken(token);
    localStorage.setItem('tavli_user', JSON.stringify(user));
    localStorage.setItem('tavli_token', token);
    setCurrentView('lobby');
  };

  const handleLogout = () => {
    setCurrentUser(null);
    setAuthToken(null);
    setCurrentMatchId(null);
    localStorage.removeItem('tavli_user');
    localStorage.removeItem('tavli_token');
    setCurrentView('auth');
  };

  const handleJoinMatch = (matchId: number) => {
    setCurrentMatchId(matchId);
    setCurrentView('game');
  };

  const handleLeaveMatch = () => {
    setCurrentMatchId(null);
    setCurrentView('lobby');
  };

  const renderHeader = () => {
    if (!currentUser) return null;

    return (
      <header className="border-b bg-white shadow-sm">
        <div className="container mx-auto flex items-center justify-between px-4 py-3">
          <div className="flex items-center space-x-4">
            <h1 className="text-2xl font-bold text-blue-700">
              🎲 Tavli Arena
            </h1>
            {!isConnected && (
              <Badge variant="destructive" className="animate-pulse">
                Disconnected
              </Badge>
            )}
          </div>
          
          <div className="flex items-center space-x-4">
            <div className="text-sm text-gray-600">
              <span className="font-medium">{currentUser.username}</span>
              <Badge variant="secondary" className="ml-2">
                ELO: {currentUser.elo_rating}
              </Badge>
            </div>
            
            <Tabs value={currentView} onValueChange={(value) => setCurrentView(value as ViewType)}>
              <TabsList className="grid w-fit grid-cols-3">
                <TabsTrigger value="lobby" disabled={currentView === 'game'}>
                  Lobby
                </TabsTrigger>
                <TabsTrigger value="profile" disabled={currentView === 'game'}>
                  Profile
                </TabsTrigger>
                <TabsTrigger value="game" disabled={!currentMatchId}>
                  Game
                </TabsTrigger>
              </TabsList>
            </Tabs>
            
            <Button 
              variant="outline" 
              size="sm" 
              onClick={handleLogout}
              disabled={currentView === 'game'}
            >
              Logout
            </Button>
          </div>
        </div>
      </header>
    );
  };

  const renderContent = () => {
    if (!currentUser) {
      return <AuthView onLogin={handleLogin} />;
    }

    switch (currentView) {
      case 'lobby':
        return <LobbyView user={currentUser} onJoinMatch={handleJoinMatch} />;
      case 'game':
        return currentMatchId ? (
          <GameView 
            user={currentUser} 
            matchId={currentMatchId} 
            onLeaveMatch={handleLeaveMatch}
          />
        ) : (
          <div className="flex items-center justify-center min-h-[400px]">
            <p>No active match</p>
          </div>
        );
      case 'profile':
        return <ProfileView user={currentUser} />;
      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {renderHeader()}
      <main className="container mx-auto px-4 py-6">
        {!isConnected && (
          <Card className="mb-4 border-red-200 bg-red-50">
            <div className="p-4 text-center text-red-800">
              <p className="font-medium">Connection Lost</p>
              <p className="text-sm">
                Reconnecting to server... Some features may be unavailable.
              </p>
            </div>
          </Card>
        )}
        {renderContent()}
      </main>
    </div>
  );
}

export default App;