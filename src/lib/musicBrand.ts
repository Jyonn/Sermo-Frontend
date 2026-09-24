import type { MusicProviderDataDTO } from "../types";

const BRANDS = {
  netease_music: { name: "网易云音乐", logo: "/icons/netease-music.ico", color: "#e6433a" },
  qq_music: { name: "QQ音乐", logo: "/icons/qq-music.ico", color: "#25b96a" },
  kugou_music: { name: "酷狗音乐", logo: "/icons/kugou-music.ico", color: "#168fe2" },
} as const;

export function musicBrand(provider: MusicProviderDataDTO["provider"]) {
  return BRANDS[provider];
}

export function sameMusic(left: MusicProviderDataDTO | null, right: MusicProviderDataDTO) {
  return left?.provider === right.provider && String(left.song_id) === String(right.song_id);
}
