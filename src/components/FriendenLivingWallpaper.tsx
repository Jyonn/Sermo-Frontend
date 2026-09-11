import { useEffect, useRef } from "react";
import type { CSSProperties } from "react";
import type { ChatBackgroundTheme } from "../types";

type LivingTheme = Extract<ChatBackgroundTheme, "frienden-night" | "frienden-garden">;
type LayerKind = "back" | "actor" | "front";

interface SceneItem {
  delay: number;
  effect?: "sleep" | "water";
  h: number;
  href: string;
  layer: LayerKind;
  motion: string;
  w: number;
  x: number;
  y: number;
}

interface LivingScene {
  environment: string;
  items: SceneItem[];
}

const asset = (theme: "night" | "garden", group: "actors" | "plants", name: string) =>
  `/assets/frienden-wallpapers/layers/${theme}/${group}/${name}.png`;
const item = (href: string, x: number, y: number, w: number, h: number, motion: string, delay: number, layer: LayerKind = "actor", effect?: SceneItem["effect"]): SceneItem =>
  ({ delay, effect, h, href, layer, motion, w, x, y });

const SCENES: Record<LivingTheme, LivingScene> = {
  "frienden-night": {
    environment: "/assets/frienden-wallpapers/layers/night-environment.webp",
    items: [
      item(asset("night", "plants", "ivy-strand"), 565, -16, 160, 300, "vine-breathe", -2.1, "back"),
      item(asset("night", "plants", "white-flower-vine"), 730, 145, 145, 260, "vine-breathe", -5.4, "back"),
      item(asset("night", "plants", "tall-pot"), 555, 210, 78, 126, "leaf-fan", -1.2, "back"),
      item(asset("night", "plants", "cactus-pot"), 684, 320, 76, 116, "cactus-listen", -3.6, "back"),
      item(asset("night", "plants", "mixed-flower-pot"), 396, 430, 70, 104, "flower-nod", -4.4, "front"),
      item(asset("night", "plants", "white-flower-pot"), 252, 718, 72, 102, "flower-nod", -1.8, "front"),
      item(asset("night", "plants", "broad-leaves"), 438, 885, 92, 136, "leaf-fan", -5.9, "front"),
      item(asset("night", "plants", "star-shrub"), 278, 1440, 132, 105, "shrub-rustle", -2.7, "front"),
      item(asset("night", "actors", "door-rabbit"), 620, 215, 132, 116, "rabbit-peek", -.8),
      item(asset("night", "actors", "window-black-cat"), 837, 173, 78, 68, "cat-watch", -3.2),
      item(asset("night", "actors", "sleeping-dog"), 530, 466, 150, 88, "sleep-breathe", -1.4, "actor", "sleep"),
      item(asset("night", "actors", "mug-bear"), 87, 720, 138, 112, "bear-sip", -4.7),
      item(asset("night", "actors", "mug-window-cat"), 713, 868, 150, 105, "cat-sip", -2.2),
      item(asset("night", "actors", "door-penguin"), 170, 1192, 115, 150, "penguin-doze", -5.3, "actor", "sleep"),
      item(asset("night", "actors", "window-sheep"), 796, 1278, 120, 100, "sleep-breathe", -3.8, "actor", "sleep"),
      item(asset("night", "actors", "path-bird"), 600, 1520, 102, 72, "bird-peck", -1.1),
      item(asset("night", "actors", "bottom-cat"), 58, 1605, 156, 108, "cat-stretch", -4.1),
    ],
  },
  "frienden-garden": {
    environment: "/assets/frienden-wallpapers/layers/garden-environment.webp",
    items: [
      item(asset("garden", "plants", "flowering-ivy"), 18, 92, 150, 430, "vine-breathe", -2.2, "back"),
      item(asset("garden", "plants", "flower-arch"), 286, 125, 390, 255, "arch-breathe", -5.1, "back"),
      item(asset("garden", "plants", "purple-vine"), 240, 468, 175, 390, "vine-breathe", -1.4, "front"),
      item(asset("garden", "plants", "hanging-plant"), 690, 1040, 132, 190, "hanging-sway", -3.9, "front"),
      item(asset("garden", "plants", "tropical-pot"), 112, 1110, 112, 170, "leaf-fan", -5.8, "back"),
      item(asset("garden", "plants", "daisy-pot"), 622, 1230, 92, 120, "flower-nod", -2.8, "front"),
      item(asset("garden", "plants", "yellow-flowers"), 144, 1435, 135, 175, "flower-nod", -4.5, "front"),
      item(asset("garden", "plants", "sunflower"), 753, 1390, 178, 276, "sun-track", -1.7, "front"),
      item(asset("garden", "plants", "yellow-butterfly"), 360, 405, 38, 32, "butterfly-roam", -3.3, "front"),
      item(asset("garden", "plants", "orange-butterfly"), 533, 1190, 36, 30, "butterfly-roam-alt", -6.1, "front"),
      item(asset("garden", "actors", "letter-rabbit"), 170, 225, 134, 105, "letter-wave", -1.1),
      item(asset("garden", "actors", "flower-window-rabbit"), 746, 128, 124, 104, "rabbit-peek", -4.6),
      item(asset("garden", "actors", "watering-dog"), 454, 445, 145, 136, "watering-cycle", -2.4, "actor", "water"),
      item(asset("garden", "actors", "sunhat-rabbit"), 735, 530, 156, 166, "fruit-nibble", -5.7),
      item(asset("garden", "actors", "sleeping-spotted-dog"), 42, 895, 145, 100, "sleep-breathe", -3.1, "actor", "sleep"),
      item(asset("garden", "actors", "sunflower-friend"), 470, 824, 136, 154, "bouquet-sway", -.7),
      item(asset("garden", "actors", "letter-dog"), 720, 927, 128, 122, "letter-wave", -4.2),
      item(asset("garden", "actors", "tea-rabbit"), 85, 1245, 152, 155, "tea-pour", -2.9),
      item(asset("garden", "actors", "tea-companion"), 284, 1300, 128, 132, "tea-watch", -5.4),
      item(asset("garden", "actors", "basket-friend"), 475, 1502, 146, 154, "basket-step", -1.8),
    ],
  },
};

