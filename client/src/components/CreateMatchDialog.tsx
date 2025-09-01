import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { trpc } from '@/utils/trpc';
import type { GameVariant, GameMode, CreateMatchInput } from '../../../server/src/schema';

interface CreateMatchDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onMatchCreated: (matchId: number) => void;
  userId: number;
}

export function CreateMatchDialog({ isOpen, onClose, onMatchCreated, userId }: CreateMatchDialogProps) {
  const [selectedVariant, setSelectedVariant] = useState<GameVariant>('portes');
  const [selectedMode, setSelectedMode] = useState<GameMode>('online');
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleCreate = async () => {
    setIsCreating(true);
    setError(null);

    try {
      const matchData: CreateMatchInput = {
        variant: selectedVariant,
        mode: selectedMode,
        white_player_id: userId
      };

      const result = await trpc.createMatch.mutate(matchData);
      
      // Initialize the game board
      await trpc.initializeGameBoard.mutate({
        matchId: result.id,
        variant: selectedVariant
      });

      onMatchCreated(result.id);
    } catch (error) {
      console.error('Failed to create match:', error);
      setError(error instanceof Error ? error.message : 'Failed to create match. Please try again.');
    } finally {
      setIsCreating(false);
    }
  };

  const variantOptions = [
    {
      id: 'portes' as GameVariant,
      title: 'Portes (Classic)',
      description: 'Traditional backgammon with hitting and bearing off',
      icon: '🎯',
      features: ['Hitting opponent pieces', 'Bar re-entry required', 'Bear off from home board']
    },
    {
      id: 'plakoto' as GameVariant,
      title: 'Plakoto (Blocking)',
      description: 'Block opponent pieces instead of hitting them',
      icon: '🛡️',
      features: ['No hitting - only blocking', 'Nail opponent pieces', 'Win by nailing starting checker']
    },
    {
      id: 'fevga' as GameVariant,
      title: 'Fevga (Chase)',
      description: 'Both players move in the same direction',
      icon: '🏃',
      features: ['Same direction movement', 'No hitting allowed', 'Must leave one point open']
    }
  ];

  const modeOptions = [
    {
      id: 'online' as GameMode,
      title: 'Online Match',
      description: 'Play against another human player',
      icon: '🌐',
      recommended: true
    },
    {
      id: 'ai' as GameMode,
      title: 'vs AI Bot',
      description: 'Practice against computer opponent',
      icon: '🤖',
      recommended: false
    },
    {
      id: 'pass_and_play' as GameMode,
      title: 'Pass & Play',
      description: 'Two players on same device',
      icon: '👥',
      recommended: false
    }
  ];

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-2xl">Create New Match</DialogTitle>
          <DialogDescription>
            Choose your preferred game variant and mode
          </DialogDescription>
        </DialogHeader>

        {error && (
          <Alert className="border-red-200 bg-red-50">
            <AlertDescription className="text-red-800">
              {error}
            </AlertDescription>
          </Alert>
        )}

        <div className="space-y-6">
          {/* Game Variant Selection */}
          <div>
            <Label className="text-lg font-medium mb-4 block">Game Variant</Label>
            <RadioGroup 
              value={selectedVariant} 
              onValueChange={(value: string) => setSelectedVariant(value as GameVariant)}
              className="space-y-4"
            >
              {variantOptions.map((variant) => (
                <div key={variant.id}>
                  <Label 
                    htmlFor={variant.id}
                    className="cursor-pointer"
                  >
                    <Card 
                      className={`transition-all hover:shadow-md ${
                        selectedVariant === variant.id 
                          ? 'border-blue-500 bg-blue-50' 
                          : 'border-gray-200'
                      }`}
                    >
                      <CardHeader className="pb-3">
                        <div className="flex items-center space-x-3">
                          <RadioGroupItem value={variant.id} id={variant.id} />
                          <div className="text-2xl">{variant.icon}</div>
                          <div>
                            <CardTitle className="text-lg">{variant.title}</CardTitle>
                            <CardDescription>{variant.description}</CardDescription>
                          </div>
                        </div>
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-1">
                          {variant.features.map((feature, index) => (
                            <div key={index} className="text-sm text-gray-600 flex items-center">
                              <span className="w-1 h-1 bg-blue-500 rounded-full mr-2"></span>
                              {feature}
                            </div>
                          ))}
                        </div>
                      </CardContent>
                    </Card>
                  </Label>
                </div>
              ))}
            </RadioGroup>
          </div>

          {/* Game Mode Selection */}
          <div>
            <Label className="text-lg font-medium mb-4 block">Game Mode</Label>
            <RadioGroup 
              value={selectedMode} 
              onValueChange={(value: string) => setSelectedMode(value as GameMode)}
              className="space-y-3"
            >
              {modeOptions.map((mode) => (
                <div key={mode.id}>
                  <Label 
                    htmlFor={mode.id}
                    className="cursor-pointer"
                  >
                    <Card 
                      className={`transition-all hover:shadow-md ${
                        selectedMode === mode.id 
                          ? 'border-green-500 bg-green-50' 
                          : 'border-gray-200'
                      }`}
                    >
                      <CardContent className="pt-4">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center space-x-3">
                            <RadioGroupItem value={mode.id} id={mode.id} />
                            <div className="text-2xl">{mode.icon}</div>
                            <div>
                              <div className="font-medium flex items-center gap-2">
                                {mode.title}
                                {mode.recommended && (
                                  <span className="bg-green-100 text-green-800 text-xs px-2 py-1 rounded-full">
                                    Recommended
                                  </span>
                                )}
                              </div>
                              <p className="text-sm text-gray-600">{mode.description}</p>
                            </div>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  </Label>
                </div>
              ))}
            </RadioGroup>
          </div>

          {/* Action Buttons */}
          <div className="flex justify-end space-x-3 pt-4 border-t">
            <Button variant="outline" onClick={onClose} disabled={isCreating}>
              Cancel
            </Button>
            <Button 
              onClick={handleCreate} 
              disabled={isCreating}
              className="bg-blue-600 hover:bg-blue-700"
            >
              {isCreating ? 'Creating...' : '🎮 Create Match'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}