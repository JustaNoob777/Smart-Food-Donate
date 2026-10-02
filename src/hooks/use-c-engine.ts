import { CEngine, loadCEngine } from "@/lib/c-engine";
import { useEffect, useState } from "react";

export type CEngineStatus = "loading" | "ready" | "error";

/** Loads the compiled C engine once and exposes its status to the UI. */
export function useCEngine(): { engine: CEngine | null; status: CEngineStatus; error: string | null } {
  const [engine, setEngine] = useState<CEngine | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    loadCEngine()
      .then((e) => {
        if (alive) {
          setEngine(e);
          setError(null);
        }
      })
      .catch((err: unknown) => {
        if (alive) setError(err instanceof Error ? err.message : "Failed to start the C engine");
      });
    return () => {
      alive = false;
    };
  }, []);

  return {
    engine,
    status: engine ? "ready" : error ? "error" : "loading",
    error,
  };
}
