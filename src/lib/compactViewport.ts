import { useSyncExternalStore } from "react";

// Reserve vertical space for content instead of desktop-only controls.
export const COMPACT_VIEWPORT_HEIGHT = 500;
export const COMPACT_VIEWPORT_QUERY = `(max-height: ${COMPACT_VIEWPORT_HEIGHT}px)`;
const subscribe = (listener: () => void) => {
  const media = window.matchMedia(COMPACT_VIEWPORT_QUERY);
  media.addEventListener("change", listener);
  return () => media.removeEventListener("change", listener);
};
export const useShortViewport = () => useSyncExternalStore(subscribe, () => window.matchMedia(COMPACT_VIEWPORT_QUERY).matches, () => false);
