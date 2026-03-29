import { useCallback, useEffect, useRef, useState } from "react";
import type { backendInterface } from "../backend";

export interface GateState {
  done: Record<string, Record<number, boolean>>;
  tests: Record<string, Record<number, boolean>>;
  notes: Array<{ date: string; text: string; time: string }>;
  gateDate: string;
  dailyTarget: number;
  bestStreak: number;
}

const DEFAULT_STATE: GateState = {
  done: {},
  tests: {},
  notes: [],
  gateDate: "2027-02-01",
  dailyTarget: 6,
  bestStreak: 0,
};

function parseState(raw: string | null): GateState {
  try {
    if (!raw) return { ...DEFAULT_STATE };
    return { ...DEFAULT_STATE, ...JSON.parse(raw) };
  } catch {
    return { ...DEFAULT_STATE };
  }
}

export function useGateState(actor: backendInterface | null) {
  const [state, setState] = useState<GateState>({ ...DEFAULT_STATE });
  const [isLoading, setIsLoading] = useState(true);
  // Keep a mutable ref so callbacks always see latest state without re-creating
  const stateRef = useRef<GateState>(state);

  useEffect(() => {
    if (!actor) {
      setIsLoading(false);
      return;
    }
    let cancelled = false;
    setIsLoading(true);
    actor
      .getState()
      .then((raw) => {
        if (cancelled) return;
        const loaded = parseState(raw);
        stateRef.current = loaded;
        setState(loaded);
        setIsLoading(false);
      })
      .catch(() => {
        if (cancelled) return;
        setIsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [actor]);

  const persist = useCallback(
    (next: GateState) => {
      stateRef.current = next;
      setState(next);
      if (actor) {
        actor.setState(JSON.stringify(next)).catch((err) => {
          console.error("Failed to save progress to backend:", err);
        });
      }
    },
    [actor],
  );

  const markLecture = useCallback(
    (date: string, idx: number, done: boolean) => {
      const next = { ...stateRef.current, done: { ...stateRef.current.done } };
      if (!next.done[date]) next.done[date] = {};
      else next.done[date] = { ...next.done[date] };
      if (done) next.done[date][idx] = true;
      else delete next.done[date][idx];
      persist(next);
    },
    [persist],
  );

  const markTest = useCallback(
    (date: string, idx: number, done: boolean) => {
      const next = {
        ...stateRef.current,
        tests: { ...stateRef.current.tests },
      };
      if (!next.tests[date]) next.tests[date] = {};
      else next.tests[date] = { ...next.tests[date] };
      if (done) next.tests[date][idx] = true;
      else delete next.tests[date][idx];
      persist(next);
    },
    [persist],
  );

  const saveNote = useCallback(
    (text: string) => {
      const next = { ...stateRef.current };
      const n = new Date();
      const date = `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, "0")}-${String(n.getDate()).padStart(2, "0")}`;
      next.notes = [
        { date, text, time: n.toLocaleTimeString() },
        ...next.notes,
      ].slice(0, 50);
      persist(next);
    },
    [persist],
  );

  const saveSettings = useCallback(
    (gateDate: string, dailyTarget: number) => {
      const next = { ...stateRef.current, gateDate, dailyTarget };
      persist(next);
    },
    [persist],
  );

  const exportData = useCallback(() => {
    const data = JSON.stringify(stateRef.current, null, 2);
    const blob = new Blob([data], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "gate2027_progress.json";
    a.click();
  }, []);

  const resetAll = useCallback(() => {
    actor?.deleteState();
    const fresh = { ...DEFAULT_STATE };
    stateRef.current = fresh;
    setState(fresh);
  }, [actor]);

  const isLecDone = useCallback((date: string, idx: number): boolean => {
    return !!stateRef.current.done[date]?.[idx];
  }, []);

  const isTestDone = useCallback((date: string, idx: number): boolean => {
    return !!stateRef.current.tests[date]?.[idx];
  }, []);

  return {
    state,
    isLoading,
    markLecture,
    markTest,
    saveNote,
    saveSettings,
    exportData,
    resetAll,
    isLecDone,
    isTestDone,
    persist,
  };
}
