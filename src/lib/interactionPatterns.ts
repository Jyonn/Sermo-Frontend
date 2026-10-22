export const DEFAULT_SHEET_STOPS = [0.3, 0.6, 0.8];

export function sheetStops(values: number[]) {
  const valid = [...new Set(values.filter((value) => Number.isFinite(value) && value >= 0.2 && value <= 0.9))].sort((a, b) => a - b);
  return valid.length ? valid : DEFAULT_SHEET_STOPS;
}

export function sheetRelease(stops: number[], current: number, delta: number, viewport: number) {
  const height = stops[current] - delta / Math.max(1, viewport);
  if (height < stops[0] / 2) return null;
  return stops.reduce((best, value, index) => Math.abs(value - height) < Math.abs(stops[best] - height) ? index : best, 0);
}

export function tourPosition(target: { top: number; bottom: number; left: number; width: number } | null, width: number, height: number, cardHeight: number) {
  const cardWidth = Math.min(352, width - 32);
  const left = Math.max(16, Math.min(width - cardWidth - 16, target ? target.left + target.width / 2 - cardWidth / 2 : (width - cardWidth) / 2));
  const below = target ? target.bottom + 20 : (height - cardHeight) / 2;
  const top = below + cardHeight <= height - 16 ? below : (target?.top ?? height) - cardHeight - 20;
  return { left, top: Math.max(16, Math.min(height - cardHeight - 16, top)), width: cardWidth };
}
