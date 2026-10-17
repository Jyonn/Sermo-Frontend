import { useEffect, useRef, useState } from "react";
import { activatePwaUpdate, type UpdateActivationPhase } from "./pwaUpdate";
import "../components/MediaWaitFeedback.css";
import { hasUpdateFailure } from "./updateDiagnostics";

export function usePwaUpdateActivation() {
  const [phase, setPhase] = useState<UpdateActivationPhase | "idle" | "error">(hasUpdateFailure() ? "error" : "idle");
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const attempt = useRef(0);

  useEffect(() => () => { attempt.current += 1; if (timer.current) clearTimeout(timer.current); }, []);

  const install = () => {
    if (phase !== "idle" && phase !== "error") return;
    if (timer.current) clearTimeout(timer.current);
    const currentAttempt = ++attempt.current;
    setPhase("preparing");
    void activatePwaUpdate((nextPhase) => { if (attempt.current === currentAttempt) setPhase(nextPhase); }).catch(() => {
      if (attempt.current !== currentAttempt) return;
      attempt.current += 1;
      if (timer.current) clearTimeout(timer.current);
      setPhase("error");
    });
  };

  return { phase, install };
}
