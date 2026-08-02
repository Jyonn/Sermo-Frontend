import { useState, type ReactNode } from "react";
import { Alignment, Fit, Layout, useRive } from "@rive-app/react-canvas";

const OFFICIAL_CHARACTER_RIVE_URL = `${import.meta.env.BASE_URL}rive/official-character.riv`;

interface OfficialSquareCharacterPrototypeProps {
  active?: boolean;
  fallback: ReactNode;
}

export default function OfficialSquareCharacterPrototype({ active = false, fallback }: OfficialSquareCharacterPrototypeProps) {
  const [failed, setFailed] = useState(false);
  const { RiveComponent } = useRive({
    src: OFFICIAL_CHARACTER_RIVE_URL,
    autoplay: true,
    layout: new Layout({ fit: Fit.Contain, alignment: Alignment.BottomCenter }),
    onLoadError: () => setFailed(true),
  });

  if (failed) return fallback;

  return (
    <span
      className={`square-character-figure square-official-rive-character${active ? " is-active" : ""}`}
      title="Sermo official account character prototype"
    >
      <RiveComponent aria-hidden="true" className="square-official-rive-canvas" />
      <i className="square-character-ground-shadow" />
    </span>
  );
}
