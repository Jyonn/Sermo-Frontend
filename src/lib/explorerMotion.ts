export type ExplorerPortrait = "conan" | "shinichi";
type Point = readonly [number, number];

// Artwork coordinates: only the silhouettes and handheld lenses move.
export const EXPLORER_SILHOUETTES: Record<ExplorerPortrait, readonly Point[][]> = {
  conan: [
    [[616,1006],[648,990],[630,980],[689,990],[729,978],[756,994],[775,993],[786,1014],[805,1034],[798,1086],[779,1106],[792,1126],[787,1165],[831,1190],[853,1210],[859,1235],[845,1251],[816,1246],[788,1235],[772,1256],[742,1253],[701,1249],[678,1238],[686,1218],[701,1200],[699,1174],[676,1155],[661,1137],[628,1134],[618,1113],[629,1086],[640,1083],[631,1067],[627,1043],[640,1024]],
  ],
  shinichi: [
    [[645,782],[671,768],[707,765],[733,750],[735,764],[757,761],[769,778],[774,801],[770,830],[765,844],[776,859],[792,870],[800,890],[817,924],[814,949],[796,974],[782,994],[779,1023],[793,1051],[803,1085],[798,1132],[806,1196],[821,1216],[825,1244],[814,1266],[793,1265],[776,1251],[772,1220],[769,1159],[745,1109],[730,1056],[718,1082],[712,1148],[704,1207],[689,1228],[665,1238],[644,1230],[655,1214],[683,1202],[685,1142],[687,1085],[686,1036],[688,992],[676,973],[670,949],[659,931],[668,918],[665,901],[653,890],[659,876],[667,872],[665,854],[659,840],[655,816],[645,808]],
    [[646,849],[677,841],[699,857],[702,875],[685,893],[661,886],[649,871]],
  ],
};

export function insideExplorerSilhouette(x: number, y: number, polygon: readonly Point[]) {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const [xi, yi] = polygon[i];
    const [xj, yj] = polygon[j];
    if ((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

export const EXPLORER_PIXEL_SIZE = 16;

export function explorerPortraitPixels(portrait: ExplorerPortrait) {
  const polygons = EXPLORER_SILHOUETTES[portrait];
  const points = polygons.flat();
  const size = EXPLORER_PIXEL_SIZE;
  const left = Math.floor(Math.min(...points.map(([x]) => x)) / size) * size;
  const top = Math.floor(Math.min(...points.map(([, y]) => y)) / size) * size;
  const right = Math.max(...points.map(([x]) => x));
  const bottom = Math.max(...points.map(([, y]) => y));
  const pixels = [];
  for (let y = top; y < bottom; y += size) for (let x = left; x < right; x += size) {
    const intersects = polygons.some((polygon) =>
      [1, size / 2, size - 1].some((dx) => [1, size / 2, size - 1].some((dy) => insideExplorerSilhouette(x + dx, y + dy, polygon)))
      || polygon.some(([px, py]) => px >= x && px <= x + size && py >= y && py <= y + size));
    if (!intersects) continue;
    const seed = ((x * 13 + y * 7) % 101) / 101;
    const angle = -.8 + seed * 1.5;
    const turn = (point: Point): Point => [point[0] * Math.cos(angle) - point[1] * Math.sin(angle), point[0] * Math.sin(angle) + point[1] * Math.cos(angle)];
    const a = turn([-100 - seed * 40, -90]);
    const b = turn([170 + seed * 70, -190]);
    const end = turn([25 + seed * 80, -300 - seed * 100]);
    // Cubic Bézier samples keep grains square, with no JavaScript frame loop.
    const curve = Array.from({ length: 6 }, (_, index): Point => {
      const t = (index + 1) / 6;
      const u = 1 - t;
      return [3 * u * u * t * a[0] + 3 * u * t * t * b[0] + t * t * t * end[0], 3 * u * u * t * a[1] + 3 * u * t * t * b[1] + t * t * t * end[1]];
    });
    pixels.push({ x, y, size, curve, lag: ((bottom - y) / (bottom - top)) * .22 + seed * .1 });
  }
  return pixels;
}
