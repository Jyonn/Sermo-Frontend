import { useEffect, useState } from "react";
import type { SpaceDTO } from "../types";
import { api } from "./api";
import { useAuth } from "./auth";

const spaceBrandCache = new Map<number, SpaceDTO>();
const pendingSpaceBrands = new Map<number, Promise<SpaceDTO>>();

function loadSpaceBrand(spaceId: number) {
  const cached = spaceBrandCache.get(spaceId);
  if (cached) return Promise.resolve(cached);

  const pending = pendingSpaceBrands.get(spaceId);
  if (pending) return pending;

  const request = api.getSpaceMe().then((space) => {
    spaceBrandCache.set(spaceId, space);
    return space;
  }).finally(() => {
    pendingSpaceBrands.delete(spaceId);
  });
  pendingSpaceBrands.set(spaceId, request);
  return request;
}

export function useSpaceBrand() {
  const { session } = useAuth();
  const spaceId = session?.user.space_id ?? null;
  const [space, setSpace] = useState<SpaceDTO | null>(() => (spaceId ? spaceBrandCache.get(spaceId) ?? null : null));

  useEffect(() => {
    if (!spaceId) {
      setSpace(null);
      return;
    }

    let cancelled = false;
    const cached = spaceBrandCache.get(spaceId);
    if (cached) setSpace(cached);

    void loadSpaceBrand(spaceId)
      .then((nextSpace) => {
        if (!cancelled) setSpace(nextSpace);
      })
      .catch(() => undefined);

    return () => {
      cancelled = true;
    };
  }, [spaceId]);

  return space;
}
