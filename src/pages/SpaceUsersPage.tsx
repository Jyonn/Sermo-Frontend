import { useEffect, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { AppChrome } from "../components/AppChrome";
import { AsyncErrorDialog } from "../components/AsyncErrorDialog";
import { BottomSheet } from "../components/BottomSheet";
import { FeedbackState } from "../components/FeedbackState";
import { HeaderSyncIndicator } from "../components/HeaderSyncIndicator";
import { UserAvatar } from "../components/UserAvatar";
import { ApiError, api } from "../lib/api";
import { useAuth } from "../lib/auth";
import { buildTabCacheScope, readTabCache, writeTabCache } from "../lib/tabCache";
import type { AppViewState, UserDTO } from "../types";
import { i18n, useI18n } from "../lib/language";

function productizeFriendRequestError(message: string) {
  if (/verified|认证|验证|权限|forbidden/i.test(message)) {
    return i18n.t("members.verifyHint");
  }
  return message;
}

export default function SpaceUsersPage() {
  const { t } = useI18n();
  const location = useLocation();
  const navigate = useNavigate();
  const { session } = useAuth();
  const [query, setQuery] = useState("");
  const [viewState, setViewState] = useState<AppViewState>("idle");
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [users, setUsers] = useState<UserDTO[]>([]);
  const [refreshTick, setRefreshTick] = useState(0);
  const [sheetUser, setSheetUser] = useState<UserDTO | null>(null);
  const onlineOnly = location.pathname === "/app/space-users/online";
  const cacheScope = buildTabCacheScope(session?.user.space_id, session?.user.user_id);

  useEffect(() => {
    const controller = new AbortController();
    const cacheKey = onlineOnly ? "space-users:online" : "space-users:all";
    const cached = !query ? readTabCache<UserDTO[]>(cacheScope, cacheKey) : null;
    if (cached) {
      setUsers(cached.data);
      setViewState("ready");
    } else if (!users.length) {
      setViewState("loading");
    }
    setSyncing(true);
    setError(null);

    const fetcher = onlineOnly
      ? api.getOnlineUsers({ q: query || undefined, limit: 40, offset: 0 }, controller.signal)
      : api.getSpaceUsers({ q: query || undefined, limit: 40, offset: 0 }, controller.signal);

    fetcher
      .then((rows) => {
        setUsers(rows);
        setViewState("ready");
        if (!query) writeTabCache(cacheScope, cacheKey, rows);
      })
      .catch((apiError) => {
        if (controller.signal.aborted) return;
        if (!cached && !users.length) {
          const message = apiError instanceof ApiError ? apiError.message : t("members.loadFailed");
          setError(message);
          setViewState("error");
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) setSyncing(false);
      });

    return () => controller.abort();
  }, [cacheScope, onlineOnly, query, refreshTick]);

  useEffect(() => {
    if (!onlineOnly) return;
    const timer = window.setInterval(() => setRefreshTick((value) => value + 1), 12_000);
    return () => window.clearInterval(timer);
  }, [onlineOnly]);

  const createDirectChat = async (userId: number) => {
    try {
      const chat = await api.createDirectChat(userId);
      navigate(`/app/chats/${chat.chat_id}`);
    } catch (apiError) {
      const message = apiError instanceof ApiError ? apiError.message : t("members.chatFailed");
      setError(message);
    }
  };

  const sendFriendRequest = async (userId: number) => {
    try {
      await api.createFriendRequest(userId);
      navigate("/app/friends/requests");
    } catch (apiError) {
      const message = apiError instanceof ApiError ? apiError.message : t("members.requestFailed");
      setError(productizeFriendRequestError(message));
    }
  };

  return (
    <AppChrome title={onlineOnly ? t("members.onlineTitle") : t("members.title")} hideTopbar>
      <section className="page-stack">
        <div className="page-tabs">
          <Link className={`tab-chip ${!onlineOnly ? "active" : ""}`} to="/app/space-users">
            {t("members.all")}
          </Link>
          <Link className={`tab-chip ${onlineOnly ? "active" : ""}`} to="/app/space-users/online">
            {t("members.online")}
          </Link>
          <HeaderSyncIndicator syncing={syncing} />
        </div>

        <label className="search-box page-search">
          <span className="material-symbols-outlined">search</span>
          <input
            className="input"
            style={{ border: 0, background: "transparent", height: "auto", padding: 0 }}
            placeholder={t("members.search")}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
        </label>

        <section className="list-section">
          <div className="simple-list">
            {users.map((user) => (
              <div key={user.user_id} className="simple-row person-row">
                <UserAvatar className={`mini-avatar ${user.is_alive ? "status-online" : ""}`} name={user.name} uri={user.avatar_uri} />
                <div className="row-main">
                  <strong>{user.name}</strong>
                  <div className="row-subtle">{user.is_alive ? t("presence.online") : t("presence.offline")}</div>
                </div>
                <button className="button row-button" onClick={() => void createDirectChat(user.user_id)} type="button">
                  {t("members.sendMessage")}
                </button>
                <button className="icon-button row-trailing-button" onClick={() => setSheetUser(user)} type="button">
                  <span className="material-symbols-outlined">more_horiz</span>
                </button>
              </div>
            ))}
          </div>
        </section>

        {!users.length && viewState === "ready" ? (
          <FeedbackState
            title={t("members.empty")}
            description={query.trim() ? t("members.tryKeyword") : t("members.comeBack")}
            action={onlineOnly ? <Link className="button" to="/app/space-users">{t("members.viewAll")}</Link> : undefined}
          />
        ) : null}
      </section>

      <BottomSheet
        open={Boolean(sheetUser)}
        title={sheetUser?.name ?? t("members.title")}
        onClose={() => setSheetUser(null)}
      >
        {sheetUser ? (
          <div className="sheet-action-list">
            <button className="button" onClick={() => void createDirectChat(sheetUser.user_id)} type="button">
              {t("members.sendMessage")}
            </button>
            <button className="ghost-button" onClick={() => void sendFriendRequest(sheetUser.user_id)} type="button">
              {t("members.addFriend")}
            </button>
          </div>
        ) : null}
      </BottomSheet>
      <AsyncErrorDialog message={error ?? ""} onClose={() => setError(null)} open={Boolean(error)} />
    </AppChrome>
  );
}
