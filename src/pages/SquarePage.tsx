import { Fragment, useEffect, useMemo, useRef, useState, type CSSProperties, type MouseEvent as ReactMouseEvent } from "react";
import { useLocation, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { createPortal } from "react-dom";
import { AppChrome } from "../components/AppChrome";
import { BottomSheet } from "../components/BottomSheet";
import { ChatTargetPicker } from "../components/ChatTargetPicker";
import { ContentLoader, QuietState } from "../components/BoundaryState";
import { ConfirmDialog } from "../components/ConfirmDialog";
import { FeedbackState } from "../components/FeedbackState";
import { GrowthLevelBadge } from "../components/GrowthLevelBadge";
import { MediaLightbox } from "../components/ImageLightbox";
import { MediaMetadataPanel } from "../components/MediaMetadataPanel";
import { HeaderSyncIndicator } from "../components/HeaderSyncIndicator";
import { SideDrawer, drawerPathFromSearch } from "../components/SideDrawer";
import { TabPageHeader } from "../components/TabPageHeader";
import { TravelMapDrawer } from "../components/TravelMapDrawer";
import { UserAvatar } from "../components/UserAvatar";
import { UserProfilePanel } from "../components/UserProfilePanel";
import { api } from "../lib/api";
import { useAuth } from "../lib/auth";
import { useI18n, type TranslationKey } from "../lib/language";
import { toMessageUploadError, uploadMessageMediaWith } from "../lib/messageUpload";
import { formatRelativeTime } from "../lib/presentation";
import { buildTabCacheScope, readTabCache, writeTabCache } from "../lib/tabCache";
import { announceSquareUnread } from "../lib/squareNotifications";
import { useSpaceFeatures } from "../lib/spaceFeatures";
import { buildSpaceHrefForCurrentHost, getDetectedSpaceSlug } from "../lib/spaceEntry";
import { showToast } from "../lib/toast";
import type { ActivityCampaignDTO, ChatBackgroundTheme, ChatDTO, ImageMetadataDTO, NotificationEventDTO, PermanentVipCampaignDTO, SquareQuotaDTO, SquareStatementCommentDTO, SquareStatementDTO, SquareStatementDraftMedia, SquareStatusDTO, TinyUserDTO, VideoMetadataDTO } from "../types";
import ChatsPage, { ChatPreview, forwardBundleItemsAsMessages } from "./ChatsPage";
import baxianActivityLogo from "../assets/activity/baxian-logo-gold.png";
import baxianActivityTitle from "../assets/activity/title-baxian-juli.png";
import baxianActivityBanner from "../assets/activity/event-baxian-juli-banner.webp";
import tieguaiLi from "../assets/activity/immortals/tieguai-li.png";
import zhongliQuan from "../assets/activity/immortals/zhongli-quan.png";
import zhangGuolao from "../assets/activity/immortals/zhang-guolao.png";
import lvDongbin from "../assets/activity/immortals/lv-dongbin.png";
import heXiangu from "../assets/activity/immortals/he-xiangu.png";
import lanCaihe from "../assets/activity/immortals/lan-caihe.png";
import hanXiangzi from "../assets/activity/immortals/han-xiangzi.png";
import caoGuojiu from "../assets/activity/immortals/cao-guojiu.png";
import heXianguSealSheet from "../assets/baxian/he-xiangu-edge-sheet.webp";
import lvDongbinSealSheet from "../assets/baxian/lv-dongbin-edge-sheet.webp";
import zhongliQuanSealSheet from "../assets/baxian/zhongli-quan-edge-sheet.webp";

type SelectedPhoto = {
  id: string;
  file: File;
  preview: string;
};
type SelectedVideo = SelectedPhoto & { duration: number };
type SquareChatRecordDraft = {
  messageIds: number[];
  redacted: boolean;
};

const MAX_TEXT_LENGTH = 140;
type InlineTransitionPhase = "idle" | "preparing" | "opening" | "open" | "closing";
type InlineStatementOrigin = { left: number; top: number; width: number; height: number };
const MAX_PHOTOS = 9;
const MAX_AUDIO_SECONDS = 60;
const MAX_VIDEO_SECONDS = 60;
const MESSAGE_TYPE_STATEMENT = 8;
const MESSAGE_TYPE_ACTIVITY = 11;
const BAXIAN_IMMORTALS = [
  ["铁拐李", "Tieguai Li", tieguaiLi], ["钟离权", "Zhongli Quan", zhongliQuan],
  ["张果老", "Zhang Guolao", zhangGuolao], ["吕洞宾", "Lu Dongbin", lvDongbin],
  ["何仙姑", "He Xiangu", heXiangu], ["蓝采和", "Lan Caihe", lanCaihe],
  ["韩湘子", "Han Xiangzi", hanXiangzi], ["曹国舅", "Cao Guojiu", caoGuojiu],
] as const;
const BAXIAN_PRIZE_BUBBLES = [
  { style: "baxian-lv", label: "menu.styleBaxianLv", dialogue: [
    { from: "other", key: "activity.previewLvOther1" }, { from: "other", key: "activity.previewLvOther2" },
    { from: "self", key: "activity.previewLvSelf1" }, { from: "self", key: "activity.previewLvSelf2" },
    { from: "other", key: "activity.previewLvOther3" }, { from: "other", key: "activity.previewLvOther4" },
    { from: "other", key: "activity.locationPenglai", kind: "location", latitude: 37.8112, longitude: 120.7574 },
    { from: "self", key: "activity.previewLvSelf3" },
  ] },
  { style: "baxian-zhongli", label: "menu.styleBaxianZhongli", dialogue: [
    { from: "other", key: "activity.previewZhongliOther1" }, { from: "other", key: "activity.previewZhongliOther2" }, { from: "other", key: "activity.previewZhongliOther3" },
    { from: "self", key: "activity.previewZhongliSelf1" }, { from: "self", key: "activity.previewZhongliSelf2" },
    { from: "self", key: "activity.locationZhongnan", kind: "location", latitude: 33.9514, longitude: 108.8017 },
    { from: "other", key: "activity.previewZhongliOther4" }, { from: "other", key: "activity.previewZhongliOther5" },
  ] },
  { style: "baxian-he", label: "menu.styleBaxianHe", dialogue: [
    { from: "other", key: "activity.previewHeOther1" }, { from: "other", key: "activity.previewHeOther2" },
    { from: "self", key: "activity.previewHeSelf1" }, { from: "self", key: "activity.previewHeSelf2" },
    { from: "other", key: "activity.locationHeaven", kind: "location", latitude: 30.259, longitude: 120.138 },
    { from: "other", key: "activity.previewHeOther3" }, { from: "other", key: "activity.previewHeOther4" },
    { from: "self", key: "activity.previewHeSelf3" }, { from: "self", key: "activity.previewHeSelf4" },
  ] },
] as const;
const BAXIAN_SEAL_SHEETS = [lvDongbinSealSheet, zhongliQuanSealSheet, heXianguSealSheet] as const;

function ActivityForceProgress({ total, target }: { total: number; target: number }) {
  const progress = target > 0 ? Math.min(1, total / target) : 0;
  return <div className="activity-force-progress" role="progressbar" aria-valuemax={target} aria-valuemin={0} aria-valuenow={Math.min(total, target)}>
    <div className="activity-force-track"><i style={{ transform: `scaleX(${progress})` }} /></div>
    {[8, 16].map((threshold) => <div className={`activity-force-milestone${total >= threshold ? " is-reached" : ""}`} key={threshold} style={{ left: `${Math.min(1, threshold / Math.max(1, target)) * 100}%` }}>
      <span className="activity-force-seal-cycle" aria-hidden="true">
        {BAXIAN_SEAL_SHEETS.map((sheet, index) => <i key={sheet} style={{ "--seal-image": `url(${sheet})`, animationDelay: `${index * 1.2}s` } as CSSProperties} />)}
      </span>
      <b>{threshold}</b>
    </div>)}
  </div>;
}

function formatActivityDateRange(startsAt: number, endsAt: number, language: string) {
  const locale = language === "zh-CN" ? "zh-CN" : "en-US";
  const formatter = new Intl.DateTimeFormat(locale, { month: "short", day: "numeric" });
  return `${formatter.format(new Date(startsAt * 1000))} - ${formatter.format(new Date(endsAt * 1000))}`;
}

function SquareQuotaPanel({ loading, quota }: { loading: boolean; quota: SquareQuotaDTO | null }) {
  const { t } = useI18n();
  const levelDeckRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    if (!quota || quota.unlimited) return;
    const current = levelDeckRef.current?.querySelector<HTMLElement>(".is-current");
    requestAnimationFrame(() => current?.scrollIntoView({ behavior: "smooth", inline: "center", block: "nearest" }));
  }, [quota?.level, quota?.unlimited, quota?.vip]);
  if (loading && !quota) return <div className="square-quota-loading"><span className="material-symbols-outlined">progress_activity</span></div>;
  if (!quota) return <FeedbackState title={t("square.quotaLoadFailed")} />;
  const remaining = (used: number, limit: number | null) => limit === null ? null : Math.max(0, limit - used);
  const statementRemaining = remaining(quota.statements.daily_used, quota.statements.daily_limit);
  const commentRemaining = remaining(quota.comments.daily_used, quota.comments.daily_limit);
  const quotaCards = [
    { key: "statement", icon: "edit_square", label: t("square.quotaStatements"), used: quota.statements.daily_used, limit: quota.statements.daily_limit, weeklyUsed: quota.statements.weekly_used, weeklyLimit: quota.statements.weekly_limit, remaining: statementRemaining },
    { key: "comment", icon: "forum", label: t("square.quotaComments"), used: quota.comments.daily_used, limit: quota.comments.daily_limit, weeklyUsed: quota.comments.weekly_used, weeklyLimit: quota.comments.weekly_limit, remaining: commentRemaining },
  ];
  const levels = [
    { range: "1–5", min: 1, max: 5, daily: 1, weekly: 5, formats: [["notes", "square.text"], ["image", "square.photo"]] },
    { range: "6–9", min: 6, max: 9, daily: 2, weekly: 10, formats: [["notes", "square.text"], ["image", "square.photo"], ["mic", "square.voice"]] },
    { range: "10–13", min: 10, max: 13, daily: 3, weekly: 15, formats: [["notes", "square.text"], ["image", "square.photo"], ["mic", "square.voice"], ["videocam", "square.video"]] },
    { range: "14–17", min: 14, max: 17, daily: 4, weekly: 20, formats: [["notes", "square.text"], ["image", "square.photo"], ["mic", "square.voice"], ["videocam", "square.video"]] },
    { range: "18", min: 18, max: 18, daily: 5, weekly: 35, formats: [["notes", "square.text"], ["image", "square.photo"], ["mic", "square.voice"], ["videocam", "square.video"]] },
  ] as const;
  return <div className="square-quota-panel">
    <section className={`square-quota-hero${quota.verified ? "" : " is-locked"}`}>
      <div><span>{quota.unlimited ? t("square.quotaOfficial") : quota.vip ? "VIP" : `LV${quota.level}`}</span><strong>{!quota.verified ? t("square.quotaVerifyFirst") : quota.unlimited ? t("square.quotaUnlimited") : t("square.quotaHero", { count: statementRemaining ?? 0 })}</strong></div>
      <span className="material-symbols-outlined">{quota.verified ? "data_usage" : "lock"}</span>
    </section>
    <div className="square-quota-track">
      {quotaCards.map((item) => {
        const ratio = item.limit === null ? 0 : Math.min(1, item.used / Math.max(1, item.limit));
        return <article className={item.remaining === 0 ? "is-exhausted" : ""} key={item.key}>
          <span className="material-symbols-outlined square-quota-track-icon">{item.icon}</span>
          <div className="square-quota-track-copy"><strong>{item.label}</strong><small>{t("square.quota24Hours")} {item.used}/{item.limit ?? "∞"} · {t("square.quota7Days")} {item.weeklyUsed}/{item.weeklyLimit ?? "∞"}</small></div>
          <b>{item.limit === null ? t("square.quotaUnlimitedShort") : t("square.quotaRemaining", { count: item.remaining ?? 0 })}</b>
          <div className="square-quota-meter"><i style={{ transform: `scaleX(${ratio})` }} /></div>
        </article>;
      })}
      {quota.statements.anonymous_available && quota.statements.anonymous_weekly_limit !== null ? <article className="square-quota-anonymous-card">
        <span className="material-symbols-outlined square-quota-track-icon">visibility_off</span>
        <div className="square-quota-track-copy"><strong>{t("square.quotaAnonymous")}</strong><small>{t("square.quotaAnonymousWeekly", { used: quota.statements.anonymous_weekly_used, limit: quota.statements.anonymous_weekly_limit })} · {t("square.exploreOnly")}</small></div>
        <b>{t("square.quotaRemaining", { count: Math.max(0, quota.statements.anonymous_weekly_limit - quota.statements.anonymous_weekly_used) })}</b>
        <div className="square-quota-meter"><i style={{ transform: `scaleX(${Math.min(1, quota.statements.anonymous_weekly_used / Math.max(1, quota.statements.anonymous_weekly_limit))})` }} /></div>
      </article> : null}
      <article className="square-quota-like-card"><span className="material-symbols-outlined square-quota-track-icon">favorite</span><div className="square-quota-track-copy"><strong>{t("square.quotaLikes")}</strong><small>{t("square.quotaLikesToday", { count: quota.likes.daily_used })}</small></div><b>{t("square.quotaUnlimitedShort")}</b></article>
    </div>
    {!quota.unlimited ? <section className="square-quota-levels">
      <header><strong>{t("square.quotaLevelBenefits")}</strong><span>{t("square.quotaSwipeLevels")}</span></header>
      <div className="square-quota-level-deck" ref={levelDeckRef}>{levels.map((row, index) => {
        const current = quota.vip ? index === levels.length - 1 : quota.level >= row.min && quota.level <= row.max;
        return <article className={current ? "is-current" : ""} key={row.range}>
          <div className="square-quota-level-title"><span>LV</span><strong>{row.range}</strong>{row.min === 18 ? <em>VIP</em> : null}{current ? <b>{t("square.quotaCurrent")}</b> : null}</div>
          <div className="square-quota-level-metrics"><span><small>{t("square.quota24Hours")}</small><strong>{row.daily}</strong></span><span><small>{t("square.quota7Days")}</small><strong>{row.weekly}</strong></span></div>
          <div className="square-quota-level-formats">{row.formats.map(([icon, key]) => <span key={key}><i className="material-symbols-outlined">{icon}</i>{t(key)}</span>)}</div>
        </article>;
      })}</div>
    </section> : null}
  </div>;
}

function formatStatementTime(timestamp: number, language: string) {
  return new Intl.DateTimeFormat(language === "zh-CN" ? "zh-CN" : "en", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(timestamp * 1000));
}

function formatImageFileSize(fileSize?: number | null) {
  if (fileSize == null) return "";
  if (fileSize >= 1024 * 1024) return `${(fileSize / (1024 * 1024)).toFixed(1)} MB`;
  return `${Math.max(1, Math.round(fileSize / 1024))} KB`;
}

function shareChatPeer(chat: ChatDTO, currentUserId?: number) {
  return chat.members.find((member) => member.user_id !== currentUserId) ?? chat.members[0] ?? null;
}

function shareChatTitle(chat: ChatDTO, currentUserId?: number) {
  return chat.title || shareChatPeer(chat, currentUserId)?.name || "Sermo";
}

