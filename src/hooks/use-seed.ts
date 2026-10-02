import { api } from "@/convex/_generated/api";
import { useMutation } from "convex/react";
import { useEffect } from "react";

let ensured = false;

/** Ensures the demo dataset + baseline counters exist (idempotent, once/session). */
export function useEnsureSeed() {
  const ensure = useMutation(api.seed.ensure);

  useEffect(() => {
    if (ensured) return;
    ensured = true;
    ensure().catch((err) => {
      ensured = false;
      console.warn("seed.ensure failed", err);
    });
  }, [ensure]);
}
