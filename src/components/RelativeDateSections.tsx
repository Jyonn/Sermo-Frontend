import type { ReactNode } from "react";
import { useI18n } from "../lib/language";

const BASE_TIME_ZONE = "Asia/Shanghai";

function dateParts(timestamp: number) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: BASE_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date(timestamp * 1000));
  return Object.fromEntries(parts.map((part) => [part.type, part.value]));
}

export function relativeDateLabel(timestamp: number, language: string) {
  const item = dateParts(timestamp);
  const now = dateParts(Date.now() / 1000);
  const itemDate = new Date(`${item.year}-${item.month}-${item.day}T00:00:00+08:00`);
  const nowDate = new Date(`${now.year}-${now.month}-${now.day}T00:00:00+08:00`);
  const days = Math.round((nowDate.getTime() - itemDate.getTime()) / 86_400_000);
  if (days === 0) return language === "en" ? "Today" : "今天";
  if (days === 1) return language === "en" ? "Yesterday" : "昨天";
  if (days < 7) return language === "en" ? "This week" : "本周";
  if (item.year === now.year && item.month === now.month) return language === "en" ? "This month" : "本月";
  return new Intl.DateTimeFormat(language === "en" ? "en-US" : "zh-CN", {
    timeZone: BASE_TIME_ZONE,
    year: item.year === now.year ? undefined : "numeric",
    month: "long",
  }).format(itemDate);
}

export function RelativeDateSections<T>({
  items,
  timestamp,
  identity,
  children,
  className = "",
}: {
  items: T[];
  timestamp: (item: T) => number;
  identity: (item: T) => string | number;
  children: (items: T[], label: string) => ReactNode;
  className?: string;
}) {
  const { language } = useI18n();
  const groups = new Map<string, T[]>();
  items.forEach((item) => {
    const label = relativeDateLabel(timestamp(item), language);
    groups.set(label, [...(groups.get(label) ?? []), item]);
  });
  return <div className={`resource-date-sections ${className}`.trim()}>
    {[...groups].map(([label, group]) => <section className="resource-date-section" key={`${label}:${identity(group[0])}`}>
      <h3>{label}</h3>
      {children(group, label)}
    </section>)}
  </div>;
}
