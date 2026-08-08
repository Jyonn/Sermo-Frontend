import { useEffect, useMemo, useRef, useState } from "react";
import { AppChrome } from "../components/AppChrome";
import { BottomSheet } from "../components/BottomSheet";
import { FeedbackState } from "../components/FeedbackState";
import { ImageLightbox } from "../components/ImageLightbox";
import { SideDrawer } from "../components/SideDrawer";
import { TabPageHeader } from "../components/TabPageHeader";
import { UserAvatar } from "../components/UserAvatar";
import { api } from "../lib/api";
import { useAuth } from "../lib/auth";
import { useI18n } from "../lib/language";
import { toMessageUploadError, uploadMessageMediaWith } from "../lib/messageUpload";
import { buildTabCacheScope, readTabCache, writeTabCache } from "../lib/tabCache";
import type { ImageMetadataDTO, SquareStatementCommentDTO, SquareStatementDTO, SquareStatementDraftMedia, VideoMetadataDTO } from "../types";

type SelectedPhoto = {
  id: string;
  file: File;
  preview: string;
};
type SelectedVideo = SelectedPhoto & { duration: number };

const MAX_TEXT_LENGTH = 140;
const MAX_PHOTOS = 9;
const MAX_AUDIO_SECONDS = 60;
const MAX_VIDEO_SECONDS = 60;

function SquareMediaMetadata({ metadata }: { metadata?: ImageMetadataDTO | VideoMetadataDTO | null }) {
  const { t } = useI18n();
  const rows = [
    [t("media.takenAt"), metadata?.taken_at ? formatStatementTime(metadata.taken_at, "zh-CN") : null],
    [t("media.device"), [metadata?.make, metadata?.model].filter(Boolean).join(" ")],
    [t("media.lens"), metadata?.lens_model],
    [t("media.location"), metadata?.address],
  ].filter((row) => row[1]);
  if (!rows.length) return null;
  return <dl className="message-image-metadata-list square-image-metadata">{rows.map(([label, value]) => <div key={String(label)}><dt>{String(label)}</dt><dd>{String(value)}</dd></div>)}</dl>;
}

function formatStatementTime(timestamp: number, language: string) {
  return new Intl.DateTimeFormat(language === "zh-CN" ? "zh-CN" : "en", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(timestamp * 1000));
}

function StatementCard({ statement, language, canInteract, detail = false, onDelete, onLike, onOpen, onOpenImage }: {
  statement: SquareStatementDTO;
  language: string;
  canInteract: boolean;
  detail?: boolean;
  onDelete: () => void;
  onLike: () => void;
  onOpen: () => void;
  onOpenImage: (index: number) => void;
}) {
  const { t } = useI18n();
  const [playing, setPlaying] = useState(false);
  const audioRef = useRef<HTMLAudioElement>(null);
  const images = statement.media.filter((item) => item.kind === "image");
  const audio = statement.media.find((item) => item.kind === "audio");
  const video = statement.media.find((item) => item.kind === "video");
  return (
    <article className={`square-statement-card${detail ? " is-detail" : " is-clickable"}`} onClick={detail ? undefined : onOpen} onKeyDown={detail ? undefined : (event) => { if (event.key === "Enter" || event.key === " ") onOpen(); }} role={detail ? undefined : "button"} tabIndex={detail ? undefined : 0}>
      <header className="square-statement-author">
        <UserAvatar
          className="square-statement-avatar"
          frame={statement.user.avatar_frame_style}
          name={statement.user.name}
          uri={statement.user.avatar_uri}
          vip={Boolean(statement.user.is_permanent_vip)}
        />
        <div className="square-statement-author-copy">
          <strong>{statement.user.name}</strong>
          <span>{formatStatementTime(statement.created_at, language)}</span>
        </div>
        {statement.can_delete ? <button aria-label={t("common.more")} className="square-statement-menu" onClick={(event) => { event.stopPropagation(); onDelete(); }} type="button"><span className="material-symbols-outlined">more_horiz</span></button> : null}
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
      {video ? <video className="square-statement-video" controls onClick={(event) => event.stopPropagation()} playsInline poster={video.thumbnail_uri || undefined} preload="metadata" src={video.uri} /> : null}
      <footer className="square-statement-footer">
        <button className={statement.liked ? "is-liked" : ""} disabled={!canInteract} onClick={(event) => { event.stopPropagation(); onLike(); }} type="button"><span className="material-symbols-outlined">favorite</span><span>{statement.like_count || t("square.like")}</span></button>
        <button onClick={(event) => { event.stopPropagation(); onOpen(); }} type="button">
          <span className="material-symbols-outlined">chat_bubble</span>
          <span>{statement.comment_count ? t("square.commentsCount", { count: statement.comment_count }) : t("square.comment")}</span>
        </button>
      </footer>
    </article>
  );
}

