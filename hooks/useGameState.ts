import { useState, useCallback, useMemo } from "react";
import { Stroke } from "@/components/DrawingCanvas";
import type { GameStateFromServer } from "@/contexts/WebSocketContext";

const TOTAL_ROUNDS = 3;
const PLAYERS_PER_GAME = 2;

export type PlayerId = "player1" | "player2";

export interface TurnData {
  playerId: PlayerId;
  round: number;
  strokes: Stroke[];
  submittedAt?: number;
}

interface UseGameStateReturn {
  turns: TurnData[];
  isMyTurn: boolean;
  currentRound: number;
  currentPlayer: PlayerId;
  roundDisplay: string;
  turnDisplay: string;
  submitTurn: (strokes: Stroke[]) => void;
  handleServerTurnSubmitted: (data: { playerRole: PlayerId; round: number; strokes: unknown[] }) => void;
  resetGame: () => void;
  getCurrentRoundStrokes: () => Stroke[];
  getAllStrokes: () => Stroke[];
}

export function useGameState(
  playerRole: PlayerId = "player1",
  serverGameState: GameStateFromServer | null = null
): UseGameStateReturn {
  const [turns, setTurns] = useState<TurnData[]>([]);

  const currentRound = serverGameState?.currentRound ?? 1;
  const currentPlayer: PlayerId = (serverGameState?.currentPlayer as PlayerId) ?? "player1";
  const totalRounds = serverGameState?.totalRounds ?? TOTAL_ROUNDS;
  const isComplete = serverGameState?.status === "completed";

  const isMyTurn = useMemo(
    () => !isComplete && currentPlayer === playerRole,
    [currentPlayer, playerRole, isComplete]
  );

  const roundDisplay = `Round ${currentRound}/${totalRounds}`;

  const turnDisplay = useMemo(() => {
    if (isComplete) {
      return "Game Complete!";
    }
    return isMyTurn ? "Your Turn to Draw" : "Opponent's Turn";
  }, [isMyTurn, isComplete]);

  const submitTurn = useCallback((strokes: Stroke[]) => {
    const turnData: TurnData = {
      playerId: playerRole,
      round: currentRound,
      strokes,
      submittedAt: Date.now(),
    };
    setTurns((prev) => [...prev, turnData]);
  }, [playerRole, currentRound]);

  const handleServerTurnSubmitted = useCallback((data: { playerRole: PlayerId; round: number; strokes: unknown[] }) => {
    if (data.playerRole !== playerRole) {
      const opponentStrokes: Stroke[] = (data.strokes as Stroke[]) || [];
      const turnData: TurnData = {
        playerId: data.playerRole,
        round: data.round,
        strokes: opponentStrokes,
        submittedAt: Date.now(),
      };
      setTurns((prev) => [...prev, turnData]);
    }
  }, [playerRole]);

  const resetGame = useCallback(() => {
    setTurns([]);
  }, []);

  const getCurrentRoundStrokes = useCallback(() => {
    const roundTurns = turns.filter((t) => t.round === currentRound);
    return roundTurns.flatMap((t) => t.strokes);
  }, [turns, currentRound]);

  const getAllStrokes = useCallback(() => {
    return turns.flatMap((t) => t.strokes);
  }, [turns]);

  return {
    turns,
    isMyTurn,
    currentRound,
    currentPlayer,
    roundDisplay,
    turnDisplay,
    submitTurn,
    handleServerTurnSubmitted,
    resetGame,
    getCurrentRoundStrokes,
    getAllStrokes,
  };
}

export { TOTAL_ROUNDS, PLAYERS_PER_GAME };
