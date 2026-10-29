export function nextOverlayLevel(base: number, visibleLevels: number[], retained?:number) {
  if(retained!==undefined&&Number.isFinite(retained))return Math.max(Number.isFinite(base)?base:0,retained);
  return Math.max(100, Number.isFinite(base) ? base : 0, ...visibleLevels.filter(Number.isFinite).map(level => level + 2));
}
