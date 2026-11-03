import { useEffect, useMemo, useRef, useState, useSyncExternalStore, type CSSProperties } from "react";
import { cachedAvatarFrame, subscribeAvatarFrames } from "../lib/avatarFrameCache";
const spiderFrame = "https://api.sermo.jyonn.space/resources/assets/86/display/83de29044d1c4221b1a112452e9b61692a6e74fbc23fbe334ce736be7aaf9c3c";
import { avatarResourceKey, loadAvatarSource, peekAvatarSource, preloadAvatar } from "../lib/avatarCache";
import { forgetStableResourceUri, resolveStableResourceUri } from "../lib/stableResource";
import type { AvatarFrameStyle } from "../types";
import "./ExplorerPersonalization.css";

interface GroupAvatarMember {
  name: string;
  uri?: string | null;
  cacheKey?: string | null;
}

interface UserAvatarProps {
  userId?: number;
  name: string;
  uri?: string | null;
  cacheKey?: string | null;
  className: string;
  groupMembers?: GroupAvatarMember[] | null;
  frame?: AvatarFrameStyle;
  surface?: "person" | "space";
}

const supportedAvatarFrames = new Set<AvatarFrameStyle>([
  "orbit", "aurora", "polaroid", "papercut", "mechanical", "niko-run", "fufu-wave", "spider-web", "explorer-conan",
]);
const avatarFrameArt: Partial<Record<AvatarFrameStyle, string>> = {
  'spider-web': spiderFrame,
  'explorer-conan': 'https://api.sermo.jyonn.space/resources/assets/66/display/95f72390ed58b1edbf8d7278d4ea0b5c2bd644856d3ada4959a3616b0358005a',
};
// Warm the two bitmap ornaments once, using the same persistent cache as portraits.
if (typeof window !== 'undefined') Object.values(avatarFrameArt).forEach(uri => preloadAvatar(uri));

function avatarLabel(name: string) {
  return (name?.trim() || "FRIENDEN").slice(0, 2).toUpperCase();
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

function useFrameArt(frame: AvatarFrameStyle) {
  const uri = avatarFrameArt[frame];
  const [loaded, setLoaded] = useState<{ uri: string; source: string }>();
  useEffect(() => {
    if (!uri) return;
    let active = true;
    void loadAvatarSource(uri).then(source => {
      if (active && source) setLoaded({ uri, source });
    }).catch(() => undefined);
    return () => { active = false; };
  }, [uri]);
  return uri ? peekAvatarSource(uri) ?? (loaded?.uri === uri ? loaded.source : undefined) : undefined;
}

function groupLayoutClass(count: number) {
  if (count >= 4) return "avatar-group-stack-four";
  if (count === 3) return "avatar-group-stack-three";
  return "avatar-group-stack-two";
}

export function UserAvatar({ userId, name, uri, cacheKey, className, groupMembers, frame, surface = "person" }: UserAvatarProps) {
  const cachedFrame = useSyncExternalStore(subscribeAvatarFrames, () => cachedAvatarFrame(userId), () => undefined);
  const normalizedGroupMembers = useMemo(() => normalizeGroupMembers(groupMembers), [groupMembers]);
  const canShowGroup = normalizedGroupMembers.length >= 2;
  const singleSource = normalizedGroupMembers.length === 1 ? normalizedGroupMembers[0] : null;
  const resolvedName = singleSource?.name?.trim() || name?.trim() || "FRIENDEN";
  const sourceUri = singleSource?.uri ?? uri;
  const sourceCacheKey = singleSource?.cacheKey ?? cacheKey;
  const { source, failed, setFailed } = useCachedAvatar(sourceUri, sourceCacheKey);
  const canShowImage = Boolean(source) && !failed;
  const resolvedFrame = frame ?? cachedFrame ?? "none";
  const normalizedFrame = supportedAvatarFrames.has(resolvedFrame) ? resolvedFrame : "none";
  const hasFrame = normalizedFrame !== "none";
  const frameArt = useFrameArt(normalizedFrame);

  return (
    <div className={`${className} user-avatar avatar-surface-${surface}${canShowImage ? " avatar-has-image" : ""}${hasFrame ? " has-avatar-frame" : ""}`}>
      <span className={`avatar-frame-clip${hasFrame ? ` avatar-frame-${normalizedFrame}` : ""}`} style={avatarFrameArt[normalizedFrame] ? { '--avatar-frame-art': frameArt ? `url("${frameArt}")` : 'none' } as CSSProperties : undefined}>
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
        {normalizedFrame === 'explorer-conan' && frameArt ? <svg aria-hidden="true" className="avatar-frame-conan-art" viewBox="17 23 607 577" preserveAspectRatio="none" focusable="false"><image href={frameArt} width="640" height="640" /></svg> : null}
        {hasFrame ? <span aria-hidden="true" className="avatar-frame-ornament"><i /><i /><i /><i /></span> : null}
      </span>
    </div>
  );
}

export function PlainAvatar(props: Omit<UserAvatarProps, "frame" | "surface">) {
  return <UserAvatar {...props} frame="none" />;
}

export function GroupAvatar(props: Omit<UserAvatarProps, "frame" | "surface" | "groupMembers"> & { groupMembers: GroupAvatarMember[] }) {
  return <UserAvatar {...props} frame="none" />;
}

export function SpaceAvatar(props: Omit<UserAvatarProps, "surface">) {
  return <UserAvatar {...props} surface="space" />;
}
