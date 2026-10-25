import { useI18n } from "../lib/language";
import { UnreadIndicator } from "./UnreadIndicator";
import "./SquareExperience.css";

export function SquareHeaderTools({ searchOpen, filtered, unread, onSearch, onQuota, onNotifications }: { searchOpen: boolean; filtered: boolean; unread: number; onSearch: () => void; onQuota: () => void; onNotifications: () => void }) {
  const { t } = useI18n();
  return <div className="square-header-square-tools">
    <button className={`square-header-tool${filtered ? " is-active" : ""}`} aria-label={t("square.search")} aria-haspopup="dialog" aria-expanded={searchOpen} onClick={onSearch} type="button"><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 4.5 4.5"/></svg></button>
    <button className="square-header-tool" aria-label={t("square.quotaTitle")} onClick={onQuota} type="button"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4.2 18a9 9 0 1 1 15.6 0M6 18h12M12 4v2M5.6 7.6 7 9M18.4 7.6 17 9M12 14l3-4"/><circle cx="12" cy="14" r="1"/></svg></button>
    <button className="square-header-tool is-notifications" aria-label={`${t("square.notifications")}${unread > 0 ? ` · ${t("square.unreadCount", { count: unread })}` : ""}`} onClick={onNotifications} type="button"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 17h14l-2-3V9a5 5 0 0 0-10 0v5l-2 3ZM10 20h4M12 2v2"/></svg><UnreadIndicator count={unread}/></button>
  </div>;
}
