import { useEffect, useRef } from "react";
import { mountFriendenLivingWallpaper } from "../lib/friendenLivingWallpaper";
import type { ChatBackgroundTheme } from "../types";

export function FriendenLivingWallpaper({ theme }: { theme?: ChatBackgroundTheme }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (!canvasRef.current || (theme !== "frienden-night" && theme !== "frienden-garden")) return undefined;
    return mountFriendenLivingWallpaper(canvasRef.current, theme);
  }, [theme]);

  if (theme !== "frienden-night" && theme !== "frienden-garden") return null;
  return <canvas aria-hidden="true" className="frienden-living-wallpaper" ref={canvasRef} />;
}
