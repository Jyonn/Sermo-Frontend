export interface HistoryFilters { chat_id: number; keyword?: string; types?: string; start?: number; end?: number; snapshot?: number; retained?: number; time_from?: number; time_to?: number; }
export const historyTypeOptions = [
  { types: '0', key: 'messageSearch.text', icon: 'chat_bubble' },
  { types: '1', key: 'messageSearch.images', icon: 'image' },
  { types: '4', key: 'messageSearch.videos', icon: 'movie' },
  { types: '5', key: 'messageSearch.audio', icon: 'mic' },
  { types: '2', key: 'messageSearch.files', icon: 'draft' },
  { types: '3,12,13', key: 'historyManager.system', icon: 'info' },
  { types: '9', key: 'historyManager.stickers', icon: 'emoji_emotions' },
  { types: '6,7', key: 'messageSearch.locations', icon: 'location_on' },
  { types: '8', key: 'messageSearch.statements', icon: 'campaign' },
  { types: '11', key: 'messageSearch.activities', icon: 'celebration' },
  { types: '10', key: 'messageSearch.forwardBundle', icon: 'layers' },
] as const;

export function historyDay(timestamp: number) { return new Date((timestamp + 8 * 3600) * 1000).toISOString().slice(0, 10); }
export function historyTimeMinutes(value: string) {
  if (!value) return undefined;
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(value)) return NaN;
  const [hour, minute] = value.split(':').map(Number);
  return hour * 60 + minute;
}
export function historyDayRange(day: string) {
  const start = Date.parse(`${day}T00:00:00+08:00`) / 1000;
  return { start, end: start + 86400 };
}
export function selectionInRectangle(rect: {left:number;top:number;right:number;bottom:number}, rows: Array<{id:number;left:number;top:number;right:number;bottom:number}>) {
  return rows.filter(row => row.left < rect.right && row.right > rect.left && row.top < rect.bottom && row.bottom > rect.top).map(row => row.id);
}
export function rangeSelection(ids: number[], anchor: number | null, target: number) {
  const a = anchor === null ? -1 : ids.indexOf(anchor), b = ids.indexOf(target);
  return a < 0 || b < 0 ? [target] : ids.slice(Math.min(a,b), Math.max(a,b) + 1);
}