function CommentThread({ comment, language, canInteract, onLike, onReply }: {
  comment: SquareStatementCommentDTO;
  language: string;
  canInteract: boolean;
  onLike: (comment: SquareStatementCommentDTO) => void;
  onReply: (comment: SquareStatementCommentDTO) => void;
}) {
  const { t } = useI18n();
  return <article className="square-comment-thread">
    <UserAvatar className="square-comment-avatar" frame={comment.user.avatar_frame_style} name={comment.user.name} uri={comment.user.avatar_uri} vip={Boolean(comment.user.is_permanent_vip)} />
    <div>
      <header><strong>{comment.user.name}</strong><span>{formatStatementTime(comment.created_at, language)}</span></header>
      <p>{comment.text}</p>
      <div className="square-comment-actions">
        <button className={comment.liked ? "is-liked" : ""} disabled={!canInteract} onClick={() => onLike(comment)} type="button"><span className="material-symbols-outlined">favorite</span>{comment.like_count || t("square.like")}</button>
        {!comment.parent_id && canInteract ? <button onClick={() => onReply(comment)} type="button">{t("square.reply")}</button> : null}
      </div>
      {comment.replies?.length ? <div className="square-comment-replies">{comment.replies.map((reply) => <CommentThread canInteract={canInteract} comment={reply} key={reply.comment_id} language={language} onLike={onLike} onReply={onReply} />)}</div> : null}
    </div>
  </article>;
}

