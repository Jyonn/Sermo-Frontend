import { useEffect, useMemo, useRef, useState } from "react";
import { avatarResourceKey, loadAvatarSource, peekAvatarSource } from "../lib/avatarCache";
import { forgetStableResourceUri, resolveStableResourceUri } from "../lib/stableResource";
import type { AvatarFrameStyle } from "../types";

interface GroupAvatarMember {
  name: string;
  uri?: string | null;
  cacheKey?: string | null;
}

interface UserAvatarProps {
  name: string;
  uri?: string | null;
  cacheKey?: string | null;
  className: string;
  groupMembers?: GroupAvatarMember[] | null;
  vip?: boolean;
  frame?: AvatarFrameStyle;
}

function avatarLabel(name: string) {
  return (name?.trim() || "Sermo").slice(0, 2).toUpperCase();
}

function normalizeGroupMembers(groupMembers?: GroupAvatarMember[] | null) {
  if (!groupMembers?.length) return [];
  return groupMembers.filter((member) => member?.name?.trim().length > 0).slice(0, 4);
}

function useCachedAvatar(uri?: string | null, cacheKey?: string | null) {
  const identity = avatarResourceKey(uri, cacheKey);
  const [source, setSource] = useState(() => peekAvatarSource(uri, cacheKey) ?? resolveStableResourceUri(uri));
  const [failed, setFailed] = useState(false);
  const sourceIdentityRef = useRef(identity);

  useEffect(() => {
    let active = true;
    setFailed(false);
    const immediate = peekAvatarSource(uri, cacheKey);
    if (sourceIdentityRef.current !== identity) {
      sourceIdentityRef.current = identity;
      setSource(immediate ?? resolveStableResourceUri(uri));
    } else if (immediate) {
      setSource(immediate);
    } else if (!source) {
      setSource(resolveStableResourceUri(uri));
    }

    void loadAvatarSource(uri, cacheKey)
      .then((nextSource) => {
        if (active && nextSource) {
          setFailed(false);
          setSource(nextSource);
        }
      })
      .catch(() => {
        if (active && !source) setFailed(true);
      });
    return () => { active = false; };
    // Keep the previous decoded frame visible until the replacement is ready.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [identity]);

  return { source, failed, setFailed };
}

function AvatarTile({ name, uri, cacheKey }: GroupAvatarMember) {
  const { source, failed, setFailed } = useCachedAvatar(uri, cacheKey);
  if (source && !failed) {
    return <img alt="" className="avatar-group-image" decoding="async" loading="eager" src={source} onError={() => setFailed(true)} />;
  }
  return <span className="avatar-group-label">{avatarLabel(name)}</span>;
}

function groupLayoutClass(count: number) {
  if (count >= 4) return "avatar-group-stack-four";
  if (count === 3) return "avatar-group-stack-three";
  return "avatar-group-stack-two";
}

export function UserAvatar({ name, uri, cacheKey, className, groupMembers, vip = false, frame = "none" }: UserAvatarProps) {
  const normalizedGroupMembers = useMemo(() => normalizeGroupMembers(groupMembers), [groupMembers]);
  const canShowGroup = normalizedGroupMembers.length >= 2;
  const singleSource = normalizedGroupMembers.length === 1 ? normalizedGroupMembers[0] : null;
  const resolvedName = singleSource?.name?.trim() || name?.trim() || "Sermo";
  const sourceUri = singleSource?.uri ?? uri;
  const sourceCacheKey = singleSource?.cacheKey ?? cacheKey;
  const { source, failed, setFailed } = useCachedAvatar(sourceUri, sourceCacheKey);
  const canShowImage = Boolean(source) && !failed;
  // The retired VIP frame may still arrive from older profiles; render it as no frame.
  const hasFrame = frame !== "none" && frame !== "vip";

  return (
    <div className={`${className} user-avatar ${canShowImage ? "avatar-has-image" : ""}${vip ? " is-permanent-vip" : ""}${hasFrame ? " has-avatar-frame" : ""}`}>
      <span className={`avatar-frame-clip${hasFrame ? ` avatar-frame-${frame}` : ""}`}>
        {canShowGroup ? (
          <span aria-hidden="true" className={`avatar-group-stack ${groupLayoutClass(normalizedGroupMembers.length)}`}>
            {normalizedGroupMembers.map((member, index) => (
              <span key={`${avatarResourceKey(member.uri, member.cacheKey) || member.name}:${index}`} className={`avatar-group-tile avatar-group-tile-${index + 1}`}>
                <AvatarTile {...member} />
              </span>
            ))}
          </span>
        ) : canShowImage ? (
          <img
            alt={`${resolvedName} avatar`}
            className="avatar-image"
            decoding="async"
            loading="eager"
            src={source ?? ""}
            onError={() => {
              forgetStableResourceUri(sourceUri);
              setFailed(true);
            }}
          />
        ) : (
          <span className="avatar-label">{avatarLabel(resolvedName)}</span>
        )}
        {hasFrame ? <span aria-hidden="true" className="avatar-frame-ornament"><i /><i /><i /><i /></span> : null}
      </span>
    </div>
  );
}
