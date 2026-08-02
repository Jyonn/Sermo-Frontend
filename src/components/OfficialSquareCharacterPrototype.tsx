import type { CSSProperties } from "react";

interface OfficialSquareCharacterPrototypeProps {
  active?: boolean;
  direction?: -1 | 1;
}

function PuppetLimb({ kind, side }: { kind: "arm" | "leg"; side: "left" | "right" }) {
  return (
    <i className={`official-puppet-${kind} is-${side}`} aria-hidden="true">
      <span className="official-puppet-limb is-upper" />
      <span className="official-puppet-joint" />
      <span className="official-puppet-limb is-lower" />
      <span className={`official-puppet-end is-${kind === "arm" ? "hand" : "foot"}`} />
    </i>
  );
}

export default function OfficialSquareCharacterPrototype({
  active = false,
  direction = 1,
}: OfficialSquareCharacterPrototypeProps) {
  return (
    <span
      className={`square-character-figure square-official-puppet${active ? " is-active" : ""}`}
      style={{ "--walk-direction": direction } as CSSProperties}
      aria-hidden="true"
    >
      <span className="official-puppet-rig">
        <i className="official-puppet-cape" />
        <PuppetLimb kind="leg" side="left" />
        <PuppetLimb kind="leg" side="right" />
        <i className="official-puppet-torso">
          <span className="official-puppet-sash" />
          <span className="official-puppet-mark">S</span>
        </i>
        <PuppetLimb kind="arm" side="left" />
        <PuppetLimb kind="arm" side="right" />
        <i className="official-puppet-head" />
      </span>
      <i className="square-character-ground-shadow" />
    </span>
  );
}
