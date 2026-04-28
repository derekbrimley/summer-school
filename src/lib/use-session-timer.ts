"use client";

import { useEffect, useRef, useState } from "react";

export type NudgeLevel = "soft" | "gentle" | "firm" | null;

const SOFT_MS = 30 * 60 * 1000;
const GENTLE_MS = 45 * 60 * 1000;
const FIRM_MS = 60 * 60 * 1000;

export function useSessionTimer(paused = false) {
  const [elapsedMs, setElapsedMs] = useState(0);
  const [nudge, setNudge] = useState<NudgeLevel>(null);
  const [dismissedNudge, setDismissedNudge] = useState<NudgeLevel>(null);
  const startRef = useRef<number | null>(null);
  const pausedAtRef = useRef<number | null>(null);
  const frameRef = useRef<number | null>(null);

  useEffect(() => {
    startRef.current = Date.now();
    pausedAtRef.current = null;

    function tick() {
      if (!startRef.current) return;
      const now = Date.now();
      const elapsed = now - startRef.current;
      setElapsedMs(elapsed);

      if (elapsed >= FIRM_MS) {
        setNudge((prev) => (prev === "firm" ? prev : "firm"));
      } else if (elapsed >= GENTLE_MS) {
        setNudge((prev) => (prev === "gentle" || prev === "firm" ? prev : "gentle"));
      } else if (elapsed >= SOFT_MS) {
        setNudge((prev) => (prev !== null ? prev : "soft"));
      }

      frameRef.current = requestAnimationFrame(tick);
    }

    frameRef.current = requestAnimationFrame(tick);
    return () => {
      if (frameRef.current) cancelAnimationFrame(frameRef.current);
    };
  }, []);

  // Pause/resume
  useEffect(() => {
    if (paused) {
      pausedAtRef.current = Date.now();
      if (frameRef.current) cancelAnimationFrame(frameRef.current);
    } else if (pausedAtRef.current !== null && startRef.current !== null) {
      const pauseDuration = Date.now() - pausedAtRef.current;
      startRef.current += pauseDuration;
      pausedAtRef.current = null;
    }
  }, [paused]);

  function dismissNudge() {
    setDismissedNudge(nudge);
    if (nudge !== "firm") setNudge(null);
  }

  const activeNudge = nudge !== null && nudge !== dismissedNudge ? nudge : null;

  const minutes = Math.floor(elapsedMs / 60000);

  return { elapsedMs, minutes, nudge: activeNudge, dismissNudge };
}
