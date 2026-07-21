import { useEffect, useState } from "react";
import { api } from "./api";
import { useAuth } from "./auth";

const squareEnabledCache = new Map<number, boolean>();
const GROUP_SQUARE_UPDATED_EVENT = "sermo:group-square-updated";

export function setCachedGroupSquareEnabled(spaceId: number, enabled: boolean) {
  squareEnabledCache.set(spaceId, enabled);
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent<{ spaceId: number; enabled: boolean }>(GROUP_SQUARE_UPDATED_EVENT, { detail: { spaceId, enabled } }));
}

export function useGroupSquareEnabled() {
  const { session } = useAuth();
  const spaceId = session?.user.space_id ?? null;
  const [enabled, setEnabled] = useState(() => {
    if (!spaceId) return true;
    return squareEnabledCache.get(spaceId) ?? true;
  });

  useEffect(() => {
    if (!spaceId) {
      setEnabled(true);
      return;
    }

    const cached = squareEnabledCache.get(spaceId);
    if (cached !== undefined) setEnabled(cached);

    const controller = new AbortController();
    api
      .getSpaceMe(controller.signal)
      .then((space) => {
        const next = space.group_square_enabled !== false;
        setCachedGroupSquareEnabled(spaceId, next);
        setEnabled(next);
      })
      .catch(() => {
        if (cached !== undefined) setEnabled(cached);
      });

    const handleUpdated = (event: Event) => {
      const detail = (event as CustomEvent<{ spaceId: number; enabled: boolean }>).detail;
      if (!detail || detail.spaceId !== spaceId) return;
      setEnabled(detail.enabled);
    };

    window.addEventListener(GROUP_SQUARE_UPDATED_EVENT, handleUpdated as EventListener);
    return () => {
      controller.abort();
      window.removeEventListener(GROUP_SQUARE_UPDATED_EVENT, handleUpdated as EventListener);
    };
  }, [spaceId]);

  return enabled;
}