function SceneEffect({ item }: { item: SceneItem }) {
  if (item.effect === "sleep") return <g className="frienden-sleep-puffs" transform={`translate(${item.x + item.w * .68} ${item.y - 4})`}>
    <circle cx="0" cy="0" r="5" /><circle cx="13" cy="-13" r="3.5" /><circle cx="22" cy="-23" r="2.4" />
  </g>;
  if (item.effect === "water") return <g className="frienden-water-drops">
    <circle cx="602" cy="514" r="3.5" /><circle cx="614" cy="523" r="3" /><circle cx="625" cy="535" r="2.6" />
  </g>;
  return null;
}

export function FriendenLivingWallpaper({ compact = false, theme }: { compact?: boolean; theme?: ChatBackgroundTheme }) {
  const sceneRef = useRef<SVGSVGElement>(null);

  useEffect(() => {
    const scene = sceneRef.current;
    if (!scene) return undefined;
    const setActive = () => scene.classList.toggle("is-active", document.visibilityState === "visible");
    const observer = new IntersectionObserver(([entry]) => {
      scene.classList.toggle("is-visible", entry.isIntersecting);
    });
    observer.observe(scene);
    document.addEventListener("visibilitychange", setActive);
    setActive();
    return () => {
      observer.disconnect();
      document.removeEventListener("visibilitychange", setActive);
    };
  }, [theme]);

  if (theme === "starry-night") return <svg aria-hidden="true" className={`frienden-starry-wallpaper is-active is-visible${compact ? " is-compact" : ""}`} preserveAspectRatio="xMidYMid slice" viewBox="0 0 941 1672">
    <defs><clipPath id="starry-sky-boundary"><rect height="820" width="941" x="0" y="0" /></clipPath></defs>
    <image height="1672" href="/assets/frienden-wallpapers/layers/starry-night/environment.webp" width="941" />
    <g className="starry-sky-clip" clipPath="url(#starry-sky-boundary)">
      <image className="starry-cloud-current" height="430" href="/assets/frienden-wallpapers/layers/starry-night/cloud-current.webp" width="1450" x="-260" y="120" />
      <image className="starry-vortex is-main" height={compact ? 480 : 720} href="/assets/frienden-wallpapers/layers/starry-night/vortex-main.webp" width={compact ? 480 : 720} x={compact ? -80 : -220} y={compact ? 190 : 250} />
      <image className="starry-vortex is-moon" height={compact ? 340 : 540} href="/assets/frienden-wallpapers/layers/starry-night/vortex-moon.webp" width={compact ? 340 : 540} x={compact ? 630 : 560} y={compact ? 20 : -70} />
      <image className="starry-vortex is-star" height={compact ? 170 : 285} href="/assets/frienden-wallpapers/layers/starry-night/vortex-star.webp" width={compact ? 170 : 285} x={compact ? 560 : 500} y={compact ? 390 : 490} />
      <image className="starry-vortex is-small" height={compact ? 90 : 170} href="/assets/frienden-wallpapers/layers/starry-night/vortex-star.webp" width={compact ? 90 : 170} x={compact ? 825 : 820} y={compact ? 560 : 650} />
    </g>
  </svg>;
  if (theme !== "frienden-night" && theme !== "frienden-garden") return null;
  const scene = SCENES[theme];
  return <svg
    aria-hidden="true"
    className={`frienden-living-wallpaper is-${theme}`}
    preserveAspectRatio="xMidYMid slice"
    ref={sceneRef}
    viewBox="0 0 941 1672"
  >
    <image height="1672" href={scene.environment} width="941" x="0" y="0" />
    {(["back", "actor", "front"] as LayerKind[]).map((layer) => <g className={`frienden-scene-layer is-${layer}`} key={layer}>
      {scene.items.filter((entry) => entry.layer === layer).map((entry) => <g key={entry.href}>
        <image
          className={`frienden-living-item motion-${entry.motion}`}
          height={entry.h}
          href={entry.href}
          style={{ "--frienden-delay": `${entry.delay}s` } as CSSProperties}
          width={entry.w}
          x={entry.x}
          y={entry.y}
        />
        <SceneEffect item={entry} />
      </g>)}
    </g>)}
  </svg>;
}