function StatementCard({ statement, canInteract, cardRef, chatBackgroundTheme, chatBackgroundUri, detail = false, onDelete, onLike, onMute, onOpen, onOpenChatImage, onOpenChatVideo, onOpenImage, onOpenLocation, onOpenProfile, onOpenVideo, onPin, onShare }: {
  statement: SquareStatementDTO;
  canInteract: boolean;
  cardRef?: (node: HTMLElement | null) => void;
  detail?: boolean;
  chatBackgroundTheme?: ChatBackgroundTheme;
  chatBackgroundUri?: string;
  onDelete: () => void;
  onLike: () => void;
  onMute: () => void;
  onOpen: () => void;
  onOpenImage: (index: number) => void;
  onOpenChatImage: (uris: string[], index: number, metadata?: Array<ImageMetadataDTO | null>) => void;
  onOpenChatVideo: (uri: string, metadata: VideoMetadataDTO | null) => void;
  onOpenLocation: () => void;
  onOpenProfile: () => void;
  onOpenVideo: () => void;
  onPin: () => void;
  onShare: () => void;
}) {
  const { t } = useI18n();
  const [playing, setPlaying] = useState(false);
  const [menuPosition, setMenuPosition] = useState<{ top: number; left: number } | null>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const menuButtonRef = useRef<HTMLButtonElement>(null);
  const images = statement.media.filter((item) => item.kind === "image");
  const audio = statement.media.find((item) => item.kind === "audio");
  const video = statement.media.find((item) => item.kind === "video");
  const anonymousName = t("square.anonymousUser");
  useEffect(() => {
    if (!menuPosition) return;
    const close = (event: PointerEvent) => {
      if (menuRef.current?.contains(event.target as Node) || menuButtonRef.current?.contains(event.target as Node)) return;
      setMenuPosition(null);
    };
    const closeWithKeyboard = (event: KeyboardEvent) => { if (event.key === "Escape") setMenuPosition(null); };
    const closeOnResize = () => setMenuPosition(null);
    window.addEventListener("pointerdown", close);
    window.addEventListener("keydown", closeWithKeyboard);
    window.addEventListener("resize", closeOnResize);
    return () => {
      window.removeEventListener("pointerdown", close);
      window.removeEventListener("keydown", closeWithKeyboard);
      window.removeEventListener("resize", closeOnResize);
    };
  }, [menuPosition]);
  return (
    <article className={`square-statement-card${detail ? " is-detail" : " is-clickable"}`} onClick={detail ? undefined : onOpen} onKeyDown={detail ? undefined : (event) => { if (event.key === "Enter" || event.key === " ") onOpen(); }} ref={cardRef} role={detail ? undefined : "button"} tabIndex={detail ? undefined : 0}>
      <header className="square-statement-author">
        <button className={`square-statement-avatar-button${statement.is_anonymous ? " is-anonymous" : ""}`} disabled={statement.is_anonymous} onClick={(event) => { event.stopPropagation(); if (!statement.is_anonymous) onOpenProfile(); }} type="button">
          {statement.is_anonymous ? <span className="square-anonymous-avatar"><span className="material-symbols-outlined">person</span></span> : <UserAvatar
            className="square-statement-avatar"
            frame={statement.user.avatar_frame_style}
            name={statement.user.name}
            uri={statement.user.avatar_uri}
            vip={Boolean(statement.user.is_permanent_vip)}
          />}
        </button>
        <div className="square-statement-author-copy">
          <div className={`square-statement-author-name${statement.user.is_permanent_vip ? " is-vip" : ""}`}>
            <strong>{statement.is_anonymous ? anonymousName : statement.user.name}</strong>
            {!statement.is_anonymous && !statement.user.official && statement.user.growth_level ? <GrowthLevelBadge level={statement.user.growth_level} /> : null}
          </div>
          <span>{formatRelativeTime(statement.created_at)}</span>
        </div>
        {statement.can_pin || statement.can_delete || statement.can_mute ? <button aria-expanded={Boolean(menuPosition)} aria-label={t("common.more")} className="square-statement-menu" onClick={(event) => { event.stopPropagation(); const rect = event.currentTarget.getBoundingClientRect(); const width = 164; setMenuPosition((current) => current ? null : { top: rect.bottom + 6, left: Math.max(8, Math.min(window.innerWidth - width - 8, rect.right - width)) }); }} ref={menuButtonRef} type="button"><span className="material-symbols-outlined">more_horiz</span></button> : null}
      </header>
      {statement.text ? <p className="square-statement-text">{statement.text}</p> : null}
      {statement.chat_record?.items?.length ? (
        <div className="square-chat-record" onClick={(event) => event.stopPropagation()}>
          <ChatPreview
            backgroundTheme={statement.chat_record.redacted_identity ? "default" : chatBackgroundTheme || "default"}
            backgroundUri={statement.chat_record.redacted_identity ? undefined : chatBackgroundUri}
            className="square-chat-record-preview"
            firstPersonUserId={statement.chat_record.first_person_user_id}
            initialScrollToEnd
            messages={forwardBundleItemsAsMessages(statement.chat_record.items).map((message) => statement.chat_record?.redacted_identity ? {
              ...message,
              user: message.user.anonymous ? { ...message.user, name: t("message.redactedParticipant", { number: message.user.name }) } : message.user,
            } : message)}
            onOpenImage={(uris, index, metadata) => onOpenChatImage(uris, index, metadata)}
            onOpenVideo={(uri, metadata) => onOpenChatVideo(uri, metadata)}
            showSelfAuthors
            wheelScrollMode="parent"
          />
        </div>
      ) : null}
      {images.length ? (
        <div className={`square-statement-images count-${Math.min(images.length, 9)}`}>
          {images.map((image, index) => (
            <button key={image.media_id} onClick={(event) => { event.stopPropagation(); onOpenImage(index); }} type="button">
              <img alt="" loading="lazy" src={image.thumbnail_uri || image.uri} />
            </button>
          ))}
        </div>
      ) : null}
      {audio ? (
        <div className="square-statement-audio">
          <button onClick={(event) => {
            event.stopPropagation();
            const player = audioRef.current;
            if (!player) return;
            if (player.paused) void player.play();
            else player.pause();
          }} type="button"><span className="material-symbols-outlined">{playing ? "pause" : "play_arrow"}</span></button>
          <div className="square-audio-wave" aria-hidden="true">{Array.from({ length: 18 }, (_, index) => <i key={index} />)}</div>
          <small>{audio.duration_seconds ? `${audio.duration_seconds}s` : t("square.voice")}</small>
          <audio hidden onEnded={() => setPlaying(false)} onPause={() => setPlaying(false)} onPlay={() => setPlaying(true)} preload="metadata" ref={audioRef} src={audio.uri} />
        </div>
      ) : null}
      {video ? <button className="square-statement-video-button" onClick={(event) => { event.stopPropagation(); onOpenVideo(); }} type="button"><video className="square-statement-video" muted playsInline poster={video.thumbnail_uri || undefined} preload="metadata" src={video.uri} /><span className="material-symbols-outlined">play_arrow</span></button> : null}
      {statement.location ? <button aria-label={statement.location.address || t("square.location")} className="square-statement-location" onClick={(event) => { event.stopPropagation(); onOpenLocation(); }} type="button"><span className="material-symbols-outlined">location_on</span><span>{statement.location.address || `${statement.location.latitude.toFixed(4)}, ${statement.location.longitude.toFixed(4)}`}</span><span className="material-symbols-outlined">chevron_right</span></button> : null}
      <footer className="square-statement-footer">
        <button className={statement.liked ? "is-liked" : ""} disabled={!canInteract} onClick={(event) => { event.stopPropagation(); onLike(); }} type="button"><span className="material-symbols-outlined">favorite</span><span>{statement.like_count || t("square.like")}</span></button>
        <button onClick={(event) => { event.stopPropagation(); onOpen(); }} type="button">
          <span className="material-symbols-outlined">chat_bubble</span>
          <span>{statement.comment_count ? t("square.commentsCount", { count: statement.comment_count }) : t("square.comment")}</span>
        </button>
        <button onClick={(event) => { event.stopPropagation(); onShare(); }} type="button"><span className="material-symbols-outlined">send</span><span>{t("square.share")}</span></button>
      </footer>
      {menuPosition && typeof document !== "undefined" ? createPortal(
        <div className="square-statement-dropdown" onClick={(event) => event.stopPropagation()} ref={menuRef} style={menuPosition}>
          {statement.can_pin ? <button onClick={() => { setMenuPosition(null); onPin(); }} type="button"><span className="material-symbols-outlined">keep</span><span>{statement.is_pinned ? t("square.unpinStatement") : t("square.pinStatement")}</span></button> : null}
          {statement.can_mute ? <button onClick={() => { setMenuPosition(null); onMute(); }} type="button"><span className="material-symbols-outlined">voice_over_off</span><span>{t("square.muteAuthor")}</span></button> : null}
          {statement.can_delete ? <button className="is-danger" onClick={() => { setMenuPosition(null); onDelete(); }} type="button"><span className="material-symbols-outlined">delete</span><span>{t("common.delete")}</span></button> : null}
        </div>,
        document.body,
      ) : null}
    </article>
  );
}

function CommentThread({ comment, canInteract, expanded = false, onDelete, onLike, onOpenProfile, onReply, onToggleReplies, rootUserId }: {
  comment: SquareStatementCommentDTO;
  canInteract: boolean;
  expanded?: boolean;
  onDelete: (comment: SquareStatementCommentDTO) => void;
  onLike: (comment: SquareStatementCommentDTO) => void;
  onOpenProfile: (userId: number) => void;
  onReply: (comment: SquareStatementCommentDTO) => void;
  onToggleReplies?: (commentId: number) => void;
  rootUserId?: number;
}) {
  const { t } = useI18n();
  const [menuPosition, setMenuPosition] = useState<{ top: number; left: number } | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!menuPosition) return;
    const close = (event: PointerEvent) => {
      if (!menuRef.current?.contains(event.target as Node)) setMenuPosition(null);
    };
    window.addEventListener("pointerdown", close);
    return () => window.removeEventListener("pointerdown", close);
  }, [menuPosition]);
  const beginReply = (event: ReactMouseEvent) => {
    event.stopPropagation();
    if (canInteract) onReply(comment);
  };
  const threadRootUserId = rootUserId ?? comment.user.user_id;
  const layerReplyTarget = comment.parent_id && comment.reply_to_user?.user_id !== threadRootUserId
    ? comment.reply_to_user
    : null;
  const displayName = comment.is_anonymous ? t("square.anonymousUser") : comment.user.name;
  const replyCount = Math.max(comment.reply_count || 0, comment.replies?.length || 0);
  const hasExpandableReplies = !comment.parent_id && replyCount > 0;
  const toggleReplies = (event: ReactMouseEvent) => {
    event.stopPropagation();
    if (hasExpandableReplies) onToggleReplies?.(comment.comment_id);
  };
  return <article className={`square-comment-thread${canInteract ? " is-replyable" : ""}${hasExpandableReplies ? " has-replies" : ""}`} onClick={comment.parent_id ? beginReply : toggleReplies}>
    {comment.is_anonymous ? <span className="square-anonymous-avatar square-comment-avatar"><span className="material-symbols-outlined">person</span></span> : <button aria-label={comment.user.name} className="square-comment-avatar-button" onClick={(event) => { event.stopPropagation(); onOpenProfile(comment.user.user_id); }} type="button"><UserAvatar className="square-comment-avatar" frame={comment.user.avatar_frame_style} name={comment.user.name} uri={comment.user.avatar_uri} vip={Boolean(comment.user.is_permanent_vip)} /></button>}
    <div>
      <header><div className={`square-comment-author-name${comment.is_anonymous ? " is-anonymous" : ""}${comment.user.is_permanent_vip ? " is-vip" : ""}`}><strong>{displayName}</strong>{!comment.is_anonymous && comment.user.growth_level ? <GrowthLevelBadge level={comment.user.growth_level} /> : null}{comment.is_author ? <em>{t("square.authorTag")}</em> : null}{layerReplyTarget ? <span className="square-comment-relation"><i aria-hidden="true" />{layerReplyTarget.anonymous ? t("square.anonymousUser") : layerReplyTarget.name}</span> : null}</div>{comment.can_delete ? <button aria-expanded={Boolean(menuPosition)} aria-label={t("common.more")} className="square-comment-more" onClick={(event) => { event.stopPropagation(); const rect = event.currentTarget.getBoundingClientRect(); const width = 104; setMenuPosition((current) => current ? null : { top: rect.bottom + 5, left: Math.max(8, Math.min(window.innerWidth - width - 8, rect.right - width)) }); }} type="button"><span className="material-symbols-outlined">more_horiz</span></button> : null}</header>
      <p onClick={beginReply}>{comment.text}</p>
      <div className="square-comment-footer">
        <time>{formatRelativeTime(comment.created_at)}</time>
        <div className="square-comment-actions">
          {canInteract ? <button onClick={beginReply} type="button"><span>{t("square.reply")}</span></button> : null}
          <button className={comment.liked ? "is-liked" : ""} disabled={!canInteract} onClick={(event) => { event.stopPropagation(); onLike(comment); }} type="button"><span className="material-symbols-outlined">favorite</span><span>{comment.like_count || t("square.like")}</span></button>
        </div>
      </div>
      {hasExpandableReplies ? <button aria-expanded={expanded} className="square-comment-replies-toggle" onClick={toggleReplies} type="button"><span>{expanded ? t("square.hideReplies") : t("square.viewReplies", { count: replyCount })}</span><span className="material-symbols-outlined">chevron_right</span></button> : null}
      {hasExpandableReplies && comment.replies?.length ? <div aria-hidden={!expanded} className={`square-comment-replies-shell${expanded ? " is-expanded" : ""}`}><div className="square-comment-replies">{comment.replies.map((reply) => <CommentThread canInteract={canInteract} comment={reply} key={reply.comment_id} onDelete={onDelete} onLike={onLike} onOpenProfile={onOpenProfile} onReply={onReply} rootUserId={threadRootUserId} />)}</div></div> : null}
    </div>
    {menuPosition && typeof document !== "undefined" ? createPortal(<div className="square-comment-menu" onClick={(event) => event.stopPropagation()} ref={menuRef} style={menuPosition}><button onClick={(event) => { event.stopPropagation(); setMenuPosition(null); onDelete(comment); }} type="button"><span className="material-symbols-outlined">delete</span><span>{t("common.delete")}</span></button></div>, document.body) : null}
  </article>;
}

