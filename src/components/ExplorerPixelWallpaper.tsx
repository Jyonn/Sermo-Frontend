import { useId } from "react";
import type { CSSProperties, RefObject } from "react";
import { EXPLORER_SILHOUETTES, explorerPortraitPixels } from "../lib/explorerMotion";
import { EXPLORER_ART } from "../lib/explorer";

const portraits = (["conan", "shinichi"] as const).map((name) => ({ name, pixels: explorerPortraitPixels(name) }));

export function ExplorerPixelWallpaper({ compact, sceneRef }: { compact: boolean; sceneRef: RefObject<SVGSVGElement> }) {
  const id = useId().replace(/:/g, "");
  return <svg ref={sceneRef} aria-hidden="true" className={`explorer-living-wallpaper${compact ? " is-compact" : ""}`} preserveAspectRatio="xMidYMid slice" viewBox="0 0 960 1440">
    <defs>
      {portraits.map(({ name, pixels }) => <g key={name}>
        <clipPath id={`${id}-${name}-silhouette`}>{EXPLORER_SILHOUETTES[name].map((polygon, index) => <polygon key={index} points={polygon.map((point) => point.join(",")).join(" ")} />)}</clipPath>
        <g id={`${id}-${name}`} clipPath={`url(#${id}-${name}-silhouette)`}><image width="960" height="1440" href={name === "conan" ? EXPLORER_ART.background : EXPLORER_ART.backgroundAlternate} /></g>
        {pixels.map((pixel, index) => <clipPath id={`${id}-${name}-tile-${index}`} key={index}><rect x={pixel.x} y={pixel.y} width={pixel.size + .35} height={pixel.size + .35} /></clipPath>)}
      </g>)}
    </defs>
    <image className="explorer-wallpaper-environment" width="960" height="1440" href="/activity/explorer-2026/roof-night-v4.webp" />
    <image className="explorer-wallpaper-still" width="960" height="1440" href="/activity/explorer-2026/conan-night-v2.webp" />
    {portraits.map(({ name, pixels }) => <g className={`explorer-pixel-portrait is-${name}`} key={name}>
      {pixels.map((pixel, index) => <g className="explorer-pixel-tile" key={index} style={{ ...Object.fromEntries(pixel.curve.flatMap(([x, y], step) => [[`--curve-${step + 1}-x`, `${x.toFixed(2)}px`], [`--curve-${step + 1}-y`, `${y.toFixed(2)}px`]])), "--burst-lag": `${pixel.lag.toFixed(3)}s`, transformOrigin: `${pixel.x + pixel.size / 2}px ${pixel.y + pixel.size / 2}px` } as CSSProperties}>
        <use clipPath={`url(#${id}-${name}-tile-${index})`} href={`#${id}-${name}`} />
      </g>)}
    </g>)}
  </svg>;
}
