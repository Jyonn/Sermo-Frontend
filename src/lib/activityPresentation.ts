import { EXPLORER_ART } from "./explorer.ts";
import {activityAsset} from './activityAsset.ts';

export interface ActivityPresentation {
  palette?: "sage" | "rose" | "ocean" | "gold";
  artwork_url?: string;
  title_art_url?: string;
  artwork_layout?: "image" | "keychain-sheet";
}

export function safeActivityImage(value: unknown): string | undefined {
  if (typeof value !== "string" || value.length > 1000 || /[\x00-\x1f\\]/.test(value)) return undefined;
  if (/^\/(?!\/)[^\\]*$/.test(value)) return activityAsset(value);
  try {
    const url = new URL(value);
    return url.protocol === "https:" && !url.username && !url.password ? activityAsset(url.href) : undefined;
  } catch { return undefined; }
}

export function activityPresentation(activity?: { key?: string; theme?: string; presentation?: ActivityPresentation } | null): ActivityPresentation {
  const bgm = activity?.theme === "bgm" || activity?.key === "main-character-bgm-2026";
  const duel = activity?.theme === "number_duel" || activity?.key === "number-duel-2026";
  const explorer = activity?.theme === "explorer" || activity?.key === "explorer-2026";
  const custom = activity?.presentation;
  return {
    palette: ["sage", "rose", "ocean", "gold"].includes(custom?.palette ?? "") ? custom!.palette : explorer ? "ocean" : "sage",
    artwork_layout: custom?.artwork_layout === "keychain-sheet" || (!custom?.artwork_url && bgm) ? "keychain-sheet" : "image",
    artwork_url: explorer ? EXPLORER_ART.banner : safeActivityImage(custom?.artwork_url) ?? (bgm ? "https://api.sermo.jyonn.space/resources/assets/37/display/aada6284cc38241d3010cca3b976d6ae0aac7567dbb6e1d91ec2a21ee156e4bc" : undefined),
    title_art_url: safeActivityImage(custom?.title_art_url) ?? (explorer ? EXPLORER_ART.title : bgm ? "https://api.sermo.jyonn.space/resources/assets/38/display/91ba51a2dd3fc196ac9951aadddd7a28f55652dd71885e0092f3d3c850866c1d" : duel ? "https://api.sermo.jyonn.space/resources/assets/79/display/f63dd318cfbf703e2d8ea775f9d356c84349dbb946e83cae65bd7a6bc1f513ff" : undefined),
  };
}
