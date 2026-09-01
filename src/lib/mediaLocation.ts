import type { TinyUserDTO } from "../types";

export const MEDIA_LOCATION_MAP_EVENT = "sermo:media-location-map";

export interface MediaLocationMapDetail {
  location: {
    latitude: number;
    longitude: number;
    address?: string;
  };
  owner?: TinyUserDTO | null;
}

export function openMediaLocationMap(detail: MediaLocationMapDetail) {
  window.dispatchEvent(new CustomEvent<MediaLocationMapDetail>(MEDIA_LOCATION_MAP_EVENT, { detail }));
}
