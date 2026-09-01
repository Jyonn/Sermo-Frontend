import { useEffect, useState } from "react";

import { MEDIA_LOCATION_MAP_EVENT, type MediaLocationMapDetail } from "../lib/mediaLocation";
import { TravelMapDrawer } from "./TravelMapDrawer";

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

  return (
    <TravelMapDrawer
      backdropClassName="media-location-drawer-backdrop"
      focusLocation={preview?.location}
      focusOwner={preview?.owner}
      historyKey="media-location"
      onClose={() => setPreview(null)}
      open={Boolean(preview)}
    />
  );
}
