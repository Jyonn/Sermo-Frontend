import type { CSSProperties } from "react";
import type { AvatarFrameStyle, SquareLimbStyle, SquareMotionStyle, SquareOutfitStyle, SquarePropStyle } from "../types";
import { UserAvatar } from "./UserAvatar";

interface SquareCharacterFigureProps {
  avatarFrame?: AvatarFrameStyle;
  avatarUri?: string;
  direction?: -1 | 1;
  isOnline?: boolean;
  isVip?: boolean;
  limb: SquareLimbStyle;
  motion: SquareMotionStyle;
  name: string;
  outfit: SquareOutfitStyle;
  prop: SquarePropStyle;
}

function ArticulatedLimb({ kind, side }: { kind: "arm" | "leg"; side: "left" | "right" }) {
  return (
    <i className={`square-character-${kind} is-${side}`}>
      <span className="square-limb-segment is-upper" />
      <span className="square-limb-joint" />
      <span className="square-limb-segment is-lower" />
      <span className={`square-limb-end is-${kind === "arm" ? "hand" : "foot"}`} />
    </i>
  );
}

export function SquareCharacterFigure({
  avatarFrame,
  avatarUri,
  direction = 1,
  isOnline = false,
  isVip = false,
  limb,
  motion,
  name,
  outfit,
  prop,
}: SquareCharacterFigureProps) {
  return (
    <span
      className={`square-character-figure outfit-${outfit} prop-${prop} motion-${motion} limbs-${limb}`}
      style={{ "--walk-direction": direction } as CSSProperties}
    >
      <UserAvatar
        className={`square-character-head ${isOnline ? "status-online" : ""}`}
        frame={avatarFrame}
        name={name}
        uri={avatarUri}
        vip={isVip}
      />
      <span className="square-character-body">
        <ArticulatedLimb kind="arm" side="left" />
        <ArticulatedLimb kind="arm" side="right" />
        <i className="square-character-torso">
          <span className="square-outfit-collar" />
          <span className="square-outfit-detail" />
        </i>
        <ArticulatedLimb kind="leg" side="left" />
        <ArticulatedLimb kind="leg" side="right" />
        <i className="square-character-prop"><span /></i>
      </span>
      <i className="square-character-ground-shadow" />
    </span>
  );
}
