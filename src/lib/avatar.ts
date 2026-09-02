import { buildPublicUrl } from "./siteConfig";

export const AVATAR_PRESET_TOTAL = 36;
export const AVATAR_PRESETS_PER_PAGE = 16;
export const AVATAR_PRESET_PAGES = Math.ceil(AVATAR_PRESET_TOTAL / AVATAR_PRESETS_PER_PAGE);
const AVATAR_PRESET_BASE_URI = buildPublicUrl("assets/avatars/v2");

export function formatAvatarPresetId(id: number) {
  return String(id).padStart(2, "0");
}

export function buildAvatarPresetUri(id: number) {
  return `${AVATAR_PRESET_BASE_URI}/${formatAvatarPresetId(id)}.png`;
}

export function parseAvatarPresetId(uri?: string | null) {
  if (!uri) return null;
  const match = uri.match(/\/(\d{2})\.png(?:\?.*)?$/);
  if (!match) return null;
  const parsed = Number(match[1]);
  return parsed >= 1 && parsed <= AVATAR_PRESET_TOTAL ? parsed : null;
}

export function buildAvatarPresetPages() {
  return Array.from({ length: AVATAR_PRESET_PAGES }, (_, pageIndex) =>
    Array.from({ length: AVATAR_PRESETS_PER_PAGE }, (_, itemIndex) => pageIndex * AVATAR_PRESETS_PER_PAGE + itemIndex + 1).filter(
      (id) => id <= AVATAR_PRESET_TOTAL
    )
  );
}
