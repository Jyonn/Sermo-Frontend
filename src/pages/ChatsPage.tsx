import {
  memo,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
} from "react";
import { flushSync } from "react-dom";
import { Link, useLocation, useNavigate, useParams } from "react-router-dom";
import { AppChrome } from "../components/AppChrome";
import { AsyncErrorDialog } from "../components/AsyncErrorDialog";
import { BottomSheet } from "../components/BottomSheet";
import { ConfirmDialog } from "../components/ConfirmDialog";
import { FeedbackState } from "../components/FeedbackState";
import { InputDialog } from "../components/InputDialog";
import { RequestStatusModal } from "../components/RequestStatusModal";
import { SideDrawer } from "../components/SideDrawer";
import { UserAvatar } from "../components/UserAvatar";
import { UserProfilePanel } from "../components/UserProfilePanel";
import { VerificationBanner } from "../components/VerificationBanner";
import { ApiError, api } from "../lib/api";
import { useAuth } from "../lib/auth";
import { buildChatCacheScope, chatCache } from "../lib/chatCache";
import { CHAT_SYNC_EVENT, type ChatSyncEventDetail } from "../lib/chatSync";
import { resolveMediaKind, toMessageUploadError, uploadMessageMedia } from "../lib/messageUpload";
import { copyText, formatRelativeTime } from "../lib/presentation";
import { forgetStableResourceUri, normalizeStableResourceUri, resolveStableResourceUri } from "../lib/stableResource";
import { useGroupSquareEnabled } from "../lib/spaceFeatures";
import type { AppViewState, Chat, ChatDTO, ChatMessage, ChatMessageDTO, ChatMessagePayloadDTO, LinkPreviewDTO, MessageKind, MessageMediaKind, UserDTO } from "../types";

const DEBUG_CHAT_SEND = import.meta.env.DEV;
const CHAT_DETAIL_MEMBER_PAGE_SIZE = 19;
const MESSAGE_TYPE_TEXT = 0;
const MESSAGE_TYPE_IMAGE = 1;
const MESSAGE_TYPE_FILE = 2;
const MESSAGE_TYPE_SYSTEM = 3;
const MESSAGE_TYPE_VIDEO = 4;
const MESSAGE_TYPE_AUDIO = 5;
const AUDIO_MAX_DURATION_SECONDS = 60;
const TEXT_URL_RE = /https?:\/\/[^\s<>"'，。！？、；：）】》]+/gi;
const LINK_TRAILING_PUNCTUATION = ".,;:!?)]}，。！？、；：）】》";

type ChatRouteState = {
  chatAccessError?: string;
};

function avatarLabel(name: string) {
  return name.slice(0, 2).toUpperCase();
}

function ComposerSvgIcon({ kind, className }: { kind: "album" | "mic" | "stop" | "delete"; className?: string }) {
  if (kind === "album") {
    return (
      <svg aria-hidden="true" className={className} fill="none" viewBox="0 0 24 24">
        <rect x="3.5" y="5" width="17" height="14" rx="3.5" stroke="currentColor" strokeWidth="1.8" />
        <circle cx="9" cy="10" r="1.7" fill="currentColor" />
        <path d="M7 16.5 11.2 12.3a1.1 1.1 0 0 1 1.56 0l1.58 1.58a1.1 1.1 0 0 0 1.56 0L17 12.6l3.5 3.9" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" />
      </svg>
    );
  }

  if (kind === "stop") {
    return (
      <svg aria-hidden="true" className={className} fill="none" viewBox="0 0 24 24">
        <circle cx="12" cy="12" r="8.5" stroke="currentColor" strokeWidth="1.8" />
        <rect x="9" y="9" width="6" height="6" rx="1.4" fill="currentColor" />
      </svg>
    );
  }

  if (kind === "delete") {
    return (
      <svg aria-hidden="true" className={className} fill="none" viewBox="0 0 24 24">
        <path
          d="M9 3.75h6a1.5 1.5 0 0 1 1.5 1.5v.75h3a.75.75 0 0 1 0 1.5H18v11.25A2.25 2.25 0 0 1 15.75 21h-7.5A2.25 2.25 0 0 1 6 18.75V7.5H4.5a.75.75 0 0 1 0-1.5h3v-.75A1.5 1.5 0 0 1 9 3.75Zm6 2.25v-.75h-6V6h6Zm-7.5 1.5v11.25a.75.75 0 0 0 .75.75h7.5a.75.75 0 0 0 .75-.75V7.5h-9Zm3 2.25c.414 0 .75.336.75.75v5.25a.75.75 0 0 1-1.5 0V10.5c0-.414.336-.75.75-.75Zm3 0c.414 0 .75.336.75.75v5.25a.75.75 0 0 1-1.5 0V10.5c0-.414.336-.75.75-.75Z"
          fill="currentColor"
        />
      </svg>
    );
  }

  return (
    <svg aria-hidden="true" className={className} fill="none" viewBox="0 0 24 24">
      <path d="M12 15.5a3.1 3.1 0 0 0 3.1-3.1V8.9a3.1 3.1 0 1 0-6.2 0v3.5a3.1 3.1 0 0 0 3.1 3.1Z" fill="currentColor" />
      <path d="M6.8 11.8a5.2 5.2 0 1 0 10.4 0M12 17v3M9 20h6" stroke="currentColor" strokeLinecap="round" strokeWidth="1.8" />
    </svg>
  );
}

function MessageControlIcon({ kind, className }: { kind: "play" | "pause"; className?: string }) {
  if (kind === "pause") {
    return (
      <svg aria-hidden="true" className={className} fill="none" viewBox="0 0 24 24">
        <rect x="7.25" y="6.5" width="3.5" height="11" rx="1.2" fill="currentColor" />
        <rect x="13.25" y="6.5" width="3.5" height="11" rx="1.2" fill="currentColor" />
      </svg>
    );
  }

  return (
    <svg aria-hidden="true" className={className} fill="none" viewBox="0 0 24 24">
      <path d="M8.4 6.9c0-1.02 1.1-1.66 1.98-1.15l7.11 4.11c.89.52.89 1.78 0 2.3l-7.1 4.1c-.89.52-1.99-.12-1.99-1.14V6.9Z" fill="currentColor" />
    </svg>
  );
}

function formatTime(value: number) {
  return new Date(value * 1000).toLocaleTimeString("zh-CN", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatDuration(seconds: number) {
  const total = Math.max(0, Math.round(seconds));
  const minutes = Math.floor(total / 60);
  const rest = total % 60;
  return `${minutes}:${String(rest).padStart(2, "0")}`;
}

function normalizeMessageUrl(rawUrl: string) {
  const escaped = LINK_TRAILING_PUNCTUATION.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return rawUrl.replace(new RegExp(`[${escaped}]+$`), "");
}

function hasMeaningfulTextOutsidePreviewUrl(text: string, previewUrl?: string) {
  if (!previewUrl) return text.trim().length > 0;
  const escaped = LINK_TRAILING_PUNCTUATION.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const remaining = text.replace(previewUrl, "").trim();
  return remaining.replace(new RegExp(`^[${escaped}\\s]+$`), "").length > 0;
}

function extractFirstMessageUrl(text: string) {
  TEXT_URL_RE.lastIndex = 0;
  const match = TEXT_URL_RE.exec(text);
  TEXT_URL_RE.lastIndex = 0;
  return match ? normalizeMessageUrl(match[0]) : null;
}

function hostnameFromUrl(url: string) {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "";
  }
}

const AUDIO_WAVE_PATTERN = [0.34, 0.58, 0.44, 0.76, 0.41, 0.66, 0.52, 0.84, 0.49, 0.7, 0.39, 0.62, 0.47, 0.8];

function waitForAudioReady(audio: HTMLAudioElement) {
  if (audio.readyState >= HTMLMediaElement.HAVE_FUTURE_DATA) {
    return Promise.resolve();
  }

  return new Promise<void>((resolve, reject) => {
    let settled = false;
    let timeoutId = 0;

    const cleanup = () => {
      audio.removeEventListener("canplay", handleReady);
      audio.removeEventListener("canplaythrough", handleReady);
      audio.removeEventListener("loadeddata", handleReady);
      audio.removeEventListener("error", handleError);
      if (timeoutId) {
        window.clearTimeout(timeoutId);
      }
    };

    const finish = (callback: () => void) => {
      if (settled) return;
      settled = true;
      cleanup();
      callback();
    };

    const handleReady = () => finish(resolve);
    const handleError = () => finish(() => reject(new Error("audio_load_failed")));

    timeoutId = window.setTimeout(handleReady, 5000);
    audio.addEventListener("canplay", handleReady, { once: true });
    audio.addEventListener("canplaythrough", handleReady, { once: true });
    audio.addEventListener("loadeddata", handleReady, { once: true });
    audio.addEventListener("error", handleError, { once: true });
  });
}

const AudioMessagePlayer = memo(function AudioMessagePlayer({
  durationSeconds,
  from,
  uri,
  className,
}: {
  durationSeconds?: number;
  from: "self" | "other";
  uri: string;
  className?: string;
}) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [resolvedDuration, setResolvedDuration] = useState(durationSeconds ?? 0);
  const [retryWithFreshUri, setRetryWithFreshUri] = useState(false);
  const resolvedUri = retryWithFreshUri ? uri : resolveStableResourceUri(uri) ?? uri;

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    setIsPlaying(false);
    setIsLoading(false);
    setCurrentTime(0);
    setResolvedDuration(durationSeconds ?? 0);

    const sync = () => {
      const nextDuration = Number.isFinite(audio.duration) && audio.duration > 0 ? audio.duration : durationSeconds ?? 0;
      setResolvedDuration(nextDuration);
      setCurrentTime(Number.isFinite(audio.currentTime) ? audio.currentTime : 0);
      setIsPlaying(!audio.paused && !audio.ended);
    };

    const handleEnded = () => {
      audio.currentTime = 0;
      setIsLoading(false);
      if (activeThreadAudio === audio) {
        activeThreadAudio = null;
      }
      sync();
    };

    const handlePlaying = () => {
      setIsLoading(false);
      sync();
    };

    const handleWaiting = () => {
      if (!audio.paused && !audio.ended) {
        setIsLoading(true);
      }
      sync();
    };

    const handlePause = () => {
      setIsLoading(false);
      sync();
    };

    const handleError = () => {
      setIsLoading(false);
      setIsPlaying(false);
    };

    sync();
    audio.addEventListener("loadedmetadata", sync);
    audio.addEventListener("durationchange", sync);
    audio.addEventListener("timeupdate", sync);
    audio.addEventListener("pause", handlePause);
    audio.addEventListener("play", sync);
    audio.addEventListener("playing", handlePlaying);
    audio.addEventListener("waiting", handleWaiting);
    audio.addEventListener("stalled", handleWaiting);
    audio.addEventListener("error", handleError);
    audio.addEventListener("ended", handleEnded);

    return () => {
      audio.pause();
      setIsLoading(false);
      if (activeThreadAudio === audio) {
        activeThreadAudio = null;
      }
      audio.removeEventListener("loadedmetadata", sync);
      audio.removeEventListener("durationchange", sync);
      audio.removeEventListener("timeupdate", sync);
      audio.removeEventListener("pause", handlePause);
      audio.removeEventListener("play", sync);
      audio.removeEventListener("playing", handlePlaying);
      audio.removeEventListener("waiting", handleWaiting);
      audio.removeEventListener("stalled", handleWaiting);
      audio.removeEventListener("error", handleError);
      audio.removeEventListener("ended", handleEnded);
    };
  }, [durationSeconds, resolvedUri]);

  useEffect(() => {
    setRetryWithFreshUri(false);
  }, [uri]);

  const totalDuration = resolvedDuration > 0 ? resolvedDuration : durationSeconds ?? 0;
  const progress = totalDuration > 0 ? Math.min(1, currentTime / totalDuration) : 0;
  const activeBars = Math.max(1, Math.round(progress * AUDIO_WAVE_PATTERN.length));

  const togglePlayback = async () => {
    const audio = audioRef.current;
    if (!audio) return;

    if (audio.paused || audio.ended) {
      try {
        if (activeThreadAudio && activeThreadAudio !== audio) {
          activeThreadAudio.pause();
          activeThreadAudio.currentTime = 0;
        }
        if (audio.ended || audio.currentTime >= (audio.duration || totalDuration || 0)) {
          audio.currentTime = 0;
        }
        activeThreadAudio = audio;
        setIsLoading(true);
        audio.load();
        await waitForAudioReady(audio);
        await audio.play();
      } catch {
        setIsLoading(false);
        setIsPlaying(false);
      }
      return;
    }

    audio.pause();
    setIsLoading(false);
    if (activeThreadAudio === audio) {
      activeThreadAudio = null;
    }
  };

  return (
    <div className={`message-audio-card ${from} ${isPlaying ? "is-playing" : ""} ${className ?? ""}`.trim()}>
      <button
        aria-label={isLoading ? "语音加载中" : isPlaying ? "暂停语音" : "播放语音"}
        className="message-audio-play"
        disabled={isLoading}
        onClick={() => void togglePlayback()}
        type="button"
      >
        {isLoading ? <span aria-hidden="true" className="message-audio-play-spinner" /> : <MessageControlIcon className="message-audio-play-icon" kind={isPlaying ? "pause" : "play"} />}
      </button>
      <div className="message-audio-body">
        <div className="message-audio-head">
          <div className="message-audio-meta">
            <ComposerSvgIcon className="message-audio-icon" kind="mic" />
            <span>语音消息</span>
          </div>
          <span className="message-audio-progress">{formatDuration(currentTime)} / {formatDuration(totalDuration)}</span>
        </div>
        <div className="message-audio-wave" aria-hidden="true">
          {AUDIO_WAVE_PATTERN.map((bar, index) => (
            <span
              key={`audio-wave-${index}`}
              className={`message-audio-wave-bar ${index < activeBars ? "is-active" : ""}`}
              style={{ "--wave-scale": `${bar}` } as CSSProperties}
            />
          ))}
        </div>
      </div>
      <audio
        className="message-audio-player"
        preload="metadata"
        ref={audioRef}
        src={resolvedUri}
        onError={() => {
          setIsLoading(false);
          if (!retryWithFreshUri) {
            forgetStableResourceUri(uri);
            setRetryWithFreshUri(true);
            return;
          }
          setIsPlaying(false);
        }}
      />
    </div>
  );
});

let activeThreadAudio: HTMLAudioElement | null = null;

function messageKindFromType(type: number): MessageKind {
  if (type === MESSAGE_TYPE_IMAGE) return "image";
  if (type === MESSAGE_TYPE_FILE) return "file";
  if (type === MESSAGE_TYPE_VIDEO) return "video";
  if (type === MESSAGE_TYPE_AUDIO) return "audio";
  if (type === MESSAGE_TYPE_SYSTEM) return "system";
  return "text";
}

function messageTypeFromKind(kind: MessageMediaKind) {
  return kind === "image" ? MESSAGE_TYPE_IMAGE : kind === "video" ? MESSAGE_TYPE_VIDEO : MESSAGE_TYPE_AUDIO;
}

function isMediaMessageKind(kind: MessageKind) {
  return kind === "image" || kind === "video" || kind === "audio";
}

