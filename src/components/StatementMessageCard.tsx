import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import type { SquareStatementDTO } from "../types";
import { useI18n } from "../lib/language";
import { UserAvatar } from "./UserAvatar";
import { ImageLightbox, MediaLightbox } from "./ImageLightbox";
import { MediaMetadataPanel } from "./MediaMetadataPanel";
import { StatementVideoThumbnail } from "./StatementVideoThumbnail";

function formatDuration(value: number) {
  const seconds = Math.max(0, Math.floor(value || 0));
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
}

function formatFileSize(value?: number | null) {
  if (value == null) return "";
  if (value >= 1024 * 1024) return `${(value / (1024 * 1024)).toFixed(1)} MB`;
  return `${Math.max(1, Math.round(value / 1024))} KB`;
}

export function StatementMessageCard({ statement }: { statement: SquareStatementDTO | null | undefined }) {
  const { t } = useI18n();
  const navigate = useNavigate();
  const [imageIndex, setImageIndex] = useState<number | null>(null);
  const [videoOpen, setVideoOpen] = useState(false);
  const [audioPlaying, setAudioPlaying] = useState(false);
  const [audioCurrentTime, setAudioCurrentTime] = useState(0);
  const [audioDuration, setAudioDuration] = useState(0);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const images = useMemo(() => statement?.media.filter((item) => item.kind === "image") ?? [], [statement]);
  const audio = statement?.media.find((item) => item.kind === "audio");
  const video = statement?.media.find((item) => item.kind === "video");

  useEffect(() => () => audioRef.current?.pause(), []);

  if (!statement) {
    return (
      <div className="message-statement-card is-unavailable">
        <span className="material-symbols-outlined">speaker_notes_off</span>
        <span><strong>{t("message.statementUnavailable")}</strong><small>{t("message.statementUnavailableHint")}</small></span>
      </div>
    );
  }

  const openStatement = () => navigate(`/app/square/statements/${statement.statement_id}`);
  const layout = statement.chat_record?.items?.length
    ? "chat-record"
    : video
    ? "video"
    : audio
      ? "audio"
      : images.length >= 3
        ? "images-many"
        : images.length === 2
          ? "images-two"
          : images.length === 1
            ? "image-one"
            : "text";
  const visibleImages = images.slice(0, 3);
  return (
    <div className={`message-statement-card layout-${layout}${statement.is_anonymous ? " is-anonymous" : ""}`}>
      <button className="message-statement-head" onClick={openStatement} type="button">
        {statement.is_anonymous
          ? <span className="message-statement-avatar message-statement-anonymous-avatar"><span className="material-symbols-outlined">person</span></span>
          : <UserAvatar className="message-statement-avatar" frame={statement.user.avatar_frame_style} name={statement.user.name} uri={statement.user.avatar_uri} />}
        <span>
          <strong>{statement.is_anonymous ? t("square.anonymousUser") : statement.user.name}</strong>
          <small>{statement.is_anonymous ? t("square.publishAnonymously") : t("message.statement")}</small>
        </span>
        <span className="material-symbols-outlined">chevron_right</span>
      </button>
      <div className="message-statement-content">
        {statement.text ? <button className="message-statement-text" onClick={openStatement} type="button">{statement.text}</button> : null}
        {layout.startsWith("image") ? (
          <div className={`message-statement-images count-${visibleImages.length}`}>
            {visibleImages.map((image, index) => (
              <button key={image.media_id} onClick={(event) => { event.stopPropagation(); setImageIndex(index); }} type="button">
                <img alt="" loading="lazy" src={image.thumbnail_uri || image.uri} />
                {index === 2 ? <span className="message-statement-more">{images.length > 3 ? `+${images.length - 2}` : t("message.viewMore")}</span> : null}
              </button>
            ))}
          </div>
        ) : null}
        {layout === "audio" && audio ? (
          <button className={`message-statement-audio${audioPlaying ? " is-playing" : ""}`} onClick={(event) => {
            event.stopPropagation();
            const player = audioRef.current;
            if (!player) return;
            if (player.paused) void player.play(); else player.pause();
          }} type="button">
            <span className="message-statement-audio-control material-symbols-outlined">{audioPlaying ? "pause" : "play_arrow"}</span>
            <span className="message-statement-audio-wave" aria-hidden="true">{Array.from({ length: 12 }, (_, index) => <i key={index} />)}</span>
            <time>{formatDuration(audioCurrentTime)} / {formatDuration(audioDuration || audio.duration_seconds || 0)}</time>
            <audio
              onDurationChange={(event) => setAudioDuration(event.currentTarget.duration)}
              onEnded={() => { setAudioPlaying(false); setAudioCurrentTime(0); }}
              onPause={() => setAudioPlaying(false)}
              onPlay={() => setAudioPlaying(true)}
              onTimeUpdate={(event) => setAudioCurrentTime(event.currentTarget.currentTime)}
              preload="metadata"
              ref={audioRef}
              src={audio.uri}
            />
          </button>
        ) : null}
        {layout === "video" && video ? (
          <StatementVideoThumbnail className="message-statement-video" durationSeconds={video.duration_seconds} onClick={() => setVideoOpen(true)} thumbnailUri={video.thumbnail_uri} />
        ) : null}
        {layout === "chat-record" && statement.chat_record ? (
          <button className="message-statement-chat-record" onClick={(event) => {
            event.stopPropagation();
            window.dispatchEvent(new CustomEvent("sermo:forward-bundle", { detail: statement.chat_record }));
          }} type="button">
            <span className="material-symbols-outlined">forum</span>
            <span>
              <strong>{t("message.forwardBundleSnapshot")}</strong>
              <small>{statement.chat_record.items?.[0]?.author.name || t("message.forwardBundlePlaceholder")}</small>
            </span>
            <b>{statement.chat_record.items?.length ?? 0}</b>
            <span className="material-symbols-outlined">chevron_right</span>
          </button>
        ) : null}
      </div>
      <button className="message-statement-stats" onClick={openStatement} type="button">
        <span><span className="material-symbols-outlined">favorite</span>{statement.like_count}</span>
        <span><span className="material-symbols-outlined">chat_bubble</span>{statement.comment_count}</span>
        <strong>{t("message.viewStatement")}</strong>
      </button>
      {imageIndex !== null && images.length ? <ImageLightbox altPrefix={t("square.photo")} details={images.map((image) => <MediaMetadataPanel key={image.media_id} kind="image" metadata={image.metadata} />)} downloadLabels={images.map((image) => formatFileSize(image.metadata?.file_size))} index={imageIndex} onClose={() => setImageIndex(null)} onIndexChange={setImageIndex} uris={images.map((image) => image.uri)} /> : null}
      {videoOpen && video ? <MediaLightbox altPrefix={t("square.video")} index={0} items={[{
        kind: "video",
        uri: video.uri,
        posterUri: video.thumbnail_uri,
        width: video.metadata?.pixel_width,
        height: video.metadata?.pixel_height,
        detail: <MediaMetadataPanel kind="video" metadata={video.metadata} />,
        downloadLabel: formatFileSize(video.metadata?.file_size),
      }]} onClose={() => setVideoOpen(false)} onIndexChange={() => undefined} /> : null}
    </div>
  );
}
