import {
  memo,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type ClipboardEvent as ReactClipboardEvent,
  type CSSProperties,
  type DragEvent as ReactDragEvent,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
  type UIEvent as ReactUIEvent,
} from "react";
import { flushSync } from "react-dom";
import { Link, useLocation, useNavigate, useParams } from "react-router-dom";
import { AppChrome } from "../components/AppChrome";
import { BaxianBubbleTransition, BaxianCharacterRunner } from "../components/BaxianBubbleRunner";
import { AddFriendDrawer } from "../components/AddFriendDrawer";
import { AsyncErrorDialog } from "../components/AsyncErrorDialog";
import { BottomSheet } from "../components/BottomSheet";
import { ChatTargetPicker } from "../components/ChatTargetPicker";
import { QuietState } from "../components/BoundaryState";
import { ConfirmDialog } from "../components/ConfirmDialog";
import { CloudFilePickerSheet } from "../components/CloudFilePickerSheet";
import { FeedbackState } from "../components/FeedbackState";
import { HeaderSyncIndicator } from "../components/HeaderSyncIndicator";
import { ImageLightbox, MediaLightbox } from "../components/ImageLightbox";
import { MediaMetadataPanel } from "../components/MediaMetadataPanel";
import { MentionComposerInput, type MentionComposerHandle } from "../components/MentionComposerInput";
import { TabPageHeader } from "../components/TabPageHeader";
import { resolveTravelMapCandidates, TravelMapDrawer } from "../components/TravelMapDrawer";
import { InputDialog } from "../components/InputDialog";
import { SideDrawer } from "../components/SideDrawer";
import { SettingGroup, SettingRow, SettingSwitch } from "../components/SettingRow";
import { UserAvatar } from "../components/UserAvatar";
import { StatementMessageCard } from "../components/StatementMessageCard";
import { ActivityMessageCard } from "../components/ActivityMessageCard";
import { UserProfilePanel } from "../components/UserProfilePanel";
import { VerificationBanner } from "../components/VerificationBanner";
import { VirtualDynamicList, type VirtualDynamicListHandle } from "../components/VirtualDynamicList";
import { ApiError, api } from "../lib/api";
import { useAuth } from "../lib/auth";
import { buildChatCacheScope, chatCache } from "../lib/chatCache";
import { CHAT_SYNC_EVENT, type ChatSyncEventDetail } from "../lib/chatSync";
import { CHAT_HEALTH_EVENT, getChatHealth, recordChatHealth, resolveChatHealth, type ChatHealthSnapshot } from "../lib/chatHealth";
import { resolveMediaKind, toMessageUploadError, uploadMessageMedia } from "../lib/messageUpload";
import { addStickerFile } from "../lib/stickers";
import { cacheMediaLocally, purgeCachedMedia } from "../lib/mediaCache";
import { loadMessagesAfterThrough, loadMessagesBeforeThrough } from "../lib/messageHistory";
import { copyText, formatRelativeTime } from "../lib/presentation";
import { forgetStableResourceUri, normalizeStableResourceUri, resolveStableResourceUri } from "../lib/stableResource";
import { useGroupSquareEnabled } from "../lib/spaceFeatures";
import { usePageActive } from "../lib/pageActivity";
import { mapChatMessageSender } from "../lib/chatMessageSender";
import { showToast } from "../lib/toast";
import { FeatureDiscoveryMarker, FeatureDiscoveryTarget, useFeatureDiscovery } from "../lib/featureDiscovery";
import type { AppViewState, Chat, ChatBackgroundTheme, ChatBubbleStyle, ChatDTO, ChatHistoryRecoveryStatusDTO, ChatMessage, ChatMessageDTO, ChatMessagePayloadDTO, ChatTravelMapAccessDTO, CloudResourceDTO, EmojiUsageDTO, ForwardBundleItemDTO, ImageMetadataDTO, LinkPreviewDTO, MessageKind, MessageMediaKind, PinnedMessageDTO, QuotedMessageDTO, StickerAssetDTO, StickerDTO, TinyUserDTO, TravelMapAccessDTO, UserDTO, UserMeDTO, VideoMetadataDTO } from "../types";
import { getActiveLocale, i18n, useI18n, type TranslationKey } from "../lib/language";
import chatPreviewMediaImage from "../assets/square/plaza-waterfront.jpg";

