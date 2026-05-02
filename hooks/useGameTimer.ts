import { useState, useEffect, useCallback, useRef } from "react";

const TURN_DURATION_SECONDS = 60;
const TICK_MS = 250; // sub-second ticks for smooth UI without drift

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

  // Absolute timestamp when the timer will reach zero.
  const endTimeRef = useRef<number | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const onTimeUpRef = useRef(onTimeUp);
  const firedRef = useRef(false);

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
    clearTimer();
    setIsRunning(false);
    // Snapshot the remaining time so resume works correctly.
    if (endTimeRef.current !== null) {
      const remaining = Math.max(0, Math.round((endTimeRef.current - Date.now()) / 1000));
      setTimeRemaining(remaining);
      endTimeRef.current = null;
    }
  }, [clearTimer]);

  const reset = useCallback(() => {
    clearTimer();
    endTimeRef.current = null;
    firedRef.current = false;
    setTimeRemaining(TURN_DURATION_SECONDS);
    setIsRunning(false);
  }, [clearTimer]);

  const restart = useCallback(() => {
    clearTimer();
    firedRef.current = false;
    endTimeRef.current = Date.now() + TURN_DURATION_SECONDS * 1000;
    setTimeRemaining(TURN_DURATION_SECONDS);
    setIsRunning(true);
  }, [clearTimer]);

  useEffect(() => {
    if (!isRunning) return;

    // Set end time from current remaining when starting after a pause.
    if (endTimeRef.current === null) {
      setTimeRemaining((prev) => {
        endTimeRef.current = Date.now() + prev * 1000;
        return prev;
      });
    }

    intervalRef.current = setInterval(() => {
      if (endTimeRef.current === null) return;
      const remaining = Math.max(0, Math.round((endTimeRef.current - Date.now()) / 1000));
      setTimeRemaining(remaining);
      if (remaining === 0 && !firedRef.current) {
        firedRef.current = true;
        clearTimer();
        setIsRunning(false);
        onTimeUpRef.current?.();
      }
    }, TICK_MS);

    return () => clearTimer();
  }, [isRunning, clearTimer]);

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
