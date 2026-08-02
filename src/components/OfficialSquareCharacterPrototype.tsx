import { useEffect, useState, type ReactNode } from "react";
import { Alignment, Fit, Layout, useRive } from "@rive-app/react-canvas";

// CC BY: "Assistant Character" by HaiDo, Rive Marketplace asset 20733-39021.
const OFFICIAL_CHARACTER_RIVE_URL = "https://public.rive.app/community/runtime-files/21737171.riv";

interface OfficialSquareCharacterPrototypeProps {
  active?: boolean;
  fallback: ReactNode;
}

export default function OfficialSquareCharacterPrototype({ active = false, fallback }: OfficialSquareCharacterPrototypeProps) {
  const [failed, setFailed] = useState(false);
  const { rive, RiveComponent } = useRive({
    src: OFFICIAL_CHARACTER_RIVE_URL,
    stateMachines: "State Machine 1",
    autoplay: true,
    layout: new Layout({ fit: Fit.Contain, alignment: Alignment.BottomCenter }),
    onLoadError: () => setFailed(true),
  });

  useEffect(() => {
    if (!rive || !active) return;
    rive.play("State Machine 1");
  }, [active, rive]);

  if (failed) return fallback;

  return (
    <span
      className={`square-character-figure square-official-rive-character${active ? " is-active" : ""}`}
      title="Assistant Character by HaiDo, CC BY"
    >
      <RiveComponent aria-hidden="true" className="square-official-rive-canvas" />
      <i className="square-character-ground-shadow" />
    </span>
  );
}
