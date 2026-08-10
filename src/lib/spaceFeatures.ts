import { useEffect, useState } from "react";
import { api } from "./api";
import { useAuth } from "./auth";

type SpaceFeatures = {
  chatEnabled: boolean;
  squareEnabled: boolean;
  squareExploreEnabled: boolean;
};

type SpaceFeaturesState = SpaceFeatures & { ready: boolean; spaceId: number | null };

const featureCache = new Map<number, SpaceFeatures>();
const featureRequests = new Map<number, Promise<SpaceFeatures>>();
const FEATURE_CACHE_PREFIX = "sermo:space-features:v1";
const GROUP_SQUARE_UPDATED_EVENT = "sermo:group-square-updated";
const SPACE_FEATURES_UPDATED_EVENT = "sermo:space-features-updated";

function defaultFeatures(): SpaceFeatures {
  return { chatEnabled: true, squareEnabled: true, squareExploreEnabled: true };
}

function readPersistedFeatures(spaceId: number) {
  if (typeof window === "undefined") return undefined;
  try {
    const raw = window.localStorage.getItem(`${FEATURE_CACHE_PREFIX}:${spaceId}`);
    return raw ? (JSON.parse(raw) as SpaceFeatures) : undefined;
  } catch {
    window.localStorage.removeItem(`${FEATURE_CACHE_PREFIX}:${spaceId}`);
    return undefined;
  }
}

function cacheFeatures(spaceId: number, features: SpaceFeatures) {
  featureCache.set(spaceId, features);
  if (typeof window !== "undefined") {
    try {
      window.localStorage.setItem(`${FEATURE_CACHE_PREFIX}:${spaceId}`, JSON.stringify(features));
    } catch {
      // Keep the in-memory cache when persistent storage is unavailable.
    }
  }
}

function getCachedFeatures(spaceId: number) {
  const cached = featureCache.get(spaceId) ?? readPersistedFeatures(spaceId);
  if (cached && !featureCache.has(spaceId)) featureCache.set(spaceId, cached);
  return cached;
}

function loadSpaceFeatures(spaceId: number) {
  const existing = featureRequests.get(spaceId);
  if (existing) return existing;
  const request = api.getSpaceMe().then((space) => {
    const features = {
      chatEnabled: space.chat_enabled !== false,
      squareEnabled: space.group_square_enabled !== false,
      squareExploreEnabled: space.square_explore_enabled !== false,
    };
    cacheFeatures(spaceId, features);
    window.dispatchEvent(new CustomEvent<{ spaceId: number; features: SpaceFeatures }>(SPACE_FEATURES_UPDATED_EVENT, {
      detail: { spaceId, features },
    }));
    return features;
  }).finally(() => featureRequests.delete(spaceId));
  featureRequests.set(spaceId, request);
  return request;
}

export function setCachedGroupSquareEnabled(spaceId: number, enabled: boolean) {
  const current = getCachedFeatures(spaceId) ?? defaultFeatures();
  cacheFeatures(spaceId, { ...current, squareEnabled: enabled });
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent<{ spaceId: number; enabled: boolean }>(GROUP_SQUARE_UPDATED_EVENT, { detail: { spaceId, enabled } }));
}

export function setCachedSpaceFeatures(spaceId: number, features: SpaceFeatures) {
  cacheFeatures(spaceId, features);
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent<{ spaceId: number; features: SpaceFeatures }>(SPACE_FEATURES_UPDATED_EVENT, {
      detail: { spaceId, features },
    }));
  }
  setCachedGroupSquareEnabled(spaceId, features.squareEnabled);
}

export function useGroupSquareEnabled() {
  return useSpaceFeatures().squareEnabled;
}

export function useSpaceFeatures() {
  const { session } = useAuth();
  const spaceId = session?.user.space_id ?? null;
  const [enabled, setEnabled] = useState<SpaceFeaturesState>(() => {
    if (!spaceId) return { ...defaultFeatures(), ready: true, spaceId: null };
    const cached = getCachedFeatures(spaceId);
    return { ...(cached ?? defaultFeatures()), ready: Boolean(cached), spaceId };
  });

  useEffect(() => {
    if (!spaceId) {
      setEnabled({ ...defaultFeatures(), ready: true, spaceId: null });
      return;
    }

    const cached = getCachedFeatures(spaceId);
    if (cached !== undefined) setEnabled({ ...cached, ready: true, spaceId });
    else setEnabled({ ...defaultFeatures(), ready: false, spaceId });

    let cancelled = false;
    loadSpaceFeatures(spaceId)
      .then((next) => {
        if (!cancelled) setEnabled({ ...next, ready: true, spaceId });
      })
      .catch(() => {
        if (!cancelled) setEnabled({ ...(cached ?? defaultFeatures()), ready: true, spaceId });
      });

    const handleUpdated = (event: Event) => {
      const detail = (event as CustomEvent<{ spaceId: number; enabled: boolean }>).detail;
      if (!detail || detail.spaceId !== spaceId) return;
      setEnabled((current) => ({ ...current, squareEnabled: detail.enabled }));
    };

    const handleFeaturesUpdated = (event: Event) => {
      const detail = (event as CustomEvent<{ spaceId: number; features: SpaceFeatures }>).detail;
      if (!detail || detail.spaceId !== spaceId) return;
      setEnabled({ ...detail.features, ready: true, spaceId });
    };

    window.addEventListener(GROUP_SQUARE_UPDATED_EVENT, handleUpdated as EventListener);
    window.addEventListener(SPACE_FEATURES_UPDATED_EVENT, handleFeaturesUpdated as EventListener);
    return () => {
      cancelled = true;
      window.removeEventListener(GROUP_SQUARE_UPDATED_EVENT, handleUpdated as EventListener);
      window.removeEventListener(SPACE_FEATURES_UPDATED_EVENT, handleFeaturesUpdated as EventListener);
    };
  }, [spaceId]);

  if (enabled.spaceId === spaceId) return enabled;
  const cached = spaceId ? getCachedFeatures(spaceId) : undefined;
  return {
    ...(cached ?? defaultFeatures()),
    ready: spaceId ? Boolean(cached) : true,
    spaceId,
  };
}
