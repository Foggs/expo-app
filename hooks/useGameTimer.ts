import { useState, useEffect, useCallback, useRef } from "react";

const TURN_DURATION_SECONDS = 120; // 2 minutes

interface UseGameTimerOptions {
  onTimeUp?: () => void;
  autoStart?: boolean;
}

interface UseGameTimerReturn {
  timeRemaining: number;
  isRunning: boolean;
  progress: number;
  formattedTime: string;
  timerColor: "active" | "warning" | "critical";
  start: () => void;
  pause: () => void;
  reset: () => void;
  restart: () => void;
}

export function useGameTimer({
  onTimeUp,
  autoStart = false,
}: UseGameTimerOptions = {}): UseGameTimerReturn {
  const [timeRemaining, setTimeRemaining] = useState(TURN_DURATION_SECONDS);
  const [isRunning, setIsRunning] = useState(autoStart);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const onTimeUpRef = useRef(onTimeUp);

  onTimeUpRef.current = onTimeUp;

  const clearTimer = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  const start = useCallback(() => {
    setIsRunning(true);
  }, []);

  const pause = useCallback(() => {
    setIsRunning(false);
    clearTimer();
  }, [clearTimer]);

  const reset = useCallback(() => {
    clearTimer();
    setTimeRemaining(TURN_DURATION_SECONDS);
    setIsRunning(false);
  }, [clearTimer]);

  const restart = useCallback(() => {
    clearTimer();
    setTimeRemaining(TURN_DURATION_SECONDS);
    setIsRunning(true);
  }, [clearTimer]);

  useEffect(() => {
    if (isRunning && timeRemaining > 0) {
      intervalRef.current = setInterval(() => {
        setTimeRemaining((prev) => {
          if (prev <= 1) {
            clearTimer();
            setIsRunning(false);
            setTimeout(() => {
              onTimeUpRef.current?.();
            }, 0);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }

    return () => clearTimer();
  }, [isRunning, timeRemaining, clearTimer]);

  const progress = timeRemaining / TURN_DURATION_SECONDS;

  const minutes = Math.floor(timeRemaining / 60);
  const seconds = timeRemaining % 60;
  const formattedTime = `${minutes}:${seconds.toString().padStart(2, "0")}`;

  let timerColor: "active" | "warning" | "critical" = "active";
  if (timeRemaining <= 10) {
    timerColor = "critical";
  } else if (timeRemaining <= 30) {
    timerColor = "warning";
  }

  return {
    timeRemaining,
    isRunning,
    progress,
    formattedTime,
    timerColor,
    start,
    pause,
    reset,
    restart,
  };
}

export { TURN_DURATION_SECONDS };
