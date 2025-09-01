import { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import type { GameState, Match, PlayerColor } from '../../../../server/src/schema';

interface GameBoardProps {
  gameState: GameState;
  match: Match;
  playerColor: PlayerColor | null;
  onMove: (fromPoint: number, toPoint: number, diceValue: number) => void;
  isPlayerTurn: boolean;
  isMoving: boolean;
}

export function GameBoard({ gameState, match, playerColor, onMove, isPlayerTurn, isMoving }: GameBoardProps) {
  const [selectedPoint, setSelectedPoint] = useState<number | null>(null);
  const [highlightedMoves, setHighlightedMoves] = useState<number[]>([]);

  const handlePointClick = (pointIndex: number) => {
    if (!isPlayerTurn || isMoving) return;

    if (selectedPoint === null) {
      // Selecting a point to move from
      const point = gameState.board_state.find(p => p.point === pointIndex);
      if (point && point.color === playerColor && point.count > 0) {
        setSelectedPoint(pointIndex);
        // Calculate possible moves based on dice values
        const possibleMoves = calculatePossibleMoves(pointIndex);
        setHighlightedMoves(possibleMoves);
      }
    } else {
      // Making a move
      if (highlightedMoves.includes(pointIndex)) {
        const diceValue = Math.abs(pointIndex - selectedPoint); // Simple calculation
        onMove(selectedPoint, pointIndex, diceValue);
      }
      setSelectedPoint(null);
      setHighlightedMoves([]);
    }
  };

  const calculatePossibleMoves = (fromPoint: number): number[] => {
    if (!playerColor) return [];
    
    const possibleMoves: number[] = [];
    
    // Use available dice values to calculate possible moves
    gameState.dice.forEach(diceValue => {
      let toPoint: number;
      
      if (playerColor === 'white') {
        toPoint = fromPoint - diceValue; // White moves counter-clockwise
      } else {
        toPoint = fromPoint + diceValue; // Black moves clockwise
      }
      
      // Check bounds and validity
      if (toPoint >= 0 && toPoint <= 25) {
        const targetPoint = gameState.board_state.find(p => p.point === toPoint);
        if (canMoveTo(targetPoint, playerColor)) {
          possibleMoves.push(toPoint);
        }
      }
    });
    
    return possibleMoves;
  };

  const canMoveTo = (targetPoint: { color: PlayerColor | null; count: number } | undefined, color: PlayerColor): boolean => {
    if (!targetPoint) return true; // Empty point
    
    switch (match.variant) {
      case 'portes':
        return targetPoint.color === null || targetPoint.color === color || targetPoint.count === 1;
      case 'plakoto':
        return targetPoint.color === null || targetPoint.color === color;
      case 'fevga':
        return targetPoint.color === null || targetPoint.color === color;
      default:
        return false;
    }
  };

  const renderPoint = (pointIndex: number) => {
    const point = gameState.board_state.find(p => p.point === pointIndex);
    const isEmpty = !point || point.count === 0;
    const isSelected = selectedPoint === pointIndex;
    const isHighlighted = highlightedMoves.includes(pointIndex);
    
    const getPointColor = () => {
      if (isSelected) return 'bg-blue-500 border-blue-700';
      if (isHighlighted) return 'bg-green-200 border-green-400';
      if (isEmpty) return 'bg-gray-100 border-gray-300';
      return point?.color === 'white' ? 'bg-white border-gray-800' : 'bg-gray-800 border-gray-600';
    };

    const getTextColor = () => {
      if (point?.color === 'white') return 'text-gray-800';
      return 'text-white';
    };

    return (
      <div
        key={pointIndex}
        className={`
          relative w-12 h-16 border-2 rounded-lg cursor-pointer transition-all
          flex items-center justify-center text-sm font-bold
          hover:scale-105
          ${getPointColor()} ${getTextColor()}
          ${isPlayerTurn && !isMoving ? 'hover:shadow-lg' : ''}
        `}
        onClick={() => handlePointClick(pointIndex)}
      >
        {/* Point number */}
        <div className="absolute -top-6 left-1/2 transform -translate-x-1/2 text-xs text-gray-600">
          {pointIndex}
        </div>
        
        {/* Checker count */}
        {!isEmpty && (
          <div className="flex flex-col items-center">
            <div className="text-lg">
              {point?.color === 'white' ? '⚪' : '⚫'}
            </div>
            {point && point.count > 1 && (
              <div className="text-xs">{point.count}</div>
            )}
          </div>
        )}
        
        {/* Selection indicator */}
        {isSelected && (
          <div className="absolute inset-0 border-4 border-blue-400 rounded-lg animate-pulse"></div>
        )}
        
        {/* Move indicator */}
        {isHighlighted && (
          <div className="absolute inset-0 bg-green-400 opacity-30 rounded-lg animate-pulse"></div>
        )}
      </div>
    );
  };

  const renderBar = () => {
    const barPoint = gameState.board_state.find(p => p.point === 0);
    const whitePieces = barPoint?.color === 'white' ? barPoint.count : 0;
    const blackPieces = barPoint?.color === 'black' ? barPoint.count : 0;
    
    return (
      <Card className="p-4 bg-amber-50 border-amber-200">
        <div className="text-center">
          <h3 className="font-bold mb-2">Bar</h3>
          <div className="space-y-2">
            {whitePieces > 0 && (
              <div className="flex items-center justify-center gap-2">
                <span>⚪</span>
                <Badge variant="outline">{whitePieces}</Badge>
              </div>
            )}
            {blackPieces > 0 && (
              <div className="flex items-center justify-center gap-2">
                <span>⚫</span>
                <Badge variant="outline">{blackPieces}</Badge>
              </div>
            )}
            {whitePieces === 0 && blackPieces === 0 && (
              <span className="text-gray-500 text-sm">Empty</span>
            )}
          </div>
        </div>
      </Card>
    );
  };

  const renderOffBoard = () => {
    const offPoint = gameState.board_state.find(p => p.point === 25);
    const whitePieces = offPoint?.color === 'white' ? offPoint.count : 0;
    const blackPieces = offPoint?.color === 'black' ? offPoint.count : 0;
    
    return (
      <Card className="p-4 bg-green-50 border-green-200">
        <div className="text-center">
          <h3 className="font-bold mb-2">Off Board</h3>
          <div className="space-y-2">
            {whitePieces > 0 && (
              <div className="flex items-center justify-center gap-2">
                <span>⚪</span>
                <Badge variant="outline">{whitePieces}</Badge>
              </div>
            )}
            {blackPieces > 0 && (
              <div className="flex items-center justify-center gap-2">
                <span>⚫</span>
                <Badge variant="outline">{blackPieces}</Badge>
              </div>
            )}
            {whitePieces === 0 && blackPieces === 0 && (
              <span className="text-gray-500 text-sm">Empty</span>
            )}
          </div>
        </div>
      </Card>
    );
  };

  const cancelSelection = () => {
    setSelectedPoint(null);
    setHighlightedMoves([]);
  };

  return (
    <div className="space-y-4">
      {/* Board Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold">
          {match.variant.toUpperCase()} Board
        </h2>
        {selectedPoint !== null && (
          <Button variant="outline" size="sm" onClick={cancelSelection}>
            Cancel Selection
          </Button>
        )}
      </div>

      {/* Instructions */}
      <div className="text-sm text-gray-600 bg-blue-50 p-3 rounded-lg">
        {!isPlayerTurn ? (
          <p>⏳ Waiting for opponent's move...</p>
        ) : gameState.phase === 'rolling' ? (
          <p>🎲 Click "Roll Dice" to start your turn</p>
        ) : selectedPoint === null ? (
          <p>👆 Click on one of your checkers to select it</p>
        ) : (
          <p>🎯 Click on a highlighted point to move your checker</p>
        )}
      </div>

      {/* Game Board */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Bar */}
        <div className="order-2 lg:order-1">
          {renderBar()}
        </div>

        {/* Main Board */}
        <div className="order-1 lg:order-2">
          <Card className="p-4">
            <div className="grid grid-cols-6 gap-2 mb-4">
              <div className="col-span-6 text-center text-sm font-medium text-gray-600 mb-2">
                Points 13-18 (Top)
              </div>
              {[13, 14, 15, 16, 17, 18].map(renderPoint)}
            </div>
            
            <div className="border-t-2 border-amber-400 my-4"></div>
            
            <div className="grid grid-cols-6 gap-2 mb-4">
              {[12, 11, 10, 9, 8, 7].map(renderPoint)}
              <div className="col-span-6 text-center text-sm font-medium text-gray-600 mt-2">
                Points 7-12 (Top)
              </div>
            </div>

            <div className="border-t-4 border-gray-800 my-6"></div>

            <div className="grid grid-cols-6 gap-2 mb-4">
              <div className="col-span-6 text-center text-sm font-medium text-gray-600 mb-2">
                Points 1-6 (Bottom)
              </div>
              {[6, 5, 4, 3, 2, 1].map(renderPoint)}
            </div>
            
            <div className="border-t-2 border-amber-400 my-4"></div>
            
            <div className="grid grid-cols-6 gap-2">
              {[19, 20, 21, 22, 23, 24].map(renderPoint)}
              <div className="col-span-6 text-center text-sm font-medium text-gray-600 mt-2">
                Points 19-24 (Bottom)
              </div>
            </div>
          </Card>
        </div>

        {/* Off Board */}
        <div className="order-3">
          {renderOffBoard()}
        </div>
      </div>

      {/* Current Dice Display */}
      {gameState.dice.length > 0 && (
        <Card className="p-4">
          <div className="text-center">
            <h3 className="font-bold mb-3">Current Dice</h3>
            <div className="flex justify-center gap-3">
              {gameState.dice.map((die, index) => (
                <div key={index} className="w-12 h-12 bg-white border-2 border-gray-800 rounded-lg flex items-center justify-center text-xl font-bold shadow-lg">
                  {die}
                </div>
              ))}
            </div>
            {gameState.available_moves.length > 0 && (
              <p className="text-sm text-gray-600 mt-2">
                Available moves: {gameState.available_moves.join(', ')}
              </p>
            )}
          </div>
        </Card>
      )}
    </div>
  );
}