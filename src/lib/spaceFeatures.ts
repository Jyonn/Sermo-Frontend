import { useEffect, useState } from "react";
import { api } from "./api";
import { useAuth } from "./auth";

type SpaceFeatures = {
  chatEnabled: boolean;
  squareEnabled: boolean;
  squareExploreEnabled: boolean;
};

const featureCache = new Map<number, SpaceFeatures>();
const GROUP_SQUARE_UPDATED_EVENT = "sermo:group-square-updated";

export function setCachedGroupSquareEnabled(spaceId: number, enabled: boolean) {
  const current = featureCache.get(spaceId) ?? { chatEnabled: true, squareEnabled: true, squareExploreEnabled: true };
  featureCache.set(spaceId, { ...current, squareEnabled: enabled });
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent<{ spaceId: number; enabled: boolean }>(GROUP_SQUARE_UPDATED_EVENT, { detail: { spaceId, enabled } }));
}

export function setCachedSpaceFeatures(spaceId: number, features: SpaceFeatures) {
  featureCache.set(spaceId, features);
  setCachedGroupSquareEnabled(spaceId, features.squareEnabled);
}

export function useGroupSquareEnabled() {
  return useSpaceFeatures().squareEnabled;
}

export function useSpaceFeatures() {
  const { session } = useAuth();
  const spaceId = session?.user.space_id ?? null;
  const [enabled, setEnabled] = useState(() => {
    if (!spaceId) return { chatEnabled: true, squareEnabled: true, squareExploreEnabled: true };
    return featureCache.get(spaceId) ?? { chatEnabled: true, squareEnabled: true, squareExploreEnabled: true };
  });

  useEffect(() => {
    if (!spaceId) {
      setEnabled({ chatEnabled: true, squareEnabled: true, squareExploreEnabled: true });
      return;
    }

    const cached = featureCache.get(spaceId);
    if (cached !== undefined) setEnabled(cached);

    const controller = new AbortController();
    api
      .getSpaceMe(controller.signal)
      .then((space) => {
        const next = {
          chatEnabled: space.chat_enabled !== false,
          squareEnabled: space.group_square_enabled !== false,
          squareExploreEnabled: space.square_explore_enabled !== false,
        };
        featureCache.set(spaceId, next);
        setCachedGroupSquareEnabled(spaceId, next.squareEnabled);
        setEnabled(next);
      })
      .catch(() => {
        if (cached !== undefined) setEnabled(cached);
      });

    const handleUpdated = (event: Event) => {
      const detail = (event as CustomEvent<{ spaceId: number; enabled: boolean }>).detail;
      if (!detail || detail.spaceId !== spaceId) return;
      setEnabled((current) => ({ ...current, squareEnabled: detail.enabled }));
    };

    window.addEventListener(GROUP_SQUARE_UPDATED_EVENT, handleUpdated as EventListener);
    return () => {
      controller.abort();
      window.removeEventListener(GROUP_SQUARE_UPDATED_EVENT, handleUpdated as EventListener);
    };
  }, [spaceId]);

  return enabled;
}
