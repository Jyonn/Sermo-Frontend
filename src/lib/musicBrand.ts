import type { MusicProviderDataDTO } from "../types";

const BRANDS = {
  netease_music: { name: "网易云音乐", logo: "/icons/netease-music.ico", color: "#e6433a" },
  qq_music: { name: "QQ音乐", logo: "/icons/qq-music.ico", color: "#25b96a" },
  kugou_music: { name: "酷狗音乐", logo: "/icons/kugou-music.ico", color: "#168fe2" },
  qishui_music: { name: "汽水音乐", logo: "/icons/qishui-music.png", color: "#ff5b7f" },
  apple_music: { name: "Apple Music", logo: "/icons/apple-music.ico", color: "#fa2d48" },
  kuwo_music: { name: "酷我音乐", logo: "/icons/kuwo-music.ico", color: "#ff8a00" },
} as const;

export function musicBrand(provider: MusicProviderDataDTO["provider"]) {
  return BRANDS[provider];
}

export function sameMusic(left: MusicProviderDataDTO | null, right: MusicProviderDataDTO) {
  return left?.provider === right.provider && String(left.song_id) === String(right.song_id);
}
