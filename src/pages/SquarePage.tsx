import { Fragment, useEffect, useMemo, useRef, useState, type CSSProperties, type MouseEvent as ReactMouseEvent } from "react";
import { useLocation, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { createPortal } from "react-dom";
import { AppChrome } from "../components/AppChrome";
import { BottomSheet } from "../components/BottomSheet";
import { ContentLoader, QuietState } from "../components/BoundaryState";
import { ConfirmDialog } from "../components/ConfirmDialog";
import { FeedbackState } from "../components/FeedbackState";
import { MediaLightbox } from "../components/ImageLightbox";
import { MediaMetadataPanel } from "../components/MediaMetadataPanel";
import { HeaderSyncIndicator } from "../components/HeaderSyncIndicator";
import { SideDrawer } from "../components/SideDrawer";
import { TabPageHeader } from "../components/TabPageHeader";
import { UserAvatar } from "../components/UserAvatar";
import { UserProfilePanel } from "../components/UserProfilePanel";
import { api } from "../lib/api";
import { useAuth } from "../lib/auth";
import { useI18n } from "../lib/language";
import { toMessageUploadError, uploadMessageMediaWith } from "../lib/messageUpload";
import { formatRelativeTime } from "../lib/presentation";
import { buildTabCacheScope, readTabCache, writeTabCache } from "../lib/tabCache";
import { announceSquareUnread } from "../lib/squareNotifications";
import { useSpaceFeatures } from "../lib/spaceFeatures";
import { buildSpaceHrefForCurrentHost, getDetectedSpaceSlug } from "../lib/spaceEntry";
import { showToast } from "../lib/toast";
import type { ActivityCampaignDTO, ChatDTO, ImageMetadataDTO, NotificationEventDTO, SquareQuotaDTO, SquareStatementCommentDTO, SquareStatementDTO, SquareStatementDraftMedia, VideoMetadataDTO } from "../types";
import ChatsPage from "./ChatsPage";
import baxianActivityBanner from "../assets/activity/baxian-immortal-force-banner.jpg";
import baxianActivityLogo from "../assets/activity/baxian-logo-gold.png";
import baxianActivityTitle from "../assets/activity/title-baxian-juli.png";
import tieguaiLi from "../assets/activity/immortals/tieguai-li.png";
import zhongliQuan from "../assets/activity/immortals/zhongli-quan.png";
import zhangGuolao from "../assets/activity/immortals/zhang-guolao.png";
import lvDongbin from "../assets/activity/immortals/lv-dongbin.png";
import heXiangu from "../assets/activity/immortals/he-xiangu.png";
import lanCaihe from "../assets/activity/immortals/lan-caihe.png";
import hanXiangzi from "../assets/activity/immortals/han-xiangzi.png";
import caoGuojiu from "../assets/activity/immortals/cao-guojiu.png";

type SelectedPhoto = {
  id: string;
  file: File;
  preview: string;
};
type SelectedVideo = SelectedPhoto & { duration: number };

const MAX_TEXT_LENGTH = 140;
type InlineTransitionPhase = "idle" | "preparing" | "opening" | "open" | "closing";
type InlineStatementOrigin = { left: number; top: number; width: number; height: number };
const MAX_PHOTOS = 9;
const MAX_AUDIO_SECONDS = 60;
const MAX_VIDEO_SECONDS = 60;
const MESSAGE_TYPE_STATEMENT = 8;
const BAXIAN_IMMORTALS = [
  ["铁拐李", "Tieguai Li", tieguaiLi], ["钟离权", "Zhongli Quan", zhongliQuan],
  ["张果老", "Zhang Guolao", zhangGuolao], ["吕洞宾", "Lu Dongbin", lvDongbin],
  ["何仙姑", "He Xiangu", heXiangu], ["蓝采和", "Lan Caihe", lanCaihe],
  ["韩湘子", "Han Xiangzi", hanXiangzi], ["曹国舅", "Cao Guojiu", caoGuojiu],
] as const;
const BAXIAN_PRIZE_BUBBLES = [
  { style: "baxian-lv", label: "menu.styleBaxianLv", dialogue: ["activity.previewLvOther1", "activity.previewLvSelf1", "activity.previewLvOther2", "activity.previewLvSelf2", "activity.previewLvOther3"] },
  { style: "baxian-zhongli", label: "menu.styleBaxianZhongli", dialogue: ["activity.previewZhongliOther1", "activity.previewZhongliSelf1", "activity.previewZhongliOther2", "activity.previewZhongliSelf2", "activity.previewZhongliOther3"] },
  { style: "baxian-he", label: "menu.styleBaxianHe", dialogue: ["activity.previewHeOther1", "activity.previewHeSelf1", "activity.previewHeOther2", "activity.previewHeSelf2", "activity.previewHeOther3"] },
] as const;

function formatActivityDateRange(startsAt: number, endsAt: number, language: string) {
  const locale = language === "zh-CN" ? "zh-CN" : "en-US";
  const formatter = new Intl.DateTimeFormat(locale, { month: "short", day: "numeric" });
  return `${formatter.format(new Date(startsAt * 1000))} - ${formatter.format(new Date(endsAt * 1000))}`;
}

function SquareQuotaPanel({ loading, quota }: { loading: boolean; quota: SquareQuotaDTO | null }) {
  const { t } = useI18n();
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
    { label: "LV1–5", daily: 1, weekly: 5 },
    { label: "LV6–9", daily: 2, weekly: 10 },
    { label: "LV10–13", daily: 3, weekly: 15 },
    { label: "LV14–17", daily: 4, weekly: 20 },
    { label: "LV18 / VIP", daily: 5, weekly: 35 },
  ];
  return <div className="square-quota-panel">
    <section className={`square-quota-hero${quota.verified ? "" : " is-locked"}`}>
      <div><span>{quota.unlimited ? t("square.quotaOfficial") : quota.vip ? "VIP" : `LV${quota.level}`}</span><strong>{!quota.verified ? t("square.quotaVerifyFirst") : quota.unlimited ? t("square.quotaUnlimited") : t("square.quotaHero", { count: statementRemaining ?? 0 })}</strong></div>
      <span className="material-symbols-outlined">{quota.verified ? "data_usage" : "lock"}</span>
    </section>
    <div className="square-quota-cards">
      {quotaCards.map((item) => {
        const ratio = item.limit === null ? 0 : Math.min(1, item.used / Math.max(1, item.limit));
        return <article className={item.remaining === 0 ? "is-exhausted" : ""} key={item.key}>
          <header><span className="material-symbols-outlined">{item.icon}</span><strong>{item.label}</strong><b>{item.limit === null ? t("square.quotaUnlimitedShort") : t("square.quotaRemaining", { count: item.remaining ?? 0 })}</b></header>
          <div className="square-quota-meter"><i style={{ transform: `scaleX(${ratio})` }} /></div>
          <footer><span>{t("square.quota24Hours")} · {item.used}/{item.limit ?? "∞"}</span><span>{t("square.quota7Days")} · {item.weeklyUsed}/{item.weeklyLimit ?? "∞"}</span></footer>
        </article>;
      })}
      <article className="square-quota-like-card"><header><span className="material-symbols-outlined">favorite</span><strong>{t("square.quotaLikes")}</strong><b>{t("square.quotaUnlimitedShort")}</b></header><p>{t("square.quotaLikesToday", { count: quota.likes.daily_used })}</p></article>
    </div>
    <section className="square-quota-capabilities">
      <header><strong>{t("square.quotaMedia")}</strong><span>{t("square.quotaMediaHint")}</span></header>
      <div>
        <span className="is-active"><i className="material-symbols-outlined">notes</i>{t("square.text")}</span>
        <span className="is-active"><i className="material-symbols-outlined">image</i>{t("square.photo")}</span>
        <span className={quota.media.audio ? "is-active" : ""}><i className="material-symbols-outlined">mic</i>{quota.media.audio ? t("square.voice") : `LV${quota.media.audio_level}`}</span>
        <span className={quota.media.video ? "is-active" : ""}><i className="material-symbols-outlined">videocam</i>{quota.media.video ? t("square.video") : `LV${quota.media.video_level}`}</span>
      </div>
    </section>
    {!quota.unlimited ? <details className="square-quota-rules"><summary>{t("square.quotaLevelRules")}<span className="material-symbols-outlined">expand_more</span></summary><div>{levels.map((row, index) => <p className={quota.vip ? index === levels.length - 1 ? "is-current" : "" : quota.level >= Number(row.label.match(/\d+/)?.[0]) && quota.level <= Number(row.label.match(/\d+(?!.*\d)/)?.[0] ?? 18) ? "is-current" : ""} key={row.label}><strong>{row.label}</strong><span>{t("square.quotaRule", { daily: row.daily, weekly: row.weekly })}</span></p>)}</div></details> : null}
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

function StatementCard({ statement, canInteract, cardRef, detail = false, onDelete, onLike, onOpen, onOpenImage, onOpenProfile, onOpenVideo, onPin, onShare }: {
  statement: SquareStatementDTO;
  canInteract: boolean;
  cardRef?: (node: HTMLElement | null) => void;
  detail?: boolean;
  onDelete: () => void;
  onLike: () => void;
  onOpen: () => void;
  onOpenImage: (index: number) => void;
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
        <button className="square-statement-avatar-button" onClick={(event) => { event.stopPropagation(); onOpenProfile(); }} type="button">
          <UserAvatar
            className="square-statement-avatar"
            frame={statement.user.avatar_frame_style}
            name={statement.user.name}
            uri={statement.user.avatar_uri}
            vip={Boolean(statement.user.is_permanent_vip)}
          />
        </button>
        <div className="square-statement-author-copy">
          <div className={`square-statement-author-name${statement.user.is_permanent_vip ? " is-vip" : ""}`}>
            <strong>{statement.user.name}</strong>
            {!statement.user.official && statement.user.growth_level ? <b>LV{statement.user.growth_level}</b> : null}
          </div>
          <span>{formatRelativeTime(statement.created_at)}</span>
        </div>
        <button aria-expanded={Boolean(menuPosition)} aria-label={t("common.more")} className="square-statement-menu" onClick={(event) => { event.stopPropagation(); const rect = event.currentTarget.getBoundingClientRect(); const width = 164; setMenuPosition((current) => current ? null : { top: rect.bottom + 6, left: Math.max(8, Math.min(window.innerWidth - width - 8, rect.right - width)) }); }} ref={menuButtonRef} type="button"><span className="material-symbols-outlined">more_horiz</span></button>
      </header>
      {statement.text ? <p className="square-statement-text">{statement.text}</p> : null}
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
      <footer className="square-statement-footer">
        <button className={statement.liked ? "is-liked" : ""} disabled={!canInteract} onClick={(event) => { event.stopPropagation(); onLike(); }} type="button"><span className="material-symbols-outlined">favorite</span><span>{statement.like_count || t("square.like")}</span></button>
        <button onClick={(event) => { event.stopPropagation(); onOpen(); }} type="button">
          <span className="material-symbols-outlined">chat_bubble</span>
          <span>{statement.comment_count ? t("square.commentsCount", { count: statement.comment_count }) : t("square.comment")}</span>
        </button>
      </footer>
      {menuPosition && typeof document !== "undefined" ? createPortal(
        <div className="square-statement-dropdown" onClick={(event) => event.stopPropagation()} ref={menuRef} style={menuPosition}>
          <button onClick={() => { setMenuPosition(null); onShare(); }} type="button"><span className="material-symbols-outlined">send</span><span>{t("square.share")}</span></button>
          {statement.can_pin ? <button onClick={() => { setMenuPosition(null); onPin(); }} type="button"><span className="material-symbols-outlined">keep</span><span>{statement.is_pinned ? t("square.unpinStatement") : t("square.pinStatement")}</span></button> : null}
          {statement.can_delete ? <button className="is-danger" onClick={() => { setMenuPosition(null); onDelete(); }} type="button"><span className="material-symbols-outlined">delete</span><span>{t("common.delete")}</span></button> : null}
        </div>,
        document.body,
      ) : null}
    </article>
  );
}

function CommentThread({ comment, canInteract, onDelete, onLike, onReply }: {
  comment: SquareStatementCommentDTO;
  canInteract: boolean;
  onDelete: (comment: SquareStatementCommentDTO) => void;
  onLike: (comment: SquareStatementCommentDTO) => void;
  onReply: (comment: SquareStatementCommentDTO) => void;
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
  return <article className={`square-comment-thread${canInteract ? " is-replyable" : ""}`} onClick={beginReply}>
    <UserAvatar className="square-comment-avatar" frame={comment.user.avatar_frame_style} name={comment.user.name} uri={comment.user.avatar_uri} vip={Boolean(comment.user.is_permanent_vip)} />
    <div>
      <header><div className={`square-comment-author-name${comment.user.is_permanent_vip ? " is-vip" : ""}`}><strong>{comment.user.name}</strong>{comment.user.growth_level ? <b>LV{comment.user.growth_level}</b> : null}<time>{formatRelativeTime(comment.created_at)}</time></div>{comment.can_delete ? <button aria-expanded={Boolean(menuPosition)} aria-label={t("common.more")} className="square-comment-more" onClick={(event) => { event.stopPropagation(); const rect = event.currentTarget.getBoundingClientRect(); const width = 104; setMenuPosition((current) => current ? null : { top: rect.bottom + 5, left: Math.max(8, Math.min(window.innerWidth - width - 8, rect.right - width)) }); }} type="button"><span className="material-symbols-outlined">more_horiz</span></button> : null}</header>
      <p>{comment.reply_to_user ? <span className="square-comment-reply-prefix">{t("square.replyingTo", { name: comment.reply_to_user.name })}</span> : null}{comment.text}</p>
      <div className="square-comment-actions">
        <button className={comment.liked ? "is-liked" : ""} disabled={!canInteract} onClick={(event) => { event.stopPropagation(); onLike(comment); }} type="button"><span className="material-symbols-outlined">favorite</span><span>{comment.like_count || t("square.like")}</span></button>
        {canInteract ? <button onClick={beginReply} type="button"><span className="material-symbols-outlined">chat_bubble</span><span>{t("square.reply")}</span></button> : null}
      </div>
      {!comment.parent_id && comment.replies?.length ? <div className="square-comment-replies">{comment.replies.map((reply) => <CommentThread canInteract={canInteract} comment={reply} key={reply.comment_id} onDelete={onDelete} onLike={onLike} onReply={onReply} />)}</div> : null}
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
  const { session } = useAuth();
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
  const [pinOnPublish, setPinOnPublish] = useState(false);
  const [photos, setPhotos] = useState<SelectedPhoto[]>([]);
  const [video, setVideo] = useState<SelectedVideo | null>(null);
  const [voiceFile, setVoiceFile] = useState<File | null>(null);
  const [voiceDuration, setVoiceDuration] = useState(0);
  const [recording, setRecording] = useState(false);

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
  const parsedRouteStatementId = Number(routeStatementId);
  const routedStatementId = Number.isFinite(parsedRouteStatementId) && parsedRouteStatementId > 0 ? parsedRouteStatementId : null;
  const routeState = location.state as { squareInlineFocus?: boolean } | null;
  const inlineRouteActive = routedStatementId !== null && routeState?.squareInlineFocus === true;
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
  const [commentSort, setCommentSort] = useState<"hot" | "latest">("hot");
  const [commentText, setCommentText] = useState("");
  const [replyTarget, setReplyTarget] = useState<SquareStatementCommentDTO | null>(null);
  const [commentSending, setCommentSending] = useState(false);
  const [deleteStatementId, setDeleteStatementId] = useState<number | null>(null);
  const [deletingStatement, setDeletingStatement] = useState(false);
  const [deleteCommentTarget, setDeleteCommentTarget] = useState<SquareStatementCommentDTO | null>(null);
  const [deletingComment, setDeletingComment] = useState(false);
  const [shareStatement, setShareStatement] = useState<SquareStatementDTO | null>(null);
  const [shareChats, setShareChats] = useState<ChatDTO[]>([]);
  const [shareChatsLoading, setShareChatsLoading] = useState(false);
  const [sharingChatId, setSharingChatId] = useState<number | null>(null);
  const [notificationDrawerOpen, setNotificationDrawerOpen] = useState(false);
  const [notificationEvents, setNotificationEvents] = useState<NotificationEventDTO[]>([]);
  const [notificationUnread, setNotificationUnread] = useState(0);
  const [quotaOpen, setQuotaOpen] = useState(false);
  const [quota, setQuota] = useState<SquareQuotaDTO | null>(null);
  const [quotaLoading, setQuotaLoading] = useState(false);
  const [pinnedStatement, setPinnedStatement] = useState<SquareStatementDTO | null>(null);
  const [activities, setActivities] = useState<ActivityCampaignDTO[]>([]);
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
  const galleryStatement = statements.find((item) => item.statement_id === gallery?.statementId) ?? null;
  const galleryImages = galleryStatement?.media.filter((item) => item.kind === "image") ?? [];
  const galleryVideo = statements.find((item) => item.statement_id === videoGalleryStatementId)?.media.find((item) => item.kind === "video") ?? null;
  const profileSeed = statements.find((statement) => statement.user.user_id === profileDrawerUserId)?.user ?? null;
  const sortedShareChats = useMemo(() => [...shareChats].sort((left, right) => (
    Number(Boolean(right.pinned)) - Number(Boolean(left.pinned))
    || (right.last_message?.created_at ?? right.last_chat_at) - (left.last_message?.created_at ?? left.last_chat_at)
  )), [shareChats]);
  const voicePreview = useMemo(() => voiceFile ? URL.createObjectURL(voiceFile) : null, [voiceFile]);
  const activeActivity = activities.find((item) => item.key === routeActivityKey) ?? null;
  const refreshActivities = () => api.getActiveActivities().then(setActivities).catch(() => undefined);

  useEffect(() => {
    const controller = new AbortController();
    void api.getActiveActivities(controller.signal).then(setActivities).catch(() => undefined);
    return () => controller.abort();
  }, [session?.user.space_id, session?.user.user_id]);

  useEffect(() => {
    if (!routeActivityKey || activeActivity) return;
    const controller = new AbortController();
    void api.getActivity(routeActivityKey, controller.signal).then((activity) => {
      setActivities((current) => [...current.filter((item) => item.key !== activity.key), activity]);
    }).catch(() => navigate("/app/square", { replace: true }));
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
    setShareStatement(statement);
    setShareChatsLoading(true);
    void api.getChats().then(setShareChats).catch((cause) => {
      showToast(cause instanceof Error ? cause.message : t("square.shareLoadFailed"), "error");
      setShareChats([]);
    }).finally(() => setShareChatsLoading(false));
  };

  const sendStatementToChat = async (chat: ChatDTO) => {
    if (!shareStatement || sharingChatId !== null) return;
    setSharingChatId(chat.chat_id);
    const slug = getDetectedSpaceSlug();
    const pathname = `/app/square/statements/${shareStatement.statement_id}`;
    const url = slug ? buildSpaceHrefForCurrentHost(slug, pathname) : new URL(pathname, window.location.origin).toString();
    try {
      await api.sendMessage(
        chat.chat_id,
        MESSAGE_TYPE_STATEMENT,
        JSON.stringify({ kind: "statement", statement_id: shareStatement.statement_id, url, text: shareStatement.text.slice(0, 100) }),
        undefined,
        crypto.randomUUID(),
      );
      showToast(t("square.sharedTo", { chat: shareChatTitle(chat, currentUser?.user_id) }));
      setShareStatement(null);
    } catch (cause) {
      showToast(cause instanceof Error ? cause.message : t("square.shareFailed"), "error");
    } finally {
      setSharingChatId(null);
    }
  };

  const remaining = MAX_TEXT_LENGTH - text.length;
  const publishable = useMemo(
    () => Boolean(text.trim() || photos.length || voiceFile || video) && !publishing && text.length <= MAX_TEXT_LENGTH,
    [photos.length, publishing, text, video, voiceFile],
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
    void api.getNotificationEvents("square", controller.signal).then((result) => {
      const readStatementId = lastReadStatementRef.current;
      setNotificationEvents(result.events.map((event) => (
        readStatementId && event.payload.statement_id === readStatementId ? { ...event, is_read: true } : event
      )));
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
    if (!notificationUnread) return;
    notificationUnreadRef.current = 0;
    setNotificationUnread(0);
    setNotificationEvents((current) => current.map((event) => ({ ...event, is_read: true })));
    announceSquareUnread(0);
    void api.markSquareNotificationsRead();
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
      const comment = await api.createSquareStatementComment(commentStatementId, content, replyTarget?.comment_id);
      const rootId = comment.root_id ?? replyTarget?.root_id ?? replyTarget?.comment_id;
      setComments((current) => replyTarget
        ? current.map((item) => item.comment_id === rootId ? { ...item, reply_count: item.reply_count + 1, replies: [...(item.replies ?? []), comment] } : item)
        : [comment, ...current]);
      setStatements((current) => current.map((statement) => statement.statement_id === commentStatementId
        ? { ...statement, comment_count: (statement.comment_count || 0) + 1 }
        : statement));
      setCommentText("");
      setReplyTarget(null);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : t("square.commentFailed"));
    } finally {
      setCommentSending(false);
    }
  };

  const beginCommentReply = (comment: SquareStatementCommentDTO) => {
    setReplyTarget(comment);
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
      const statement = await api.createSquareStatement({ text: text.trim(), visibility, media, pin: pinOnPublish ? 1 : 0 });
      setStatements((current) => [statement, ...current]);
      if (pinOnPublish) setPinnedStatement(statement);
      photos.forEach((photo) => URL.revokeObjectURL(photo.preview));
      setText("");
      setPhotos([]);
      setVoiceFile(null);
      setVoiceDuration(0);
      setVisibility("public");
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
      <div className={`square-comment-list${commentsLoading && comments.length ? " is-refreshing" : ""}`}>{comments.map((comment) => <CommentThread canInteract={canPublish} comment={comment} key={comment.comment_id} onDelete={setDeleteCommentTarget} onLike={(target) => void toggleCommentLike(target)} onReply={beginCommentReply} />)}</div>
      {commentsHasMore ? <button className="square-load-more" disabled={commentsLoading} onClick={() => {
        if (commentStatementId === null) return;
        setCommentsLoading(true);
        void api.getSquareStatementComments(commentStatementId, { offset: comments.length, limit: 30, sort: commentSort }).then((rows) => { setComments((current) => [...current, ...rows]); setCommentsHasMore(rows.length === 30); }).finally(() => setCommentsLoading(false));
      }} type="button">{t("square.loadMoreComments")}</button> : null}
    </section>
  );

  const commentComposer = canPublish ? <form className="square-comment-composer" onSubmit={(event) => { event.preventDefault(); void sendComment(); }}><UserAvatar className="square-comment-avatar" frame={currentUser?.avatar_frame_style} name={currentUser?.name || ""} uri={currentUser?.avatar_uri} vip={Boolean(currentUser?.is_permanent_vip)} /><div>{replyTarget ? <button className="square-reply-target" onClick={() => { setReplyTarget(null); window.requestAnimationFrame(() => commentInputRef.current?.focus()); }} type="button">{t("square.replyingTo", { name: replyTarget.user.name })}<span className="material-symbols-outlined">close</span></button> : null}<input aria-label={t("square.writeComment")} maxLength={MAX_TEXT_LENGTH} onChange={(event) => setCommentText(event.target.value)} placeholder={replyTarget ? t("square.writeReply") : t("square.writeComment")} ref={commentInputRef} value={commentText} /></div><button disabled={!commentText.trim() || commentSending} type="submit"><span className="material-symbols-outlined">arrow_upward</span></button></form> : null;

  return (
    <AppChrome title={t("square.title")} hideTopbar shellClassName="desktop-tab-shell square-community-shell">
      <div className={`square-desktop-workspace${inlineRouteActive ? " has-selection" : ""}`}>
      <main className="list-screen square-feed-screen">
        <TabPageHeader
          syncing={syncing}
          title={t("square.title")}
          secondary={<div className="square-feed-filter" role="tablist">
            {features.squareExploreEnabled ? <button aria-selected={feedMode === "all"} className={feedMode === "all" ? "is-active" : ""} onClick={() => setFeedMode("all")} role="tab" type="button">{t("square.feedAll")}</button> : null}
            <button aria-selected={feedMode === "friends"} className={feedMode === "friends" ? "is-active" : ""} onClick={() => setFeedMode("friends")} role="tab" type="button">{t("square.feedFriends")}</button>
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
          {feedMode === "all" && activities.length ? <section className="square-activity-rail" aria-label={t("activity.active")}>
            {activities.map((activity) => {
              const title = language === "zh-CN" ? activity.title : activity.title_en || activity.title;
              const days = Math.max(1, Math.ceil((activity.ends_at * 1000 - Date.now()) / 86400000));
              return <button className="square-activity-banner" key={activity.key} onClick={() => navigate(`/app/square/activities/${activity.key}`)} type="button">
                <img alt="" src={baxianActivityBanner} />
                <span className="square-activity-banner-shade" />
                <span className="square-activity-banner-copy"><small>{t("activity.spaceCoop")} · {t("activity.daysLeft", { count: days })}</small><strong>{title}</strong><span>{activity.space_total}/{activity.target} {t("activity.force")}</span></span>
                <span className="square-activity-banner-progress"><i style={{ transform: `scaleX(${Math.min(1, activity.space_total / Math.max(1, activity.target))})` }} /></span>
                <span className="material-symbols-outlined">arrow_forward</span>
              </button>;
            })}
          </section> : null}
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
                <StatementCard canInteract={canPublish} cardRef={(node) => { if (node) statementCardRefs.current.set(statement.statement_id, node); else statementCardRefs.current.delete(statement.statement_id); }} onDelete={() => setDeleteStatementId(statement.statement_id)} onLike={() => void toggleStatementLike(statement)} onOpen={() => { if (!focused) openStatement(statement.statement_id); }} onOpenImage={(index) => openStatementImages(statement.statement_id, index)} onOpenProfile={() => setProfileDrawerUserId(statement.user.user_id)} onOpenVideo={() => openStatementVideo(statement.statement_id)} onPin={() => void toggleStatementPinned(statement)} onShare={() => openStatementShare(statement)} statement={statement} />
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
              <StatementCard canInteract={canPublish} detail onDelete={() => setDeleteStatementId(activeCommentStatement.statement_id)} onLike={() => void toggleStatementLike(activeCommentStatement)} onOpen={() => undefined} onOpenImage={(index) => openStatementImages(activeCommentStatement.statement_id, index)} onOpenProfile={() => setProfileDrawerUserId(activeCommentStatement.user.user_id)} onOpenVideo={() => openStatementVideo(activeCommentStatement.statement_id)} onPin={() => void toggleStatementPinned(activeCommentStatement)} onShare={() => openStatementShare(activeCommentStatement)} statement={activeCommentStatement} />
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
      <SideDrawer historyKey="square-notifications" onClose={() => setNotificationDrawerOpen(false)} open={notificationDrawerOpen} title={t("square.notifications")}>
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
        </div>
      </SideDrawer>
      <SideDrawer
        actionBusy={publishing}
        actionDisabled={!publishable}
        actionLabel={t("square.publish")}
        historyKey="square-compose"
        onAction={() => void publish()}
        onClose={() => setComposerOpen(false)}
        open={composerOpen}
        title={t("square.composeTitle")}
      >
        <div className="square-compose-drawer">
          {error ? <div className="square-inline-error">{error}</div> : null}
          <div className="square-compose-editor">
            <UserAvatar className="square-composer-avatar" frame={currentUser?.avatar_frame_style} name={currentUser?.name || ""} uri={currentUser?.avatar_uri} vip={Boolean(currentUser?.is_permanent_vip)} />
            <div>
              <strong>{currentUser?.name}</strong>
              <textarea autoFocus aria-label={t("square.saySomething")} maxLength={MAX_TEXT_LENGTH} onChange={(event) => setText(event.target.value)} placeholder={t("square.saySomething")} value={text} />
            </div>
          </div>
          {photos.length ? <div className="square-composer-photos">{photos.map((photo) => <button key={photo.id} onClick={() => removePhoto(photo.id)} type="button"><img alt="" src={photo.preview} /><span className="material-symbols-outlined">close</span></button>)}</div> : null}
          {video ? <div className="square-composer-video"><video muted playsInline src={video.preview} /><button onClick={() => { URL.revokeObjectURL(video.preview); setVideo(null); }} type="button"><span className="material-symbols-outlined">close</span></button><span>{video.duration}s</span></div> : null}
          {voiceFile ? <div className="square-composer-voice"><span className="material-symbols-outlined">graphic_eq</span><div><strong>{t("square.voiceReady")}</strong>{voicePreview ? <audio controls preload="metadata" src={voicePreview} /> : null}</div><span>{voiceDuration}s</span><button onClick={() => { setVoiceFile(null); setVoiceDuration(0); }} type="button"><span className="material-symbols-outlined">close</span></button></div> : null}
          {publishing ? <div className="square-publish-progress"><i style={{ width: `${Math.round(uploadProgress * 100)}%` }} /></div> : null}
          <div className="square-compose-settings">
            <button onClick={() => setVisibilitySheetOpen(true)} type="button"><span className="material-symbols-outlined">{visibility === "friends" ? "group" : "public"}</span><div><strong>{t("square.visibility")}</strong><small>{visibility === "friends" ? t("square.friendsOnly") : t("square.public")}</small></div><span className="material-symbols-outlined">chevron_right</span></button>
            {currentUser?.official ? <button aria-checked={pinOnPublish} className="square-compose-pin-row" onClick={() => setPinOnPublish((current) => !current)} role="switch" type="button"><span className="material-symbols-outlined">keep</span><div><strong>{t("square.pinOnPublish")}</strong><small>{t("square.pinOnPublishHint")}</small></div><i className={pinOnPublish ? "is-on" : ""}><span /></i></button> : null}
          </div>
          <footer className="square-compose-dock">
            <input accept="image/*" hidden multiple onChange={(event) => choosePhotos(event.target.files)} ref={photoInputRef} type="file" />
            <input accept="video/*" hidden onChange={(event) => chooseVideo(event.target.files)} ref={videoInputRef} type="file" />
            <button className={photos.length ? "is-active" : ""} disabled={photos.length >= MAX_PHOTOS || publishing} onClick={() => photoInputRef.current?.click()} type="button"><span className="material-symbols-outlined">image</span><span>{t("square.photo")}</span></button>
            <button className={voiceFile ? "is-active" : ""} disabled={publishing || !canSendVoice} onClick={() => setVoiceSheetOpen(true)} title={!canSendVoice ? t("square.voiceUnlock") : undefined} type="button"><span className="material-symbols-outlined">mic</span><span>{t("square.voice")}</span></button>
            <button className={video ? "is-active" : ""} disabled={publishing || !canSendVideo} onClick={() => videoInputRef.current?.click()} title={!canSendVideo ? t("square.videoUnlock") : undefined} type="button"><span className="material-symbols-outlined">videocam</span><span>{t("square.video")}</span></button>
            <span className={remaining < 20 ? "is-near-limit" : ""}>{remaining}</span>
          </footer>
        </div>
      </SideDrawer>
      <BottomSheet bodyClassName="square-choice-sheet" onClose={() => setVisibilitySheetOpen(false)} open={visibilitySheetOpen} title={t("square.visibility")}>
        {(["public", "friends"] as const).map((value) => <button className={visibility === value ? "is-selected" : ""} key={value} onClick={() => { setVisibility(value); setVisibilitySheetOpen(false); }} type="button"><span className="material-symbols-outlined">{value === "public" ? "public" : "group"}</span><div><strong>{value === "public" ? t("square.public") : t("square.friendsOnly")}</strong><small>{value === "public" ? t("square.publicHint") : t("square.friendsHint")}</small></div><span className="material-symbols-outlined">check</span></button>)}
      </BottomSheet>
      <BottomSheet bodyClassName="square-share-sheet" onClose={() => { if (sharingChatId === null) setShareStatement(null); }} open={shareStatement !== null} title={t("square.shareToChat")}>
        {shareChatsLoading && !shareChats.length ? <ContentLoader label={t("square.loadingChats")} rows={4} /> : null}
        {!shareChatsLoading && !sortedShareChats.length ? <QuietState icon="forum" title={t("square.noChatsToShare")} /> : null}
        {sortedShareChats.length ? <div className="square-share-chat-list">{sortedShareChats.map((chat) => {
          const peer = chat.group ? null : shareChatPeer(chat, currentUser?.user_id);
          const title = shareChatTitle(chat, currentUser?.user_id);
          const lastActivity = chat.last_message?.created_at ?? chat.last_chat_at;
          return <button disabled={sharingChatId !== null} key={chat.chat_id} onClick={() => void sendStatementToChat(chat)} type="button">
            <UserAvatar className="square-share-chat-avatar" groupMembers={chat.group ? chat.members.map((member) => ({ name: member.name, uri: member.avatar_uri })) : undefined} name={title} uri={peer?.avatar_uri} />
            <span className="square-share-chat-copy"><strong>{title}</strong><small>{chat.last_message?.content || (chat.group ? t("chat.group") : t("square.directChat"))}</small></span>
            <span className="square-share-chat-meta">{chat.pinned ? <i className="material-symbols-outlined">keep</i> : null}<time>{formatRelativeTime(lastActivity)}</time>{sharingChatId === chat.chat_id ? <i className="material-symbols-outlined is-loading">progress_activity</i> : <i className="material-symbols-outlined">chevron_right</i>}</span>
          </button>;
        })}</div> : null}
      </BottomSheet>
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
              {activeCommentStatement ? <StatementCard canInteract={canPublish} detail onDelete={() => setDeleteStatementId(activeCommentStatement.statement_id)} onLike={() => void toggleStatementLike(activeCommentStatement)} onOpen={() => undefined} onOpenImage={(index) => openStatementImages(activeCommentStatement.statement_id, index)} onOpenProfile={() => setProfileDrawerUserId(activeCommentStatement.user.user_id)} onOpenVideo={() => openStatementVideo(activeCommentStatement.statement_id)} onPin={() => void toggleStatementPinned(activeCommentStatement)} onShare={() => openStatementShare(activeCommentStatement)} statement={activeCommentStatement} /> : null}
            </div>
            {discussionContent}
          </div>
          {commentComposer}
        </div>
      </SideDrawer>
      <SideDrawer className="activity-drawer" historyMode="route" onClose={() => navigate("/app/square")} open={Boolean(routeActivityKey)} title={activeActivity ? (language === "zh-CN" ? activeActivity.title : activeActivity.title_en || activeActivity.title) : t("activity.title")} titleAccessory={activeActivity ? <img alt="" className="activity-drawer-title-art" src={baxianActivityTitle} /> : null}>
        {activeActivity ? <div className="activity-detail">
          <section className="activity-detail-visual">
            <div className="activity-detail-masthead">
            <div className="activity-brand-lockup" aria-label={t("activity.coBranding")}><span><img alt="Sermo 言浪" src="/icons/sermo-192.png" /></span><b aria-hidden="true">×</b><img alt={t("activity.baxian")} src={baxianActivityLogo} /></div>
            <div className="activity-detail-index">
              <div><button onClick={() => setActivityRulesOpen(true)} type="button">{t("activity.rules")}</button><i aria-hidden="true" /><button onClick={() => setActivityPoolOpen(true)} type="button">{t("activity.prizePool")}</button></div>
              <time>{formatActivityDateRange(activeActivity.starts_at, activeActivity.ends_at, language)}</time>
            </div>
            </div>
          </section>
          <section className="activity-awakening-stage">
            <section className={`activity-personal-quest${activeActivity.personal_reward ? " is-complete" : ""}`}>
              <div><small>{t("activity.personalQuest")}</small><strong>{activeActivity.personal_reward ? t("activity.personalComplete") : t("activity.personalPostTwice")}</strong><span>{activeActivity.personal_reward ? t("activity.personalRewardOwned") : t("activity.personalProgress", { current: Math.min(activeActivity.personal_event_count, activeActivity.personal_event_target), target: activeActivity.personal_event_target })}</span></div>
              {activeActivity.personal_reward ? <span className={`personalization-option preview-${activeActivity.personal_reward.resource_key}`}><i aria-hidden="true"><span /></i></span> : <div className="activity-personal-stamps">{Array.from({ length: activeActivity.personal_event_target }, (_, index) => <i className={index < activeActivity.personal_event_count ? "is-earned" : ""} key={index}><span className="material-symbols-outlined">edit</span></i>)}</div>}
            </section>
            <header><div><small>{t("activity.spaceForce")}</small><strong>{activeActivity.space_total}<span> / {activeActivity.target}</span></strong></div><button disabled={!activeActivity.available_points || activityContributing || !activeActivity.active} onClick={() => void contributeActivity()} type="button">{activityContributing ? t("common.loading") : `${t("activity.contribute")} · ${activeActivity.available_points}`}</button></header>
            <div className="activity-immortal-track">{BAXIAN_IMMORTALS.map(([zh, en, image], index) => { const awakening = activeActivity.awakenings?.find((item) => item.step === index + 1); const unlocked = Boolean(awakening); return <article className={unlocked ? "is-unlocked" : ""} key={zh}><div className="activity-immortal-figure"><img alt="" src={image} /></div><strong>{language === "zh-CN" ? zh : en}</strong><div className="activity-awakener-node">{awakening?.user ? <UserAvatar className="activity-awakener-avatar" name={awakening.user.name} uri={awakening.user.avatar_uri} /> : <span>{index + 1}</span>}</div></article>; })}</div>
            <p className="activity-awakening-hint">{!activeActivity.verified ? t("activity.verifyHint") : activeActivity.today_earned ? t("activity.todayEarned") : t("activity.publishHint")}</p>
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
                avatarName: currentUser?.name ?? t("brand.user"),
                avatarUri: currentUser?.avatar_uri,
                backgroundTheme: "default",
                bubbleStyle: style,
                dialogue: dialogue.map((key, index) => ({ from: index % 2 ? "self" : "other", text: t(key) })),
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
      <SideDrawer
        historyKey="square-user-profile"
        onClose={() => setProfileDrawerUserId(null)}
        open={profileDrawerUserId !== null}
        title={t("profile.details")}
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
      <ConfirmDialog busy={deletingStatement} confirmLabel={t("common.delete")} danger description={t("square.deleteStatementHint")} onClose={() => { if (!deletingStatement) setDeleteStatementId(null); }} onConfirm={() => void confirmDeleteStatement()} open={deleteStatementId !== null} title={t("square.deleteStatement")} />
      <ConfirmDialog busy={deletingComment} confirmLabel={t("common.delete")} danger description={deleteCommentTarget?.parent_id ? t("square.deleteReplyHint") : t("square.deleteCommentHint")} onClose={() => { if (!deletingComment) setDeleteCommentTarget(null); }} onConfirm={() => void confirmDeleteComment()} open={deleteCommentTarget !== null} title={deleteCommentTarget?.parent_id ? t("square.deleteReply") : t("square.deleteComment")} />
      <BottomSheet bodyClassName="square-quota-sheet" onClose={() => setQuotaOpen(false)} open={quotaOpen} title={t("square.quotaTitle")}>
        <SquareQuotaPanel loading={quotaLoading} quota={quota} />
      </BottomSheet>
    </AppChrome>
  );
}
