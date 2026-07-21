import { useEffect, useMemo, useState } from "react";
import type { Chat } from "../types";
import { api } from "../lib/api";
import { useAuth } from "../lib/auth";
import { buildChatCacheScope, chatCache, CHAT_LIST_UPDATED_EVENT } from "../lib/chatCache";
import { listRecentSpaces } from "../lib/recentSpaces";
import { getDetectedSpaceSlug } from "../lib/spaceEntry";
import { getWebReminderPreferences, WEB_REMINDER_PREFS_UPDATED_EVENT } from "../lib/webReminderPreferences";

const FALLBACK_TITLE = "Sermo";

function getRememberedSpaceName(slug: string | null) {
  if (!slug) return null;
  return listRecentSpaces().find((space) => space.slug === slug)?.name ?? null;
}

function countUnread(chats: Array<Pick<Chat, "unread">>) {
  return chats.reduce((sum, chat) => sum + Math.max(0, chat.unread || 0), 0);
}

export function DocumentTitle() {
  const { ready, session } = useAuth();
  const cacheScope = useMemo(
    () => (session ? buildChatCacheScope(session.user.space_id, session.user.user_id) : null),
    [session]
  );
  const [spaceName, setSpaceName] = useState(FALLBACK_TITLE);
  const [unreadCount, setUnreadCount] = useState(0);
  const [titleReminderEnabled, setTitleReminderEnabled] = useState(() => getWebReminderPreferences().titleEnabled);

  useEffect(() => {
    if (!ready) return;

    const detectedSlug = getDetectedSpaceSlug();
    const rememberedSpaceName = getRememberedSpaceName(detectedSlug);
    setSpaceName(rememberedSpaceName || FALLBACK_TITLE);

    const controller = new AbortController();
    const loadSpace = session ? api.getSpaceMe(controller.signal) : detectedSlug ? api.getSpaceBySlug(detectedSlug, controller.signal) : null;

    if (!loadSpace) return () => controller.abort();

    void loadSpace
      .then((space) => {
        setSpaceName(space.name || rememberedSpaceName || FALLBACK_TITLE);
      })
      .catch((error) => {
        if (error instanceof DOMException && error.name === "AbortError") return;
        setSpaceName(rememberedSpaceName || FALLBACK_TITLE);
      });

    return () => controller.abort();
  }, [ready, session]);

  useEffect(() => {
    if (!ready || !cacheScope) {
      setUnreadCount(0);
      return;
    }

    let cancelled = false;
    const applyUnread = (scope: string, chats: Array<Pick<Chat, "unread">>) => {
      if (scope !== cacheScope || cancelled) return;
      setUnreadCount(countUnread(chats));
    };

    const inMemory = chatCache.getChatList(cacheScope);
    if (inMemory) {
      applyUnread(cacheScope, inMemory.chats);
    } else {
      void chatCache.hydrateChatList(cacheScope).then((record) => {
        if (record) applyUnread(cacheScope, record.chats);
      });
    }

    const handleUpdated = (event: Event) => {
      const detail = (event as CustomEvent<{ scope: string; chats: Array<Pick<Chat, "unread">> }>).detail;
      if (!detail) return;
      applyUnread(detail.scope, detail.chats);
    };

    window.addEventListener(CHAT_LIST_UPDATED_EVENT, handleUpdated as EventListener);
    return () => {
      cancelled = true;
      window.removeEventListener(CHAT_LIST_UPDATED_EVENT, handleUpdated as EventListener);
    };
  }, [ready, cacheScope]);

  useEffect(() => {
    if (!ready || typeof document === "undefined") return;
    document.title = titleReminderEnabled && unreadCount > 0 ? `${spaceName} - ${unreadCount}条新消息` : spaceName;
  }, [ready, spaceName, titleReminderEnabled, unreadCount]);

  useEffect(() => {
    const handleUpdated = (event: Event) => {
      const detail = (event as CustomEvent<{ titleEnabled: boolean }>).detail;
      setTitleReminderEnabled(detail?.titleEnabled ?? getWebReminderPreferences().titleEnabled);
    };
    window.addEventListener(WEB_REMINDER_PREFS_UPDATED_EVENT, handleUpdated as EventListener);
    return () => window.removeEventListener(WEB_REMINDER_PREFS_UPDATED_EVENT, handleUpdated as EventListener);
  }, []);

  return null;
}
