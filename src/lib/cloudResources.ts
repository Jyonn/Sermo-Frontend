import type { CloudResourceDTO } from "../types";
import { i18n, localeForLanguage } from "./language";

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
      ? i18n.t("date.thisWeek", { lng: language })
      : isThisMonth
        ? i18n.t("date.thisMonth", { lng: language })
        : new Intl.DateTimeFormat(localeForLanguage(language), { month: "long", year: "numeric" }).format(date);
    const group = groups.get(key) || { label, items: [] };
    group.items.push(item);
    groups.set(key, group);
  });

  return [...groups.values()];
}
