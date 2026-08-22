import type { CloudResourceDTO } from "../types";

export function formatCloudResourceBytes(bytes: number) {
  if (bytes >= 1024 ** 3) return `${(bytes / 1024 ** 3).toFixed(1)} GB`;
  if (bytes >= 1024 ** 2) return `${(bytes / 1024 ** 2).toFixed(1)} MB`;
  if (bytes >= 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${bytes} B`;
}

export function groupCloudResourcesByPeriod(items: CloudResourceDTO[], language: string) {
  const now = new Date();
  const weekStart = new Date(now);
  weekStart.setHours(0, 0, 0, 0);
  weekStart.setDate(weekStart.getDate() - ((weekStart.getDay() + 6) % 7));
  const groups = new Map<string, { label: string; items: CloudResourceDTO[] }>();

  items.forEach((item) => {
    const date = new Date(item.created_at * 1000);
    const isThisWeek = date >= weekStart;
    const isThisMonth = date.getFullYear() === now.getFullYear() && date.getMonth() === now.getMonth();
    const key = isThisWeek ? "this-week" : isThisMonth ? "this-month" : `${date.getFullYear()}-${date.getMonth()}`;
    const label = isThisWeek
      ? (language === "en" ? "This week" : "本周")
      : isThisMonth
        ? (language === "en" ? "This month" : "这个月")
        : language === "en"
          ? new Intl.DateTimeFormat("en-US", { month: "long", year: "numeric" }).format(date)
          : `${date.getFullYear()}年${String(date.getMonth() + 1).padStart(2, "0")}月`;
    const group = groups.get(key) || { label, items: [] };
    group.items.push(item);
    groups.set(key, group);
  });

  return [...groups.values()];
}
