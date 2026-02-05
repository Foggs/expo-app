import { useState, useCallback, useMemo } from "react";
import { Stroke } from "@/components/DrawingCanvas";

const TOTAL_ROUNDS = 3;
const PLAYERS_PER_GAME = 2;

export type PlayerId = "player1" | "player2";

export interface TurnData {
  playerId: PlayerId;
  round: number;
  strokes: Stroke[];
  submittedAt?: number;
}

export interface GameState {
  currentRound: number;
  currentPlayer: PlayerId;
  turns: TurnData[];
  isGameComplete: boolean;
  localPlayerId: PlayerId;
}

interface UseGameStateReturn {
  gameState: GameState;
  isMyTurn: boolean;
  roundDisplay: string;
  turnDisplay: string;
  submitTurn: (strokes: Stroke[]) => void;
  startNextTurn: () => void;
  resetGame: () => void;
  getCurrentRoundStrokes: () => Stroke[];
  getAllStrokes: () => Stroke[];
}

export function useGameState(localPlayerId: PlayerId = "player1"): UseGameStateReturn {
  const [gameState, setGameState] = useState<GameState>({
    currentRound: 1,
    currentPlayer: "player1",
    turns: [],
    isGameComplete: false,
    localPlayerId,
  });

  const isMyTurn = useMemo(
    () => gameState.currentPlayer === gameState.localPlayerId,
    [gameState.currentPlayer, gameState.localPlayerId]
  );

  const roundDisplay = `Round ${gameState.currentRound}/${TOTAL_ROUNDS}`;

  const turnDisplay = useMemo(() => {
    if (gameState.isGameComplete) {
      return "Game Complete!";
    }
    return isMyTurn ? "Your Turn to Draw" : "Opponent's Turn";
  }, [isMyTurn, gameState.isGameComplete]);

  const submitTurn = useCallback((strokes: Stroke[]) => {
    setGameState((prev) => {
      const turnData: TurnData = {
        playerId: prev.currentPlayer,
        round: prev.currentRound,
        strokes,
        submittedAt: Date.now(),
      };

      const newTurns = [...prev.turns, turnData];

      const turnsThisRound = newTurns.filter((t) => t.round === prev.currentRound);
      const roundComplete = turnsThisRound.length >= PLAYERS_PER_GAME;

      let nextRound = prev.currentRound;
      let nextPlayer: PlayerId = prev.currentPlayer === "player1" ? "player2" : "player1";
      let isComplete = false;

      if (roundComplete) {
        if (prev.currentRound >= TOTAL_ROUNDS) {
          isComplete = true;
        } else {
          nextRound = prev.currentRound + 1;
          nextPlayer = "player1";
        }
      }

      return {
        ...prev,
        turns: newTurns,
        currentRound: nextRound,
        currentPlayer: nextPlayer,
        isGameComplete: isComplete,
      };
    });
  }, []);

  const startNextTurn = useCallback(() => {
    // For single-player testing, this simulates starting the next turn
    // In multiplayer, this would be triggered by WebSocket
  }, []);

  const resetGame = useCallback(() => {
    setGameState({
      currentRound: 1,
      currentPlayer: "player1",
      turns: [],
      isGameComplete: false,
      localPlayerId,
    });
  }, [localPlayerId]);

  const getCurrentRoundStrokes = useCallback(() => {
    const roundTurns = gameState.turns.filter(
      (t) => t.round === gameState.currentRound
    );
    return roundTurns.flatMap((t) => t.strokes);
  }, [gameState.turns, gameState.currentRound]);

  const getAllStrokes = useCallback(() => {
    return gameState.turns.flatMap((t) => t.strokes);
  }, [gameState.turns]);

  return {
    gameState,
    isMyTurn,
    roundDisplay,
    turnDisplay,
    submitTurn,
    startNextTurn,
    resetGame,
    getCurrentRoundStrokes,
    getAllStrokes,
  };
}

export { TOTAL_ROUNDS, PLAYERS_PER_GAME };
