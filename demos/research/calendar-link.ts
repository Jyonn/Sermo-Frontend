export function calendarFromLink(value: string) {
  try {
    const url=new URL(value);
    if(url.protocol!=='https:' || !['chronelle.jyonn.space','chronelle.6-79.cn'].includes(url.hostname) || url.search || url.username || url.password) return null;
    return url.hash.match(/^#\/share\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\/?$/i)?.[1] || null;
  } catch { return null; }
}
