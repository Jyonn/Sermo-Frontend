export function nextOverlayLevel(base: number, visibleLevels: number[]) {
  return Math.max(100, Number.isFinite(base) ? base : 0, ...visibleLevels.filter(Number.isFinite).map(level => level + 2));
}