function formatThreadDivider(value: number) {
  const date = new Date(value * 1000);
  const now = new Date();
  const isSameDay = date.toDateString() === now.toDateString();

  if (isSameDay) return formatTime(value);

  return new Intl.DateTimeFormat("zh-CN", {
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function formatChatListTime(value: number) {
  const date = new Date(value * 1000);
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  const minutes = Math.max(1, Math.floor(diff / 60000));

  if (minutes < 60) return formatRelativeTime(value);

  const sameDay = date.toDateString() === now.toDateString();
  if (sameDay) {
    return `${Math.floor(minutes / 60)} 小时前`;
  }
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  if (date.toDateString() === yesterday.toDateString()) return "昨天";
  return new Intl.DateTimeFormat("zh-CN", { month: "numeric", day: "numeric" }).format(date);
}

function formatPresence(user: UserDTO | null) {
  if (!user) return "暂无状态";
  if (user.is_alive) return "在线";

  const minutes = Math.floor(Date.now() / 1000 - user.last_heartbeat) / 60;
  if (minutes < 30) return "刚刚活跃";
  return "离线";
}

function mapChatMessage(message: ChatMessageDTO, currentUserId: number): ChatMessage {
  const kind = message.payload?.kind ?? messageKindFromType(message.type);
  return {
    id: message.message_id,
    clientId: `server:${message.message_id}`,
    from: message.user.user_id === currentUserId ? "self" : "other",
    type: message.type,
    kind,
    name: message.user.name,
    avatarUri: message.user.avatar_uri,
    time: formatTime(message.created_at),
    createdAt: message.created_at,
    text: message.content,
    payload: message.payload ?? (kind === "text" ? { kind: "text", text: message.content } : null),
    status: "sent",
  };
}

function sortMessages(items: ChatMessage[]) {
  return [...items].sort((left, right) => {
    if (left.createdAt !== right.createdAt) return left.createdAt - right.createdAt;

    const leftId = typeof left.id === "number" ? left.id : Number.MAX_SAFE_INTEGER;
    const rightId = typeof right.id === "number" ? right.id : Number.MAX_SAFE_INTEGER;
    return leftId - rightId;
  });
}

function isOptimisticSelfMatch(source: ChatMessage, target: ChatMessage) {
  return (
    source.from === "self" &&
    target.from === "self" &&
    source.kind === "text" &&
    target.kind === "text" &&
    source.status !== "sent" &&
    target.status === "sent" &&
    source.text === target.text &&
    Math.abs(source.createdAt - target.createdAt) <= 30
  );
}

function preserveStableMediaUri(existing: ChatMessage | undefined, incoming: ChatMessage) {
  if (!existing || !existing.payload?.uri || !incoming.payload?.uri) return incoming;
  if (!isMediaMessageKind(existing.kind) || !isMediaMessageKind(incoming.kind)) return incoming;
  if (existing.kind !== incoming.kind) return incoming;

  const existingResource = normalizeStableResourceUri(existing.payload.uri);
  const incomingResource = normalizeStableResourceUri(incoming.payload.uri);
  if (!existingResource || existingResource !== incomingResource) return incoming;
  if (existing.payload.uri === incoming.payload.uri) return incoming;

  return {
    ...incoming,
    payload: {
      ...incoming.payload,
      uri: existing.payload.uri,
    },
  };
}

function mergeMessages(current: ChatMessage[], incoming: ChatMessage[]) {
  const bucket = new Map<number | string, ChatMessage>();

  current.forEach((message) => bucket.set(message.id, message));
  incoming.forEach((message) => {
    const existingByClientId = [...bucket.values()].find((existing) => existing.clientId === message.clientId);
    if (existingByClientId && existingByClientId.id !== message.id) {
      bucket.delete(existingByClientId.id);
    }

    if (message.status === "sent") {
      const optimisticMatch = [...bucket.values()].find((existing) => isOptimisticSelfMatch(existing, message));
      if (optimisticMatch) {
        bucket.delete(optimisticMatch.id);
      }
    }

    if (message.status !== "sent") {
      const deliveredMatch = [...bucket.values()].find((existing) => isOptimisticSelfMatch(message, existing));
      if (deliveredMatch) return;
    }

    const existingMessage = bucket.get(message.id);
    bucket.set(message.id, preserveStableMediaUri(existingMessage, message));
  });

  return sortMessages([...bucket.values()]);
}

function createPendingMessage(text: string, name: string): ChatMessage {
  const clientId = `temp:${Date.now()}:${Math.random().toString(36).slice(2, 8)}`;
  const createdAt = Math.floor(Date.now() / 1000);
  const linkUrl = extractFirstMessageUrl(text);
  return {
    id: clientId,
    clientId,
    from: "self",
    type: MESSAGE_TYPE_TEXT,
    kind: "text",
    name,
    time: formatTime(createdAt),
    createdAt,
    text,
    payload: { kind: "text", text, link_preview: linkUrl ? { url: linkUrl, status: "pending" } : null },
    status: "pending",
  };
}

function updateMessageStatus(messages: ChatMessage[], clientId: string, status: ChatMessage["status"]) {
  return messages.map((message) => (message.clientId === clientId ? { ...message, status } : message));
}

function confirmPendingMessage(messages: ChatMessage[], clientId: string, delivered: ChatMessage) {
  let confirmed = false;
  const nextMessages = messages.map((message) => {
    if (message.clientId !== clientId) return message;
    confirmed = true;
    return {
      ...message,
      id: delivered.id,
      type: delivered.type,
      kind: delivered.kind,
      name: delivered.name,
      payload: delivered.payload,
      text: delivered.text,
      status: "sent" as const,
    };
  });

  return confirmed ? sortMessages(nextMessages) : mergeMessages(messages, [{ ...delivered, clientId }]);
}

function updateChatSummary(chat: Chat, preview: string, lastActivity: number) {
  return {
    ...chat,
    preview,
    time: "刚刚",
    lastActivity,
    unread: 0,
  };
}

function previewFromKind(kind: MessageKind, text: string) {
  if (kind === "image") return "[图片]";
  if (kind === "video") return "[视频]";
  if (kind === "audio") return "[语音]";
  if (kind === "file") return "[文件]";
  return text || "暂无消息";
}

function previewFromMessage(message: Pick<ChatMessage, "kind" | "text">) {
  return previewFromKind(message.kind, message.text);
}

function previewFromDto(message: ChatMessageDTO | null) {
  if (!message) return "暂无消息";
  const kind = message.payload?.kind ?? messageKindFromType(message.type);
  return previewFromKind(kind, message.content);
}

function clearChatUnread(chat: Chat) {
  if (chat.unread === 0) return chat;
  return {
    ...chat,
    unread: 0,
  };
}

function shouldGroupMessages(current: ChatMessage, neighbor?: ChatMessage) {
  if (!neighbor) return false;
  return current.from === neighbor.from && Math.abs(current.createdAt - neighbor.createdAt) < 5 * 60;
}

function shouldShowThreadDivider(current: ChatMessage, previous?: ChatMessage) {
  if (!previous) return true;

  const currentDate = new Date(current.createdAt * 1000);
  const previousDate = new Date(previous.createdAt * 1000);
  if (currentDate.toDateString() !== previousDate.toDateString()) return true;

  return Math.abs(current.createdAt - previous.createdAt) >= 10 * 60;
}

const MessageMediaImage = memo(function MessageMediaImage({
  groupClassName,
  onOpenImage,
  thumbnailUri,
  uri,
}: {
  groupClassName: string;
  onOpenImage?: (uri: string) => void;
  thumbnailUri?: string;
  uri: string;
}) {
  const [loaded, setLoaded] = useState(false);
  const [retryWithFreshUri, setRetryWithFreshUri] = useState(false);
  const imageRef = useRef<HTMLImageElement | null>(null);
  const resolvedUri = retryWithFreshUri ? uri : resolveStableResourceUri(uri) ?? uri;
  const resolvedThumbnailUri = resolveStableResourceUri(thumbnailUri) ?? thumbnailUri;

  useEffect(() => {
    setLoaded(false);
    setRetryWithFreshUri(false);
  }, [uri]);

  useEffect(() => {
    if (imageRef.current?.complete) {
      setLoaded(true);
    }
  }, [resolvedUri]);

  return (
    <button
      className={`message-media-frame image-button ${groupClassName} ${loaded ? "is-loaded" : "is-loading"}`.trim()}
      onClick={() => onOpenImage?.(resolvedUri)}
      type="button"
    >
      {resolvedThumbnailUri ? <img alt="" aria-hidden="true" className="message-media-image message-media-image-thumb" src={resolvedThumbnailUri} /> : null}
      <img
        alt="图片消息"
        className="message-media-image message-media-image-main"
        loading="lazy"
        ref={imageRef}
        src={resolvedUri}
        onLoad={() => setLoaded(true)}
        onError={() => {
          if (!retryWithFreshUri) {
            forgetStableResourceUri(uri);
            setRetryWithFreshUri(true);
            return;
          }
          setLoaded(true);
        }}
      />
    </button>
  );
});

function LinkedMessageText({ hiddenUrl, text }: { hiddenUrl?: string; text: string }) {
  const parts: Array<{ key: string; text: string; href?: string }> = [];
  let lastIndex = 0;
  const normalizedHiddenUrl = hiddenUrl ? normalizeMessageUrl(hiddenUrl) : null;

  TEXT_URL_RE.lastIndex = 0;
  Array.from(text.matchAll(TEXT_URL_RE)).forEach((match, index) => {
    const rawUrl = match[0];
    const start = match.index ?? 0;
    const url = normalizeMessageUrl(rawUrl);
    const urlEnd = start + url.length;
    if (start > lastIndex) {
      parts.push({ key: `text:${index}:${lastIndex}`, text: text.slice(lastIndex, start) });
    }
    if (url !== normalizedHiddenUrl) {
      parts.push({ key: `url:${index}:${start}`, text: url, href: url });
    }
    lastIndex = Math.max(urlEnd, start + rawUrl.length);
  });
  TEXT_URL_RE.lastIndex = 0;

  if (lastIndex < text.length) {
    parts.push({ key: `text:end:${lastIndex}`, text: text.slice(lastIndex) });
  }

  if (parts.length === 0) return <span className="message-text">{text}</span>;

  return (
    <span className="message-text">
      {parts.map((part) =>
        part.href ? (
          <a
            key={part.key}
            className="message-text-link"
            href={part.href}
            onClick={(event) => event.stopPropagation()}
            rel="noreferrer"
            target="_blank"
          >
            {part.text}
          </a>
        ) : (
          <span key={part.key}>{part.text}</span>
        )
      )}
    </span>
  );
}

const MessageLinkPreviewCard = memo(function MessageLinkPreviewCard({ messageId, preview }: { messageId: number | string; preview?: LinkPreviewDTO | null }) {
  const [currentPreview, setCurrentPreview] = useState<LinkPreviewDTO | null>(preview ?? null);
  const previewUrl = currentPreview?.url || preview?.url || "";
  const isPollable = typeof messageId === "number" && (currentPreview?.status ?? preview?.status) === "pending";

  useEffect(() => {
    setCurrentPreview(preview ?? null);
  }, [preview?.url, preview?.status, preview?.title, preview?.description, preview?.image_url, preview?.site_name]);

  useEffect(() => {
    if (!isPollable) return;

    let cancelled = false;
    let attempts = 0;
    let timer: number | null = null;

    const poll = async () => {
      attempts += 1;
      try {
        const nextPreview = await api.getMessageLinkPreview(messageId);
        if (cancelled) return;
        setCurrentPreview(nextPreview);
        if (nextPreview.status !== "pending" || attempts >= 12) return;
      } catch {
        if (cancelled || attempts >= 12) return;
      }
      timer = window.setTimeout(poll, 2000);
    };

    timer = window.setTimeout(poll, 900);
    return () => {
      cancelled = true;
      if (timer !== null) window.clearTimeout(timer);
    };
  }, [isPollable, messageId]);

  if (!currentPreview || currentPreview.status === "none") return null;
  if (currentPreview.status === "failed") return null;

  if (currentPreview.status === "pending") {
    return (
      <div className="message-link-preview-card is-loading" aria-label="正在生成链接预览">
        <div className="message-link-preview-text">
          <span className="message-link-preview-site">{hostnameFromUrl(previewUrl) || "链接预览"}</span>
          <span className="message-link-preview-title shimmer-line" />
          <span className="message-link-preview-desc shimmer-line short" />
        </div>
        <div className="message-link-preview-image shimmer-block" />
      </div>
    );
  }

  const title = currentPreview.title || hostnameFromUrl(currentPreview.url || "") || currentPreview.url || "链接";
  const siteName = currentPreview.site_name || hostnameFromUrl(currentPreview.url || "");

  return (
    <a
      className={`message-link-preview-card ${currentPreview.image_url ? "has-image" : "no-image"}`}
      href={currentPreview.url}
      onClick={(event) => event.stopPropagation()}
      rel="noreferrer"
      target="_blank"
    >
      <div className="message-link-preview-text">
        {siteName ? <span className="message-link-preview-site">{siteName}</span> : null}
        <strong className="message-link-preview-title">{title}</strong>
        {currentPreview.description ? <span className="message-link-preview-desc">{currentPreview.description}</span> : null}
      </div>
      {currentPreview.image_url ? <img alt="" className="message-link-preview-image" loading="lazy" src={currentPreview.image_url} /> : null}
    </a>
  );
});

function renderMessageContent(message: ChatMessage, onOpenImage: ((uri: string) => void) | undefined, groupClassName: string) {
  if (message.kind === "image" && message.payload?.uri) {
    return <MessageMediaImage groupClassName={groupClassName} onOpenImage={onOpenImage} thumbnailUri={message.payload.thumbnail_uri} uri={message.payload.uri} />;
  }

  if (message.kind === "video" && message.payload?.uri) {
    const resolvedUri = resolveStableResourceUri(message.payload.uri) ?? message.payload.uri;
    return (
      <div className={`message-media-frame video ${groupClassName}`.trim()}>
        <video className="message-media-video" controls playsInline preload="metadata" src={resolvedUri} />
      </div>
    );
  }

  if (message.kind === "audio" && message.payload?.uri) {
    return <AudioMessagePlayer className={groupClassName} durationSeconds={message.payload.duration_seconds} from={message.from} uri={message.payload.uri} />;
  }

  const linkPreview = message.payload?.link_preview;
  const hasLinkPreview = Boolean(linkPreview && linkPreview.status !== "none" && linkPreview.status !== "failed");
  const text = message.payload?.text ?? message.text;
  if (!hasLinkPreview) {
    return <LinkedMessageText text={text} />;
  }

  const previewUrl = linkPreview?.url ?? extractFirstMessageUrl(text) ?? undefined;
  const hasTextBesidePreview = hasMeaningfulTextOutsidePreviewUrl(text, previewUrl);

  return (
    <span className={`message-text-stack has-link-preview ${groupClassName}`.trim()}>
      {hasTextBesidePreview ? (
        <span className={`message-text-chip ${message.from}`}>
          <LinkedMessageText hiddenUrl={previewUrl} text={text} />
        </span>
      ) : null}
      <MessageLinkPreviewCard messageId={message.id} preview={linkPreview} />
    </span>
  );
}

function groupRenderSignature(group: MessageGroup, enteringMessageIds: string[]) {
  const entering = group.messages.filter((message) => enteringMessageIds.includes(message.clientId)).map((message) => message.clientId);
  return JSON.stringify({
    key: group.key,
    dividerLabel: group.dividerLabel,
    messages: group.messages.map((message) => ({
      clientId: message.clientId,
      status: message.status,
      text: message.text,
      linkPreview: message.payload?.link_preview
        ? {
            status: message.payload.link_preview.status,
            title: message.payload.link_preview.title,
            imageUrl: message.payload.link_preview.image_url,
          }
        : null,
    })),
    entering,
  });
}

const MessageBubbleRow = memo(function MessageBubbleRow({
  from,
  isEntering,
  isFirst,
  isLast,
  message,
  onOpenImage,
  onOpenActions,
  onRetry,
}: MessageBubbleRowProps) {
  const showRetry = from === "self" && message.status === "failed" && message.kind === "text";
  const canOpenActions = message.status === "sent";
  const bubbleRef = useRef<HTMLDivElement | null>(null);
  const longPressTimerRef = useRef<number | null>(null);
  const pointerStartRef = useRef<{ x: number; y: number } | null>(null);

  const clearLongPress = () => {
    if (longPressTimerRef.current !== null) {
      window.clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
    pointerStartRef.current = null;
  };

  useEffect(() => clearLongPress, []);

  const openActions = () => {
    clearLongPress();
    if (!canOpenActions || !bubbleRef.current) return;
    onOpenActions(message, bubbleRef.current);
  };

  const handlePointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!canOpenActions) return;
    if (event.pointerType === "mouse" && event.button !== 0) return;
    clearLongPress();
    pointerStartRef.current = { x: event.clientX, y: event.clientY };
    longPressTimerRef.current = window.setTimeout(openActions, 380);
  };

  const handlePointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!pointerStartRef.current) return;
    const deltaX = Math.abs(event.clientX - pointerStartRef.current.x);
    const deltaY = Math.abs(event.clientY - pointerStartRef.current.y);
    if (deltaX > 8 || deltaY > 8) clearLongPress();
  };

  const groupClassName = [
    from === "self" ? "self" : "other",
    isFirst ? "group-start" : "",
    isLast ? "group-end" : "",
    message.status !== "sent" ? `is-${message.status}` : "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div className={`message-bubble-wrap ${from} ${message.status !== "sent" ? `is-${message.status}` : "is-sent"} ${isEntering ? "is-entering" : ""}`}>
      <div className={`message-bubble-shell ${from}`}>
        {showRetry ? (
          <button aria-label="重试发送" className="message-retry-icon" onClick={() => void onRetry(message)} type="button">
            <span className="material-symbols-outlined">refresh</span>
          </button>
        ) : null}
        <div
          ref={bubbleRef}
          className={[
            "message-bubble",
            from === "self" ? "self" : "other",
            isMediaMessageKind(message.kind) ? "is-media" : "",
            message.payload?.link_preview && message.payload.link_preview.status !== "none" && message.payload.link_preview.status !== "failed" ? "is-link-preview" : "",
            message.status !== "sent" ? `is-${message.status}` : "",
            isFirst ? "group-start" : "",
            isLast ? "group-end" : "",
            canOpenActions ? "message-bubble-actionable" : "",
          ]
            .filter(Boolean)
            .join(" ")}
          onContextMenu={
            canOpenActions
              ? (event) => {
                  event.preventDefault();
                  openActions();
                }
              : undefined
          }
          onPointerCancel={clearLongPress}
          onPointerDown={canOpenActions ? handlePointerDown : undefined}
          onPointerLeave={clearLongPress}
          onPointerMove={canOpenActions ? handlePointerMove : undefined}
          onPointerUp={clearLongPress}
        >
          {renderMessageContent(message, onOpenImage, groupClassName)}
        </div>
      </div>
    </div>
  );
});

