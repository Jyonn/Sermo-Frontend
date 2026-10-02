import { useState } from "react";
import "./MediaWaitFeedback.css";

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
  const [coverResult, setCoverResult] = useState<{ uri: string; status: "ready" | "error" } | null>(null);
  const coverState = coverResult && coverResult.uri === thumbnailUri ? coverResult.status : thumbnailUri ? "loading" : "error";
  return (
    <button className={`statement-video-thumbnail${className ? ` ${className}` : ""}${coverState === "loading" ? " is-cover-loading" : ""}`} onClick={(event) => { event.stopPropagation(); onClick(); }} type="button">
      {thumbnailUri && coverState !== "error" ? <img alt="" loading="lazy" onError={() => setCoverResult({ uri: thumbnailUri, status: "error" })} onLoad={() => setCoverResult({ uri: thumbnailUri, status: "ready" })} src={thumbnailUri} /> : <span className="statement-video-thumbnail-placeholder" />}
      <span className="statement-video-thumbnail-play material-symbols-outlined">play_arrow</span>
      {durationSeconds ? <time>{formatDuration(durationSeconds)}</time> : null}
    </button>
  );
}
