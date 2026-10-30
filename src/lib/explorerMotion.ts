export type ExplorerPortrait = "conan" | "shinichi";
type Point = readonly [number, number];

// Artwork coordinates: effects and portrait crops follow the complete figures.
export const EXPLORER_SILHOUETTES: Record<ExplorerPortrait, readonly Point[][]> = {
  conan: [
    [[616,1006],[648,990],[630,980],[689,990],[729,978],[756,994],[775,993],[786,1014],[805,1034],[798,1086],[779,1106],[792,1126],[787,1165],[831,1190],[853,1210],[859,1235],[845,1251],[816,1246],[788,1235],[772,1256],[742,1253],[701,1249],[678,1238],[686,1218],[701,1200],[699,1174],[676,1155],[661,1137],[628,1134],[618,1113],[629,1086],[640,1083],[631,1067],[627,1043],[640,1024]],
  ],
  shinichi: [
    [[645,782],[671,768],[707,765],[733,750],[735,764],[757,761],[769,778],[774,801],[770,830],[765,844],[776,859],[792,870],[800,890],[817,924],[814,949],[796,974],[782,994],[779,1023],[793,1051],[803,1085],[798,1132],[806,1196],[821,1216],[825,1244],[814,1266],[793,1265],[780,1251],[784,1220],[773,1165],[751,1107],[734,1060],[748,1140],[759,1199],[759,1232],[750,1240],[717,1244],[685,1241],[678,1233],[683,1222],[718,1207],[719,1170],[707,1127],[698,1081],[686,1036],[688,992],[676,973],[670,949],[659,931],[668,918],[665,901],[653,890],[659,876],[667,872],[665,854],[659,840],[655,816],[645,808]],
    [[646,849],[677,841],[699,857],[702,875],[685,893],[661,886],[649,871]],
  ],
};

export function explorerPortraitBounds(portrait: ExplorerPortrait) {
  const points = EXPLORER_SILHOUETTES[portrait].flat();
  const left = Math.min(...points.map(([x]) => x)) - 14;
  const top = Math.min(...points.map(([, y]) => y)) - 14;
  const width = Math.max(...points.map(([x]) => x)) + 14 - left;
  const height = Math.max(...points.map(([, y]) => y)) + 14 - top;
  return { left, top, width, height };
}

export function explorerSceneLayout(width: number, height: number) {
  const cover = Math.max(width / 960, height / 1440);
  return {
    width: 960 * cover, height: 1440 * cover,
    left: (width - 960 * cover) / 2, top: (height - 1440 * cover) * .9,
    figureScale: Math.min(1, height * .72 / Math.max(1, 516 * cover)),
  };
}
