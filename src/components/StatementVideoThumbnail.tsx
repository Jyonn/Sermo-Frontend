interface StatementVideoThumbnailProps {
  className?: string;
  durationSeconds?: number | null;
  onClick: () => void;
  thumbnailUri?: string | null;
}

function formatDuration(value: number) {
  const seconds = Math.max(0, Math.floor(value || 0));
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
}

export function StatementVideoThumbnail({ className = "", durationSeconds, onClick, thumbnailUri }: StatementVideoThumbnailProps) {
  return (
    <button className={`statement-video-thumbnail${className ? ` ${className}` : ""}`} onClick={(event) => { event.stopPropagation(); onClick(); }} type="button">
      {thumbnailUri ? <img alt="" loading="lazy" src={thumbnailUri} /> : <span className="statement-video-thumbnail-placeholder" />}
      <span className="statement-video-thumbnail-play material-symbols-outlined">play_arrow</span>
      {durationSeconds ? <time>{formatDuration(durationSeconds)}</time> : null}
    </button>
  );
}
