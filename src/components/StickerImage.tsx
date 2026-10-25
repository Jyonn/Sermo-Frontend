import { useEffect, useState } from "react";
import { i18n } from "../lib/language";
export function StickerImage({ alt = "", className = "", height, src, width }: {
  alt?: string;
  className?: string;
  height?: number;
  src: string;
  width?: number;
}) {
  const [failed, setFailed] = useState(false);

  useEffect(() => setFailed(false), [src]);

  if (failed) {
    return <span className={`sticker-load-failed${className ? ` ${className}` : ""}`}>{i18n.t("sticker.unavailable")}</span>;
  }

  return <img alt={alt} className={className} draggable={false} height={height} loading="lazy" onError={() => setFailed(true)} src={src} width={width} />;
}