const MessageGroupBlock = memo(function MessageGroupBlock({ enteringMessageIds, group, onOpenImage, onOpenActions, onRetry, showAuthor }: MessageGroupBlockProps) {
  return (
    <div>
      {group.dividerLabel ? <div className="day-divider">{group.dividerLabel}</div> : null}
      <div className={`message-group ${group.from}`}>
        {group.from === "other" ? <UserAvatar className="avatar message-avatar" name={group.name} uri={group.avatarUri} /> : null}
        <div className="message-bubbles">
          {group.from === "other" && showAuthor ? <div className="message-author-name">{group.name}</div> : null}
          {group.messages.map((message, index) => (
            <MessageBubbleRow
              key={message.clientId}
              from={group.from}
              isEntering={enteringMessageIds.includes(message.clientId)}
              isFirst={index === 0}
              isLast={index === group.messages.length - 1}
              message={message}
              onOpenImage={onOpenImage}
              onOpenActions={onOpenActions}
              onRetry={onRetry}
            />
          ))}
        </div>
      </div>
    </div>
  );
}, (prev, next) => prev.showAuthor === next.showAuthor && groupRenderSignature(prev.group, prev.enteringMessageIds) === groupRenderSignature(next.group, next.enteringMessageIds));

interface MessageGroup {
  key: string;
  from: "self" | "other";
  name: string;
  avatarUri?: string;
  dividerLabel?: string;
  messages: ChatMessage[];
}

interface MessageBubbleRowProps {
  from: "self" | "other";
  isEntering: boolean;
  isFirst: boolean;
  isLast: boolean;
  message: ChatMessage;
  onOpenImage: (uri: string) => void;
  onOpenActions: (message: ChatMessage, element: HTMLDivElement) => void;
  onRetry: (message: ChatMessage) => void;
}

interface MessageGroupBlockProps {
  enteringMessageIds: string[];
  group: MessageGroup;
  onOpenImage: (uri: string) => void;
  onOpenActions: (message: ChatMessage, element: HTMLDivElement) => void;
  onRetry: (message: ChatMessage) => void;
  showAuthor: boolean;
}

interface MessageMenuState {
  message: ChatMessage;
  anchorX: number;
  anchorY: number;
  placement: "top" | "bottom";
  confirmDelete: boolean;
}

type VoiceComposerPhase = "idle" | "recording" | "stopping" | "recorded" | "sending";

interface VoiceComposerState {
  open: boolean;
  phase: VoiceComposerPhase;
  durationSeconds: number;
  bars: number[];
  blob: Blob | null;
  mimeType: string;
}

function getDirectPeer(chat: ChatDTO, currentUserId: number) {
  return chat.members.find((member) => member.user_id !== currentUserId) ?? chat.members[0] ?? null;
}

function sortChatDetailMembers(
  members: Array<{
    userId: number;
    name: string;
    avatarUri?: string;
    isSelf: boolean;
    isOwner: boolean;
  }>
) {
  return [...members].sort((left, right) => {
    if (left.isOwner !== right.isOwner) return left.isOwner ? -1 : 1;
    if (left.isSelf !== right.isSelf) return left.isSelf ? -1 : 1;
    return left.name.localeCompare(right.name, "zh-CN");
  });
}

function mapChat(chat: ChatDTO, currentUserId: number): Chat {
  const peer = chat.group ? null : getDirectPeer(chat, currentUserId);
  const title = chat.title || peer?.name || "未命名会话";
  const presence = formatPresence(peer);
  const isOwner = Boolean(chat.group && chat.owner?.user_id === currentUserId);
  const lastActivity = chat.last_message?.created_at ?? chat.last_chat_at;

  return {
    id: chat.chat_id,
    title,
    avatarUri: peer?.avatar_uri,
    subtitle: chat.group ? `${chat.members.length} 人` : presence,
    preview: previewFromDto(chat.last_message),
    time: formatChatListTime(lastActivity),
    lastActivity,
    unread: chat.unread_count ?? 0,
    online: chat.group ? false : Boolean(peer?.is_alive),
    verified: Boolean(peer?.verified),
    members: chat.members.length,
    type: chat.group ? "group" : "direct",
    isOwner,
    pinned: Boolean(chat.pinned),
    onlineReminderEnabled: Boolean(chat.online_reminder_enabled),
    detail: {
      summary: chat.group ? "围绕同一主题的讨论会集中在这里。" : "先聊两句，再决定要不要进一步建立关系。",
      relation: chat.group ? (isOwner ? "你是群主" : "你已加入该群聊") : "一对一会话",
      actions: chat.group ? (isOwner ? ["邀请成员", "解散群聊"] : ["退出群聊"]) : ["发起好友申请", "静音通知"],
      members: sortChatDetailMembers(
        chat.members.map((member) => ({
          userId: member.user_id,
          name: member.name,
          avatarUri: member.avatar_uri,
          isSelf: member.user_id === currentUserId,
          isOwner: Boolean(chat.owner?.user_id === member.user_id),
        }))
      ),
    },
    messages: [],
  };
}

function sortChats(items: Chat[]) {
  return [...items].sort((left, right) => Number(right.pinned) - Number(left.pinned) || right.lastActivity - left.lastActivity);
}

function scrollThreadToBottom(element: HTMLDivElement | null) {
  if (!element) return;

  requestAnimationFrame(() => {
    const target = element;
    target.scrollTop = target.scrollHeight;
  });
}

function animateThreadScroll(element: HTMLDivElement, targetTop: number, duration = 220) {
  const startTop = element.scrollTop;
  const distance = targetTop - startTop;
  if (Math.abs(distance) < 1) {
    element.scrollTop = targetTop;
    return () => {};
  }

  let frameId = 0;
  const startAt = performance.now();
  const easeOutCubic = (value: number) => 1 - (1 - value) ** 3;

  const tick = (now: number) => {
    const progress = Math.min(1, (now - startAt) / duration);
    element.scrollTop = startTop + distance * easeOutCubic(progress);
    if (progress < 1) {
      frameId = requestAnimationFrame(tick);
    }
  };

  frameId = requestAnimationFrame(tick);
  return () => cancelAnimationFrame(frameId);
}

function isNearThreadBottom(element: HTMLDivElement | null, threshold = 72) {
  if (!element) return true;
  return element.scrollHeight - element.scrollTop - element.clientHeight <= threshold;
}

function filterUsersByName(rows: UserDTO[], query: string) {
  const normalized = query.trim().toLowerCase();
  if (!normalized) return rows;
  return rows.filter((user) => user.name.toLowerCase().includes(normalized));
}

function isChatAccessBoundaryError(error: unknown) {
  return error instanceof ApiError && (error.status === 403 || error.status === 404);
}

function chatAccessBoundaryMessage(error: unknown) {
  if (error instanceof ApiError && error.message) return error.message;
  return "这个会话不存在，或者你没有访问权限。";
}

