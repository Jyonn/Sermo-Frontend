import { useLayoutEffect, useRef, useState } from "react";
import "./MediaWaitFeedback.css";
import {naturalMediaRatio} from '../lib/squareNoteMedia';

interface StatementVideoThumbnailProps {
  fitMedia?:boolean;
  aspectRatio?:number|null;
  className?: string;
  durationSeconds?: number | null;
  onClick: () => void;
  thumbnailUri?: string | null;
  eager?: boolean;
}

function formatDuration(value: number) {
  const seconds = Math.max(0, Math.floor(value || 0));
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
}

export function StatementVideoThumbnail({ className = "", durationSeconds, onClick, thumbnailUri, eager = false,fitMedia=false,aspectRatio }: StatementVideoThumbnailProps) {
  const [coverResult, setCoverResult] = useState<{ uri: string; status: "ready" | "error" } | null>(null);
  const imageRef = useRef<HTMLImageElement | null>(null);
  const [coverRatio,setCoverRatio]=useState<{uri:string;ratio:number}|null>(null);
  const rememberSize=(image:HTMLImageElement)=>{const ratio=naturalMediaRatio(image.naturalWidth,image.naturalHeight);if(fitMedia&&thumbnailUri&&ratio)setCoverRatio({uri:thumbnailUri,ratio})};
  useLayoutEffect(() => {
    if (thumbnailUri && imageRef.current?.complete && imageRef.current.naturalWidth > 0) {
      setCoverResult({ uri: thumbnailUri, status: "ready" });
      rememberSize(imageRef.current);
    }
  }, [thumbnailUri,fitMedia]);
  const coverState = coverResult && coverResult.uri === thumbnailUri ? coverResult.status : thumbnailUri ? "loading" : "error";
  return (
    <button style={fitMedia?{aspectRatio:naturalMediaRatio(aspectRatio,1)??(coverRatio && coverRatio.uri===thumbnailUri?coverRatio.ratio:null)??16/9}:undefined} className={`statement-video-thumbnail${fitMedia?' is-fit-media':''}${className ? ` ${className}` : ""}${coverState === "loading" ? " is-cover-loading" : ""}`} onClick={(event) => { event.stopPropagation(); onClick(); }} type="button">
      {thumbnailUri && coverState !== "error" ? <img alt="" loading={eager ? "eager" : "lazy"} ref={imageRef} onError={() => setCoverResult({ uri: thumbnailUri, status: "error" })} onLoad={event=>{setCoverResult({ uri: thumbnailUri, status: "ready" });rememberSize(event.currentTarget)}} src={thumbnailUri} /> : <span className="statement-video-thumbnail-placeholder" />}
      <span className="statement-video-thumbnail-play material-symbols-outlined">play_arrow</span>
      {durationSeconds ? <time>{formatDuration(durationSeconds)}</time> : null}
    </button>
  );
}
