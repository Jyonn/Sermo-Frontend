import type { CSSProperties, ReactNode } from "react";
import { useI18n } from "../lib/language";
import type { ChatQuickAction } from "../lib/chatQuickActions";
import { UserAvatar } from "./UserAvatar";
import { ChatActionIcon } from "./ChatActionIcon";
import { useQuickActionLayout } from "../lib/useQuickActionLayout";
import "./ChatQuickActions.css";
export interface QuickPresenceMember { userId: number; name: string; avatarUri?: string; avatarCacheKey?: string; online?: boolean; }
export function ChatQuickActions({ open = true, loading = false, actions, calendar, lockedCount, lockedPreview, lockedBy, copyCount, copyPreview, members, onLocked, onCopy, onStatus, onSearch }: {
  open?: boolean; loading?: boolean;
  actions: ChatQuickAction[]; calendar?: ReactNode; lockedCount: number; lockedPreview: string; lockedBy: string; copyCount: number; copyPreview: string; members: QuickPresenceMember[];
  onLocked: () => void; onCopy: () => void; onStatus: () => void; onSearch: () => void;
}) {
  const { t } = useI18n(); const online = members.filter(member => member.online);
  const visible = open && (loading || actions.length > 0);
  const root = useQuickActionLayout(`${actions.join(":")}:${loading}`, visible);
  return <nav ref={root} className={`chat-quick-actions${visible ? " is-open" : ""}`} aria-label={t("quickActions.title")} aria-busy={loading} aria-hidden={!visible} {...(!visible ? { inert: "" } : {})}>
    {actions.map((key, index) => key === "calendar" ? <div className="chat-quick-calendar" data-action={key} style={{ "--quick-delay": `${index * 45}ms` } as CSSProperties} key={key}>{calendar}</div> : <button className="chat-quick-button" data-action={key} style={{ "--quick-delay": `${index * 45}ms` } as CSSProperties} key={key} type="button" title={key === "locked" ? `${lockedBy} · ${lockedPreview}` : key === "copy" ? copyPreview : undefined} aria-label={key === "locked" ? t("pin.viewAll", { count: lockedCount }) : key === "copy" ? `${t("copyShelf.title")} · ${copyCount}` : key === "search" ? t("messageSearch.action") : t("quickActions.onlineCount", { count: online.length })} onClick={key === "locked" ? onLocked : key === "copy" ? onCopy : key === "search" ? onSearch : onStatus}>
      <span className="chat-quick-body">
        {key === "status" ? <><span className="quick-presence-avatars" aria-hidden="true">{online.slice(0, 5).map(member => <UserAvatar key={member.userId} className="quick-presence-avatar" name={member.name} uri={member.avatarUri} cacheKey={member.avatarCacheKey} />)}</span><span className={`quick-presence-dot${online.length ? "" : " is-offline"}`} /><strong>{online.length}</strong><span className="quick-medium">{t("quickActions.online")}</span></> : <ChatActionIcon action={key}/>}
      </span>
    </button>)}
    <span className={`chat-quick-loading${loading ? " is-loading" : ""}`} aria-hidden={!loading} role="status" aria-label={t("common.loading")}><i /><i /><i /></span>
  </nav>;
}
