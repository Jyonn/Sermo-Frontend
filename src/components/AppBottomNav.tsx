import { useEffect, useMemo, useState } from "react";
import { Link, matchPath, useLocation } from "react-router-dom";
import { api } from "../lib/api";
import { useAuth } from "../lib/auth";
import { buildChatCacheScope, chatCache, CHAT_LIST_UPDATED_EVENT } from "../lib/chatCache";
import { FRIEND_REQUESTS_UPDATED_EVENT } from "../lib/friendRequestBadge";
import { useGroupSquareEnabled } from "../lib/spaceFeatures";
import { UserAvatar } from "./UserAvatar";
import logoUrl from "../assets/logo.svg";

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
  const groupSquareEnabled = useGroupSquareEnabled();
  const effectivePathname = location.pathname === "/friend-invite" && session ? "/app/chats" : location.pathname;
  const cacheScope = useMemo(
    () => (session ? buildChatCacheScope(session.user.space_id, session.user.user_id) : null),
    [session]
  );
  const [totalUnread, setTotalUnread] = useState(0);
  const [incomingRequestCount, setIncomingRequestCount] = useState(0);
  const [desktopCollapsed, setDesktopCollapsed] = useState(() => localStorage.getItem("sermo:desktop-nav-collapsed") === "1");

  useEffect(() => {
    document.documentElement.dataset.desktopNav = desktopCollapsed ? "collapsed" : "expanded";
    localStorage.setItem("sermo:desktop-nav-collapsed", desktopCollapsed ? "1" : "0");
    return () => {
      delete document.documentElement.dataset.desktopNav;
    };
  }, [desktopCollapsed]);

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

  useEffect(() => {
    if (!session) {
      setIncomingRequestCount(0);
      return;
    }

    let cancelled = false;

    const syncRequests = async () => {
      try {
        const requests = await api.getFriendRequests();
        if (cancelled) return;
        setIncomingRequestCount(requests.incoming.length);
      } catch {
        if (cancelled) return;
        setIncomingRequestCount(0);
      }
    };

    void syncRequests();

    const handleUpdated = (event: Event) => {
      const detail = (event as CustomEvent<{ incomingCount: number }>).detail;
      if (!detail || cancelled) return;
      setIncomingRequestCount(Math.max(0, detail.incomingCount));
    };

    window.addEventListener(FRIEND_REQUESTS_UPDATED_EVENT, handleUpdated as EventListener);
    return () => {
      cancelled = true;
      window.removeEventListener(FRIEND_REQUESTS_UPDATED_EVENT, handleUpdated as EventListener);
    };
  }, [session, effectivePathname]);

  if (!session || !effectivePathname.startsWith("/app/")) return null;
  const isChatDetail = Boolean(matchPath("/app/chats/:chatId", effectivePathname));

  const current = activeKey(effectivePathname);
  const visibleRoutes = groupSquareEnabled ? mobileRoutes : mobileRoutes.filter((route) => route.key !== "square");

  return (
    <nav aria-label="主导航" className={`mobile-nav app-mobile-nav${isChatDetail ? " is-chat-detail" : ""}${desktopCollapsed ? " is-collapsed" : ""}`}>
      <div className="desktop-nav-head">
        <Link aria-label="Sermo 言浪" className="desktop-nav-brand" to="/app/chats">
          <span
            aria-hidden="true"
            className="desktop-nav-logo"
            style={{ WebkitMaskImage: `url(${logoUrl})`, maskImage: `url(${logoUrl})` }}
          />
          <span aria-hidden="true" className="desktop-nav-monogram">S</span>
        </Link>
        <button
          aria-label={desktopCollapsed ? "展开导航" : "收起导航"}
          className="desktop-nav-toggle"
          onClick={() => setDesktopCollapsed((current) => !current)}
          title={desktopCollapsed ? "展开导航" : "收起导航"}
          type="button"
        >
          <svg aria-hidden="true" viewBox="0 0 24 24">
            <path d="M4.5 4.5h15v15h-15zM9 4.5v15" />
            <path d={desktopCollapsed ? "m13 9 3 3-3 3" : "m16 9-3 3 3 3"} />
          </svg>
        </button>
      </div>
      <div className="app-nav-routes">
        {visibleRoutes.map((route) => (
          <Link
            key={route.key}
            aria-label={route.label}
            className={`nav-button ${current === route.key ? "active" : ""}`}
            title={desktopCollapsed ? route.label : undefined}
            to={route.href}
          >
            <span className="nav-button-icon-wrap">
              <span className="material-symbols-outlined nav-button-icon">{route.icon}</span>
              {route.key === "chats" && totalUnread > 0 ? (
                <span className="nav-unread-badge">{totalUnread > 99 ? "99+" : totalUnread}</span>
              ) : null}
              {route.key === "notifications" && incomingRequestCount > 0 ? (
                <span className="nav-unread-badge">{incomingRequestCount > 99 ? "99+" : incomingRequestCount}</span>
              ) : null}
            </span>
            <span className="nav-button-label">{route.label}</span>
          </Link>
        ))}
      </div>
      <Link aria-label="打开菜单" className="desktop-nav-user" to="/app/menu">
        <UserAvatar className="mini-avatar" name={session.user.name} uri={session.user.avatar_uri} />
        <span>{session.user.name}</span>
      </Link>
    </nav>
  );
}
