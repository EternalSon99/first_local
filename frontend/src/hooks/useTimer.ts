"use client";

import { useCallback, useEffect, useRef, useState } from "react";

interface UseTimerOptions {
  startedAt: string;
  durationMinutes: number | null;
  onExpired: () => void;
}

interface UseTimerReturn {
  remainingSeconds: number;
  isExpired: boolean;
  formattedTime: string;
}

export function useTimer({
  startedAt,
  durationMinutes,
  onExpired,
}: UseTimerOptions): UseTimerReturn {
  const [remainingSeconds, setRemainingSeconds] = useState<number>(() => {
    if (!durationMinutes) return Infinity;
    const start = new Date(startedAt).getTime();
    const end = start + durationMinutes * 60 * 1000;
    return Math.max(0, Math.floor((end - Date.now()) / 1000));
  });
  const expiredRef = useRef(false);

  const calculateRemaining = useCallback(() => {
    if (!durationMinutes) return Infinity;
    const start = new Date(startedAt).getTime();
    const end = start + durationMinutes * 60 * 1000;
    return Math.max(0, Math.floor((end - Date.now()) / 1000));
  }, [startedAt, durationMinutes]);

  useEffect(() => {
    if (!durationMinutes) return;

    const interval = setInterval(() => {
      const remaining = calculateRemaining();
      setRemainingSeconds(remaining);

      if (remaining <= 0 && !expiredRef.current) {
        expiredRef.current = true;
        onExpired();
        clearInterval(interval);
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [calculateRemaining, durationMinutes, onExpired]);

  const isExpired = remainingSeconds <= 0;

  const formatTime = (seconds: number): string => {
    if (seconds === Infinity) return "--:--";
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    if (h > 0) {
      return `${h}:${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
    }
    return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  };

  return {
    remainingSeconds,
    isExpired,
    formattedTime: formatTime(remainingSeconds),
  };
}
