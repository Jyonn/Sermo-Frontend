import { lazy, Suspense, useEffect, useState } from "react";

import { MEDIA_LOCATION_MAP_EVENT, type MediaLocationMapDetail } from "../lib/mediaLocation";

const TravelMapDrawer = lazy(() => import("./TravelMapDrawer").then((module) => ({ default: module.TravelMapDrawer })));

export function GlobalMediaLocationMap() {
  const [preview, setPreview] = useState<MediaLocationMapDetail | null>(null);

  useEffect(() => {
    const openMap = (event: Event) => {
      const detail = (event as CustomEvent<MediaLocationMapDetail>).detail;
      if (!Number.isFinite(detail?.location?.latitude) || !Number.isFinite(detail?.location?.longitude)) return;
      setPreview(detail);
    };
    window.addEventListener(MEDIA_LOCATION_MAP_EVENT, openMap);
    return () => window.removeEventListener(MEDIA_LOCATION_MAP_EVENT, openMap);
  }, []);

  if (!preview) return null;

  return (
    <Suspense fallback={null}>
    <TravelMapDrawer
      backdropClassName="media-location-drawer-backdrop"
      focusLocation={preview?.location}
      focusOwner={preview?.owner}
      historyKey="media-location"
      onClose={() => setPreview(null)}
      open
    />
    </Suspense>
  );
}
