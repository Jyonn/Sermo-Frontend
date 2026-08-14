import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import type { SquareStatementDTO } from "../types";
import { useI18n } from "../lib/language";
import { UserAvatar } from "./UserAvatar";
import { ImageLightbox } from "./ImageLightbox";

export function StatementMessageCard({ statement }: { statement: SquareStatementDTO | null | undefined }) {
  const { t } = useI18n();
  const navigate = useNavigate();
  const [imageIndex, setImageIndex] = useState<number | null>(null);
  const images = useMemo(() => statement?.media.filter((item) => item.kind === "image") ?? [], [statement]);
  const audio = statement?.media.find((item) => item.kind === "audio");
  const video = statement?.media.find((item) => item.kind === "video");

  if (!statement) {
    return (
      <div className="message-statement-card is-unavailable">
        <span className="material-symbols-outlined">speaker_notes_off</span>
        <span><strong>{t("message.statementUnavailable")}</strong><small>{t("message.statementUnavailableHint")}</small></span>
      </div>
    );
  }

  const openStatement = () => navigate(`/app/square/statements/${statement.statement_id}`);
  const layout = video
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
        {layout === "audio" && audio ? <audio className="message-statement-audio" controls onClick={(event) => event.stopPropagation()} preload="metadata" src={audio.uri} /> : null}
        {layout === "video" && video ? <video className="message-statement-video" controls onClick={(event) => event.stopPropagation()} playsInline poster={video.thumbnail_uri || undefined} preload="metadata" src={video.uri} /> : null}
      </div>
      <button className="message-statement-stats" onClick={openStatement} type="button">
        <span><span className="material-symbols-outlined">favorite</span>{statement.like_count}</span>
        <span><span className="material-symbols-outlined">chat_bubble</span>{statement.comment_count}</span>
        <strong>{t("message.viewStatement")}</strong>
      </button>
      {imageIndex !== null && images.length ? <ImageLightbox altPrefix={t("square.photo")} index={imageIndex} onClose={() => setImageIndex(null)} onIndexChange={setImageIndex} uris={images.map((image) => image.uri)} /> : null}
    </div>
  );
}
