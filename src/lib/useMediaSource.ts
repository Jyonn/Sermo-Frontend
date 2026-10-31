import { useEffect, useRef, useState } from "react";
import { freshMediaUri, mediaSourceCandidates } from "./messageMedia";
import { resolveStableResourceUri } from "./stableResource";

const imageDelays = [300, 800, 1600, 3000];
const videoDelays = [...imageDelays, 5000, 8000, 12000, 15000];
export function useMediaSource(uri: string, fallbackUri?: string, kind: "image" | "video" = "image") {
  const delays = kind === "video" ? videoDelays : imageDelays;
  const [state, setState] = useState({ uri, attempt: 0, fallback: false, phase: "loading" as "loading" | "idle" | "error" });
  const current = state.uri === uri ? state : { uri, attempt: 0, fallback: false, phase: "loading" as const };
  const timer = useRef<number>();
  const nonce = useRef(String(Date.now()));
  const latest = useRef(current); latest.current = current;
  const candidates = mediaSourceCandidates(resolveStableResourceUri(uri) ?? uri);
  const fallback = candidates.fallback ?? fallbackUri;
  const active = current.fallback && fallback ? fallback : candidates.primary;
  const src = freshMediaUri(active, current.attempt, nonce.current);
  useEffect(() => { setState({ uri, attempt: 0, fallback: false, phase: "loading" }); return () => window.clearTimeout(timer.current); }, [uri]);
  return {
    src, phase: current.phase,
    ready: () => { window.clearTimeout(timer.current); setState(value => value.uri === uri ? { ...value, phase: "idle" } : value); },
    retry: () => { window.clearTimeout(timer.current); setState(value => ({ uri, fallback: false, attempt: value.attempt + 1, phase: "loading" })); },
    fail: () => {
      window.clearTimeout(timer.current);
      const value = latest.current;
      const refreshed = mediaSourceCandidates(uri);
      const backup = refreshed.fallback ?? fallbackUri;
      if (!value.fallback && backup && backup !== active) {
        setState({ ...value, uri, fallback: true, attempt: 1, phase: "loading" });
      } else if (value.attempt < delays.length) {
        timer.current = window.setTimeout(() => setState(next => next.uri === uri ? { ...next, attempt: value.attempt + 1, phase: "loading" } : next), delays[value.attempt]);
      } else setState({ ...value, uri, phase: "error" });
    },
  };
}
