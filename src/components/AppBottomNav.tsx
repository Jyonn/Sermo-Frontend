import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { Link, matchPath, useLocation } from "react-router-dom";
import { api } from "../lib/api";
import { useAuth } from "../lib/auth";
import { buildChatCacheScope, chatCache, CHAT_LIST_UPDATED_EVENT } from "../lib/chatCache";
import { FRIEND_REQUESTS_UPDATED_EVENT } from "../lib/friendRequestBadge";
import { SQUARE_NOTIFICATIONS_UPDATED_EVENT } from "../lib/squareNotifications";
import { useSpaceFeatures } from "../lib/spaceFeatures";
import { useSpaceBrand } from "../lib/spaceBrand";
import { UserAvatar } from "./UserAvatar";
import { useI18n, type TranslationKey } from "../lib/language";

const mobileRoutes = [
  { key: "chats", href: "/app/chats", icon: "chat", labelKey: "nav.chats" },
  { key: "square", href: "/app/square", icon: "explore", labelKey: "nav.square" },
  { key: "notifications", href: "/app/notifications", icon: "forum", labelKey: "nav.contacts" },
  { key: "menu", href: "/app/menu", icon: "menu", labelKey: "nav.menu" },
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
  const { session, patchSessionUser } = useAuth();
  const space = useSpaceBrand();
  const features = useSpaceFeatures();
  const { t } = useI18n();
  const loadedIdentityRef = useRef<string | null>(null);
  const sessionUserId = session?.user.user_id ?? null;
  const sessionSpaceId = session?.user.space_id ?? null;
  const sessionAccessToken = session?.accessToken ?? null;
  const effectivePathname = location.pathname === "/friend-invite" && session ? "/app/chats" : location.pathname;
  const cacheScope = useMemo(
    () => (sessionSpaceId && sessionUserId ? buildChatCacheScope(sessionSpaceId, sessionUserId) : null),
    [sessionSpaceId, sessionUserId]
  );
  const [totalUnread, setTotalUnread] = useState(0);
  const [incomingRequestCount, setIncomingRequestCount] = useState(0);
  const [squareUnread, setSquareUnread] = useState(0);
  const [desktopCollapsed, setDesktopCollapsed] = useState(() => localStorage.getItem("sermo:desktop-nav-collapsed") === "1");
  const desktopNavigationActive = Boolean(session && effectivePathname.startsWith("/app/"));

  useEffect(() => {
    if (!session) {
      loadedIdentityRef.current = null;
      return;
    }

    const identityKey = `${session.user.space_id}:${session.user.user_id}`;
    if (loadedIdentityRef.current === identityKey) return;
    loadedIdentityRef.current = identityKey;

    void api
      .getUserMe()
      .then((user) => {
        patchSessionUser({
          name: user.name,
          official: user.official,
          avatar_type: user.avatar_type,
          avatar_uri: user.avatar_uri,
          verified: user.verified,
          growth_level: user.growth_level,
          is_permanent_vip: user.is_permanent_vip,
          chat_bubble_style: user.chat_bubble_style,
          avatar_frame_style: user.avatar_frame_style,
        });
      })
      .catch(() => {
        if (loadedIdentityRef.current === identityKey) loadedIdentityRef.current = null;
      });
  }, [patchSessionUser, sessionAccessToken, sessionSpaceId, sessionUserId]);

  useLayoutEffect(() => {
    if (!desktopNavigationActive) {
      delete document.documentElement.dataset.desktopNav;
      return;
    }
    document.documentElement.dataset.desktopNav = desktopCollapsed ? "collapsed" : "expanded";
    localStorage.setItem("sermo:desktop-nav-collapsed", desktopCollapsed ? "1" : "0");
    return () => {
      delete document.documentElement.dataset.desktopNav;
    };
  }, [desktopCollapsed, desktopNavigationActive]);

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
        setIncomingRequestCount(requests.incoming.filter((request) => request.status === 0).length);
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
  }, [effectivePathname, sessionAccessToken, sessionUserId]);

  useEffect(() => {
    if (!session) {
      setSquareUnread(0);
      return;
    }
    let cancelled = false;
    const sync = () => void api.getNotificationEvents("square").then((result) => {
      if (!cancelled) setSquareUnread(result.unread_count);
    }).catch(() => undefined);
    sync();
    const timer = window.setInterval(sync, 15_000);
    const handleUpdated = (event: Event) => {
      const detail = (event as CustomEvent<{ unreadCount: number }>).detail;
      if (detail && !cancelled) setSquareUnread(Math.max(0, detail.unreadCount));
    };
    window.addEventListener(SQUARE_NOTIFICATIONS_UPDATED_EVENT, handleUpdated as EventListener);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
      window.removeEventListener(SQUARE_NOTIFICATIONS_UPDATED_EVENT, handleUpdated as EventListener);
    };
  }, [sessionAccessToken, sessionUserId]);

  if (!session || !effectivePathname.startsWith("/app/")) return null;
  const isChatDetail = Boolean(matchPath("/app/chats/:chatId", effectivePathname));

  const current = activeKey(effectivePathname);
  const visibleRoutes = mobileRoutes.filter((route) => {
    if (route.key === "square") return features.squareEnabled;
    if (route.key === "chats") return features.chatEnabled;
    return true;
  });

  return (
    <nav aria-label={t("nav.main")} className={`mobile-nav app-mobile-nav${isChatDetail ? " is-chat-detail" : ""}${desktopCollapsed ? " is-collapsed" : ""}`}>
      <div className="desktop-nav-head">
        <Link aria-label={t("brand.fullName")} className="desktop-nav-brand" to={features.chatEnabled ? "/app/chats" : "/app/square"}>
          <img alt="" aria-hidden="true" className="desktop-nav-logo" src="/icons/sermo-512.png?v=3" />
          {space ? (
            <>
              <span aria-hidden="true" className="desktop-brand-collaboration-mark">×</span>
              <UserAvatar
                className="desktop-nav-space-logo"
                name={space.name}
                uri={space.official_user?.avatar_uri}
              />
            </>
          ) : null}
        </Link>
        <button
          aria-label={desktopCollapsed ? t("nav.expand") : t("nav.collapse")}
          className="desktop-nav-toggle"
          onClick={() => setDesktopCollapsed((current) => !current)}
          title={desktopCollapsed ? t("nav.expand") : t("nav.collapse")}
          type="button"
        >
          <svg aria-hidden="true" viewBox="0 0 24 24">
            <path d="M4.5 4.5h15v15h-15zM9 4.5v15" />
            <path d="m16 9-3 3 3 3" />
          </svg>
        </button>
      </div>
      <div className="app-nav-routes">
        {visibleRoutes.map((route) => (
          <Link
            key={route.key}
            aria-label={t(route.labelKey as TranslationKey)}
            className={`nav-button ${current === route.key ? "active" : ""}`}
            title={desktopCollapsed ? t(route.labelKey as TranslationKey) : undefined}
            to={route.href}
          >
            <span className="nav-button-icon-wrap">
              <span className="material-symbols-outlined nav-button-icon">{route.icon}</span>
              {route.key === "chats" && totalUnread > 0 ? (
                <span className="nav-unread-badge">{totalUnread > 99 ? "99+" : totalUnread}</span>
              ) : null}
              {route.key === "square" && squareUnread > 0 ? (
                <span className="nav-unread-badge">{squareUnread > 99 ? "99+" : squareUnread}</span>
              ) : null}
              {route.key === "notifications" && incomingRequestCount > 0 ? (
                <span className="nav-unread-badge">{incomingRequestCount > 99 ? "99+" : incomingRequestCount}</span>
              ) : null}
            </span>
            <span className="nav-button-label">{t(route.labelKey as TranslationKey)}</span>
          </Link>
        ))}
      </div>
      <Link aria-label={t("menu.switchAccount")} className="desktop-nav-user" title={t("menu.switchAccount")} to="/app/menu?switch-account=1">
        <UserAvatar
          className="mini-avatar"
          frame={session.user.avatar_frame_style}
          name={session.user.name}
          uri={session.user.avatar_uri}
          vip={Boolean(session.user.is_permanent_vip)}
        />
        <span>{session.user.name}</span>
      </Link>
    </nav>
  );
}