export default function ChatsPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { chatId } = useParams();
  const { session } = useAuth();
  const groupSquareEnabled = useGroupSquareEnabled();
  const [query, setQuery] = useState("");
  const [draft, setDraft] = useState("");
  const [detailsSheetOpen, setDetailsSheetOpen] = useState(false);
  const [profileDrawerUserId, setProfileDrawerUserId] = useState<number | null>(null);
  const [preferenceSaving, setPreferenceSaving] = useState<"pin" | "online" | null>(null);
  const [groupCreateOpen, setGroupCreateOpen] = useState(false);
  const [chatMemberPickerOpen, setChatMemberPickerOpen] = useState(false);
  const [composerMoreOpen, setComposerMoreOpen] = useState(false);
  const [viewState, setViewState] = useState<AppViewState>("idle");
  const [pageError, setPageError] = useState<string | null>(null);
  const [statusModal, setStatusModal] = useState<{
    open: boolean;
    phase: "loading" | "success" | "error";
    loadingLabel: string;
    successLabel: string;
    errorLabel: string;
  } | null>(null);
  const [sendState, setSendState] = useState<"idle" | "sending">("idle");
  const [groupCreateState, setGroupCreateState] = useState<"idle" | "loading-users" | "creating">("idle");
  const [chats, setChats] = useState<Chat[]>([]);
  const [messages, setMessages] = useState<Record<number, ChatMessage[]>>({});
  const [hasOlderMessages, setHasOlderMessages] = useState(false);
  const [olderState, setOlderState] = useState<"idle" | "loading">("idle");
  const [enteringMessageIds, setEnteringMessageIds] = useState<string[]>([]);
  const [messageMenu, setMessageMenu] = useState<MessageMenuState | null>(null);
  const [messageDeleteState, setMessageDeleteState] = useState<"idle" | "deleting">("idle");
  const [closingChatSnapshot, setClosingChatSnapshot] = useState<Chat | null>(null);
  const [isClosingChatView, setIsClosingChatView] = useState(false);
  const [groupTitle, setGroupTitle] = useState("");
  const [groupQuery, setGroupQuery] = useState("");
  const [groupCandidates, setGroupCandidates] = useState<UserDTO[]>([]);
  const [groupFriendPool, setGroupFriendPool] = useState<UserDTO[]>([]);
  const [groupSelectedIds, setGroupSelectedIds] = useState<number[]>([]);
  const [chatMemberLockedIds, setChatMemberLockedIds] = useState<number[]>([]);
  const [groupRenameOpen, setGroupRenameOpen] = useState(false);
  const [groupRenameValue, setGroupRenameValue] = useState("");
  const [groupManageState, setGroupManageState] = useState<"idle" | "saving" | "loading-candidates">("idle");
  const [currentUserVerified, setCurrentUserVerified] = useState<boolean | null>(null);
  const [detailMemberLimit, setDetailMemberLimit] = useState(CHAT_DETAIL_MEMBER_PAGE_SIZE);
  const [groupDangerConfirmOpen, setGroupDangerConfirmOpen] = useState(false);
  const [friendDangerConfirmOpen, setFriendDangerConfirmOpen] = useState(false);
  const [voiceComposer, setVoiceComposer] = useState<VoiceComposerState>({
    open: false,
    phase: "idle",
    durationSeconds: 0,
    bars: Array.from({ length: 24 }, () => 0.28),
    blob: null,
    mimeType: "",
  });
  const [imagePreviewUri, setImagePreviewUri] = useState<string | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const composerRef = useRef<HTMLFormElement | null>(null);
  const mediaInputRef = useRef<HTMLInputElement | null>(null);
  const messageScrollRef = useRef<HTMLDivElement | null>(null);
  const chatLayoutRef = useRef<HTMLElement | null>(null);
  const chatMainPaneRef = useRef<HTMLElement | null>(null);
  const initialScrollDoneRef = useRef<number | null>(null);
  const stickToBottomRef = useRef(true);
  const pendingRevealRef = useRef<{ chatId: number; previousHeight: number; previousScrollTop: number } | null>(null);
  const cancelScrollAnimationRef = useRef<(() => void) | null>(null);
  const revealAnimatingRef = useRef(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const waveformFrameRef = useRef<number | null>(null);
  const recordingTimerRef = useRef<number | null>(null);
  const recordingChunksRef = useRef<Blob[]>([]);
  const recordingCancelledRef = useRef(false);
  const recordingStopRequestedRef = useRef(false);
  const isComposingRef = useRef(false);
  const [composerHeight, setComposerHeight] = useState(80);
  const [keyboardOffset, setKeyboardOffset] = useState(0);
  const currentUserId = session?.user.user_id ?? 0;
  const currentUserName = session?.user.name ?? "我";
  const cacheScope = session ? buildChatCacheScope(session.user.space_id, session.user.user_id) : null;
  const composerBusy = sendState === "sending" || voiceComposer.phase === "sending" || voiceComposer.phase === "stopping";
  const routeState = location.state as ChatRouteState | null;
  const chatAccessNotice = routeState?.chatAccessError ?? null;

  const cleanupRecordingResources = () => {
    if (waveformFrameRef.current) {
      cancelAnimationFrame(waveformFrameRef.current);
      waveformFrameRef.current = null;
    }
    if (recordingTimerRef.current) {
      window.clearInterval(recordingTimerRef.current);
      recordingTimerRef.current = null;
    }
    analyserRef.current?.disconnect();
    analyserRef.current = null;
    audioContextRef.current?.close().catch(() => undefined);
    audioContextRef.current = null;
    mediaStreamRef.current?.getTracks().forEach((track) => track.stop());
    mediaStreamRef.current = null;
    mediaRecorderRef.current = null;
  };

  const resetVoiceComposer = () => {
    recordingCancelledRef.current = false;
    recordingStopRequestedRef.current = false;
    cleanupRecordingResources();
    recordingChunksRef.current = [];
    setVoiceComposer({
      open: false,
      phase: "idle",
      durationSeconds: 0,
      bars: Array.from({ length: 24 }, () => 0.28),
      blob: null,
      mimeType: "",
    });
  };

  const triggerMessageEntrance = (messageId: number | string) => {
    const key = String(messageId);
    setEnteringMessageIds((current) => (current.includes(key) ? current : [...current, key]));
    window.setTimeout(() => {
      setEnteringMessageIds((current) => current.filter((item) => item !== key));
    }, 260);
  };

  const queueThreadReveal = (chatId: number) => {
    const element = messageScrollRef.current;
    if (!element) return;
    revealAnimatingRef.current = true;
    pendingRevealRef.current = {
      chatId,
      previousHeight: element.scrollHeight,
      previousScrollTop: element.scrollTop,
    };
  };

  const closeMessageMenu = () => {
    if (messageDeleteState === "deleting") return;
    setMessageMenu(null);
  };

  const openMessageMenu = (message: ChatMessage, element: HTMLDivElement) => {
    const rect = element.getBoundingClientRect();
    const placement: "top" | "bottom" = rect.top > 96 ? "top" : "bottom";
    setMessageMenu({
      message,
      anchorX: rect.left + rect.width / 2,
      anchorY: placement === "top" ? rect.top - 10 : rect.bottom + 10,
      placement,
      confirmDelete: false,
    });
  };

  useEffect(() => {
    if (!cacheScope) return;
    const controller = new AbortController();
    let didLoadNetwork = false;
    setViewState("loading");
    setPageError(null);

    const memoryRecord = chatCache.getChatList(cacheScope);
    if (memoryRecord?.chats.length) {
      setChats(memoryRecord.chats);
      setViewState("ready");
    } else {
      void chatCache.hydrateChatList(cacheScope).then((cached) => {
        if (controller.signal.aborted || didLoadNetwork || !cached?.chats.length) return;
        setChats(cached.chats);
        setViewState("ready");
      });
    }

    api
      .getChats(controller.signal)
      .then((rows) => {
        didLoadNetwork = true;
        const nextChats = sortChats(rows.map((item) => mapChat(item, currentUserId)));
        setChats(nextChats);
        setViewState("ready");
        void chatCache.persistChatList(cacheScope, nextChats);
      })
      .catch((apiError) => {
        if (controller.signal.aborted) return;
        const message = apiError instanceof ApiError ? apiError.message : "加载会话失败";
        setPageError(message);
        setViewState("error");
      });

    return () => controller.abort();
  }, [cacheScope, currentUserId]);

  const selectedChat = useMemo(() => {
    const numericChatId = Number(chatId);
    if (!numericChatId) return null;
    return chats.find((chat) => chat.id === numericChatId) ?? null;
  }, [chatId, chats]);

  const displayedChat = selectedChat ?? (isClosingChatView ? closingChatSnapshot : null);
  const routeChatId = useMemo(() => {
    if (!chatId) return null;
    const numericChatId = Number(chatId);
    return Number.isInteger(numericChatId) && numericChatId > 0 ? numericChatId : null;
  }, [chatId]);
  const selectedMessages = useMemo(
    () => (displayedChat ? sortMessages(messages[displayedChat.id] ?? []) : []),
    [displayedChat, messages]
  );

  const redirectToChatListWithNotice = (message: string, blockedChatId?: number) => {
    setDetailsSheetOpen(false);
    setMessageMenu(null);
    setClosingChatSnapshot(null);
    setIsClosingChatView(false);
    setHasOlderMessages(false);
    setOlderState("idle");
    setPageError(null);

    if (blockedChatId) {
      setMessages((current) => {
        if (!(blockedChatId in current)) return current;
        const next = { ...current };
        delete next[blockedChatId];
        return next;
      });
      setChats((current) => {
        const next = current.filter((chat) => chat.id !== blockedChatId);
        if (next.length !== current.length && cacheScope) {
          void chatCache.persistChatList(cacheScope, next);
        }
        return next;
      });
    }

    navigate("/app/chats", {
      replace: true,
      state: {
        chatAccessError: message,
      },
    });
  };

  useEffect(() => {
    if (!chatId) return;
    if (!routeChatId) {
      redirectToChatListWithNotice("这个聊天链接格式不正确。");
      return;
    }
    if (selectedChat || viewState === "idle" || viewState === "loading") return;
    redirectToChatListWithNotice(pageError ?? "这个会话不存在，或者你没有访问权限。", routeChatId);
  }, [chatId, routeChatId, selectedChat, viewState, pageError]);

  useEffect(() => {
    if (!DEBUG_CHAT_SEND) return;
    console.log("[chat-close] location", location.pathname);
  }, [location.pathname]);

  useEffect(() => {
    if (selectedChat) {
      setClosingChatSnapshot(null);
      setIsClosingChatView(false);
    }
  }, [selectedChat]);

  useEffect(() => {
    return () => {
      resetVoiceComposer();
    };
  }, []);

  useEffect(() => {
    resetVoiceComposer();
  }, [selectedChat?.id]);

  useEffect(() => {
    if (!detailsSheetOpen) return;
    setDetailMemberLimit(CHAT_DETAIL_MEMBER_PAGE_SIZE);
  }, [detailsSheetOpen, selectedChat?.id]);

  useEffect(() => {
    return;
  }, []);

  useEffect(() => {
    if (!DEBUG_CHAT_SEND || !selectedChat) return;
    console.log("[chat] selectedMessages", {
      chatId: selectedChat.id,
      count: selectedMessages.length,
      items: selectedMessages.map((message) => ({
        id: message.id,
        clientId: message.clientId,
        status: message.status,
        text: message.text,
      })),
    });
  }, [selectedChat, selectedMessages]);

  const messageGroups = useMemo<MessageGroup[]>(() => {
    const groups: MessageGroup[] = [];

    selectedMessages.forEach((message, index) => {
      const previous = selectedMessages[index - 1];
      const dividerLabel = shouldShowThreadDivider(message, previous) ? formatThreadDivider(message.createdAt) : undefined;
      const lastGroup = groups[groups.length - 1];
      const canJoinLastGroup =
        lastGroup &&
        !dividerLabel &&
        shouldGroupMessages(message, lastGroup.messages[lastGroup.messages.length - 1]);

      if (canJoinLastGroup) {
        lastGroup.messages.push(message);
        return;
      }

      groups.push({
        key: message.clientId,
        from: message.from,
        name: message.name,
        avatarUri: message.avatarUri,
        dividerLabel,
        messages: [message],
      });
    });

    return groups;
  }, [selectedMessages]);

  const closeChatView = () => {
    if (!selectedChat) {
      if (DEBUG_CHAT_SEND) {
        console.log("[chat-close] no selectedChat, navigate immediately");
      }
      navigate("/app/chats");
      return;
    }

    if (DEBUG_CHAT_SEND) {
      console.log("[chat-close] start closing", {
        chatId: selectedChat.id,
      });
    }
    setDetailsSheetOpen(false);
    setMessageMenu(null);
    setClosingChatSnapshot(selectedChat);
    setIsClosingChatView(true);
  };

  useEffect(() => {
    if (!selectedChat || !cacheScope) return;
    const controller = new AbortController();
    let didLoadNetwork = false;
    setOlderState("idle");
    setHasOlderMessages(false);

    const restoreScroll = () => {
      requestAnimationFrame(() => {
        const element = messageScrollRef.current;
        if (!element) return;
        element.scrollTop = element.scrollHeight;
      });
    };

    const memoryThread = chatCache.getThread(cacheScope, selectedChat.id);
    if (memoryThread?.messages.length) {
      setMessages((current) => ({
        ...current,
        [selectedChat.id]: mergeMessages(current[selectedChat.id] ?? [], sortMessages(memoryThread.messages)),
      }));
      setHasOlderMessages(memoryThread.hasOlderMessages);
    } else {
      void chatCache.hydrateThread(cacheScope, selectedChat.id).then((cached) => {
        if (controller.signal.aborted || didLoadNetwork || !cached?.messages.length) return;
        setMessages((current) => ({
          ...current,
          [selectedChat.id]: mergeMessages(current[selectedChat.id] ?? [], sortMessages(cached.messages)),
        }));
        setHasOlderMessages(cached.hasOlderMessages);
      });
    }

    const loadLatestMessages = async () => {
      try {
        const rows = await api.getMessages(
          {
            chat_id: selectedChat.id,
            limit: 30,
          },
          controller.signal
        );
        const normalized = sortMessages(rows.map((row) => mapChatMessage(row, currentUserId)));
        const existingThread = chatCache.getThread(cacheScope, selectedChat.id);
        let mergedMessages = mergeMessages(existingThread?.messages ?? [], normalized);
        didLoadNetwork = true;
        if (DEBUG_CHAT_SEND) {
          console.log("[chat] loadLatestMessages response", {
            chatId: selectedChat.id,
            normalized: normalized.map((message) => ({
              id: message.id,
              clientId: message.clientId,
              status: message.status,
              text: message.text,
            })),
            cachedCount: existingThread?.messages.length ?? 0,
          });
        }
        setMessages((current) => {
          const currentThreadMessages = current[selectedChat.id] ?? [];
          mergedMessages = mergeMessages(currentThreadMessages, normalized);
          if (DEBUG_CHAT_SEND) {
            console.log("[chat] loadLatestMessages merge", {
              chatId: selectedChat.id,
              currentCount: currentThreadMessages.length,
              mergedCount: mergedMessages.length,
            });
          }
          return {
            ...current,
            [selectedChat.id]: mergedMessages,
          };
        });
        setHasOlderMessages(rows.length >= 30 || memoryThread?.hasOlderMessages || false);
        chatCache.setThread(cacheScope, selectedChat.id, {
          messages: mergedMessages,
          hasOlderMessages: rows.length >= 30 || memoryThread?.hasOlderMessages || false,
          scrollTop: memoryThread?.scrollTop ?? 0,
          updatedAt: Date.now(),
        });
        void chatCache.persistThread(cacheScope, selectedChat.id, {
          messages: mergedMessages,
          hasOlderMessages: rows.length >= 30 || memoryThread?.hasOlderMessages || false,
          scrollTop: memoryThread?.scrollTop ?? 0,
          updatedAt: Date.now(),
        });
        if (!memoryThread?.messages.length) restoreScroll();
        void api.markChatRead(selectedChat.id).then(() => {
          setChats((currentChats) => currentChats.map((chat) => (chat.id === selectedChat.id ? clearChatUnread(chat) : chat)));
        });
      } catch (apiError) {
        if (isChatAccessBoundaryError(apiError)) {
          redirectToChatListWithNotice(chatAccessBoundaryMessage(apiError), selectedChat.id);
          return;
        }
        if (!controller.signal.aborted) {
          const hasLocalMessages = Boolean((messages[selectedChat.id] ?? []).length || memoryThread?.messages.length);
          if (!hasLocalMessages) {
            const message = apiError instanceof ApiError ? apiError.message : "加载消息失败";
            setPageError(message);
          }
        }
      }
    };

    void loadLatestMessages();
    return () => {
      const element = messageScrollRef.current;
      chatCache.updateThreadScroll(cacheScope, selectedChat.id, element?.scrollTop ?? 0);
      controller.abort();
    };
  }, [cacheScope, currentUserId, selectedChat]);

  useEffect(() => {
    if (!selectedChat) {
      initialScrollDoneRef.current = null;
      stickToBottomRef.current = true;
      return;
    }

    if (!selectedMessages.length) return;
    if (initialScrollDoneRef.current === selectedChat.id) return;

    scrollThreadToBottom(messageScrollRef.current);
    initialScrollDoneRef.current = selectedChat.id;
    stickToBottomRef.current = true;
  }, [selectedChat, selectedMessages.length]);

  useEffect(() => {
    if (!selectedChat) return;
    setChats((currentChats) => currentChats.map((chat) => (chat.id === selectedChat.id ? clearChatUnread(chat) : chat)));
  }, [selectedChat]);

  useEffect(() => {
    return;
  }, [selectedChat]);

  useEffect(() => {
    setMessageMenu(null);
  }, [selectedChat?.id]);

  useEffect(() => {
    if (!messageMenu) return;

    const close = () => setMessageMenu(null);
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") close();
    };

    window.addEventListener("resize", close);
    window.addEventListener("scroll", close, true);
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("resize", close);
      window.removeEventListener("scroll", close, true);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [messageMenu]);

  useLayoutEffect(() => {
    if (!selectedChat) {
      pendingRevealRef.current = null;
      return;
    }

    const pendingReveal = pendingRevealRef.current;
    if (!pendingReveal || pendingReveal.chatId !== selectedChat.id) return;

    const element = messageScrollRef.current;
    pendingRevealRef.current = null;
    if (!element) {
      revealAnimatingRef.current = false;
      return;
    }

    const delta = element.scrollHeight - pendingReveal.previousHeight;
    const targetTop = Math.max(0, pendingReveal.previousScrollTop + delta);
    cancelScrollAnimationRef.current?.();
    if (DEBUG_CHAT_SEND) {
      console.log("[chat] reveal start", {
        chatId: selectedChat.id,
        previousHeight: pendingReveal.previousHeight,
        nextHeight: element.scrollHeight,
        previousScrollTop: pendingReveal.previousScrollTop,
        targetTop,
        delta,
      });
    }
    cancelScrollAnimationRef.current = animateThreadScroll(element, targetTop);
    window.setTimeout(() => {
      revealAnimatingRef.current = false;
    }, 240);
  }, [selectedChat, selectedMessages.length]);

  useEffect(() => {
    if (!selectedChat) return;
    if (!stickToBottomRef.current) return;
    if (revealAnimatingRef.current) return;

    scrollThreadToBottom(messageScrollRef.current);
  }, [composerHeight, keyboardOffset, selectedChat]);

  useEffect(() => {
    if (!selectedChat || !selectedMessages.length) return;
    if (!stickToBottomRef.current || revealAnimatingRef.current) return;
    scrollThreadToBottom(messageScrollRef.current);
  }, [selectedChat?.id, selectedMessages[selectedMessages.length - 1]?.clientId]);

  useEffect(() => {
    if (typeof document === "undefined") return;

    const shouldLockViewport = Boolean(selectedChat) && typeof window !== "undefined" && window.innerWidth <= 900;
    if (!shouldLockViewport) {
      delete document.body.dataset.chatDetail;
      return;
    }

    document.body.dataset.chatDetail = "true";

    return () => {
      delete document.body.dataset.chatDetail;
    };
  }, [selectedChat]);

  useEffect(() => {
    return () => {
      cancelScrollAnimationRef.current?.();
      revealAnimatingRef.current = false;
    };
  }, []);

  useEffect(() => {
    const handleSync = (event: Event) => {
      const detail = (event as CustomEvent<ChatSyncEventDetail>).detail;
      if (!detail?.items.length) return;

      const grouped = new Map<number, ChatSyncEventDetail["items"]>();
      detail.items.forEach((item) => {
        const bucket = grouped.get(item.chatId) ?? [];
        bucket.push(item);
        grouped.set(item.chatId, bucket);
      });

      const currentChatIncoming = selectedChat ? grouped.get(selectedChat.id) : undefined;
      const shouldRevealCurrentChat = Boolean(currentChatIncoming?.length) && isNearThreadBottom(messageScrollRef.current, 120);
      if (selectedChat && shouldRevealCurrentChat) {
        stickToBottomRef.current = true;
      }

      setMessages((current) => {
        const next = { ...current };
        for (const [chatId, items] of grouped) {
          next[chatId] = mergeMessages(current[chatId] ?? [], items.map((item) => item.message));
        }
        return next;
      });

      setChats((currentChats) =>
        sortChats(
          currentChats.map((chat) => {
            const incoming = grouped.get(chat.id);
            if (!incoming?.length) return chat;
            const newest = incoming[incoming.length - 1].message;
            const unreadIncrement = chat.id === selectedChat?.id ? 0 : incoming.filter((item) => item.message.from === "other").length;
            return {
              ...chat,
              preview: previewFromMessage(newest),
              time: formatChatListTime(newest.createdAt),
              lastActivity: newest.createdAt,
              unread: chat.id === selectedChat?.id ? 0 : chat.unread + unreadIncrement,
            };
          })
        )
      );

      if (!selectedChat) return;
      const selectedIncoming = grouped.get(selectedChat.id);
      if (!selectedIncoming?.length) return;

      if (selectedIncoming.some((item) => item.message.from === "other")) {
        void api.markChatRead(selectedChat.id).then(() => {
          setChats((currentChats) => currentChats.map((chat) => (chat.id === selectedChat.id ? clearChatUnread(chat) : chat)));
        });
      }
    };

    window.addEventListener(CHAT_SYNC_EVENT, handleSync as EventListener);
    return () => {
      window.removeEventListener(CHAT_SYNC_EVENT, handleSync as EventListener);
    };
  }, [selectedChat]);

  useEffect(() => {
    if (!cacheScope || !chats.length) return;
    chatCache.setChatList(cacheScope, chats);
    const timer = window.setTimeout(() => {
      void chatCache.persistChatList(cacheScope, chats);
    }, 180);

    return () => window.clearTimeout(timer);
  }, [cacheScope, chats]);

  useEffect(() => {
    if (!cacheScope || !selectedChat) return;

    const timer = window.setTimeout(() => {
      chatCache.setThread(cacheScope, selectedChat.id, {
        messages: selectedMessages,
        hasOlderMessages,
        scrollTop: messageScrollRef.current?.scrollTop ?? 0,
        updatedAt: Date.now(),
      });
      void chatCache.persistThread(cacheScope, selectedChat.id, {
        messages: selectedMessages,
        hasOlderMessages,
        scrollTop: messageScrollRef.current?.scrollTop ?? 0,
        updatedAt: Date.now(),
      });
    }, 180);

    return () => window.clearTimeout(timer);
  }, [cacheScope, hasOlderMessages, selectedChat, selectedMessages]);

  const filteredChats = chats.filter((chat) => chat.title.toLowerCase().includes(query.trim().toLowerCase()));
  const detailMembers = selectedChat?.detail.members ?? [];
  const visibleDetailMembers = detailMembers.slice(0, detailMemberLimit);
  const hasMoreDetailMembers = detailMembers.length > detailMemberLimit;
  const chatMemberNewIds = groupSelectedIds.filter((userId) => !chatMemberLockedIds.includes(userId));

  const updateSelectedChatPreference = async (kind: "pin" | "online", enabled: boolean) => {
    if (!selectedChat || preferenceSaving) return;
    const chatIdToUpdate = selectedChat.id;
    const field = kind === "pin" ? "pinned" : "onlineReminderEnabled";
    setPreferenceSaving(kind);
    setChats((current) => sortChats(current.map((chat) => (chat.id === chatIdToUpdate ? { ...chat, [field]: enabled } : chat))));
    try {
      const preference = await api.updateChatPreference(chatIdToUpdate, {
        ...(kind === "pin" ? { pinned: enabled ? 1 : 0 } : { online_reminder_enabled: enabled ? 1 : 0 }),
      });
      setChats((current) =>
        sortChats(
          current.map((chat) =>
            chat.id === chatIdToUpdate
              ? { ...chat, pinned: preference.pinned, onlineReminderEnabled: preference.online_reminder_enabled }
              : chat
          )
        )
      );
    } catch (apiError) {
      setChats((current) => sortChats(current.map((chat) => (chat.id === chatIdToUpdate ? { ...chat, [field]: !enabled } : chat))));
      setPageError(apiError instanceof ApiError ? apiError.message : "会话设置保存失败");
    } finally {
      setPreferenceSaving(null);
    }
  };

  const ensureCurrentUserVerified = async () => {
    if (currentUserVerified !== null) return currentUserVerified;
    const users = await api.getSpaceUsers({ limit: 200, offset: 0 });
    const verified = users.find((user) => user.user_id === currentUserId)?.verified ?? false;
    setCurrentUserVerified(verified);
    return verified;
  };

  const openChatMemberAdder = async () => {
    if (!selectedChat) return;
    const verified = await ensureCurrentUserVerified();
    if (!verified) {
      setPageError("完成认证后才能添加聊天成员。");
      return;
    }
    setDetailsSheetOpen(false);
    setGroupQuery("");
    const lockedIds = selectedChat.detail.members.filter((member) => !member.isSelf).map((member) => member.userId);
    setChatMemberLockedIds(lockedIds);
    setGroupSelectedIds(lockedIds);
    setChatMemberPickerOpen(true);
  };

  const closeChatMemberPicker = () => {
    if (groupManageState === "saving") return;
    setChatMemberPickerOpen(false);
    setGroupQuery("");
    setGroupSelectedIds([]);
    setChatMemberLockedIds([]);
  };

  const removeFriend = async () => {
    if (!selectedChat || selectedChat.type !== "direct") return;
    const peer = selectedChat.detail.members.find((member) => !member.isSelf);
    if (!peer) {
      setPageError("没有找到当前好友。");
      return;
    }

    setStatusModal({
      open: true,
      phase: "loading",
      loadingLabel: "正在删除好友",
      successLabel: "好友已删除",
      errorLabel: "删除失败",
    });

    try {
      await api.removeFriendRequest(peer.userId);
      setFriendDangerConfirmOpen(false);
      setDetailsSheetOpen(false);
      setStatusModal((current) => (current ? { ...current, phase: "success" } : null));
    } catch (apiError) {
      setStatusModal((current) =>
        current
          ? {
              ...current,
              phase: "error",
              errorLabel: apiError instanceof ApiError ? apiError.message : "删除失败",
            }
          : null
      );
    }
  };

  useEffect(() => {
    if (!groupCreateOpen && !chatMemberPickerOpen) return;

    const controller = new AbortController();
    if (groupCreateOpen) {
      setGroupCreateState((current) => (current === "creating" ? current : "loading-users"));
    }
    if (chatMemberPickerOpen) {
      setGroupManageState("loading-candidates");
    }

    Promise.all([
      api.getFriends(controller.signal),
      currentUserVerified === null ? api.getSpaceUsers({ limit: 200, offset: 0 }, controller.signal) : Promise.resolve([] as UserDTO[]),
    ])
      .then(([friendRows, spaceUsers]) => {
        const verified = currentUserVerified ?? spaceUsers.find((user) => user.user_id === currentUserId)?.verified ?? false;
        setCurrentUserVerified(verified);
        setGroupFriendPool(friendRows.filter((user) => user.user_id !== currentUserId));
        setGroupCreateState((current) => (current === "creating" ? current : "idle"));
        setGroupManageState((current) => (current === "saving" ? current : "idle"));
      })
      .catch((apiError) => {
        if (controller.signal.aborted) return;
        const message = apiError instanceof ApiError ? apiError.message : "加载群聊候选成员失败";
        setPageError(message);
        setGroupCreateState((current) => (current === "creating" ? current : "idle"));
        setGroupManageState((current) => (current === "saving" ? current : "idle"));
      });

    return () => controller.abort();
  }, [chatMemberPickerOpen, currentUserId, currentUserVerified, groupCreateOpen]);

  useEffect(() => {
    if (!groupCreateOpen && !chatMemberPickerOpen) {
      setGroupCandidates([]);
      return;
    }

    const chatMemberRows =
      chatMemberPickerOpen && selectedChat
        ? selectedChat.detail.members
            .filter((member) => !member.isSelf)
            .map(
              (member) =>
                ({
                  user_id: member.userId,
                  name: member.name,
                  avatar_uri: member.avatarUri,
                  avatar_type: member.avatarUri ? "preset" : null,
                  is_alive: false,
                  last_heartbeat: 0,
                  verified: true,
                  email_verified_at: null,
                  phone_verified_at: null,
                  bark_verified_at: null,
                }) as UserDTO
            )
        : [];
    const baseCandidates = [...chatMemberRows, ...groupFriendPool].filter(
      (user, index, rows) => rows.findIndex((item) => item.user_id === user.user_id) === index
    );

    setGroupCandidates(filterUsersByName(baseCandidates, groupQuery));
  }, [chatMemberPickerOpen, groupCreateOpen, groupFriendPool, groupQuery, selectedChat]);

  useEffect(() => {
    const element = textareaRef.current;
    if (!element) return;

    const computedStyle = window.getComputedStyle(element);
    const lineHeight = Number.parseFloat(computedStyle.lineHeight) || 20;
    const paddingTop = Number.parseFloat(computedStyle.paddingTop) || 0;
    const paddingBottom = Number.parseFloat(computedStyle.paddingBottom) || 0;
    const borderTop = Number.parseFloat(computedStyle.borderTopWidth) || 0;
    const borderBottom = Number.parseFloat(computedStyle.borderBottomWidth) || 0;
    const minHeight = lineHeight + paddingTop + paddingBottom + borderTop + borderBottom;
    const maxHeight = lineHeight * 4 + paddingTop + paddingBottom + borderTop + borderBottom;

    element.style.height = "auto";
    element.style.height = `${Math.max(minHeight, Math.min(element.scrollHeight, maxHeight))}px`;
    element.style.overflowY = element.scrollHeight > maxHeight ? "auto" : "hidden";
  }, [draft]);

  useEffect(() => {
    const element = composerRef.current;
    if (!element || typeof ResizeObserver === "undefined") return;

    const observer = new ResizeObserver(([entry]) => {
      setComposerHeight(Math.ceil(entry.contentRect.height));
    });

    observer.observe(element);
    setComposerHeight(Math.ceil(element.getBoundingClientRect().height));

    return () => observer.disconnect();
  }, [selectedChat]);

  useEffect(() => {
    if (!selectedChat || typeof window === "undefined" || !window.visualViewport) {
      setKeyboardOffset(0);
      return;
    }

    const viewport = window.visualViewport;

    const updateViewport = () => {
      const nextOffset = Math.max(0, window.innerHeight - viewport.height - viewport.offsetTop);
      setKeyboardOffset(nextOffset);
    };

    updateViewport();
    viewport.addEventListener("resize", updateViewport);
    viewport.addEventListener("scroll", updateViewport);

    return () => {
      viewport.removeEventListener("resize", updateViewport);
      viewport.removeEventListener("scroll", updateViewport);
    };
  }, [selectedChat]);

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!selectedChat) return;

    const message = draft.trim();
    if (!message) return;

    const optimisticMessage = createPendingMessage(message, currentUserName);

    try {
      setSendState("sending");
      if (DEBUG_CHAT_SEND) {
        console.log("[chat] submit start", {
          chatId: selectedChat.id,
          optimisticId: optimisticMessage.id,
          optimisticClientId: optimisticMessage.clientId,
          text: optimisticMessage.text,
        });
      }
      flushSync(() => {
        setMessages((current) => ({
          ...current,
          [selectedChat.id]: sortMessages([...(current[selectedChat.id] ?? []), optimisticMessage]),
        }));
        setChats((currentChats) =>
          sortChats(
            currentChats.map((chat) =>
              chat.id === selectedChat.id ? updateChatSummary(chat, message, optimisticMessage.createdAt) : chat
            )
          )
        );
        setDraft("");
      });
      if (DEBUG_CHAT_SEND) {
        console.log("[chat] optimistic inserted", {
          chatId: selectedChat.id,
          optimisticId: optimisticMessage.id,
        });
      }
      triggerMessageEntrance(optimisticMessage.clientId);
      stickToBottomRef.current = true;
      const created = await api.sendMessage(selectedChat.id, MESSAGE_TYPE_TEXT, message);
      const deliveredMessage = mapChatMessage(created, currentUserId);
      if (DEBUG_CHAT_SEND) {
        console.log("[chat] send success", {
          chatId: selectedChat.id,
          optimisticId: optimisticMessage.id,
          serverId: deliveredMessage.id,
          serverClientId: deliveredMessage.clientId,
          text: deliveredMessage.text,
        });
      }
      setMessages((current) => ({
        ...current,
        [selectedChat.id]: confirmPendingMessage(current[selectedChat.id] ?? [], optimisticMessage.clientId, deliveredMessage),
      }));
      setChats((currentChats) =>
        sortChats(
          currentChats.map((chat) =>
            chat.id === selectedChat.id ? updateChatSummary(chat, deliveredMessage.text, deliveredMessage.createdAt) : chat
          )
        )
      );
    } catch (apiError) {
      if (DEBUG_CHAT_SEND) {
        console.log("[chat] send failed", {
          chatId: selectedChat.id,
          optimisticId: optimisticMessage.id,
          error: apiError instanceof Error ? apiError.message : String(apiError),
        });
      }
      setMessages((current) => ({
        ...current,
        [selectedChat.id]: updateMessageStatus(current[selectedChat.id] ?? [], optimisticMessage.clientId, "failed"),
      }));
    } finally {
      setSendState("idle");
    }
  };

  const retryFailedMessage = async (message: ChatMessage) => {
    if (!selectedChat || message.status !== "failed" || message.kind !== "text") return;

    const retryMessage: ChatMessage = {
      ...message,
      status: "pending",
      createdAt: Math.floor(Date.now() / 1000),
      time: formatTime(Math.floor(Date.now() / 1000)),
    };

    setMessages((current) => ({
      ...current,
      [selectedChat.id]: (current[selectedChat.id] ?? []).map((item) => (item.id === message.id ? retryMessage : item)),
    }));
    stickToBottomRef.current = true;
    triggerMessageEntrance(retryMessage.clientId);

    try {
      const created = await api.sendMessage(selectedChat.id, MESSAGE_TYPE_TEXT, retryMessage.text);
      const deliveredMessage = mapChatMessage(created, currentUserId);
      setMessages((current) => ({
        ...current,
        [selectedChat.id]: confirmPendingMessage(current[selectedChat.id] ?? [], retryMessage.clientId, deliveredMessage),
      }));
      setChats((currentChats) =>
        sortChats(
          currentChats.map((chat) =>
            chat.id === selectedChat.id
              ? {
                  ...chat,
                  preview: previewFromMessage(deliveredMessage),
                  time: "刚刚",
                  lastActivity: deliveredMessage.createdAt,
                  unread: 0,
                }
              : chat
          )
        )
      );
    } catch {
      setMessages((current) => ({
        ...current,
        [selectedChat.id]: updateMessageStatus(current[selectedChat.id] ?? [], retryMessage.clientId, "failed"),
      }));
    }
  };

  const appendDeliveredMessage = (chatId: number, deliveredMessage: ChatMessage) => {
    setMessages((current) => ({
      ...current,
      [chatId]: sortMessages([...(current[chatId] ?? []), deliveredMessage]),
    }));
    setChats((currentChats) =>
      sortChats(
        currentChats.map((chat) => (chat.id === chatId ? updateChatSummary(chat, previewFromMessage(deliveredMessage), deliveredMessage.createdAt) : chat))
      )
    );
    stickToBottomRef.current = true;
    triggerMessageEntrance(deliveredMessage.clientId);
  };

  const sendUploadedMediaMessage = async (
    kind: MessageMediaKind,
    file: File,
    extraPayload: Partial<ChatMessagePayloadDTO> = {}
  ) => {
    if (!selectedChat) return;
    const createdAt = Math.floor(Date.now() / 1000);
    const objectUrl = URL.createObjectURL(file);
    const clientId = `temp:${Date.now()}:${Math.random().toString(36).slice(2, 8)}`;
    const pendingMessage: ChatMessage = {
      id: clientId,
      clientId,
      from: "self",
      type: messageTypeFromKind(kind),
      kind,
      name: currentUserName,
      time: formatTime(createdAt),
      createdAt,
      text: previewFromKind(kind, ""),
      payload: {
        kind,
        uri: objectUrl,
        mime_type: file.type || extraPayload.mime_type,
        duration_seconds: extraPayload.duration_seconds,
      },
      status: "pending",
    };

    setMessages((current) => ({
      ...current,
      [selectedChat.id]: sortMessages([...(current[selectedChat.id] ?? []), pendingMessage]),
    }));
    setChats((currentChats) =>
      sortChats(
        currentChats.map((chat) => (chat.id === selectedChat.id ? updateChatSummary(chat, previewFromMessage(pendingMessage), pendingMessage.createdAt) : chat))
      )
    );
    stickToBottomRef.current = true;
    triggerMessageEntrance(pendingMessage.clientId);

    try {
      const upload = await uploadMessageMedia(file, kind);
      const created = await api.sendMessage(
        selectedChat.id,
        messageTypeFromKind(kind),
        JSON.stringify({
          key: upload.key,
          mime_type: file.type || extraPayload.mime_type,
          duration_seconds: extraPayload.duration_seconds,
        })
      );
      const deliveredMessage = mapChatMessage(created, currentUserId);
      setMessages((current) => ({
        ...current,
        [selectedChat.id]: confirmPendingMessage(current[selectedChat.id] ?? [], pendingMessage.clientId, deliveredMessage),
      }));
      setChats((currentChats) =>
        sortChats(
          currentChats.map((chat) =>
            chat.id === selectedChat.id ? updateChatSummary(chat, previewFromMessage(deliveredMessage), deliveredMessage.createdAt) : chat
          )
        )
      );
      URL.revokeObjectURL(objectUrl);
      return true;
    } catch (error) {
      setMessages((current) => ({
        ...current,
        [selectedChat.id]: updateMessageStatus(current[selectedChat.id] ?? [], pendingMessage.clientId, "failed"),
      }));
      const uploadError = toMessageUploadError(error);
      setPageError(uploadError.message);
      return false;
    }
  };

  const openMediaPicker = () => {
    if (composerBusy) return;
    mediaInputRef.current?.click();
  };

  const handleMediaSelection = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;

    try {
      const kind = resolveMediaKind(file);
      await sendUploadedMediaMessage(kind, file);
    } catch (error) {
      const uploadError = toMessageUploadError(error);
      setPageError(uploadError.message);
    }
  };

  const startVoiceRecording = async () => {
    if (composerBusy || voiceComposer.open) return;
    if (typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") {
      setPageError("当前设备暂不支持语音录制。");
      return;
    }

    textareaRef.current?.blur();
    recordingCancelledRef.current = false;
    recordingStopRequestedRef.current = false;
    recordingChunksRef.current = [];

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mimeTypeCandidates = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4", "audio/ogg;codecs=opus"];
      const mimeType = mimeTypeCandidates.find((item) => MediaRecorder.isTypeSupported(item)) ?? "";
      const mediaRecorder = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream);
      mediaStreamRef.current = stream;
      mediaRecorderRef.current = mediaRecorder;

      const AudioContextCtor = window.AudioContext || (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (AudioContextCtor) {
        const audioContext = new AudioContextCtor();
        const analyser = audioContext.createAnalyser();
        analyser.fftSize = 64;
        const source = audioContext.createMediaStreamSource(stream);
        source.connect(analyser);
        audioContextRef.current = audioContext;
        analyserRef.current = analyser;

        const data = new Uint8Array(analyser.frequencyBinCount);
        const updateWaveform = () => {
          if (!analyserRef.current) return;
          analyserRef.current.getByteFrequencyData(data);
          const bars = Array.from({ length: 24 }, (_, index) => {
            const bucketSize = Math.max(1, Math.floor(data.length / 24));
            const slice = data.slice(index * bucketSize, (index + 1) * bucketSize);
            const average = slice.length ? slice.reduce((sum, value) => sum + value, 0) / slice.length : 0;
            return Math.max(0.18, average / 255);
          });
          setVoiceComposer((current) => (current.open ? { ...current, bars } : current));
          waveformFrameRef.current = requestAnimationFrame(updateWaveform);
        };
        waveformFrameRef.current = requestAnimationFrame(updateWaveform);
      }

      mediaRecorder.ondataavailable = (recordEvent) => {
        if (recordEvent.data.size > 0) {
          recordingChunksRef.current.push(recordEvent.data);
        }
      };

      mediaRecorder.onstop = () => {
        const nextMimeType = mediaRecorder.mimeType || mimeType || "audio/webm";
        const blob = new Blob(recordingChunksRef.current, { type: nextMimeType });
        cleanupRecordingResources();
        if (recordingCancelledRef.current) {
          resetVoiceComposer();
          return;
        }
        setVoiceComposer((current) => ({
          ...current,
          open: true,
          phase: "recorded",
          blob,
          mimeType: nextMimeType,
          bars: current.bars,
        }));
      };

      mediaRecorder.start();
      setVoiceComposer({
        open: true,
        phase: "recording",
        durationSeconds: 0,
        bars: Array.from({ length: 24 }, () => 0.28),
        blob: null,
        mimeType: mediaRecorder.mimeType || mimeType || "audio/webm",
      });

      const startedAt = Date.now();
      recordingTimerRef.current = window.setInterval(() => {
        const durationSeconds = Math.min(AUDIO_MAX_DURATION_SECONDS, (Date.now() - startedAt) / 1000);
        setVoiceComposer((current) => ({
          ...current,
          durationSeconds,
        }));
        if (durationSeconds >= AUDIO_MAX_DURATION_SECONDS && mediaRecorderRef.current?.state === "recording") {
          recordingStopRequestedRef.current = true;
          mediaRecorderRef.current.stop();
          window.clearInterval(recordingTimerRef.current ?? 0);
          recordingTimerRef.current = null;
        }
      }, 120);
    } catch (error) {
      resetVoiceComposer();
      setPageError(error instanceof Error ? error.message : "无法开始录音");
    }
  };

  const stopVoiceRecording = () => {
    if (mediaRecorderRef.current?.state !== "recording") return;
    setVoiceComposer((current) => ({ ...current, phase: "stopping" }));
    recordingStopRequestedRef.current = true;
    mediaRecorderRef.current.stop();
  };

  const cancelVoiceRecording = () => {
    recordingCancelledRef.current = true;
    if (mediaRecorderRef.current?.state === "recording") {
      mediaRecorderRef.current.stop();
      return;
    }
    resetVoiceComposer();
  };

  const sendRecordedVoiceMessage = async () => {
    if (!voiceComposer.blob || !selectedChat) return;

    const extension = voiceComposer.mimeType.includes("mp4") ? "m4a" : voiceComposer.mimeType.includes("ogg") ? "ogg" : "webm";
    const file = new File([voiceComposer.blob], `voice-message.${extension}`, {
      type: voiceComposer.mimeType || "audio/webm",
    });

    setVoiceComposer((current) => ({ ...current, phase: "sending" }));
    const sent = await sendUploadedMediaMessage("audio", file, {
      duration_seconds: voiceComposer.durationSeconds,
    });
    if (sent) {
      resetVoiceComposer();
      return;
    }
    setVoiceComposer((current) => ({ ...current, phase: "recorded" }));
  };

  const refreshChats = async () => {
    const rows = await api.getChats();
    setChats(sortChats(rows.map((item) => mapChat(item, currentUserId))));
  };

  const copyMessageText = async () => {
    if (!messageMenu || messageMenu.message.kind !== "text") return;
    try {
      const copied = await copyText(messageMenu.message.text);
      if (!copied) throw new Error("复制失败");
      setMessageMenu(null);
    } catch (apiError) {
      const message = apiError instanceof Error ? apiError.message : "复制失败";
      setPageError(message);
    }
  };

  const openStatusModal = (loadingLabel: string, successLabel: string, errorLabel: string) => {
    setStatusModal({
      open: true,
      phase: "loading",
      loadingLabel,
      successLabel,
      errorLabel,
    });
  };

  const deleteMessage = async () => {
    if (!selectedChat || !messageMenu || typeof messageMenu.message.id !== "number") return;

    try {
      openStatusModal("正在删除消息", "消息已删除", "删除消息失败");
      setMessageDeleteState("deleting");
      await api.deleteMessage(messageMenu.message.id);
      const nextThreadMessages = (selectedMessages ?? []).filter((message) => message.clientId !== messageMenu.message.clientId);
      setMessages((current) => ({
        ...current,
        [selectedChat.id]: nextThreadMessages,
      }));
      if (cacheScope) {
        const nextSnapshot = {
          messages: nextThreadMessages,
          hasOlderMessages,
          scrollTop: messageScrollRef.current?.scrollTop ?? 0,
          updatedAt: Date.now(),
        };
        chatCache.setThread(cacheScope, selectedChat.id, nextSnapshot);
        void chatCache.persistThread(cacheScope, selectedChat.id, nextSnapshot);
      }
      setMessageMenu(null);
      await refreshChats();
      setStatusModal((current) => (current ? { ...current, phase: "success" } : null));
    } catch (apiError) {
      setStatusModal((current) =>
        current
          ? {
              ...current,
              phase: "error",
              errorLabel: apiError instanceof ApiError ? apiError.message : "删除消息失败",
            }
          : null
      );
    } finally {
      setMessageDeleteState("idle");
    }
  };

  const toggleGroupCandidate = (userId: number) => {
    if (chatMemberLockedIds.includes(userId)) return;
    setGroupSelectedIds((current) => (current.includes(userId) ? current.filter((item) => item !== userId) : [...current, userId]));
  };

  const createGroup = async () => {
    if (!currentUserVerified) {
      setPageError("完成认证后才可以创建群聊。");
      return;
    }
    if (!groupSelectedIds.length) {
      setPageError("请至少选择一位成员。");
      return;
    }

    try {
      openStatusModal("正在创建群聊", "群聊创建成功", "创建群聊失败");
      setGroupCreateState("creating");
      const created = await api.createGroupChat(groupSelectedIds, groupTitle.trim() || undefined);
      const nextChat = mapChat(created, currentUserId);
      setChats((currentChats) => sortChats([nextChat, ...currentChats.filter((chat) => chat.id !== nextChat.id)]));
      setGroupCreateOpen(false);
      setGroupTitle("");
      setGroupQuery("");
      setGroupSelectedIds([]);
      setStatusModal((current) => (current ? { ...current, phase: "success" } : null));
      navigate(`/app/chats/${created.chat_id}`);
    } catch (apiError) {
      setStatusModal((current) =>
        current
          ? {
              ...current,
              phase: "error",
              errorLabel: apiError instanceof ApiError ? apiError.message : "创建群聊失败",
            }
          : null
      );
      setGroupCreateState("idle");
    }
  };

  const applyUpdatedGroupChat = (chatRow: ChatDTO) => {
    const nextChat = mapChat(chatRow, currentUserId);
    setChats((currentChats) => sortChats(currentChats.map((chat) => (chat.id === nextChat.id ? nextChat : chat))));
  };

  const renameGroup = async () => {
    if (!selectedChat) return;
    try {
      openStatusModal("正在保存群聊名称", "群聊名称已更新", "重命名群聊失败");
      setGroupManageState("saving");
      const updated = await api.renameGroupChat(selectedChat.id, groupRenameValue.trim());
      applyUpdatedGroupChat(updated);
      setGroupRenameOpen(false);
      setStatusModal((current) => (current ? { ...current, phase: "success" } : null));
    } catch (apiError) {
      setStatusModal((current) =>
        current
          ? {
              ...current,
              phase: "error",
              errorLabel: apiError instanceof ApiError ? apiError.message : "重命名群聊失败",
            }
          : null
      );
    } finally {
      setGroupManageState("idle");
    }
  };

  const submitChatMemberPicker = async () => {
    if (!selectedChat) return;
    if (!chatMemberNewIds.length) return;

    try {
      openStatusModal(
        selectedChat.type === "group" ? "正在添加群成员" : "正在创建群聊",
        selectedChat.type === "group" ? "成员添加成功" : "聊天成员已更新",
        "添加聊天成员失败"
      );
      setGroupManageState("saving");
      if (selectedChat.type === "group") {
        const updated = await api.addGroupMembers(selectedChat.id, chatMemberNewIds);
        applyUpdatedGroupChat(updated);
      } else {
        const created = await api.createGroupChat(groupSelectedIds);
        const nextChat = mapChat(created, currentUserId);
        setChats((currentChats) => sortChats([nextChat, ...currentChats.filter((chat) => chat.id !== nextChat.id)]));
        navigate(`/app/chats/${created.chat_id}`);
      }
      closeChatMemberPicker();
      setStatusModal((current) => (current ? { ...current, phase: "success" } : null));
    } catch (apiError) {
      setStatusModal((current) =>
        current
          ? {
              ...current,
              phase: "error",
              errorLabel: apiError instanceof ApiError ? apiError.message : "添加聊天成员失败",
            }
          : null
      );
    } finally {
      setGroupManageState("idle");
    }
  };

  const removeGroupMember = async (userId: number) => {
    if (!selectedChat) return;
    try {
      openStatusModal("正在移除成员", "成员已移除", "移除成员失败");
      setGroupManageState("saving");
      const updated = await api.removeGroupMembers(selectedChat.id, [userId]);
      applyUpdatedGroupChat(updated);
      setStatusModal((current) => (current ? { ...current, phase: "success" } : null));
    } catch (apiError) {
      setStatusModal((current) =>
        current
          ? {
              ...current,
              phase: "error",
              errorLabel: apiError instanceof ApiError ? apiError.message : "移除成员失败",
            }
          : null
      );
    } finally {
      setGroupManageState("idle");
    }
  };

  const leaveOrDeleteGroup = async () => {
    if (!selectedChat || selectedChat.type !== "group") return;
    try {
      openStatusModal(selectedChat.isOwner ? "正在解散群聊" : "正在退出群聊", selectedChat.isOwner ? "群聊已解散" : "已退出群聊", selectedChat.isOwner ? "解散群聊失败" : "退出群聊失败");
      setGroupManageState("saving");
      if (selectedChat.isOwner) {
        await api.deleteGroupChat(selectedChat.id);
      } else {
        await api.leaveGroupChat(selectedChat.id);
      }
      setChats((currentChats) => currentChats.filter((chat) => chat.id !== selectedChat.id));
      setDetailsSheetOpen(false);
      setGroupDangerConfirmOpen(false);
      setStatusModal((current) => (current ? { ...current, phase: "success" } : null));
      navigate("/app/chats");
    } catch (apiError) {
      setStatusModal((current) =>
        current
          ? {
              ...current,
              phase: "error",
              errorLabel: apiError instanceof ApiError ? apiError.message : selectedChat.isOwner ? "解散群聊失败" : "退出群聊失败",
            }
          : null
      );
    } finally {
      setGroupManageState("idle");
    }
  };

  const loadOlderMessages = async () => {
    if (!selectedChat || !selectedMessages.length || olderState === "loading" || !cacheScope) return;

    const oldestMessage = selectedMessages[0];
    const scroller = messageScrollRef.current;
    const previousHeight = scroller?.scrollHeight ?? 0;

    try {
      setOlderState("loading");
      const rows = await api.getMessages({
        chat_id: selectedChat.id,
        limit: 30,
        before: Number(oldestMessage.id),
      });
      const normalized = sortMessages(rows.map((row) => mapChatMessage(row, currentUserId)));

      setMessages((current) => ({
        ...current,
        [selectedChat.id]: mergeMessages(normalized, current[selectedChat.id] ?? []),
      }));
      const mergedMessages = mergeMessages(normalized, selectedMessages);
      setHasOlderMessages(rows.length >= 30);
      chatCache.setThread(cacheScope, selectedChat.id, {
        messages: mergedMessages,
        hasOlderMessages: rows.length >= 30,
        scrollTop: scroller?.scrollTop ?? 0,
        updatedAt: Date.now(),
      });
      void chatCache.persistThread(cacheScope, selectedChat.id, {
        messages: mergedMessages,
        hasOlderMessages: rows.length >= 30,
        scrollTop: scroller?.scrollTop ?? 0,
        updatedAt: Date.now(),
      });

      requestAnimationFrame(() => {
        const element = messageScrollRef.current;
        if (!element) return;
        const nextHeight = element.scrollHeight;
        element.scrollTop = nextHeight - previousHeight + element.scrollTop;
      });
    } catch (apiError) {
      if (isChatAccessBoundaryError(apiError)) {
        redirectToChatListWithNotice(chatAccessBoundaryMessage(apiError), selectedChat.id);
        return;
      }
      const message = apiError instanceof ApiError ? apiError.message : "加载历史消息失败";
      setPageError(message);
    } finally {
      setOlderState("idle");
    }
  };

  const renderChatItem = (chat: Chat, active: boolean) => (
    <button
      key={chat.id}
      className={`chat-item ${active ? "active" : ""}`}
      onClick={() => navigate(`/app/chats/${chat.id}`)}
      type="button"
    >
      <div className="avatar-wrap">
        <UserAvatar
          className={`avatar ${chat.online ? "status-online" : ""}`}
          groupMembers={
            chat.type === "group" ? chat.detail.members.map((member) => ({ name: member.name, uri: member.avatarUri })) : undefined
          }
          name={chat.title}
          uri={chat.avatarUri}
        />
      </div>
      <div className="chat-copy">
        <p className="chat-name">{chat.title}</p>
        <div className="chat-preview">{chat.preview}</div>
      </div>
      <div className="chat-meta">
        <div className="chat-time">{chat.time}</div>
        {chat.pinned && !chat.unread ? <span className="chat-pinned-mark">置顶</span> : null}
        {chat.unread ? <span className="small-badge">{chat.unread > 99 ? "99+" : chat.unread}</span> : null}
      </div>
    </button>
  );

  const renderChatList = () => (
    <>
      <div className="chat-list-screen-header minimal-page-header">
        <div className="page-toolbar">
          <h2 className="panel-title">聊天</h2>
        </div>
        <VerificationBanner hasPassword={Boolean(session?.user?.has_password)} verified={Boolean(session?.user?.verified)} />
        <label className="search-box">
          <span className="material-symbols-outlined">search</span>
          <input
            className="input"
            style={{ border: 0, background: "transparent", height: "auto", padding: 0 }}
            placeholder="搜索会话名 / 用户名"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
        </label>
      </div>

      <div className="chat-list-screen-body">
        {viewState === "loading" ? <FeedbackState title="会话加载中" description="正在同步你最近的聊天。" tone="loading" /> : null}
        {chatAccessNotice ? (
          <FeedbackState
            title="无法打开这个会话"
            description={chatAccessNotice}
            action={
              <div className="button-row">
                <Link className="button" replace to="/app/chats">
                  查看聊天列表
                </Link>
                <Link className="ghost-button" to="/app/notifications">
                  去通讯
                </Link>
              </div>
            }
          />
        ) : null}
        <div className="chat-list">
          {filteredChats.map((chat) => renderChatItem(chat, chat.id === selectedChat?.id))}
        </div>
        {!chatAccessNotice && !filteredChats.length && viewState === "ready" ? (
          <FeedbackState
            title={query.trim() ? "没有匹配的会话" : "还没有会话"}
            description={query.trim() ? "换个关键词试试。" : groupSquareEnabled ? "先从广场里找到一个人，再开始第一段对话。" : "新的会话出现后会显示在这里。"}
            action={
              groupSquareEnabled ? (
                <Link className="button" to="/app/square">
                  去广场
                </Link>
              ) : undefined
            }
          />
        ) : null}
      </div>
    </>
  );

  const chatLayoutStyle = selectedChat
    ? ({
        "--chat-keyboard-offset": `${keyboardOffset}px`,
        "--chat-composer-height": `${composerHeight}px`,
      } as CSSProperties)
    : undefined;

  return (
    <AppChrome
      title="聊天"
      hideTopbar={!displayedChat}
      hideMobileNav={Boolean(displayedChat)}
      hidePageTitle={Boolean(displayedChat)}
      topbarClassName={displayedChat ? `conversation-topbar${isClosingChatView ? " is-closing" : ""}` : undefined}
      topbarLeading={
        displayedChat ? (
          <div className="chat-conversation-topbar">
            <button className="chat-back-button" onClick={closeChatView} type="button">
              <span className="material-symbols-outlined">arrow_back</span>
            </button>
            <div className="avatar-wrap">
              <UserAvatar
                className={`avatar ${displayedChat.online ? "status-online" : ""}`}
                groupMembers={
                  displayedChat.type === "group"
                    ? displayedChat.detail.members.map((member) => ({ name: member.name, uri: member.avatarUri }))
                    : undefined
                }
                name={displayedChat.title}
                uri={displayedChat.avatarUri}
              />
            </div>
            <div className="chat-topbar-meta">
              <strong className="chat-topbar-name">
                {displayedChat.type === "group" ? (
                  <>
                    <span className="chat-topbar-title-text">{displayedChat.title}</span>
                    <span className="chat-topbar-title-count">({displayedChat.members})</span>
                  </>
                ) : (
                  displayedChat.title
                )}
              </strong>
              <div className="chat-topbar-status">{displayedChat.type === "group" ? `${displayedChat.members} 人` : displayedChat.subtitle}</div>
            </div>
          </div>
        ) : undefined
      }
      topbarAction={
        displayedChat ? (
          <div className="button-row message-actions">
            <button className="icon-button desktop-only-action" type="button">
              <span className="material-symbols-outlined">{displayedChat.type === "group" ? "group_add" : "videocam"}</span>
            </button>
            <button className="icon-button" onClick={() => setDetailsSheetOpen(true)} type="button">
              <span className="material-symbols-outlined">more_vert</span>
            </button>
          </div>
        ) : undefined
      }
    >
      <section ref={chatLayoutRef} className={`app-layout chat-mobile-layout ${displayedChat ? "chat-detail-active" : "chat-list-active"}`} style={chatLayoutStyle}>
        <section className={`list-screen mobile-chat-list-screen ${displayedChat ? "is-background" : "is-active"}`}>{renderChatList()}</section>

        <section ref={chatMainPaneRef} className={`message-pane chat-main-pane ${displayedChat ? "is-open" : "desktop-pane is-closed"}`}>
          {displayedChat ? (
            <div
              className={`chat-detail-scene ${isClosingChatView ? "is-closing" : ""}`}
              onAnimationEnd={(event) => {
                if (!isClosingChatView) return;
                if (!(event.target instanceof HTMLElement) || !event.target.classList.contains("chat-detail-scene")) return;
                if (DEBUG_CHAT_SEND) {
                  console.log("[chat-close] animation end, navigate", {
                    animationName: event.animationName,
                  });
                }
                navigate("/app/chats");
                setIsClosingChatView(false);
                setClosingChatSnapshot(null);
              }}
              onContextMenu={(event) => {
                event.preventDefault();
              }}
            >
              <div
                ref={messageScrollRef}
                className="message-scroll"
                onScroll={() => {
                  const element = messageScrollRef.current;
                  stickToBottomRef.current = isNearThreadBottom(element);
                  if (element && element.scrollTop <= 24 && hasOlderMessages && olderState === "idle") {
                    void loadOlderMessages();
                  }
                  if (!cacheScope || !selectedChat) return;
                  chatCache.updateThreadScroll(cacheScope, selectedChat.id, element?.scrollTop ?? 0);
                }}
              >
                {hasOlderMessages ? (
                  <div className="message-history-actions">
                    <button className="ghost-button" disabled={olderState === "loading"} onClick={() => void loadOlderMessages()} type="button">
                      {olderState === "loading" ? "加载中..." : "查看更多消息"}
                    </button>
                  </div>
                ) : null}
                {messageGroups.map((group) => (
                  <MessageGroupBlock
                    enteringMessageIds={enteringMessageIds}
                    group={group}
                    key={group.key}
                    onOpenImage={setImagePreviewUri}
                    onOpenActions={openMessageMenu}
                    onRetry={retryFailedMessage}
                    showAuthor={Boolean(selectedChat?.type === "group")}
                  />
                ))}
              </div>

              <form ref={composerRef} className={`composer ${voiceComposer.open ? "is-recording-mode" : ""}`} onSubmit={submit}>
                {!voiceComposer.open ? (
                  <div className="composer-row composer-row-text">
                    <div className="composer-leading-actions">
                      <button className="composer-action-button" disabled={composerBusy} onClick={openMediaPicker} type="button">
                        <ComposerSvgIcon className="composer-inline-svg" kind="album" />
                      </button>
                      <button className="composer-action-button" disabled={composerBusy} onClick={() => void startVoiceRecording()} type="button">
                        <ComposerSvgIcon className="composer-inline-svg" kind="mic" />
                      </button>
                    </div>
                    <div className="composer-input-wrap">
                      <textarea
                        ref={textareaRef}
                        className="textarea composer-input"
                        enterKeyHint="send"
                        placeholder="输入消息..."
                        value={draft}
                        rows={1}
                        onChange={(event) => setDraft(event.target.value)}
                        onCompositionStart={() => {
                          isComposingRef.current = true;
                        }}
                        onCompositionEnd={() => {
                          isComposingRef.current = false;
                        }}
                        onKeyDown={(event) => {
                          const nativeEvent = event.nativeEvent as KeyboardEvent & { isComposing?: boolean; keyCode?: number };
                          if (isComposingRef.current || nativeEvent.isComposing || nativeEvent.keyCode === 229) {
                            return;
                          }
                          if (event.key === "Enter" && !event.shiftKey) {
                            event.preventDefault();
                            event.currentTarget.form?.requestSubmit();
                          }
                        }}
                      />
                    </div>
                    <button className="composer-plus" disabled={composerBusy} onClick={() => setComposerMoreOpen(true)} type="button">
                      <span className="material-symbols-outlined">add</span>
                    </button>
                    <button hidden type="submit" />
                  </div>
                ) : (
                  <div className="composer-row composer-row-recording">
                    <button className="composer-recording-delete" disabled={voiceComposer.phase === "sending"} onClick={cancelVoiceRecording} type="button">
                      <ComposerSvgIcon className="composer-inline-svg" kind="delete" />
                    </button>
                    <div className="composer-recording-bar">
                      <button
                        className="composer-recording-stop"
                        disabled={voiceComposer.phase !== "recording"}
                        onClick={stopVoiceRecording}
                        type="button"
                      >
                        <ComposerSvgIcon className="composer-inline-svg composer-stop-svg" kind="stop" />
                      </button>
                      <div className="composer-recording-waveform" aria-hidden="true">
                        {voiceComposer.bars.map((bar, index) => (
                          <span key={`wave-${index}`} className="composer-recording-bar-item" style={{ "--voice-level": `${bar}` } as CSSProperties} />
                        ))}
                      </div>
                      <span className="composer-recording-time">{formatDuration(voiceComposer.durationSeconds)}</span>
                    </div>
                    <button
                      className="composer-recording-send"
                      disabled={voiceComposer.phase !== "recorded"}
                      onClick={() => void sendRecordedVoiceMessage()}
                      type="button"
                    >
                      <span className="material-symbols-outlined">send</span>
                    </button>
                  </div>
                )}
              </form>
            </div>
          ) : (
            <FeedbackState
              title="先选一个会话"
              description="左侧按最后聊天时间排列。点进一段对话后，这里才会展开具体消息。"
              action={
                groupSquareEnabled ? (
                  <Link className="button" to="/app/square">
                    去广场
                  </Link>
                ) : undefined
              }
            />
          )}
        </section>

        <aside className="panel desktop-pane">
          {selectedChat ? (
            <>
              <div className="panel-header" style={{ padding: 0, borderBottom: "1px solid rgba(232,235,242,.9)" }}>
                <p className="eyebrow">Details</p>
                <h3 className="panel-title">{selectedChat.type === "direct" ? "会话资料" : "群聊资料"}</h3>
                <p className="card-subtitle">{selectedChat.detail.summary}</p>
              </div>

              <div className="panel-scroll" style={{ paddingTop: 18 }}>
                <div className="detail-list">
                  <div className="detail-card">
                    {selectedChat.type === "direct" ? (
                      <div className="request-profile" style={{ marginBottom: 14 }}>
                        <UserAvatar
                          className={`mini-avatar ${selectedChat.online ? "status-online" : ""}`}
                          name={selectedChat.title}
                          uri={selectedChat.avatarUri}
                        />
                        <div>
                          <strong>{selectedChat.title}</strong>
                          <div className="meta-row">
                            {selectedChat.verified ? <span className="verified-badge">Verified</span> : null}
                            <span className={selectedChat.online ? "presence-badge" : "count-badge"}>{selectedChat.subtitle}</span>
                          </div>
                        </div>
                      </div>
                    ) : null}
                    <div className="detail-row">
                      <div>
                        <strong>{selectedChat.type === "direct" ? "当前状态" : "你的身份"}</strong>
                        <div className="detail-text">{selectedChat.detail.relation}</div>
                      </div>
                      {selectedChat.type === "direct" ? (
                        <span className={selectedChat.online ? "presence-badge" : "count-badge"}>{selectedChat.subtitle}</span>
                      ) : (
                        <span className="count-badge">{selectedChat.members} 人</span>
                      )}
                    </div>
                  </div>

                  <div className="detail-card">
                    <strong>{selectedChat.type === "direct" ? "会话成员" : "群成员"}</strong>
                    <div className="member-list">
                      {selectedChat.detail.members.map((member) => (
                        <div key={member.userId} className="member-line">
                          <div className="member-line-main">
                            <UserAvatar className="mini-avatar" name={member.name} uri={member.avatarUri} />
                            <span>{member.name}</span>
                          </div>
                          {member.isSelf ? <span className="count-badge">你</span> : null}
                          {selectedChat.type === "group" && selectedChat.isOwner && !member.isSelf ? (
                            <button className="ghost-button member-line-action" onClick={() => void removeGroupMember(member.userId)} type="button">
                              移除
                            </button>
                          ) : null}
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="detail-card">
                    <strong>快捷操作</strong>
                    <div className="settings-actions" style={{ marginTop: 12 }}>
                      {selectedChat.type === "group" ? (
                        <>
                          {selectedChat.isOwner ? (
                            <>
                              <button
                                className="ghost-button"
                                onClick={() => {
                                  setGroupRenameValue(selectedChat.title);
                                  setGroupRenameOpen(true);
                                }}
                                type="button"
                              >
                                重命名群聊
                              </button>
                              <button className="ghost-button" onClick={() => void openChatMemberAdder()} type="button">
                                邀请成员
                              </button>
                            </>
                          ) : null}
                          <button className="danger-button" onClick={() => setGroupDangerConfirmOpen(true)} type="button">
                            {selectedChat.isOwner ? "解散群聊" : "退出群聊"}
                          </button>
                        </>
                      ) : (
                        selectedChat.detail.actions.map((action) => (
                          <button key={action} className="ghost-button" type="button">
                            {action}
                          </button>
                        ))
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </>
          ) : (
            <FeedbackState title="选择一个会话" description="左侧选中一段聊天后，这里会显示资料和常用动作。" />
          )}
        </aside>
      </section>

      <BottomSheet
        open={groupCreateOpen}
        title="新建群聊"
        description="先选成员，再决定要不要写群名。"
        onClose={() => {
          if (groupCreateState === "creating") return;
          setGroupCreateOpen(false);
        }}
      >
        <div className="simple-form">
          <label className="field-label">群聊名称</label>
          <input className="input" placeholder="例如：产品讨论组" value={groupTitle} onChange={(event) => setGroupTitle(event.target.value)} />
          <label className="field-label">选择成员</label>
          <div className="row-subtle">仅认证用户可创建群聊，且只能邀请自己的好友。</div>
          {currentUserVerified === false ? (
            <FeedbackState title="完成认证后再创建群聊" description="群聊发起人需要先完成认证。" />
          ) : (
            <>
              <input className="input" placeholder="搜索好友" value={groupQuery} onChange={(event) => setGroupQuery(event.target.value)} />
              <div className="row-subtle">已选择 {groupSelectedIds.length} 人</div>
              <div className="simple-list">
                {groupCandidates.map((user) => {
                  const selected = groupSelectedIds.includes(user.user_id);
                  return (
                    <button key={`group-user-${user.user_id}`} className="simple-row person-row" onClick={() => toggleGroupCandidate(user.user_id)} type="button">
                      <UserAvatar className={`mini-avatar ${user.is_alive ? "status-online" : ""}`} name={user.name} uri={user.avatar_uri} />
                      <div className="row-main">
                        <strong>{user.name}</strong>
                        <div className="row-subtle">{user.is_alive ? "在线" : "离线"}</div>
                      </div>
                      {selected ? <span className="small-badge">已选</span> : <span className="count-badge">选择</span>}
                    </button>
                  );
                })}
              </div>
            </>
          )}
          <div className="button-row">
            <button className="ghost-button" onClick={() => setGroupCreateOpen(false)} type="button">
              取消
            </button>
            <button className="button" disabled={groupCreateState === "creating" || currentUserVerified === false} onClick={() => void createGroup()} type="button">
              {groupCreateState === "creating" ? "创建中..." : "创建群聊"}
            </button>
          </div>
        </div>
      </BottomSheet>

      <SideDrawer
        description={selectedChat ? (selectedChat.type === "group" ? `${selectedChat.members} 位成员` : selectedChat.subtitle) : ""}
        open={detailsSheetOpen}
        title={selectedChat?.title ?? "聊天详情"}
        onClose={() => setDetailsSheetOpen(false)}
      >
        {selectedChat ? (
          <div className="chat-detail-panel">
            <section className="chat-detail-people-section">
              <div className="section-label">{selectedChat.type === "group" ? "群成员" : "聊天成员"}</div>
              <div className="chat-detail-member-grid">
                {visibleDetailMembers.map((member) => (
                  <button
                    key={`sheet-member-${member.userId}`}
                    className={`chat-detail-member-item ${member.isOwner ? "is-owner" : ""}`}
                    onClick={() => {
                      if (!member.isSelf) setProfileDrawerUserId(member.userId);
                    }}
                    disabled={member.isSelf}
                    title={member.name}
                    type="button"
                  >
                    <UserAvatar className="chat-detail-member-avatar" name={member.name} uri={member.avatarUri} />
                    <span className="chat-detail-member-name">
                      <span className="chat-detail-member-label">{member.name}</span>
                      {member.isOwner ? <span className="chat-detail-owner-badge">群主</span> : null}
                      {member.isSelf && !member.isOwner ? <span className="chat-detail-owner-badge is-neutral">你</span> : null}
                    </span>
                  </button>
                ))}
                {selectedChat.type === "group" ? (
                  <button className="chat-detail-member-item chat-detail-member-add" onClick={openChatMemberAdder} type="button">
                    <span className="chat-detail-member-avatar chat-detail-member-avatar-add">
                      <span className="material-symbols-outlined">add</span>
                    </span>
                    <span className="chat-detail-member-name">添加</span>
                  </button>
                ) : null}
              </div>
              {hasMoreDetailMembers ? (
                <button className="ghost-button chat-detail-more-button" onClick={() => setDetailMemberLimit((current) => current + CHAT_DETAIL_MEMBER_PAGE_SIZE)} type="button">
                  更多群成员
                </button>
              ) : null}
            </section>

            <section className="chat-detail-settings-section">
              <div className="section-label">会话设置</div>
              <div className="chat-detail-settings-list">
                <div className="chat-detail-setting-row">
                  <div className="row-main">
                    <strong>置顶该聊天</strong>
                    <div className="row-subtle">固定在聊天列表最前面</div>
                  </div>
                  <button aria-label="切换置顶" className={`switch ${selectedChat.pinned ? "active" : ""}`} disabled={preferenceSaving !== null} onClick={() => void updateSelectedChatPreference("pin", !selectedChat.pinned)} type="button" />
                </div>
                {selectedChat.type === "direct" ? (
                  <div className="chat-detail-setting-row">
                    <div className="row-main">
                      <strong>上线提醒</strong>
                      <div className="row-subtle">对方重新上线时提醒我</div>
                    </div>
                    <button aria-label="切换上线提醒" className={`switch ${selectedChat.onlineReminderEnabled ? "active" : ""}`} disabled={preferenceSaving !== null} onClick={() => void updateSelectedChatPreference("online", !selectedChat.onlineReminderEnabled)} type="button" />
                  </div>
                ) : null}
                {selectedChat.type === "group" ? (
                  <div className="chat-detail-setting-row">
                    <div className="row-main chat-detail-title-main"><strong>群聊名称</strong><div className="row-subtle">{selectedChat.title}</div></div>
                    <button
                      className="chat-detail-row-icon"
                      onClick={() => {
                        setGroupRenameValue(selectedChat.title);
                        setGroupRenameOpen(true);
                      }}
                      aria-label="编辑群聊名称"
                      type="button"
                    >
                      <span className="material-symbols-outlined">edit</span>
                    </button>
                  </div>
                ) : null}
              </div>
            </section>

            <section className="chat-detail-danger-section">
              <div className="section-label">更多</div>
              <div className="chat-detail-settings-list">
                <button
                  className="chat-detail-setting-row danger-row"
                  onClick={() => void (selectedChat.type === "group" ? setGroupDangerConfirmOpen(true) : setFriendDangerConfirmOpen(true))}
                  type="button"
                >
                  <div className="row-main">
                    <strong>{selectedChat.type === "group" ? (selectedChat.isOwner ? "解散群聊" : "退出群聊") : "删除好友"}</strong>
                    <div className="row-subtle">{selectedChat.type === "group" ? "离开当前聊天" : "解除当前好友关系"}</div>
                  </div>
                  <span className="material-symbols-outlined">chevron_right</span>
                </button>
              </div>
            </section>
          </div>
        ) : null}
      </SideDrawer>
      <SideDrawer
        description="资料与共同关系"
        open={profileDrawerUserId !== null}
        title="用户详情"
        onClose={() => setProfileDrawerUserId(null)}
      >
        {profileDrawerUserId !== null ? (
          <UserProfilePanel
            userId={profileDrawerUserId}
            onOpenChat={(nextChatId) => {
              window.history.replaceState({ ...window.history.state, sermoDrawerStack: [] }, "");
              setProfileDrawerUserId(null);
              setDetailsSheetOpen(false);
              navigate(`/app/chats/${nextChatId}`);
            }}
          />
        ) : null}
      </SideDrawer>
      <InputDialog
        open={groupRenameOpen}
        title="编辑群聊名称"
        value={groupRenameValue}
        placeholder="输入群聊名称"
        confirmLabel="保存"
        busy={groupManageState === "saving"}
        onChange={setGroupRenameValue}
        onClose={() => setGroupRenameOpen(false)}
        onConfirm={() => void renameGroup()}
      />
      <ConfirmDialog
        open={groupDangerConfirmOpen}
        title={selectedChat?.isOwner ? "确认解散群聊？" : "确认退出群聊？"}
        description={selectedChat?.isOwner ? "解散后群聊会被永久移除，成员将无法继续访问。" : "退出后你将离开当前群聊，之后需要重新被邀请才能加入。"}
        confirmLabel={selectedChat?.isOwner ? "解散群聊" : "退出群聊"}
        busy={groupManageState === "saving"}
        danger
        onClose={() => {
          if (groupManageState === "saving") return;
          setGroupDangerConfirmOpen(false);
        }}
        onConfirm={() => void leaveOrDeleteGroup()}
      />
      <ConfirmDialog
        open={friendDangerConfirmOpen}
        title="确认删除好友？"
        description="删除后将解除当前好友关系。你们仍可继续查看已有聊天记录。"
        confirmLabel="删除好友"
        danger
        onClose={() => setFriendDangerConfirmOpen(false)}
        onConfirm={() => void removeFriend()}
      />
      <BottomSheet
        open={chatMemberPickerOpen}
        title=""
        onClose={() => {
          closeChatMemberPicker();
        }}
        showCloseButton={false}
        header={
          <div className="sheet-toolbar">
            <button
              className="ghost-button sheet-toolbar-button"
              onClick={closeChatMemberPicker}
              type="button"
            >
              取消
            </button>
            <div className="sheet-toolbar-title">
              <strong>{selectedChat?.type === "group" ? "添加群成员" : "添加聊天成员"}</strong>
            </div>
            <button
              className="button sheet-toolbar-button"
              disabled={groupManageState === "saving" || !chatMemberNewIds.length}
              onClick={() => void submitChatMemberPicker()}
              type="button"
            >
              {groupManageState === "saving" ? "处理中..." : selectedChat?.type === "group" ? "添加" : "完成"}
            </button>
          </div>
        }
      >
        <div className="simple-form">
          <label className="search-box page-search chat-member-picker-search">
            <span className="material-symbols-outlined">search</span>
            <input
              className="input"
              style={{ border: 0, background: "transparent", height: "auto", padding: 0 }}
              placeholder="搜索好友"
              value={groupQuery}
              onChange={(event) => setGroupQuery(event.target.value)}
            />
          </label>
          <div className="simple-list">
            {groupCandidates.map((user) => {
              const selected = groupSelectedIds.includes(user.user_id);
              const locked = chatMemberLockedIds.includes(user.user_id);
              return (
                <button
                  key={`picker-user-${user.user_id}`}
                  className={`simple-row person-row checkbox-person-row ${locked ? "is-locked" : ""}`}
                  onClick={() => toggleGroupCandidate(user.user_id)}
                  type="button"
                >
                  <UserAvatar className={`mini-avatar ${user.is_alive ? "status-online" : ""}`} name={user.name} uri={user.avatar_uri} />
                  <div className="row-main">
                    <strong>{user.name}</strong>
                    <div className="row-subtle">{locked ? "已在当前聊天中" : user.is_alive ? "在线" : "离线"}</div>
                  </div>
                  {locked ? (
                    <span className="member-picker-status member-picker-status-locked">已在群聊</span>
                  ) : (
                    <span className={`member-picker-check ${selected ? "is-selected" : ""}`} aria-hidden="true" />
                  )}
                </button>
              );
            })}
          </div>
        </div>
      </BottomSheet>
      <BottomSheet
        open={composerMoreOpen}
        title="更多消息类型"
        description="图片、视频和语音已经可以直接从输入栏使用，更多类型会继续补齐。"
        onClose={() => setComposerMoreOpen(false)}
      >
        <div className="simple-list">
          <div className="simple-row form-row composer-more-placeholder">
            <div className="row-main">
              <strong>更多能力即将支持</strong>
              <div className="row-subtle">后续这里会接入更多消息类型和快捷能力。</div>
            </div>
          </div>
        </div>
      </BottomSheet>
      <input
        ref={mediaInputRef}
        accept="image/*,video/*"
        hidden
        onChange={(event) => void handleMediaSelection(event)}
        type="file"
      />
      {imagePreviewUri ? (
        <div className="dialog-backdrop message-image-preview-backdrop" onClick={() => setImagePreviewUri(null)} role="presentation">
          <section aria-modal="true" className="message-image-preview-modal" role="dialog">
            <img alt="图片预览" className="message-image-preview" src={imagePreviewUri} />
          </section>
        </div>
      ) : null}
      {messageMenu ? (
        <div className="message-context-layer" onClick={closeMessageMenu} role="presentation">
          <div
            className={`message-context-menu ${messageMenu.placement === "bottom" ? "below" : "above"} ${messageMenu.confirmDelete ? "confirming" : ""}`}
            onClick={(event) => event.stopPropagation()}
            style={{
              left: messageMenu.anchorX,
              top: messageMenu.anchorY,
            }}
          >
            {messageMenu.confirmDelete ? (
              <>
                <div className="message-context-title">删除这条消息？</div>
                <div className="message-context-actions is-confirm">
                  <button
                    className="message-context-button"
                    disabled={messageDeleteState === "deleting"}
                    onClick={() => setMessageMenu((current) => (current ? { ...current, confirmDelete: false } : current))}
                    type="button"
                  >
                    取消
                  </button>
                  <button className="message-context-button danger" disabled={messageDeleteState === "deleting"} onClick={() => void deleteMessage()} type="button">
                    {messageDeleteState === "deleting" ? "删除中..." : "确认删除"}
                  </button>
                </div>
              </>
            ) : (
              <div
                className={`message-context-actions ${
                  messageMenu.message.kind === "text" && messageMenu.message.from === "self" && typeof messageMenu.message.id === "number"
                    ? ""
                    : messageMenu.message.kind === "text"
                      ? ""
                      : "is-single"
                }`}
              >
                {messageMenu.message.kind === "text" ? (
                  <button className="message-context-button" onClick={() => void copyMessageText()} type="button">
                    复制
                  </button>
                ) : null}
                {messageMenu.message.from === "self" && typeof messageMenu.message.id === "number" ? (
                  <button
                    className="message-context-button danger"
                    onClick={() => setMessageMenu((current) => (current ? { ...current, confirmDelete: true } : current))}
                    type="button"
                  >
                    删除
                  </button>
                ) : null}
              </div>
            )}
          </div>
        </div>
      ) : null}
      <RequestStatusModal
        open={Boolean(statusModal?.open)}
        phase={statusModal?.phase ?? "loading"}
        loadingLabel={statusModal?.loadingLabel}
        successLabel={statusModal?.successLabel}
        errorLabel={statusModal?.errorLabel}
        onAutoClose={() => setStatusModal(null)}
      />
      <AsyncErrorDialog message={pageError ?? ""} onClose={() => setPageError(null)} open={Boolean(pageError)} />
    </AppChrome>
  );
}
