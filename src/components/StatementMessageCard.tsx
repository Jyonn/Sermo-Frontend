import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import type { SquareStatementDTO } from "../types";
import { useI18n } from "../lib/language";
import { UserAvatar } from "./UserAvatar";
import { ImageLightbox, MediaLightbox } from "./ImageLightbox";

function formatDuration(value: number) {
  const seconds = Math.max(0, Math.floor(value || 0));
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
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
    <div className={`message-statement-card layout-${layout}`}>
      <button className="message-statement-head" onClick={openStatement} type="button">
        <UserAvatar className="message-statement-avatar" frame={statement.user.avatar_frame_style} name={statement.user.name} uri={statement.user.avatar_uri} vip={Boolean(statement.user.is_permanent_vip)} />
        <span><strong>{statement.user.name}</strong><small>{t("message.statement")}</small></span>
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
          <button className="message-statement-video" onClick={(event) => { event.stopPropagation(); setVideoOpen(true); }} type="button">
            {video.thumbnail_uri ? <img alt="" loading="lazy" src={video.thumbnail_uri} /> : <span className="message-statement-video-placeholder" />}
            <span className="message-statement-video-play material-symbols-outlined">play_arrow</span>
            {video.duration_seconds ? <time>{formatDuration(video.duration_seconds)}</time> : null}
          </button>
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
      {imageIndex !== null && images.length ? <ImageLightbox altPrefix={t("square.photo")} index={imageIndex} onClose={() => setImageIndex(null)} onIndexChange={setImageIndex} uris={images.map((image) => image.uri)} /> : null}
      {videoOpen && video ? <MediaLightbox altPrefix={t("square.video")} index={0} items={[{
        kind: "video",
        uri: video.uri,
        posterUri: video.thumbnail_uri,
        width: video.metadata?.pixel_width,
        height: video.metadata?.pixel_height,
      }]} onClose={() => setVideoOpen(false)} onIndexChange={() => undefined} /> : null}
    </div>
  );
}