const DEBUG_CHAT_SEND = import.meta.env.DEV;
const CHAT_DETAIL_MEMBER_PAGE_SIZE = 19;
const STICKER_PAGE_SIZE = 30;
const MESSAGE_TYPE_TEXT = 0;
const MESSAGE_TYPE_IMAGE = 1;
const MESSAGE_TYPE_FILE = 2;
const MESSAGE_TYPE_SYSTEM = 3;
const MESSAGE_TYPE_VIDEO = 4;
const MESSAGE_TYPE_AUDIO = 5;
const MESSAGE_TYPE_LOCATION = 6;
const MESSAGE_TYPE_MAP_ACCESS = 7;
const MESSAGE_TYPE_STATEMENT = 8;
const MESSAGE_TYPE_STICKER = 9;
const MESSAGE_TYPE_FORWARD_BUNDLE = 10;
const MESSAGE_TYPE_ACTIVITY = 11;
const MESSAGE_SEARCH_TYPES = [
  { value: null, label: "messageSearch.all" },
  { value: MESSAGE_TYPE_TEXT, label: "messageSearch.text" },
  { value: MESSAGE_TYPE_IMAGE, label: "messageSearch.images" },
  { value: MESSAGE_TYPE_VIDEO, label: "messageSearch.videos" },
  { value: MESSAGE_TYPE_AUDIO, label: "messageSearch.audio" },
  { value: MESSAGE_TYPE_FILE, label: "messageSearch.files" },
  { value: MESSAGE_TYPE_LOCATION, label: "messageSearch.locations" },
  { value: MESSAGE_TYPE_MAP_ACCESS, label: "messageSearch.travelMaps" },
  { value: MESSAGE_TYPE_STATEMENT, label: "messageSearch.statements" },
  { value: MESSAGE_TYPE_STICKER, label: "sticker.tab" },
  { value: MESSAGE_TYPE_ACTIVITY, label: "messageSearch.activities" },
] as const;
const AUDIO_MAX_DURATION_SECONDS = 60;
const EMOJI_PAGES = [
  {
    labelKey: "emoji.frequent",
    icon: "🕘",
    emojis: [
      "😀", "😄", "😁", "😂", "🥹", "😊", "🙂", "🙃", "😉", "😍", "🥰", "😘",
      "😋", "😎", "🤓", "🫡", "🤔", "🤭", "🫢", "😶", "😅", "🥲", "😴", "😭",
      "😤", "😡", "🤯", "🥳", "🤩", "😇", "🤗", "🫠", "👍", "👎", "👌", "✌️",
      "🤝", "👏", "🙌", "🙏", "💪", "👀", "❤️", "💔", "🔥", "✨", "🎉", "💯",
    ],
  },
  {
    labelKey: "emoji.faces",
    icon: "😊",
    emojis: [
      "😃", "😆", "🤣", "😌", "😏", "😒", "🙄", "😬", "😮‍💨", "🤥", "🫣", "🤫",
      "🤐", "🫥", "😐", "😑", "😯", "😦", "😧", "😮", "😲", "🥱", "😵", "😵‍💫",
      "🤤", "🤢", "🤮", "🤧", "🥴", "🤒", "🤕", "🤑", "🤠", "😈", "👿", "👻",
      "💀", "☠️", "👽", "🤖", "💩", "😺", "😸", "😹", "😻", "😼", "🙀", "😿",
    ],
  },
  {
    labelKey: "emoji.gestures",
    icon: "👋",
    emojis: [
      "👋", "🤚", "🖐️", "✋", "🖖", "🫱", "🫲", "🫳", "🫴", "🫷", "🫸", "🤌",
      "🤏", "🫰", "🤞", "🫶", "🤟", "🤘", "🤙", "👈", "👉", "👆", "👇", "☝️",
      "🫵", "✊", "👊", "🤛", "🤜", "🫂", "🙌", "👏", "🤝", "🙏", "✍️", "💅",
      "🤳", "💪", "🦾", "🦵", "🦶", "👂", "👃", "🧠", "🫀", "🫁", "👀", "👁️",
    ],
  },
  {
    labelKey: "emoji.life",
    icon: "🎈",
    emojis: [
      "🌞", "🌙", "⭐", "🌈", "☁️", "❄️", "🌊", "🌱", "🌸", "🌻", "🍀", "🍎",
      "🍓", "🍉", "🍜", "🍰", "☕", "🍻", "🎂", "🎁", "🎈", "🎊", "🎵", "🎧",
      "🎬", "📷", "🎮", "⚽", "🏀", "🏸", "🚗", "✈️", "🏠", "🏕️", "🌆", "🗺️",
      "🐶", "🐱", "🐼", "🐰", "🦊", "🐻", "🐧", "🦋", "💐", "🍃", "🚀", "💡",
    ],
  },
  {
    labelKey: "emoji.symbols",
    icon: "❤️",
    emojis: [
      "❤️", "🧡", "💛", "💚", "🩵", "💙", "💜", "🖤", "🩶", "🤍", "🤎", "💔",
      "❤️‍🔥", "❤️‍🩹", "💕", "💞", "💓", "💗", "💖", "💘", "💝", "💟", "❣️", "💯",
      "💢", "💥", "💫", "💦", "💨", "💬", "💭", "✅", "❌", "⭕", "❗", "❓",
      "‼️", "⁉️", "⚠️", "🔔", "🔕", "🔒", "🔑", "📌", "📍", "♻️", "➕", "➖",
    ],
  },
] as const;
const EMOJI_SEQUENCE_RE = /(?:[\u{1F1E6}-\u{1F1FF}]{2}|\p{Extended_Pictographic}(?:\uFE0F|\p{Emoji_Modifier})?(?:\u200D\p{Extended_Pictographic}(?:\uFE0F|\p{Emoji_Modifier})?)*)/gu;
const STICKER_MY_PAGE = -2;
const STICKER_EXPLORE_PAGE = -1;
const TEXT_URL_RE = /https?:\/\/[^\s<>"'，。！？、；：）】》]+/gi;
const LINK_TRAILING_PUNCTUATION = ".,;:!?)]}，。！？、；：）】》";

type ChatRouteState = {
  chatAccessError?: string;
};

type ClipboardUploadCandidate = {
  files: File[];
  previewUris: Array<string | null>;
  source: "clipboard" | "drop";
};

type LocationDraft = {
  phase: "locating" | "ready" | "sending" | "error";
  latitude?: number;
  longitude?: number;
  accuracy?: number;
  obscure?: boolean;
  error?: string;
};

function extractMessageEmojis(text: string) {
  return text.match(EMOJI_SEQUENCE_RE) ?? [];
}

function sortEmojiUsage(rows: EmojiUsageDTO[]) {
  const nowSeconds = Date.now() / 1000;
  return [...rows].sort((left, right) => {
    const leftScore = Math.log1p(left.use_count) * Math.exp(-Math.max(0, nowSeconds - left.last_used_at) / (30 * 86400));
    const rightScore = Math.log1p(right.use_count) * Math.exp(-Math.max(0, nowSeconds - right.last_used_at) / (30 * 86400));
    return rightScore - leftScore;
  });
}

function messageResultPreview(message: ChatMessageDTO) {
  if (message.type === MESSAGE_TYPE_TEXT) return readableMentionText(message.content, message.mentions ?? []);
  return {
    [MESSAGE_TYPE_IMAGE]: i18n.t("media.image"),
    [MESSAGE_TYPE_FILE]: message.payload?.file_name || i18n.t("media.file"),
    [MESSAGE_TYPE_VIDEO]: i18n.t("media.video"),
    [MESSAGE_TYPE_AUDIO]: message.payload?.duration_seconds
      ? i18n.t("message.audioDuration", { seconds: Math.round(message.payload.duration_seconds) })
      : i18n.t("media.audio"),
    [MESSAGE_TYPE_LOCATION]: i18n.t("media.location"),
    [MESSAGE_TYPE_MAP_ACCESS]: i18n.t("travelMap.action"),
    [MESSAGE_TYPE_STATEMENT]: i18n.t("message.statementPlaceholder"),
    [MESSAGE_TYPE_ACTIVITY]: i18n.t("message.activityPlaceholder"),
  }[message.type] ?? i18n.t("message.generic");
}

function pinnedMessagePreview(pin: PinnedMessageDTO) {
  return messageResultPreview(pin.message);
}

function pinnedByLabel(pin: PinnedMessageDTO) {
  const names = pin.pinned_by_users.map((user) => user.name);
  if (!names.length) return i18n.t("chat.members");
  if (names.length <= 2) return names.join("、");
  return i18n.t("chat.peopleIncluding", { name: names[0], count: names.length });
}

function avatarLabel(name: string) {
  return name.slice(0, 2).toUpperCase();
}

function visibleBubbleStyle(style?: string) {
  return [
    "comic", "vip", "zen", "hero", "dragon", "bauhaus", "mosaic",
    "typewriter", "newspaper", "receipt", "niko", "fufu", "xiaobai",
    "baxian-lv", "baxian-zhongli", "baxian-he",
    "city-jdz", "city-shanghai", "city-nyc", "city-beijing",
  ].includes(style ?? "") ? style as ChatBubbleStyle : "default";
}

const MENTION_SELECTION_ACCENTS: Record<ChatBubbleStyle, string> = {
  default: "#00a86b",
  comic: "#e49328",
  vip: "#b67b22",
  niko: "#916846",
  fufu: "#747a28",
  xiaobai: "#7657a8",
  "baxian-lv": "#2f78ad",
  "baxian-zhongli": "#b34f39",
  "baxian-he": "#ad3e78",
  zen: "#b84b3c",
  hero: "#d9473f",
  dragon: "#a82d26",
  bauhaus: "#d84638",
  mosaic: "#d8904e",
  typewriter: "#9c3f35",
  newspaper: "#a62f2f",
  receipt: "#28775b",
  "city-jdz": "#b54b3f",
  "city-shanghai": "#f2bd55",
  "city-nyc": "#c59a47",
  "city-beijing": "#d2a23e",
};

function mentionSelectionAccent(style?: string) {
  return MENTION_SELECTION_ACCENTS[visibleBubbleStyle(style)];
}

function readableMentionText(text: string, mentions: Array<{ user_id: number; name: string }>) {
  const names = new Map(mentions.map((user) => [user.user_id, user.name]));
  return text.replace(/<@(\d+)>/g, (_, userId: string) => `@${names.get(Number(userId)) || userId}`);
}

function ComposerSvgIcon({ kind, className }: { kind: "album" | "file" | "location" | "map" | "mic" | "stop" | "delete" | "emoji" | "keyboard" | "pin" | "pin-off"; className?: string }) {
  if (kind === "emoji") {
    return (
      <svg aria-hidden="true" className={className} fill="none" viewBox="0 0 24 24">
        <circle cx="12" cy="12" r="8.25" stroke="currentColor" strokeWidth="1.8" />
        <circle cx="9" cy="10" r="1" fill="currentColor" />
        <circle cx="15" cy="10" r="1" fill="currentColor" />
        <path d="M8.5 14c.85 1.35 2 2.05 3.5 2.05s2.65-.7 3.5-2.05" stroke="currentColor" strokeLinecap="round" strokeWidth="1.8" />
      </svg>
    );
  }

  if (kind === "keyboard") {
    return (
      <svg aria-hidden="true" className={className} fill="none" viewBox="0 0 24 24">
        <rect x="3.25" y="5.25" width="17.5" height="13.5" rx="3" stroke="currentColor" strokeWidth="1.7" />
        <path d="M7 9h.01M10.35 9h.01M13.7 9h.01M17 9h.01M7 12.35h.01M10.35 12.35h.01M13.7 12.35h.01M17 12.35h.01M8.2 15.7h7.6" stroke="currentColor" strokeLinecap="round" strokeWidth="1.9" />
      </svg>
    );
  }

  if (kind === "pin" || kind === "pin-off") {
    return (
      <svg aria-hidden="true" className={className} fill="none" viewBox="0 0 24 24">
        <path d="M8 3.75h8" stroke="currentColor" strokeLinecap="round" strokeWidth="1.85" />
        <path d="m9.35 4 .6 5.05-2.45 2.5v1.35h9v-1.35l-2.45-2.5.6-5.05" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.85" />
        <path d="M12 12.9v7.35" stroke="currentColor" strokeLinecap="round" strokeWidth="1.85" />
        {kind === "pin-off" ? <path d="M4.2 4.2 19.8 19.8" stroke="currentColor" strokeLinecap="round" strokeWidth="1.75" /> : null}
      </svg>
    );
  }

  if (kind === "album") {
    return (
      <svg aria-hidden="true" className={className} fill="none" viewBox="0 0 24 24">
        <rect x="3.5" y="5" width="17" height="14" rx="3.5" stroke="currentColor" strokeWidth="1.8" />
        <circle cx="9" cy="10" r="1.7" fill="currentColor" />
        <path d="M7 16.5 11.2 12.3a1.1 1.1 0 0 1 1.56 0l1.58 1.58a1.1 1.1 0 0 0 1.56 0L17 12.6l3.5 3.9" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" />
      </svg>
    );
  }

  if (kind === "file") {
    return (
      <svg aria-hidden="true" className={className} fill="none" viewBox="0 0 24 24">
        <path d="M7 3.75h6.7L18.5 8.6v11.65H7V3.75Z" stroke="currentColor" strokeLinejoin="round" strokeWidth="1.8" />
        <path d="M13.5 4v5h4.75M9.5 13h6M9.5 16.5h4.25" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" />
      </svg>
    );
  }

  if (kind === "location") {
    return (
      <svg aria-hidden="true" className={className} fill="none" viewBox="0 0 24 24">
        <path d="M19 10.2c0 5.1-7 10-7 10s-7-4.9-7-10a7 7 0 1 1 14 0Z" stroke="currentColor" strokeLinejoin="round" strokeWidth="1.8" />
        <circle cx="12" cy="10.2" r="2.35" fill="currentColor" />
      </svg>
    );
  }

  if (kind === "map") {
    return (
      <svg aria-hidden="true" className={className} fill="none" viewBox="0 0 24 24">
        <path d="m3.5 5.75 5-2.25 7 2.25 5-2.25v14.75l-5 2.25-7-2.25-5 2.25V5.75Z" stroke="currentColor" strokeLinejoin="round" strokeWidth="1.7" />
        <path d="M8.5 3.5v14.75m7-12.5V20.5" stroke="currentColor" strokeWidth="1.7" />
        <path d="M13.4 10.2c0 1.75-2.4 3.45-2.4 3.45s-2.4-1.7-2.4-3.45a2.4 2.4 0 1 1 4.8 0Z" fill="currentColor" />
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

function FufuBubbleRunner() {
  const runnerRef = useRef<HTMLSpanElement | null>(null);

  useEffect(() => {
    const runner = runnerRef.current;
    const track = runner?.parentElement;
    if (!runner || !track) return;

    const updateTrack = () => {
      const distance = Math.max(0, track.clientWidth - 32);
      const duration = Math.max(1.1, distance / 64.8);
      runner.style.setProperty("--fufu-run-distance", `${distance}px`);
      runner.style.setProperty("--fufu-run-duration", `${duration}s`);
    };
    updateTrack();
    const observer = new ResizeObserver(updateTrack);
    observer.observe(track);
    return () => observer.disconnect();
  }, []);

  return <span ref={runnerRef} aria-hidden="true" className="fufu-bubble-runner" />;
}

function NikoBubbleRunner() {
  return <span aria-hidden="true" className="niko-bubble-runner" />;
}

function XiaobaiBubbleRunner() {
  return <span aria-hidden="true" className="xiaobai-bubble-runner" />;
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
        aria-label={isLoading ? i18n.t("audio.loading") : isPlaying ? i18n.t("audio.pause") : i18n.t("audio.play")}
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
            <span>{i18n.t("message.audio")}</span>
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
  if (type === MESSAGE_TYPE_LOCATION) return "location";
  if (type === MESSAGE_TYPE_MAP_ACCESS) return "map_access";
  if (type === MESSAGE_TYPE_STATEMENT) return "statement";
  if (type === MESSAGE_TYPE_STICKER) return "sticker";
  if (type === MESSAGE_TYPE_FORWARD_BUNDLE) return "forward_bundle";
  if (type === MESSAGE_TYPE_ACTIVITY) return "activity";
  if (type === MESSAGE_TYPE_SYSTEM) return "system";
  return "text";
}

function messageTypeFromKind(kind: MessageMediaKind) {
  if (kind === "image") return MESSAGE_TYPE_IMAGE;
  if (kind === "video") return MESSAGE_TYPE_VIDEO;
  if (kind === "file") return MESSAGE_TYPE_FILE;
  return MESSAGE_TYPE_AUDIO;
}

function isMediaMessageKind(kind: MessageKind) {
  return kind === "image" || kind === "video" || kind === "audio" || kind === "file";
}

function formatFileSize(value?: number) {
  const bytes = Math.max(0, Number(value) || 0);
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(bytes >= 10 * 1024 * 1024 ? 0 : 1)} MB`;
  if (bytes >= 1024) return `${Math.ceil(bytes / 1024)} KB`;
  return `${bytes} B`;
}

function formatThreadDivider(value: number) {
  const date = new Date(value * 1000);
  const now = new Date();
  const isSameDay = date.toDateString() === now.toDateString();

  if (isSameDay) return formatTime(value);

  return new Intl.DateTimeFormat(getActiveLocale(), {
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
    return i18n.t("time.hoursAgo", { count: Math.floor(minutes / 60) });
  }
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  if (date.toDateString() === yesterday.toDateString()) return i18n.t("time.yesterday");
  return new Intl.DateTimeFormat(getActiveLocale(), { month: "numeric", day: "numeric" }).format(date);
}

function formatPresence(user: UserDTO | null) {
  if (!user) return i18n.t("presence.unavailable");
  if (user.is_alive) return i18n.t("presence.online");

  const minutes = Math.floor(Date.now() / 1000 - user.last_heartbeat) / 60;
  if (minutes < 30) return i18n.t("presence.recentlyActive");
  return i18n.t("presence.offline");
}

function systemMessageText(message: ChatMessageDTO) {
  const payload = message.payload;
  return payload?.text || message.content || i18n.t("message.system.placeholder");
}

function mapChatMessage(message: ChatMessageDTO, currentUserId: number): ChatMessage {
  const kind = message.payload?.kind ?? messageKindFromType(message.type);
  const text = kind === "system" ? systemMessageText(message) : message.payload?.text || message.content;
  return {
    id: message.message_id,
    clientId: message.client_message_id || `server:${message.message_id}`,
    ...mapChatMessageSender(message, currentUserId),
    type: message.type,
    kind,
    time: formatTime(message.created_at),
    createdAt: message.created_at,
    text,
    payload: message.payload ?? (kind === "text" ? { kind: "text", text: message.content } : null),
    replyTo: message.reply_to ?? null,
    mentions: message.mentions ?? [],
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
  if (source.from !== "self" || target.from !== "self" || source.status === "sent" || target.status !== "sent") return false;
  if (source.kind !== target.kind) return false;
  if (source.kind === "text") {
    return source.text === target.text && Math.abs(source.createdAt - target.createdAt) <= 30;
  }
  if (source.kind === "sticker") {
    return Boolean(source.payload?.content_hash && source.payload.content_hash === target.payload?.content_hash);
  }
  return isMediaMessageKind(source.kind) && source.status === "pending" && Math.abs(source.createdAt - target.createdAt) <= 600;
}

function preserveStableMediaUri(existing: ChatMessage | undefined, incoming: ChatMessage) {
  if (!existing) return incoming;
  const reconciled = {
    ...incoming,
    clientId: existing.clientId,
    localPreviewUri: existing.localPreviewUri,
    isPermanentVip: incoming.isPermanentVip ?? existing.isPermanentVip,
    chatBubbleStyle: incoming.chatBubbleStyle ?? existing.chatBubbleStyle,
    avatarFrameStyle: incoming.avatarFrameStyle ?? existing.avatarFrameStyle,
  };
  if (!existing.payload?.uri || !incoming.payload?.uri) return reconciled;
  if (!isMediaMessageKind(existing.kind) || !isMediaMessageKind(incoming.kind)) return reconciled;
  if (existing.kind !== incoming.kind) return reconciled;

  const existingResource = normalizeStableResourceUri(existing.payload.uri);
  const incomingResource = normalizeStableResourceUri(incoming.payload.uri);
  if (!existingResource || existingResource !== incomingResource) return reconciled;
  if (existing.payload.uri === incoming.payload.uri) return reconciled;

  return {
    ...reconciled,
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

    let optimisticMatch: ChatMessage | undefined;
    if (message.status === "sent" && !existingByClientId) {
      optimisticMatch = [...bucket.values()].find((existing) => isOptimisticSelfMatch(existing, message));
      if (optimisticMatch) {
        bucket.delete(optimisticMatch.id);
      }
    }

    if (message.status !== "sent") {
      const deliveredMatch = [...bucket.values()].find((existing) => isOptimisticSelfMatch(message, existing));
      if (deliveredMatch) return;
    }

    const existingMessage = existingByClientId ?? optimisticMatch ?? bucket.get(message.id);
    bucket.set(message.id, preserveStableMediaUri(existingMessage, message));
  });

  return sortMessages([...bucket.values()]);
}

type PendingMessageAppearance = Pick<ChatMessage, "isPermanentVip" | "chatBubbleStyle" | "avatarFrameStyle">;

function createPendingMessage(
  text: string,
  name: string,
  userId: number,
  appearance: PendingMessageAppearance,
  mentions: TinyUserDTO[] = [],
  replyTo?: QuotedMessageDTO | null,
): ChatMessage {
  const clientId = `temp:${Date.now()}:${Math.random().toString(36).slice(2, 8)}`;
  const createdAt = Math.floor(Date.now() / 1000);
  const linkUrl = extractFirstMessageUrl(text);
  return {
    id: clientId,
    clientId,
    userId,
    from: "self",
    type: MESSAGE_TYPE_TEXT,
    kind: "text",
    name,
    ...appearance,
    time: formatTime(createdAt),
    createdAt,
    text,
    payload: { kind: "text", text, link_preview: linkUrl ? { url: linkUrl, status: "pending" } : null },
    replyTo,
    mentions,
    status: "pending",
  };
}

function quoteFromMessage(message: ChatMessage): QuotedMessageDTO | null {
  if (typeof message.id !== "number") return null;
  return {
    message_id: message.id,
    user: {
      user_id: message.userId ?? 0,
      name: message.name,
      avatar_type: message.avatarUri ? "custom" : "preset",
      avatar_uri: message.avatarUri ?? "",
      official: false,
    },
    type: message.type,
    content: previewFromMessage(message),
    is_deleted: false,
  };
}

function updateMessageStatus(messages: ChatMessage[], clientId: string, status: ChatMessage["status"]) {
  return messages.map((message) => (message.clientId === clientId ? { ...message, status } : message));
}

function confirmPendingMessage(messages: ChatMessage[], clientId: string, delivered: ChatMessage) {
  const pending = messages.find((message) => message.clientId === clientId);
  const remaining = messages.filter((message) => message.clientId !== clientId && message.id !== delivered.id);
  return sortMessages([...remaining, preserveStableMediaUri(pending, delivered)]);
}

function updateChatSummary(chat: Chat, preview: string, lastActivity: number) {
  return {
    ...chat,
    preview,
    time: i18n.t("time.justNow"),
    lastActivity,
    unread: 0,
  };
}

function previewFromKind(kind: MessageKind, text: string) {
  if (kind === "image") return i18n.t("message.imagePlaceholder");
  if (kind === "video") return i18n.t("message.videoPlaceholder");
  if (kind === "audio") return i18n.t("message.audioPlaceholder");
  if (kind === "file") return i18n.t("message.filePlaceholder");
  if (kind === "location") return i18n.t("message.locationPlaceholder");
  if (kind === "map_access") return i18n.t("travelMap.action");
  if (kind === "statement") return i18n.t("message.statementPlaceholder");
  if (kind === "sticker") return i18n.t("sticker.messagePlaceholder");
  if (kind === "forward_bundle") return i18n.t("message.forwardBundlePlaceholder");
  if (kind === "activity") return i18n.t("message.activityPlaceholder");
  if (kind === "system") return text || i18n.t("message.system.placeholder");
  return text || i18n.t("chat.noMessages");
}

function previewFromMessage(message: Pick<ChatMessage, "kind" | "text" | "mentions">) {
  const text = message.kind === "text" ? readableMentionText(message.text, message.mentions ?? []) : message.text;
  return previewFromKind(message.kind, text);
}

function previewFromDto(message: ChatMessageDTO | null) {
  if (!message) return i18n.t("chat.noMessages");
  const kind = message.payload?.kind ?? messageKindFromType(message.type);
  const rawText = kind === "system" ? systemMessageText(message) : message.payload?.text || message.content;
  const text = kind === "text" ? readableMentionText(rawText, message.mentions ?? []) : rawText;
  return previewFromKind(kind, text);
}

function clearChatUnread(chat: Chat) {
  if (chat.unread === 0 && !chat.hasUnreadMention) return chat;
  return {
    ...chat,
    unread: 0,
    hasUnreadMention: false,
  };
}

function shouldGroupMessages(current: ChatMessage, neighbor?: ChatMessage) {
  if (!neighbor) return false;
  if (current.kind === "system" || neighbor.kind === "system") return false;
  if (current.from !== neighbor.from || Math.abs(current.createdAt - neighbor.createdAt) >= 5 * 60) return false;
  if (visibleBubbleStyle(current.chatBubbleStyle) !== visibleBubbleStyle(neighbor.chatBubbleStyle)) return false;
  if (current.from === "self") return true;
  if (current.userId !== undefined && neighbor.userId !== undefined) return current.userId === neighbor.userId;
  return current.name === neighbor.name && current.avatarUri === neighbor.avatarUri;
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
  metadata,
  messageId,
  onOpenImage,
  thumbnailUri,
  uri,
}: {
  groupClassName: string;
  metadata?: ImageMetadataDTO | null;
  messageId?: number;
  onOpenImage?: (uris: string[], index: number, metadata?: Array<ImageMetadataDTO | null>, messageIds?: Array<number | null>) => void;
  thumbnailUri?: string;
  uri: string;
}) {
  const [loaded, setLoaded] = useState(false);
  const [retryWithFreshUri, setRetryWithFreshUri] = useState(false);
  const imageRef = useRef<HTMLImageElement | null>(null);
  const resolvedUri = retryWithFreshUri ? uri : resolveStableResourceUri(uri) ?? uri;
  const resolvedThumbnailUri = resolveStableResourceUri(thumbnailUri) ?? thumbnailUri;
  const imageAspect = metadata?.pixel_width && metadata.pixel_height
    ? metadata.pixel_width / metadata.pixel_height
    : null;
  const frameStyle = imageAspect
    ? { "--message-image-aspect": imageAspect } as CSSProperties
    : undefined;

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
      className={`message-media-frame image-button ${imageAspect ? "has-intrinsic-size" : ""} ${groupClassName} ${loaded ? "is-loaded" : "is-loading"}`.trim()}
      onClick={() => onOpenImage?.([resolvedUri], 0, [metadata ?? null], [messageId ?? null])}
      style={frameStyle}
      type="button"
    >
      {resolvedThumbnailUri ? <img alt="" aria-hidden="true" className="message-media-image message-media-image-thumb" src={resolvedThumbnailUri} /> : null}
      <img
        alt={i18n.t("message.image")}
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

const MessageMediaVideo = memo(function MessageMediaVideo({
  groupClassName,
  messageId,
  metadata,
  onOpenVideo,
  thumbnailUri,
  uri,
}: {
  groupClassName: string;
  messageId?: number;
  metadata?: VideoMetadataDTO | null;
  onOpenVideo?: (uri: string, metadata: VideoMetadataDTO | null, messageId: number | null) => void;
  thumbnailUri?: string;
  uri: string;
}) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const previewPosterOnly = uri === "preview://video";
  const metadataAspectRatio = metadata?.pixel_width && metadata.pixel_height
    && Number.isFinite(metadata.pixel_width) && Number.isFinite(metadata.pixel_height)
    && metadata.pixel_width > 0 && metadata.pixel_height > 0
    ? metadata.pixel_width / metadata.pixel_height
    : null;
  const hasPoster = Boolean(thumbnailUri);
  const [loaded, setLoaded] = useState(previewPosterOnly || hasPoster);
  const [duration, setDuration] = useState(0);
  const [aspectRatio, setAspectRatio] = useState<number | null>(metadataAspectRatio);
  const [retryWithFreshUri, setRetryWithFreshUri] = useState(false);
  const resolvedUri = retryWithFreshUri ? uri : resolveStableResourceUri(uri) ?? uri;
  const resolvedThumbnailUri = resolveStableResourceUri(thumbnailUri) ?? thumbnailUri;

  useEffect(() => {
    setLoaded(previewPosterOnly || hasPoster);
    setDuration(0);
    setAspectRatio(metadataAspectRatio);
    setRetryWithFreshUri(false);
  }, [hasPoster, metadataAspectRatio, previewPosterOnly, uri]);

  return (
    <div
      className={`message-media-frame message-video-card ${groupClassName} ${loaded ? "is-loaded" : "is-loading"}`.trim()}
      style={aspectRatio ? { "--message-video-aspect": aspectRatio } as CSSProperties : undefined}
    >
      <button
        aria-label={i18n.t("video.view")}
        className="message-video-surface"
        onClick={() => onOpenVideo?.(resolvedUri, metadata ?? null, messageId ?? null)}
        type="button"
      >
        {previewPosterOnly ? (
          <img alt="" aria-hidden="true" className="message-media-video message-video-preview-poster" src={resolvedThumbnailUri} />
        ) : (
          <video
            className="message-media-video"
            onCanPlay={() => setLoaded(true)}
            onDurationChange={(event) => {
              const value = event.currentTarget.duration;
              if (Number.isFinite(value)) setDuration(value);
            }}
            onError={() => {
              if (!retryWithFreshUri) {
                forgetStableResourceUri(uri);
                setRetryWithFreshUri(true);
              }
            }}
            onLoadedMetadata={(event) => {
              const video = event.currentTarget;
              setLoaded(true);
              if (video.videoWidth > 0 && video.videoHeight > 0) {
                const measuredAspectRatio = video.videoWidth / video.videoHeight;
                const metadataMismatch = metadataAspectRatio !== null
                  && Math.abs(measuredAspectRatio - metadataAspectRatio) / metadataAspectRatio > 0.05;
                if (metadataAspectRatio === null || metadataMismatch) {
                  setAspectRatio(measuredAspectRatio);
                }
              }
              if (Number.isFinite(video.duration)) setDuration(video.duration);
            }}
            playsInline
            poster={resolvedThumbnailUri}
            preload="metadata"
            ref={videoRef}
            src={resolvedUri}
          />
        )}
        <span className="message-video-shade" aria-hidden="true" />
        <span className="message-video-play" aria-hidden="true">
          <svg viewBox="0 0 24 24"><path d="m9 6 9 6-9 6Z" /></svg>
        </span>
      </button>
      <div className="message-video-meta">
        <span>{formatDuration(metadata?.duration_seconds ?? duration)}</span>
      </div>
    </div>
  );
});

const MessageImageGallery = memo(function MessageImageGallery({
  from,
  isEntering,
  isFirst,
  isLast,
  messages,
  onOpenImage,
  onOpenActions,
  onRetry,
  onToggleSelection,
  selectedClientIds,
  selectionMode,
}: {
  from: "self" | "other";
  isEntering: boolean;
  isFirst: boolean;
  isLast: boolean;
  messages: ChatMessage[];
  onOpenImage: (uris: string[], index: number, metadata?: Array<ImageMetadataDTO | null>, messageIds?: Array<number | null>) => void;
  onOpenActions: (message: ChatMessage, element: HTMLElement, pointerX?: number) => void;
  onRetry: (message: ChatMessage) => void;
  onToggleSelection: (message: ChatMessage) => void;
  selectedClientIds: string[];
  selectionMode: boolean;
}) {
  const longPressTimerRef = useRef<number | null>(null);
  const pointerStartRef = useRef<{ index: number; x: number; y: number } | null>(null);
  const suppressClickRef = useRef<number | null>(null);
  const visibleMessages = messages.slice(0, 18);
  const columns = messages.length === 2 || messages.length === 4 ? 2 : 3;
  const fullUris = messages.map((message) => {
    const uri = message.localPreviewUri ?? message.payload?.uri ?? "";
    return resolveStableResourceUri(uri) ?? uri;
  });
  const imageMetadata = messages.map((message) => message.payload?.image_metadata ?? null);
  const imageMessageIds = messages.map((message) => typeof message.id === "number" ? message.id : null);
  const groupClassName = [from, isFirst ? "group-start" : "", isLast ? "group-end" : ""]
    .filter(Boolean)
    .join(" ");

  const clearLongPress = () => {
    if (longPressTimerRef.current !== null) {
      window.clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
    pointerStartRef.current = null;
  };

  useEffect(() => clearLongPress, []);

  const startLongPress = (event: ReactPointerEvent<HTMLButtonElement>, message: ChatMessage, index: number) => {
    if (selectionMode) return;
    if (event.pointerType === "mouse" && event.button !== 0) return;
    clearLongPress();
    const element = event.currentTarget;
    pointerStartRef.current = { index, x: event.clientX, y: event.clientY };
    longPressTimerRef.current = window.setTimeout(() => {
      suppressClickRef.current = index;
      clearLongPress();
      onOpenActions(message, element);
    }, 380);
  };

  return (
    <div className={`message-bubble-wrap ${from} is-sent ${isEntering ? "is-entering" : ""}`}>
      <div className={`message-bubble-shell ${from}${isFirst ? " group-start" : ""}`}>
        <div
          className={`message-image-gallery message-media-frame ${groupClassName}`}
          style={{ "--message-gallery-columns": columns } as CSSProperties}
        >
          {visibleMessages.map((message, index) => {
            const uri = fullUris[index];
            const thumbnailUri = message.localPreviewUri ? undefined : message.payload?.thumbnail_uri;
            const displayUri = resolveStableResourceUri(thumbnailUri) ?? thumbnailUri ?? uri;
            const hasMore = index === 17 && messages.length > 18;
            return (
              <button
                key={message.clientId}
                data-message-id={typeof message.id === "number" ? message.id : undefined}
                aria-label={i18n.t("image.viewNumber", { index: index + 1 })}
                aria-pressed={selectionMode ? selectedClientIds.includes(message.clientId) : undefined}
                className={`message-image-gallery-item is-${message.status} ${hasMore ? "has-more" : ""}${selectionMode ? " is-selection-mode" : ""}${selectedClientIds.includes(message.clientId) ? " is-selected" : ""}`}
                onClick={(event) => {
                  if (selectionMode) {
                    event.preventDefault();
                    onToggleSelection(message);
                    return;
                  }
                  if (suppressClickRef.current === index) {
                    suppressClickRef.current = null;
                    event.preventDefault();
                    return;
                  }
                  if (message.status === "failed") {
                    event.preventDefault();
                    event.stopPropagation();
                    onRetry(message);
                    return;
                  }
                  onOpenImage(fullUris, index, imageMetadata, imageMessageIds);
                }}
                onContextMenu={(event) => {
                  event.preventDefault();
                  if (selectionMode) return;
                  clearLongPress();
                  onOpenActions(message, event.currentTarget, event.clientX);
                }}
                onPointerCancel={clearLongPress}
                onPointerDown={(event) => startLongPress(event, message, index)}
                onPointerLeave={clearLongPress}
                onPointerMove={(event) => {
                  const start = pointerStartRef.current;
                  if (!start || start.index !== index) return;
                  if (Math.abs(event.clientX - start.x) > 8 || Math.abs(event.clientY - start.y) > 8) clearLongPress();
                }}
                onPointerUp={clearLongPress}
                type="button"
              >
                <img alt="" loading="lazy" src={displayUri} />
                {selectionMode ? <span className="message-selection-check" aria-hidden="true" /> : null}
                {hasMore ? (
                  <span className="message-image-gallery-more">
                    <span className="material-symbols-outlined" aria-hidden="true">photo_library</span>
                    <strong>+{messages.length - 18}</strong>
                  </span>
                ) : null}
                {message.status === "failed" ? (
                  <span className="message-image-gallery-failed" aria-label={i18n.t("message.retrySend")} title={i18n.t("message.retrySend")}>
                    <span className="material-symbols-outlined" aria-hidden="true">refresh</span>
                  </span>
                ) : null}
              </button>
            );
          })}
          {isFirst ? <NikoBubbleRunner /> : null}
          {isFirst ? <XiaobaiBubbleRunner /> : null}
          {isFirst ? <BaxianCharacterRunner style={messages[0]?.chatBubbleStyle} /> : null}
          <BaxianBubbleTransition animate={!isLast} style={messages[0]?.chatBubbleStyle} />
          {isLast ? <FufuBubbleRunner /> : null}
        </div>
      </div>
    </div>
  );
});

function MentionedMessageText({ mentions, text }: { mentions: TinyUserDTO[]; text: string }) {
  const tokenPattern = /<@(\d+)>/g;
  if (tokenPattern.test(text)) {
    tokenPattern.lastIndex = 0;
    const mentionNames = new Map(mentions.map((user) => [user.user_id, user.name]));
    const nodes: ReactNode[] = [];
    let lastIndex = 0;
    Array.from(text.matchAll(tokenPattern)).forEach((match, index) => {
      const start = match.index ?? 0;
      if (start > lastIndex) nodes.push(text.slice(lastIndex, start));
      const label = `@${mentionNames.get(Number(match[1])) || match[1]}`;
      nodes.push(<span className="message-mention" key={`${match[0]}:${start}:${index}`}>{label}</span>);
      lastIndex = start + match[0].length;
    });
    if (lastIndex < text.length) nodes.push(text.slice(lastIndex));
    return <>{nodes}</>;
  }
  const names = [...new Set(mentions.map((user) => user.name).filter(Boolean))].sort((left, right) => right.length - left.length);
  if (!names.length) return <>{text}</>;

  const mentionPattern = new RegExp(`@(${names.map((name) => name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|")})`, "gu");
  const nodes: ReactNode[] = [];
  let lastIndex = 0;
  Array.from(text.matchAll(mentionPattern)).forEach((match, index) => {
    const start = match.index ?? 0;
    if (start > lastIndex) nodes.push(text.slice(lastIndex, start));
    nodes.push(<span className="message-mention" key={`${match[0]}:${start}:${index}`}>{match[0]}</span>);
    lastIndex = start + match[0].length;
  });
  if (lastIndex < text.length) nodes.push(text.slice(lastIndex));
  return <>{nodes}</>;
}

function LinkedMessageText({ hiddenUrl, mentions = [], text }: { hiddenUrl?: string; mentions?: TinyUserDTO[]; text: string }) {
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

  if (parts.length === 0) return <span className="message-text"><MentionedMessageText mentions={mentions} text={text} /></span>;

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
          <span key={part.key}><MentionedMessageText mentions={mentions} text={part.text} /></span>
        )
      )}
    </span>
  );
}

const MessageLinkPreviewCard = memo(function MessageLinkPreviewCard({ messageId, preview, url }: { messageId: number | string; preview?: LinkPreviewDTO | null; url: string }) {
  const pageActive = usePageActive();
  const [currentPreview, setCurrentPreview] = useState<LinkPreviewDTO | null>(preview ?? null);
  const previewUrl = currentPreview?.url || preview?.url || url;
  const isPollable = typeof messageId === "number" && (currentPreview?.status ?? preview?.status) === "pending";

  useEffect(() => {
    setCurrentPreview(preview ?? null);
  }, [preview?.url, preview?.status, preview?.title, preview?.description, preview?.image_url, preview?.site_name]);

  useEffect(() => {
    if (!isPollable || !pageActive) return;

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
  }, [isPollable, messageId, pageActive]);

  if (currentPreview?.status === "pending") {
    const pendingHostname = hostnameFromUrl(previewUrl);
    return (
      <div className="message-link-preview-card is-loading" aria-label={i18n.t("link.generatingPreview")}>
        <div className="message-link-preview-text">
          <span className="message-link-preview-site">{pendingHostname ? pendingHostname.toUpperCase() : i18n.t("link.preview")}</span>
          <span className="message-link-preview-title shimmer-line" />
          <span className="message-link-preview-desc shimmer-line short" />
        </div>
        <div className="message-link-preview-image shimmer-block" />
      </div>
    );
  }

  const unavailable = !currentPreview || currentPreview.status === "none" || currentPreview.status === "failed";
  if (unavailable) {
    const unavailableHostname = hostnameFromUrl(previewUrl);
    return (
      <a
        className="message-link-preview-card no-image is-unavailable"
        href={previewUrl}
        onClick={(event) => event.stopPropagation()}
        rel="noreferrer"
        target="_blank"
      >
        <div className="message-link-preview-text">
          <strong className="message-link-preview-title">{unavailableHostname ? unavailableHostname.toUpperCase() : i18n.t("link.preview")}</strong>
        </div>
        <span className="message-link-preview-placeholder" aria-hidden="true">↗</span>
      </a>
    );
  }

  const hostname = hostnameFromUrl(currentPreview.url || "");
  const rawTitle = currentPreview.title || hostname || currentPreview.url || i18n.t("link.title");
  const title = hostname && rawTitle.trim().toLowerCase() === hostname.toLowerCase()
    ? hostname.toUpperCase()
    : rawTitle;

  return (
    <a
      className={`message-link-preview-card ${currentPreview.image_url ? "has-image" : "no-image"}`}
      href={currentPreview.url}
      onClick={(event) => event.stopPropagation()}
      rel="noreferrer"
      target="_blank"
    >
      <div className="message-link-preview-text">
        <strong className="message-link-preview-title">{title}</strong>
        {currentPreview.description ? <span className="message-link-preview-desc">{currentPreview.description}</span> : null}
      </div>
      {currentPreview.image_url ? <img alt="" className="message-link-preview-image" loading="lazy" src={currentPreview.image_url} /> : <span className="message-link-preview-placeholder" aria-hidden="true">↗</span>}
    </a>
  );
});

function forwardBundleItemsAsMessages(items: ForwardBundleItemDTO[]): ChatMessageDTO[] {
  return items.map((item, index) => ({
    message_id: -(index + 1),
    user: item.author,
    type: item.type,
    content: item.content,
    payload: item.payload,
    created_at: item.sent_at,
  }));
}

function renderMessageContent(
  message: ChatMessage,
  onOpenImage: ((uris: string[], index: number, metadata?: Array<ImageMetadataDTO | null>, messageIds?: Array<number | null>) => void) | undefined,
  onOpenVideo: ((uri: string, metadata: VideoMetadataDTO | null, messageId: number | null) => void) | undefined,
  groupClassName: string
) {
  if (message.kind === "sticker") {
    if (!message.payload?.uri || message.payload.unavailable) {
      return <span className="message-sticker-unavailable">{i18n.t("sticker.unavailable")}</span>;
    }
    const uri = message.localPreviewUri ?? resolveStableResourceUri(message.payload.uri) ?? message.payload.uri;
    return <img
      alt={i18n.t("sticker.messagePlaceholder")}
      className="message-sticker-image"
      draggable={false}
      height={message.payload.pixel_height || undefined}
      loading="lazy"
      src={uri}
      width={message.payload.pixel_width || undefined}
    />;
  }

  if (message.kind === "image" && message.payload?.uri) {
    return <MessageMediaImage groupClassName={groupClassName} messageId={typeof message.id === "number" ? message.id : undefined} metadata={message.payload.image_metadata} onOpenImage={onOpenImage} thumbnailUri={message.localPreviewUri ? undefined : message.payload.thumbnail_uri} uri={message.localPreviewUri ?? message.payload.uri} />;
  }

  if (message.kind === "video" && message.payload?.uri) {
    return (
      <MessageMediaVideo
        groupClassName={groupClassName}
        messageId={typeof message.id === "number" ? message.id : undefined}
        metadata={message.payload.video_metadata}
        onOpenVideo={onOpenVideo}
        thumbnailUri={message.localPreviewUri ? undefined : message.payload.thumbnail_uri}
        uri={message.localPreviewUri ?? message.payload.uri}
      />
    );
  }

  if (message.kind === "audio" && message.payload?.uri) {
    return <AudioMessagePlayer className={groupClassName} durationSeconds={message.payload.duration_seconds} from={message.from} uri={message.localPreviewUri ?? message.payload.uri} />;
  }

  if (message.kind === "file" && message.payload?.uri) {
    const resolvedUri = message.localPreviewUri ?? resolveStableResourceUri(message.payload.uri) ?? message.payload.uri;
    return (
      <a className={`message-file-card ${groupClassName}`.trim()} download={message.payload.file_name || true} href={resolvedUri} rel="noreferrer" target="_blank">
        <span className="message-file-icon"><ComposerSvgIcon kind="file" /></span>
        <span className="message-file-copy">
          <strong>{message.payload.file_name || i18n.t("media.file")}</strong>
          <small>{formatFileSize(message.payload.file_size)}</small>
        </span>
        <span className="message-file-open" aria-hidden="true">↗</span>
      </a>
    );
  }

  if (message.kind === "location" && Number.isFinite(message.payload?.latitude) && Number.isFinite(message.payload?.longitude)) {
    const latitude = Number(message.payload?.latitude);
    const longitude = Number(message.payload?.longitude);
    const address = message.payload?.address?.trim();
    const obscured = Boolean(message.payload?.obscured);
    const obscureRadius = message.payload?.obscure_radius_km ?? 50;
    return (
      <button
        className={`message-location-card ${groupClassName}`.trim()}
        disabled={obscured && message.status === "pending"}
        onClick={(event) => {
          event.stopPropagation();
          window.dispatchEvent(new CustomEvent("sermo:location-message", {
            detail: {
              location: { latitude, longitude, address },
              owner: {
                user_id: message.userId ?? 0,
                name: message.name,
                avatar_uri: message.avatarUri,
                is_permanent_vip: message.isPermanentVip,
                avatar_frame_style: message.avatarFrameStyle,
              } satisfies TinyUserDTO,
            },
          }));
        }}
        type="button"
      >
        <span className="message-location-mark" aria-hidden="true">
          <ComposerSvgIcon kind="location" />
        </span>
        <span className="message-location-copy">
          <strong title={address || undefined}>{address || (message.status === "pending" ? obscured ? i18n.t("location.generatingApproximate") : i18n.t("location.resolving") : obscured ? i18n.t("location.approximate") : i18n.t("location.shared"))}</strong>
          <small>
            {obscured
              ? i18n.t("location.withinKm", { distance: obscureRadius })
              : address
                ? i18n.t("location.viewOnMap")
                : `${latitude.toFixed(5)}, ${longitude.toFixed(5)}`}
          </small>
        </span>
        <span className="message-location-open material-symbols-outlined" aria-hidden="true">chevron_right</span>
      </button>
    );
  }

  if (message.kind === "map_access") {
    const owner = message.payload?.owner;
    const access = message.payload?.access;
    const chatGrant = Boolean(message.payload?.chat_grant);
    const chatAccess = message.payload?.chat_access;
    const connected = chatGrant
      ? Boolean(chatAccess?.authorized_by_me)
      : Boolean(access?.can_view_theirs && access?.they_can_view_mine);
    return (
      <button
        className={`message-travel-map-card ${groupClassName}`.trim()}
        onClick={(event) => {
          event.stopPropagation();
          window.dispatchEvent(new CustomEvent("sermo:travel-map-message", {
            detail: { messageId: message.id, owner, access, chatGrant, chatAccess, from: message.from },
          }));
        }}
        type="button"
      >
        <span className="message-travel-map-art" aria-hidden="true">
          <ComposerSvgIcon kind="map" />
        </span>
        <span className="message-travel-map-copy">
          <strong>{message.payload?.text || i18n.t("travelMap.messageJoin")}</strong>
          <span>{connected ? i18n.t("travelMap.openMap") : i18n.t("travelMap.tapToAuthorize")}</span>
        </span>
        <span className="message-travel-map-arrow" aria-hidden="true">↗</span>
      </button>
    );
  }

  if (message.kind === "statement") {
    return <StatementMessageCard statement={message.payload?.statement} />;
  }

  if (message.kind === "activity") {
    return <ActivityMessageCard activity={message.payload?.activity} activityKey={message.payload?.activity_key} title={message.payload?.title} />;
  }

  if (message.kind === "forward_bundle") {
    const items = message.payload?.items ?? [];
    const firstItem = items[0];
    const firstItemPreview = firstItem
      ? previewFromKind(messageKindFromType(firstItem.type), firstItem.content)
      : i18n.t("message.forwardBundlePlaceholder");
    return (
      <button
        className={`message-forward-bundle-card ${groupClassName}`.trim()}
        onClick={(event) => {
          event.stopPropagation();
          window.dispatchEvent(new CustomEvent("sermo:forward-bundle", { detail: message.payload }));
        }}
        type="button"
      >
        <span className="message-forward-bundle-heading">
          <span className="message-forward-bundle-icon material-symbols-outlined" aria-hidden="true">forum</span>
          <span>
            <strong>{i18n.t("message.forwardBundleTitle")}</strong>
            {message.payload?.summary ? <small>{message.payload.summary}</small> : null}
          </span>
        </span>
        <span className="message-forward-bundle-preview">
          <span>
            <b>{firstItem?.author?.name || i18n.t("message.unknownSender")}</b>
            <i>{firstItemPreview}</i>
          </span>
        </span>
        <span className="message-forward-bundle-footer">
          {i18n.t("message.forwardBundleCount", { count: message.payload?.item_count ?? items.length })}
          <span className="material-symbols-outlined" aria-hidden="true">chevron_right</span>
        </span>
      </button>
    );
  }

  const text = message.payload?.text ?? message.text;
  const linkPreview = message.payload?.link_preview;
  const previewUrl = linkPreview?.url ?? extractFirstMessageUrl(text) ?? undefined;
  if (!previewUrl) {
    return <LinkedMessageText mentions={message.mentions} text={text} />;
  }

  const hasTextBesidePreview = hasMeaningfulTextOutsidePreviewUrl(text, previewUrl);

  return (
    <span className={`message-text-stack has-link-preview ${groupClassName}`.trim()}>
      {hasTextBesidePreview ? (
        <span className={`message-bubble message-text-chip ${groupClassName}`.trim()}>
          <LinkedMessageText hiddenUrl={previewUrl} mentions={message.mentions} text={text} />
        </span>
      ) : null}
      <MessageLinkPreviewCard messageId={message.id} preview={linkPreview} url={previewUrl} />
    </span>
  );
}

function groupRenderSignature(group: MessageGroup, enteringMessageIds: string[]) {
  const entering = group.messages.filter((message) => enteringMessageIds.includes(message.clientId)).map((message) => message.clientId);
  return JSON.stringify({
    key: group.key,
    isPermanentVip: group.isPermanentVip,
    chatBubbleStyle: group.chatBubbleStyle,
    avatarFrameStyle: group.avatarFrameStyle,
    dividerLabel: group.dividerLabel,
    messages: group.messages.map((message) => ({
      clientId: message.clientId,
      kind: message.kind,
      status: message.status,
      text: message.text,
      uri: message.payload?.uri,
      thumbnailUri: message.payload?.thumbnail_uri,
      linkPreview: message.payload?.link_preview
        ? {
            status: message.payload.link_preview.status,
            title: message.payload.link_preview.title,
            imageUrl: message.payload.link_preview.image_url,
          }
        : null,
      replyTo: message.replyTo
        ? {
            messageId: message.replyTo.message_id,
            content: message.replyTo.content,
            deleted: message.replyTo.is_deleted,
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
  onOpenVideo,
  onOpenActions,
  onRetry,
  onToggleSelection,
  selected,
  selectionMode,
}: MessageBubbleRowProps) {
  const showRetry = from === "self" && message.status === "failed" && ["text", "audio"].includes(message.kind);
  const canOpenActions = message.status === "sent" || (message.kind === "image" && Boolean(message.payload?.uri));
  const bubbleRef = useRef<HTMLDivElement | null>(null);
  const longPressTimerRef = useRef<number | null>(null);
  const pointerStartRef = useRef<{ x: number; y: number } | null>(null);
  const suppressClickRef = useRef(false);

  const clearLongPress = () => {
    if (longPressTimerRef.current !== null) {
      window.clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
    pointerStartRef.current = null;
  };

  useEffect(() => clearLongPress, []);

  const openActions = (suppressClick = false) => {
    suppressClickRef.current = suppressClick;
    clearLongPress();
    if (!canOpenActions || !bubbleRef.current) return;
    onOpenActions(message, bubbleRef.current);
  };

  const handlePointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (selectionMode) return;
    if (!canOpenActions) return;
    if (event.pointerType === "mouse" && event.button !== 0) return;
    clearLongPress();
    pointerStartRef.current = { x: event.clientX, y: event.clientY };
    longPressTimerRef.current = window.setTimeout(() => openActions(true), 380);
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
    <div
      className={`message-bubble-wrap ${from} ${message.status !== "sent" ? `is-${message.status}` : "is-sent"} ${isEntering ? "is-entering" : ""}${selectionMode ? " is-selection-mode" : ""}${selected ? " is-selected" : ""}`}
      onClick={selectionMode ? (event) => {
        event.preventDefault();
        event.stopPropagation();
        onToggleSelection(message);
      } : undefined}
    >
      {selectionMode ? <span className="message-selection-check" aria-hidden="true" /> : null}
      <div className={`message-bubble-shell ${from}${isFirst ? " group-start" : ""}${message.kind === "sticker" ? " is-sticker" : ""}`}>
        {showRetry ? (
          <button aria-label={i18n.t("message.retrySend")} className="message-retry-icon" onClick={() => void onRetry(message)} type="button">
            <span className="material-symbols-outlined">refresh</span>
          </button>
        ) : null}
        <div
          ref={bubbleRef}
          data-message-id={typeof message.id === "number" ? message.id : undefined}
          className={[
            "message-bubble",
            from === "self" ? "self" : "other",
            isMediaMessageKind(message.kind) || message.kind === "location" ? "is-media" : "",
            message.kind === "location" ? "is-location" : "",
            message.kind === "map_access" ? "is-travel-map" : "",
            message.kind === "statement" ? "is-statement" : "",
            message.kind === "activity" ? "is-activity" : "",
            message.kind === "forward_bundle" ? "is-forward-bundle" : "",
            message.kind === "sticker" ? "is-sticker" : "",
            extractFirstMessageUrl(message.payload?.text ?? message.text) ? "is-link-preview" : "",
            message.status !== "sent" ? `is-${message.status}` : "",
            isFirst ? "group-start" : "",
            isLast ? "group-end" : "",
            canOpenActions ? "message-bubble-actionable" : "",
            message.replyTo ? "has-reply" : "",
          ]
            .filter(Boolean)
            .join(" ")}
          onContextMenu={
            canOpenActions && !selectionMode
              ? (event) => {
                  event.preventDefault();
                  clearLongPress();
                  onOpenActions(message, event.currentTarget, event.clientX);
                }
              : undefined
          }
          onClickCapture={(event) => {
            if (selectionMode) {
              event.preventDefault();
              event.stopPropagation();
              onToggleSelection(message);
              return;
            }
            if (!suppressClickRef.current) return;
            suppressClickRef.current = false;
            event.preventDefault();
            event.stopPropagation();
          }}
          onPointerCancel={clearLongPress}
          onPointerDown={canOpenActions && !selectionMode ? handlePointerDown : undefined}
          onPointerLeave={clearLongPress}
          onPointerMove={canOpenActions ? handlePointerMove : undefined}
          onPointerUp={clearLongPress}
        >
          {message.replyTo ? (
            <button
              className="message-reply-preview"
              disabled={message.replyTo.is_deleted}
              onClick={(event) => {
                event.stopPropagation();
                window.dispatchEvent(new CustomEvent("sermo:reveal-message", { detail: { messageId: message.replyTo?.message_id } }));
              }}
              type="button"
            >
              <strong>{message.replyTo.is_deleted ? i18n.t("message.original") : message.replyTo.user.name}</strong>
              <span>{message.replyTo.content}</span>
            </button>
          ) : null}
          {renderMessageContent(message, onOpenImage, onOpenVideo, groupClassName)}
          {message.status === "pending" ? <span aria-hidden="true" className="message-send-state-overlay" /> : null}
          {isFirst ? <NikoBubbleRunner /> : null}
          {isFirst ? <XiaobaiBubbleRunner /> : null}
          {isFirst ? <BaxianCharacterRunner style={message.chatBubbleStyle} /> : null}
          <BaxianBubbleTransition animate={!isLast} style={message.chatBubbleStyle} />
          {isLast ? <FufuBubbleRunner /> : null}
        </div>
      </div>
    </div>
  );
});

function MessageAvatarMentionTarget({ children, name, onMention }: { children: ReactNode; name: string; onMention: () => void }) {
  const timerRef = useRef<number | null>(null);
  const pointerStartRef = useRef<{ x: number; y: number } | null>(null);
  const suppressClickRef = useRef(false);

  const clearLongPress = () => {
    if (timerRef.current !== null) window.clearTimeout(timerRef.current);
    timerRef.current = null;
    pointerStartRef.current = null;
  };

  useEffect(() => clearLongPress, []);

  const handlePointerDown = (event: ReactPointerEvent<HTMLButtonElement>) => {
    if (event.pointerType === "mouse" && event.button !== 0) return;
    clearLongPress();
    suppressClickRef.current = false;
    pointerStartRef.current = { x: event.clientX, y: event.clientY };
    timerRef.current = window.setTimeout(() => {
      timerRef.current = null;
      pointerStartRef.current = null;
      suppressClickRef.current = true;
      if ("vibrate" in navigator) navigator.vibrate(8);
      onMention();
    }, 420);
  };

  return (
    <button
      aria-label={i18n.t("chat.mentionUser", { name })}
      className="message-avatar-mention-trigger"
      onClick={(event) => {
        if (event.detail === 0) {
          onMention();
          return;
        }
        if (!suppressClickRef.current) return;
        suppressClickRef.current = false;
        event.preventDefault();
        event.stopPropagation();
      }}
      onContextMenu={(event) => event.preventDefault()}
      onPointerCancel={clearLongPress}
      onPointerDown={handlePointerDown}
      onPointerLeave={clearLongPress}
      onPointerMove={(event) => {
        const start = pointerStartRef.current;
        if (!start) return;
        if (Math.abs(event.clientX - start.x) > 8 || Math.abs(event.clientY - start.y) > 8) clearLongPress();
      }}
      onPointerUp={clearLongPress}
      type="button"
    >
      {children}
    </button>
  );
}

const MessageGroupBlock = memo(function MessageGroupBlock({
  enteringMessageIds,
  group,
  onOpenImage,
  onOpenVideo,
  onOpenActions,
  onMentionAuthor,
  onRetry,
  onToggleGroupSelection,
  onToggleSelection,
  selectedClientIds,
  selectionMode,
  showAuthor,
  showSelfAvatar = false,
  selfAvatarFrame,
  selfAvatarName,
  selfAvatarUri,
  selfIsPermanentVip,
}: MessageGroupBlockProps) {
  const systemMessage = group.messages.length === 1 && group.messages[0].kind === "system" ? group.messages[0] : null;
  if (systemMessage) {
    return (
      <div>
        {group.dividerLabel ? <div className="day-divider">{group.dividerLabel}</div> : null}
        <div className="message-system-row" data-message-id={typeof systemMessage.id === "number" ? systemMessage.id : undefined}>
          <span>{systemMessage.text || i18n.t("message.system.placeholder")}</span>
        </div>
      </div>
    );
  }
  const rows: Array<{ kind: "message"; message: ChatMessage; startIndex: number } | { kind: "gallery"; messages: ChatMessage[]; startIndex: number }> = [];
  for (let index = 0; index < group.messages.length;) {
    const message = group.messages[index];
    if (message.kind !== "image" || !message.payload?.uri || message.replyTo) {
      rows.push({ kind: "message", message, startIndex: index });
      index += 1;
      continue;
    }

    const imageMessages: ChatMessage[] = [];
    let cursor = index;
    while (cursor < group.messages.length) {
      const candidate = group.messages[cursor];
      if (candidate.kind !== "image" || !candidate.payload?.uri || candidate.replyTo) break;
      imageMessages.push(candidate);
      cursor += 1;
    }
    if (imageMessages.length === 1) {
      rows.push({ kind: "message", message, startIndex: index });
    } else {
      rows.push({ kind: "gallery", messages: imageMessages, startIndex: index });
    }
    index = cursor;
  }

  const showGroupAvatar = group.from === "other" || showSelfAvatar || selectionMode;
  const groupAvatar = showGroupAvatar ? (
    <UserAvatar
      className="avatar message-avatar"
      frame={group.from === "self" ? selfAvatarFrame : group.avatarFrameStyle}
      name={group.from === "self" ? selfAvatarName ?? "" : group.name}
      uri={group.from === "self" ? selfAvatarUri : group.avatarUri}
      cacheKey={group.from === "self" ? undefined : group.avatarCacheKey}
      vip={group.from === "self" ? selfIsPermanentVip : group.isPermanentVip}
    />
  ) : null;
  const selectableGroupMessages = group.messages.filter((message) => message.kind !== "system");
  const groupSelected = selectableGroupMessages.length > 0 && selectableGroupMessages.every((message) => selectedClientIds.includes(message.clientId));

  return (
    <div>
      {group.dividerLabel ? <div className="day-divider">{group.dividerLabel}</div> : null}
      <div className={`message-group ${group.from}${selectionMode ? " is-selection-mode" : ""} bubble-style-${visibleBubbleStyle(group.chatBubbleStyle)}`}>
        {selectionMode && groupAvatar ? (
          <button
            aria-label={i18n.t("message.selectMergedGroup", { name: group.from === "self" ? selfAvatarName ?? group.name : group.name })}
            aria-pressed={groupSelected}
            className="message-avatar-selection-trigger"
            onClick={() => onToggleGroupSelection(selectableGroupMessages)}
            type="button"
          >
            {groupAvatar}
          </button>
        ) : group.from === "other" && groupAvatar && onMentionAuthor && typeof group.userId === "number" ? (
          <MessageAvatarMentionTarget name={group.name} onMention={() => onMentionAuthor(group.userId!)}>
            {groupAvatar}
          </MessageAvatarMentionTarget>
        ) : groupAvatar}
        <div className="message-bubbles">
          {group.from === "other" && showAuthor ? <div className="message-author-name">{group.name}</div> : null}
          {rows.map((row) => row.kind === "gallery" ? (
            <MessageImageGallery
              key={`gallery:${row.messages[0].clientId}`}
              from={group.from}
              isEntering={row.messages.some((message) => enteringMessageIds.includes(message.clientId))}
              isFirst={row.startIndex === 0}
              isLast={row.startIndex + row.messages.length === group.messages.length}
              messages={row.messages}
              onOpenImage={onOpenImage}
              onOpenActions={onOpenActions}
              onRetry={onRetry}
              onToggleSelection={onToggleSelection}
              selectedClientIds={selectedClientIds}
              selectionMode={selectionMode}
            />
          ) : (
            <MessageBubbleRow
              key={row.message.clientId}
              from={group.from}
              isEntering={enteringMessageIds.includes(row.message.clientId)}
              isFirst={row.startIndex === 0}
              isLast={row.startIndex === group.messages.length - 1}
              message={row.message}
              onOpenImage={onOpenImage}
              onOpenVideo={onOpenVideo}
              onOpenActions={onOpenActions}
              onRetry={onRetry}
              onToggleSelection={onToggleSelection}
              selected={selectedClientIds.includes(row.message.clientId)}
              selectionMode={selectionMode}
            />
          ))}
        </div>
      </div>
    </div>
  );
}, (prev, next) => (
  prev.showAuthor === next.showAuthor
  && prev.showSelfAvatar === next.showSelfAvatar
  && prev.selfAvatarFrame === next.selfAvatarFrame
  && prev.selfAvatarName === next.selfAvatarName
  && prev.selfAvatarUri === next.selfAvatarUri
  && prev.selfIsPermanentVip === next.selfIsPermanentVip
  && prev.selectionMode === next.selectionMode
  && prev.selectedClientIds.join("|") === next.selectedClientIds.join("|")
  && groupRenderSignature(prev.group, prev.enteringMessageIds) === groupRenderSignature(next.group, next.enteringMessageIds)
));

interface MessageGroup {
  key: string;
  userId?: number;
  from: "self" | "other";
  name: string;
  avatarUri?: string;
  avatarCacheKey?: string;
  isPermanentVip?: boolean;
  chatBubbleStyle?: ChatMessage["chatBubbleStyle"];
  avatarFrameStyle?: ChatMessage["avatarFrameStyle"];
  dividerLabel?: string;
  messages: ChatMessage[];
}

function buildMessageGroups(messages: ChatMessage[]): MessageGroup[] {
  const groups: MessageGroup[] = [];
  messages.forEach((message, index) => {
    const previous = messages[index - 1];
    const dividerLabel = shouldShowThreadDivider(message, previous) ? formatThreadDivider(message.createdAt) : undefined;
    const lastGroup = groups[groups.length - 1];
    if (lastGroup && !dividerLabel && shouldGroupMessages(message, lastGroup.messages[lastGroup.messages.length - 1])) {
      lastGroup.messages.push(message);
      return;
    }
    groups.push({
      key: message.clientId,
      userId: message.userId,
      from: message.from,
      name: message.name,
      avatarUri: message.avatarUri,
      avatarCacheKey: message.avatarCacheKey,
      isPermanentVip: message.isPermanentVip,
      chatBubbleStyle: message.chatBubbleStyle,
      avatarFrameStyle: message.avatarFrameStyle,
      dividerLabel,
      messages: [message],
    });
  });
  return groups;
}

function estimateMessageRowHeight(message: ChatMessage) {
  const replyHeight = message.replyTo ? 44 : 0;
  if (message.kind === "system") return 34;
  if (message.kind === "image") {
    const width = Number(message.payload?.pixel_width || message.payload?.image_metadata?.pixel_width || 0);
    const height = Number(message.payload?.pixel_height || message.payload?.image_metadata?.pixel_height || 0);
    const ratio = width > 0 && height > 0 ? height / width : 0.78;
    return Math.max(112, Math.min(310, Math.round(252 * ratio))) + replyHeight;
  }
  if (message.kind === "video") {
    const width = Number(message.payload?.pixel_width || message.payload?.video_metadata?.pixel_width || 0);
    const height = Number(message.payload?.pixel_height || message.payload?.video_metadata?.pixel_height || 0);
    const ratio = width > 0 && height > 0 ? height / width : 9 / 16;
    return Math.max(132, Math.min(310, Math.round(260 * ratio))) + replyHeight;
  }
  if (message.kind === "sticker") return 172;
  if (message.kind === "audio") return 76 + replyHeight;
  if (message.kind === "file") return 88 + replyHeight;
  if (message.kind === "location" || message.kind === "map_access") return 112 + replyHeight;
  if (message.kind === "statement") return 214 + replyHeight;
  if (message.kind === "activity") return 148 + replyHeight;
  if (message.kind === "forward_bundle") return 184 + replyHeight;

  const text = message.payload?.text ?? message.text ?? "";
  const hasLink = Boolean(extractFirstMessageUrl(text));
  const estimatedLines = Math.max(1, Math.ceil(Array.from(text).length / 18));
  return Math.min(180, 22 + estimatedLines * 23) + (hasLink ? 104 : 0) + replyHeight;
}

function estimateMessageGroupHeight(group: MessageGroup) {
  let height = group.dividerLabel ? 52 : 0;
  if (group.from === "other") height += 18;
  for (let index = 0; index < group.messages.length;) {
    const message = group.messages[index];
    if (message.kind !== "image" || message.replyTo) {
      height += estimateMessageRowHeight(message) + 3;
      index += 1;
      continue;
    }
    let imageCount = 1;
    while (
      index + imageCount < group.messages.length
      && group.messages[index + imageCount].kind === "image"
      && !group.messages[index + imageCount].replyTo
    ) imageCount += 1;
    if (imageCount === 1) height += estimateMessageRowHeight(message) + 3;
    else height += Math.ceil(Math.min(imageCount, 18) / (imageCount === 2 || imageCount === 4 ? 2 : 3)) * 118 + 3;
    index += imageCount;
  }
  return Math.max(38, height + 16);
}

interface MessageBubbleRowProps {
  from: "self" | "other";
  isEntering: boolean;
  isFirst: boolean;
  isLast: boolean;
  message: ChatMessage;
  onOpenImage: (uris: string[], index: number, metadata?: Array<ImageMetadataDTO | null>, messageIds?: Array<number | null>) => void;
  onOpenVideo: (uri: string, metadata: VideoMetadataDTO | null, messageId: number | null) => void;
  onOpenActions: (message: ChatMessage, element: HTMLElement, pointerX?: number) => void;
  onRetry: (message: ChatMessage) => void;
  onToggleSelection: (message: ChatMessage) => void;
  selected: boolean;
  selectionMode: boolean;
}

interface MessageGroupBlockProps {
  enteringMessageIds: string[];
  group: MessageGroup;
  onOpenImage: (uris: string[], index: number, metadata?: Array<ImageMetadataDTO | null>, messageIds?: Array<number | null>) => void;
  onOpenVideo: (uri: string, metadata: VideoMetadataDTO | null, messageId: number | null) => void;
  onOpenActions: (message: ChatMessage, element: HTMLElement, pointerX?: number) => void;
  onMentionAuthor?: (userId: number) => void;
  onRetry: (message: ChatMessage) => void;
  onToggleGroupSelection: (messages: ChatMessage[]) => void;
  onToggleSelection: (message: ChatMessage) => void;
  selectedClientIds: string[];
  selectionMode: boolean;
  showAuthor: boolean;
  showSelfAvatar?: boolean;
  selfAvatarFrame?: ChatMessage["avatarFrameStyle"];
  selfAvatarName?: string;
  selfAvatarUri?: string;
  selfIsPermanentVip?: boolean;
}

interface MessageMenuState {
  message: ChatMessage;
  anchorX: number;
  anchorY: number;
  placement: "top" | "bottom";
  confirmDelete: boolean;
}

type MessageSelectionAction = "copy" | "save" | "recall";

interface MessageSelectionActionPrompt {
  action: MessageSelectionAction;
  eligibleClientIds: string[];
  total: number;
}

interface ImagePreviewState {
  index: number;
  uris: string[];
  metadata: Array<ImageMetadataDTO | null>;
  messageIds: Array<number | null>;
}

interface VideoPreviewState {
  uri: string;
  metadata: VideoMetadataDTO | null;
  messageId: number | null;
}

function formatImageFileSize(fileSize?: number | null) {
  if (fileSize == null) return "";
  if (fileSize >= 1024 * 1024) return `${(fileSize / (1024 * 1024)).toFixed(1)} MB`;
  return `${Math.max(1, Math.round(fileSize / 1024))} KB`;
}

type VoiceComposerPhase = "idle" | "requesting" | "recording" | "stopping" | "recorded" | "sending";

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
    avatarCacheKey?: string;
    isSelf: boolean;
    isOwner: boolean;
  }>
) {
  return [...members].sort((left, right) => {
    if (left.isOwner !== right.isOwner) return left.isOwner ? -1 : 1;
    if (left.isSelf !== right.isSelf) return left.isSelf ? -1 : 1;
    return left.name.localeCompare(right.name, getActiveLocale());
  });
}

function mapChat(chat: ChatDTO, currentUserId: number): Chat {
  const peer = chat.group ? null : getDirectPeer(chat, currentUserId);
  const title = chat.title || peer?.name || i18n.t("chat.unnamed");
  const presence = formatPresence(peer);
  const isOwner = Boolean(chat.group && chat.owner?.user_id === currentUserId);
  const lastActivity = chat.last_message?.created_at ?? chat.last_chat_at;

  return {
    id: chat.chat_id,
    title,
    avatarUri: peer?.avatar_uri,
    avatarCacheKey: peer?.avatar_cache_key,
    avatarFrameStyle: peer?.avatar_frame_style,
    subtitle: chat.group ? i18n.t("chat.memberCount", { count: chat.members.length }) : presence,
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
    notificationsMuted: Boolean(chat.notifications_muted),
    unreadBadgeMuted: Boolean(chat.unread_badge_muted),
    hasUnreadMention: Boolean(chat.has_unread_mention),
    detail: {
      summary: chat.group ? i18n.t("chat.groupSummary") : i18n.t("chat.directSummary"),
      relation: chat.group ? (isOwner ? i18n.t("chat.ownerRelation") : i18n.t("chat.memberRelation")) : i18n.t("chat.directRelation"),
      actions: chat.group ? (isOwner ? [i18n.t("chat.inviteMembers"), i18n.t("chat.disband")] : [i18n.t("chat.leave")]) : [i18n.t("chat.friendRequest"), i18n.t("chat.mute")],
      members: sortChatDetailMembers(
        chat.members.map((member) => ({
          userId: member.user_id,
          name: member.name,
          avatarUri: member.avatar_uri,
          avatarCacheKey: member.avatar_cache_key,
          avatarFrameStyle: member.avatar_frame_style,
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
  return i18n.t("chat.accessDenied");
}

const CHAT_DRAFT_STORAGE_PREFIX = "sermo:chat-draft:v1";

function chatDraftStorageKey(scope: string, chatId: number) {
  return `${CHAT_DRAFT_STORAGE_PREFIX}:${scope}:${chatId}`;
}

function readChatDraft(scope: string, chatId: number) {
  try {
    return window.localStorage.getItem(chatDraftStorageKey(scope, chatId)) ?? "";
  } catch {
    return "";
  }
}

function writeChatDraft(scope: string, chatId: number, value: string) {
  try {
    const key = chatDraftStorageKey(scope, chatId);
    if (value) window.localStorage.setItem(key, value);
    else window.localStorage.removeItem(key);
  } catch {
    // Draft persistence should never interrupt typing or sending.
  }
}

function LiveChatsPage() {
  const { t } = useI18n();
  const pageActive = usePageActive();
  const { discover: discoverFeature } = useFeatureDiscovery();
  const navigate = useNavigate();
  const location = useLocation();
  const { chatId } = useParams();
  const { session } = useAuth();
  const groupSquareEnabled = useGroupSquareEnabled();
  const [draft, setDraft] = useState("");
  const [replyingTo, setReplyingTo] = useState<QuotedMessageDTO | null>(null);
  const [detailsSheetOpen, setDetailsSheetOpen] = useState(false);
  const [addFriendOpen, setAddFriendOpen] = useState(false);
  const [messageSearchOpen, setMessageSearchOpen] = useState(false);
  const [messageSearchKeyword, setMessageSearchKeyword] = useState("");
  const [messageSearchType, setMessageSearchType] = useState<number | null>(null);
  const [messageSearchResults, setMessageSearchResults] = useState<ChatMessageDTO[]>([]);
  const [messageSearchState, setMessageSearchState] = useState<"idle" | "loading" | "loading-more" | "error">("idle");
  const [messageSearchNextBefore, setMessageSearchNextBefore] = useState<number | null>(null);
  const [messageSearchHasMore, setMessageSearchHasMore] = useState(false);
  const [pinnedDrawerOpen, setPinnedDrawerOpen] = useState(false);
  const [pinnedMessages, setPinnedMessages] = useState<PinnedMessageDTO[]>([]);
  const [pinSavingMessageId, setPinSavingMessageId] = useState<number | null>(null);
  const [profileDrawerUserId, setProfileDrawerUserId] = useState<number | null>(null);
  const [profileSyncing, setProfileSyncing] = useState(false);
  const [preferenceSaving, setPreferenceSaving] = useState<"pin" | "online" | "mute" | "badge" | null>(null);
  const [mentionSearch, setMentionSearch] = useState<string | null>(null);
  const [groupCreateOpen, setGroupCreateOpen] = useState(false);
  const [chatMemberPickerOpen, setChatMemberPickerOpen] = useState(false);
  const [composerMoreOpen, setComposerMoreOpen] = useState(false);
  const [emojiPickerOpen, setEmojiPickerOpen] = useState(false);
  const [emojiPage, setEmojiPage] = useState(STICKER_MY_PAGE);
  const [emojiUsage, setEmojiUsage] = useState<EmojiUsageDTO[]>([]);
  const [stickers, setStickers] = useState<StickerDTO[]>([]);
  const [exploreStickers, setExploreStickers] = useState<StickerAssetDTO[]>([]);
  const [mineStickersLoading, setMineStickersLoading] = useState(false);
  const [exploreStickersLoading, setExploreStickersLoading] = useState(false);
  const [mineStickersHasMore, setMineStickersHasMore] = useState(false);
  const [exploreStickersHasMore, setExploreStickersHasMore] = useState(false);
  const mineStickerOffsetRef = useRef(0);
  const exploreStickerOffsetRef = useRef(0);
  const mineStickerRequestRef = useRef(false);
  const exploreStickerRequestRef = useRef(false);
  const [stickerSaving, setStickerSaving] = useState(false);
  const [stickerManagerOpen, setStickerManagerOpen] = useState(false);
  const [stickerManagerSelecting, setStickerManagerSelecting] = useState(false);
  const [selectedStickerIds, setSelectedStickerIds] = useState<number[]>([]);
  const [stickerDeleteConfirmOpen, setStickerDeleteConfirmOpen] = useState(false);
  const [locationDraft, setLocationDraft] = useState<LocationDraft | null>(null);
  const [locationMessagePreview, setLocationMessagePreview] = useState<{
    location: { latitude: number; longitude: number; address?: string };
    owner: TinyUserDTO;
  } | null>(null);
  const [travelMapOpen, setTravelMapOpen] = useState(false);
  const [travelMapOtherUser, setTravelMapOtherUser] = useState<TinyUserDTO | null>(null);
  const [travelMapMenu, setTravelMapMenu] = useState<{ user: TinyUserDTO; access: TravelMapAccessDTO } | null>(null);
  const [travelMapSaving, setTravelMapSaving] = useState(false);
  const [travelMapRevokeConfirmOpen, setTravelMapRevokeConfirmOpen] = useState(false);
  const [chatTravelMapOpen, setChatTravelMapOpen] = useState(false);
  const [chatTravelMapAccess, setChatTravelMapAccess] = useState<ChatTravelMapAccessDTO | null>(null);
  const [chatTravelMapGrantConfirmOpen, setChatTravelMapGrantConfirmOpen] = useState(false);
  const [chatTravelMapMenuOpen, setChatTravelMapMenuOpen] = useState(false);
  const [clipboardUpload, setClipboardUpload] = useState<ClipboardUploadCandidate | null>(null);
  const [fileDropActive, setFileDropActive] = useState(false);
  const [viewState, setViewState] = useState<AppViewState>("idle");
  const [chatHealthSnapshot, setChatHealthSnapshot] = useState<ChatHealthSnapshot>({ lastFailureAt: null, lastSuccessAt: null });
  const [healthClock, setHealthClock] = useState(() => Date.now());
  const [pageError, setPageError] = useState<string | null>(null);
  const [sendState, setSendState] = useState<"idle" | "sending">("idle");
  const [groupCreateState, setGroupCreateState] = useState<"idle" | "loading-users" | "creating">("idle");
  const [chats, setChats] = useState<Chat[]>([]);
  const [messages, setMessages] = useState<Record<number, ChatMessage[]>>({});
  const [hasOlderMessages, setHasOlderMessages] = useState(false);
  const [olderState, setOlderState] = useState<"idle" | "loading">("idle");
  const [enteringMessageIds, setEnteringMessageIds] = useState<string[]>([]);
  const [messageMenu, setMessageMenu] = useState<MessageMenuState | null>(null);
  const [messageDeleteState, setMessageDeleteState] = useState<"idle" | "deleting">("idle");
  const [messageSelectionMode, setMessageSelectionMode] = useState(false);
  const [selectedMessageClientIds, setSelectedMessageClientIds] = useState<string[]>([]);
  const [batchDeleteConfirmOpen, setBatchDeleteConfirmOpen] = useState(false);
  const [messageSelectionAction, setMessageSelectionAction] = useState<MessageSelectionAction | null>(null);
  const [messageSelectionActionPrompt, setMessageSelectionActionPrompt] = useState<MessageSelectionActionPrompt | null>(null);
  const [forwardPickerOpen, setForwardPickerOpen] = useState(false);
  const [forwardMode, setForwardMode] = useState<"individual" | "bundle">("bundle");
  const [forwardSourceMessageIds, setForwardSourceMessageIds] = useState<number[]>([]);
  const [forwardTargetChatIds, setForwardTargetChatIds] = useState<number[]>([]);
  const [forwardSending, setForwardSending] = useState(false);
  const [forwardBundlePreview, setForwardBundlePreview] = useState<ChatMessagePayloadDTO | null>(null);
  const [clearHistoryConfirmOpen, setClearHistoryConfirmOpen] = useState(false);
  const [clearHistorySaving, setClearHistorySaving] = useState(false);
  const [restoreHistoryConfirmOpen, setRestoreHistoryConfirmOpen] = useState(false);
  const [restoreHistorySaving, setRestoreHistorySaving] = useState(false);
  const [restoreHistoryPassword, setRestoreHistoryPassword] = useState("");
  const [historyRecoveryStatus, setHistoryRecoveryStatus] = useState<ChatHistoryRecoveryStatusDTO | null>(null);
  const [historyRecoveryLoading, setHistoryRecoveryLoading] = useState(false);
  const [historyReloadVersion, setHistoryReloadVersion] = useState(0);
  const [closingChatSnapshot, setClosingChatSnapshot] = useState<Chat | null>(null);
  const [isClosingChatView, setIsClosingChatView] = useState(false);
  const [groupTitle, setGroupTitle] = useState("");
  const [groupQuery, setGroupQuery] = useState("");
  const [groupCandidates, setGroupCandidates] = useState<UserDTO[]>([]);
  const [groupFriendPool, setGroupFriendPool] = useState<UserDTO[]>([]);
  const [groupSelectedIds, setGroupSelectedIds] = useState<number[]>([]);
  const [chatMemberLockedIds, setChatMemberLockedIds] = useState<number[]>([]);
  const [chatMemberPickerMode, setChatMemberPickerMode] = useState<"add" | "remove">("add");
  const [groupRenameOpen, setGroupRenameOpen] = useState(false);
  const [groupRenameValue, setGroupRenameValue] = useState("");
  const [groupManageState, setGroupManageState] = useState<"idle" | "saving" | "loading-candidates">("idle");
  const [currentUserVerified, setCurrentUserVerified] = useState<boolean | null>(null);
  const [currentUserMe, setCurrentUserMe] = useState<UserMeDTO | null>(null);
  const [paintedChatBackgroundUri, setPaintedChatBackgroundUri] = useState<string | null>(null);
  const [detailMemberLimit, setDetailMemberLimit] = useState(CHAT_DETAIL_MEMBER_PAGE_SIZE);
  const [groupDangerConfirmOpen, setGroupDangerConfirmOpen] = useState(false);
  const [friendDangerConfirmOpen, setFriendDangerConfirmOpen] = useState(false);
  const [friendDeleteSaving, setFriendDeleteSaving] = useState(false);
  const [voiceComposer, setVoiceComposer] = useState<VoiceComposerState>({
    open: false,
    phase: "idle",
    durationSeconds: 0,
    bars: Array.from({ length: 24 }, () => 0.28),
    blob: null,
    mimeType: "",
  });
  const [voicePreviewUri, setVoicePreviewUri] = useState("");
  const [voicePreviewPlaying, setVoicePreviewPlaying] = useState(false);
  const [imagePreview, setImagePreview] = useState<ImagePreviewState | null>(null);
  const [videoPreview, setVideoPreview] = useState<VideoPreviewState | null>(null);
  const [sendTasks, setSendTasks] = useState<Record<string, number>>({});
  const cancelledSendIdsRef = useRef(new Set<string>());
  const localObjectUrlsRef = useRef(new Set<string>());
  const mentionEditorRef = useRef<MentionComposerHandle | null>(null);
  const messageMenuRef = useRef<HTMLDivElement | null>(null);
  const replyingToRef = useRef<QuotedMessageDTO | null>(null);
  const composerRef = useRef<HTMLFormElement | null>(null);
  const galleryInputRef = useRef<HTMLInputElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [fileSourceSheetOpen, setFileSourceSheetOpen] = useState(false);
  const [cloudFilePickerOpen, setCloudFilePickerOpen] = useState(false);
  const stickerInputRef = useRef<HTMLInputElement | null>(null);
  const clipboardPreviewUrlsRef = useRef(new Set<string>());
  const fileDropDepthRef = useRef(0);

  useEffect(() => {
    if (!imagePreview) return;
    const messageId = imagePreview.messageIds[imagePreview.index];
    const metadata = imagePreview.metadata[imagePreview.index];
    if (!messageId || metadata?.status === 2) return;
    if (metadata?.status === 1 && metadata.geocoding_status !== 0) return;
    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      void api.getMediaMetadata<ImageMetadataDTO>(messageId, controller.signal)
        .then((nextMetadata) => {
          setImagePreview((current) => {
            if (!current || current.messageIds[current.index] !== messageId) return current;
            const next = [...current.metadata];
            next[current.index] = nextMetadata;
            return { ...current, metadata: next };
          });
        })
        .catch(() => undefined);
    }, 1200);
    return () => {
      controller.abort();
      window.clearTimeout(timer);
    };
  }, [imagePreview]);

  useEffect(() => {
    if (!videoPreview?.messageId) return;
    if (videoPreview.metadata?.status === 2) return;
    if (videoPreview.metadata?.status === 1 && videoPreview.metadata.geocoding_status !== 0) return;
    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      void api.getMediaMetadata<VideoMetadataDTO>(videoPreview.messageId as number, controller.signal)
        .then((metadata) => setVideoPreview((current) => current ? { ...current, metadata } : current))
        .catch(() => undefined);
    }, 1200);
    return () => {
      controller.abort();
      window.clearTimeout(timer);
    };
  }, [videoPreview]);
  const messageScrollRef = useRef<HTMLDivElement | null>(null);
  const virtualMessageListRef = useRef<VirtualDynamicListHandle | null>(null);
  const messageGroupIndexRef = useRef(new Map<number, number>());
  const chatLayoutRef = useRef<HTMLElement | null>(null);
  const chatMainPaneRef = useRef<HTMLElement | null>(null);
  const initialScrollDoneRef = useRef<number | null>(null);
  const initialBottomAnchorRef = useRef<number | null>(null);
  const stickToBottomRef = useRef(true);
  const pendingRevealRef = useRef<{ chatId: number; previousHeight: number; previousScrollTop: number } | null>(null);
  const cancelScrollAnimationRef = useRef<(() => void) | null>(null);
  const revealAnimatingRef = useRef(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const voicePreviewAudioRef = useRef<HTMLAudioElement | null>(null);

  const sendProgress = useMemo(() => {
    const values = Object.values(sendTasks);
    if (!values.length) return null;
    return values.reduce((total, progress) => total + progress, 0) / values.length;
  }, [sendTasks]);

  useEffect(() => {
    const rawUri = currentUserMe?.chat_background_uri;
    if (currentUserMe?.chat_background_theme !== "custom" || !rawUri) {
      setPaintedChatBackgroundUri(null);
      return;
    }

    const resolvedUri = resolveStableResourceUri(rawUri) ?? rawUri;
    if (
      paintedChatBackgroundUri
      && normalizeStableResourceUri(paintedChatBackgroundUri) === normalizeStableResourceUri(resolvedUri)
    ) return;

    let cancelled = false;
    const image = new Image();
    image.onload = () => {
      if (!cancelled) setPaintedChatBackgroundUri(resolvedUri);
    };
    image.src = resolvedUri;
    return () => {
      cancelled = true;
      image.onload = null;
    };
  }, [currentUserMe?.chat_background_theme, currentUserMe?.chat_background_uri, paintedChatBackgroundUri]);

  const updateSendTask = (clientId: string, progress: number) => {
    setSendTasks((current) => ({ ...current, [clientId]: Math.max(current[clientId] ?? 0, Math.min(1, progress)) }));
  };

  const finishSendTask = (clientId: string) => {
    updateSendTask(clientId, 1);
    window.setTimeout(() => {
      setSendTasks((current) => {
        if (!(clientId in current)) return current;
        const next = { ...current };
        delete next[clientId];
        return next;
      });
    }, 420);
  };

  const mediaStreamRef = useRef<MediaStream | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const waveformFrameRef = useRef<number | null>(null);
  const recordingTimerRef = useRef<number | null>(null);
  const recordingChunksRef = useRef<Blob[]>([]);
  const recordingCancelledRef = useRef(false);
  const recordingStopRequestedRef = useRef(false);
  const recordingAttemptRef = useRef(0);
  const recordingStartedAtRef = useRef(0);
  const [composerHeight, setComposerHeight] = useState(80);
  const [keyboardOffset, setKeyboardOffset] = useState(0);
  const currentUserId = session?.user.user_id ?? 0;
  const emojiUsageCacheKey = currentUserId ? `sermo:emoji-usage:v1:${currentUserId}` : "";
  const frequentEmojis = emojiUsage.slice(0, 5).map((item) => item.emoji);
  const visibleEmojis =
    emojiPage < 0
      ? []
      : emojiPage === 0
      ? [...frequentEmojis, ...EMOJI_PAGES[0].emojis.filter((emoji) => !frequentEmojis.includes(emoji))].slice(0, 48)
      : [...EMOJI_PAGES[emojiPage].emojis];

  const storeEmojiUsage = (rows: EmojiUsageDTO[]) => {
    const sorted = sortEmojiUsage(rows).slice(0, 50);
    setEmojiUsage(sorted);
    if (emojiUsageCacheKey) {
      window.localStorage.setItem(emojiUsageCacheKey, JSON.stringify(sorted));
    }
  };

  const syncEmojiUsage = async () => {
    if (!currentUserId) return;
    try {
      storeEmojiUsage(await api.getEmojiUsage());
    } catch {
      // Emoji ranking is an enhancement and must not interrupt message sending.
    }
  };

  const recordOptimisticEmojiUsage = (text: string) => {
    const emojis = extractMessageEmojis(text);
    if (!emojis.length) return;
    const counts = new Map<string, number>();
    emojis.forEach((emoji) => counts.set(emoji, (counts.get(emoji) ?? 0) + 1));
    const nowSeconds = Date.now() / 1000;
    const nextRows = emojiUsage.map((item) => ({ ...item }));
    counts.forEach((count, emoji) => {
      const existing = nextRows.find((item) => item.emoji === emoji);
      if (existing) {
        existing.use_count += count;
        existing.last_used_at = nowSeconds;
      } else {
        nextRows.push({ emoji, use_count: count, last_used_at: nowSeconds });
      }
    });
    storeEmojiUsage(nextRows);
  };

  useEffect(() => {
    if (!emojiUsageCacheKey) {
      setEmojiUsage([]);
      return;
    }
    try {
      const cached = JSON.parse(window.localStorage.getItem(emojiUsageCacheKey) ?? "[]") as EmojiUsageDTO[];
      setEmojiUsage(sortEmojiUsage(cached).slice(0, 50));
    } catch {
      setEmojiUsage([]);
    }
    const controller = new AbortController();
    api.getEmojiUsage(controller.signal)
      .then(storeEmojiUsage)
      .catch(() => undefined);
    return () => controller.abort();
  }, [emojiUsageCacheKey]);
  const currentUserName = session?.user.name ?? t("common.me");
  const pendingMessageAppearance: PendingMessageAppearance = {
    isPermanentVip: currentUserMe?.is_permanent_vip ?? session?.user.is_permanent_vip,
    chatBubbleStyle: currentUserMe?.chat_bubble_style ?? session?.user.chat_bubble_style,
    avatarFrameStyle: currentUserMe?.avatar_frame_style ?? session?.user.avatar_frame_style,
  };
  const cacheScope = session ? buildChatCacheScope(session.user.space_id, session.user.user_id) : null;
  const updateDraft = (value: string) => {
    setDraft(value);
    if (cacheScope && selectedChat) writeChatDraft(cacheScope, selectedChat.id, value);
  };
  const composerBusy = sendState === "sending" || voiceComposer.phase === "sending" || voiceComposer.phase === "stopping" || locationDraft?.phase === "sending";
  const routeState = location.state as ChatRouteState | null;
  const chatAccessNotice = routeState?.chatAccessError ?? null;

  useEffect(() => {
    if (!chatAccessNotice) return;
    showToast(t("chat.unavailable"), "error");
    navigate("/app/chats", { replace: true, state: null });
  }, [chatAccessNotice, navigate]);
  const chatHealth = resolveChatHealth(chatHealthSnapshot, healthClock);
  const growthCapability = (key: string, fallbackLevel: number) => currentUserMe?.growth?.capabilities?.[key] ?? {
    available: (currentUserMe?.growth?.level ?? 1) >= fallbackLevel,
    required_level: fallbackLevel,
  };
  const requireComposerCapability = (key: string, fallbackLevel: number, label: string) => {
    const capability = growthCapability(key, fallbackLevel);
    if (capability.available) return true;
    showToast(t("growth.capabilityRequired", { level: capability.required_level, capability: label }), "error");
    return false;
  };
  const canSendImage = growthCapability("chat.message.send.image", 2).available;
  const canSendAudio = growthCapability("chat.message.send.audio", 3).available;
  const canSendLocation = growthCapability("chat.message.send.location", 3).available;
  const canCreateGroup = growthCapability("chat.group.create", 4).available;
  const canInviteGroupMember = growthCapability("chat.group.invite", 4).available;
  const canRenameGroup = growthCapability("chat.group.rename", 5).available;
  const canSendVideo = growthCapability("chat.message.send.video", 5).available;
  const canCreateSticker = growthCapability("menu.sticker.create", 6).available;
  const canUseOnlineReminder = growthCapability("chat.reminder.online", 7).available;
  const canDownloadAudio = growthCapability("chat.message.download.audio", 8).available;
  const currentUserIsPermanentVip = Boolean(currentUserMe?.is_permanent_vip ?? session?.user.is_permanent_vip);
  const canRecallMessage = (message: ChatMessage) => {
    if (message.from !== "self" || message.status !== "sent" || typeof message.id !== "number") return false;
    const recallWindowSeconds = currentUserIsPermanentVip ? 7 * 24 * 60 * 60 : 2 * 60;
    return Math.max(0, Math.floor(Date.now() / 1000) - message.createdAt) <= recallWindowSeconds;
  };

  useEffect(() => () => {
    localObjectUrlsRef.current.forEach((uri) => URL.revokeObjectURL(uri));
    localObjectUrlsRef.current.clear();
    clipboardPreviewUrlsRef.current.forEach((uri) => URL.revokeObjectURL(uri));
    clipboardPreviewUrlsRef.current.clear();
  }, []);

  useEffect(() => {
    setChatHealthSnapshot(getChatHealth(cacheScope));
    const handleHealth = (event: Event) => {
      const detail = (event as CustomEvent<{ scope: string; snapshot: ChatHealthSnapshot }>).detail;
      if (detail.scope === cacheScope) setChatHealthSnapshot(detail.snapshot);
    };
    const timer = window.setInterval(() => setHealthClock(Date.now()), 10_000);
    window.addEventListener(CHAT_HEALTH_EVENT, handleHealth);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener(CHAT_HEALTH_EVENT, handleHealth);
    };
  }, [cacheScope]);

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
    voicePreviewAudioRef.current?.pause();
    setVoicePreviewPlaying(false);
    setVoicePreviewUri((current) => {
      if (current) URL.revokeObjectURL(current);
      return "";
    });
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

  const setReplyTarget = (reply: QuotedMessageDTO | null) => {
    replyingToRef.current = reply;
    setReplyingTo(reply);
  };

  const consumeReplyTarget = () => {
    const reply = replyingToRef.current;
    setReplyTarget(null);
    return reply;
  };

  const startReply = (message: ChatMessage) => {
    const reply = quoteFromMessage(message);
    if (!reply) return;
    setReplyTarget(reply);
    setMessageMenu(null);
    window.setTimeout(() => mentionEditorRef.current?.focus(), 0);
  };

  const revealPinnedMessage = (messageId: number) => {
    setPinnedDrawerOpen(false);
    window.dispatchEvent(new CustomEvent("sermo:reveal-message", { detail: { messageId } }));
  };

  const togglePinnedMessage = async (message: ChatMessage) => {
    if (typeof message.id !== "number" || !canManagePinnedMessages) return;
    const existing = pinnedMessages.find((pin) => pin.message.message_id === message.id);
    const pinnedByCurrentUser = existing?.pinned_by_users.some((user) => user.user_id === currentUserId) ?? false;
    setPinSavingMessageId(message.id);
    setMessageMenu(null);
    try {
      if (existing && pinnedByCurrentUser) {
        await api.unpinMessage(message.id);
        const remainingUsers = existing.pinned_by_users.filter((user) => user.user_id !== currentUserId);
        setPinnedMessages((current) =>
          remainingUsers.length
            ? current.map((pin) => pin.message.message_id === message.id ? { ...pin, pinned_by_users: remainingUsers } : pin)
            : current.filter((pin) => pin.message.message_id !== message.id)
        );
        if (pinnedMessages.length === 1 && !remainingUsers.length) setPinnedDrawerOpen(false);
        showToast(t("pin.removed"));
      } else {
        const created = await api.pinMessage(message.id);
        setPinnedMessages((current) => [created, ...current.filter((pin) => pin.message.message_id !== message.id)]);
        showToast(t("pin.added"));
      }
    } catch (error) {
      showToast(error instanceof ApiError ? error.message : t("pin.failed"), "error");
    } finally {
      setPinSavingMessageId(null);
    }
  };

  const openMessageMenu = (message: ChatMessage, element: HTMLElement, pointerX?: number) => {
    if (messageSelectionMode || message.kind === "system") return;
    const rect = element.getBoundingClientRect();
    const placement: "top" | "bottom" = rect.top > 96 ? "top" : "bottom";
    setMessageMenu({
      message,
      anchorX: pointerX ?? rect.left + rect.width / 2,
      anchorY: placement === "top" ? rect.top - 10 : rect.bottom + 10,
      placement,
      confirmDelete: false,
    });
  };

  const cancelMessageSelection = () => {
    if (messageDeleteState === "deleting" || messageSelectionAction) return;
    setMessageSelectionMode(false);
    setSelectedMessageClientIds([]);
    setBatchDeleteConfirmOpen(false);
    setMessageSelectionActionPrompt(null);
  };

  const toggleMessageSelection = (message: ChatMessage) => {
    if (messageDeleteState === "deleting" || message.kind === "system") return;
    setSelectedMessageClientIds((current) => {
      if (current.includes(message.clientId)) return current.filter((item) => item !== message.clientId);
      if (current.length >= 50) {
        showToast(t("message.selectionLimit", { count: 50 }), "error");
        return current;
      }
      return [...current, message.clientId];
    });
  };

  const toggleMessageGroupSelection = (groupMessages: ChatMessage[]) => {
    const selectableIds = groupMessages.filter((message) => message.kind !== "system").map((message) => message.clientId);
    if (!selectableIds.length) return;
    setSelectedMessageClientIds((current) => {
      const selected = new Set(current);
      if (selectableIds.every((clientId) => selected.has(clientId))) {
        return current.filter((clientId) => !selectableIds.includes(clientId));
      }
      const additions = selectableIds.filter((clientId) => !selected.has(clientId));
      if (current.length + additions.length > 50) {
        showToast(t("message.selectionLimit", { count: 50 }), "error");
        return current;
      }
      return [...current, ...additions];
    });
  };

  const startMessageSelection = (message: ChatMessage) => {
    if (message.kind === "system") return;
    setMessageMenu(null);
    setReplyTarget(null);
    setComposerMoreOpen(false);
    setEmojiPickerOpen(false);
    setMessageSelectionMode(true);
    setSelectedMessageClientIds([message.clientId]);
  };

  useLayoutEffect(() => {
    const menu = messageMenuRef.current;
    if (!menu || !messageMenu) return;
    menu.style.setProperty("--message-menu-shift-x", "0px");
    const rect = menu.getBoundingClientRect();
    const safeInset = 12;
    let shift = 0;
    if (rect.left < safeInset) shift = safeInset - rect.left;
    if (rect.right + shift > window.innerWidth - safeInset) {
      shift -= rect.right + shift - (window.innerWidth - safeInset);
    }
    menu.style.setProperty("--message-menu-shift-x", `${Math.round(shift)}px`);
  }, [messageMenu]);

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

    if (!pageActive) return () => controller.abort();

    api
      .getChats(controller.signal)
      .then((rows) => {
        recordChatHealth(cacheScope, true);
        didLoadNetwork = true;
        const nextChats = sortChats(rows.map((item) => mapChat(item, currentUserId)));
        setChats(nextChats);
        setViewState("ready");
        void chatCache.persistChatList(cacheScope, nextChats);
      })
      .catch((apiError) => {
        if (controller.signal.aborted) return;
        recordChatHealth(cacheScope, false);
        const message = apiError instanceof ApiError ? apiError.message : t("chat.loadFailed");
        setPageError(message);
        setViewState("error");
      });

    return () => controller.abort();
  }, [cacheScope, currentUserId, pageActive]);

  useEffect(() => {
    if (!pageActive) return;
    const controller = new AbortController();
    let syncing = false;
    const sync = () => {
      if (syncing || controller.signal.aborted) return;
      syncing = true;
      api.getUserMe(controller.signal)
        .then(setCurrentUserMe)
        .catch(() => undefined)
        .finally(() => {
          syncing = false;
        });
    };
    void sync();
    const timer = window.setInterval(sync, 30_000);
    return () => {
      controller.abort();
      window.clearInterval(timer);
    };
  }, [currentUserId, pageActive]);

  const selectedChat = useMemo(() => {
    const numericChatId = Number(chatId);
    if (!numericChatId) return null;
    return chats.find((chat) => chat.id === numericChatId) ?? null;
  }, [chatId, chats]);
  const selectedChatId = selectedChat?.id ?? null;
  const selectedDirectPeer = useMemo<TinyUserDTO | null>(() => {
    if (!selectedChat || selectedChat.type !== "direct") return null;
    const member = selectedChat.detail.members.find((item) => !item.isSelf);
    return member ? { user_id: member.userId, name: member.name, avatar_uri: member.avatarUri } : null;
  }, [selectedChat]);
  const mentionCandidates = useMemo(() => {
    if (!selectedChat || selectedChat.type !== "group" || mentionSearch === null) return [];
    const query = mentionSearch.toLocaleLowerCase(getActiveLocale());
    return selectedChat.detail.members
      .filter((member) => !member.isSelf && (!query || member.name.toLocaleLowerCase(getActiveLocale()).includes(query)))
      .slice(0, 6);
  }, [mentionSearch, selectedChat]);
  const mentionUserIdsForText = (text: string) => {
    return Array.from(text.matchAll(/<@(\d+)>/g), (match) => Number(match[1]));
  };
  const selectMention = (member: Chat["detail"]["members"][number]) => {
    mentionEditorRef.current?.insertMention(member);
  };
  const mentionGroupMember = (userId: number) => {
    if (!selectedChat || selectedChat.type !== "group") return;
    const member = selectedChat.detail.members.find((item) => item.userId === userId && !item.isSelf);
    if (!member) return;
    mentionEditorRef.current?.insertMention(member);
  };
  const profileDrawerSeed = useMemo(() => {
    if (profileDrawerUserId === null) return null;
    for (const chat of chats) {
      const member = chat.detail.members.find((item) => item.userId === profileDrawerUserId);
      if (member) {
        return {
          user_id: member.userId,
          name: member.name,
          avatar_uri: member.avatarUri,
          is_alive: chat.type === "direct" ? chat.online : undefined,
        };
      }
    }
    return null;
  }, [chats, profileDrawerUserId]);

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
  const canManagePinnedMessages = Boolean(selectedChat && (selectedChat.type === "direct" || selectedChat.isOwner));

  useEffect(() => {
    if (!selectedChat) {
      setPinnedMessages([]);
      return;
    }
    if (!pageActive) return;
    const controller = new AbortController();
    let syncing = false;
    const sync = () => {
      if (syncing || controller.signal.aborted) return;
      syncing = true;
      api.getPinnedMessages(selectedChat.id, controller.signal)
        .then(setPinnedMessages)
        .catch(() => undefined)
        .finally(() => {
          syncing = false;
        });
    };
    sync();
    const interval = window.setInterval(sync, 5000);
    return () => {
      controller.abort();
      window.clearInterval(interval);
    };
  }, [historyReloadVersion, pageActive, selectedChat?.id]);

  useEffect(() => {
    setReplyTarget(null);
    setMessageSelectionMode(false);
    setSelectedMessageClientIds([]);
    setBatchDeleteConfirmOpen(false);
  }, [selectedChat?.id]);

  useEffect(() => {
    const revealMountedElement = (messageId: number) => {
      const element = messageScrollRef.current?.querySelector<HTMLElement>(`[data-message-id="${messageId}"]`);
      if (!element) return false;
      element.scrollIntoView({ behavior: "smooth", block: "center" });
      element.classList.add("is-reply-target");
      window.setTimeout(() => element.classList.remove("is-reply-target"), 1200);
      return true;
    };

    const revealElement = (messageId: number) => {
      if (revealMountedElement(messageId)) return true;
      const groupIndex = messageGroupIndexRef.current.get(messageId);
      if (groupIndex === undefined) return false;
      virtualMessageListRef.current?.scrollToIndex(groupIndex, "center", "auto");
      window.requestAnimationFrame(() => window.requestAnimationFrame(() => revealMountedElement(messageId)));
      return true;
    };

    const reveal = (event: Event) => {
      const messageId = Number((event as CustomEvent<{ messageId?: number }>).detail?.messageId);
      if (!selectedChat || !Number.isInteger(messageId) || revealElement(messageId)) return;

      const numericMessages = selectedMessages.filter((message): message is ChatMessage & { id: number } => typeof message.id === "number");
      const oldestId = numericMessages[0]?.id;
      const newestId = numericMessages[numericMessages.length - 1]?.id;
      const request =
        oldestId === undefined || newestId === undefined
          ? api.getMessages({ chat_id: selectedChat.id, limit: 60, before: messageId + 1 })
          : messageId < oldestId
            ? loadMessagesBeforeThrough(selectedChat.id, oldestId, messageId)
            : loadMessagesAfterThrough(
                selectedChat.id,
                Math.max(0, ...numericMessages.filter((message) => message.id < messageId).map((message) => message.id)),
                messageId
              );

      void request
        .then((rows) => {
          const loaded = rows.map((row) => mapChatMessage(row, currentUserId));
          setMessages((current) => ({
            ...current,
            [selectedChat.id]: mergeMessages(current[selectedChat.id] ?? [], loaded),
          }));
          window.requestAnimationFrame(() => window.requestAnimationFrame(() => revealElement(messageId)));
        })
        .catch(() => setPageError(t("message.locateOriginalFailed")));
    };

    window.addEventListener("sermo:reveal-message", reveal);
    return () => window.removeEventListener("sermo:reveal-message", reveal);
  }, [currentUserId, selectedChat, selectedMessages]);

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
      redirectToChatListWithNotice(t("chat.invalidLink"));
      return;
    }
    if (selectedChat || viewState === "idle" || viewState === "loading") return;
    redirectToChatListWithNotice(pageError ?? t("chat.accessDenied"), routeChatId);
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
      recordingAttemptRef.current += 1;
      recordingCancelledRef.current = true;
      resetVoiceComposer();
    };
  }, []);

  useEffect(() => {
    recordingAttemptRef.current += 1;
    recordingCancelledRef.current = true;
    if (mediaRecorderRef.current?.state === "recording") {
      mediaRecorderRef.current.stop();
      return;
    }
    resetVoiceComposer();
  }, [selectedChat?.id]);

  const loadMoreMessageSearchResults = async () => {
    if (!selectedChat || !messageSearchHasMore || messageSearchNextBefore === null || messageSearchState === "loading-more") return;
    setMessageSearchState("loading-more");
    try {
      const response = await api.searchMessages({
        chat_id: selectedChat.id,
        limit: 30,
        keyword: messageSearchKeyword.trim() || undefined,
        type: messageSearchType ?? undefined,
        before: messageSearchNextBefore,
      });
      setMessageSearchResults((current) => {
        const known = new Set(current.map((message) => message.message_id));
        return [...current, ...response.items.filter((message) => !known.has(message.message_id))];
      });
      setMessageSearchHasMore(response.has_more);
      setMessageSearchNextBefore(response.next_before);
      setMessageSearchState("idle");
    } catch {
      setMessageSearchState("error");
    }
  };

  useEffect(() => {
    if (!messageSearchOpen || !selectedChat) return;
    const controller = new AbortController();
    const timeoutId = window.setTimeout(() => {
      setMessageSearchState("loading");
      api.searchMessages({
        chat_id: selectedChat.id,
        limit: 30,
        keyword: messageSearchKeyword.trim() || undefined,
        type: messageSearchType ?? undefined,
      }, controller.signal)
        .then((response) => {
          setMessageSearchResults(response.items);
          setMessageSearchHasMore(response.has_more);
          setMessageSearchNextBefore(response.next_before);
          setMessageSearchState("idle");
        })
        .catch((error) => {
          if ((error as Error).name !== "AbortError") setMessageSearchState("error");
        });
    }, 220);
    return () => {
      window.clearTimeout(timeoutId);
      controller.abort();
    };
  }, [messageSearchKeyword, messageSearchOpen, messageSearchType, selectedChat?.id]);

  useEffect(() => {
    if (!detailsSheetOpen) return;
    setDetailMemberLimit(CHAT_DETAIL_MEMBER_PAGE_SIZE);
  }, [detailsSheetOpen, selectedChat?.id]);

  useEffect(() => {
    if (!detailsSheetOpen || !selectedChat) {
      setHistoryRecoveryStatus(null);
      return;
    }
    const controller = new AbortController();
    setHistoryRecoveryLoading(true);
    api.getChatHistoryRecoveryStatus(selectedChat.id, controller.signal)
      .then(setHistoryRecoveryStatus)
      .catch(() => setHistoryRecoveryStatus(null))
      .finally(() => {
        if (!controller.signal.aborted) setHistoryRecoveryLoading(false);
      });
    return () => controller.abort();
  }, [detailsSheetOpen, historyReloadVersion, selectedChat?.id]);

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

  const messageGroups = useMemo(() => buildMessageGroups(selectedMessages), [selectedMessages]);

  messageGroupIndexRef.current = new Map(
    messageGroups.flatMap((group, groupIndex) => group.messages.flatMap((message) => (
      typeof message.id === "number" ? [[message.id, groupIndex] as const] : []
    )))
  );

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
    if (!selectedChatId || !cacheScope) return;
    const controller = new AbortController();
    setOlderState("idle");
    setHasOlderMessages(false);

    const restoreScroll = (releaseAnchor = false) => {
      requestAnimationFrame(() => requestAnimationFrame(() => {
        const element = messageScrollRef.current;
        if (!element) return;
        element.scrollTop = element.scrollHeight;
        stickToBottomRef.current = true;
        if (releaseAnchor) {
          window.setTimeout(() => {
            if (initialBottomAnchorRef.current === selectedChatId) {
              initialBottomAnchorRef.current = null;
            }
          }, 180);
        }
      }));
    };

    initialBottomAnchorRef.current = selectedChatId;

    let restoredThread = chatCache.getThread(cacheScope, selectedChatId);
    if (restoredThread?.messages.length) {
      setMessages((current) => ({
        ...current,
        [selectedChatId]: mergeMessages(current[selectedChatId] ?? [], sortMessages(restoredThread?.messages ?? [])),
      }));
      setHasOlderMessages(restoredThread.hasOlderMessages);
      restoreScroll();
    }

    const loadLatestMessages = async () => {
      try {
        if (!restoredThread) {
          restoredThread = await chatCache.hydrateThread(cacheScope, selectedChatId);
          if (controller.signal.aborted) return;
          if (restoredThread?.messages.length) {
            setMessages((current) => ({
              ...current,
              [selectedChatId]: mergeMessages(current[selectedChatId] ?? [], sortMessages(restoredThread?.messages ?? [])),
            }));
            setHasOlderMessages(restoredThread.hasOlderMessages);
            restoreScroll();
          }
        }

        const rows = await api.getMessages(
          {
            chat_id: selectedChatId,
            limit: 30,
          },
          controller.signal
        );
        recordChatHealth(cacheScope, true);
        const normalized = sortMessages(rows.map((row) => mapChatMessage(row, currentUserId)));
        let cachedMessages = restoredThread?.messages ?? [];
        const cachedIds = cachedMessages.flatMap((message) => (typeof message.id === "number" ? [message.id] : []));
        const reconciledDeletedIds = new Set<number>();
        for (let index = 0; index < cachedIds.length; index += 50) {
          const result = await api.reconcileMessages(selectedChatId, cachedIds.slice(index, index + 50));
          result.deleted_message_ids.forEach((messageId) => reconciledDeletedIds.add(messageId));
        }
        if (reconciledDeletedIds.size) {
          cachedMessages
            .filter((message) => typeof message.id === "number" && reconciledDeletedIds.has(message.id))
            .forEach((message) => purgeCachedMedia([message.payload?.uri, message.payload?.thumbnail_uri]));
          cachedMessages = cachedMessages.filter((message) => typeof message.id !== "number" || !reconciledDeletedIds.has(message.id));
        }
        const latestIds = normalized.flatMap((message) => (typeof message.id === "number" ? [message.id] : []));
        const cachedMaxId = cachedIds.length ? Math.max(...cachedIds) : null;
        const latestMaxId = latestIds.length ? Math.max(...latestIds) : null;
        const bridgeRows =
          cachedMaxId !== null && latestMaxId !== null && cachedMaxId < latestMaxId
            ? await loadMessagesAfterThrough(selectedChatId, cachedMaxId, latestMaxId, controller.signal)
            : [];
        if (controller.signal.aborted) return;
        const bridged = bridgeRows.map((row) => mapChatMessage(row, currentUserId));
        let mergedMessages = mergeMessages(mergeMessages(cachedMessages, bridged), normalized);
        if (DEBUG_CHAT_SEND) {
          console.log("[chat] loadLatestMessages response", {
            chatId: selectedChatId,
            normalized: normalized.map((message) => ({
              id: message.id,
              clientId: message.clientId,
              status: message.status,
              text: message.text,
            })),
            cachedCount: cachedMessages.length,
            bridgeCount: bridged.length,
          });
        }
        setMessages((current) => {
          const currentThreadMessages = (current[selectedChatId] ?? []).filter(
            (message) => typeof message.id !== "number" || !reconciledDeletedIds.has(message.id)
          );
          mergedMessages = mergeMessages(mergeMessages(currentThreadMessages, bridged), normalized);
          if (DEBUG_CHAT_SEND) {
            console.log("[chat] loadLatestMessages merge", {
              chatId: selectedChatId,
              currentCount: currentThreadMessages.length,
              mergedCount: mergedMessages.length,
            });
          }
          return {
            ...current,
            [selectedChatId]: mergedMessages,
          };
        });
        const hasOlder = rows.length >= 30 || restoredThread?.hasOlderMessages || false;
        setHasOlderMessages(hasOlder);
        chatCache.setThread(cacheScope, selectedChatId, {
          messages: mergedMessages,
          hasOlderMessages: hasOlder,
          scrollTop: restoredThread?.scrollTop ?? 0,
          updatedAt: Date.now(),
        });
        void chatCache.persistThread(cacheScope, selectedChatId, {
          messages: mergedMessages,
          hasOlderMessages: hasOlder,
          scrollTop: restoredThread?.scrollTop ?? 0,
          updatedAt: Date.now(),
        });
        restoreScroll(true);
        void api.markChatRead(selectedChatId).then(() => {
          setChats((currentChats) => currentChats.map((chat) => (chat.id === selectedChatId ? clearChatUnread(chat) : chat)));
        });
      } catch (apiError) {
        if (initialBottomAnchorRef.current === selectedChatId) {
          initialBottomAnchorRef.current = null;
        }
        if (!controller.signal.aborted) recordChatHealth(cacheScope, false);
        if (isChatAccessBoundaryError(apiError)) {
          redirectToChatListWithNotice(chatAccessBoundaryMessage(apiError), selectedChatId);
          return;
        }
        if (!controller.signal.aborted) {
          const hasLocalMessages = Boolean((messages[selectedChatId] ?? []).length || restoredThread?.messages.length);
          if (!hasLocalMessages) {
            const message = apiError instanceof ApiError ? apiError.message : t("message.loadFailed");
            setPageError(message);
          }
        }
      }
    };

    void loadLatestMessages();
    return () => {
      const element = messageScrollRef.current;
      chatCache.updateThreadScroll(cacheScope, selectedChatId, element?.scrollTop ?? 0);
      controller.abort();
      if (initialBottomAnchorRef.current === selectedChatId) {
        initialBottomAnchorRef.current = null;
      }
    };
  }, [cacheScope, currentUserId, historyReloadVersion, selectedChatId]);

  useEffect(() => {
    if (!selectedChat) {
      initialScrollDoneRef.current = null;
      initialBottomAnchorRef.current = null;
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
    setComposerMoreOpen(false);
    setEmojiPickerOpen(false);
    setEmojiPage(STICKER_MY_PAGE);
    setStickerManagerOpen(false);
    setStickerManagerSelecting(false);
    setSelectedStickerIds([]);
  }, [selectedChat?.id]);

  useEffect(() => {
    if (!currentUserId) {
      setStickers([]);
      setMineStickersHasMore(false);
      mineStickerOffsetRef.current = 0;
      return;
    }
    const controller = new AbortController();
    mineStickerRequestRef.current = true;
    setMineStickersLoading(true);
    void api.getStickers(0, STICKER_PAGE_SIZE, controller.signal)
      .then((response) => {
        setStickers(response.items);
        setMineStickersHasMore(response.has_more);
        mineStickerOffsetRef.current = response.next_offset;
      })
      .catch(() => undefined)
      .finally(() => {
        mineStickerRequestRef.current = false;
        if (!controller.signal.aborted) setMineStickersLoading(false);
      });
    return () => controller.abort();
  }, [currentUserId]);

  useEffect(() => {
    if (!emojiPickerOpen || emojiPage !== STICKER_EXPLORE_PAGE || !currentUserId) return;
    const controller = new AbortController();
    exploreStickerRequestRef.current = true;
    setExploreStickersLoading(true);
    void api.exploreStickers(0, STICKER_PAGE_SIZE, controller.signal)
      .then((response) => {
        setExploreStickers(response.items);
        setExploreStickersHasMore(response.has_more);
        exploreStickerOffsetRef.current = response.next_offset;
      })
      .catch(() => undefined)
      .finally(() => {
        exploreStickerRequestRef.current = false;
        if (!controller.signal.aborted) setExploreStickersLoading(false);
      });
    return () => controller.abort();
  }, [currentUserId, emojiPage, emojiPickerOpen]);

  const loadMoreMineStickers = async () => {
    if (!currentUserId || !mineStickersHasMore || mineStickerRequestRef.current) return;
    mineStickerRequestRef.current = true;
    setMineStickersLoading(true);
    try {
      const response = await api.getStickers(mineStickerOffsetRef.current, STICKER_PAGE_SIZE);
      setStickers((current) => {
        const known = new Set(current.map((item) => item.sticker_id));
        return [...current, ...response.items.filter((item) => !known.has(item.sticker_id))];
      });
      setMineStickersHasMore(response.has_more);
      mineStickerOffsetRef.current = response.next_offset;
    } catch {
      // Keep the page available so a later scroll can retry transient failures.
    } finally {
      mineStickerRequestRef.current = false;
      setMineStickersLoading(false);
    }
  };

  const loadMoreExploreStickers = async () => {
    if (!currentUserId || !exploreStickersHasMore || exploreStickerRequestRef.current) return;
    exploreStickerRequestRef.current = true;
    setExploreStickersLoading(true);
    try {
      const response = await api.exploreStickers(exploreStickerOffsetRef.current, STICKER_PAGE_SIZE);
      setExploreStickers((current) => {
        const known = new Set(current.map((item) => item.sticker_asset_id));
        return [...current, ...response.items.filter((item) => !known.has(item.sticker_asset_id))];
      });
      setExploreStickersHasMore(response.has_more);
      exploreStickerOffsetRef.current = response.next_offset;
    } catch {
      // Keep the page available so a later scroll can retry transient failures.
    } finally {
      exploreStickerRequestRef.current = false;
      setExploreStickersLoading(false);
    }
  };

  const handleStickerGridScroll = (
    event: ReactUIEvent<HTMLDivElement>,
    page: "mine" | "explore",
  ) => {
    const grid = event.currentTarget;
    if (grid.scrollHeight - grid.scrollTop - grid.clientHeight > 96) return;
    if (page === "mine") void loadMoreMineStickers();
    else void loadMoreExploreStickers();
  };

  useEffect(() => {
    cacheMediaLocally([...stickers, ...exploreStickers].map((sticker) => resolveStableResourceUri(sticker.uri) ?? sticker.uri));
  }, [exploreStickers, stickers]);

  useEffect(() => {
    const nextDraft = cacheScope && selectedChat ? readChatDraft(cacheScope, selectedChat.id) : "";
    setDraft(nextDraft);
    setMentionSearch(null);
    window.requestAnimationFrame(() => mentionEditorRef.current?.moveCaretToEnd());
  }, [cacheScope, selectedChat?.id]);

  const insertEmoji = (emoji: string) => {
    mentionEditorRef.current?.insertText(emoji);
  };

  const sendSticker = async (sticker: StickerAssetDTO | StickerDTO) => {
    if (!selectedChat || stickerSaving) return;
    const clientId = `temp:sticker:${Date.now()}:${Math.random().toString(36).slice(2, 8)}`;
    const createdAt = Math.floor(Date.now() / 1000);
    const reply = consumeReplyTarget();
    const optimisticMessage: ChatMessage = {
      id: clientId,
      clientId,
      userId: currentUserId,
      from: "self",
      type: MESSAGE_TYPE_STICKER,
      kind: "sticker",
      name: currentUserName,
      ...pendingMessageAppearance,
      time: formatTime(createdAt),
      createdAt,
      text: t("sticker.messagePlaceholder"),
      payload: {
        kind: "sticker",
        uri: sticker.uri,
        sticker_asset_id: sticker.sticker_asset_id,
        content_hash: sticker.content_hash,
        pixel_width: sticker.pixel_width,
        pixel_height: sticker.pixel_height,
      },
      replyTo: reply,
      status: "pending",
    };
    setMessages((current) => ({
      ...current,
      [selectedChat.id]: sortMessages([...(current[selectedChat.id] ?? []), optimisticMessage]),
    }));
    setChats((current) => sortChats(current.map((chat) => chat.id === selectedChat.id
      ? updateChatSummary(chat, t("sticker.messagePlaceholder"), createdAt)
      : chat)));
    triggerMessageEntrance(clientId);
    stickToBottomRef.current = true;
    updateSendTask(clientId, 0.2);
    try {
      const created = await api.sendMessage(
        selectedChat.id,
        MESSAGE_TYPE_STICKER,
        JSON.stringify("sticker_id" in sticker
          ? { sticker_id: sticker.sticker_id }
          : { asset_id: sticker.sticker_asset_id }),
        reply?.message_id,
        clientId,
      );
      updateSendTask(clientId, 0.9);
      const delivered = mapChatMessage(created, currentUserId);
      setMessages((current) => ({
        ...current,
        [selectedChat.id]: confirmPendingMessage(current[selectedChat.id] ?? [], clientId, delivered),
      }));
    } catch {
      setMessages((current) => ({
        ...current,
        [selectedChat.id]: updateMessageStatus(current[selectedChat.id] ?? [], clientId, "failed"),
      }));
    } finally {
      finishSendTask(clientId);
    }
  };

  const addStickerFromFile = async (file: File) => {
    if (stickerSaving || !requireComposerCapability("menu.sticker.create", 6, t("sticker.create"))) return;
    setStickerSaving(true);
    try {
      const sticker = await addStickerFile(file);
      setStickers((current) => [sticker, ...current.filter((item) => item.sticker_id !== sticker.sticker_id)]);
      setExploreStickers((current) => current.filter((item) => item.sticker_asset_id !== sticker.sticker_asset_id));
      showToast(t("sticker.added"));
    } catch {
      showToast(t("sticker.addFailed"), "error");
    } finally {
      setStickerSaving(false);
      if (stickerInputRef.current) stickerInputRef.current.value = "";
    }
  };

  const toggleStickerSelection = (stickerId: number) => {
    if (!stickerManagerSelecting || stickerSaving) return;
    setSelectedStickerIds((current) => current.includes(stickerId)
      ? current.filter((id) => id !== stickerId)
      : [...current, stickerId]);
  };

  const closeStickerManager = () => {
    if (stickerSaving) return;
    setStickerManagerOpen(false);
    setStickerManagerSelecting(false);
    setSelectedStickerIds([]);
  };

  const openStickerManager = () => {
    setEmojiPickerOpen(false);
    setStickerManagerOpen(true);
  };

  const deleteSelectedStickers = async () => {
    if (stickerSaving || !selectedStickerIds.length) return;
    const deletingIds = [...selectedStickerIds];
    setStickerSaving(true);
    try {
      await Promise.all(deletingIds.map((stickerId) => api.deleteSticker(stickerId)));
      const deleting = stickers.filter((sticker) => deletingIds.includes(sticker.sticker_id));
      setStickers((current) => current.filter((item) => !deletingIds.includes(item.sticker_id)));
      purgeCachedMedia(deleting.map((sticker) => sticker.uri));
      setSelectedStickerIds([]);
      setStickerManagerSelecting(false);
      setStickerDeleteConfirmOpen(false);
      showToast(t("sticker.removedCount", { count: deletingIds.length }));
    } catch {
      showToast(t("sticker.removeFailed"), "error");
    } finally {
      setStickerSaving(false);
    }
  };

  const collectExploredSticker = async (asset: StickerAssetDTO) => {
    if (stickerSaving) return;
    setStickerSaving(true);
    try {
      const sticker = await api.collectStickerAsset(asset.sticker_asset_id);
      setStickers((current) => [sticker, ...current.filter((item) => item.sticker_id !== sticker.sticker_id)]);
      setExploreStickers((current) => current.filter((item) => item.sticker_asset_id !== asset.sticker_asset_id));
      showToast(t("sticker.added"));
    } catch {
      showToast(t("sticker.addFailed"), "error");
    } finally {
      setStickerSaving(false);
    }
  };

  const ownsStickerMessage = (message: ChatMessage) => {
    const assetId = message.payload?.sticker_asset_id;
    const contentHash = message.payload?.content_hash;
    return stickers.some((sticker) => (
      (assetId && sticker.sticker_asset_id === assetId)
      || (contentHash && sticker.content_hash === contentHash)
    ));
  };

  const collectStickerMessage = async () => {
    if (!messageMenu || messageMenu.message.kind !== "sticker") return;
    const assetId = messageMenu.message.payload?.sticker_asset_id;
    if (!assetId || ownsStickerMessage(messageMenu.message) || stickerSaving) return;
    setMessageMenu(null);
    setStickerSaving(true);
    try {
      const sticker = await api.collectStickerAsset(assetId);
      setStickers((current) => [sticker, ...current.filter((item) => item.sticker_id !== sticker.sticker_id)]);
      setExploreStickers((current) => current.filter((item) => item.sticker_asset_id !== assetId));
      showToast(t("sticker.added"));
    } catch {
      showToast(t("sticker.addFailed"), "error");
    } finally {
      setStickerSaving(false);
    }
  };

  const collectImageAsSticker = async () => {
    if (!messageMenu || messageMenu.message.kind !== "image" || typeof messageMenu.message.id !== "number") return;
    const messageId = messageMenu.message.id;
    setMessageMenu(null);
    try {
      const sticker = await api.collectMessageSticker(messageId);
      setStickers((current) => [sticker, ...current.filter((item) => item.sticker_id !== sticker.sticker_id)]);
      setExploreStickers((current) => current.filter((item) => item.sticker_asset_id !== sticker.sticker_asset_id));
      showToast(t("sticker.added"));
    } catch {
      showToast(t("sticker.addFailed"), "error");
    }
  };

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
      if (!detail || (!detail.items.length && !detail.removed?.length && !detail.chatStates?.length)) return;

      const grouped = new Map<number, ChatSyncEventDetail["items"]>();
      const chatStates = new Map((detail.chatStates ?? []).map((state) => [state.chat_id, state]));
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
        for (const removed of detail.removed ?? []) {
          const existing = next[removed.chatId] ?? [];
          const target = existing.find((message) => message.id === removed.messageId);
          if (target) purgeCachedMedia([target.payload?.uri, target.payload?.thumbnail_uri]);
          next[removed.chatId] = existing.filter((message) => message.id !== removed.messageId);
        }
        for (const [chatId, items] of grouped) {
          next[chatId] = mergeMessages(next[chatId] ?? [], items.map((item) => item.message));
        }
        return next;
      });
      if (detail.removed?.length) {
        const removedIds = new Set(detail.removed.map((item) => item.messageId));
        setPinnedMessages((current) => current.filter((pin) => !removedIds.has(pin.message.message_id)));
      }

      setChats((currentChats) =>
        sortChats(
          currentChats.map((chat) => {
            const incoming = grouped.get(chat.id);
            const readState = chatStates.get(chat.id);
            if (!incoming?.length && !readState) return chat;
            const newest = incoming?.[incoming.length - 1]?.message;
            return {
              ...chat,
              ...(newest ? {
                preview: previewFromMessage(newest),
                time: formatChatListTime(newest.createdAt),
                lastActivity: newest.createdAt,
              } : {}),
              unread: chat.id === selectedChat?.id
                ? 0
                : readState?.unread_count ?? chat.unread,
              unreadBadgeMuted: readState?.unread_badge_muted ?? chat.unreadBadgeMuted,
              hasUnreadMention: chat.id === selectedChat?.id ? false : readState?.has_unread_mention ?? chat.hasUnreadMention,
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

  const filteredChats = chats;
  const detailMembers = selectedChat?.detail.members ?? [];
  const visibleDetailMembers = detailMembers.slice(0, detailMemberLimit);
  const hasMoreDetailMembers = detailMembers.length > detailMemberLimit;
  const chatMemberNewIds = groupSelectedIds.filter((userId) => !chatMemberLockedIds.includes(userId));
  const chatMemberActionIds = chatMemberPickerMode === "remove" ? groupSelectedIds : chatMemberNewIds;

  const updateSelectedChatPreference = async (kind: "pin" | "online" | "mute" | "badge", enabled: boolean) => {
    if (!selectedChat || preferenceSaving) return;
    if (kind === "online" && enabled && !requireComposerCapability("chat.reminder.online", 7, t("chat.enableOnlineReminder"))) return;
    const chatIdToUpdate = selectedChat.id;
    const field = kind === "pin" ? "pinned" : kind === "online" ? "onlineReminderEnabled" : kind === "mute" ? "notificationsMuted" : "unreadBadgeMuted";
    setPreferenceSaving(kind);
    setChats((current) => sortChats(current.map((chat) => (chat.id === chatIdToUpdate ? { ...chat, [field]: enabled, ...(kind === "mute" && !enabled ? { unreadBadgeMuted: false } : {}), ...(kind === "badge" && enabled ? { notificationsMuted: true } : {}) } : chat))));
    try {
      const preference = await api.updateChatPreference(chatIdToUpdate, {
        ...(kind === "pin" ? { pinned: enabled ? 1 : 0 } : kind === "online" ? { online_reminder_enabled: enabled ? 1 : 0 } : kind === "mute" ? { notifications_muted: enabled ? 1 : 0 } : { unread_badge_muted: enabled ? 1 : 0 }),
      });
      setChats((current) =>
        sortChats(
          current.map((chat) =>
            chat.id === chatIdToUpdate
              ? { ...chat, pinned: preference.pinned, onlineReminderEnabled: preference.online_reminder_enabled, notificationsMuted: preference.notifications_muted, unreadBadgeMuted: preference.unread_badge_muted }
              : chat
          )
        )
      );
    } catch (apiError) {
      setChats((current) => sortChats(current.map((chat) => (chat.id === chatIdToUpdate ? { ...chat, [field]: !enabled, notificationsMuted: selectedChat.notificationsMuted, unreadBadgeMuted: selectedChat.unreadBadgeMuted } : chat))));
      setPageError(apiError instanceof ApiError ? apiError.message : t("chat.settingsSaveFailed"));
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
    const capabilityKey = selectedChat.type === "group" ? "chat.group.invite" : "chat.group.create";
    const label = selectedChat.type === "group" ? t("chat.inviteGroupMembers") : t("chat.createGroup");
    if (!requireComposerCapability(capabilityKey, 4, label)) return;
    const verified = await ensureCurrentUserVerified();
    if (!verified) {
      setPageError(t("chat.verifyToAddMembers"));
      return;
    }
    setDetailsSheetOpen(false);
    setGroupQuery("");
    setChatMemberPickerMode("add");
    const lockedIds = selectedChat.detail.members.filter((member) => !member.isSelf).map((member) => member.userId);
    setChatMemberLockedIds(lockedIds);
    setGroupSelectedIds(lockedIds);
    setChatMemberPickerOpen(true);
  };

  const openChatMemberRemover = () => {
    if (!selectedChat || selectedChat.type !== "group" || !selectedChat.isOwner) return;
    setDetailsSheetOpen(false);
    setGroupQuery("");
    setChatMemberPickerMode("remove");
    setChatMemberLockedIds(
      selectedChat.detail.members.filter((member) => member.isSelf || member.isOwner).map((member) => member.userId)
    );
    setGroupSelectedIds([]);
    setChatMemberPickerOpen(true);
  };

  const closeChatMemberPicker = () => {
    if (groupManageState === "saving") return;
    setChatMemberPickerOpen(false);
    setGroupQuery("");
    setGroupSelectedIds([]);
    setChatMemberLockedIds([]);
    setChatMemberPickerMode("add");
  };

  const removeFriend = async () => {
    if (!selectedChat || selectedChat.type !== "direct") return;
    const peer = selectedChat.detail.members.find((member) => !member.isSelf);
    if (!peer) {
      setPageError(t("friends.currentMissing"));
      return;
    }

    try {
      setFriendDeleteSaving(true);
      await api.removeFriendRequest(peer.userId);
      setFriendDangerConfirmOpen(false);
      setDetailsSheetOpen(false);
      showToast(t("friends.deleted"));
    } catch (apiError) {
      showToast(apiError instanceof ApiError ? apiError.message : t("common.deleteFailed"), "error");
    } finally {
      setFriendDeleteSaving(false);
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
        const message = apiError instanceof ApiError ? apiError.message : t("chat.candidatesLoadFailed");
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
            .filter((member) => chatMemberPickerMode === "remove" || !member.isSelf)
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
                }) as UserDTO
            )
        : [];
    const baseCandidates = (chatMemberPickerMode === "remove" ? chatMemberRows : [...chatMemberRows, ...groupFriendPool]).filter(
      (user, index, rows) => rows.findIndex((item) => item.user_id === user.user_id) === index
    );

    setGroupCandidates(filterUsersByName(baseCandidates, groupQuery));
  }, [chatMemberPickerMode, chatMemberPickerOpen, groupCreateOpen, groupFriendPool, groupQuery, selectedChat]);

  useEffect(() => {
    const element = mentionEditorRef.current?.getElement();
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

    const reply = consumeReplyTarget();
    const mentionUserIds = mentionUserIdsForText(message);
    const optimisticMentions = selectedChat.detail.members
      .filter((member) => mentionUserIds.includes(member.userId))
      .map((member) => ({
        user_id: member.userId,
        name: member.name,
        avatar_type: member.avatarUri ? "custom" as const : "preset" as const,
        avatar_uri: member.avatarUri ?? "",
        official: false,
      }));
    const optimisticMessage = createPendingMessage(message, currentUserName, currentUserId, pendingMessageAppearance, optimisticMentions, reply);
    const readableMessage = readableMentionText(message, optimisticMentions);

    try {
      setSendState("sending");
      updateSendTask(optimisticMessage.clientId, 0.12);
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
              chat.id === selectedChat.id ? updateChatSummary(chat, readableMessage, optimisticMessage.createdAt) : chat
            )
          )
        );
        updateDraft("");
      });
      if (DEBUG_CHAT_SEND) {
        console.log("[chat] optimistic inserted", {
          chatId: selectedChat.id,
          optimisticId: optimisticMessage.id,
        });
      }
      triggerMessageEntrance(optimisticMessage.clientId);
      stickToBottomRef.current = true;
      recordOptimisticEmojiUsage(readableMessage);
      const created = await api.sendMessage(selectedChat.id, MESSAGE_TYPE_TEXT, message, reply?.message_id, optimisticMessage.clientId, mentionUserIds);
      updateSendTask(optimisticMessage.clientId, 0.9);
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
      void syncEmojiUsage();
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
      void syncEmojiUsage();
    } finally {
      finishSendTask(optimisticMessage.clientId);
      setSendState("idle");
    }
  };

  const retryFailedMessage = async (message: ChatMessage) => {
    if (!selectedChat || message.status !== "failed" || !["text", "image", "video", "audio", "file"].includes(message.kind)) return;

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
    updateSendTask(retryMessage.clientId, 0.12);

    try {
      let created: ChatMessageDTO;
      if (["image", "video", "audio", "file"].includes(retryMessage.kind)) {
        const sourceUri = retryMessage.localPreviewUri ?? retryMessage.payload?.uri;
        if (!sourceUri) throw new Error("media_source_missing");
        const response = await fetch(sourceUri);
        if (!response.ok) throw new Error("media_source_unavailable");
        const blob = await response.blob();
        const fallbackMimeType = retryMessage.kind === "image"
          ? "image/jpeg"
          : retryMessage.kind === "video"
            ? "video/mp4"
            : retryMessage.kind === "audio"
              ? "audio/webm"
              : "application/octet-stream";
        const mimeType = retryMessage.payload?.mime_type || blob.type || fallbackMimeType;
        const fallbackFileName = retryMessage.kind === "image"
          ? "image-message.jpg"
          : retryMessage.kind === "video"
            ? "video-message.mp4"
            : retryMessage.kind === "audio"
              ? "voice-message.webm"
              : "sermo-file";
        const file = new File([blob], retryMessage.payload?.file_name || fallbackFileName, { type: mimeType });
        const mediaKind = retryMessage.kind as MessageMediaKind;
        const upload = await uploadMessageMedia(file, mediaKind, (progress) => {
          updateSendTask(retryMessage.clientId, 0.12 + progress * 0.76);
        }, retryMessage.payload?.duration_seconds);
        created = await api.sendMessage(
          selectedChat.id,
          messageTypeFromKind(mediaKind),
          "",
          retryMessage.replyTo?.message_id,
          retryMessage.clientId,
          [],
          upload.resource?.resource_id,
        );
      } else {
        recordOptimisticEmojiUsage(retryMessage.text);
        created = await api.sendMessage(selectedChat.id, MESSAGE_TYPE_TEXT, retryMessage.text, retryMessage.replyTo?.message_id, retryMessage.clientId, mentionUserIdsForText(retryMessage.text));
      }
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
                  time: t("time.justNow"),
                  lastActivity: deliveredMessage.createdAt,
                  unread: 0,
                }
              : chat
          )
        )
      );
      if (retryMessage.kind === "text") void syncEmojiUsage();
    } catch {
      setMessages((current) => ({
        ...current,
        [selectedChat.id]: updateMessageStatus(current[selectedChat.id] ?? [], retryMessage.clientId, "failed"),
      }));
      if (retryMessage.kind === "text") void syncEmojiUsage();
    } finally {
      finishSendTask(retryMessage.clientId);
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
    const reply = consumeReplyTarget();
    const createdAt = Math.floor(Date.now() / 1000);
    const objectUrl = URL.createObjectURL(file);
    localObjectUrlsRef.current.add(objectUrl);
    const clientId = `temp:${Date.now()}:${Math.random().toString(36).slice(2, 8)}`;
    const pendingMessage: ChatMessage = {
      id: clientId,
      clientId,
      userId: currentUserId,
      from: "self",
      type: messageTypeFromKind(kind),
      kind,
      name: currentUserName,
      ...pendingMessageAppearance,
      time: formatTime(createdAt),
      createdAt,
      text: previewFromKind(kind, ""),
      payload: {
        kind,
        uri: objectUrl,
        mime_type: file.type || extraPayload.mime_type,
        duration_seconds: extraPayload.duration_seconds,
        file_name: extraPayload.file_name,
        file_size: extraPayload.file_size,
      },
      localPreviewUri: objectUrl,
      replyTo: reply,
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
    updateSendTask(pendingMessage.clientId, 0.03);

    try {
      const upload = await uploadMessageMedia(file, kind, (progress) => {
        updateSendTask(pendingMessage.clientId, 0.05 + progress * 0.84);
      }, extraPayload.duration_seconds);
      if (cancelledSendIdsRef.current.has(pendingMessage.clientId)) return false;
      updateSendTask(pendingMessage.clientId, 0.92);
      const created = await api.sendMessage(
        selectedChat.id,
        messageTypeFromKind(kind),
        "",
        reply?.message_id,
        pendingMessage.clientId,
        [],
        upload.resource?.resource_id,
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
      return true;
    } catch (error) {
      setMessages((current) => ({
        ...current,
        [selectedChat.id]: updateMessageStatus(current[selectedChat.id] ?? [], pendingMessage.clientId, "failed"),
      }));
      const uploadError = toMessageUploadError(error);
      setPageError(uploadError.message);
      return false;
    } finally {
      if (cancelledSendIdsRef.current.delete(pendingMessage.clientId)) {
        setSendTasks((current) => {
          const next = { ...current };
          delete next[pendingMessage.clientId];
          return next;
        });
      } else {
        finishSendTask(pendingMessage.clientId);
      }
    }
  };

  const sendCloudFileMessage = async (asset: CloudResourceDTO) => {
    if (!selectedChat) return;
    const reply = consumeReplyTarget();
    const createdAt = Math.floor(Date.now() / 1000);
    const clientId = `temp:cloud-file:${Date.now()}:${Math.random().toString(36).slice(2, 8)}`;
    const pendingMessage: ChatMessage = {
      id: clientId,
      clientId,
      userId: currentUserId,
      from: "self",
      type: MESSAGE_TYPE_FILE,
      kind: "file",
      name: currentUserName,
      ...pendingMessageAppearance,
      time: formatTime(createdAt),
      createdAt,
      text: previewFromKind("file", ""),
      payload: {
        kind: "file",
        uri: asset.uri,
        mime_type: asset.mime_type,
        file_name: asset.file_name,
        file_size: asset.file_size,
      },
      replyTo: reply,
      status: "pending",
    };

    setMessages((current) => ({
      ...current,
      [selectedChat.id]: sortMessages([...(current[selectedChat.id] ?? []), pendingMessage]),
    }));
    setChats((currentChats) => sortChats(currentChats.map((chat) => (
      chat.id === selectedChat.id ? updateChatSummary(chat, previewFromMessage(pendingMessage), createdAt) : chat
    ))));
    stickToBottomRef.current = true;
    triggerMessageEntrance(clientId);
    updateSendTask(clientId, 0.4);

    try {
      const created = await api.sendMessage(
        selectedChat.id,
        MESSAGE_TYPE_FILE,
        "",
        reply?.message_id,
        clientId,
        [],
        asset.resource_id,
      );
      updateSendTask(clientId, 0.9);
      const deliveredMessage = mapChatMessage(created, currentUserId);
      setMessages((current) => ({
        ...current,
        [selectedChat.id]: confirmPendingMessage(current[selectedChat.id] ?? [], clientId, deliveredMessage),
      }));
      setChats((currentChats) => sortChats(currentChats.map((chat) => (
        chat.id === selectedChat.id ? updateChatSummary(chat, previewFromMessage(deliveredMessage), deliveredMessage.createdAt) : chat
      ))));
    } catch {
      setMessages((current) => ({
        ...current,
        [selectedChat.id]: updateMessageStatus(current[selectedChat.id] ?? [], clientId, "failed"),
      }));
    } finally {
      finishSendTask(clientId);
    }
  };

  const openGalleryPicker = () => {
    if (composerBusy) return;
    if (!requireComposerCapability("chat.message.send.image", 2, t("message.sendImage"))) return;
    galleryInputRef.current?.click();
  };

  const openFilePicker = () => {
    if (composerBusy) return;
    setComposerMoreOpen(false);
    setFileSourceSheetOpen(true);
  };

  const openLocationPicker = () => {
    if (composerBusy) return;
    if (!requireComposerCapability("chat.message.send.location", 3, t("message.sendLocation"))) return;
    setComposerMoreOpen(false);
    if (!navigator.geolocation) {
      setLocationDraft({ phase: "error", error: t("location.browserUnsupported") });
      return;
    }
    setLocationDraft({ phase: "locating" });
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setLocationDraft({
          phase: "ready",
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          accuracy: position.coords.accuracy,
          obscure: false,
        });
      },
      (error) => {
        const message = error.code === error.PERMISSION_DENIED
          ? t("location.permissionRequired")
          : t("location.unavailable");
        setLocationDraft({ phase: "error", error: message });
      },
      { enableHighAccuracy: true, maximumAge: 30_000, timeout: 12_000 },
    );
  };

  const sendLocationMessage = async () => {
    if (!selectedChat || locationDraft?.phase !== "ready" || locationDraft.latitude === undefined || locationDraft.longitude === undefined) return;
    const latitude = locationDraft.latitude;
    const longitude = locationDraft.longitude;
    const accuracy = locationDraft.accuracy ?? 100;
    const obscure = Boolean(locationDraft.obscure);
    const reply = consumeReplyTarget();
    const createdAt = Math.floor(Date.now() / 1000);
    const clientId = `temp:${Date.now()}:${Math.random().toString(36).slice(2, 8)}`;
    const pendingMessage: ChatMessage = {
      id: clientId,
      clientId,
      userId: currentUserId,
      from: "self",
      type: MESSAGE_TYPE_LOCATION,
      kind: "location",
      name: currentUserName,
      ...pendingMessageAppearance,
      time: formatTime(createdAt),
      createdAt,
      text: t("message.locationPlaceholder"),
      payload: {
        kind: "location",
        latitude,
        longitude,
        obscured: obscure,
        obscure_radius_km: obscure ? 50 : undefined,
      },
      replyTo: reply,
      status: "pending",
    };

    setLocationDraft((current) => current ? { ...current, phase: "sending" } : current);
    setMessages((current) => ({
      ...current,
      [selectedChat.id]: sortMessages([...(current[selectedChat.id] ?? []), pendingMessage]),
    }));
    setChats((current) => sortChats(current.map((chat) => (
      chat.id === selectedChat.id ? updateChatSummary(chat, t("message.locationPlaceholder"), createdAt) : chat
    ))));
    stickToBottomRef.current = true;
    triggerMessageEntrance(clientId);
    updateSendTask(clientId, 0.15);

    try {
      const created = await api.sendMessage(
        selectedChat.id,
        MESSAGE_TYPE_LOCATION,
        JSON.stringify({ latitude, longitude, obscure }),
        reply?.message_id,
        clientId,
      );
      const deliveredMessage = mapChatMessage(created, currentUserId);
      updateSendTask(clientId, 0.9);
      setMessages((current) => ({
        ...current,
        [selectedChat.id]: confirmPendingMessage(current[selectedChat.id] ?? [], clientId, deliveredMessage),
      }));
      setChats((current) => sortChats(current.map((chat) => (
        chat.id === selectedChat.id ? updateChatSummary(chat, t("message.locationPlaceholder"), deliveredMessage.createdAt) : chat
      ))));
      setLocationDraft(null);
      if (!obscure) {
        try {
          const candidates = await resolveTravelMapCandidates({ latitude, longitude, accuracy }, getActiveLocale());
          const candidate = candidates[0];
          if (candidate) {
            await api.checkInTravelMap({
              latitude,
              longitude,
              accuracy_meters: accuracy,
              region_code: candidate.regionCode,
              region_name: candidate.regionName,
              country_code: candidate.countryCode,
              country_name: candidate.countryName,
            });
          }
        } catch (checkInError) {
          console.warn("[location] automatic footprint check-in failed", checkInError);
        }
      }
    } catch (error) {
      setMessages((current) => ({
        ...current,
        [selectedChat.id]: updateMessageStatus(current[selectedChat.id] ?? [], clientId, "failed"),
      }));
      setLocationDraft(null);
      setPageError(error instanceof ApiError ? error.message : t("location.sendFailed"));
    } finally {
      finishSendTask(clientId);
    }
  };

  const openChatTravelMap = async () => {
    if (!selectedChat || composerBusy || travelMapSaving) return;
    setComposerMoreOpen(false);
    setTravelMapSaving(true);
    try {
      const access = await api.getChatTravelMapAccess(selectedChat.id);
      setChatTravelMapAccess(access);
      if (access.authorized_by_me) setChatTravelMapMenuOpen(true);
      else setChatTravelMapGrantConfirmOpen(true);
    } catch (error) {
      showToast(error instanceof ApiError ? error.message : t("travelMap.accessFailed"), "error");
    } finally {
      setTravelMapSaving(false);
    }
  };

  const grantChatTravelMap = async () => {
    if (!selectedChat || travelMapSaving) return;
    setTravelMapSaving(true);
    try {
      const access = await api.grantChatTravelMapAccess(selectedChat.id);
      setChatTravelMapAccess(access);
      if (access.invitation_message) {
        const delivered = mapChatMessage(access.invitation_message, currentUserId);
        setMessages((current) => {
          const existing = current[selectedChat.id] ?? [];
          if (existing.some((message) => message.id === delivered.id)) return current;
          return { ...current, [selectedChat.id]: sortMessages([...existing, delivered]) };
        });
        setChats((current) => sortChats(current.map((chat) => (
          chat.id === selectedChat.id
            ? updateChatSummary(chat, t("travelMap.action"), delivered.createdAt)
            : chat
        ))));
        stickToBottomRef.current = true;
        triggerMessageEntrance(String(delivered.id));
      }
      setChatTravelMapGrantConfirmOpen(false);
      setChatTravelMapOpen(true);
      showToast(t("travelMap.chatAccessGranted"));
    } catch (error) {
      showToast(error instanceof ApiError ? error.message : t("travelMap.accessFailed"), "error");
    } finally {
      setTravelMapSaving(false);
    }
  };

  const revokeChatTravelMap = async () => {
    if (!selectedChat || travelMapSaving) return;
    setTravelMapSaving(true);
    try {
      const access = await api.revokeChatTravelMapAccess(selectedChat.id);
      setChatTravelMapAccess(access);
      setChatTravelMapMenuOpen(false);
      showToast(t("travelMap.accessRemoved"));
    } catch (error) {
      showToast(error instanceof ApiError ? error.message : t("travelMap.accessFailed"), "error");
    } finally {
      setTravelMapSaving(false);
    }
  };

  const patchTravelMapAccess = (messageId: number | string, access: TravelMapAccessDTO) => {
    if (!selectedChat) return;
    setMessages((current) => ({
      ...current,
      [selectedChat.id]: (current[selectedChat.id] ?? []).map((message) => (
        message.id === messageId && message.payload
          ? { ...message, payload: { ...message.payload, access } }
          : message
      )),
    }));
  };

  useEffect(() => {
    const openLocationMessage = (event: Event) => {
      setLocationMessagePreview((event as CustomEvent<{
        location: { latitude: number; longitude: number; address?: string };
        owner: TinyUserDTO;
      }>).detail);
    };
    window.addEventListener("sermo:location-message", openLocationMessage);
    return () => window.removeEventListener("sermo:location-message", openLocationMessage);
  }, []);

  useEffect(() => {
    const openForwardBundle = (event: Event) => {
      setForwardBundlePreview((event as CustomEvent<ChatMessagePayloadDTO>).detail);
    };
    window.addEventListener("sermo:forward-bundle", openForwardBundle);
    return () => window.removeEventListener("sermo:forward-bundle", openForwardBundle);
  }, []);

  useEffect(() => {
    const handleMapMessage = (event: Event) => {
      const detail = (event as CustomEvent<{
        messageId: number | string;
        owner?: TinyUserDTO;
        access?: TravelMapAccessDTO;
        chatGrant?: boolean;
        chatAccess?: ChatTravelMapAccessDTO;
        from: "self" | "other";
      }>).detail;
      if (detail.chatGrant) {
        const openFromStatus = (status: ChatTravelMapAccessDTO) => {
          setChatTravelMapAccess(status);
          if (status.authorized_by_me) setChatTravelMapOpen(true);
          else setChatTravelMapGrantConfirmOpen(true);
        };
        if (detail.chatAccess) {
          openFromStatus(detail.chatAccess);
        } else if (selectedChat) {
          setTravelMapSaving(true);
          void api.getChatTravelMapAccess(selectedChat.id)
            .then(openFromStatus)
            .catch((error) => showToast(error instanceof ApiError ? error.message : t("travelMap.accessFailed"), "error"))
            .finally(() => setTravelMapSaving(false));
        }
        return;
      }
      const peer = detail.from === "self" ? selectedDirectPeer : (detail.owner ?? selectedDirectPeer);
      if (!peer || travelMapSaving) return;
      const access = detail.access ?? { can_view_theirs: false, they_can_view_mine: false };
      if (detail.from === "other" && !access.they_can_view_mine) {
        setTravelMapSaving(true);
        void api.reciprocateTravelMapAccess(peer.user_id)
          .then((updated) => {
            patchTravelMapAccess(detail.messageId, updated);
            showToast(t("travelMap.accessAccepted"));
          })
          .catch((error) => showToast(error instanceof ApiError ? error.message : t("travelMap.accessFailed"), "error"))
          .finally(() => setTravelMapSaving(false));
        return;
      }
      setTravelMapMenu({ user: peer, access });
    };
    window.addEventListener("sermo:travel-map-message", handleMapMessage);
    return () => window.removeEventListener("sermo:travel-map-message", handleMapMessage);
  }, [selectedChat?.id, selectedDirectPeer?.user_id, travelMapSaving]);

  const openSharedTravelMap = () => {
    if (!travelMapMenu?.access.can_view_theirs) return;
    setTravelMapOtherUser(travelMapMenu.user);
    setTravelMapMenu(null);
    setTravelMapOpen(true);
  };

  const revokeTravelMapAccess = async () => {
    if (!travelMapMenu) return;
    setTravelMapSaving(true);
    try {
      await api.revokeTravelMapAccess(travelMapMenu.user.user_id);
      if (selectedChat) {
        setMessages((current) => ({
          ...current,
          [selectedChat.id]: (current[selectedChat.id] ?? []).map((message) => (
            message.kind === "map_access" && message.payload?.access
              ? { ...message, payload: { ...message.payload, access: { ...message.payload.access, they_can_view_mine: false } } }
              : message
          )),
        }));
      }
      setTravelMapMenu((current) => current ? {
        ...current,
        access: { ...current.access, they_can_view_mine: false },
      } : current);
      setTravelMapRevokeConfirmOpen(false);
      showToast(t("travelMap.accessRemoved"));
    } catch (error) {
      showToast(error instanceof ApiError ? error.message : t("travelMap.accessFailed"), "error");
    } finally {
      setTravelMapSaving(false);
    }
  };

  const handleMediaSelection = async (event: ChangeEvent<HTMLInputElement>, source: "gallery" | "file") => {
    const files = Array.from(event.target.files ?? []);
    event.target.value = "";
    if (!files.length) return;
    setComposerMoreOpen(false);

    await Promise.all(
      files.map(async (file) => {
        try {
          const kind = source === "file" ? "file" : resolveMediaKind(file);
          if (kind === "image" && !requireComposerCapability("chat.message.send.image", 2, t("message.sendImage"))) return;
          if (kind === "video" && !requireComposerCapability("chat.message.send.video", 5, t("message.sendVideo"))) return;
          await sendUploadedMediaMessage(kind, file, source === "file" ? { file_name: file.name, file_size: file.size } : {});
        } catch (error) {
          const uploadError = toMessageUploadError(error);
          setPageError(uploadError.message);
        }
      })
    );
  };

  const closeClipboardUpload = () => {
    clipboardPreviewUrlsRef.current.forEach((uri) => URL.revokeObjectURL(uri));
    clipboardPreviewUrlsRef.current.clear();
    setClipboardUpload(null);
  };

  const openUploadCandidate = (files: File[], source: ClipboardUploadCandidate["source"]) => {
    closeClipboardUpload();
    const previewUris = files.map((file) => {
      if (!file.type.startsWith("image/")) return null;
      const uri = URL.createObjectURL(file);
      clipboardPreviewUrlsRef.current.add(uri);
      return uri;
    });
    setComposerMoreOpen(false);
    setClipboardUpload({ files, previewUris, source });
  };

  const handleComposerPaste = (event: ReactClipboardEvent<HTMLDivElement>) => {
    const itemFiles = Array.from(event.clipboardData.items)
      .filter((item) => item.kind === "file")
      .map((item) => item.getAsFile())
      .filter((file): file is File => file !== null);
    const files = itemFiles.length ? itemFiles : Array.from(event.clipboardData.files);
    if (!files.length) return;

    event.preventDefault();
    openUploadCandidate(files, "clipboard");
  };

  const hasDraggedFiles = (event: ReactDragEvent<HTMLElement>) => Array.from(event.dataTransfer.types).includes("Files");

  const canAcceptDesktopFileDrop = () => (
    Boolean(displayedChat)
    && !composerBusy
    && typeof window !== "undefined"
    && window.matchMedia("(min-width: 900px)").matches
  );

  const handleFileDragEnter = (event: ReactDragEvent<HTMLElement>) => {
    if (!hasDraggedFiles(event) || !canAcceptDesktopFileDrop()) return;
    event.preventDefault();
    fileDropDepthRef.current += 1;
    setFileDropActive(true);
  };

  const handleFileDragOver = (event: ReactDragEvent<HTMLElement>) => {
    if (!hasDraggedFiles(event) || !canAcceptDesktopFileDrop()) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = "copy";
  };

  const handleFileDragLeave = (event: ReactDragEvent<HTMLElement>) => {
    if (!fileDropActive) return;
    event.preventDefault();
    fileDropDepthRef.current = Math.max(0, fileDropDepthRef.current - 1);
    if (fileDropDepthRef.current === 0) setFileDropActive(false);
  };

  const handleFileDrop = (event: ReactDragEvent<HTMLElement>) => {
    if (!hasDraggedFiles(event) || !canAcceptDesktopFileDrop()) return;
    event.preventDefault();
    const files = Array.from(event.dataTransfer.files);
    fileDropDepthRef.current = 0;
    setFileDropActive(false);
    if (files.length) openUploadCandidate(files, "drop");
  };

  useEffect(() => {
    if (!fileDropActive) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      fileDropDepthRef.current = 0;
      setFileDropActive(false);
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [fileDropActive]);

  const confirmClipboardUpload = async () => {
    if (!clipboardUpload) return;
    const files = clipboardUpload.files;
    closeClipboardUpload();
    await Promise.all(
      files.map(async (file) => {
        try {
          const kind = resolveMediaKind(file);
          if (kind === "image" && !requireComposerCapability("chat.message.send.image", 2, t("message.sendImage"))) return;
          if (kind === "video" && !requireComposerCapability("chat.message.send.video", 5, t("message.sendVideo"))) return;
          await sendUploadedMediaMessage(kind, file, kind === "file" ? { file_name: file.name, file_size: file.size } : {});
        } catch (error) {
          const uploadError = toMessageUploadError(error);
          setPageError(uploadError.message);
        }
      })
    );
  };

  const startVoiceRecording = async () => {
    if (composerBusy || voiceComposer.open) return;
    if (!requireComposerCapability("chat.message.send.audio", 3, t("message.sendAudio"))) return;
    if (typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") {
      setPageError(t("audio.unsupported"));
      return;
    }

    mentionEditorRef.current?.blur();
    setComposerMoreOpen(false);
    const attempt = recordingAttemptRef.current + 1;
    recordingAttemptRef.current = attempt;
    recordingCancelledRef.current = false;
    recordingStopRequestedRef.current = false;
    recordingChunksRef.current = [];
    setVoiceComposer({
      open: true,
      phase: "requesting",
      durationSeconds: 0,
      bars: Array.from({ length: 24 }, () => 0.2),
      blob: null,
      mimeType: "",
    });

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          channelCount: 1,
        },
      });
      if (attempt !== recordingAttemptRef.current) {
        stream.getTracks().forEach((track) => track.stop());
        return;
      }
      const mimeTypeCandidates = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4", "audio/ogg;codecs=opus"];
      const mimeType = mimeTypeCandidates.find((item) => MediaRecorder.isTypeSupported(item)) ?? "";
      const mediaRecorder = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream);
      mediaStreamRef.current = stream;
      mediaRecorderRef.current = mediaRecorder;

      const AudioContextCtor = window.AudioContext || (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (AudioContextCtor) {
        const audioContext = new AudioContextCtor();
        await audioContext.resume().catch(() => undefined);
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
        const durationSeconds = Math.min(
          AUDIO_MAX_DURATION_SECONDS,
          Math.max(0, (Date.now() - recordingStartedAtRef.current) / 1000),
        );
        cleanupRecordingResources();
        if (recordingCancelledRef.current) {
          resetVoiceComposer();
          return;
        }
        if (blob.size === 0 || durationSeconds < 0.4) {
          resetVoiceComposer();
          showToast(t("audio.tooShort"), "error");
          return;
        }
        const previewUri = URL.createObjectURL(blob);
        setVoicePreviewUri((current) => {
          if (current) URL.revokeObjectURL(current);
          return previewUri;
        });
        setVoiceComposer((current) => ({
          ...current,
          open: true,
          phase: "recorded",
          durationSeconds,
          blob,
          mimeType: nextMimeType,
          bars: current.bars,
        }));
      };

      mediaRecorder.start();
      recordingStartedAtRef.current = Date.now();
      setVoiceComposer({
        open: true,
        phase: "recording",
        durationSeconds: 0,
        bars: Array.from({ length: 24 }, () => 0.28),
        blob: null,
        mimeType: mediaRecorder.mimeType || mimeType || "audio/webm",
      });

      recordingTimerRef.current = window.setInterval(() => {
        const durationSeconds = Math.min(AUDIO_MAX_DURATION_SECONDS, (Date.now() - recordingStartedAtRef.current) / 1000);
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
      if (attempt !== recordingAttemptRef.current) return;
      resetVoiceComposer();
      const errorName = error instanceof DOMException ? error.name : "";
      const message = errorName === "NotAllowedError"
        ? t("audio.permissionRequired")
        : errorName === "NotFoundError"
          ? t("audio.noMicrophone")
          : errorName === "NotReadableError"
            ? t("audio.inUse")
            : t("audio.startUnavailable");
      setPageError(message);
    }
  };

  const stopVoiceRecording = () => {
    if (mediaRecorderRef.current?.state !== "recording") return;
    setVoiceComposer((current) => ({ ...current, phase: "stopping" }));
    recordingStopRequestedRef.current = true;
    mediaRecorderRef.current.stop();
  };

  const cancelVoiceRecording = () => {
    recordingAttemptRef.current += 1;
    recordingCancelledRef.current = true;
    if (mediaRecorderRef.current?.state === "recording") {
      mediaRecorderRef.current.stop();
      return;
    }
    resetVoiceComposer();
  };

  const toggleVoicePreview = async () => {
    const audio = voicePreviewAudioRef.current;
    if (!audio || voiceComposer.phase !== "recorded") return;
    if (!audio.paused) {
      audio.pause();
      return;
    }
    if (activeThreadAudio && activeThreadAudio !== audio) {
      activeThreadAudio.pause();
      activeThreadAudio.currentTime = 0;
    }
    activeThreadAudio = audio;
    try {
      await audio.play();
    } catch {
      setVoicePreviewPlaying(false);
      setPageError(t("audio.previewFailed"));
    }
  };

  const sendRecordedVoiceMessage = async () => {
    if (!voiceComposer.blob || !selectedChat) return;

    voicePreviewAudioRef.current?.pause();
    setVoicePreviewPlaying(false);
    const extension = voiceComposer.mimeType.includes("mp4") ? "m4a" : voiceComposer.mimeType.includes("ogg") ? "ogg" : "webm";
    const file = new File([voiceComposer.blob], `voice-message.${extension}`, {
      type: voiceComposer.mimeType || "audio/webm",
    });

    setVoiceComposer((current) => ({ ...current, phase: "sending" }));
    const sent = await sendUploadedMediaMessage("audio", file, {
      duration_seconds: voiceComposer.durationSeconds,
    });
    resetVoiceComposer();
    if (!sent) showToast(t("audio.sendRetry"), "error");
  };

  const refreshChats = async () => {
    const rows = await api.getChats();
    setChats(sortChats(rows.map((item) => mapChat(item, currentUserId))));
  };

  const copyMessageText = async () => {
    if (!messageMenu || messageMenu.message.kind !== "text") return;
    try {
      const copied = await copyText(messageMenu.message.text);
      if (!copied) throw new Error(t("common.copyFailed"));
      setMessageMenu(null);
    } catch (apiError) {
      const message = apiError instanceof Error ? apiError.message : t("common.copyFailed");
      setPageError(message);
    }
  };

  const downloadChatMessageAttachment = async (message: ChatMessage) => {
    if (!["image", "video", "audio", "file"].includes(message.kind)) return false;
    const rawUri = message.payload?.uri;
    if (!rawUri) return false;
    const uri = resolveStableResourceUri(rawUri) ?? rawUri;
    const safeId = String(message.id).replace(/[^a-zA-Z0-9_-]/g, "") || String(Date.now());
    const suppliedName = message.payload?.file_name?.trim();
    const fallbackName = message.kind === "audio"
      ? `sermo-audio-${safeId}`
      : message.kind === "video"
        ? `sermo-video-${safeId}`
        : message.kind === "file"
          ? `sermo-file-${safeId}`
          : `sermo-image-${safeId}`;

    try {
      const response = await fetch(uri);
      if (!response.ok) throw new Error("download_failed");
      const blob = await response.blob();
      const extension = blob.type.split("/")[1]?.replace("jpeg", "jpg").replace("mpeg", "mp3").replace(/[^a-zA-Z0-9]/g, "") || (message.kind === "audio" ? "webm" : "bin");
      const objectUrl = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = objectUrl;
      anchor.download = suppliedName || `${fallbackName}.${extension}`;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      window.setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
      return true;
    } catch {
      const anchor = document.createElement("a");
      anchor.href = uri;
      anchor.download = suppliedName || fallbackName;
      anchor.rel = "noreferrer";
      anchor.target = "_blank";
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      return true;
    }
  };

  const downloadMessageAttachment = async () => {
    if (!messageMenu || !["image", "video", "audio", "file"].includes(messageMenu.message.kind)) return;
    if (messageMenu.message.kind === "audio" && !requireComposerCapability("chat.message.download.audio", 8, t("audio.download"))) return;
    await downloadChatMessageAttachment(messageMenu.message);
    setMessageMenu(null);
  };

  const selectedActionMessages = (clientIds = selectedMessageClientIds) => {
    const selectedIds = new Set(clientIds);
    return selectedMessages.filter((message) => selectedIds.has(message.clientId));
  };

  const eligibleSelectionMessages = (action: MessageSelectionAction) => selectedActionMessages().filter((message) => {
    if (action === "copy") return message.kind === "text" && Boolean(message.text.trim());
    if (action === "save") {
      if (!["image", "video", "audio", "file"].includes(message.kind) || !message.payload?.uri) return false;
      return message.kind !== "audio" || canDownloadAudio;
    }
    return canRecallMessage(message);
  });

  const canForwardMessage = (message: ChatMessage) => (
    typeof message.id === "number" && !["system", "map_access", "forward_bundle"].includes(message.kind)
  );

  const eligibleForwardMessages = () => selectedActionMessages().filter(canForwardMessage);

  const selectionActionAvailability = {
    forward: eligibleForwardMessages().length > 0,
    copy: eligibleSelectionMessages("copy").length > 0,
    save: eligibleSelectionMessages("save").length > 0,
    delete: selectedMessageClientIds.length > 0,
    recall: eligibleSelectionMessages("recall").length > 0,
  };

  const finishMessageSelection = () => {
    setMessageSelectionMode(false);
    setSelectedMessageClientIds([]);
    setMessageSelectionActionPrompt(null);
  };

  const executeSelectionAction = async (action: MessageSelectionAction, clientIds: string[]) => {
    const targets = selectedActionMessages(clientIds);
    if (!targets.length) {
      setMessageSelectionActionPrompt(null);
      return;
    }
    setMessageSelectionAction(action);
    setMessageSelectionActionPrompt(null);
    try {
      if (action === "copy") {
        const copyValue = targets.length === 1
          ? targets[0].text.trim()
          : targets.map((message) => `${message.name}: ${message.text.trim()}`).join("\n");
        if (!await copyText(copyValue)) throw new Error(t("common.copyFailed"));
        showToast(t("message.batchCopied", { count: targets.length }));
        finishMessageSelection();
        return;
      }

      if (action === "save") {
        for (const message of targets) {
          await downloadChatMessageAttachment(message);
          // Give mobile browsers a frame to register each user-initiated download.
          await new Promise((resolve) => window.setTimeout(resolve, 80));
        }
        showToast(t("message.batchSaved", { count: targets.length }));
        finishMessageSelection();
        return;
      }

      const recalledIds = targets
        .map((message) => message.id)
        .filter((messageId): messageId is number => typeof messageId === "number");
      for (const messageId of recalledIds) await api.deleteMessage(messageId, "everyone");
      targets.forEach((message) => purgeCachedMedia([message.payload?.uri, message.payload?.thumbnail_uri]));
      const recalledClientIds = new Set(targets.map((message) => message.clientId));
      const nextThreadMessages = selectedMessages.filter((message) => !recalledClientIds.has(message.clientId));
      setPinnedMessages((current) => current.filter((pin) => !recalledIds.includes(pin.message.message_id)));
      setMessages((current) => ({ ...current, [selectedChat!.id]: nextThreadMessages }));
      if (cacheScope && selectedChat) {
        const nextSnapshot = {
          messages: nextThreadMessages,
          hasOlderMessages,
          scrollTop: messageScrollRef.current?.scrollTop ?? 0,
          updatedAt: Date.now(),
        };
        chatCache.setThread(cacheScope, selectedChat.id, nextSnapshot);
        void chatCache.persistThread(cacheScope, selectedChat.id, nextSnapshot);
      }
      await refreshChats();
      showToast(t("message.batchRecalled", { count: targets.length }));
      finishMessageSelection();
    } catch (apiError) {
      showToast(apiError instanceof ApiError ? apiError.message : apiError instanceof Error ? apiError.message : t("common.operationFailed"), "error");
    } finally {
      setMessageSelectionAction(null);
    }
  };

  const requestSelectionAction = (action: MessageSelectionAction) => {
    if (!selectedMessageClientIds.length || messageSelectionAction) return;
    const eligible = eligibleSelectionMessages(action);
    if (!eligible.length) return;
    if (action === "recall" || eligible.length !== selectedMessageClientIds.length) {
      setMessageSelectionActionPrompt({
        action,
        eligibleClientIds: eligible.map((message) => message.clientId),
        total: selectedMessageClientIds.length,
      });
      return;
    }
    void executeSelectionAction(action, eligible.map((message) => message.clientId));
  };

  const openForwardPicker = () => {
    const eligibleIds = eligibleForwardMessages().map((message) => message.id as number);
    if (!eligibleIds.length) {
      showToast(t("message.forwardUnavailable"), "error");
      return;
    }
    if (eligibleIds.length !== selectedMessageClientIds.length) {
      showToast(t("message.forwardPartial", { eligible: eligibleIds.length, total: selectedMessageClientIds.length }));
    }
    setForwardSourceMessageIds(eligibleIds);
    setForwardTargetChatIds([]);
    setForwardMode(eligibleIds.length > 1 ? "bundle" : "individual");
    setForwardPickerOpen(true);
  };

  const openSingleMessageForwardPicker = (message: ChatMessage) => {
    if (!canForwardMessage(message)) return;
    setMessageMenu(null);
    setForwardSourceMessageIds([message.id as number]);
    setForwardTargetChatIds([]);
    setForwardMode("individual");
    setForwardPickerOpen(true);
  };

  const submitForwardMessages = async () => {
    if (!forwardSourceMessageIds.length || !forwardTargetChatIds.length || forwardSending) return;
    try {
      setForwardSending(true);
      const result = await api.forwardMessages(forwardSourceMessageIds, forwardTargetChatIds, forwardMode);
      if (selectedChat && forwardTargetChatIds.includes(selectedChat.id)) {
        const additions = result.messages
          .filter((entry) => entry.chat_id === selectedChat.id)
          .map((entry) => mapChatMessage(entry.message, currentUserId));
        setMessages((current) => ({
          ...current,
          [selectedChat.id]: sortMessages([...(current[selectedChat.id] ?? []), ...additions]),
        }));
      }
      setForwardPickerOpen(false);
      finishMessageSelection();
      await refreshChats();
      showToast(t("message.forwarded", { chats: forwardTargetChatIds.length }));
    } catch (error) {
      showToast(error instanceof ApiError ? error.message : t("message.forwardFailed"), "error");
    } finally {
      setForwardSending(false);
    }
  };

  const deleteMessage = async (scope: "me" | "everyone") => {
    if (!selectedChat || !messageMenu) return;

    if (typeof messageMenu.message.id !== "number") {
      const removedMessage = messageMenu.message;
      if (removedMessage.status === "pending") cancelledSendIdsRef.current.add(removedMessage.clientId);
      setMessages((current) => ({
        ...current,
        [selectedChat.id]: (current[selectedChat.id] ?? []).filter((message) => message.clientId !== removedMessage.clientId),
      }));
      setSendTasks((current) => {
        const next = { ...current };
        delete next[removedMessage.clientId];
        return next;
      });
      if (removedMessage.localPreviewUri) {
        URL.revokeObjectURL(removedMessage.localPreviewUri);
        localObjectUrlsRef.current.delete(removedMessage.localPreviewUri);
      }
      setMessageMenu(null);
      return;
    }

    try {
      setMessageDeleteState("deleting");
      const deletedMessage = messageMenu.message;
      await api.deleteMessage(deletedMessage.id as number, scope);
      purgeCachedMedia([
        deletedMessage.payload?.uri,
        deletedMessage.payload?.thumbnail_uri,
      ]);
      if (deletedMessage.localPreviewUri) {
        URL.revokeObjectURL(deletedMessage.localPreviewUri);
        localObjectUrlsRef.current.delete(deletedMessage.localPreviewUri);
      }
      const nextThreadMessages = (selectedMessages ?? []).filter((message) => message.clientId !== deletedMessage.clientId);
      if (typeof deletedMessage.id === "number") {
        setPinnedMessages((current) => current.filter((pin) => pin.message.message_id !== deletedMessage.id));
      }
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
      showToast(t("message.deleted"));
    } catch (apiError) {
      showToast(apiError instanceof ApiError ? apiError.message : t("message.deleteFailed"), "error");
    } finally {
      setMessageDeleteState("idle");
    }
  };

  const deleteSelectedMessages = async () => {
    if (!selectedChat || !selectedMessageClientIds.length) return;
    const selectedIdSet = new Set(selectedMessageClientIds);
    const targets = selectedMessages.filter((message) => selectedIdSet.has(message.clientId));
    if (!targets.length) {
      cancelMessageSelection();
      return;
    }
    const remoteIds = targets
      .map((message) => message.id)
      .filter((messageId): messageId is number => typeof messageId === "number");

    try {
      setMessageDeleteState("deleting");
      if (remoteIds.length) await api.deleteMessages(remoteIds);

      targets.forEach((message) => {
        if (message.status === "pending") cancelledSendIdsRef.current.add(message.clientId);
        purgeCachedMedia([message.payload?.uri, message.payload?.thumbnail_uri]);
        if (message.localPreviewUri) {
          URL.revokeObjectURL(message.localPreviewUri);
          localObjectUrlsRef.current.delete(message.localPreviewUri);
        }
      });
      setSendTasks((current) => {
        const next = { ...current };
        targets.forEach((message) => delete next[message.clientId]);
        return next;
      });
      const nextThreadMessages = selectedMessages.filter((message) => !selectedIdSet.has(message.clientId));
      setPinnedMessages((current) => current.filter((pin) => !remoteIds.includes(pin.message.message_id)));
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
      setBatchDeleteConfirmOpen(false);
      setMessageSelectionMode(false);
      setSelectedMessageClientIds([]);
      await refreshChats();
      showToast(t("message.batchDeleted", { count: targets.length }));
    } catch (apiError) {
      showToast(apiError instanceof ApiError ? apiError.message : t("message.batchDeleteFailed"), "error");
    } finally {
      setMessageDeleteState("idle");
    }
  };

  const clearChatHistory = async () => {
    if (!selectedChat || clearHistorySaving) return;
    const chatId = selectedChat.id;
    const clearingMessages = selectedMessages;
    try {
      setClearHistorySaving(true);
      await api.clearChatMessages(chatId);
      clearingMessages.forEach((message) => {
        purgeCachedMedia([message.payload?.uri, message.payload?.thumbnail_uri]);
        if (message.localPreviewUri) {
          URL.revokeObjectURL(message.localPreviewUri);
          localObjectUrlsRef.current.delete(message.localPreviewUri);
        }
      });
      setMessages((current) => ({ ...current, [chatId]: [] }));
      setPinnedMessages([]);
      setHasOlderMessages(false);
      setReplyTarget(null);
      setClearHistoryConfirmOpen(false);
      setDetailsSheetOpen(false);
      if (cacheScope) await chatCache.clearThread(cacheScope, chatId);
      await refreshChats();
      showToast(t("chat.clearHistoryDone"));
    } catch (error) {
      showToast(error instanceof ApiError ? error.message : t("chat.clearHistoryFailed"), "error");
    } finally {
      setClearHistorySaving(false);
    }
  };

  const restoreChatHistory = async () => {
    if (!selectedChat || restoreHistorySaving) return;
    if (!restoreHistoryPassword) {
      showToast(t("chat.restoreHistoryPasswordRequired"), "error");
      return;
    }
    const chatId = selectedChat.id;
    try {
      setRestoreHistorySaving(true);
      const result = await api.restoreChatHistory(chatId, restoreHistoryPassword);
      setHistoryRecoveryStatus(result);
      setMessages((current) => ({ ...current, [chatId]: [] }));
      setPinnedMessages([]);
      setHasOlderMessages(false);
      setReplyTarget(null);
      if (cacheScope) await chatCache.clearThread(cacheScope, chatId);
      setRestoreHistoryConfirmOpen(false);
      setRestoreHistoryPassword("");
      setDetailsSheetOpen(false);
      setHistoryReloadVersion((current) => current + 1);
      await refreshChats();
      showToast(t("chat.restoreHistoryDone", { count: result.restored_count ?? 0 }));
    } catch (error) {
      showToast(error instanceof ApiError ? error.message : t("chat.restoreHistoryFailed"), "error");
    } finally {
      setRestoreHistorySaving(false);
    }
  };

  const toggleGroupCandidate = (userId: number) => {
    if (chatMemberLockedIds.includes(userId)) return;
    setGroupSelectedIds((current) => (current.includes(userId) ? current.filter((item) => item !== userId) : [...current, userId]));
  };

  const createGroup = async () => {
    if (!requireComposerCapability("chat.group.create", 4, t("chat.createGroup"))) return;
    if (!currentUserVerified) {
      setPageError(t("chat.verifyToCreateGroup"));
      return;
    }
    if (!groupSelectedIds.length) {
      setPageError(t("chat.selectOneMember"));
      return;
    }

    try {
      setGroupCreateState("creating");
      const created = await api.createGroupChat(groupSelectedIds, groupTitle.trim() || undefined);
      const nextChat = mapChat(created, currentUserId);
      setChats((currentChats) => sortChats([nextChat, ...currentChats.filter((chat) => chat.id !== nextChat.id)]));
      setGroupCreateOpen(false);
      setGroupTitle("");
      setGroupQuery("");
      setGroupSelectedIds([]);
      showToast(t("chat.groupCreated"));
      navigate(`/app/chats/${created.chat_id}`);
    } catch (apiError) {
      showToast(apiError instanceof ApiError ? apiError.message : t("chat.groupCreateFailed"), "error");
    } finally {
      setGroupCreateState("idle");
    }
  };

  const applyUpdatedGroupChat = (chatRow: ChatDTO) => {
    const nextChat = mapChat(chatRow, currentUserId);
    setChats((currentChats) => sortChats(currentChats.map((chat) => (chat.id === nextChat.id ? nextChat : chat))));
  };

  const renameGroup = async () => {
    if (!requireComposerCapability("chat.group.rename", 5, t("chat.renameGroup"))) return;
    if (!selectedChat) return;
    try {
      setGroupManageState("saving");
      const updated = await api.renameGroupChat(selectedChat.id, groupRenameValue.trim());
      applyUpdatedGroupChat(updated);
      setGroupRenameOpen(false);
      showToast(t("chat.groupNameUpdated"));
    } catch (apiError) {
      showToast(apiError instanceof ApiError ? apiError.message : t("chat.groupRenameFailed"), "error");
    } finally {
      setGroupManageState("idle");
    }
  };

  const submitChatMemberPicker = async () => {
    if (!selectedChat) return;
    if (!chatMemberActionIds.length) return;
    if (chatMemberPickerMode !== "remove" && !requireComposerCapability(selectedChat.type === "group" ? "chat.group.invite" : "chat.group.create", 4, selectedChat.type === "group" ? t("chat.inviteGroupMembers") : t("chat.createGroup"))) return;

    try {
      setGroupManageState("saving");
      if (selectedChat.type === "group" && chatMemberPickerMode === "remove") {
        const updated = await api.removeGroupMembers(selectedChat.id, chatMemberActionIds);
        applyUpdatedGroupChat(updated);
        showToast(chatMemberActionIds.length > 1 ? t("chat.membersRemoved") : t("chat.memberRemoved"));
      } else if (selectedChat.type === "group") {
        const updated = await api.addGroupMembers(selectedChat.id, chatMemberNewIds);
        applyUpdatedGroupChat(updated);
        showToast(t("chat.memberAdded"));
      } else {
        const created = await api.createGroupChat(groupSelectedIds);
        const nextChat = mapChat(created, currentUserId);
        setChats((currentChats) => sortChats([nextChat, ...currentChats.filter((chat) => chat.id !== nextChat.id)]));
        showToast(t("chat.groupCreated"));
        navigate(`/app/chats/${created.chat_id}`);
      }
      setChatMemberPickerOpen(false);
      setGroupQuery("");
      setGroupSelectedIds([]);
      setChatMemberLockedIds([]);
      setChatMemberPickerMode("add");
    } catch (apiError) {
      showToast(
        apiError instanceof ApiError ? apiError.message : chatMemberPickerMode === "remove" ? t("chat.removeMemberFailed") : t("chat.addMemberFailed"),
        "error"
      );
    } finally {
      setGroupManageState("idle");
    }
  };

  const removeGroupMember = async (userId: number) => {
    if (!selectedChat) return;
    try {
      setGroupManageState("saving");
      const updated = await api.removeGroupMembers(selectedChat.id, [userId]);
      applyUpdatedGroupChat(updated);
      showToast(t("chat.memberRemoved"));
    } catch (apiError) {
      showToast(apiError instanceof ApiError ? apiError.message : t("chat.removeMemberFailed"), "error");
    } finally {
      setGroupManageState("idle");
    }
  };

  const leaveOrDeleteGroup = async () => {
    if (!selectedChat || selectedChat.type !== "group") return;
    try {
      setGroupManageState("saving");
      if (selectedChat.isOwner) {
        await api.deleteGroupChat(selectedChat.id);
      } else {
        await api.leaveGroupChat(selectedChat.id);
      }
      setChats((currentChats) => currentChats.filter((chat) => chat.id !== selectedChat.id));
      setDetailsSheetOpen(false);
      setGroupDangerConfirmOpen(false);
      showToast(selectedChat.isOwner ? t("chat.groupDisbanded") : t("chat.groupLeft"));
      navigate("/app/chats");
    } catch (apiError) {
      showToast(apiError instanceof ApiError ? apiError.message : selectedChat.isOwner ? t("chat.disbandFailed") : t("chat.leaveFailed"), "error");
    } finally {
      setGroupManageState("idle");
    }
  };

  const loadOlderMessages = async () => {
    if (!selectedChat || !selectedMessages.length || olderState === "loading" || !cacheScope) return;

    const oldestMessage = selectedMessages[0];
    const scroller = messageScrollRef.current;

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

    } catch (apiError) {
      if (isChatAccessBoundaryError(apiError)) {
        redirectToChatListWithNotice(chatAccessBoundaryMessage(apiError), selectedChat.id);
        return;
      }
      const message = apiError instanceof ApiError ? apiError.message : t("message.historyLoadFailed");
      setPageError(message);
    } finally {
      setOlderState("idle");
    }
  };

  const renderChatItem = (chat: Chat, active: boolean) => (
    <button
      key={chat.id}
      className={`chat-item${chat.pinned ? " is-pinned" : ""}${active ? " active" : ""}`}
      onClick={() => navigate(`/app/chats/${chat.id}`)}
      type="button"
    >
      <div className="avatar-wrap">
        <UserAvatar
          className={`avatar ${chat.online ? "status-online" : ""}`}
          groupMembers={
            chat.type === "group" ? chat.detail.members.map((member) => ({ name: member.name, uri: member.avatarUri, cacheKey: member.avatarCacheKey })) : undefined
          }
          name={chat.title}
          uri={chat.avatarUri}
          cacheKey={chat.avatarCacheKey}
          frame={chat.avatarFrameStyle}
        />
        {chat.unread ? (
          <span className={`small-badge chat-list-unread${chat.unreadBadgeMuted ? " is-muted" : ""}`}>{chat.unreadBadgeMuted ? "" : chat.unread > 99 ? "99+" : chat.unread}</span>
        ) : null}
      </div>
      <div className="chat-copy">
        <p className="chat-name">{chat.title}</p>
        <div className="chat-preview">{chat.hasUnreadMention ? <span className="chat-mention-label">{t("chat.mentioned")}</span> : null}<span>{chat.preview}</span></div>
      </div>
      <div className="chat-meta">
        <div className="chat-time">{chat.time}</div>
        {chat.pinned ? <span className="chat-pin-label">{t("chat.pinned")}</span> : null}
      </div>
    </button>
  );

  const renderChatList = () => (
    <>
      <TabPageHeader
        title={t("chat.title")}
        syncing={viewState === "loading"}
        actions={<button aria-label={t("friendSearch.title")} className="tab-header-action" onClick={() => setAddFriendOpen(true)} type="button"><span className="material-symbols-outlined">person_add</span></button>}
        status={
          <span
            aria-label={chatHealth === "healthy" ? t("chat.connectionHealthy") : chatHealth === "warning" ? t("chat.connectionWarning") : t("chat.connectionOffline")}
            className={`chat-health-indicator is-${chatHealth}`}
            title={chatHealth === "healthy" ? t("chat.connectionHealthy") : chatHealth === "warning" ? t("chat.connectionWarning") : t("chat.connectionOffline")}
          >
            <span className="chat-health-dot" />
          </span>
        }
      />
      <AddFriendDrawer onClose={() => setAddFriendOpen(false)} open={addFriendOpen} />
      <VerificationBanner hasPassword={Boolean(session?.user?.has_password)} verified={Boolean(session?.user?.verified)} />

      <div className="chat-list-screen-body">
        <div className="chat-list">
          {filteredChats.map((chat) => renderChatItem(chat, chat.id === selectedChat?.id))}
        </div>
        {!filteredChats.length && viewState === "ready" ? (
          <QuietState
            icon="chat_bubble"
            title={t("chat.empty")}
            description={groupSquareEnabled ? t("chat.emptyHint") : t("chat.emptyHintNoSquare")}
            action={
              groupSquareEnabled ? (
                <Link className="button" to="/app/square">
                  {t("chat.goSquare")}
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
        "--chat-background-image": paintedChatBackgroundUri
          ? `url("${paintedChatBackgroundUri.replace(/"/g, "%22")}")`
          : "none",
      } as CSSProperties)
    : undefined;
  const chatBackgroundTheme = currentUserMe?.chat_background_theme ?? "default";
  const otherChatsUnreadCount = displayedChat
    ? chats.reduce((total, chat) => (
        chat.id === displayedChat.id || chat.unreadBadgeMuted ? total : total + Math.max(0, chat.unread)
      ), 0)
    : 0;

  return (
    <AppChrome
      title={t("chat.title")}
      hideTopbar={!displayedChat}
      hideMobileNav={Boolean(displayedChat)}
      hidePageTitle={Boolean(displayedChat)}
      topbarClassName={displayedChat ? `conversation-topbar chat-background-${chatBackgroundTheme}${isClosingChatView ? " is-closing" : ""}` : undefined}
      topbarStyle={displayedChat ? chatLayoutStyle : undefined}
      topbarProgress={displayedChat ? sendProgress : null}
      topbarLeading={
        displayedChat ? (
          messageSelectionMode ? (
            <div className="message-selection-topbar">
              <button aria-label={t("common.cancel")} className="chat-back-button" onClick={cancelMessageSelection} type="button">
                <span className="material-symbols-outlined">close</span>
              </button>
              <strong>{t("message.selectedCount", { count: selectedMessageClientIds.length })}</strong>
            </div>
          ) : <div className="chat-conversation-topbar">
            <button
              aria-label={otherChatsUnreadCount ? t("chat.backWithUnread", { count: otherChatsUnreadCount }) : t("common.back")}
              className="chat-back-button"
              onClick={closeChatView}
              type="button"
            >
              <span className="material-symbols-outlined">arrow_back</span>
              {otherChatsUnreadCount ? (
                <span className="chat-back-unread" aria-hidden="true">{otherChatsUnreadCount > 99 ? "99+" : otherChatsUnreadCount}</span>
              ) : null}
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
                frame={displayedChat.avatarFrameStyle}
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
              <div className="chat-topbar-status">{displayedChat.type === "group" ? t("chat.memberCount", { count: displayedChat.members }) : displayedChat.subtitle}</div>
            </div>
          </div>
        ) : undefined
      }
      topbarAction={
        displayedChat && !messageSelectionMode ? (
          <div className="button-row message-actions">
            <button className="icon-button" onClick={() => setDetailsSheetOpen(true)} type="button">
              <span className="material-symbols-outlined">more_vert</span>
            </button>
          </div>
        ) : undefined
      }
    >
      <section ref={chatLayoutRef} className={`app-layout chat-mobile-layout chat-background-${chatBackgroundTheme} ${displayedChat ? "chat-detail-active" : "chat-list-active"}`} style={chatLayoutStyle}>
        <section className={`list-screen mobile-chat-list-screen ${displayedChat ? "is-background" : "is-active"}`}>{renderChatList()}</section>

        <section
          ref={chatMainPaneRef}
          className={`message-pane chat-main-pane ${displayedChat ? "is-open" : "desktop-pane is-closed"}`}
          onDragEnter={handleFileDragEnter}
          onDragLeave={handleFileDragLeave}
          onDragOver={handleFileDragOver}
          onDrop={handleFileDrop}
        >
          {displayedChat ? (
            <>
              <header className={`desktop-conversation-header chat-background-${chatBackgroundTheme}`}>
                {messageSelectionMode ? (
                  <div className="message-selection-topbar">
                    <button aria-label={t("common.cancel")} className="chat-back-button" onClick={cancelMessageSelection} type="button">
                      <span className="material-symbols-outlined">close</span>
                    </button>
                    <strong>{t("message.selectedCount", { count: selectedMessageClientIds.length })}</strong>
                  </div>
                ) : <div className="chat-conversation-topbar">
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
                      frame={displayedChat.avatarFrameStyle}
                    />
                  </div>
                  <div className="chat-topbar-meta">
                    <strong className="chat-topbar-name">
                      <span className="chat-topbar-title-text">{displayedChat.title}</span>
                      {displayedChat.type === "group" ? <span className="chat-topbar-title-count">({displayedChat.members})</span> : null}
                    </strong>
                    <div className="chat-topbar-status">{displayedChat.type === "group" ? t("chat.memberCount", { count: displayedChat.members }) : displayedChat.subtitle}</div>
                  </div>
                </div>}
                {!messageSelectionMode ? <button aria-label={t("chat.details")} className="icon-button" onClick={() => setDetailsSheetOpen(true)} type="button">
                  <span className="material-symbols-outlined">more_vert</span>
                </button> : null}
                {sendProgress !== null ? (
                  <div className="topbar-progress" aria-label={t("message.sendProgress", { progress: Math.round(sendProgress * 100) })} role="progressbar">
                    <span style={{ transform: `scaleX(${Math.max(0.02, Math.min(1, sendProgress))})` }} />
                  </div>
                ) : null}
              </header>
              {pinnedMessages.length ? (
                <div className={`chat-pinned-bar${isClosingChatView ? " is-closing" : ""}`}>
                  <button
                    className="chat-pinned-main"
                    onClick={() => revealPinnedMessage(pinnedMessages[0].message.message_id)}
                    type="button"
                  >
                    <span className="chat-pinned-marker">
                      <ComposerSvgIcon className="chat-pinned-icon" kind="pin" />
                    </span>
                    <span className="chat-pinned-copy">
                      <span className="chat-pinned-kicker">
                        <strong>{t("pin.label")}</strong>
                        <i />
                        <span>{pinnedByLabel(pinnedMessages[0])}</span>
                      </span>
                      <span className="chat-pinned-preview">{pinnedMessagePreview(pinnedMessages[0])}</span>
                    </span>
                  </button>
                  <button aria-label={t("pin.viewAll", { count: pinnedMessages.length })} className="chat-pinned-list-button" onClick={() => setPinnedDrawerOpen(true)} type="button">
                    <span className="chat-pinned-count">{pinnedMessages.length}</span>
                    <span className="material-symbols-outlined">chevron_right</span>
                  </button>
                </div>
              ) : null}
              <div
                className={`chat-detail-scene chat-background-${chatBackgroundTheme} ${isClosingChatView ? "is-closing" : ""}`}
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
                onPointerDown={() => {
                  if (emojiPickerOpen) setEmojiPickerOpen(false);
                }}
                onScroll={() => {
                  const element = messageScrollRef.current;
                  if (selectedChat && initialBottomAnchorRef.current === selectedChat.id) {
                    stickToBottomRef.current = true;
                    return;
                  }
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
                      {olderState === "loading" ? t("common.loading") : t("message.viewMore")}
                    </button>
                  </div>
                ) : null}
                <VirtualDynamicList
                  estimateSize={estimateMessageGroupHeight}
                  followEnd={() => stickToBottomRef.current}
                  itemKey={(group) => group.key}
                  items={messageGroups}
                  overscan={840}
                  ref={virtualMessageListRef}
                  rowGap={18}
                  scrollRef={messageScrollRef}
                  renderItem={(group) => (
                    <MessageGroupBlock
                      enteringMessageIds={enteringMessageIds}
                      group={group}
                      onOpenImage={(uris, index, metadata = [], messageIds = []) => {
                        setImagePreview({
                          uris,
                          index,
                          metadata: uris.map((_uri, itemIndex) => metadata[itemIndex] ?? null),
                          messageIds: uris.map((_uri, itemIndex) => messageIds[itemIndex] ?? null),
                        });
                      }}
                      onOpenVideo={(uri, metadata, messageId) => setVideoPreview({ uri, metadata, messageId })}
                      onOpenActions={openMessageMenu}
                      onMentionAuthor={selectedChat?.type === "group" ? mentionGroupMember : undefined}
                      onRetry={retryFailedMessage}
                      onToggleGroupSelection={toggleMessageGroupSelection}
                      onToggleSelection={toggleMessageSelection}
                      selectedClientIds={selectedMessageClientIds}
                      selectionMode={messageSelectionMode}
                      showAuthor={Boolean(selectedChat?.type === "group")}
                      showSelfAvatar={Boolean(currentUserMe?.show_self_avatar)}
                      selfAvatarFrame={currentUserMe?.avatar_frame_style ?? session?.user.avatar_frame_style}
                      selfAvatarName={currentUserName}
                      selfAvatarUri={currentUserMe?.avatar_uri ?? session?.user.avatar_uri}
                      selfIsPermanentVip={currentUserIsPermanentVip}
                    />
                  )}
                />
              </div>

              {messageSelectionMode ? (
                <div className="composer message-selection-toolbar">
                  <button disabled={!selectionActionAvailability.forward || Boolean(messageSelectionAction)} onClick={openForwardPicker} type="button">
                    <span className="material-symbols-outlined">forward</span>
                    <span>{t("message.forward")}</span>
                  </button>
                  <button disabled={!selectionActionAvailability.copy || Boolean(messageSelectionAction)} onClick={() => requestSelectionAction("copy")} type="button">
                    <span className="material-symbols-outlined">content_copy</span>
                    <span>{t("common.copy")}</span>
                  </button>
                  <button disabled={!selectionActionAvailability.save || Boolean(messageSelectionAction)} onClick={() => requestSelectionAction("save")} type="button">
                    <span className="material-symbols-outlined">download</span>
                    <span>{t("common.save")}</span>
                  </button>
                  <button
                    className="message-selection-delete"
                    disabled={!selectionActionAvailability.delete || messageDeleteState === "deleting" || Boolean(messageSelectionAction)}
                    onClick={() => setBatchDeleteConfirmOpen(true)}
                    type="button"
                  >
                    <ComposerSvgIcon kind="delete" />
                    <span>{t("common.delete")}</span>
                  </button>
                  <button
                    className="message-selection-recall"
                    disabled={!selectionActionAvailability.recall || Boolean(messageSelectionAction)}
                    onClick={() => requestSelectionAction("recall")}
                    type="button"
                  >
                    <span className="material-symbols-outlined">undo</span>
                    <span>{t("message.recallForEveryone")}</span>
                  </button>
                </div>
              ) : (
              <form
                ref={composerRef}
                className={`composer ${voiceComposer.open ? "is-recording-mode" : ""}`}
                onSubmit={submit}
                style={{ "--mention-selection-accent": mentionSelectionAccent(pendingMessageAppearance.chatBubbleStyle) } as CSSProperties}
              >
                {replyingTo && !voiceComposer.open ? (
                  <div className="composer-reply-preview">
                    <div>
                      <strong>{t("message.replyTo", { name: replyingTo.user.name })}</strong>
                      <span>{replyingTo.content}</span>
                    </div>
                    <button aria-label={t("message.cancelReply")} onClick={() => setReplyTarget(null)} type="button">
                      <span className="material-symbols-outlined">close</span>
                    </button>
                  </div>
                ) : null}
                {!voiceComposer.open ? (
                  <div className="composer-row composer-row-text">
                    {canSendAudio ? (
                      <div className="composer-leading-actions">
                        <FeatureDiscoveryTarget
                          rewardId="capability.audio"
                          guide={{
                            title: t("featureDiscovery.audio.title"),
                            description: t("featureDiscovery.audio.description"),
                            actionLabel: t("featureDiscovery.audio.action"),
                            onAction: () => startVoiceRecording(),
                          }}
                        >
                          <button aria-label={t("audio.record")} className="composer-action-button" disabled={composerBusy} onClick={() => void startVoiceRecording()} title={t("audio.record")} type="button">
                            <ComposerSvgIcon className="composer-inline-svg" kind="mic" />
                          </button>
                        </FeatureDiscoveryTarget>
                      </div>
                    ) : null}
                    <div className="composer-input-wrap">
                      <MentionComposerInput
                        ref={mentionEditorRef}
                        className="textarea composer-input composer-rich-input"
                        members={selectedChat?.type === "group" ? selectedChat.detail.members.filter((member) => !member.isSelf) : []}
                        onChange={updateDraft}
                        onFocus={() => setEmojiPickerOpen(false)}
                        onMentionQueryChange={(query) => setMentionSearch(selectedChat?.type === "group" ? query : null)}
                        onPaste={handleComposerPaste}
                        onSelectFirstMention={() => {
                          if (mentionSearch === null || !mentionCandidates.length) return false;
                          selectMention(mentionCandidates[0]);
                          return true;
                        }}
                        onSubmit={() => composerRef.current?.requestSubmit()}
                        placeholder={t("chat.inputPlaceholder")}
                        value={draft}
                      />
                      {mentionSearch !== null && mentionCandidates.length ? (
                        <div className="composer-mention-picker" role="listbox" aria-label={t("chat.mentionMembers")}>
                          {mentionCandidates.map((member) => (
                            <button key={member.userId} onMouseDown={(event) => event.preventDefault()} onClick={() => selectMention(member)} role="option" type="button">
                              <UserAvatar className="composer-mention-avatar" frame={member.avatarFrameStyle} name={member.name} uri={member.avatarUri} />
                              <span>{member.name}</span>
                            </button>
                          ))}
                        </div>
                      ) : null}
                      <button
                        aria-expanded={emojiPickerOpen}
                        aria-label={emojiPickerOpen ? t("emoji.keyboard") : t("emoji.choose")}
                        className={`composer-emoji-button ${emojiPickerOpen ? "is-open" : ""}`}
                        disabled={composerBusy}
                        onClick={() => {
                          setComposerMoreOpen(false);
                          if (emojiPickerOpen) {
                            setEmojiPickerOpen(false);
                            window.requestAnimationFrame(() => mentionEditorRef.current?.focus());
                          } else {
                            setEmojiPickerOpen(true);
                          }
                        }}
                        type="button"
                      >
                        <ComposerSvgIcon className="composer-inline-svg" kind={emojiPickerOpen ? "keyboard" : "emoji"} />
                      </button>
                    </div>
                    <button
                      aria-expanded={composerMoreOpen}
                      aria-label={composerMoreOpen ? t("common.collapseMore") : t("common.expandMore")}
                      className={`composer-plus ${composerMoreOpen ? "is-open" : ""}`}
                      disabled={composerBusy}
                      onClick={() => {
                        setEmojiPickerOpen(false);
                        setComposerMoreOpen((current) => !current);
                      }}
                      type="button"
                    >
                      <span className="material-symbols-outlined">add</span>
                    </button>
                    <button hidden type="submit" />
                  </div>
                ) : (
                  <div className="composer-row composer-row-recording">
                    <button className="composer-recording-delete" disabled={voiceComposer.phase === "sending"} onClick={cancelVoiceRecording} type="button">
                      <ComposerSvgIcon className="composer-inline-svg" kind="delete" />
                    </button>
                    <div className={`composer-recording-bar is-${voiceComposer.phase}`}>
                      <button
                        className="composer-recording-stop"
                        disabled={!["recording", "recorded"].includes(voiceComposer.phase)}
                        onClick={voiceComposer.phase === "recorded" ? () => void toggleVoicePreview() : stopVoiceRecording}
                        type="button"
                        aria-label={voiceComposer.phase === "recorded" ? (voicePreviewPlaying ? t("audio.pausePreview") : t("audio.preview")) : t("audio.stopRecording")}
                      >
                        {voiceComposer.phase === "recorded" ? (
                          <MessageControlIcon className="composer-inline-svg" kind={voicePreviewPlaying ? "pause" : "play"} />
                        ) : voiceComposer.phase === "requesting" || voiceComposer.phase === "stopping" ? (
                          <span className="composer-recording-spinner" />
                        ) : (
                          <ComposerSvgIcon className="composer-inline-svg composer-stop-svg" kind="stop" />
                        )}
                      </button>
                      <div className={`composer-recording-waveform ${voicePreviewPlaying ? "is-previewing" : ""}`} aria-hidden="true">
                        {voiceComposer.phase === "requesting" ? (
                          <span className="composer-recording-state">{t("audio.preparingMicrophone")}</span>
                        ) : voiceComposer.phase === "stopping" ? (
                          <span className="composer-recording-state">{t("audio.generating")}</span>
                        ) : (
                          voiceComposer.bars.map((bar, index) => (
                            <span key={`wave-${index}`} className="composer-recording-bar-item" style={{ "--voice-level": `${bar}` } as CSSProperties} />
                          ))
                        )}
                      </div>
                      <span className={`composer-recording-time ${voiceComposer.durationSeconds >= AUDIO_MAX_DURATION_SECONDS ? "is-limit" : ""}`}>
                        {formatDuration(voiceComposer.durationSeconds)}
                      </span>
                    </div>
                    <button
                      className="composer-recording-send"
                      disabled={voiceComposer.phase !== "recorded"}
                      onClick={() => void sendRecordedVoiceMessage()}
                      type="button"
                    >
                      {voiceComposer.phase === "sending" ? <span className="composer-recording-spinner" /> : <span className="material-symbols-outlined">send</span>}
                    </button>
                    <audio
                      ref={voicePreviewAudioRef}
                      hidden
                      preload="metadata"
                      src={voicePreviewUri}
                      onEnded={() => {
                        setVoicePreviewPlaying(false);
                        if (activeThreadAudio === voicePreviewAudioRef.current) activeThreadAudio = null;
                      }}
                      onPause={() => setVoicePreviewPlaying(false)}
                      onPlay={() => setVoicePreviewPlaying(true)}
                    />
                  </div>
                )}
                {!voiceComposer.open && emojiPickerOpen ? (
                  <div className="composer-emoji-panel" aria-label={t("emoji.picker")}>
                    <div className="composer-emoji-tabs" role="tablist" aria-label={t("emoji.categories")}>
                      <button
                        aria-label={t("sticker.mine")}
                        aria-selected={emojiPage === STICKER_MY_PAGE}
                        className={emojiPage === STICKER_MY_PAGE ? "is-active" : ""}
                        onClick={() => setEmojiPage(STICKER_MY_PAGE)}
                        role="tab"
                        title={t("sticker.mine")}
                        type="button"
                      >
                        <span className="material-symbols-outlined">photo_library</span>
                        <small>{t("sticker.mine")}</small>
                      </button>
                      <button
                        aria-label={t("sticker.explore")}
                        aria-selected={emojiPage === STICKER_EXPLORE_PAGE}
                        className={emojiPage === STICKER_EXPLORE_PAGE ? "is-active" : ""}
                        onClick={() => setEmojiPage(STICKER_EXPLORE_PAGE)}
                        role="tab"
                        title={t("sticker.explore")}
                        type="button"
                      >
                        <span className="material-symbols-outlined">explore</span>
                        <small>{t("sticker.explore")}</small>
                      </button>
                      {EMOJI_PAGES.map((page, index) => (
                        <button
                          aria-label={t(page.labelKey as TranslationKey)}
                          aria-selected={emojiPage === index}
                          className={emojiPage === index ? "is-active" : ""}
                          key={page.labelKey}
                          onClick={() => setEmojiPage(index)}
                          role="tab"
                          title={t(page.labelKey as TranslationKey)}
                          type="button"
                        >
                          <span>{page.icon}</span>
                          <small>{t(page.labelKey as TranslationKey)}</small>
                        </button>
                      ))}
                    </div>
                    {emojiPage === STICKER_MY_PAGE ? (
                      <div className="composer-sticker-pane" role="tabpanel" aria-label={t("sticker.mine")}>
                        {stickers.length ? (
                          <div className="composer-sticker-grid" onScroll={(event) => handleStickerGridScroll(event, "mine")}>
                            {canCreateSticker ? (
                              <FeatureDiscoveryTarget className="is-sticker-entry" rewardId="capability.sticker">
                                <button className="composer-sticker-add is-manager-entry" disabled={stickerSaving} onClick={openStickerManager} type="button">
                                  <span className="material-symbols-outlined">add</span>
                                </button>
                              </FeatureDiscoveryTarget>
                            ) : null}
                            {stickers.map((sticker) => (
                              <button
                                className="composer-sticker-item"
                                disabled={stickerSaving}
                                key={sticker.sticker_id}
                                onClick={() => void sendSticker(sticker)}
                                type="button"
                              >
                                <img alt="" loading="lazy" src={resolveStableResourceUri(sticker.uri) ?? sticker.uri} />
                              </button>
                            ))}
                            {mineStickersLoading ? (
                              <span className="composer-sticker-page-loading" aria-label={t("common.loading")} />
                            ) : null}
                          </div>
                        ) : !mineStickersLoading ? (
                          <div className="composer-sticker-empty">
                            <span className="material-symbols-outlined">photo_library</span>
                            <strong>{t("sticker.mineEmpty")}</strong>
                            {canCreateSticker ? (
                              <FeatureDiscoveryTarget rewardId="capability.sticker">
                                <button onClick={openStickerManager} type="button">{t("sticker.addFirst")}</button>
                              </FeatureDiscoveryTarget>
                            ) : null}
                          </div>
                        ) : <span className="composer-sticker-loading is-centered" aria-label={t("common.loading")} />}
                      </div>
                    ) : emojiPage === STICKER_EXPLORE_PAGE ? (
                      <div className="composer-sticker-pane" role="tabpanel" aria-label={t("sticker.explore")}>
                        {exploreStickers.length ? (
                          <div className="composer-sticker-grid" onScroll={(event) => handleStickerGridScroll(event, "explore")}>
                            {exploreStickers.map((sticker) => (
                              <div className="composer-sticker-explore-item" key={sticker.sticker_asset_id}>
                                <button aria-label={t("sticker.send")} className="composer-sticker-item is-explore" disabled={stickerSaving} onClick={() => void sendSticker(sticker)} type="button">
                                  <img alt="" loading="lazy" src={resolveStableResourceUri(sticker.uri) ?? sticker.uri} />
                                </button>
                                <span className={`composer-sticker-source is-${sticker.source_scope ?? "external"}`}>
                                  {sticker.source_scope === "local" && sticker.source_user ? (
                                    <>
                                      <UserAvatar className="composer-sticker-source-avatar" name={sticker.source_user.name} uri={sticker.source_user.avatar_uri} />
                                      <span className={`composer-sticker-source-name${sticker.source_user.name.length > 8 ? " is-scrolling" : ""}`}>
                                        <span>{sticker.source_user.name}</span>
                                      </span>
                                    </>
                                  ) : (
                                    <>
                                      <span className="material-symbols-outlined" aria-hidden="true">public</span>
                                      <span>{t("sticker.externalSource")}</span>
                                    </>
                                  )}
                                </span>
                                <button aria-label={t("sticker.collect")} className="composer-sticker-collect" disabled={stickerSaving} onClick={() => void collectExploredSticker(sticker)} type="button">
                                  <span className="material-symbols-outlined">add</span>
                                </button>
                              </div>
                            ))}
                            {exploreStickersLoading ? (
                              <span className="composer-sticker-page-loading" aria-label={t("common.loading")} />
                            ) : null}
                          </div>
                        ) : !exploreStickersLoading ? (
                          <div className="composer-sticker-empty">
                            <span className="material-symbols-outlined">explore</span>
                            <strong>{t("sticker.exploreEmpty")}</strong>
                          </div>
                        ) : <span className="composer-sticker-loading is-centered" aria-label={t("common.loading")} />}
                      </div>
                    ) : (
                      <div className="composer-emoji-grid" role="tabpanel" aria-label={t(EMOJI_PAGES[emojiPage].labelKey as TranslationKey)}>
                        {visibleEmojis.map((emoji, index) => (
                          <button
                            aria-label={t("emoji.insert", { emoji })}
                            className={emojiPage === 0 && index < frequentEmojis.length ? "is-frequent" : ""}
                            key={`${emoji}-${index}`}
                            onClick={() => insertEmoji(emoji)}
                            type="button"
                          >
                            {emoji}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                ) : null}
                {!voiceComposer.open ? (
                  <div className={`composer-actions-reveal ${composerMoreOpen ? "is-open" : ""}`} aria-hidden={!composerMoreOpen}>
                    <div className="composer-actions-grid">
                      {canSendImage ? (
                        <FeatureDiscoveryTarget
                          rewardId="capability.video"
                          guide={{ title: t("featureDiscovery.video.title"), description: t("featureDiscovery.video.description"), actionLabel: t("featureDiscovery.video.action"), onAction: openGalleryPicker }}
                        >
                          <FeatureDiscoveryTarget
                            rewardId="capability.image"
                            guide={{ title: t("featureDiscovery.image.title"), description: t("featureDiscovery.image.description"), actionLabel: t("featureDiscovery.image.action"), onAction: openGalleryPicker }}
                          >
                            <button className="composer-action-tile" disabled={composerBusy} onClick={openGalleryPicker} title={t("media.gallery")} type="button">
                              <span className="composer-action-tile-icon"><ComposerSvgIcon kind="album" /></span>
                              <span>{t("media.gallery")}</span>
                            </button>
                          </FeatureDiscoveryTarget>
                        </FeatureDiscoveryTarget>
                      ) : null}
                      <button className="composer-action-tile" disabled={composerBusy} onClick={openFilePicker} type="button">
                        <span className="composer-action-tile-icon"><ComposerSvgIcon kind="file" /></span>
                        <span>{t("media.file")}</span>
                      </button>
                      {canSendLocation ? (
                        <FeatureDiscoveryTarget
                          rewardId="capability.location"
                          guide={{
                            title: t("featureDiscovery.location.title"),
                            description: t("featureDiscovery.location.description"),
                            actionLabel: t("featureDiscovery.location.action"),
                            onAction: openLocationPicker,
                          }}
                        >
                          <button className="composer-action-tile" disabled={composerBusy} onClick={openLocationPicker} title={t("media.location")} type="button">
                            <span className="composer-action-tile-icon"><ComposerSvgIcon kind="location" /></span>
                            <span>{t("media.location")}</span>
                          </button>
                        </FeatureDiscoveryTarget>
                      ) : null}
                      {selectedChat ? (
                        <button className="composer-action-tile" disabled={composerBusy || travelMapSaving} onClick={() => void openChatTravelMap()} type="button">
                          <span className="composer-action-tile-icon"><ComposerSvgIcon kind="map" /></span>
                          <span>{t("travelMap.actionShort")}</span>
                        </button>
                      ) : null}
                    </div>
                  </div>
                ) : null}
              </form>
              )}
              </div>
            </>
          ) : (
            <div className="desktop-chat-empty" aria-label={t("chat.noneSelected")}>
              <div className="desktop-chat-empty-mark" aria-hidden="true">
                <span className="desktop-chat-empty-bubble desktop-chat-empty-bubble-back" />
                <span className="desktop-chat-empty-bubble desktop-chat-empty-bubble-front">
                  <span />
                  <span />
                  <span />
                </span>
              </div>
              <strong>{t("chat.selectConversation")}</strong>
            </div>
          )}
          {fileDropActive ? (
            <div className="chat-file-drop-guide" role="status">
              <div className="chat-file-drop-guide-card">
                <span className="chat-file-drop-guide-icon" aria-hidden="true"><ComposerSvgIcon kind="file" /></span>
                <strong>{t("clipboard.dropToSend")}</strong>
                <span>{t("clipboard.dropToReview")}</span>
              </div>
            </div>
          ) : null}
          {clipboardUpload ? (
            <div className="chat-clipboard-backdrop" role="presentation">
              <section aria-modal="true" className="chat-clipboard-dialog" role="dialog">
                <div className="chat-clipboard-copy">
                  <span className="chat-clipboard-icon" aria-hidden="true">
                    <ComposerSvgIcon kind="file" />
                  </span>
                  <div>
                    <h3>{t("clipboard.sendThese")}</h3>
                    <p>{t(clipboardUpload.source === "drop" ? "clipboard.itemsDropped" : "clipboard.itemsRead", { count: clipboardUpload.files.length })}</p>
                  </div>
                </div>
                <div className="chat-clipboard-items">
                  {clipboardUpload.files.map((file, index) => (
                    <div className="chat-clipboard-item" key={`${file.name}:${file.size}:${index}`}>
                      {clipboardUpload.previewUris[index] ? (
                        <img alt="" src={clipboardUpload.previewUris[index] ?? undefined} />
                      ) : (
                        <span className="chat-clipboard-file-icon" aria-hidden="true"><ComposerSvgIcon kind="file" /></span>
                      )}
                      <div>
                        <strong>{file.name || (file.type.startsWith("image/") ? t("clipboard.image") : t("clipboard.file"))}</strong>
                        <span>{formatFileSize(file.size)}</span>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="chat-clipboard-actions">
                  <button className="ghost-button" onClick={closeClipboardUpload} type="button">{t("common.cancel")}</button>
                  <button className="button" onClick={() => void confirmClipboardUpload()} type="button">{t("common.upload")}</button>
                </div>
              </section>
            </div>
          ) : null}
        </section>

        <aside className="panel desktop-pane">
          {selectedChat ? (
            <>
              <div className="panel-header" style={{ padding: 0, borderBottom: "1px solid rgba(232,235,242,.9)" }}>
                <h3 className="panel-title">{selectedChat.type === "direct" ? t("chat.conversationInfo") : t("chat.groupInfo")}</h3>
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
                            {selectedChat.verified ? <span className="verified-badge">{t("admin.verified")}</span> : null}
                            <span className={selectedChat.online ? "presence-badge" : "count-badge"}>{selectedChat.subtitle}</span>
                          </div>
                        </div>
                      </div>
                    ) : null}
                    <div className="detail-row">
                      <div>
                        <strong>{selectedChat.type === "direct" ? t("chat.currentStatus") : t("chat.yourRole")}</strong>
                        <div className="detail-text">{selectedChat.detail.relation}</div>
                      </div>
                      {selectedChat.type === "direct" ? (
                        <span className={selectedChat.online ? "presence-badge" : "count-badge"}>{selectedChat.subtitle}</span>
                      ) : (
                        <span className="count-badge">{t("chat.memberCount", { count: selectedChat.members })}</span>
                      )}
                    </div>
                  </div>

                  <div className="detail-card">
                    <strong>{selectedChat.type === "direct" ? t("chat.conversationMembers") : t("chat.groupMembers")}</strong>
                    <div className="member-list">
                      {selectedChat.detail.members.map((member) => (
                        <div key={member.userId} className="member-line">
                          <div className="member-line-main">
                            <UserAvatar className="mini-avatar" name={member.name} uri={member.avatarUri} />
                            <span>{member.name}</span>
                          </div>
                          {member.isSelf ? <span className="count-badge">{t("common.you")}</span> : null}
                          {selectedChat.type === "group" && selectedChat.isOwner && !member.isSelf ? (
                            <button className="ghost-button member-line-action" onClick={() => void removeGroupMember(member.userId)} type="button">
                              {t("admin.remove")}
                            </button>
                          ) : null}
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="detail-card">
                    <strong>{t("common.quickActions")}</strong>
                    <div className="settings-actions" style={{ marginTop: 12 }}>
                      {selectedChat.type === "group" ? (
                        <>
                          {selectedChat.isOwner ? (
                            <>
                              <button
                                className="ghost-button"
                                disabled={!canRenameGroup}
                                onClick={() => {
                                  setGroupRenameValue(selectedChat.title);
                                  setGroupRenameOpen(true);
                                }}
                                type="button"
                              >
                                {canRenameGroup ? t("chat.renameGroup") : t("chat.renameUnlockAtLevel", { level: 5 })}
                              </button>
                              <button className="ghost-button" disabled={!canInviteGroupMember} onClick={() => void openChatMemberAdder()} type="button">
                                {canInviteGroupMember ? t("chat.inviteMembers") : t("chat.inviteUnlockAtLevel", { level: 4 })}
                              </button>
                            </>
                          ) : null}
                          <button className="danger-button" onClick={() => setGroupDangerConfirmOpen(true)} type="button">
                            {selectedChat.isOwner ? t("chat.disband") : t("chat.leave")}
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
            <FeedbackState title={t("chat.conversationInfo")} description={t("chat.selectToView")} />
          )}
        </aside>
      </section>

      <BottomSheet
        open={groupCreateOpen}
        title={t("chat.createGroup")}
        onClose={() => {
          if (groupCreateState === "creating") return;
          setGroupCreateOpen(false);
        }}
      >
        <div className="simple-form">
          <label className="field-label">{t("chat.groupName")}</label>
          <input className="input" placeholder={t("chat.groupNameExample")} value={groupTitle} onChange={(event) => setGroupTitle(event.target.value)} />
          <label className="field-label">{t("chat.selectMembers")}</label>
          <div className="row-subtle">{t("chat.groupVerificationHint")}</div>
          {currentUserVerified === false ? (
            <FeedbackState title={t("chat.verifyBeforeCreate")} description={t("chat.creatorVerificationRequired")} />
          ) : (
            <>
              <input className="input" placeholder={t("friends.search")} value={groupQuery} onChange={(event) => setGroupQuery(event.target.value)} />
              <div className="row-subtle">{t("chat.selectedCount", { count: groupSelectedIds.length })}</div>
              <div className="simple-list">
                {groupCandidates.map((user) => {
                  const selected = groupSelectedIds.includes(user.user_id);
                  return (
                    <button key={`group-user-${user.user_id}`} className="simple-row person-row" onClick={() => toggleGroupCandidate(user.user_id)} type="button">
                      <UserAvatar className={`mini-avatar ${user.is_alive ? "status-online" : ""}`} name={user.name} uri={user.avatar_uri} />
                      <div className="row-main">
                        <strong>{user.name}</strong>
                        <div className="row-subtle">{user.is_alive ? t("presence.online") : t("presence.offline")}</div>
                      </div>
                      {selected ? <span className="small-badge">{t("common.selected")}</span> : <span className="count-badge">{t("common.select")}</span>}
                    </button>
                  );
                })}
              </div>
            </>
          )}
          <div className="button-row">
            <button className="ghost-button" onClick={() => setGroupCreateOpen(false)} type="button">
              {t("common.cancel")}
            </button>
            <button className="button" disabled={groupCreateState === "creating" || currentUserVerified === false} onClick={() => void createGroup()} type="button">
              {groupCreateState === "creating" ? t("common.creating") : t("chat.createGroup")}
            </button>
          </div>
        </div>
      </BottomSheet>

      <ChatTargetPicker
        open={forwardPickerOpen}
        title={t("message.forwardTitle")}
        description={t("message.forwardSourceCount", { count: forwardSourceMessageIds.length })}
        targets={chats.map((chat) => ({
          id: chat.id,
          title: chat.title,
          preview: chat.preview || chat.subtitle,
          time: chat.time,
          pinned: chat.pinned,
          avatarUri: chat.avatarUri,
          avatarCacheKey: chat.avatarCacheKey,
          avatarFrameStyle: chat.avatarFrameStyle,
          groupMembers: chat.type === "group" ? chat.detail.members.map((member) => ({ name: member.name, uri: member.avatarUri, cacheKey: member.avatarCacheKey })) : undefined,
        }))}
        selectedIds={forwardTargetChatIds}
        multiple
        maxSelections={10}
        busy={forwardSending}
        emptyTitle={t("square.noChatsToShare")}
        submitLabel={t("message.forwardToChats", { count: forwardTargetChatIds.length })}
        onSelectionChange={setForwardTargetChatIds}
        onLimitReached={() => showToast(t("message.forwardTargetLimit", { count: 10 }), "error")}
        onSubmit={() => submitForwardMessages()}
        onClose={() => {
          if (!forwardSending) setForwardPickerOpen(false);
        }}
        beforeList={forwardSourceMessageIds.length > 1 ? (
          <div className="forward-mode-switch" role="radiogroup" aria-label={t("message.forwardMode")}>
            <button
              className={forwardMode === "individual" ? "is-active" : ""}
              onClick={() => setForwardMode("individual")}
              role="radio"
              aria-checked={forwardMode === "individual"}
              type="button"
            >
              <span className="material-symbols-outlined" aria-hidden="true">view_agenda</span>
              <span><strong>{t("message.forwardIndividual")}</strong><small>{t("message.forwardIndividualHint")}</small></span>
            </button>
            <button
              className={forwardMode === "bundle" ? "is-active" : ""}
              onClick={() => setForwardMode("bundle")}
              role="radio"
              aria-checked={forwardMode === "bundle"}
              type="button"
            >
              <span className="material-symbols-outlined" aria-hidden="true">stacks</span>
              <span><strong>{t("message.forwardBundle")}</strong><small>{t("message.forwardBundleHint")}</small></span>
            </button>
          </div>
        ) : null}
      />

      <SideDrawer
        open={Boolean(forwardBundlePreview)}
        title={t("message.forwardBundleTitle")}
        titleAccessory={<span className="drawer-title-count">{forwardBundlePreview?.item_count ?? forwardBundlePreview?.items?.length ?? 0}</span>}
        historyKey="forward-bundle"
        onClose={() => setForwardBundlePreview(null)}
      >
        <div className="forward-bundle-viewer">
          <header className="forward-bundle-viewer-intro">
            <span className="material-symbols-outlined" aria-hidden="true">forum</span>
            <span><strong>{t("message.forwardBundleSnapshot")}</strong><small>{forwardBundlePreview?.summary || t("message.forwardBundleSnapshotHint")}</small></span>
          </header>
          <ChatPreview
            className="forward-bundle-chat-preview"
            firstPersonUserId={forwardBundlePreview?.first_person_user_id}
            messages={forwardBundleItemsAsMessages(forwardBundlePreview?.items ?? [])}
          />
        </div>
      </SideDrawer>

      <SideDrawer
        open={pinnedDrawerOpen}
        title={t("pin.messages")}
        titleAccessory={<span className="pinned-message-title-count">{pinnedMessages.length}</span>}
        onClose={() => setPinnedDrawerOpen(false)}
      >
        <div className="pinned-message-list">
          {pinnedMessages.map((pin, index) => {
            const pinnedByCurrentUser = pin.pinned_by_users.some((user) => user.user_id === currentUserId);
            const canUnpin = canManagePinnedMessages && pinnedByCurrentUser;
            return (
            <article className={`pinned-message-card${pinnedByCurrentUser ? " is-mine" : " is-readonly"}`} key={pin.pin_id}>
              <span className="pinned-message-sequence">{String(index + 1).padStart(2, "0")}</span>
              <div className="pinned-message-content" onClick={() => revealPinnedMessage(pin.message.message_id)}>
                <ChatPreview
                  className="pinned-message-chat-preview"
                  firstPersonUserId={currentUserId}
                  messages={[pin.message]}
                  showAuthors={false}
                />
                <small className="pinned-message-attribution" title={t("pin.by", { names: pinnedByLabel(pin) })}>
                  <span>{t("pin.by", { names: pinnedByLabel(pin) })}</span>
                  <i />
                  <time>{formatRelativeTime(pin.pinned_at)}</time>
                </small>
              </div>
              <span className="pinned-message-action-slot">
              {canUnpin ? (
                <button
                  aria-label={t("pin.remove")}
                  className="pinned-message-remove"
                  disabled={pinSavingMessageId === pin.message.message_id}
                  onClick={() => void togglePinnedMessage(mapChatMessage(pin.message, currentUserId))}
                  type="button"
                >
                  <ComposerSvgIcon className="pinned-message-remove-icon" kind="pin-off" />
                </button>
              ) : (
                <span aria-hidden="true" className="pinned-message-readonly">
                  <ComposerSvgIcon className="pinned-message-readonly-icon" kind="pin" />
                </span>
              )}
              </span>
            </article>
            );
          })}
        </div>
      </SideDrawer>

      <SideDrawer
        historyKey="chat-details"
        open={detailsSheetOpen}
        title={t("chat.details")}
        onClose={() => setDetailsSheetOpen(false)}
      >
        {selectedChat ? (
          <div className="chat-detail-panel">
            <section className="chat-detail-people-section">
              <div className="chat-detail-member-grid">
                {visibleDetailMembers.map((member) => (
                  <button
                    key={`sheet-member-${member.userId}`}
                    className={`chat-detail-member-item ${member.isOwner ? "is-owner" : ""} ${member.isSelf ? "is-self" : ""}`}
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
                    </span>
                  </button>
                ))}
                {(selectedChat.type === "group" ? canInviteGroupMember : canCreateGroup) ? (
                  <FeatureDiscoveryTarget
                    className="is-member-action"
                    rewardId="capability.group"
                    guide={{ title: t("featureDiscovery.group.title"), description: t("featureDiscovery.group.description"), actionLabel: t("featureDiscovery.group.action"), onAction: openChatMemberAdder }}
                  >
                    <button className="chat-detail-member-item chat-detail-member-add" onClick={openChatMemberAdder} type="button">
                      <span className="chat-detail-member-avatar chat-detail-member-avatar-add"><span className="material-symbols-outlined">add</span></span>
                      <span className="chat-detail-member-name">{t("common.add")}</span>
                    </button>
                  </FeatureDiscoveryTarget>
                ) : null}
                {selectedChat.type === "group" && selectedChat.isOwner ? (
                  <button className="chat-detail-member-item chat-detail-member-add" onClick={openChatMemberRemover} type="button">
                    <span className="chat-detail-member-avatar chat-detail-member-avatar-add chat-detail-member-avatar-remove">
                      <svg aria-hidden="true" className="chat-detail-member-remove-icon" fill="none" viewBox="0 0 24 24">
                        <path d="M6.5 12h11" stroke="currentColor" strokeLinecap="round" strokeWidth="2.2" />
                      </svg>
                    </span>
                    <span className="chat-detail-member-name">{t("admin.remove")}</span>
                  </button>
                ) : null}
              </div>
              {hasMoreDetailMembers ? (
                <button className="ghost-button chat-detail-more-button" onClick={() => setDetailMemberLimit((current) => current + CHAT_DETAIL_MEMBER_PAGE_SIZE)} type="button">
                  {t("chat.moreMembers")}
                </button>
              ) : null}
            </section>

            <section className="chat-detail-settings-section">
              <SettingGroup>
                <SettingRow
                  icon={<span className="material-symbols-outlined" aria-hidden="true">search</span>}
                  onClick={() => {
                    setMessageSearchKeyword("");
                    setMessageSearchType(null);
                    setMessageSearchResults([]);
                    setMessageSearchState("idle");
                    setMessageSearchOpen(true);
                  }}
                  description={t("messageSearch.hint")}
                  title={t("messageSearch.action")}
                />
              </SettingGroup>
            </section>

            <section className="chat-detail-settings-section">
              <SettingGroup>
                <SettingRow title={t("chat.pinConversation")} trailing={<SettingSwitch checked={selectedChat.pinned} disabled={preferenceSaving !== null} label={t("chat.togglePin")} onChange={(next) => void updateSelectedChatPreference("pin", next)} />} />
                {selectedChat.type === "direct" && canUseOnlineReminder ? (
                  <FeatureDiscoveryTarget
                    className="is-setting-row"
                    rewardId="capability.online"
                    guide={{ title: t("featureDiscovery.online.title"), description: t("featureDiscovery.online.description"), actionLabel: t("featureDiscovery.online.action"), onAction: () => updateSelectedChatPreference("online", true) }}
                  >
                  <SettingRow title={t("chat.onlineReminder")} trailing={<SettingSwitch checked={selectedChat.onlineReminderEnabled} disabled={preferenceSaving !== null} label={t("chat.toggleOnlineReminder")} onChange={(next) => void updateSelectedChatPreference("online", next)} />} />
                  </FeatureDiscoveryTarget>
                ) : null}
                {selectedChat.type === "group" ? (
                  <SettingRow description={t("chat.muteNotificationsHint")} title={t("chat.muteNotifications")} trailing={<SettingSwitch checked={selectedChat.notificationsMuted} disabled={preferenceSaving !== null} label={t("chat.toggleMuteNotifications")} onChange={(next) => void updateSelectedChatPreference("mute", next)} />} />
                ) : null}
                {selectedChat.type === "group" && selectedChat.notificationsMuted ? (
                  <SettingRow className="is-dependent" description={t("chat.muteUnreadBadgeHint")} title={t("chat.muteUnreadBadge")} trailing={<SettingSwitch checked={selectedChat.unreadBadgeMuted} disabled={preferenceSaving !== null} label={t("chat.toggleMuteUnreadBadge")} onChange={(next) => void updateSelectedChatPreference("badge", next)} />} />
                ) : null}
                {selectedChat.type === "group" && canRenameGroup ? (
                  <FeatureDiscoveryTarget className="is-setting-row" rewardId="capability.group_name">
                  <div className="chat-detail-setting-row">
                    <div className="row-main chat-detail-title-main"><strong>{t("chat.groupName")}</strong><div className="row-subtle">{selectedChat.title}</div></div>
                    <button
                      className="chat-detail-row-icon"
                      onClick={() => {
                        setGroupRenameValue(selectedChat.title);
                        setGroupRenameOpen(true);
                      }}
                      aria-label={t("chat.editGroupName")}
                      type="button"
                    >
                      <span className="material-symbols-outlined">edit</span>
                    </button>
                  </div>
                  </FeatureDiscoveryTarget>
                ) : null}
              </SettingGroup>
            </section>

            <section className="chat-detail-settings-section">
              <SettingGroup>
                <SettingRow
                  disabled={historyRecoveryLoading || !historyRecoveryStatus?.can_restore}
                  icon={<span className="material-symbols-outlined" aria-hidden="true">history</span>}
                  onClick={() => setRestoreHistoryConfirmOpen(true)}
                  description={historyRecoveryLoading
                    ? t("common.loading")
                    : !historyRecoveryStatus
                      ? t("chat.restoreHistoryUnavailable")
                      : !historyRecoveryStatus.eligible
                        ? t("chat.restoreHistoryVerify")
                        : !historyRecoveryStatus.has_password
                          ? t("chat.restoreHistorySetPassword")
                          : historyRecoveryStatus.remaining <= 0
                          ? t("chat.restoreHistoryExhausted")
                          : historyRecoveryStatus.hidden_count <= 0
                            ? t("chat.restoreHistoryEmpty")
                            : t("chat.restoreHistorySummary", { count: historyRecoveryStatus.hidden_count, remaining: historyRecoveryStatus.remaining })}
                  title={t("chat.restoreHistory")}
                />
              </SettingGroup>
            </section>

            <section className="chat-detail-danger-section">
              <div className="chat-detail-settings-list">
                <button
                  className="chat-detail-setting-row danger-row"
                  onClick={() => setClearHistoryConfirmOpen(true)}
                  type="button"
                >
                  <div className="row-main">
                    <strong>{t("chat.clearHistory")}</strong>
                  </div>
                  <span className="material-symbols-outlined" aria-hidden="true">delete_sweep</span>
                </button>
                <button
                  className="chat-detail-setting-row danger-row"
                  onClick={() => void (selectedChat.type === "group" ? setGroupDangerConfirmOpen(true) : setFriendDangerConfirmOpen(true))}
                  type="button"
                >
                  <div className="row-main">
                    <strong>{selectedChat.type === "group" ? (selectedChat.isOwner ? t("chat.disband") : t("chat.leave")) : t("friends.delete")}</strong>
                  </div>
                  <span className="material-symbols-outlined">chevron_right</span>
                </button>
              </div>
            </section>
          </div>
        ) : null}
      </SideDrawer>
      <SideDrawer
        className="message-search-drawer"
        historyKey="message-search"
        open={messageSearchOpen}
        title={t("messageSearch.title")}
        onClose={() => setMessageSearchOpen(false)}
      >
        <div className="message-search-panel">
          <div className="message-search-controls">
            <label className="message-search-input-wrap">
              <span className="material-symbols-outlined" aria-hidden="true">search</span>
              <input
                autoComplete="off"
                autoFocus
                onChange={(event) => setMessageSearchKeyword(event.target.value)}
                placeholder={t("messageSearch.placeholder")}
                type="search"
                value={messageSearchKeyword}
              />
              {messageSearchKeyword ? (
                <button aria-label={t("common.clear")} onClick={() => setMessageSearchKeyword("")} type="button">
                  <span className="material-symbols-outlined" aria-hidden="true">close</span>
                </button>
              ) : null}
            </label>
            <div className="message-search-filters" role="tablist" aria-label={t("messageSearch.filter") }>
              {MESSAGE_SEARCH_TYPES.map((filter) => (
                <button
                  aria-selected={messageSearchType === filter.value}
                  className={messageSearchType === filter.value ? "active" : ""}
                  key={filter.label}
                  onClick={() => setMessageSearchType(filter.value)}
                  role="tab"
                  type="button"
                >
                  {t(filter.label as TranslationKey)}
                </button>
              ))}
            </div>
          </div>

          <div className="message-search-results" aria-busy={messageSearchState === "loading"}>
            {messageSearchState === "loading" ? (
              <div className="message-search-loading"><HeaderSyncIndicator syncing /></div>
            ) : null}
            {messageSearchState !== "loading" && !messageSearchResults.length ? (
              <div className={`message-search-empty${messageSearchState === "error" ? " is-error" : ""}`} role="status">
                <div className="message-search-empty-mark" aria-hidden="true">
                  <span className="message-search-empty-bubble is-back" />
                  <span className="message-search-empty-bubble is-front"><i /><i /><i /></span>
                </div>
                <strong>{messageSearchState === "error" ? t("messageSearch.failed") : t("messageSearch.empty")}</strong>
                <p>{messageSearchState === "error" ? t("messageSearch.failedHint") : t("messageSearch.emptyHint")}</p>
              </div>
            ) : null}
            {messageSearchResults.map((message) => {
              const mediaUri = [MESSAGE_TYPE_IMAGE, MESSAGE_TYPE_VIDEO].includes(message.type)
                ? message.payload?.thumbnail_uri || message.payload?.uri
                : null;
              const typeIcon = {
                [MESSAGE_TYPE_TEXT]: "chat_bubble",
                [MESSAGE_TYPE_IMAGE]: "image",
                [MESSAGE_TYPE_VIDEO]: "movie",
                [MESSAGE_TYPE_AUDIO]: "mic",
                [MESSAGE_TYPE_FILE]: "draft",
                [MESSAGE_TYPE_LOCATION]: "location_on",
                [MESSAGE_TYPE_MAP_ACCESS]: "map",
              }[message.type] ?? "chat_bubble";
              return (
                <button
                  className="message-search-result"
                  key={message.message_id}
                  onClick={() => {
                    const drawerStack = window.history.state?.sermoDrawerStack;
                    if (Array.isArray(drawerStack) && drawerStack.length >= 2) window.history.go(-2);
                    else {
                      setMessageSearchOpen(false);
                      setDetailsSheetOpen(false);
                    }
                    window.setTimeout(() => window.dispatchEvent(new CustomEvent("sermo:reveal-message", { detail: { messageId: message.message_id } })), 240);
                  }}
                  type="button"
                >
                  {mediaUri ? (
                    <img alt="" className="message-search-result-media" src={mediaUri} />
                  ) : (
                    <span className="message-search-result-icon material-symbols-outlined" aria-hidden="true">{typeIcon}</span>
                  )}
                  <span className="message-search-result-main">
                    <span className="message-search-result-meta">
                      <strong>{message.user.name}</strong>
                      <time>{formatRelativeTime(message.created_at)}</time>
                    </span>
                    <span className="message-search-result-preview">{messageResultPreview(message)}</span>
                  </span>
                  <span className="material-symbols-outlined message-search-result-arrow" aria-hidden="true">chevron_right</span>
                </button>
              );
            })}
            {messageSearchHasMore && messageSearchResults.length ? (
              <button className="message-search-more" disabled={messageSearchState === "loading-more"} onClick={() => void loadMoreMessageSearchResults()} type="button">
                {messageSearchState === "loading-more" ? t("common.loading") : t("common.loadMore")}
              </button>
            ) : null}
          </div>
        </div>
      </SideDrawer>
      <SideDrawer
        open={profileDrawerUserId !== null}
        title={t("profile.details")}
        titleAccessory={<HeaderSyncIndicator syncing={profileSyncing} />}
        onClose={() => setProfileDrawerUserId(null)}
      >
        {profileDrawerUserId !== null ? (
          <UserProfilePanel
            key={profileDrawerUserId}
            userId={profileDrawerUserId}
            initialUser={profileDrawerSeed}
            onSyncingChange={setProfileSyncing}
            onOpenChat={(nextChatId) => {
              window.history.replaceState({ ...window.history.state, sermoDrawerStack: [] }, "");
              setProfileDrawerUserId(null);
              setDetailsSheetOpen(false);
              navigate(`/app/chats/${nextChatId}`);
            }}
          />
        ) : null}
      </SideDrawer>
      <SideDrawer
        open={stickerManagerOpen}
        title={t("sticker.manageTitle")}
        actionLabel={stickers.length ? (stickerManagerSelecting ? t("common.cancel") : t("common.manage")) : undefined}
        onAction={() => {
          setStickerManagerSelecting((current) => !current);
          setSelectedStickerIds([]);
        }}
        onClose={closeStickerManager}
        historyKey="stickers"
      >
        <div className={`sticker-manager ${stickerManagerSelecting ? "is-selecting" : ""}`}>
          <div className="sticker-manager-grid">
            {canCreateSticker ? (
              <FeatureDiscoveryTarget className="is-sticker-manager-entry" rewardId="capability.sticker">
                <button className="sticker-manager-add" disabled={stickerSaving} onClick={() => stickerInputRef.current?.click()} type="button" aria-label={t("sticker.add")}>
                  <span className="material-symbols-outlined">add</span>
                </button>
              </FeatureDiscoveryTarget>
            ) : null}
            {stickers.map((sticker) => {
              const selected = selectedStickerIds.includes(sticker.sticker_id);
              return (
                <button
                  aria-pressed={stickerManagerSelecting ? selected : undefined}
                  className={`sticker-manager-item ${selected ? "is-selected" : ""}`}
                  disabled={stickerSaving}
                  key={sticker.sticker_id}
                  onClick={() => toggleStickerSelection(sticker.sticker_id)}
                  type="button"
                >
                  <img alt="" loading="lazy" src={resolveStableResourceUri(sticker.uri) ?? sticker.uri} />
                  {stickerManagerSelecting ? (
                    <span className="sticker-manager-check material-symbols-outlined">{selected ? "check" : ""}</span>
                  ) : null}
                </button>
              );
            })}
          </div>
          {!stickers.length ? (
            <div className="sticker-manager-empty">
              <span className="material-symbols-outlined">photo_library</span>
              <strong>{t("sticker.mineEmpty")}</strong>
            </div>
          ) : null}
          {stickerManagerSelecting ? (
            <div className="sticker-manager-footer">
              <button className="danger-button" disabled={!selectedStickerIds.length || stickerSaving} onClick={() => setStickerDeleteConfirmOpen(true)} type="button">
                <span className="material-symbols-outlined">delete</span>
                {selectedStickerIds.length ? t("sticker.deleteSelected", { count: selectedStickerIds.length }) : t("sticker.selectToDelete")}
              </button>
            </div>
          ) : null}
        </div>
      </SideDrawer>
      <InputDialog
        open={groupRenameOpen}
        title={t("chat.editGroupName")}
        value={groupRenameValue}
        placeholder={t("chat.groupNamePlaceholder")}
        confirmLabel={t("common.save")}
        busy={groupManageState === "saving"}
        onChange={setGroupRenameValue}
        onClose={() => setGroupRenameOpen(false)}
        onConfirm={() => void renameGroup()}
      />
      <InputDialog
        open={restoreHistoryConfirmOpen}
        title={t("chat.restoreHistoryConfirmTitle")}
        description={t("chat.restoreHistoryConfirmHint", {
          count: historyRecoveryStatus?.hidden_count ?? 0,
          remaining: Math.max(0, (historyRecoveryStatus?.remaining ?? 0) - 1),
        })}
        confirmLabel={t("chat.restoreHistory")}
        busy={restoreHistorySaving}
        type="password"
        value={restoreHistoryPassword}
        placeholder={t("password.currentPlaceholder")}
        onChange={setRestoreHistoryPassword}
        onClose={() => {
          if (!restoreHistorySaving) {
            setRestoreHistoryConfirmOpen(false);
            setRestoreHistoryPassword("");
          }
        }}
        onConfirm={() => void restoreChatHistory()}
      />
      <ConfirmDialog
        open={clearHistoryConfirmOpen}
        title={t("chat.clearHistoryConfirmTitle")}
        description={t("chat.clearHistoryConfirmHint")}
        confirmLabel={t("chat.clearHistory")}
        busy={clearHistorySaving}
        danger
        onClose={() => {
          if (!clearHistorySaving) setClearHistoryConfirmOpen(false);
        }}
        onConfirm={() => void clearChatHistory()}
      />
      <ConfirmDialog
        open={groupDangerConfirmOpen}
        title={selectedChat?.isOwner ? t("chat.disbandConfirmTitle") : t("chat.leaveConfirmTitle")}
        description={selectedChat?.isOwner ? t("chat.disbandConfirmHint") : t("chat.leaveConfirmHint")}
        confirmLabel={selectedChat?.isOwner ? t("chat.disband") : t("chat.leave")}
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
        title={t("friends.deleteConfirmTitle")}
        description={t("friends.deleteConfirmHint")}
        confirmLabel={t("friends.delete")}
        busy={friendDeleteSaving}
        danger
        onClose={() => {
          if (friendDeleteSaving) return;
          setFriendDangerConfirmOpen(false);
        }}
        onConfirm={() => void removeFriend()}
      />
      <ConfirmDialog
        open={batchDeleteConfirmOpen}
        title={t("message.batchDeleteConfirmTitle", { count: selectedMessageClientIds.length })}
        description={t("message.batchDeleteConfirmHint")}
        confirmLabel={t("message.deleteSelected")}
        busy={messageDeleteState === "deleting"}
        danger
        onClose={() => {
          if (messageDeleteState === "deleting") return;
          setBatchDeleteConfirmOpen(false);
        }}
        onConfirm={() => void deleteSelectedMessages()}
      />
      <ConfirmDialog
        open={Boolean(messageSelectionActionPrompt)}
        title={messageSelectionActionPrompt?.action === "copy"
          ? t("message.partialCopyTitle")
          : messageSelectionActionPrompt?.action === "save"
            ? t("message.partialSaveTitle")
            : messageSelectionActionPrompt?.eligibleClientIds.length === messageSelectionActionPrompt?.total
              ? t("message.recallSelectedConfirmTitle", { count: messageSelectionActionPrompt?.total ?? 0 })
              : t("message.partialRecallTitle")}
        description={messageSelectionActionPrompt
          ? messageSelectionActionPrompt.action === "recall" && messageSelectionActionPrompt.eligibleClientIds.length === messageSelectionActionPrompt.total
            ? t("message.recallSelectedConfirmHint")
            : t("message.partialActionHint", {
              eligible: messageSelectionActionPrompt.eligibleClientIds.length,
              total: messageSelectionActionPrompt.total,
            })
          : ""}
        confirmLabel={messageSelectionActionPrompt?.action === "recall" ? t("message.recallForEveryone") : t("common.continue")}
        showCancelButton={Boolean(messageSelectionActionPrompt?.eligibleClientIds.length)}
        busy={Boolean(messageSelectionAction)}
        warning={messageSelectionActionPrompt?.action === "recall"}
        onClose={() => setMessageSelectionActionPrompt(null)}
        onConfirm={() => {
          if (!messageSelectionActionPrompt?.eligibleClientIds.length) {
            setMessageSelectionActionPrompt(null);
            return;
          }
          void executeSelectionAction(messageSelectionActionPrompt.action, messageSelectionActionPrompt.eligibleClientIds);
        }}
      />
      <ConfirmDialog
        open={stickerDeleteConfirmOpen}
        title={t("sticker.deleteConfirmTitle", { count: selectedStickerIds.length })}
        description={t("sticker.deleteConfirmHint")}
        confirmLabel={t("common.delete")}
        busy={stickerSaving}
        danger
        onClose={() => {
          if (!stickerSaving) setStickerDeleteConfirmOpen(false);
        }}
        onConfirm={() => void deleteSelectedStickers()}
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
              {t("common.cancel")}
            </button>
            <div className="sheet-toolbar-title">
              <strong>
                {selectedChat?.type === "group"
                  ? chatMemberPickerMode === "remove"
                    ? t("chat.removeGroupMembers")
                    : t("chat.addGroupMembers")
                  : t("chat.createGroup")}
              </strong>
            </div>
            <button
              className={`button sheet-toolbar-button ${chatMemberPickerMode === "remove" ? "danger-button" : ""}`}
              disabled={groupManageState === "saving" || !chatMemberActionIds.length}
              onClick={() => void submitChatMemberPicker()}
              type="button"
            >
              {groupManageState === "saving"
                ? t("common.processing")
                : selectedChat?.type === "group"
                  ? chatMemberPickerMode === "remove"
                    ? t("admin.remove")
                    : t("common.add")
                  : t("common.create")}
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
              placeholder={t("friends.search")}
              value={groupQuery}
              onChange={(event) => setGroupQuery(event.target.value)}
            />
          </label>
          <div className="simple-list">
            {groupCandidates.map((user) => {
              const selected = groupSelectedIds.includes(user.user_id);
              const locked = chatMemberLockedIds.includes(user.user_id);
              const protectedMember = selectedChat?.detail.members.find((member) => member.userId === user.user_id);
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
                    <div className="row-subtle">
                      {chatMemberPickerMode === "remove"
                        ? protectedMember?.isOwner
                          ? t("chat.owner")
                          : protectedMember?.isSelf
                            ? t("account.current")
                            : t("chat.groupMember")
                        : locked
                          ? t("chat.alreadyInConversation")
                          : user.is_alive
                            ? t("presence.online")
                            : t("presence.offline")}
                    </div>
                  </div>
                  {locked ? (
                    <span className="member-picker-status member-picker-status-locked">
                      {chatMemberPickerMode === "remove" ? t("chat.cannotRemove") : t("chat.alreadyInGroup")}
                    </span>
                  ) : (
                    <span className={`member-picker-check ${selected ? "is-selected" : ""}`} aria-hidden="true" />
                  )}
                </button>
              );
            })}
          </div>
        </div>
      </BottomSheet>
      <input
        ref={galleryInputRef}
        accept={canSendVideo ? "image/*,video/*" : "image/*"}
        hidden
        multiple
        onChange={(event) => void handleMediaSelection(event, "gallery")}
        type="file"
      />
      <BottomSheet onClose={() => setFileSourceSheetOpen(false)} open={fileSourceSheetOpen} title={t("cloudResources.fileSourceTitle")}>
        <div className="file-source-choice">
          <button onClick={() => { setFileSourceSheetOpen(false); setCloudFilePickerOpen(true); }} type="button">
            <span className="material-symbols-outlined">cloud</span><strong>{t("cloudResources.chooseCloud")}</strong>
          </button>
          <button onClick={() => { setFileSourceSheetOpen(false); fileInputRef.current?.click(); }} type="button">
            <span className="material-symbols-outlined">upload_file</span><strong>{t("cloudResources.chooseLocal")}</strong>
          </button>
        </div>
      </BottomSheet>
      <CloudFilePickerSheet onClose={() => setCloudFilePickerOpen(false)} onSelect={sendCloudFileMessage} open={cloudFilePickerOpen} />
      <input
        ref={fileInputRef}
        hidden
        multiple
        onChange={(event) => void handleMediaSelection(event, "file")}
        type="file"
      />
      <input
        ref={stickerInputRef}
        accept="image/jpeg,image/png,image/gif,image/webp"
        hidden
        onChange={(event) => {
          const file = event.currentTarget.files?.[0];
          if (file) void addStickerFromFile(file);
        }}
        type="file"
      />
      {imagePreview ? (
        <ImageLightbox
          details={imagePreview.metadata.map((metadata, index) => <MediaMetadataPanel key={`metadata:${imagePreview.uris[index]}`} kind="image" metadata={metadata} />)}
          downloadLabels={imagePreview.metadata.map((metadata) => formatImageFileSize(metadata?.file_size))}
          index={imagePreview.index}
          onClose={() => setImagePreview(null)}
          onIndexChange={(index) => setImagePreview((current) => current ? { ...current, index } : current)}
          uris={imagePreview.uris}
        />
      ) : null}
      {videoPreview ? (
        <MediaLightbox
          index={0}
          items={[{
            uri: videoPreview.uri,
            kind: "video",
            width: videoPreview.metadata?.pixel_width,
            height: videoPreview.metadata?.pixel_height,
            detail: <MediaMetadataPanel kind="video" metadata={videoPreview.metadata} />,
            downloadLabel: formatImageFileSize(videoPreview.metadata?.file_size),
          }]}
          onClose={() => setVideoPreview(null)}
          onIndexChange={() => undefined}
        />
      ) : null}
      {locationDraft ? (
        <div
          className="dialog-backdrop location-share-backdrop"
          onClick={() => {
            if (locationDraft.phase !== "sending") setLocationDraft(null);
          }}
          role="presentation"
        >
          <section
            aria-labelledby="location-share-title"
            aria-modal="true"
            className="location-share-modal"
            onClick={(event) => event.stopPropagation()}
            role="dialog"
          >
            <div className="location-share-preview" aria-hidden="true">
              <span className="message-location-road road-one" />
              <span className="message-location-road road-two" />
              <span className="location-share-pin"><ComposerSvgIcon kind="location" /></span>
            </div>
            <div className="location-share-copy">
              <span className="location-share-eyebrow">{t("location.current")}</span>
              <h2 id="location-share-title">
                {locationDraft.phase === "locating"
                  ? t("location.locating")
                  : locationDraft.phase === "error"
                    ? t("location.unavailable")
                    : t("location.sendThis")}
              </h2>
              {locationDraft.phase === "ready" || locationDraft.phase === "sending" ? (
                <p>{locationDraft.obscure ? t("location.exactNotStored") : `${locationDraft.latitude?.toFixed(5)}, ${locationDraft.longitude?.toFixed(5)}`}</p>
              ) : (
                <p>{locationDraft.error || t("common.pleaseWait")}</p>
              )}
            </div>
            {locationDraft.phase === "ready" || locationDraft.phase === "sending" ? (
              <div className="location-share-privacy">
                <div>
                  <strong>{t("location.approximate")}</strong>
                  <span>{t("location.randomOffset", { distance: 50 })}</span>
                </div>
                <button
                  aria-label={t("location.toggleApproximate")}
                  className={`switch ${locationDraft.obscure ? "active" : ""}`}
                  disabled={locationDraft.phase === "sending"}
                  onClick={() => setLocationDraft((current) => current ? { ...current, obscure: !current.obscure } : current)}
                  type="button"
                />
              </div>
            ) : null}
            <div className="location-share-actions">
              <button className="ghost-button" disabled={locationDraft.phase === "sending"} onClick={() => setLocationDraft(null)} type="button">{t("common.cancel")}</button>
              {locationDraft.phase === "error" ? (
                <button className="button" onClick={openLocationPicker} type="button">{t("common.retry")}</button>
              ) : (
                <button className="button" disabled={locationDraft.phase !== "ready"} onClick={() => void sendLocationMessage()} type="button">
                  {locationDraft.phase === "sending" ? t("common.sendingPlain") : t("message.sendLocation")}
                </button>
              )}
            </div>
          </section>
        </div>
      ) : null}
      <TravelMapDrawer
        open={travelMapOpen}
        otherUser={travelMapOtherUser}
        onClose={() => setTravelMapOpen(false)}
      />
      <TravelMapDrawer
        chatId={selectedChat?.id}
        chatTitle={selectedChat?.title}
        chatType={selectedChat?.type}
        open={chatTravelMapOpen}
        onClose={() => setChatTravelMapOpen(false)}
      />
      <TravelMapDrawer
        focusLocation={locationMessagePreview?.location}
        focusOwner={locationMessagePreview?.owner}
        open={Boolean(locationMessagePreview)}
        onClose={() => setLocationMessagePreview(null)}
      />
      <ConfirmDialog
        open={chatTravelMapGrantConfirmOpen}
        title={t("travelMap.chatGrantTitle")}
        description={selectedChat?.type === "group" ? t("travelMap.chatGrantGroupHint") : t("travelMap.chatGrantDirectHint")}
        confirmLabel={t("travelMap.authorize")}
        busy={travelMapSaving}
        onClose={() => setChatTravelMapGrantConfirmOpen(false)}
        onConfirm={() => void grantChatTravelMap()}
      />
      <BottomSheet
        open={chatTravelMapMenuOpen}
        title={t("travelMap.sharedFootprints")}
        onClose={() => setChatTravelMapMenuOpen(false)}
      >
        <div className="travel-map-access-actions">
          <div className="travel-map-access-person">
            <span>
              <strong>{t("travelMap.sharedMemberCount", { count: chatTravelMapAccess?.shared_members.length ?? 0 })}</strong>
              <small>{selectedChat?.title}</small>
            </span>
          </div>
          <button className="button" onClick={() => { setChatTravelMapMenuOpen(false); setChatTravelMapOpen(true); }} type="button">
            <ComposerSvgIcon kind="map" />
            {t("travelMap.openMap")}
          </button>
          <button className="ghost-button danger-text-button" disabled={travelMapSaving} onClick={() => void revokeChatTravelMap()} type="button">
            {t("travelMap.stopSharing")}
          </button>
        </div>
      </BottomSheet>
      <BottomSheet
        open={Boolean(travelMapMenu)}
        title={t("travelMap.accessMenuTitle")}
        description={t("travelMap.accessMenuHint")}
        onClose={() => setTravelMapMenu(null)}
      >
        <div className="travel-map-access-actions">
          <div className="travel-map-access-person">
            <UserAvatar className="mini-avatar" name={travelMapMenu?.user.name ?? ""} uri={travelMapMenu?.user.avatar_uri} />
            <span>
              <strong>{travelMapMenu?.user.name}</strong>
              <small>{travelMapMenu?.access.can_view_theirs ? t("travelMap.messageReady") : t("travelMap.waitingForReply")}</small>
            </span>
          </div>
          <button className="button" disabled={!travelMapMenu?.access.can_view_theirs} onClick={openSharedTravelMap} type="button">
            <ComposerSvgIcon kind="map" />
            {t("travelMap.openMap")}
          </button>
          {travelMapMenu?.access.they_can_view_mine ? (
            <button className="ghost-button danger-text-button" onClick={() => setTravelMapRevokeConfirmOpen(true)} type="button">
              {t("travelMap.stopSharing")}
            </button>
          ) : null}
        </div>
      </BottomSheet>
      <ConfirmDialog
        open={travelMapRevokeConfirmOpen}
        title={t("travelMap.stopSharingTitle")}
        description={t("travelMap.stopSharingHint")}
        confirmLabel={t("travelMap.stopSharing")}
        busy={travelMapSaving}
        danger
        onClose={() => setTravelMapRevokeConfirmOpen(false)}
        onConfirm={() => void revokeTravelMapAccess()}
      />
      {messageMenu && !messageMenu.confirmDelete ? (
        <div className="message-context-layer" onClick={closeMessageMenu} role="presentation">
          <div
            ref={messageMenuRef}
            className={`message-context-menu ${messageMenu.placement === "bottom" ? "below" : "above"}`}
            onClick={(event) => event.stopPropagation()}
            style={{
              left: messageMenu.anchorX,
              top: messageMenu.anchorY,
            }}
          >
            <div className="message-context-actions">
                {messageMenu.message.kind === "sticker" && !ownsStickerMessage(messageMenu.message) ? (
                  <button className="message-context-button" disabled={stickerSaving} onClick={() => void collectStickerMessage()} type="button">
                    <span className="material-symbols-outlined" aria-hidden="true">add_reaction</span>
                    {t("sticker.addShort")}
                  </button>
                ) : null}
                <button className="message-context-button" onClick={() => startReply(messageMenu.message)} type="button">
                  <span className="material-symbols-outlined" aria-hidden="true">reply</span>
                  {t("message.reply")}
                </button>
                {canForwardMessage(messageMenu.message) ? (
                  <button className="message-context-button" onClick={() => openSingleMessageForwardPicker(messageMenu.message)} type="button">
                    <span className="material-symbols-outlined" aria-hidden="true">forward</span>
                    {t("message.forward")}
                  </button>
                ) : null}
                {messageMenu.message.kind !== "sticker" && typeof messageMenu.message.id === "number" && canManagePinnedMessages ? (
                  <button
                    className="message-context-button"
                    disabled={pinSavingMessageId === messageMenu.message.id}
                    onClick={() => void togglePinnedMessage(messageMenu.message)}
                    type="button"
                  >
                    <ComposerSvgIcon className="message-context-action-icon" kind={pinnedMessages.some((pin) =>
                      pin.message.message_id === messageMenu.message.id
                      && pin.pinned_by_users.some((user) => user.user_id === currentUserId)
                    ) ? "pin-off" : "pin"} />
                    {pinnedMessages.some((pin) =>
                      pin.message.message_id === messageMenu.message.id
                      && pin.pinned_by_users.some((user) => user.user_id === currentUserId)
                    ) ? t("pin.remove") : t("pin.label")}
                  </button>
                ) : null}
                {messageMenu.message.kind === "text" ? (
                  <button className="message-context-button" onClick={() => void copyMessageText()} type="button">
                    <span className="material-symbols-outlined" aria-hidden="true">content_copy</span>
                    {t("common.copy")}
                  </button>
                ) : null}
                {(["image", "file"].includes(messageMenu.message.kind) || (messageMenu.message.kind === "audio" && canDownloadAudio)) ? (
                  <button
                    className="message-context-button"
                    onClick={() => {
                      if (messageMenu.message.kind === "audio") void discoverFeature("capability.audio_download");
                      void downloadMessageAttachment();
                    }}
                    type="button"
                  >
                    <span className="material-symbols-outlined" aria-hidden="true">download</span>
                    {t("common.download")}
                    {messageMenu.message.kind === "audio" ? <FeatureDiscoveryMarker rewardId="capability.audio_download" /> : null}
                  </button>
                ) : null}
                {canCreateSticker && messageMenu.message.kind === "image" && typeof messageMenu.message.id === "number" ? (
                  <button className="message-context-button" onClick={() => void collectImageAsSticker()} type="button">
                    <span className="material-symbols-outlined" aria-hidden="true">add_reaction</span>
                    {t("sticker.collect")}
                  </button>
                ) : null}
                <button className="message-context-button" onClick={() => startMessageSelection(messageMenu.message)} type="button">
                  <span className="material-symbols-outlined" aria-hidden="true">checklist</span>
                  {t("message.multiSelect")}
                </button>
                {canRecallMessage(messageMenu.message) ? (
                  <button className="message-context-button recall" disabled={messageDeleteState === "deleting"} onClick={() => void deleteMessage("everyone")} type="button">
                    <span className="material-symbols-outlined" aria-hidden="true">undo</span>
                    {t("message.recallForEveryone")}
                  </button>
                ) : null}
                {(typeof messageMenu.message.id === "number" || (messageMenu.message.from === "self" && messageMenu.message.kind === "image")) ? (
                  <button
                    className="message-context-button danger"
                    onClick={() => setMessageMenu((current) => (current ? { ...current, confirmDelete: true } : current))}
                    type="button"
                  >
                    <span className="material-symbols-outlined" aria-hidden="true">delete</span>
                    {t("common.delete")}
                  </button>
                ) : null}
            </div>
          </div>
        </div>
      ) : null}
      <ConfirmDialog
        open={Boolean(messageMenu?.confirmDelete)}
        title={t("message.deleteConfirmTitle")}
        description={t("message.deleteConfirmHint")}
        confirmLabel={t("common.delete")}
        busy={messageDeleteState === "deleting"}
        danger
        onClose={() => setMessageMenu((current) => (current ? { ...current, confirmDelete: false } : current))}
        onConfirm={() => void deleteMessage("me")}
      />
      <AsyncErrorDialog message={pageError ?? ""} onClose={() => setPageError(null)} open={Boolean(pageError)} />
    </AppChrome>
  );
}

export interface ChatsPagePreviewConfig {
  avatarName: string;
  avatarUri?: string;
  bubbleStyle: ChatBubbleStyle;
  backgroundTheme?: ChatBackgroundTheme;
  backgroundUri?: string;
  dialogue?: Array<{
    from: "self" | "other";
    text: string;
    kind?: "text" | "location";
    latitude?: number;
    longitude?: number;
  }>;
  demo?: {
    kind: ChatPreviewDemoKind;
    side: ChatPreviewDemoSide;
    grouped: boolean;
  };
  selfOnly?: boolean;
}

export type ChatPreviewDemoKind = "all" | "text" | "image" | "video" | "gallery" | "audio" | "file" | "location" | "map_access" | "statement" | "forward_bundle" | "activity" | "link";
export type ChatPreviewDemoSide = "other" | "both" | "self";

const CHAT_PREVIEW_IMAGE = chatPreviewMediaImage;

function previewMessage(kind: MessageKind | "link", from: "self" | "other", index: number, config: ChatsPagePreviewConfig): ChatMessage {
  const now = 1785686400 + index;
  const base: ChatMessage = {
    id: `preview-${from}-${kind}-${index}`,
    clientId: `preview-${from}-${kind}-${index}`,
    userId: from === "self" ? 1 : 2,
    from,
    type: MESSAGE_TYPE_TEXT,
    kind: kind === "link" ? "text" : kind,
    name: from === "self" ? i18n.t("common.me") : config.avatarName,
    avatarUri: from === "other" ? config.avatarUri : undefined,
    chatBubbleStyle: config.bubbleStyle,
    time: "11:38",
    createdAt: now,
    text: from === "self" ? i18n.t("menu.bubblePreviewSelf") : i18n.t("menu.bubblePreviewOther"),
    status: index === 15 ? "pending" : "sent",
  };
  if (kind === "image") return { ...base, type: MESSAGE_TYPE_IMAGE, payload: { kind, uri: CHAT_PREVIEW_IMAGE, thumbnail_uri: CHAT_PREVIEW_IMAGE, image_metadata: { status: 1, pixel_width: 640, pixel_height: 420 } } };
  if (kind === "video") return { ...base, type: MESSAGE_TYPE_VIDEO, payload: { kind, uri: "preview://video", thumbnail_uri: CHAT_PREVIEW_IMAGE, duration_seconds: 28, video_metadata: { status: 1, duration_seconds: 28, pixel_width: 640, pixel_height: 420 } } };
  if (kind === "audio") return { ...base, type: MESSAGE_TYPE_AUDIO, payload: { kind, uri: "data:audio/wav;base64,UklGRgQAAABXQVZF", duration_seconds: 12 } };
  if (kind === "file") return { ...base, type: MESSAGE_TYPE_FILE, payload: { kind, uri: "data:text/plain,preview", file_name: i18n.t("menu.bubblePreviewFile"), file_size: 2516582 } };
  if (kind === "location") return { ...base, type: MESSAGE_TYPE_LOCATION, payload: { kind, latitude: 24.4798, longitude: 118.0894, address: i18n.t("menu.bubblePreviewLocation") } };
  if (kind === "map_access") return { ...base, type: MESSAGE_TYPE_MAP_ACCESS, payload: { kind, text: i18n.t("travelMap.messageJoin"), owner: { user_id: 2, name: config.avatarName }, access: { can_view_theirs: true, they_can_view_mine: true } } };
  if (kind === "statement") return { ...base, type: MESSAGE_TYPE_STATEMENT, payload: { kind, statement_id: 1, statement: { statement_id: 1, user: { user_id: 2, name: config.avatarName, avatar_uri: config.avatarUri }, text: i18n.t("menu.bubblePreviewStatement"), visibility: "public", media: [{ media_id: 1, kind: "image", uri: CHAT_PREVIEW_IMAGE, thumbnail_uri: CHAT_PREVIEW_IMAGE }], comment_count: 8, like_count: 26, liked: false, can_delete: false, created_at: now } } };
  if (kind === "forward_bundle") return {
    ...base,
    type: MESSAGE_TYPE_FORWARD_BUNDLE,
    payload: {
      kind,
      item_count: 6,
      summary: i18n.t("menu.previewForwardSummary"),
      items: [{ position: 0, type: MESSAGE_TYPE_TEXT, author: { user_id: 2, name: config.avatarName, avatar_uri: config.avatarUri }, content: i18n.t("menu.bubblePreviewOther"), payload: { kind: "text", text: i18n.t("menu.bubblePreviewOther") }, sent_at: now }],
    },
  };
  if (kind === "activity") return {
    ...base,
    type: MESSAGE_TYPE_ACTIVITY,
    payload: {
      kind,
      activity_key: "baxian-juli-2026",
      title: i18n.t("menu.previewActivityTitle"),
      activity: {
        key: "baxian-juli-2026",
        title: i18n.t("menu.previewActivityTitle"),
        title_en: "Eight Immortals Rally",
        summary: "",
        summary_en: "",
        starts_at: now - 86400,
        ends_at: now + 86400,
        active: true,
        verified: true,
        today_earned: false,
        claimable_points: 0,
        available_points: 0,
        contributed_points: 0,
        personal_event_count: 1,
        personal_event_target: 2,
        personal_reward_claimable: false,
        personal_reward: null,
        official_user: null,
        space_total: 8,
        target: 16,
        milestones: [],
        awakenings: [],
      },
    },
  };
  if (kind === "link") {
    return {
      ...base,
      kind: "text",
      payload: {
        kind: "text",
        text: "https://sermo.jyonn.space",
        link_preview: {
          status: "ready",
          url: "https://sermo.jyonn.space",
          site_name: "SERMO",
          title: i18n.t("menu.bubblePreviewLink"),
          description: i18n.t("menu.bubblePreviewLinkHint"),
          image_url: CHAT_PREVIEW_IMAGE,
        },
      },
    };
  }
  return base;
}

const CHAT_PREVIEW_ALL_KINDS: Array<Exclude<ChatPreviewDemoKind, "all">> = ["text", "image", "video", "gallery", "audio", "file", "location", "map_access", "statement", "forward_bundle", "activity", "link"];

function previewMessagesForDemo(kind: ChatPreviewDemoKind, from: "self" | "other", startIndex: number, grouped: boolean, config: ChatsPagePreviewConfig) {
  const kinds: Array<Exclude<ChatPreviewDemoKind, "all">> = kind === "all" ? CHAT_PREVIEW_ALL_KINDS : [kind];
  const messages: ChatMessage[] = [];
  let index = startIndex;
  kinds.forEach((currentKind) => {
    if (currentKind === "gallery") {
      const galleryCount = grouped ? 4 : 3;
      for (let offset = 0; offset < galleryCount; offset += 1) {
        messages.push(previewMessage("image", from, index, config));
        index += 1;
      }
      return;
    }
    const repeats = grouped && kind !== "all" ? 3 : 1;
    for (let offset = 0; offset < repeats; offset += 1) {
      const message = previewMessage(currentKind, from, index, config);
      messages.push(currentKind === "text" && repeats > 1
        ? { ...message, text: i18n.t(`menu.previewMergedText${offset + 1}` as TranslationKey) }
        : message);
      index += 1;
    }
  });
  return messages;
}

function previewDemoGroups(config: ChatsPagePreviewConfig, t: ReturnType<typeof useI18n>["t"]): MessageGroup[] {
  const demo = config.demo;
  if (!demo) return [];
  const sides: Array<"self" | "other"> = demo.side === "both" ? ["other", "self"] : [demo.side];
  if (demo.kind === "all" && !demo.grouped) {
    return CHAT_PREVIEW_ALL_KINDS.map((kind, index) => {
      const from = sides[index % sides.length];
      return {
        key: `preview-demo-${kind}-${from}-${index}`,
        from,
        name: from === "self" ? t("common.me") : config.avatarName,
        avatarUri: from === "other" ? config.avatarUri : undefined,
        chatBubbleStyle: config.bubbleStyle,
        messages: previewMessagesForDemo(kind, from, index * 10, false, config),
      };
    });
  }
  return sides.map((from, index) => ({
    key: `preview-demo-${demo.kind}-${from}`,
    from,
    name: from === "self" ? t("common.me") : config.avatarName,
    avatarUri: from === "other" ? config.avatarUri : undefined,
    chatBubbleStyle: config.bubbleStyle,
    messages: previewMessagesForDemo(demo.kind, from, index * 100, demo.grouped, config),
  }));
}

function PreviewChatConversation({ config }: { config: ChatsPagePreviewConfig }) {
  const { t } = useI18n();
  if (config.selfOnly) {
    const demoGroups = previewDemoGroups(config, t);
    const dialogue = config.dialogue?.length ? config.dialogue : [{ from: "self" as const, text: t("menu.bubblePreviewSelf") }];
    const groups = demoGroups.length ? demoGroups : dialogue.reduce<MessageGroup[]>((result, item, index) => {
      const kind = item.kind ?? "text";
      const preview = previewMessage(kind, item.from, index + 1, config);
      const message: ChatMessage = kind === "location"
        ? { ...preview, payload: { ...preview.payload, kind: "location", latitude: item.latitude ?? 24.4798, longitude: item.longitude ?? 118.0894, address: item.text } }
        : { ...preview, text: item.text };
      const previous = result[result.length - 1];
      if (previous?.from === item.from) {
        previous.messages.push(message);
        return result;
      }
      result.push({
        key: `preview-dialogue-${index}`,
        from: item.from,
        name: item.from === "self" ? t("common.me") : config.avatarName,
        avatarUri: item.from === "other" ? config.avatarUri : undefined,
        chatBubbleStyle: config.bubbleStyle,
        messages: [message],
      });
      return result;
    }, []);
    const noop = () => undefined;
    const previewBackgroundStyle = config.backgroundTheme === "custom" && config.backgroundUri
      ? ({ "--chat-background-image": `url("${config.backgroundUri.replace(/\"/g, "%22")}")` } as CSSProperties)
      : undefined;
    return (
      <section
        aria-label={t("menu.chatBubble")}
        className={`chat-conversation-panel chat-conversation-preview${groups.length === 1 ? " is-single-message" : ""}`}
        onClickCapture={(event) => {
          event.preventDefault();
          event.stopPropagation();
        }}
        onContextMenu={(event) => event.preventDefault()}
      >
        <div className={`chat-detail-scene chat-background-${config.backgroundTheme ?? "default"}`} style={previewBackgroundStyle}>
          <div className="message-scroll">
            {groups.map((group) => <MessageGroupBlock enteringMessageIds={[]} group={group} key={group.key} onOpenActions={noop} onOpenImage={noop} onOpenVideo={noop} onRetry={noop} onToggleGroupSelection={noop} onToggleSelection={noop} selectedClientIds={[]} selectionMode={false} showAuthor={false} />)}
          </div>
        </div>
      </section>
    );
  }
  const kinds: MessageKind[] = ["text", "image", "audio", "video", "file", "location", "map_access", "statement", "text"];
  const groups = kinds.flatMap((kind, kindIndex) => (["other", "self"] as const).map((from, sideIndex): MessageGroup => {
    const index = kindIndex * 2 + sideIndex;
    return {
      key: `preview-group-${index}`,
      from,
      name: from === "self" ? t("common.me") : config.avatarName,
      avatarUri: from === "other" ? config.avatarUri : undefined,
      chatBubbleStyle: config.bubbleStyle,
      dividerLabel: index === 0 ? t("menu.bubblePreviewToday") : undefined,
      messages: [previewMessage(kind, from, index, config)],
    };
  }));
  const noop = () => undefined;

  return (
    <section
      aria-label={t("menu.chatBubble")}
      className="chat-conversation-panel chat-conversation-preview"
      onClickCapture={(event) => {
        if ((event.target as HTMLElement).closest(".message-scroll")) event.preventDefault();
      }}
      onContextMenu={(event) => event.preventDefault()}
    >
      <div className="chat-detail-scene chat-background-default">
        <div className="message-scroll">
          {groups.map((group, index) => (
            <MessageGroupBlock
              enteringMessageIds={index === 0 ? [group.messages[0].clientId] : []}
              group={group}
              key={group.key}
              onOpenActions={noop}
              onOpenImage={noop}
              onOpenVideo={noop}
              onRetry={noop}
              onToggleGroupSelection={noop}
              onToggleSelection={noop}
              selectedClientIds={[]}
              selectionMode={false}
              showAuthor={false}
            />
          ))}
        </div>
      </div>
    </section>
  );
}

export function ChatPreview({
  className = "",
  firstPersonUserId,
  messages,
  onMessageClick,
  showAuthors = true,
}: {
  className?: string;
  firstPersonUserId?: number | null;
  messages: ChatMessageDTO[];
  onMessageClick?: (message: ChatMessageDTO) => void;
  showAuthors?: boolean;
}) {
  const dtoById = useMemo(() => new Map(messages.map((message) => [message.message_id, message])), [messages]);
  const mappedMessages = useMemo(
    () => sortMessages(messages.map((message) => mapChatMessage(message, firstPersonUserId ?? -1))),
    [firstPersonUserId, messages],
  );
  const groups = useMemo(() => buildMessageGroups(mappedMessages), [mappedMessages]);
  const noop = () => undefined;
  const openMessage = (message: ChatMessage) => {
    if (typeof message.id !== "number") return;
    const source = dtoById.get(message.id);
    if (source) onMessageClick?.(source);
  };

  return (
    <section
      className={`chat-conversation-panel chat-conversation-preview chat-preview-shared ${className}`.trim()}
      onClickCapture={onMessageClick ? (event) => {
        const messageNode = (event.target as HTMLElement).closest<HTMLElement>("[data-message-id]");
        const messageId = Number(messageNode?.dataset.messageId);
        const source = dtoById.get(messageId);
        if (source) onMessageClick(source);
      } : undefined}
    >
      <div className="chat-detail-scene chat-background-default">
        <div className="message-scroll">
          {groups.map((group) => (
            <MessageGroupBlock
              enteringMessageIds={[]}
              group={group}
              key={group.key}
              onOpenActions={(message) => openMessage(message)}
              onOpenImage={noop}
              onOpenVideo={noop}
              onRetry={noop}
              onToggleGroupSelection={noop}
              onToggleSelection={noop}
              selectedClientIds={[]}
              selectionMode={false}
              showAuthor={showAuthors && group.from === "other"}
              showSelfAvatar
            />
          ))}
        </div>
      </div>
    </section>
  );
}

export default function ChatsPage({ preview }: { preview?: ChatsPagePreviewConfig }) {
  if (preview) return <PreviewChatConversation config={preview} />;
  return <LiveChatsPage />;
}
