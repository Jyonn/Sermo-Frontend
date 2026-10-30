import { useId } from "react";
import type { CSSProperties, RefObject } from "react";

// Both portraits are rebuilt from the same grid, so the transition reads as a
// transformation rather than a fade between unrelated posters.
const tiles = Array.from({ length: 150 }, (_, index) => {
  const column = index % 10;
  const row = Math.floor(index / 10);
  return { x: column * 96, y: row * 96, dx: (column - 4.5) * 72, dy: (row - 7) * 54, turn: ((index * 17) % 47) - 23, lag: ((column + row * 2) % 7) * .025 };
});

export function ExplorerPixelWallpaper({ compact, sceneRef }: { compact: boolean; sceneRef: RefObject<SVGSVGElement> }) {
  const id = useId().replace(/:/g, "");
  return <svg ref={sceneRef} aria-hidden="true" className={`explorer-living-wallpaper${compact ? " is-compact" : ""}`} preserveAspectRatio="xMidYMid slice" viewBox="0 0 960 1440">
    <defs>
      <image id={`${id}-conan`} width="960" height="1440" href="/activity/explorer-2026/conan-night-v2.webp" />
      <image id={`${id}-shinichi`} width="960" height="1440" href="/activity/explorer-2026/shinichi-night-v2.webp" />
      {tiles.map((tile, index) => <clipPath id={`${id}-tile-${index}`} key={index}><rect x={tile.x} y={tile.y} width="96.5" height="96.5" /></clipPath>)}
    </defs>
    <use href={`#${id}-conan`} className="explorer-wallpaper-still" />
    {(["conan", "shinichi"] as const).map((portrait) => <g className={`explorer-pixel-portrait is-${portrait}`} key={portrait}>
      {tiles.map((tile, index) => <g className="explorer-pixel-tile" key={index} style={{ "--burst-x": `${tile.dx}px`, "--burst-y": `${tile.dy}px`, "--burst-turn": `${tile.turn}deg`, "--burst-lag": `${tile.lag}s`, transformOrigin: `${tile.x + 48}px ${tile.y + 48}px` } as CSSProperties}>
        <use clipPath={`url(#${id}-tile-${index})`} href={`#${id}-${portrait}`} />
      </g>)}
    </g>)}
    <g className="explorer-pixel-sparks">{tiles.filter((_, index) => index % 5 === 0).map((tile, index) => <rect key={index} x={tile.x + 42} y={tile.y + 42} width={index % 2 ? 9 : 5} height={index % 2 ? 9 : 5} style={{ "--burst-x": `${tile.dx * 1.5}px`, "--burst-y": `${tile.dy * 1.5}px`, "--burst-lag": `${tile.lag}s` } as CSSProperties} />)}</g>
  </svg>;
}
