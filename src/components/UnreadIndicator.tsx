import { useI18n } from "../lib/language";
import "./UnreadIndicator.css";
import { unreadIndicator } from "../lib/unreadIndicator";

export function UnreadIndicator({ count = 0, fresh = false }: { count?: number; fresh?: boolean }) {
  const { t } = useI18n();
  const badge = unreadIndicator(count, fresh);
  return badge ? <span className={`unread-indicator is-${badge.kind}`} aria-label={badge.kind === "count" ? t("square.unreadCount", { count: badge.count }) : t("square.freshContent")}>{badge.label}</span> : null;
}
