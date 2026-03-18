import { useEffect, useMemo, useState } from "react";
import { Link, matchPath, useLocation } from "react-router-dom";
import { useAuth } from "../lib/auth";
import { buildChatCacheScope, chatCache, CHAT_LIST_UPDATED_EVENT } from "../lib/chatCache";

const mobileRoutes = [
  { key: "chats", href: "/app/chats", icon: "chat", label: "聊天" },
  { key: "square", href: "/app/square", icon: "explore", label: "广场" },
  { key: "notifications", href: "/app/notifications", icon: "forum", label: "通讯" },
  { key: "menu", href: "/app/menu", icon: "menu", label: "菜单" },
] as const;

function activeKey(pathname: string) {
  if (pathname.startsWith("/app/chats")) return "chats";
  if (pathname.startsWith("/app/square")) return "square";
  if (pathname.startsWith("/app/notifications")) return "notifications";
  if (pathname.startsWith("/app/menu")) return "menu";
  return null;
}

export function AppBottomNav() {
  const location = useLocation();
  const { session } = useAuth();
  const cacheScope = useMemo(
    () => (session ? buildChatCacheScope(session.user.space_id, session.user.user_id) : null),
    [session]
  );
  const [totalUnread, setTotalUnread] = useState(0);

  useEffect(() => {
    if (!cacheScope) {
      setTotalUnread(0);
      return;
    }

    let cancelled = false;

    const applyUnread = (scope: string, chats: { unread: number }[]) => {
      if (scope !== cacheScope || cancelled) return;
      setTotalUnread(chats.reduce((sum, chat) => sum + Math.max(0, chat.unread || 0), 0));
    };

    const inMemory = chatCache.getChatList(cacheScope);
    if (inMemory) {
      applyUnread(cacheScope, inMemory.chats);
    } else {
      void chatCache.hydrateChatList(cacheScope).then((record) => {
        if (!record) return;
        applyUnread(cacheScope, record.chats);
      });
    }

    const handleUpdated = (event: Event) => {
      const detail = (event as CustomEvent<{ scope: string; chats: { unread: number }[] }>).detail;
      if (!detail) return;
      applyUnread(detail.scope, detail.chats);
    };

    window.addEventListener(CHAT_LIST_UPDATED_EVENT, handleUpdated as EventListener);
    return () => {
      cancelled = true;
      window.removeEventListener(CHAT_LIST_UPDATED_EVENT, handleUpdated as EventListener);
    };
  }, [cacheScope]);

  if (!location.pathname.startsWith("/app/")) return null;
  if (matchPath("/app/chats/:chatId", location.pathname)) return null;

  const current = activeKey(location.pathname);
  if (!current) return null;

  return (
    <nav className="mobile-nav app-mobile-nav">
      {mobileRoutes.map((route) => (
        <Link key={route.key} className={`nav-button ${current === route.key ? "active" : ""}`} to={route.href}>
          <span className="nav-button-icon-wrap">
            <span className="material-symbols-outlined nav-button-icon">{route.icon}</span>
            {route.key === "chats" && totalUnread > 0 ? (
              <span className="nav-unread-badge">{totalUnread > 99 ? "99+" : totalUnread}</span>
            ) : null}
          </span>
          <span className="nav-button-label">{route.label}</span>
        </Link>
      ))}
    </nav>
  );
}