export default function SquarePage() {
  const { t, language } = useI18n();
  const location = useLocation();
  const navigate = useNavigate();
  const { statementId: routeStatementId, activityKey: routeActivityKey } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  const { patchSessionUser, session } = useAuth();
  const features = useSpaceFeatures();
  const cacheScope = buildTabCacheScope(session?.user.space_id, session?.user.user_id);
  const profileFeedUserIdValue = Number(searchParams.get("user_id"));
  const profileFeedUserId = Number.isFinite(profileFeedUserIdValue) && profileFeedUserIdValue > 0 ? profileFeedUserIdValue : null;
  const profileFeedUserName = searchParams.get("user_name")?.trim() || t("square.userFeedFallback");
  const [feedMode, setFeedMode] = useState<"all" | "friends" | "mine" | "user">(profileFeedUserId ? "user" : "all");
  const [statements, setStatements] = useState<SquareStatementDTO[]>(() => readTabCache<SquareStatementDTO[]>(cacheScope, "square:all")?.data ?? []);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [error, setError] = useState("");
  const [text, setText] = useState("");
  const [visibility, setVisibility] = useState<"public" | "friends">("public");
  const [anonymousStatement, setAnonymousStatement] = useState(false);
  const [anonymousComment, setAnonymousComment] = useState(false);
  const [publicCommentConfirmOpen, setPublicCommentConfirmOpen] = useState(false);
  const [pinOnPublish, setPinOnPublish] = useState(false);
  const [photos, setPhotos] = useState<SelectedPhoto[]>([]);
  const [video, setVideo] = useState<SelectedVideo | null>(null);
  const [voiceFile, setVoiceFile] = useState<File | null>(null);
  const [voiceDuration, setVoiceDuration] = useState(0);
  const [recording, setRecording] = useState(false);
  const [contentSheetOpen, setContentSheetOpen] = useState(false);
  const [statementLocation, setStatementLocation] = useState<SquareStatementDTO["location"]>(null);
  const [locationLoading, setLocationLoading] = useState(false);
  const [chatRecordDraft, setChatRecordDraft] = useState<SquareChatRecordDraft | null>(null);

  useEffect(() => {
    if (!features.squareExploreEnabled && feedMode === "all") setFeedMode("friends");
  }, [features.squareExploreEnabled, feedMode]);
  const [publishing, setPublishing] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [composerOpen, setComposerOpen] = useState(false);
  const [visibilitySheetOpen, setVisibilitySheetOpen] = useState(false);
  const [voiceSheetOpen, setVoiceSheetOpen] = useState(false);
  const [gallery, setGallery] = useState<{ statementId: number; index: number } | null>(null);
  const [videoGalleryStatementId, setVideoGalleryStatementId] = useState<number | null>(null);
  const [chatRecordGallery, setChatRecordGallery] = useState<{ uris: string[]; index: number; metadata: Array<ImageMetadataDTO | null> } | null>(null);
  const [chatRecordVideo, setChatRecordVideo] = useState<{ uri: string; metadata: VideoMetadataDTO | null } | null>(null);
  const [chatRecordLocation, setChatRecordLocation] = useState<{
    location: { latitude: number; longitude: number; address?: string };
    owner: TinyUserDTO;
  } | null>(null);
  const parsedRouteStatementId = Number(routeStatementId);
  const routedStatementId = Number.isFinite(parsedRouteStatementId) && parsedRouteStatementId > 0 ? parsedRouteStatementId : null;
  const routeState = location.state as { squareInlineFocus?: boolean; squareChatRecordDraft?: { messageIds?: number[] } } | null;
  const inlineRouteActive = routedStatementId !== null && routeState?.squareInlineFocus === true;
  const consumedChatRecordDraftRef = useRef<string | null>(null);

  useEffect(() => {
    const openLocationMessage = (event: Event) => {
      setChatRecordLocation((event as CustomEvent<{
        location: { latitude: number; longitude: number; address?: string };
        owner: TinyUserDTO;
      }>).detail);
    };
    window.addEventListener("sermo:location-message", openLocationMessage);
    return () => window.removeEventListener("sermo:location-message", openLocationMessage);
  }, []);

  useEffect(() => {
    const messageIds = routeState?.squareChatRecordDraft?.messageIds?.filter((value) => Number.isInteger(value) && value > 0) ?? [];
    if (!messageIds.length) return;
    const draftKey = messageIds.join(",");
    if (consumedChatRecordDraftRef.current === draftKey) return;
    consumedChatRecordDraftRef.current = draftKey;
    setChatRecordDraft({ messageIds, redacted: false });
    setPhotos([]);
    setVoiceFile(null);
    setVoiceDuration(0);
    setVideo(null);
    setAnonymousStatement(false);
    setComposerOpen(true);
    navigate(`${location.pathname}${location.search}`, { replace: true, state: null });
  }, [location.pathname, location.search, navigate, routeState?.squareChatRecordDraft]);
  const [desktopWorkspace, setDesktopWorkspace] = useState(() => typeof window !== "undefined" && window.matchMedia("(min-width: 901px)").matches);
  const [inlineStatementId, setInlineStatementId] = useState<number | null>(null);
  const [inlineStatementExpanded, setInlineStatementExpanded] = useState(false);
  const [inlineTransitionPhase, setInlineTransitionPhase] = useState<InlineTransitionPhase>("idle");
  const [inlineStatementOrigin, setInlineStatementOrigin] = useState<InlineStatementOrigin | null>(null);
  const statementCardRefs = useRef(new Map<number, HTMLElement>());
  const inlineExpandTimerRef = useRef<number | null>(null);
  const commentStatementId = routedStatementId ?? inlineStatementId;
  const [comments, setComments] = useState<SquareStatementCommentDTO[]>([]);
  const [commentsLoading, setCommentsLoading] = useState(false);
  const [commentsHasMore, setCommentsHasMore] = useState(false);
  const [expandedCommentId, setExpandedCommentId] = useState<number | null>(null);
  const [commentSort, setCommentSort] = useState<"hot" | "latest">("hot");
  const [commentText, setCommentText] = useState("");
  const [replyTarget, setReplyTarget] = useState<SquareStatementCommentDTO | null>(null);
  const [commentSending, setCommentSending] = useState(false);
  const [deleteStatementId, setDeleteStatementId] = useState<number | null>(null);
  const [deletingStatement, setDeletingStatement] = useState(false);
  const [muteStatement, setMuteStatement] = useState<SquareStatementDTO | null>(null);
  const [muteDuration, setMuteDuration] = useState<"1d" | "3d" | "7d" | "30d" | "permanent">("1d");
  const [muteReason, setMuteReason] = useState("");
  const [mutingAuthor, setMutingAuthor] = useState(false);
  const [deleteCommentTarget, setDeleteCommentTarget] = useState<SquareStatementCommentDTO | null>(null);
  const [deletingComment, setDeletingComment] = useState(false);
  const [shareStatement, setShareStatement] = useState<SquareStatementDTO | null>(null);
  const [shareActivity, setShareActivity] = useState<ActivityCampaignDTO | null>(null);
  const [shareChats, setShareChats] = useState<ChatDTO[]>([]);
  const [shareChatsLoading, setShareChatsLoading] = useState(false);
  const [sharingChatId, setSharingChatId] = useState<number | null>(null);
  const [notificationDrawerOpen, setNotificationDrawerOpen] = useState(false);
  const [notificationEvents, setNotificationEvents] = useState<NotificationEventDTO[]>([]);
  const [notificationUnread, setNotificationUnread] = useState(0);
  const [notificationHistoryAvailable, setNotificationHistoryAvailable] = useState(true);
  const [notificationHistoryLoading, setNotificationHistoryLoading] = useState(false);
  const [feedFresh, setFeedFresh] = useState({ all: false, friends: false });
  const [claimableActivityKeys, setClaimableActivityKeys] = useState<string[]>([]);
  const [quotaOpen, setQuotaOpen] = useState(false);
  const [quota, setQuota] = useState<SquareQuotaDTO | null>(null);
  const [quotaLoading, setQuotaLoading] = useState(false);
  const [pinnedStatement, setPinnedStatement] = useState<SquareStatementDTO | null>(null);
  const [activities, setActivities] = useState<ActivityCampaignDTO[]>([]);
  const [vipCampaign, setVipCampaign] = useState<PermanentVipCampaignDTO | null>(null);
  const [vipCampaignOpen, setVipCampaignOpen] = useState(false);
  const [vipClaiming, setVipClaiming] = useState(false);
  const [activityBannerSlide, setActivityBannerSlide] = useState(0);
  const activityBannerTrackRef = useRef<HTMLElement>(null);
  const [activityClaiming, setActivityClaiming] = useState(false);
  const [personalRewardClaiming, setPersonalRewardClaiming] = useState(false);
  const [spaceRewardClaiming, setSpaceRewardClaiming] = useState(false);
  const [activityContributing, setActivityContributing] = useState(false);
  const [activityRulesOpen, setActivityRulesOpen] = useState(false);
  const [activityPoolOpen, setActivityPoolOpen] = useState(false);
  const [activityPoolSlide, setActivityPoolSlide] = useState(0);
  const activityPoolTrackRef = useRef<HTMLDivElement>(null);
  const [profileDrawerUserId, setProfileDrawerUserId] = useState<number | null>(null);
  const [profileSyncing, setProfileSyncing] = useState(false);
  const [growthLevel, setGrowthLevel] = useState(() => session?.user.growth_level ?? 1);
  const photoInputRef = useRef<HTMLInputElement>(null);
  const videoInputRef = useRef<HTMLInputElement>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const commentInputRef = useRef<HTMLInputElement>(null);
  const lastReadStatementRef = useRef<number | null>(null);
  const notificationMutationVersionRef = useRef(0);
  const notificationUnreadRef = useRef(0);
  const recorderStreamRef = useRef<MediaStream | null>(null);
  const recorderChunksRef = useRef<Blob[]>([]);
  const recordingStartedAtRef = useRef(0);
  const recordingTimerRef = useRef<number | null>(null);
  const currentUser = session?.user;
  const canPublish = Boolean(currentUser?.verified);
  const canSendVoice = Boolean(currentUser?.official) || growthLevel >= 6;
  const canSendVideo = Boolean(currentUser?.official) || growthLevel >= 8;
  const activeCommentStatement = statements.find((item) => item.statement_id === commentStatementId) ?? null;
  const canCommentAnonymously = Boolean(activeCommentStatement?.is_anonymous && activeCommentStatement.is_mine);
  const galleryStatement = statements.find((item) => item.statement_id === gallery?.statementId) ?? null;
  const galleryImages = galleryStatement?.media.filter((item) => item.kind === "image") ?? [];
  const galleryVideo = statements.find((item) => item.statement_id === videoGalleryStatementId)?.media.find((item) => item.kind === "video") ?? null;
  const profileSeed = statements.find((statement) => statement.user.user_id === profileDrawerUserId)?.user ?? null;

  useEffect(() => {
    setAnonymousComment(canCommentAnonymously);
    setPublicCommentConfirmOpen(false);
  }, [canCommentAnonymously, commentStatementId]);

  useEffect(() => {
    setExpandedCommentId(null);
  }, [commentSort, commentStatementId]);

  useEffect(() => {
    const profileSegment = drawerPathFromSearch(location.search).find((item) => /^user-profile-\d+$/.test(item));
    if (!profileSegment) return;
    const userId = Number(profileSegment.replace("user-profile-", ""));
    if (Number.isFinite(userId) && userId > 0) setProfileDrawerUserId(userId);
  }, [location.search]);
  const sortedShareChats = useMemo(() => [...shareChats].sort((left, right) => (
    Number(Boolean(right.pinned)) - Number(Boolean(left.pinned))
    || (right.last_message?.created_at ?? right.last_chat_at) - (left.last_message?.created_at ?? left.last_chat_at)
  )), [shareChats]);
  const shareTargets = useMemo(() => sortedShareChats.map((chat) => {
    const peer = chat.group ? null : shareChatPeer(chat, currentUser?.user_id);
    return {
      id: chat.chat_id,
      title: shareChatTitle(chat, currentUser?.user_id),
      preview: chat.last_message?.content || (chat.group ? t("chat.group") : t("square.directChat")),
      time: formatRelativeTime(chat.last_message?.created_at ?? chat.last_chat_at),
      pinned: Boolean(chat.pinned),
      avatarUri: peer?.avatar_uri,
      avatarCacheKey: peer?.avatar_cache_key,
      avatarFrameStyle: peer?.avatar_frame_style,
      groupMembers: chat.group ? chat.members.map((member) => ({ name: member.name, uri: member.avatar_uri, cacheKey: member.avatar_cache_key })) : undefined,
    };
  }), [currentUser?.user_id, sortedShareChats, t]);
  const voicePreview = useMemo(() => voiceFile ? URL.createObjectURL(voiceFile) : null, [voiceFile]);
  const activeActivity = activities.find((item) => item.key === routeActivityKey) ?? null;
  const refreshActivities = () => api.getActiveActivities().then(setActivities).catch(() => undefined);

  const applySquareStatus = (status: SquareStatusDTO) => {
    notificationUnreadRef.current = status.notification_unread;
    setNotificationUnread(status.notification_unread);
    setFeedFresh({ all: status.explore_unread, friends: status.friends_unread });
    setClaimableActivityKeys(status.claimable_activity_keys);
    announceSquareUnread(status.notification_unread, {
      hasFreshContent: status.explore_unread || status.friends_unread || status.activity_claimable,
      claimableActivityKeys: status.claimable_activity_keys,
    });
  };

  useEffect(() => {
    const controller = new AbortController();
    void api.getActiveActivities(controller.signal).then(setActivities).catch(() => undefined);
    void api.getUserMe(controller.signal).then((me) => setVipCampaign(me.permanent_vip_campaign ?? null)).catch(() => undefined);
    return () => controller.abort();
  }, [session?.user.space_id, session?.user.user_id]);

  useEffect(() => {
    const controller = new AbortController();
    void api.getSquareStatus(controller.signal).then(applySquareStatus).catch(() => undefined);
    return () => controller.abort();
  }, [session?.user.space_id, session?.user.user_id]);

  useEffect(() => {
    if (feedMode !== "all" && feedMode !== "friends") return;
    void api.markSquareFeedRead(feedMode).then(applySquareStatus).catch(() => undefined);
  }, [feedMode, session?.user.space_id, session?.user.user_id]);

  const showVipCampaign = Boolean(vipCampaign && (vipCampaign.active || vipCampaign.claimed_by_user));
  const activityBannerCount = activities.length + (showVipCampaign ? 1 : 0);

  useEffect(() => {
    if (activityBannerCount < 2 || feedMode !== "all") return;
    const timer = window.setInterval(() => {
      if (document.hidden) return;
      const track = activityBannerTrackRef.current;
      if (!track) return;
      const slides = Array.from(track.children) as HTMLElement[];
      const next = (activityBannerSlide + 1) % slides.length;
      track.scrollTo({ behavior: "smooth", left: slides[next].offsetLeft - track.offsetLeft });
      setActivityBannerSlide(next);
    }, 6000);
    return () => window.clearInterval(timer);
  }, [activityBannerCount, activityBannerSlide, feedMode]);

  const claimPermanentVip = async () => {
    if (!vipCampaign?.eligible || vipClaiming) return;
    setVipClaiming(true);
    try {
      const campaign = await api.claimPermanentVip();
      setVipCampaign(campaign);
      patchSessionUser({ is_permanent_vip: true });
      showToast(t("vip.claimed", { slot: campaign.slot }), "success");
      void api.getSquareStatus().then(applySquareStatus).catch(() => undefined);
    } catch (cause) {
      showToast(cause instanceof Error ? cause.message : t("vip.claimFailed"), "error");
    } finally {
      setVipClaiming(false);
    }
  };

  useEffect(() => {
    if (!routeActivityKey || activeActivity) return;
    const controller = new AbortController();
    void api.getActivity(routeActivityKey, controller.signal).then((activity) => {
      setActivities((current) => [...current.filter((item) => item.key !== activity.key), activity]);
    }).catch(() => {
      // The active-campaign request may resolve first and cancel this duplicate
      // detail request. Cancellation must not close the route-backed drawer.
      if (!controller.signal.aborted) navigate("/app/square", { replace: true });
    });
    return () => controller.abort();
  }, [activeActivity, navigate, routeActivityKey]);

  const contributeActivity = async () => {
    if (!activeActivity?.available_points || activityContributing) return;
    setActivityContributing(true);
    try {
      const updated = await api.contributeActivity(activeActivity.key);
      setActivities((current) => current.map((item) => item.key === updated.key ? updated : item));
      showToast(t("activity.contributed", { count: activeActivity.available_points }));
    } catch (cause) {
      showToast(cause instanceof Error ? cause.message : t("activity.contributeFailed"), "error");
    } finally {
      setActivityContributing(false);
    }
  };

  const claimActivityForce = async () => {
    if (!activeActivity?.claimable_points || activityClaiming) return;
    setActivityClaiming(true);
    try {
      const claimable = activeActivity.claimable_points;
      const updated = await api.claimActivityForce(activeActivity.key);
      setActivities((current) => current.map((item) => item.key === updated.key ? updated : item));
      showToast(t("activity.claimed", { count: claimable }));
      void api.getSquareStatus().then(applySquareStatus).catch(() => undefined);
    } catch (cause) {
      showToast(cause instanceof Error ? cause.message : t("activity.claimFailed"), "error");
    } finally {
      setActivityClaiming(false);
    }
  };

  const claimPersonalActivityReward = async () => {
    if (!activeActivity?.personal_reward_claimable || personalRewardClaiming) return;
    setPersonalRewardClaiming(true);
    try {
      const updated = await api.claimActivityPersonalReward(activeActivity.key);
      setActivities((current) => current.map((item) => item.key === updated.key ? updated : item));
      showToast(t("activity.personalRewardClaimed"), "success");
      void api.getSquareStatus().then(applySquareStatus).catch(() => undefined);
    } catch (cause) {
      showToast(cause instanceof Error ? cause.message : t("activity.personalRewardClaimFailed"), "error");
    } finally {
      setPersonalRewardClaiming(false);
    }
  };

  const claimSpaceActivityReward = async () => {
    if (!activeActivity?.space_reward_claimable || spaceRewardClaiming) return;
    setSpaceRewardClaiming(true);
    try {
      const updated = await api.claimActivitySpaceReward(activeActivity.key);
      setActivities((current) => current.map((item) => item.key === updated.key ? updated : item));
      showToast(t("activity.spaceRewardClaimed"), "success");
      void api.getSquareStatus().then(applySquareStatus).catch(() => undefined);
    } catch (cause) {
      showToast(cause instanceof Error ? cause.message : t("activity.spaceRewardClaimFailed"), "error");
    } finally {
      setSpaceRewardClaiming(false);
    }
  };

  const openQuota = () => {
    setQuotaOpen(true);
    setQuotaLoading(true);
    void api.getSquareQuota().then(setQuota).catch(() => setQuota(null)).finally(() => setQuotaLoading(false));
  };

  const refreshStatementMedia = (statementId: number) => {
    void api.getSquareStatement(statementId).then((fresh) => {
      setStatements((current) => current.map((statement) => statement.statement_id === statementId ? fresh : statement));
      setPinnedStatement((current) => current?.statement_id === statementId ? fresh : current);
    }).catch(() => undefined);
  };

  const openStatementImages = (statementId: number, index: number) => {
    setGallery({ statementId, index });
    refreshStatementMedia(statementId);
  };

  const openStatementVideo = (statementId: number) => {
    setVideoGalleryStatementId(statementId);
    refreshStatementMedia(statementId);
  };

  const openStatementShare = (statement: SquareStatementDTO) => {
    setShareActivity(null);
    setShareStatement(statement);
    setShareChatsLoading(true);
    void api.getChats().then(setShareChats).catch((cause) => {
      showToast(cause instanceof Error ? cause.message : t("square.shareLoadFailed"), "error");
      setShareChats([]);
    }).finally(() => setShareChatsLoading(false));
  };

  const openActivityShare = (activity: ActivityCampaignDTO) => {
    setShareStatement(null);
    setShareActivity(activity);
    setShareChatsLoading(true);
    void api.getChats().then(setShareChats).catch((cause) => {
      showToast(cause instanceof Error ? cause.message : t("square.shareLoadFailed"), "error");
      setShareChats([]);
    }).finally(() => setShareChatsLoading(false));
  };

  const sendStatementToChat = async (chat: ChatDTO) => {
    if ((!shareStatement && !shareActivity) || sharingChatId !== null) return;
    setSharingChatId(chat.chat_id);
    const slug = getDetectedSpaceSlug();
    const pathname = shareStatement
      ? `/app/square/statements/${shareStatement.statement_id}`
      : `/app/square/activities/${shareActivity!.key}`;
    const url = slug ? buildSpaceHrefForCurrentHost(slug, pathname) : new URL(pathname, window.location.origin).toString();
    try {
      if (shareStatement) {
        await api.sendMessage(
          chat.chat_id,
          MESSAGE_TYPE_STATEMENT,
          JSON.stringify({ kind: "statement", statement_id: shareStatement.statement_id, url, text: shareStatement.text.slice(0, 100) }),
          undefined,
          crypto.randomUUID(),
        );
      } else {
        const title = language === "zh-CN" ? shareActivity!.title : shareActivity!.title_en || shareActivity!.title;
        await api.sendMessage(
          chat.chat_id,
          MESSAGE_TYPE_ACTIVITY,
          JSON.stringify({ kind: "activity", activity_key: shareActivity!.key, title, url }),
          undefined,
          crypto.randomUUID(),
        );
      }
      showToast(t("square.sharedTo", { chat: shareChatTitle(chat, currentUser?.user_id) }));
      setShareStatement(null);
      setShareActivity(null);
    } catch (cause) {
      showToast(cause instanceof Error ? cause.message : t("square.shareFailed"), "error");
    } finally {
      setSharingChatId(null);
    }
  };

  const publishable = useMemo(
    () => Boolean(text.trim() || photos.length || voiceFile || video || chatRecordDraft) && !publishing && text.length <= MAX_TEXT_LENGTH,
    [chatRecordDraft, photos.length, publishing, text, video, voiceFile],
  );

  useEffect(() => {
    setGrowthLevel(session?.user.growth_level ?? 1);
    if (!session?.user.user_id) return;
    const controller = new AbortController();
    void api.getGrowth(controller.signal).then((growth) => {
      setGrowthLevel(growth.effective_level ?? growth.level);
    }).catch(() => undefined);
    return () => controller.abort();
  }, [session?.user.growth_level, session?.user.user_id]);

  const loadStatements = async (before?: number) => {
    const controller = new AbortController();
    try {
      const rows = await api.getSquareStatements({ before, limit: 20, scope: feedMode === "user" ? "all" : feedMode, user_id: feedMode === "user" ? profileFeedUserId ?? undefined : undefined }, controller.signal);
      setStatements((current) => before ? [...current, ...rows] : rows);
      setHasMore(rows.length === 20);
      setError("");
    } catch (cause) {
      if (!controller.signal.aborted) setError(cause instanceof Error ? cause.message : t("square.loadFailed"));
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
    return () => controller.abort();
  };

  useEffect(() => {
    const cacheKey = feedMode === "user" ? `square:user:${profileFeedUserId}` : `square:${feedMode}`;
    const cached = readTabCache<SquareStatementDTO[]>(cacheScope, cacheKey)?.data;
    setStatements(cached ?? []);
    setLoading(!cached);
    setSyncing(true);
    const controller = new AbortController();
    void api.getSquareStatements({ limit: 20, scope: feedMode === "user" ? "all" : feedMode, user_id: feedMode === "user" ? profileFeedUserId ?? undefined : undefined }, controller.signal).then((rows) => {
      setStatements(rows);
      writeTabCache(cacheScope, cacheKey, rows);
      setHasMore(rows.length === 20);
      setError("");
    }).catch((cause) => {
      if (!controller.signal.aborted) setError(cause instanceof Error ? cause.message : t("square.loadFailed"));
    }).finally(() => { setLoading(false); setSyncing(false); });
    return () => controller.abort();
  }, [cacheScope, feedMode, profileFeedUserId, t]);

  useEffect(() => {
    if (statements.length) writeTabCache(cacheScope, feedMode === "user" ? `square:user:${profileFeedUserId}` : `square:${feedMode}`, statements);
  }, [cacheScope, feedMode, profileFeedUserId, statements]);

  useEffect(() => {
    if (profileFeedUserId) {
      setFeedMode("user");
      setProfileDrawerUserId(null);
    }
  }, [profileFeedUserId]);

  useEffect(() => () => {
    recorderStreamRef.current?.getTracks().forEach((track) => track.stop());
    if (recordingTimerRef.current !== null) window.clearInterval(recordingTimerRef.current);
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    void api.getPinnedSquareStatement(controller.signal).then(setPinnedStatement).catch(() => undefined);
    return () => controller.abort();
  }, []);

  useEffect(() => () => { if (voicePreview) URL.revokeObjectURL(voicePreview); }, [voicePreview]);

  useEffect(() => {
    const controller = new AbortController();
    const mutationVersion = notificationMutationVersionRef.current;
    void api.getNotificationEvents("square", controller.signal, { unreadOnly: true }).then((result) => {
      const readStatementId = lastReadStatementRef.current;
      setNotificationEvents(result.events.map((event) => (
        readStatementId && event.payload.statement_id === readStatementId ? { ...event, is_read: true } : event
      )));
      setNotificationHistoryAvailable(true);
      if (mutationVersion === notificationMutationVersionRef.current) {
        notificationUnreadRef.current = result.unread_count;
        setNotificationUnread(result.unread_count);
        announceSquareUnread(result.unread_count);
      }
    }).catch(() => undefined);
    return () => controller.abort();
  }, []);

  useEffect(() => {
    if (commentStatementId === null) {
      lastReadStatementRef.current = null;
      return;
    }
    if (lastReadStatementRef.current === commentStatementId) return;
    lastReadStatementRef.current = commentStatementId;
    notificationMutationVersionRef.current += 1;

    setNotificationEvents((current) => current.map((event) => (
      event.payload.statement_id === commentStatementId ? { ...event, is_read: true } : event
    )));
    const relatedUnread = notificationEvents.filter((event) => (
      !event.is_read && event.payload.statement_id === commentStatementId
    )).length;
    const optimisticUnread = Math.max(0, notificationUnreadRef.current - relatedUnread);
    notificationUnreadRef.current = optimisticUnread;
    setNotificationUnread(optimisticUnread);
    announceSquareUnread(optimisticUnread);

    void api.markSquareNotificationsRead(commentStatementId)
      .then((result) => {
        notificationUnreadRef.current = result.unread_count;
        setNotificationUnread(result.unread_count);
        announceSquareUnread(result.unread_count);
      })
      .catch(() => undefined);
  }, [commentStatementId, notificationEvents]);

  const openNotificationDrawer = () => {
    setNotificationDrawerOpen(true);
    void api.getNotificationEvents("square", undefined, { unreadOnly: true }).then((result) => {
      setNotificationEvents(result.events);
      setNotificationHistoryAvailable(true);
      if (!result.unread_count) return;
      notificationUnreadRef.current = 0;
      setNotificationUnread(0);
      announceSquareUnread(0, {
        hasFreshContent: feedFresh.all || feedFresh.friends || claimableActivityKeys.length > 0,
        claimableActivityKeys,
      });
      void api.markSquareNotificationsRead();
    }).catch(() => undefined);
  };

  const loadEarlierNotifications = () => {
    if (notificationHistoryLoading || !notificationHistoryAvailable) return;
    setNotificationHistoryLoading(true);
    const before = notificationEvents.length ? Math.min(...notificationEvents.map((event) => event.notification_event_id)) : undefined;
    void api.getNotificationEvents("square", undefined, { before, limit: 30 }).then((result) => {
      setNotificationEvents((current) => {
        const known = new Set(current.map((event) => event.notification_event_id));
        return [...current, ...result.events.filter((event) => !known.has(event.notification_event_id))];
      });
      setNotificationHistoryAvailable(result.has_more);
    }).catch(() => undefined).finally(() => setNotificationHistoryLoading(false));
  };

  useEffect(() => {
    if (commentStatementId === null) return;
    const controller = new AbortController();
    setCommentsLoading(true);
    void Promise.all([
      api.getSquareStatement(commentStatementId, controller.signal),
      api.getSquareStatementComments(commentStatementId, { offset: 0, limit: 30, sort: commentSort }, controller.signal),
    ]).then(([statement, rows]) => {
      setStatements((current) => current.some((item) => item.statement_id === statement.statement_id)
        ? current.map((item) => item.statement_id === statement.statement_id ? statement : item)
        : [statement, ...current]);
      setComments(rows);
      setCommentsHasMore(rows.length === 30);
    }).catch((cause) => {
      if (!controller.signal.aborted) setError(cause instanceof Error ? cause.message : t("square.commentsLoadFailed"));
    }).finally(() => setCommentsLoading(false));
    return () => controller.abort();
  }, [commentSort, commentStatementId, t]);

  useEffect(() => {
    setAnonymousComment(false);
  }, [commentStatementId]);

  const alignStatementBelowHeader = (element: HTMLElement, behavior: ScrollBehavior) => {
    const screen = element.closest<HTMLElement>(".square-feed-screen");
    const header = screen?.querySelector<HTMLElement>(".tab-sticky-header");
    const headerHeight = header?.getBoundingClientRect().height ?? 0;
    const screenStyle = screen ? window.getComputedStyle(screen) : null;
    const screenScrolls = Boolean(screen && screen.scrollHeight > screen.clientHeight
      && /(auto|scroll)/.test(screenStyle?.overflowY ?? ""));

    if (screen && screenScrolls) {
      const screenRect = screen.getBoundingClientRect();
      const elementRect = element.getBoundingClientRect();
      screen.scrollTo({
        top: screen.scrollTop + elementRect.top - screenRect.top - headerHeight,
        behavior,
      });
      return;
    }

    const elementRect = element.getBoundingClientRect();
    window.scrollTo({
      top: window.scrollY + elementRect.top - headerHeight,
      behavior,
    });
  };

  const finishInlineStatementClose = (navigateAfter: boolean) => {
    const statementId = inlineStatementId;
    setInlineStatementExpanded(false);
    setInlineTransitionPhase("idle");
    setReplyTarget(null);
    setCommentText("");

    if (navigateAfter && inlineRouteActive) {
      if (window.history.length > 1) navigate(-1);
      else navigate("/app/square", { replace: true });
    }

    window.requestAnimationFrame(() => window.requestAnimationFrame(() => {
      const card = statementId === null ? null : statementCardRefs.current.get(statementId);
      if (card) alignStatementBelowHeader(card, "auto");
      setInlineStatementId(null);
      setInlineStatementOrigin(null);
    }));
  };

  const startInlineStatementClose = (navigateAfter: boolean) => {
    if (!inlineStatementExpanded || inlineTransitionPhase === "closing") return;
    if (inlineExpandTimerRef.current !== null) window.clearTimeout(inlineExpandTimerRef.current);
    setInlineTransitionPhase("closing");
    inlineExpandTimerRef.current = window.setTimeout(() => {
      inlineExpandTimerRef.current = null;
      finishInlineStatementClose(navigateAfter);
    }, 380);
  };

  const closeInlineStatement = () => startInlineStatementClose(true);

  const openStatement = (statementId: number) => {
    if (inlineExpandTimerRef.current !== null) window.clearTimeout(inlineExpandTimerRef.current);
    setInlineStatementId(statementId);
    setInlineStatementExpanded(false);
    window.requestAnimationFrame(() => window.requestAnimationFrame(() => {
      const card = statementCardRefs.current.get(statementId);
      if (!card) {
        navigate(`/app/square/statements/${statementId}`, { state: { squareInlineFocus: true } });
        setInlineStatementExpanded(true);
        setInlineTransitionPhase("open");
        return;
      }
      alignStatementBelowHeader(card, "smooth");
      inlineExpandTimerRef.current = window.setTimeout(() => {
        const rect = card.getBoundingClientRect();
        setInlineStatementOrigin({ left: rect.left, top: rect.top, width: rect.width, height: rect.height });
        setInlineTransitionPhase("preparing");
        navigate(`/app/square/statements/${statementId}`, { state: { squareInlineFocus: true } });
        setInlineStatementExpanded(true);
        inlineExpandTimerRef.current = window.setTimeout(() => {
          setInlineTransitionPhase("opening");
          inlineExpandTimerRef.current = window.setTimeout(() => {
            setInlineTransitionPhase("open");
            inlineExpandTimerRef.current = null;
          }, 440);
        }, 34);
      }, 320);
    }));
  };

  const openStatementDrawer = (statementId: number) => {
    navigate(`/app/square/statements/${statementId}`, { state: { squareStatementDrawer: true } });
  };

  useEffect(() => () => {
    if (inlineExpandTimerRef.current !== null) window.clearTimeout(inlineExpandTimerRef.current);
  }, []);

  useEffect(() => {
    const query = window.matchMedia("(min-width: 901px)");
    const update = () => setDesktopWorkspace(query.matches);
    update();
    query.addEventListener("change", update);
    return () => query.removeEventListener("change", update);
  }, []);

  useEffect(() => {
    if (inlineRouteActive && routedStatementId !== inlineStatementId) {
      setInlineStatementId(routedStatementId);
      setInlineStatementExpanded(true);
      setInlineTransitionPhase("open");
      return;
    }
    if (!inlineRouteActive && inlineStatementId !== null) {
      if (inlineStatementExpanded) {
        startInlineStatementClose(false);
        return;
      }
      if (inlineExpandTimerRef.current !== null) window.clearTimeout(inlineExpandTimerRef.current);
      inlineExpandTimerRef.current = null;
      setInlineStatementId(null);
      setInlineStatementOrigin(null);
      setInlineTransitionPhase("idle");
      setReplyTarget(null);
      setCommentText("");
    }
  }, [inlineRouteActive, inlineStatementExpanded, inlineStatementId, inlineTransitionPhase, routedStatementId]);

  useEffect(() => {
    if (!inlineStatementExpanded || desktopWorkspace) return;
    document.documentElement.classList.add("square-inline-focus-open");
    return () => document.documentElement.classList.remove("square-inline-focus-open");
  }, [desktopWorkspace, inlineStatementExpanded]);

  const sendComment = async () => {
    const content = commentText.trim();
    if (commentStatementId === null || !content || commentSending) return;
    setCommentSending(true);
    try {
      const comment = await api.createSquareStatementComment(commentStatementId, content, replyTarget?.comment_id, anonymousComment);
      const rootId = comment.root_id ?? replyTarget?.root_id ?? replyTarget?.comment_id;
      setComments((current) => replyTarget
        ? current.map((item) => item.comment_id === rootId ? { ...item, reply_count: item.reply_count + 1, replies: [...(item.replies ?? []), comment] } : item)
        : [comment, ...current]);
      setStatements((current) => current.map((statement) => statement.statement_id === commentStatementId
        ? { ...statement, comment_count: (statement.comment_count || 0) + 1 }
        : statement));
      setCommentText("");
      setReplyTarget(null);
      setAnonymousComment(canCommentAnonymously);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : t("square.commentFailed"));
    } finally {
      setCommentSending(false);
    }
  };

  const beginCommentReply = (comment: SquareStatementCommentDTO) => {
    setReplyTarget(comment);
    if (canCommentAnonymously) setAnonymousComment(true);
    window.requestAnimationFrame(() => commentInputRef.current?.focus({ preventScroll: true }));
  };

  const choosePhotos = (files: FileList | null) => {
    if (!files) return;
    const available = MAX_PHOTOS - photos.length;
    const next = Array.from(files).filter((file) => file.type.startsWith("image/")).slice(0, available).map((file) => ({
      id: `${file.name}:${file.size}:${file.lastModified}:${crypto.randomUUID()}`,
      file,
      preview: URL.createObjectURL(file),
    }));
    setPhotos((current) => [...current, ...next]);
    setVideo((current) => { if (current) URL.revokeObjectURL(current.preview); return null; });
    setVoiceFile(null);
    setVoiceDuration(0);
    if (photoInputRef.current) photoInputRef.current.value = "";
  };

  const chooseVideo = (files: FileList | null) => {
    const file = files?.[0];
    if (!file?.type.startsWith("video/")) return;
    const preview = URL.createObjectURL(file);
    const probe = document.createElement("video");
    probe.preload = "metadata";
    probe.src = preview;
    probe.onloadedmetadata = () => {
      const duration = Math.ceil(probe.duration || 0);
      if (duration > MAX_VIDEO_SECONDS) {
        URL.revokeObjectURL(preview);
        setError(t("square.videoTooLong"));
        return;
      }
      setPhotos((current) => { current.forEach((photo) => URL.revokeObjectURL(photo.preview)); return []; });
      setVoiceFile(null);
      setVideo({ id: crypto.randomUUID(), file, preview, duration });
    };
    if (videoInputRef.current) videoInputRef.current.value = "";
  };

  const removePhoto = (id: string) => {
    setPhotos((current) => {
      const target = current.find((photo) => photo.id === id);
      if (target) URL.revokeObjectURL(target.preview);
      return current.filter((photo) => photo.id !== id);
    });
  };

  const stopRecording = () => recorderRef.current?.state === "recording" && recorderRef.current.stop();

  const startRecording = async () => {
    if (recording) {
      stopRecording();
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      recorderStreamRef.current = stream;
      recorderRef.current = recorder;
      recorderChunksRef.current = [];
      recordingStartedAtRef.current = Date.now();
      recorder.addEventListener("dataavailable", (event) => event.data.size && recorderChunksRef.current.push(event.data));
      recorder.addEventListener("stop", () => {
        const duration = Math.max(1, Math.min(MAX_AUDIO_SECONDS, Math.round((Date.now() - recordingStartedAtRef.current) / 1000)));
        const blob = new Blob(recorderChunksRef.current, { type: recorder.mimeType || "audio/webm" });
        setPhotos((current) => { current.forEach((photo) => URL.revokeObjectURL(photo.preview)); return []; });
        setVideo((current) => { if (current) URL.revokeObjectURL(current.preview); return null; });
        setVoiceFile(new File([blob], `statement-${Date.now()}.webm`, { type: blob.type }));
        setVoiceDuration(duration);
        setRecording(false);
        stream.getTracks().forEach((track) => track.stop());
        if (recordingTimerRef.current !== null) window.clearInterval(recordingTimerRef.current);
      });
      recorder.start(250);
      setVoiceDuration(0);
      setRecording(true);
      recordingTimerRef.current = window.setInterval(() => {
        const elapsed = Math.floor((Date.now() - recordingStartedAtRef.current) / 1000);
        setVoiceDuration(elapsed);
        if (elapsed >= MAX_AUDIO_SECONDS) stopRecording();
      }, 500);
    } catch {
      setError(t("square.recordingFailed"));
    }
  };

  const publish = async () => {
    if (!publishable) return;
    setPublishing(true);
    setError("");
    const total = photos.length + (voiceFile ? 1 : 0) + (video ? 1 : 0);
    let completed = 0;
    try {
      if (chatRecordDraft) {
        const statement = await api.createSquareChatRecordStatement({
          message_ids: chatRecordDraft.messageIds,
          text: text.trim(),
          visibility,
          location: statementLocation,
          pin: pinOnPublish ? 1 : 0,
          redact_chat_record: chatRecordDraft.redacted ? 1 : 0,
        });
        setStatements((current) => [statement, ...current]);
        if (pinOnPublish) setPinnedStatement(statement);
        setText("");
        setVisibility("public");
        setStatementLocation(null);
        setPinOnPublish(false);
        setChatRecordDraft(null);
        setComposerOpen(false);
        void refreshActivities();
        showToast(t("message.forwardedToSquare"), "success");
        return;
      }
      const media: SquareStatementDraftMedia[] = [];
      for (const photo of photos) {
        const upload = await uploadMessageMediaWith(photo.file, "image", (kind, fileName, contentType) => api.createSquareUpload(kind as "image", fileName, contentType), (progress) => {
          setUploadProgress((completed + progress) / Math.max(1, total));
        });
        media.push({
          kind: "image",
          key: upload.key,
          mime_type: photo.file.type,
        });
        completed += 1;
      }
      if (voiceFile) {
        const upload = await uploadMessageMediaWith(voiceFile, "audio", (kind, fileName, contentType) => api.createSquareUpload(kind as "audio", fileName, contentType), (progress) => {
          setUploadProgress((completed + progress) / Math.max(1, total));
        });
        media.push({ kind: "audio", key: upload.key, mime_type: voiceFile.type, duration_seconds: voiceDuration });
        completed += 1;
      }
      if (video) {
        const upload = await uploadMessageMediaWith(video.file, "video", (kind, fileName, contentType) => api.createSquareUpload(kind as "video", fileName, contentType), (progress) => {
          setUploadProgress((completed + progress) / Math.max(1, total));
        });
        media.push({ kind: "video", key: upload.key, mime_type: video.file.type, duration_seconds: video.duration });
      }
      const statement = await api.createSquareStatement({ text: text.trim(), visibility: anonymousStatement ? "public" : visibility, media, location: statementLocation, pin: pinOnPublish ? 1 : 0, anonymous: anonymousStatement ? 1 : 0 });
      setStatements((current) => [statement, ...current]);
      if (pinOnPublish) setPinnedStatement(statement);
      photos.forEach((photo) => URL.revokeObjectURL(photo.preview));
      setText("");
      setPhotos([]);
      setVoiceFile(null);
      setVoiceDuration(0);
      setVisibility("public");
      setAnonymousStatement(false);
      setStatementLocation(null);
      setPinOnPublish(false);
      if (video) URL.revokeObjectURL(video.preview);
      setVideo(null);
      setComposerOpen(false);
      void refreshActivities();
    } catch (cause) {
      setError(toMessageUploadError(cause).message);
    } finally {
      setPublishing(false);
      setUploadProgress(0);
    }
  };

  const locateStatement = () => {
    if (!navigator.geolocation) {
      setError(t("square.locationUnsupported"));
      return;
    }
    setLocationLoading(true);
    setError("");
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        void api.resolveSquareLocation(coords.latitude, coords.longitude)
          .then(setStatementLocation)
          .catch(() => setStatementLocation({ latitude: coords.latitude, longitude: coords.longitude, address: "" }))
          .finally(() => setLocationLoading(false));
      },
      () => {
        setLocationLoading(false);
        setError(t("square.locationFailed"));
      },
      { enableHighAccuracy: true, maximumAge: 60_000, timeout: 12_000 },
    );
  };

  const toggleStatementLike = async (statement: SquareStatementDTO) => {
    if (!canPublish) return;
    const liked = !statement.liked;
    setStatements((current) => current.map((item) => item.statement_id === statement.statement_id ? { ...item, liked, like_count: Math.max(0, item.like_count + (liked ? 1 : -1)) } : item));
    try {
      const result = await api.setSquareStatementLike(statement.statement_id, liked);
      setStatements((current) => current.map((item) => item.statement_id === statement.statement_id ? { ...item, ...result } : item));
    } catch {
      setStatements((current) => current.map((item) => item.statement_id === statement.statement_id ? statement : item));
    }
  };

  const toggleStatementPinned = async (statement: SquareStatementDTO) => {
    if (!statement.can_pin) return;
    const nextPinned = !statement.is_pinned;
    try {
      const updated = await api.setSquareStatementPinned(statement.statement_id, nextPinned);
      const normalized = { ...updated, is_pinned: nextPinned };
      setPinnedStatement(nextPinned ? normalized : null);
      setStatements((current) => current.map((item) => ({
        ...item,
        is_pinned: nextPinned && item.statement_id === normalized.statement_id,
      })));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : t("square.pinFailed"));
    }
  };

  const confirmDeleteStatement = async () => {
    if (deleteStatementId === null || deletingStatement) return;
    const id = deleteStatementId;
    setDeletingStatement(true);
    try {
      await api.deleteSquareStatement(id);
      setStatements((current) => current.filter((item) => item.statement_id !== id));
      if (pinnedStatement?.statement_id === id) setPinnedStatement(null);
      if (commentStatementId === id) navigate("/app/square", { replace: true });
      setDeleteStatementId(null);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : t("square.deleteFailed"));
    } finally {
      setDeletingStatement(false);
    }
  };

  const confirmMuteStatementAuthor = async () => {
    if (!muteStatement || !muteReason.trim() || mutingAuthor) return;
    setMutingAuthor(true);
    try {
      await api.muteSquareStatementAuthor(muteStatement.statement_id, muteDuration, muteReason.trim());
      showToast(t("square.muteApplied"), "success");
      setMuteStatement(null);
      setMuteReason("");
      setMuteDuration("1d");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : t("square.muteFailed"));
    } finally {
      setMutingAuthor(false);
    }
  };

  const toggleCommentLike = async (comment: SquareStatementCommentDTO) => {
    if (!canPublish) return;
    const liked = !comment.liked;
    const updateComment = (items: SquareStatementCommentDTO[], patch: Partial<SquareStatementCommentDTO>): SquareStatementCommentDTO[] => items.map((item): SquareStatementCommentDTO => item.comment_id === comment.comment_id
      ? { ...item, ...patch }
      : { ...item, replies: item.replies ? updateComment(item.replies, patch) : item.replies });
    setComments((current) => updateComment(current, { liked, like_count: Math.max(0, comment.like_count + (liked ? 1 : -1)) }));
    try {
      const result = await api.setSquareCommentLike(comment.comment_id, liked);
      setComments((current) => updateComment(current, result));
    } catch {
      setComments((current) => updateComment(current, comment));
    }
  };

  const confirmDeleteComment = async () => {
    if (!deleteCommentTarget || deletingComment) return;
    const target = deleteCommentTarget;
    setDeletingComment(true);
    try {
      const result = await api.deleteSquareComment(target.comment_id);
      setComments((current) => result.root_deleted
        ? current.filter((comment) => comment.comment_id !== target.comment_id)
        : current.map((comment) => ({
          ...comment,
          reply_count: comment.replies?.some((reply) => reply.comment_id === target.comment_id)
            ? Math.max(0, comment.reply_count - 1)
            : comment.reply_count,
          replies: comment.replies?.filter((reply) => reply.comment_id !== target.comment_id),
        })));
      setStatements((current) => current.map((statement) => statement.statement_id === result.statement_id
        ? { ...statement, comment_count: Math.max(0, statement.comment_count - result.deleted_count) }
        : statement));
      if (replyTarget?.comment_id === target.comment_id || result.root_deleted && replyTarget?.root_id === target.comment_id) {
        setReplyTarget(null);
      }
      setDeleteCommentTarget(null);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : t("square.deleteCommentFailed"));
    } finally {
      setDeletingComment(false);
    }
  };

  const discussionContent = (
    <section className="square-discussion-section">
      <div className="square-comments-heading">
        <div><strong>{t("square.comments")}</strong><span>{activeCommentStatement?.comment_count ?? 0}</span></div>
        {comments.length ? <div className="square-comments-sort" role="group" aria-label={t("square.commentSortLabel")}><button className={commentSort === "hot" ? "is-active" : ""} onClick={() => setCommentSort("hot")} type="button">{t("square.commentsHot")}</button><button className={commentSort === "latest" ? "is-active" : ""} onClick={() => setCommentSort("latest")} type="button">{t("square.commentsLatest")}</button></div> : null}
      </div>
      {commentsLoading && !comments.length ? <ContentLoader label={t("common.loading")} rows={3} /> : null}
      {!commentsLoading && !comments.length ? <div className="square-comments-empty"><span className="material-symbols-outlined">forum</span><strong>{t("square.noComments")}</strong><p>{canPublish ? t("square.noCommentsHint") : t("square.readOnlyHint")}</p></div> : null}
      <div className={`square-comment-list${commentsLoading && comments.length ? " is-refreshing" : ""}`}>{comments.map((comment) => <CommentThread canInteract={canPublish} comment={comment} expanded={expandedCommentId === comment.comment_id} key={comment.comment_id} onDelete={setDeleteCommentTarget} onLike={(target) => void toggleCommentLike(target)} onOpenProfile={setProfileDrawerUserId} onReply={beginCommentReply} onToggleReplies={(commentId) => setExpandedCommentId((current) => current === commentId ? null : commentId)} />)}</div>
      {commentsHasMore ? <button className="square-load-more" disabled={commentsLoading} onClick={() => {
        if (commentStatementId === null) return;
        setCommentsLoading(true);
        void api.getSquareStatementComments(commentStatementId, { offset: comments.length, limit: 30, sort: commentSort }).then((rows) => { setComments((current) => [...current, ...rows]); setCommentsHasMore(rows.length === 30); }).finally(() => setCommentsLoading(false));
      }} type="button">{t("square.loadMoreComments")}</button> : null}
    </section>
  );

  const commentComposer = canPublish ? <form className={`square-comment-composer${anonymousComment ? " is-anonymous" : ""}`} onSubmit={(event) => { event.preventDefault(); if (canCommentAnonymously && !anonymousComment) setPublicCommentConfirmOpen(true); else void sendComment(); }}>{anonymousComment ? <span className="square-anonymous-avatar square-comment-avatar"><span className="material-symbols-outlined">person</span></span> : <UserAvatar className="square-comment-avatar" frame={currentUser?.avatar_frame_style} name={currentUser?.name || ""} uri={currentUser?.avatar_uri} vip={Boolean(currentUser?.is_permanent_vip)} />}<div><input aria-label={t("square.writeComment")} maxLength={MAX_TEXT_LENGTH} onChange={(event) => setCommentText(event.target.value)} placeholder={replyTarget ? t("square.replyPlaceholder", { name: replyTarget.is_anonymous ? t("square.anonymousUser") : replyTarget.user.name }) : t("square.writeComment")} ref={commentInputRef} value={commentText} />{canCommentAnonymously ? <button aria-pressed={anonymousComment} className="square-comment-identity" onClick={() => setAnonymousComment((current) => !current)} type="button">{anonymousComment ? t("square.commentAnonymously") : t("square.commentPublicly")}</button> : null}</div><button disabled={!commentText.trim() || commentSending} type="submit"><span className="material-symbols-outlined">arrow_upward</span></button></form> : null;

  return (
    <AppChrome title={t("square.title")} hideTopbar shellClassName="desktop-tab-shell square-community-shell">
      <div className={`square-desktop-workspace${inlineRouteActive ? " has-selection" : ""}`}>
      <main className="list-screen square-feed-screen">
        <TabPageHeader
          syncing={syncing}
          title={t("square.title")}
          secondary={<div className="square-feed-filter" role="tablist">
            {features.squareExploreEnabled ? <button aria-selected={feedMode === "all"} className={feedMode === "all" ? "is-active" : ""} onClick={() => setFeedMode("all")} role="tab" type="button">{t("square.feedAll")}{feedFresh.all && feedMode !== "all" ? <i className="square-fresh-dot" /> : null}</button> : null}
            <button aria-selected={feedMode === "friends"} className={feedMode === "friends" ? "is-active" : ""} onClick={() => setFeedMode("friends")} role="tab" type="button">{t("square.feedFriends")}{feedFresh.friends && feedMode !== "friends" ? <i className="square-fresh-dot" /> : null}</button>
            <button aria-selected={feedMode === "mine"} className={feedMode === "mine" ? "is-active" : ""} onClick={() => setFeedMode("mine")} role="tab" type="button">{t("square.feedMine")}</button>
            {profileFeedUserId ? (
              <span className={`square-feed-user-tab${feedMode === "user" ? " is-active" : ""}`}>
                <button aria-selected={feedMode === "user"} onClick={() => setFeedMode("user")} role="tab" title={profileFeedUserName} type="button">{profileFeedUserName}</button>
                <button aria-label={t("square.closeUserFeed", { name: profileFeedUserName })} className="square-feed-user-close" onClick={() => {
                  const next = new URLSearchParams(searchParams);
                  next.delete("user_id");
                  next.delete("user_name");
                  setSearchParams(next, { replace: true });
                  setFeedMode("mine");
                }} type="button"><span className="material-symbols-outlined">close</span></button>
              </span>
            ) : null}
          </div>}
          actions={<div className="square-header-actions">
            <button aria-label={t("square.quotaTitle")} className="square-header-quota" onClick={openQuota} type="button">
              <span className="material-symbols-outlined">data_usage</span>
            </button>
            <button aria-label={t("square.notifications")} className="square-header-notifications" onClick={openNotificationDrawer} type="button">
              <span className="material-symbols-outlined">notifications</span>
              {notificationUnread ? <i>{notificationUnread > 99 ? "99+" : notificationUnread}</i> : null}
            </button>
            {canPublish ? (
              <button className="square-header-publish" onClick={() => setComposerOpen(true)} type="button">
                <span className="material-symbols-outlined">edit_square</span>
                <span>{t("square.publish")}</span>
              </button>
            ) : null}
          </div>}
        />
        <div className="square-feed-column">
          {feedMode === "all" && activityBannerCount ? <div className="square-activity-carousel"><section className="square-activity-rail" aria-label={t("activity.active")} onScroll={(event) => {
            const track = event.currentTarget;
            const slides = Array.from(track.children) as HTMLElement[];
            const nearest = slides.reduce((best, slide, index) => Math.abs(slide.offsetLeft - track.offsetLeft - track.scrollLeft) < Math.abs(slides[best].offsetLeft - track.offsetLeft - track.scrollLeft) ? index : best, 0);
            setActivityBannerSlide(nearest);
          }} ref={activityBannerTrackRef}>
            {activities.slice(0, 1).map((activity) => {
              const title = language === "zh-CN" ? activity.title : activity.title_en || activity.title;
              const days = Math.max(1, Math.ceil((activity.ends_at * 1000 - Date.now()) / 86400000));
              return <button className="square-activity-banner" key={activity.key} onClick={() => navigate(`/app/square/activities/${activity.key}`)} type="button">
                {claimableActivityKeys.includes(activity.key) ? <i className="square-activity-claim-dot" /> : null}
                <img alt={title} className="square-activity-banner-art" src={baxianActivityBanner} />
                <span className="square-activity-banner-copy">
                  <small>{t("activity.spaceCoop")} · {t("activity.daysLeft", { count: days })}</small>
                  <span><b>{activity.space_total}</b><i>/</i>{activity.target} {t("activity.force")}</span>
                </span>
                <span className="square-activity-banner-enter"><span>{t("activity.enter")}</span><span className="material-symbols-outlined">arrow_forward</span></span>
                <span className="square-activity-banner-progress"><i style={{ transform: `scaleX(${Math.min(1, activity.space_total / Math.max(1, activity.target))})` }} /></span>
              </button>;
            })}
            {showVipCampaign && vipCampaign ? <button className={`square-activity-banner is-vip${vipCampaign.claimed_by_user ? " is-claimed" : ""}`} onClick={() => setVipCampaignOpen(true)} type="button">
              {claimableActivityKeys.includes("vip:founding-100") ? <i className="square-activity-claim-dot" /> : null}
              <span className="square-vip-banner-orbit" aria-hidden="true"><i /><i /><b>VIP</b></span>
              <span className="square-vip-banner-copy">
                <small>FOUNDING 100</small>
                <strong>{vipCampaign.claimed_by_user ? t("vip.claimedTitle") : t("vip.title")}</strong>
                <span>{vipCampaign.claimed_by_user ? t("vip.claimedSlot", { slot: vipCampaign.slot ?? "-" }) : t("vip.remaining", { count: vipCampaign.remaining })}</span>
              </span>
              <span className="square-activity-banner-enter"><span>{t("activity.enter")}</span><span className="material-symbols-outlined">arrow_forward</span></span>
            </button> : null}
            {activities.slice(1).map((activity) => {
              const title = language === "zh-CN" ? activity.title : activity.title_en || activity.title;
              const days = Math.max(1, Math.ceil((activity.ends_at * 1000 - Date.now()) / 86400000));
              return <button className="square-activity-banner" key={activity.key} onClick={() => navigate(`/app/square/activities/${activity.key}`)} type="button">
                {claimableActivityKeys.includes(activity.key) ? <i className="square-activity-claim-dot" /> : null}
                <img alt={title} className="square-activity-banner-art" src={baxianActivityBanner} />
                <span className="square-activity-banner-copy">
                  <small>{t("activity.spaceCoop")} · {t("activity.daysLeft", { count: days })}</small>
                  <span><b>{activity.space_total}</b><i>/</i>{activity.target} {t("activity.force")}</span>
                </span>
                <span className="square-activity-banner-enter"><span>{t("activity.enter")}</span><span className="material-symbols-outlined">arrow_forward</span></span>
                <span className="square-activity-banner-progress"><i style={{ transform: `scaleX(${Math.min(1, activity.space_total / Math.max(1, activity.target))})` }} /></span>
              </button>;
            })}
          </section>{activityBannerCount > 1 ? <div className="square-activity-pagination" aria-label={t("activity.active")}>{Array.from({ length: activityBannerCount }, (_, index) => <button aria-current={activityBannerSlide === index ? "true" : undefined} className={activityBannerSlide === index ? "is-active" : ""} key={index} onClick={() => {
            const track = activityBannerTrackRef.current;
            const slide = track?.children[index] as HTMLElement | undefined;
            if (track && slide) track.scrollTo({ behavior: "smooth", left: slide.offsetLeft - track.offsetLeft });
          }} type="button" />)}</div> : null}</div> : null}
          {feedMode === "all" && pinnedStatement ? (
            <button className="square-pinned-banner" onClick={() => openStatementDrawer(pinnedStatement.statement_id)} type="button">
              <span className="square-pinned-mark"><span className="material-symbols-outlined">keep</span></span>
              <UserAvatar className="square-pinned-avatar" frame={pinnedStatement.user.avatar_frame_style} name={pinnedStatement.user.name} uri={pinnedStatement.user.avatar_uri} vip={Boolean(pinnedStatement.user.is_permanent_vip)} />
              <span className="square-pinned-copy"><small>{t("square.pinnedStatement")}</small><strong>{pinnedStatement.text || t("square.mediaStatement")}</strong></span>
              <span className="material-symbols-outlined">chevron_right</span>
            </button>
          ) : null}
          {!canPublish ? (
            <section className="square-readonly-notice">
              <span className="material-symbols-outlined">visibility</span>
              <div><strong>{t("square.readOnlyTitle")}</strong><p>{t("square.readOnlyHint")}</p></div>
            </section>
          ) : null}
          {error ? <div className="square-inline-error">{error}</div> : null}
          {loading ? <ContentLoader label={t("common.loading")} rows={2} /> : null}
          {!loading && !statements.length && !error ? (
            <QuietState
              icon={feedMode === "mine" ? "edit_note" : "explore"}
              title={feedMode === "user" ? t("square.userFeedEmpty", { name: profileFeedUserName }) : feedMode === "mine" ? t("square.mineEmpty") : t("square.empty")}
              description={feedMode === "user" ? t("square.userFeedEmptyHint") : feedMode === "mine" ? t("square.mineEmptyHint") : t("square.emptyHint")}
            />
          ) : null}
          <section className="square-statement-feed">
            {statements.filter((statement) => !(feedMode === "all" && statement.statement_id === pinnedStatement?.statement_id)).map((statement) => {
              const focused = inlineStatementId === statement.statement_id;
              const transitionStyle = focused && inlineStatementOrigin ? {
                "--square-inline-origin-left": `${inlineStatementOrigin.left}px`,
                "--square-inline-origin-top": `${inlineStatementOrigin.top}px`,
                "--square-inline-origin-width": `${inlineStatementOrigin.width}px`,
              } as CSSProperties : undefined;
              const showInlinePlaceholder = focused && inlineStatementExpanded && !desktopWorkspace && inlineStatementOrigin;
              return <Fragment key={statement.statement_id}>
                {showInlinePlaceholder ? <div aria-hidden="true" className="square-inline-statement-placeholder" style={{ height: inlineStatementOrigin.height }} /> : null}
                <div className={`square-inline-statement${focused ? " is-focused" : ""}${focused && inlineStatementExpanded && !desktopWorkspace ? ` is-expanded is-${inlineTransitionPhase}` : ""}`} style={transitionStyle}>
                {focused && inlineStatementExpanded && !desktopWorkspace ? <header className="square-inline-detail-header" onClick={(event) => event.stopPropagation()}>
                  <button aria-label={t("common.back")} onClick={closeInlineStatement} type="button"><span className="material-symbols-outlined">arrow_back</span></button>
                  <strong>{t("square.statementDetail")}</strong>
                  <span aria-hidden="true" />
                </header> : null}
                <StatementCard canInteract={canPublish} cardRef={(node) => { if (node) statementCardRefs.current.set(statement.statement_id, node); else statementCardRefs.current.delete(statement.statement_id); }} chatBackgroundTheme={currentUser?.chat_background_theme} chatBackgroundUri={currentUser?.chat_background_uri} onDelete={() => setDeleteStatementId(statement.statement_id)} onLike={() => void toggleStatementLike(statement)} onMute={() => setMuteStatement(statement)} onOpen={() => { if (!focused) openStatement(statement.statement_id); }} onOpenChatImage={(uris, index, metadata = []) => setChatRecordGallery({ uris, index, metadata })} onOpenChatVideo={(uri, metadata) => setChatRecordVideo({ uri, metadata })} onOpenImage={(index) => openStatementImages(statement.statement_id, index)} onOpenLocation={() => statement.location && setChatRecordLocation({ location: statement.location, owner: statement.user })} onOpenProfile={() => setProfileDrawerUserId(statement.user.user_id)} onOpenVideo={() => openStatementVideo(statement.statement_id)} onPin={() => void toggleStatementPinned(statement)} onShare={() => openStatementShare(statement)} statement={statement} />
                {focused && inlineStatementExpanded && !desktopWorkspace ? <div className="square-inline-discussion">{discussionContent}</div> : null}
                </div>
              </Fragment>;
            })}
          </section>
          {hasMore && statements.length ? (
            <button className="square-load-more" disabled={loadingMore} onClick={() => {
              setLoadingMore(true);
              void loadStatements(statements[statements.length - 1]?.statement_id);
            }} type="button">{loadingMore ? t("common.loading") : t("square.loadMore")}</button>
          ) : null}
        </div>
      </main>
      <aside className="square-desktop-detail-pane" aria-label={t("square.statementDetail")}>
        {inlineRouteActive && activeCommentStatement ? <section className="square-desktop-detail-card">
          <div className="square-desktop-detail-scroll">
            <div className="square-statement-detail-stage">
              <StatementCard canInteract={canPublish} chatBackgroundTheme={currentUser?.chat_background_theme} chatBackgroundUri={currentUser?.chat_background_uri} detail onDelete={() => setDeleteStatementId(activeCommentStatement.statement_id)} onLike={() => void toggleStatementLike(activeCommentStatement)} onMute={() => setMuteStatement(activeCommentStatement)} onOpen={() => undefined} onOpenChatImage={(uris, index, metadata = []) => setChatRecordGallery({ uris, index, metadata })} onOpenChatVideo={(uri, metadata) => setChatRecordVideo({ uri, metadata })} onOpenImage={(index) => openStatementImages(activeCommentStatement.statement_id, index)} onOpenLocation={() => activeCommentStatement.location && setChatRecordLocation({ location: activeCommentStatement.location, owner: activeCommentStatement.user })} onOpenProfile={() => setProfileDrawerUserId(activeCommentStatement.user.user_id)} onOpenVideo={() => openStatementVideo(activeCommentStatement.statement_id)} onPin={() => void toggleStatementPinned(activeCommentStatement)} onShare={() => openStatementShare(activeCommentStatement)} statement={activeCommentStatement} />
            </div>
            {discussionContent}
          </div>
          {commentComposer}
        </section> : <section className="square-desktop-detail-empty">
          <span className="material-symbols-outlined">forum</span>
          <strong>{t("square.desktopSelectStatement")}</strong>
          <p>{t("square.desktopSelectStatementHint")}</p>
        </section>}
      </aside>
      </div>
      {inlineStatementExpanded && !desktopWorkspace && typeof document !== "undefined" ? createPortal(<button aria-label={t("common.close")} className={`square-inline-focus-mask is-${inlineTransitionPhase}`} onClick={closeInlineStatement} type="button" />, document.body) : null}
      {inlineStatementExpanded && !desktopWorkspace ? <div className={`square-inline-comment-dock is-${inlineTransitionPhase}`}>{commentComposer}</div> : null}
      <SideDrawer historyKey="square-notifications" onRouteOpen={() => setNotificationDrawerOpen(true)} onClose={() => setNotificationDrawerOpen(false)} open={notificationDrawerOpen} title={t("square.notifications")}>
        <div className="square-notification-list">
          {!notificationEvents.length ? <QuietState icon="notifications_none" title={t("square.noNotifications")} /> : notificationEvents.map((event) => {
            const actor = event.actor?.name || t("square.someone");
            const removed = event.event_type === 9;
            const label = removed ? t("square.notificationStatementRemoved")
              : event.topic === 2 ? t("square.notificationLikedStatement", { name: actor })
              : event.topic === 3 ? t("square.notificationCommented", { name: actor })
                : event.topic === 4 ? t("square.notificationLikedComment", { name: actor })
                  : t("square.notificationReplied", { name: actor });
            return (
              <button
                className={`square-notification-row${event.is_read ? "" : " is-unread"}${removed ? " is-system" : ""}`}
                key={event.notification_event_id}
                onClick={() => {
                  const statementId = event.payload.statement_id;
                  setNotificationDrawerOpen(false);
                  if (statementId && !removed) openStatementDrawer(statementId);
                }}
                type="button"
              >
                <UserAvatar className="square-notification-avatar" frame={event.actor?.avatar_frame_style} name={actor} uri={event.actor?.avatar_uri} vip={Boolean(event.actor?.is_permanent_vip)} />
                <span><strong>{label}</strong>{removed && event.payload.statement_excerpt ? <small className="square-notification-excerpt">“{event.payload.statement_excerpt}”</small> : null}<small>{formatStatementTime(event.created_at, language)}</small></span>
                <span className="material-symbols-outlined">{removed ? "info" : "chevron_right"}</span>
              </button>
            );
          })}
          {notificationHistoryAvailable ? <button className="square-notification-history" disabled={notificationHistoryLoading} onClick={loadEarlierNotifications} type="button">{notificationHistoryLoading ? t("common.loading") : t("square.showEarlierNotifications")}</button> : null}
        </div>
      </SideDrawer>
      <SideDrawer
        className="square-compose-side-drawer"
        historyKey="square-compose"
        onRouteOpen={() => setComposerOpen(true)}
        onClose={() => { setComposerOpen(false); setChatRecordDraft(null); }}
        open={composerOpen}
        title={t("square.composeTitle")}
      >
        <div className="square-compose-drawer">
          <div className="square-compose-canvas">
            {error ? <div className="square-inline-error">{error}</div> : null}
            <div className="square-compose-editor">
              <UserAvatar className="square-composer-avatar" frame={currentUser?.avatar_frame_style} name={currentUser?.name || ""} uri={currentUser?.avatar_uri} vip={Boolean(currentUser?.is_permanent_vip)} />
              <strong>{currentUser?.name}</strong>
            </div>
            <div className="square-compose-writing-zone">
              <textarea autoFocus aria-label={t("square.saySomething")} maxLength={MAX_TEXT_LENGTH} onChange={(event) => setText(event.target.value)} placeholder={t("square.saySomething")} value={text} />
              <span className={`square-compose-count${text.length >= MAX_TEXT_LENGTH - 20 ? " is-near-limit" : ""}`}>{text.length}<i>/{MAX_TEXT_LENGTH}</i></span>
            </div>
            {chatRecordDraft ? <div className="square-compose-chat-record">
              <span className="material-symbols-outlined" aria-hidden="true">dynamic_feed</span>
              <div><strong>{t("message.forwardBundleTitle")}</strong><small>{t("message.forwardBundleCount", { count: chatRecordDraft.messageIds.length })}</small></div>
              <button aria-label={t("common.close")} onClick={() => setChatRecordDraft(null)} type="button"><span className="material-symbols-outlined">close</span></button>
            </div> : null}
            {photos.length ? <div className="square-composer-photos">{photos.map((photo) => <button key={photo.id} onClick={() => removePhoto(photo.id)} type="button"><img alt="" src={photo.preview} /><span className="material-symbols-outlined">close</span></button>)}</div> : null}
            {video ? <div className="square-composer-video"><video muted playsInline src={video.preview} /><button onClick={() => { URL.revokeObjectURL(video.preview); setVideo(null); }} type="button"><span className="material-symbols-outlined">close</span></button><span>{video.duration}s</span></div> : null}
            {voiceFile ? <div className="square-composer-voice"><span className="material-symbols-outlined">graphic_eq</span><div><strong>{t("square.voiceReady")}</strong>{voicePreview ? <audio controls preload="metadata" src={voicePreview} /> : null}</div><span>{voiceDuration}s</span><button onClick={() => { setVoiceFile(null); setVoiceDuration(0); }} type="button"><span className="material-symbols-outlined">close</span></button></div> : null}
            {statementLocation ? <button className="square-compose-location-pill is-active" onClick={() => setStatementLocation(null)} type="button"><span className="material-symbols-outlined">location_on</span><span>{statementLocation.address || t("square.locationAddedShort")}</span><span className="material-symbols-outlined">close</span></button> : null}
            {publishing ? <div className="square-publish-progress"><i style={{ width: `${Math.round(uploadProgress * 100)}%` }} /></div> : null}
            <div className="square-compose-content-actions">
              {!chatRecordDraft ? <button onClick={() => setContentSheetOpen(true)} type="button"><span className="material-symbols-outlined">add_circle</span><span>{photos.length ? t("square.photosAdded", { count: photos.length }) : voiceFile ? t("square.voiceReady") : video ? t("square.videoReady") : t("square.addMedia")}</span></button> : null}
              {!statementLocation ? <button disabled={locationLoading} onClick={locateStatement} type="button"><span className={`material-symbols-outlined${locationLoading ? " is-spinning" : ""}`}>{locationLoading ? "progress_activity" : "location_on"}</span><span>{locationLoading ? t("square.locating") : t("square.location")}</span></button> : null}
            </div>
            <div className="square-compose-settings">
              <button disabled={anonymousStatement} onClick={() => setVisibilitySheetOpen(true)} type="button"><span className="material-symbols-outlined">{visibility === "friends" ? "group" : "public"}</span><div><strong>{t("square.visibility")}</strong><small>{anonymousStatement ? t("square.exploreOnly") : visibility === "friends" ? t("square.friendsOnly") : t("square.public")}</small></div><span className="material-symbols-outlined">chevron_right</span></button>
              {features.squareExploreEnabled && !chatRecordDraft ? <button aria-checked={anonymousStatement} className="square-compose-anonymous-row" onClick={() => { setAnonymousStatement((current) => !current); setVisibility("public"); }} role="switch" type="button"><span className="square-anonymous-avatar"><span className="material-symbols-outlined">person</span></span><div><strong>{t("square.publishAnonymously")}</strong><small>{t("square.publishAnonymouslyHint")}</small></div><i className={anonymousStatement ? "is-on" : ""}><span /></i></button> : null}
              {chatRecordDraft ? <button aria-checked={chatRecordDraft.redacted} className="square-compose-anonymous-row" onClick={() => setChatRecordDraft((current) => current ? { ...current, redacted: !current.redacted } : null)} role="switch" type="button"><span className="square-anonymous-avatar"><span className="material-symbols-outlined">person</span></span><div><strong>{t("message.forwardToSquareRedact")}</strong><small>{t("message.forwardToSquareRedactHint")}</small></div><i className={chatRecordDraft.redacted ? "is-on" : ""}><span /></i></button> : null}
              {currentUser?.official ? <button aria-checked={pinOnPublish} className="square-compose-pin-row" onClick={() => setPinOnPublish((current) => !current)} role="switch" type="button"><span className="material-symbols-outlined">keep</span><div><strong>{t("square.pinOnPublish")}</strong><small>{t("square.pinOnPublishHint")}</small></div><i className={pinOnPublish ? "is-on" : ""}><span /></i></button> : null}
            </div>
          </div>
          <footer className="square-compose-publish-footer">
            <button disabled={!publishable || publishing} onClick={() => void publish()} type="button"><span className="square-compose-publish-copy"><small>{t("square.publishToSquare")}</small><strong>{publishing ? t("square.publishing") : t("square.publishStatement")}</strong></span><span className="material-symbols-outlined">arrow_upward</span></button>
          </footer>
          <input accept="image/*" hidden multiple onChange={(event) => choosePhotos(event.target.files)} ref={photoInputRef} type="file" />
          <input accept="video/*" hidden onChange={(event) => chooseVideo(event.target.files)} ref={videoInputRef} type="file" />
        </div>
      </SideDrawer>
      <BottomSheet bodyClassName="square-content-sheet" onClose={() => setContentSheetOpen(false)} open={contentSheetOpen} title={t("square.addToStatement")}>
        <button disabled={publishing || photos.length >= MAX_PHOTOS} onClick={() => { setContentSheetOpen(false); photoInputRef.current?.click(); }} type="button"><span className="material-symbols-outlined">image</span><span><strong>{t("square.photo")}</strong><small>{t("square.photoMediaHint")}</small></span><span className="material-symbols-outlined">chevron_right</span></button>
        <button disabled={publishing || !canSendVoice} onClick={() => { setContentSheetOpen(false); setVoiceSheetOpen(true); }} type="button"><span className="material-symbols-outlined">mic</span><span><strong>{t("square.voice")}</strong><small>{canSendVoice ? t("square.voiceMediaHint") : t("square.voiceUnlock")}</small></span><span className="material-symbols-outlined">chevron_right</span></button>
        <button disabled={publishing || !canSendVideo} onClick={() => { setContentSheetOpen(false); videoInputRef.current?.click(); }} type="button"><span className="material-symbols-outlined">videocam</span><span><strong>{t("square.video")}</strong><small>{canSendVideo ? t("square.videoMediaHint") : t("square.videoUnlock")}</small></span><span className="material-symbols-outlined">chevron_right</span></button>
      </BottomSheet>
      <BottomSheet bodyClassName="square-choice-sheet" onClose={() => setVisibilitySheetOpen(false)} open={visibilitySheetOpen} title={t("square.visibility")}>
        {(["public", "friends"] as const).map((value) => <button className={visibility === value ? "is-selected" : ""} key={value} onClick={() => { setVisibility(value); setVisibilitySheetOpen(false); }} type="button"><span className="material-symbols-outlined">{value === "public" ? "public" : "group"}</span><div><strong>{value === "public" ? t("square.public") : t("square.friendsOnly")}</strong><small>{value === "public" ? t("square.publicHint") : t("square.friendsHint")}</small></div><span className="material-symbols-outlined">check</span></button>)}
      </BottomSheet>
      <TravelMapDrawer
        focusLocation={chatRecordLocation?.location}
        focusOwner={chatRecordLocation?.owner}
        historyKey="square-shared-location"
        onClose={() => setChatRecordLocation(null)}
        open={Boolean(chatRecordLocation)}
      />
      <ChatTargetPicker
        busy={sharingChatId !== null}
        busyTargetId={sharingChatId}
        emptyTitle={t("square.noChatsToShare")}
        loading={shareChatsLoading}
        onClose={() => { if (sharingChatId === null) { setShareStatement(null); setShareActivity(null); } }}
        onSubmit={(ids) => { const chat = sortedShareChats.find((item) => item.chat_id === ids[0]); if (chat) return sendStatementToChat(chat); }}
        open={shareStatement !== null || shareActivity !== null}
        targets={shareTargets}
        title={t("square.shareToChat")}
      />
      <BottomSheet bodyClassName="square-voice-sheet" onClose={() => { if (recording) stopRecording(); setVoiceSheetOpen(false); }} open={voiceSheetOpen} title={t("square.voice")}>
        <div className={`square-voice-stage${recording ? " is-recording" : ""}`}><div className="square-voice-bars">{Array.from({ length: 25 }, (_, index) => <i key={index} />)}</div><strong>{Math.min(voiceDuration, MAX_AUDIO_SECONDS)}<small> / {MAX_AUDIO_SECONDS}s</small></strong></div>
        <button className="square-record-button" onClick={() => void startRecording()} type="button"><span className="material-symbols-outlined">{recording ? "stop" : "mic"}</span></button>
        <p>{recording ? t("square.tapToStop") : voiceFile ? t("square.voiceReady") : t("square.tapToRecord")}</p>
        {voicePreview && !recording ? <audio className="square-voice-preview" controls preload="metadata" src={voicePreview} /> : null}
        {voiceFile && !recording ? <button className="primary-button" onClick={() => setVoiceSheetOpen(false)} type="button">{t("common.done")}</button> : null}
      </BottomSheet>
      <SideDrawer historyMode="route" onClose={() => { setReplyTarget(null); if (window.history.length > 1) navigate(-1); else navigate("/app/square", { replace: true }); }} open={routedStatementId !== null && !inlineRouteActive} title={t("square.statementDetail")}>
        <div className="square-comments-drawer">
          <div className="square-comments-scroll">
            <div className="square-statement-detail-stage">
              {activeCommentStatement ? <StatementCard canInteract={canPublish} chatBackgroundTheme={currentUser?.chat_background_theme} chatBackgroundUri={currentUser?.chat_background_uri} detail onDelete={() => setDeleteStatementId(activeCommentStatement.statement_id)} onLike={() => void toggleStatementLike(activeCommentStatement)} onMute={() => setMuteStatement(activeCommentStatement)} onOpen={() => undefined} onOpenChatImage={(uris, index, metadata = []) => setChatRecordGallery({ uris, index, metadata })} onOpenChatVideo={(uri, metadata) => setChatRecordVideo({ uri, metadata })} onOpenImage={(index) => openStatementImages(activeCommentStatement.statement_id, index)} onOpenLocation={() => activeCommentStatement.location && setChatRecordLocation({ location: activeCommentStatement.location, owner: activeCommentStatement.user })} onOpenProfile={() => setProfileDrawerUserId(activeCommentStatement.user.user_id)} onOpenVideo={() => openStatementVideo(activeCommentStatement.statement_id)} onPin={() => void toggleStatementPinned(activeCommentStatement)} onShare={() => openStatementShare(activeCommentStatement)} statement={activeCommentStatement} /> : null}
            </div>
            {discussionContent}
          </div>
          {commentComposer}
        </div>
      </SideDrawer>
      <SideDrawer className="activity-drawer" headerAction={activeActivity ? <button aria-label={t("square.share")} className="activity-drawer-share" onClick={() => openActivityShare(activeActivity)} type="button"><span className="material-symbols-outlined">share</span></button> : null} historyMode="route" onClose={() => navigate("/app/square")} open={Boolean(routeActivityKey)} title={activeActivity ? (language === "zh-CN" ? activeActivity.title : activeActivity.title_en || activeActivity.title) : t("activity.title")} titleAccessory={activeActivity ? <img alt="" className="activity-drawer-title-art" src={baxianActivityTitle} /> : null}>
        {activeActivity ? <div className="activity-detail">
          <div className="activity-detail-masthead">
            <div className="activity-brand-lockup" aria-label={t("activity.coBranding")}><span><img alt="Sermo 言浪" src="/icons/sermo-192.png" /></span><b aria-hidden="true">×</b><img alt={t("activity.baxian")} src={baxianActivityLogo} /></div>
            <div className="activity-detail-index">
              <div><button onClick={() => setActivityRulesOpen(true)} type="button">{t("activity.rules")}</button><i aria-hidden="true" /><button onClick={() => setActivityPoolOpen(true)} type="button">{t("activity.prizePool")}</button></div>
              <time>{formatActivityDateRange(activeActivity.starts_at, activeActivity.ends_at, language)}</time>
            </div>
          </div>
          <section className="activity-detail-visual" />
          <section className="activity-awakening-stage">
            <section className={`activity-personal-quest${activeActivity.personal_reward || activeActivity.personal_reward_claimable ? " is-complete" : ""}`}>
              <div><small>{t("activity.personalQuest")}</small><strong>{activeActivity.personal_reward ? t("activity.personalRewardOwnedNamed", { name: t(BAXIAN_PRIZE_BUBBLES.find((item) => item.style === activeActivity.personal_reward?.resource_key)?.label ?? "menu.collectionBaxian") }) : activeActivity.personal_reward_claimable ? t("activity.personalComplete") : t("activity.personalPostTwice")}</strong>{!activeActivity.personal_reward && !activeActivity.personal_reward_claimable ? <span>{t("activity.personalProgress", { current: Math.min(activeActivity.personal_event_count, activeActivity.personal_event_target), target: activeActivity.personal_event_target })}</span> : null}</div>
              {activeActivity.personal_reward ? <div className="activity-personal-reward"><button onClick={() => navigate("/app/menu?panel=personalization/chat-page&section=bubbles")} type="button">{t("activity.configureReward")}<span className="material-symbols-outlined">arrow_forward</span></button></div> : activeActivity.personal_reward_claimable ? <button className="activity-personal-claim" disabled={personalRewardClaiming} onClick={() => void claimPersonalActivityReward()} type="button">{personalRewardClaiming ? t("common.processing") : t("activity.claimPersonalReward")}</button> : <div className="activity-personal-stamps">{Array.from({ length: activeActivity.personal_event_target }, (_, index) => <i className={index < activeActivity.personal_event_count ? "is-earned" : ""} key={index}><span className="material-symbols-outlined">edit</span></i>)}</div>}
            </section>
            <header><div><small>{t("activity.spaceForce")}</small><strong>{activeActivity.space_total}<span> / {activeActivity.target}</span></strong></div><div className="activity-force-actions">{activeActivity.claimable_points ? <button disabled={activityClaiming || !activeActivity.active} onClick={() => void claimActivityForce()} type="button">{activityClaiming ? t("common.loading") : `${t("activity.claimForce")} · ${activeActivity.claimable_points}`}</button> : null}<button disabled={!activeActivity.available_points || activityContributing || !activeActivity.active} onClick={() => void contributeActivity()} type="button">{activityContributing ? t("common.loading") : `${t("activity.contribute")} · ${activeActivity.available_points}`}</button></div></header>
            <ActivityForceProgress target={activeActivity.target} total={activeActivity.space_total} />
            {activeActivity.space_reward_claimable ? <section className="activity-space-reward-ready"><div><small>{t("activity.spaceReward")}</small><strong>{t("activity.spaceRewardReady", { force: activeActivity.space_reward_claimable.threshold })}</strong></div><button disabled={spaceRewardClaiming} onClick={() => void claimSpaceActivityReward()} type="button">{spaceRewardClaiming ? t("common.processing") : t("activity.claimSpaceReward")}</button></section> : null}
            <div className="activity-immortal-track">{BAXIAN_IMMORTALS.map(([zh, en, image], index) => { const firstAwakening = activeActivity.awakenings?.find((item) => item.step === index + 1); const secondAwakening = activeActivity.awakenings?.find((item) => item.step === index + 9); const awakener = secondAwakening?.user; return <article className={secondAwakening ? "is-unlocked" : firstAwakening ? "is-awakened" : ""} key={zh}><div className="activity-immortal-figure"><img alt="" src={image} /></div><strong>{language === "zh-CN" ? zh : en}</strong><div className="activity-awakener-node">{awakener ? <UserAvatar className="activity-awakener-avatar" name={awakener.name} uri={awakener.avatar_uri} /> : <span>{index + 1}</span>}</div></article>; })}</div>
            <p className="activity-awakening-hint">{!activeActivity.verified ? t("activity.verifyHint") : activeActivity.claimable_points ? t("activity.claimHint") : activeActivity.today_earned ? t("activity.todayEarned") : t("activity.publishHint")}</p>
          </section>
        </div> : <ContentLoader label={t("common.loading")} rows={3} />}
      </SideDrawer>
      <BottomSheet className="activity-info-sheet" bodyClassName="activity-rules-sheet" onClose={() => setActivityRulesOpen(false)} open={activityRulesOpen} title={t("activity.rules")}>
        <div className="activity-rule-list">
          <article><span>01</span><div><strong>{t("activity.ruleVerifiedTitle")}</strong><p>{t("activity.ruleVerifiedBody")}</p></div></article>
          <article><span>02</span><div><strong>{t("activity.rulePersonalTitle")}</strong><p>{t("activity.rulePersonalBody")}</p></div></article>
          <article><span>03</span><div><strong>{t("activity.ruleEarnTitle")}</strong><p>{t("activity.ruleEarnBody")}</p></div></article>
          <article><span>04</span><div><strong>{t("activity.ruleSharedTitle")}</strong><p>{t("activity.ruleSharedBody")}</p></div></article>
        </div>
      </BottomSheet>
      <BottomSheet className="activity-info-sheet" bodyClassName="activity-pool-sheet" onClose={() => setActivityPoolOpen(false)} open={activityPoolOpen} title={t("activity.prizePool")}>
        <div className="activity-prize-grid" onScroll={(event) => {
          const track = event.currentTarget;
          const slides = Array.from(track.children) as HTMLElement[];
          const nearest = slides.reduce((best, slide, index) => Math.abs(slide.offsetLeft - track.offsetLeft - track.scrollLeft) < Math.abs(slides[best].offsetLeft - track.offsetLeft - track.scrollLeft) ? index : best, 0);
          setActivityPoolSlide(nearest);
        }} ref={activityPoolTrackRef}>
          {BAXIAN_PRIZE_BUBBLES.map(({ style, label, dialogue }) => (
            <article key={style}>
              <ChatsPage preview={{
                avatarName: activeActivity?.official_user?.name ?? t("brand.user"),
                avatarUri: activeActivity?.official_user?.avatar_uri,
                backgroundTheme: "default",
                bubbleStyle: style,
                dialogue: dialogue.map((item) => ({ from: item.from, text: t(item.key), kind: "kind" in item ? item.kind : undefined, latitude: "latitude" in item ? item.latitude : undefined, longitude: "longitude" in item ? item.longitude : undefined })),
                selfOnly: true,
              }} />
              <strong>{t(label)}</strong>
            </article>
          ))}
        </div>
        <div aria-label={t("activity.prizePool")} className="activity-prize-pagination">
          {BAXIAN_PRIZE_BUBBLES.map(({ style }, index) => <button aria-current={activityPoolSlide === index ? "true" : undefined} aria-label={`${index + 1}`} className={activityPoolSlide === index ? "is-active" : ""} key={style} onClick={() => {
            const track = activityPoolTrackRef.current;
            const slide = track?.children[index] as HTMLElement | undefined;
            if (track && slide) track.scrollTo({ behavior: "smooth", left: slide.offsetLeft - track.offsetLeft });
          }} type="button" />)}
        </div>
      </BottomSheet>
      <BottomSheet bodyClassName="vip-campaign-sheet" onClose={() => setVipCampaignOpen(false)} open={vipCampaignOpen} title={t("vip.campaignTitle")}>
        {vipCampaign ? <div className={`vip-campaign-panel${vipCampaign.claimed_by_user ? " is-claimed" : ""}`}>
          <section className="vip-campaign-hero">
            <span>FOUNDING 100</span>
            <strong>{vipCampaign.claimed_by_user ? t("vip.claimedTitle") : t("vip.title")}</strong>
            <p>{t("vip.rewards")}</p>
            <small>{vipCampaign.claimed_by_user ? t("vip.claimedSlot", { slot: vipCampaign.slot ? String(vipCampaign.slot).padStart(3, "0") : "---" }) : t("vip.remaining", { count: vipCampaign.remaining })}</small>
          </section>
          <section className="vip-campaign-benefits">
            <header><span>{t("vip.privilegesEyebrow")}</span><strong>{t("vip.privilegesTitle")}</strong></header>
            <div className="vip-campaign-benefit-grid">
              <article className="is-featured"><b>7D</b><span><strong>{t("vip.recallTitle")}</strong><small>{t("vip.recallDescription")}</small></span></article>
              <article className="is-featured"><b>+500</b><span><strong>{t("vip.growthTitle")}</strong><small>{t("vip.growthDescription")}</small></span></article>
              <article><b>FRAME</b><span><strong>{t("vip.frameTitle")}</strong><small>{t("vip.frameDescription")}</small></span></article>
              <article><b>BUBBLE</b><span><strong>{t("vip.bubbleTitle")}</strong><small>{t("vip.bubbleDescription")}</small></span></article>
              <article><b>CARD</b><span><strong>{t("vip.cardTitle")}</strong><small>{t("vip.cardDescription")}</small></span></article>
              <article><b>GOLD</b><span><strong>{t("vip.squareTitle")}</strong><small>{t("vip.squareDescription")}</small></span></article>
              <article className="is-wide"><b>{vipCampaign.claimed_by_user && vipCampaign.slot ? String(vipCampaign.slot).padStart(3, "0") : "001"}</b><span><strong>{t("vip.badgeTitle")}</strong><small>{t("vip.badgeDescription")}</small></span></article>
            </div>
          </section>
          {!vipCampaign.claimed_by_user ? <div className="vip-campaign-requirements">{[
            ["email", t("contact.verifyEmail"), vipCampaign.requirements.email],
            ["phone", t("contact.bindPhone"), vipCampaign.requirements.phone],
            ["level", t("vip.reachLevel", { level: vipCampaign.required_level }), vipCampaign.requirements.level],
          ].map(([key, label, complete]) => <button className={complete ? "is-complete" : ""} disabled={Boolean(complete)} key={String(key)} onClick={() => { setVipCampaignOpen(false); navigate("/app/menu"); }} type="button"><i>{complete ? "✓" : ""}</i><strong>{label}</strong><span>{complete ? t("common.completed") : t("vip.goComplete")}</span></button>)}</div> : <div className="vip-campaign-owned"><b>VIP</b><span>{t("vip.permanentOwned")}</span></div>}
          {!vipCampaign.claimed_by_user ? <button className="vip-campaign-claim" disabled={!vipCampaign.eligible || vipClaiming} onClick={() => void claimPermanentVip()} type="button">{vipClaiming ? t("vip.reserving") : vipCampaign.eligible ? t("vip.claim") : t("vip.completeRequirements")}</button> : null}
        </div> : null}
      </BottomSheet>
      <SideDrawer
        historyKey={`user-profile-${profileDrawerUserId ?? "user"}`}
        onClose={() => setProfileDrawerUserId(null)}
        open={profileDrawerUserId !== null}
        title={profileDrawerUserId === session?.user.user_id ? t("profile.myCard") : t("profile.details")}
        titleAccessory={<HeaderSyncIndicator syncing={profileSyncing} />}
      >
        {profileDrawerUserId !== null ? (
          <UserProfilePanel
            friendRequestSource="square"
            initialUser={profileSeed}
            key={profileDrawerUserId}
            onOpenChat={(chatId) => {
              window.history.replaceState({ ...window.history.state, sermoDrawerStack: [] }, "");
              setProfileDrawerUserId(null);
              navigate(`/app/chats/${chatId}`);
            }}
            onSyncingChange={setProfileSyncing}
            userId={profileDrawerUserId}
          />
        ) : null}
      </SideDrawer>
      {gallery && galleryImages.length ? <MediaLightbox altPrefix={t("square.photo")} index={gallery.index} items={galleryImages.map((image) => ({ uri: image.uri, kind: "image", width: image.metadata?.pixel_width, height: image.metadata?.pixel_height, detail: <MediaMetadataPanel key={image.media_id} kind="image" metadata={image.metadata} />, downloadLabel: formatImageFileSize(image.metadata?.file_size) }))} onClose={() => setGallery(null)} onIndexChange={(index) => setGallery((current) => current ? { ...current, index } : null)} /> : null}
      {galleryVideo ? <MediaLightbox index={0} items={[{ uri: galleryVideo.uri, kind: "video", posterUri: galleryVideo.thumbnail_uri, width: galleryVideo.metadata?.pixel_width, height: galleryVideo.metadata?.pixel_height, detail: <MediaMetadataPanel kind="video" metadata={galleryVideo.metadata} />, downloadLabel: formatImageFileSize(galleryVideo.metadata?.file_size) }]} onClose={() => setVideoGalleryStatementId(null)} onIndexChange={() => undefined} /> : null}
      {chatRecordGallery ? <MediaLightbox altPrefix={t("square.photo")} index={chatRecordGallery.index} items={chatRecordGallery.uris.map((uri, index) => ({ uri, kind: "image" as const, width: chatRecordGallery.metadata[index]?.pixel_width, height: chatRecordGallery.metadata[index]?.pixel_height, detail: <MediaMetadataPanel key={`${uri}-${index}`} kind="image" metadata={chatRecordGallery.metadata[index]} />, downloadLabel: formatImageFileSize(chatRecordGallery.metadata[index]?.file_size) }))} onClose={() => setChatRecordGallery(null)} onIndexChange={(index) => setChatRecordGallery((current) => current ? { ...current, index } : null)} /> : null}
      {chatRecordVideo ? <MediaLightbox index={0} items={[{ uri: chatRecordVideo.uri, kind: "video", width: chatRecordVideo.metadata?.pixel_width, height: chatRecordVideo.metadata?.pixel_height, detail: <MediaMetadataPanel kind="video" metadata={chatRecordVideo.metadata} />, downloadLabel: formatImageFileSize(chatRecordVideo.metadata?.file_size) }]} onClose={() => setChatRecordVideo(null)} onIndexChange={() => undefined} /> : null}
      <ConfirmDialog busy={mutingAuthor} confirmDisabled={!muteReason.trim()} confirmLabel={t("square.confirmMute")} description={t("square.muteAuthorHint")} onClose={() => { if (!mutingAuthor) setMuteStatement(null); }} onConfirm={() => void confirmMuteStatementAuthor()} open={muteStatement !== null} title={t("square.muteAuthorTitle")} warning>
        <div className="square-mute-form">
          <div aria-label={t("square.muteDuration")} className="square-mute-duration" role="group">
            {(["1d", "3d", "7d", "30d", "permanent"] as const).map((duration) => <button aria-pressed={muteDuration === duration} className={muteDuration === duration ? "is-selected" : ""} key={duration} onClick={() => setMuteDuration(duration)} type="button">{t(`square.muteDuration.${duration}` as TranslationKey)}</button>)}
          </div>
          <label className="square-mute-reason"><span>{t("square.muteReason")}</span><textarea autoFocus maxLength={240} onChange={(event) => setMuteReason(event.target.value)} placeholder={t("square.muteReasonPlaceholder")} rows={3} value={muteReason} /></label>
        </div>
      </ConfirmDialog>
      <ConfirmDialog busy={deletingStatement} confirmLabel={t("common.delete")} danger description={t("square.deleteStatementHint")} onClose={() => { if (!deletingStatement) setDeleteStatementId(null); }} onConfirm={() => void confirmDeleteStatement()} open={deleteStatementId !== null} title={t("square.deleteStatement")} />
      <ConfirmDialog busy={deletingComment} confirmLabel={t("common.delete")} danger description={deleteCommentTarget?.parent_id ? t("square.deleteReplyHint") : t("square.deleteCommentHint")} onClose={() => { if (!deletingComment) setDeleteCommentTarget(null); }} onConfirm={() => void confirmDeleteComment()} open={deleteCommentTarget !== null} title={deleteCommentTarget?.parent_id ? t("square.deleteReply") : t("square.deleteComment")} />
      <ConfirmDialog busy={commentSending} confirmLabel={t("square.confirmPublicReply")} description={t("square.publicReplyConfirmHint")} onClose={() => { if (!commentSending) setPublicCommentConfirmOpen(false); }} onConfirm={() => { setPublicCommentConfirmOpen(false); void sendComment(); }} open={publicCommentConfirmOpen} title={t("square.publicReplyConfirmTitle")} warning />
      <BottomSheet bodyClassName="square-quota-sheet" onClose={() => setQuotaOpen(false)} open={quotaOpen} title={t("square.quotaTitle")}>
        <SquareQuotaPanel loading={quotaLoading} quota={quota} />
      </BottomSheet>
    </AppChrome>
  );
}
