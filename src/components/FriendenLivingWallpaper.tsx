import type { CSSProperties } from "react";
import type { ChatBackgroundTheme } from "../types";

type LivingTheme = Extract<ChatBackgroundTheme, "frienden-night" | "frienden-garden">;
type Motion = "breathe" | "peek" | "hop" | "sway" | "wag" | "water";

interface LivingPatch {
  clip: string;
  delay: number;
  motion: Motion;
  origin: string;
}

const NIGHT_PATCHES: LivingPatch[] = [
  { clip: "polygon(64% 11%, 79% 11%, 79% 20%, 64% 20%)", delay: -1.4, motion: "peek", origin: "71% 19%" },
  { clip: "polygon(84% 8%, 96% 8%, 96% 15%, 84% 15%)", delay: -3.7, motion: "peek", origin: "89% 14%" },
  { clip: "polygon(55% 26%, 74% 26%, 74% 34%, 55% 34%)", delay: -2.2, motion: "wag", origin: "63% 32%" },
  { clip: "polygon(7% 40%, 24% 40%, 24% 50%, 7% 50%)", delay: -4.8, motion: "breathe", origin: "15% 49%" },
  { clip: "polygon(72% 50%, 91% 50%, 91% 60%, 72% 60%)", delay: -1.9, motion: "breathe", origin: "81% 59%" },
  { clip: "polygon(15% 69%, 31% 69%, 31% 81%, 15% 81%)", delay: -5.1, motion: "hop", origin: "22% 80%" },
  { clip: "polygon(79% 72%, 94% 72%, 94% 83%, 79% 83%)", delay: -3.1, motion: "breathe", origin: "86% 82%" },
  { clip: "polygon(59% 89%, 76% 89%, 76% 97%, 59% 97%)", delay: -.8, motion: "hop", origin: "67% 96%" },
  { clip: "polygon(4% 94%, 27% 94%, 27% 100%, 4% 100%)", delay: -2.8, motion: "breathe", origin: "15% 100%" },
  { clip: "polygon(54% 0%, 77% 0%, 77% 18%, 54% 18%)", delay: -4.2, motion: "sway", origin: "66% 18%" },
  { clip: "polygon(30% 15%, 53% 15%, 53% 37%, 30% 37%)", delay: -1.1, motion: "sway", origin: "40% 36%" },
  { clip: "polygon(68% 34%, 100% 34%, 100% 53%, 68% 53%)", delay: -5.6, motion: "sway", origin: "84% 52%" },
  { clip: "polygon(27% 76%, 51% 76%, 51% 96%, 27% 96%)", delay: -2.5, motion: "sway", origin: "39% 95%" },
];

const GARDEN_PATCHES: LivingPatch[] = [
  { clip: "polygon(15% 11%, 32% 11%, 32% 22%, 15% 22%)", delay: -2.1, motion: "peek", origin: "23% 21%" },
  { clip: "polygon(74% 6%, 91% 6%, 91% 16%, 74% 16%)", delay: -4.5, motion: "peek", origin: "82% 15%" },
  { clip: "polygon(43% 24%, 64% 24%, 64% 36%, 43% 36%)", delay: -.9, motion: "water", origin: "52% 35%" },
  { clip: "polygon(72% 27%, 94% 27%, 94% 42%, 72% 42%)", delay: -3.3, motion: "breathe", origin: "83% 41%" },
  { clip: "polygon(1% 51%, 22% 51%, 22% 62%, 1% 62%)", delay: -1.7, motion: "breathe", origin: "11% 61%" },
  { clip: "polygon(44% 48%, 66% 48%, 66% 61%, 44% 61%)", delay: -5.2, motion: "sway", origin: "55% 60%" },
  { clip: "polygon(72% 51%, 91% 51%, 91% 64%, 72% 64%)", delay: -2.8, motion: "peek", origin: "81% 63%" },
  { clip: "polygon(6% 72%, 30% 72%, 30% 86%, 6% 86%)", delay: -4.1, motion: "hop", origin: "18% 85%" },
  { clip: "polygon(27% 76%, 49% 76%, 49% 88%, 27% 88%)", delay: -1.3, motion: "wag", origin: "38% 87%" },
  { clip: "polygon(42% 88%, 66% 88%, 66% 100%, 42% 100%)", delay: -3.9, motion: "hop", origin: "54% 99%" },
  { clip: "polygon(0% 0%, 47% 0%, 47% 36%, 0% 36%)", delay: -2.6, motion: "sway", origin: "23% 35%" },
  { clip: "polygon(58% 0%, 100% 0%, 100% 30%, 58% 30%)", delay: -5.4, motion: "sway", origin: "80% 29%" },
  { clip: "polygon(0% 57%, 45% 57%, 45% 86%, 0% 86%)", delay: -1.8, motion: "sway", origin: "22% 85%" },
  { clip: "polygon(64% 60%, 100% 60%, 100% 100%, 64% 100%)", delay: -4.7, motion: "sway", origin: "82% 99%" },
];

export function FriendenLivingWallpaper({ theme }: { theme?: ChatBackgroundTheme }) {
  if (theme !== "frienden-night" && theme !== "frienden-garden") return null;
  const patches = theme === "frienden-night" ? NIGHT_PATCHES : GARDEN_PATCHES;
  return <div aria-hidden="true" className={`frienden-living-wallpaper is-${theme}`}>
    {patches.map((patch, index) => <i
      className={`is-${patch.motion}`}
      key={`${patch.motion}-${index}`}
      style={{
        "--frienden-clip": patch.clip,
        "--frienden-delay": `${patch.delay}s`,
        "--frienden-origin": patch.origin,
      } as CSSProperties}
    />)}
    {theme === "frienden-garden" ? <span className="frienden-watering-drops"><b /><b /><b /><b /></span> : null}
  </div>;
}