export default function SquarePage() {
  const { t, language } = useI18n();
  const { session } = useAuth();
  const cacheScope = buildTabCacheScope(session?.user.space_id, session?.user.user_id);
  const [feedMode, setFeedMode] = useState<"all" | "friends">("all");
  const [statements, setStatements] = useState<SquareStatementDTO[]>(() => readTabCache<SquareStatementDTO[]>(cacheScope, "square:all")?.data ?? []);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [error, setError] = useState("");
  const [text, setText] = useState("");
  const [visibility, setVisibility] = useState<"public" | "friends">("public");
  const [photos, setPhotos] = useState<SelectedPhoto[]>([]);
  const [video, setVideo] = useState<SelectedVideo | null>(null);
  const [voiceFile, setVoiceFile] = useState<File | null>(null);
  const [voiceDuration, setVoiceDuration] = useState(0);
  const [recording, setRecording] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [composerOpen, setComposerOpen] = useState(false);
  const [visibilitySheetOpen, setVisibilitySheetOpen] = useState(false);
  const [voiceSheetOpen, setVoiceSheetOpen] = useState(false);
  const [gallery, setGallery] = useState<{ statementId: number; index: number } | null>(null);
  const [commentStatementId, setCommentStatementId] = useState<number | null>(null);
  const [comments, setComments] = useState<SquareStatementCommentDTO[]>([]);
  const [commentsLoading, setCommentsLoading] = useState(false);
  const [commentsHasMore, setCommentsHasMore] = useState(false);
  const [commentText, setCommentText] = useState("");
  const [replyTarget, setReplyTarget] = useState<SquareStatementCommentDTO | null>(null);
  const [commentSending, setCommentSending] = useState(false);
  const [deleteStatementId, setDeleteStatementId] = useState<number | null>(null);
  const photoInputRef = useRef<HTMLInputElement>(null);
  const videoInputRef = useRef<HTMLInputElement>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const recorderStreamRef = useRef<MediaStream | null>(null);
  const recorderChunksRef = useRef<Blob[]>([]);
  const recordingStartedAtRef = useRef(0);
  const recordingTimerRef = useRef<number | null>(null);
  const currentUser = session?.user;
  const canPublish = Boolean(currentUser?.verified);
  const growthLevel = currentUser?.growth_level ?? 1;
  const canSendVoice = Boolean(currentUser?.official) || growthLevel >= 6;
  const canSendVideo = Boolean(currentUser?.official) || growthLevel >= 8;
  const activeCommentStatement = statements.find((item) => item.statement_id === commentStatementId) ?? null;
  const galleryStatement = statements.find((item) => item.statement_id === gallery?.statementId) ?? null;
  const galleryImages = galleryStatement?.media.filter((item) => item.kind === "image") ?? [];
  const voicePreview = useMemo(() => voiceFile ? URL.createObjectURL(voiceFile) : null, [voiceFile]);

  const remaining = MAX_TEXT_LENGTH - text.length;
  const publishable = useMemo(
    () => Boolean(text.trim() || photos.length || voiceFile || video) && !publishing && text.length <= MAX_TEXT_LENGTH,
    [photos.length, publishing, text, video, voiceFile],
  );

  const loadStatements = async (before?: number) => {
    const controller = new AbortController();
    try {
      const rows = await api.getSquareStatements({ before, limit: 20, friends_only: feedMode === "friends" ? 1 : 0 }, controller.signal);
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
    const cacheKey = `square:${feedMode}`;
    const cached = readTabCache<SquareStatementDTO[]>(cacheScope, cacheKey)?.data;
    setStatements(cached ?? []);
    setLoading(!cached);
    setSyncing(true);
    const controller = new AbortController();
    void api.getSquareStatements({ limit: 20, friends_only: feedMode === "friends" ? 1 : 0 }, controller.signal).then((rows) => {
      setStatements(rows);
      writeTabCache(cacheScope, cacheKey, rows);
      setHasMore(rows.length === 20);
      setError("");
    }).catch((cause) => {
      if (!controller.signal.aborted) setError(cause instanceof Error ? cause.message : t("square.loadFailed"));
    }).finally(() => { setLoading(false); setSyncing(false); });
    return () => controller.abort();
  }, [cacheScope, feedMode, t]);

  useEffect(() => {
    if (statements.length) writeTabCache(cacheScope, `square:${feedMode}`, statements);
  }, [cacheScope, feedMode, statements]);

  useEffect(() => () => {
    recorderStreamRef.current?.getTracks().forEach((track) => track.stop());
    if (recordingTimerRef.current !== null) window.clearInterval(recordingTimerRef.current);
  }, []);

  useEffect(() => () => { if (voicePreview) URL.revokeObjectURL(voicePreview); }, [voicePreview]);

  useEffect(() => {
    if (commentStatementId === null) return;
    const controller = new AbortController();
    setCommentsLoading(true);
    void Promise.all([
      api.getSquareStatement(commentStatementId, controller.signal),
      api.getSquareStatementComments(commentStatementId, { offset: 0, limit: 30 }, controller.signal),
    ]).then(([statement, rows]) => {
      setStatements((current) => current.map((item) => item.statement_id === statement.statement_id ? statement : item));
      setComments(rows);
      setCommentsHasMore(rows.length === 30);
    }).catch((cause) => {
      if (!controller.signal.aborted) setError(cause instanceof Error ? cause.message : t("square.commentsLoadFailed"));
    }).finally(() => setCommentsLoading(false));
    return () => controller.abort();
  }, [commentStatementId, t]);

  const sendComment = async () => {
    const content = commentText.trim();
    if (commentStatementId === null || !content || commentSending) return;
    setCommentSending(true);
    try {
      const comment = await api.createSquareStatementComment(commentStatementId, content, replyTarget?.comment_id);
      setComments((current) => replyTarget
        ? current.map((item) => item.comment_id === replyTarget.comment_id ? { ...item, reply_count: item.reply_count + 1, replies: [...(item.replies ?? []), comment] } : item)
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
      const statement = await api.createSquareStatement({ text: text.trim(), visibility, media });
      setStatements((current) => [statement, ...current]);
      photos.forEach((photo) => URL.revokeObjectURL(photo.preview));
      setText("");
      setPhotos([]);
      setVoiceFile(null);
      setVoiceDuration(0);
      setVisibility("public");
      if (video) URL.revokeObjectURL(video.preview);
      setVideo(null);
      setComposerOpen(false);
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

  return (
    <AppChrome title={t("square.title")} hideTopbar shellClassName="desktop-tab-shell square-community-shell">
      <main className="list-screen square-feed-screen">
        <TabPageHeader
          syncing={syncing}
          title={t("square.title")}
          actions={canPublish ? (
            <button className="square-header-publish" onClick={() => setComposerOpen(true)} type="button">
              <span className="material-symbols-outlined">edit_square</span>
              <span>{t("square.publish")}</span>
            </button>
          ) : null}
        />
        <div className="square-feed-column">
          <div className="square-feed-filter" role="tablist">
            <button aria-selected={feedMode === "all"} className={feedMode === "all" ? "is-active" : ""} onClick={() => setFeedMode("all")} role="tab" type="button">{t("square.feedAll")}</button>
            <button aria-selected={feedMode === "friends"} className={feedMode === "friends" ? "is-active" : ""} onClick={() => setFeedMode("friends")} role="tab" type="button">{t("square.feedFriends")}</button>
          </div>
          {canPublish ? (
            <button className="square-compose-launcher" onClick={() => setComposerOpen(true)} type="button">
              <UserAvatar className="square-composer-avatar" frame={currentUser?.avatar_frame_style} name={currentUser?.name || ""} uri={currentUser?.avatar_uri} vip={Boolean(currentUser?.is_permanent_vip)} />
              <span>{text.trim() || t("square.saySomething")}</span>
              <i><span className="material-symbols-outlined">image</span></i>
              <i><span className="material-symbols-outlined">mic</span></i>
            </button>
          ) : (
            <section className="square-readonly-notice">
              <span className="material-symbols-outlined">visibility</span>
              <div><strong>{t("square.readOnlyTitle")}</strong><p>{t("square.readOnlyHint")}</p></div>
            </section>
          )}
          {error ? <div className="square-inline-error">{error}</div> : null}
          {loading ? <FeedbackState title={t("common.loading")} /> : null}
          {!loading && !statements.length && !error ? <FeedbackState title={t("square.empty")} description={t("square.emptyHint")} /> : null}
          <section className="square-statement-feed">
            {statements.map((statement) => <StatementCard canInteract={canPublish} key={statement.statement_id} language={language} onDelete={() => setDeleteStatementId(statement.statement_id)} onLike={() => void toggleStatementLike(statement)} onOpen={() => setCommentStatementId(statement.statement_id)} onOpenImage={(index) => setGallery({ statementId: statement.statement_id, index })} statement={statement} />)}
          </section>
          {hasMore && statements.length ? (
            <button className="square-load-more" disabled={loadingMore} onClick={() => {
              setLoadingMore(true);
              void loadStatements(statements[statements.length - 1]?.statement_id);
            }} type="button">{loadingMore ? t("common.loading") : t("square.loadMore")}</button>
          ) : null}
        </div>
      </main>
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
      <BottomSheet bodyClassName="square-voice-sheet" onClose={() => { if (recording) stopRecording(); setVoiceSheetOpen(false); }} open={voiceSheetOpen} title={t("square.voice")}>
        <div className={`square-voice-stage${recording ? " is-recording" : ""}`}><div className="square-voice-bars">{Array.from({ length: 25 }, (_, index) => <i key={index} />)}</div><strong>{Math.min(voiceDuration, MAX_AUDIO_SECONDS)}<small> / {MAX_AUDIO_SECONDS}s</small></strong></div>
        <button className="square-record-button" onClick={() => void startRecording()} type="button"><span className="material-symbols-outlined">{recording ? "stop" : "mic"}</span></button>
        <p>{recording ? t("square.tapToStop") : voiceFile ? t("square.voiceReady") : t("square.tapToRecord")}</p>
        {voicePreview && !recording ? <audio className="square-voice-preview" controls preload="metadata" src={voicePreview} /> : null}
        {voiceFile && !recording ? <button className="primary-button" onClick={() => setVoiceSheetOpen(false)} type="button">{t("common.done")}</button> : null}
      </BottomSheet>
      <SideDrawer historyKey="square-statement" onClose={() => { setCommentStatementId(null); setReplyTarget(null); }} open={commentStatementId !== null} title={t("square.statementDetail")}>
        <div className="square-comments-drawer">
          {activeCommentStatement ? <StatementCard canInteract={canPublish} detail language={language} onDelete={() => setDeleteStatementId(activeCommentStatement.statement_id)} onLike={() => void toggleStatementLike(activeCommentStatement)} onOpen={() => undefined} onOpenImage={(index) => setGallery({ statementId: activeCommentStatement.statement_id, index })} statement={activeCommentStatement} /> : null}
          <div className="square-comments-heading"><strong>{t("square.comments")}</strong><span>{activeCommentStatement?.comment_count ?? 0}</span></div>
          {commentsLoading && !comments.length ? <FeedbackState title={t("common.loading")} /> : null}
          {!commentsLoading && !comments.length ? <div className="square-comments-empty"><span className="material-symbols-outlined">forum</span><strong>{t("square.noComments")}</strong><p>{canPublish ? t("square.noCommentsHint") : t("square.readOnlyHint")}</p></div> : null}
          <div className="square-comment-list">{comments.map((comment) => <CommentThread canInteract={canPublish} comment={comment} key={comment.comment_id} language={language} onLike={(target) => void toggleCommentLike(target)} onReply={(target) => { setReplyTarget(target); setCommentText(""); }} />)}</div>
          {commentsHasMore ? <button className="square-load-more" disabled={commentsLoading} onClick={() => {
            if (commentStatementId === null) return;
            setCommentsLoading(true);
            void api.getSquareStatementComments(commentStatementId, { offset: comments.length, limit: 30 }).then((rows) => { setComments((current) => [...current, ...rows]); setCommentsHasMore(rows.length === 30); }).finally(() => setCommentsLoading(false));
          }} type="button">{t("square.loadMoreComments")}</button> : null}
          {canPublish ? <form className="square-comment-composer" onSubmit={(event) => { event.preventDefault(); void sendComment(); }}><UserAvatar className="square-comment-avatar" frame={currentUser?.avatar_frame_style} name={currentUser?.name || ""} uri={currentUser?.avatar_uri} vip={Boolean(currentUser?.is_permanent_vip)} /><div>{replyTarget ? <button className="square-reply-target" onClick={() => setReplyTarget(null)} type="button">{t("square.replyingTo", { name: replyTarget.user.name })}<span className="material-symbols-outlined">close</span></button> : null}<input aria-label={t("square.writeComment")} maxLength={MAX_TEXT_LENGTH} onChange={(event) => setCommentText(event.target.value)} placeholder={replyTarget ? t("square.writeReply") : t("square.writeComment")} value={commentText} /></div><button disabled={!commentText.trim() || commentSending} type="submit"><span className="material-symbols-outlined">arrow_upward</span></button></form> : null}
        </div>
      </SideDrawer>
      {gallery && galleryImages.length ? <ImageLightbox altPrefix={t("square.photo")} details={galleryImages.map((image) => <SquareMediaMetadata key={image.media_id} metadata={image.metadata} />)} index={gallery.index} onClose={() => setGallery(null)} onIndexChange={(index) => setGallery((current) => current ? { ...current, index } : null)} uris={galleryImages.map((image) => image.uri)} /> : null}
      <BottomSheet bodyClassName="square-delete-sheet" onClose={() => setDeleteStatementId(null)} open={deleteStatementId !== null} title={t("square.deleteStatement")}><p>{t("square.deleteStatementHint")}</p><button className="danger-button" onClick={() => { const id = deleteStatementId; if (id === null) return; void api.deleteSquareStatement(id).then(() => { setStatements((current) => current.filter((item) => item.statement_id !== id)); setDeleteStatementId(null); }); }} type="button">{t("common.delete")}</button></BottomSheet>
    </AppChrome>
  );
}
