export function formatRelativeTime(timestampSeconds: number) {
  const deltaMinutes = Math.max(1, Math.floor((Date.now() / 1000 - timestampSeconds) / 60));

  if (deltaMinutes < 60) return deltaMinutes <= 1 ? "刚刚" : `${deltaMinutes} 分钟前`;
  if (deltaMinutes < 1440) return `${Math.floor(deltaMinutes / 60)} 小时前`;
  return `${Math.floor(deltaMinutes / 1440)} 天前`;
}

export function confirmDangerAction(message: string) {
  return window.confirm(message);
}
