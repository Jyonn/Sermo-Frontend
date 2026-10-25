import { useLayoutEffect, useRef } from "react";
import { useI18n } from "../lib/language";
import type { ChatDTO, ChatMessageDTO } from "../types";
import { ChatPreview } from "../pages/ChatsPage";

export function PlatformAuditConversation({ chat, firstPersonUserId, memberName, reason, hasMore, loading, messages, onLoadOlder, onMessage }: {
  chat: ChatDTO; firstPersonUserId: number | null; memberName?: string; reason: string; hasMore: boolean; loading: boolean;
  messages: ChatMessageDTO[]; onLoadOlder: () => Promise<void>; onMessage: (message: ChatMessageDTO) => void;
}) {
  const { t } = useI18n();
  const scrollRef = useRef<HTMLDivElement>(null);
  const loadingRef = useRef(false);
  useLayoutEffect(() => { const node = scrollRef.current; if (node) node.scrollTop = node.scrollHeight; }, [chat.chat_id]);
  const loadOlder = async () => {
    const node = scrollRef.current;
    if (!node || !hasMore || loading || loadingRef.current) return;
    loadingRef.current = true;
    const previousHeight = node.scrollHeight;
    const previousTop = node.scrollTop;
    try {
      await onLoadOlder();
      requestAnimationFrame(() => { if (node.isConnected) node.scrollTop = previousTop + node.scrollHeight - previousHeight; });
    } finally { loadingRef.current = false; }
  };
  return <div className="platform-audit-workspace">
    <header className="platform-audit-context"><div><span className="platform-audit-readonly"><span aria-hidden="true" className="material-symbols-outlined">visibility</span>{t("management.readOnlyAudit")}</span>{memberName ? <span className="platform-audit-perspective">{t("management.memberPerspective", { name: memberName })}</span> : null}</div><p><strong>{t("management.auditReason")}</strong>{reason}</p></header>
    <div className="platform-conversation" onScroll={(event) => { if (event.currentTarget.scrollTop < 64) void loadOlder(); }} ref={scrollRef}>
      <div className="platform-audit-message-surface">
        {hasMore ? <button className="platform-audit-load-older" disabled={loading} onClick={() => void loadOlder()} type="button">{t(loading ? "common.loading" : "management.loadOlder")}</button> : <p className="platform-audit-boundary">{t("management.historyStart")}</p>}
        <ChatPreview bare className="platform-audit-chat-preview" firstPersonUserId={firstPersonUserId} messages={[...messages].reverse()} onMessageClick={onMessage} wheelScrollMode="parent" />
      </div>
    </div>
    <footer className="platform-audit-hint"><span aria-hidden="true" className="material-symbols-outlined">account_tree</span>{t("management.inspectDelivery")}</footer>
  </div>;
}
