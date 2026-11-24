import type { RecordShopDecoration } from "../types";
import { appearanceAsset } from "./appearanceAsset";

export const recordShopArtists = ["jay", "leehom", "david", "jj"] as const;

export const recordShopPreviews: Record<RecordShopDecoration["artist"], RecordShopDecoration> = {
  jay: {
    artist: "jay",
    portrait: appearanceAsset("/assets/activity/record-shop/preview-jay-portrait.webp"),
    album: {
      id: "jay-chopin",
      name: "11月的萧邦",
      title: "夜曲",
      tier: "gold",
      cover: appearanceAsset("/assets/activity/record-shop/preview-jay-album.jpg"),
      clip: "https://api.sermo.jyonn.space/resources/assets/462/display/5f087091c24aa1a5f503163e0e188d1f2494a8cddfdc9e3f21f76398f54e515c",
    },
  },
  leehom: {
    artist: "leehom",
    portrait: appearanceAsset("/assets/activity/record-shop/preview-leehom-portrait.webp"),
    album: {
      id: "leehom-shangri-la",
      name: "心中的日月",
      title: "爱错",
      tier: "gold",
      cover: appearanceAsset("/assets/activity/record-shop/preview-leehom-album.jpg"),
      clip: "https://api.sermo.jyonn.space/resources/assets/506/display/948dd0d778ac2f32a19bde7e9ec6a3d86874d106dab6fb3910f2a7fdd77718b7",
    },
  },
  david: {
    artist: "david",
    portrait: appearanceAsset("/assets/activity/record-shop/preview-david-portrait.webp"),
    album: {
      id: "david-black-tangerine",
      name: "黑色柳丁",
      title: "黑色柳丁",
      tier: "gold",
      cover: appearanceAsset("/assets/activity/record-shop/preview-david-album.jpg"),
      clip: "https://api.sermo.jyonn.space/resources/assets/491/display/95ec6ae07a18be7eec1f4d9bdc2e27e0faa954964a3b949d762661d629d05f6c",
    },
  },
  jj: {
    artist: "jj",
    portrait: appearanceAsset("/assets/activity/record-shop/preview-jj-portrait.webp"),
    album: {
      id: "jj-brave-new-world",
      name: "新地球",
      title: "可惜没如果",
      tier: "gold",
      cover: appearanceAsset("/assets/activity/record-shop/preview-jj-album.jpg"),
      clip: "https://api.sermo.jyonn.space/resources/assets/437/display/fa91f08e1a9dfe4f12a1dd447832f09301ce2264803d030ab769cea465468d5c",
    },
  },
};
