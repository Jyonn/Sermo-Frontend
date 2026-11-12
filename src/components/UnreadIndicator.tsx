import { useI18n } from "../lib/language";
import "./UnreadIndicator.css";
import { unreadIndicator } from "../lib/unreadIndicator";

export function UnreadIndicator({ count = 0, fresh = false, freshLabel }: { count?: number; fresh?: boolean; freshLabel?: string }) {
  const { t } = useI18n();
  const badge = unreadIndicator(count, fresh);
  return badge ? <span className={`unread-indicator is-${badge.kind}`} role="img" aria-label={badge.kind === "count" ? t("square.unreadCount", { count: badge.count }) : freshLabel ?? t("square.freshContent")}>{badge.label}</span> : null;
}
