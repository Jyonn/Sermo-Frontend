import { useEffect, useMemo, useState } from "react";
import { forgetStableResourceUri, resolveStableResourceUri } from "../lib/stableResource";
import type { AvatarFrameStyle } from "../types";

interface GroupAvatarMember {
  name: string;
  uri?: string | null;
}

interface UserAvatarProps {
  name: string;
  uri?: string | null;
  className: string;
  groupMembers?: GroupAvatarMember[] | null;
  vip?: boolean;
  frame?: AvatarFrameStyle;
}

function avatarLabel(name: string) {
  return name.slice(0, 2).toUpperCase();
}

function normalizeGroupMembers(groupMembers?: GroupAvatarMember[] | null) {
  if (!groupMembers?.length) return [];
  return groupMembers
    .filter((member) => member.name.trim().length > 0)
    .slice(0, 4);
}

function AvatarTile({ name, uri }: GroupAvatarMember) {
  const [failed, setFailed] = useState(false);
  const [retryWithFreshUri, setRetryWithFreshUri] = useState(false);
  const resolvedUri = retryWithFreshUri ? uri ?? undefined : resolveStableResourceUri(uri);

  useEffect(() => {
    setFailed(false);
    setRetryWithFreshUri(false);
  }, [uri]);

  const canShowImage = Boolean(resolvedUri) && !failed;

  if (canShowImage) {
    return (
      <img
        alt=""
        className="avatar-group-image"
        loading="lazy"
        src={resolvedUri ?? ""}
        onError={() => {
          if (!retryWithFreshUri && uri) {
            forgetStableResourceUri(uri);
            setRetryWithFreshUri(true);
            return;
          }
          setFailed(true);
        }}
      />
    );
  }

  return <span className="avatar-group-label">{avatarLabel(name)}</span>;
}

function groupLayoutClass(count: number) {
  if (count >= 4) return "avatar-group-stack-four";
  if (count === 3) return "avatar-group-stack-three";
  return "avatar-group-stack-two";
}

export function UserAvatar({ name, uri, className, groupMembers, vip = false, frame = "none" }: UserAvatarProps) {
  const [failed, setFailed] = useState(false);
  const [retryWithFreshUri, setRetryWithFreshUri] = useState(false);
  const normalizedGroupMembers = useMemo(() => normalizeGroupMembers(groupMembers), [groupMembers]);
  const canShowGroup = normalizedGroupMembers.length >= 2;
  const singleSource = normalizedGroupMembers.length === 1 ? normalizedGroupMembers[0] : null;
  const resolvedName = singleSource?.name ?? name;
  const sourceUri = singleSource?.uri ?? uri;
  const resolvedUri = retryWithFreshUri ? sourceUri ?? undefined : resolveStableResourceUri(sourceUri);

  useEffect(() => {
    setFailed(false);
    setRetryWithFreshUri(false);
  }, [sourceUri]);

  const canShowImage = Boolean(resolvedUri) && !failed;

  return (
    <div className={`${className} ${canShowImage ? "avatar-has-image" : ""}${vip ? " is-permanent-vip" : ""}${frame !== "none" ? ` avatar-frame-${frame}` : ""}`}>
      {canShowGroup ? (
        <div aria-hidden="true" className={`avatar-group-stack ${groupLayoutClass(normalizedGroupMembers.length)}`}>
          {normalizedGroupMembers.map((member, index) => (
            <div key={`${member.name}:${member.uri ?? "fallback"}:${index}`} className={`avatar-group-tile avatar-group-tile-${index + 1}`}>
              <AvatarTile name={member.name} uri={member.uri} />
            </div>
          ))}
        </div>
      ) : canShowImage ? (
        <img
          alt={`${resolvedName} avatar`}
          className="avatar-image"
          loading="lazy"
          src={resolvedUri ?? ""}
          onError={() => {
            if (!retryWithFreshUri && sourceUri) {
              forgetStableResourceUri(sourceUri);
              setRetryWithFreshUri(true);
              return;
            }
            setFailed(true);
          }}
        />
      ) : (
        <span className="avatar-label">{avatarLabel(resolvedName)}</span>
      )}
      {frame !== "none" ? (
        <span aria-hidden="true" className="avatar-frame-ornament">
          <i /><i /><i /><i />
        </span>
      ) : null}
    </div>
  );
}
