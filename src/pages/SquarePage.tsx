import type { CSSProperties } from "react";
import { lazy, Suspense, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { AppChrome } from "../components/AppChrome";
import { UserAvatar } from "../components/UserAvatar";
import { AsyncErrorDialog } from "../components/AsyncErrorDialog";
import { FeedbackState } from "../components/FeedbackState";
import { SideDrawer } from "../components/SideDrawer";
import { UserProfilePanel } from "../components/UserProfilePanel";
import { ApiError, api } from "../lib/api";
import { useAuth } from "../lib/auth";
import { useGroupSquareEnabled } from "../lib/spaceFeatures";
import { showToast } from "../lib/toast";
import { VerificationBanner } from "../components/VerificationBanner";
import { HeaderSyncIndicator } from "../components/HeaderSyncIndicator";
import { buildTabCacheScope, readTabCache, writeTabCache } from "../lib/tabCache";
import type { AppViewState, UserDTO } from "../types";
import { useI18n } from "../lib/language";
import { SquareCharacterFigure } from "../components/SquareCharacterFigure";
import plazaBackground from "../assets/square/plaza-waterfront.jpg";

const MAX_ORBS = 20;
const OfficialAccountSquarePage = lazy(() => import("./OfficialAccountSquarePage"));
const CHARACTER_AREA_RATIO = 0.2;
const CHARACTER_MIN_HEAD_SIZE = 38;
const CHARACTER_MAX_HEAD_SIZE = 64;
const CHARACTER_WIDTH_RATIO = 1.52;
const CHARACTER_HEIGHT_RATIO = 2.52;
const CHARACTER_PADDING = 18;
const CHARACTER_GAP = 10;
const MAX_FRAME_DELTA = 0.028;
const ORB_ENTER_DURATION_MS = 320;
const ORB_EXIT_DURATION_MS = 260;

type OrbState = {
  user: UserDTO;
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
};

function clamp(min: number, value: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function calculateOrbSize(count: number, width: number, height: number) {
  if (!count || !width || !height) return CHARACTER_MIN_HEAD_SIZE;
  const sizingCount = Math.max(5, count);
  const estimated = Math.sqrt(
    (CHARACTER_AREA_RATIO * width * height)
    / (sizingCount * CHARACTER_WIDTH_RATIO * CHARACTER_HEIGHT_RATIO)
  );
  return clamp(CHARACTER_MIN_HEAD_SIZE, estimated, CHARACTER_MAX_HEAD_SIZE);
}

function characterDimensions(size: number) {
  return {
    width: size * CHARACTER_WIDTH_RATIO,
    height: size * CHARACTER_HEIGHT_RATIO,
  };
}

function charactersOverlap(first: Pick<OrbState, "x" | "y" | "size">, second: Pick<OrbState, "x" | "y" | "size">, gap = CHARACTER_GAP) {
  const firstBox = characterDimensions(first.size);
  const secondBox = characterDimensions(second.size);
  return (
    Math.abs(first.x - second.x) < (firstBox.width + secondBox.width) / 2 + gap
    && Math.abs(first.y - second.y) < (firstBox.height + secondBox.height) / 2 + gap
  );
}

function randomBetween(min: number, max: number) {
  return min + Math.random() * (max - min);
}

function createInitialOrbs(users: UserDTO[], width: number, height: number) {
  const size = calculateOrbSize(users.length, width, height);
  return createOrbsWithSize(users, width, height, size);
}

function createOrbsWithSize(users: UserDTO[], width: number, height: number, size: number) {
  const character = characterDimensions(size);
  const minX = CHARACTER_PADDING + character.width / 2;
  const maxX = width - CHARACTER_PADDING - character.width / 2;
  const minY = CHARACTER_PADDING + character.height / 2;
  const maxY = height - CHARACTER_PADDING - character.height / 2;
  const next: OrbState[] = [];

  users.forEach((user, index) => {
    let x = minX;
    let y = minY;

    for (let attempt = 0; attempt < 2000; attempt += 1) {
      x = randomBetween(minX, maxX);
      y = randomBetween(minY, maxY);
      const overlaps = next.some((orb) => charactersOverlap(orb, { x, y, size }));
      if (!overlaps) break;
    }

    const angle = Math.random() * Math.PI * 2;
    const speed = 10 + ((user.user_id + index) % 4) * 2;

    next.push({
      user,
      x,
      y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      size,
    });
  });

  return next;
}

function syncOrbsWithUsers(previous: OrbState[], users: UserDTO[], width: number, height: number) {
  if (!previous.length) return createInitialOrbs(users, width, height);

  const nextSize = calculateOrbSize(users.length, width, height);
  const character = characterDimensions(nextSize);
  const minX = CHARACTER_PADDING + character.width / 2;
  const maxX = width - CHARACTER_PADDING - character.width / 2;
  const minY = CHARACTER_PADDING + character.height / 2;
  const maxY = height - CHARACTER_PADDING - character.height / 2;
  const nextById = new Map(previous.map((orb) => [orb.user.user_id, orb]));
  const next: OrbState[] = [];

  users.forEach((user) => {
    const existing = nextById.get(user.user_id);
    if (!existing) return;
    next.push({
      ...existing,
      user,
      size: nextSize,
      x: clamp(minX, existing.x, maxX),
      y: clamp(minY, existing.y, maxY),
    });
  });

  const existingIds = new Set(next.map((orb) => orb.user.user_id));
  const newcomers = users.filter((user) => !existingIds.has(user.user_id));
  if (!newcomers.length) return next;

  const additions = createOrbsWithSize(newcomers, width, height, nextSize);
  additions.forEach((addition) => {
    for (let attempt = 0; attempt < 1200; attempt += 1) {
      const overlaps = next.some((orb) => charactersOverlap(orb, addition));
      if (!overlaps) break;
      addition.x = randomBetween(minX, maxX);
      addition.y = randomBetween(minY, maxY);
    }
    next.push(addition);
  });

  return next;
}

function buildOrbSyncSignature(users: UserDTO[]) {
  return users
    .map((user) => `${user.user_id}:${user.name}:${user.avatar_uri ?? ""}:${user.is_alive ? 1 : 0}:${user.growth_level ?? 1}:${user.growth_level_name ?? ""}:${user.is_permanent_vip ? 1 : 0}:${user.avatar_frame_style ?? "none"}:${user.square_outfit_style ?? "sunset"}:${user.square_prop_style ?? "none"}:${user.square_motion_style ?? "walk"}:${user.square_limb_style ?? "line"}`)
    .sort()
    .join("|");
}

function resolveOrbCollisions(orbs: OrbState[], lockedUserId: number | null) {
  const encounters: Array<[number, number]> = [];
  if (!orbs.length) return encounters;
  for (let i = 0; i < orbs.length; i += 1) {
    for (let j = i + 1; j < orbs.length; j += 1) {
      const first = orbs[i];
      const second = orbs[j];
      if (!charactersOverlap(first, second)) continue;
      encounters.push([first.user.user_id, second.user.user_id]);
      const firstBox = characterDimensions(first.size);
      const secondBox = characterDimensions(second.size);
      const dx = second.x - first.x || 1;
      const dy = second.y - first.y || 1;
      const overlapX = (firstBox.width + secondBox.width) / 2 + CHARACTER_GAP - Math.abs(dx);
      const overlapY = (firstBox.height + secondBox.height) / 2 + CHARACTER_GAP - Math.abs(dy);
      const firstLocked = first.user.user_id === lockedUserId;
      const secondLocked = second.user.user_id === lockedUserId;

      if (overlapX < overlapY) {
        const direction = Math.sign(dx);
        first.x -= firstLocked ? 0 : direction * overlapX / (secondLocked ? 1 : 2);
        second.x += secondLocked ? 0 : direction * overlapX / (firstLocked ? 1 : 2);
        if (firstLocked) second.vx = direction * Math.abs(second.vx);
        else if (secondLocked) first.vx = -direction * Math.abs(first.vx);
        else [first.vx, second.vx] = [second.vx, first.vx];
      } else {
        const direction = Math.sign(dy);
        first.y -= firstLocked ? 0 : direction * overlapY / (secondLocked ? 1 : 2);
        second.y += secondLocked ? 0 : direction * overlapY / (firstLocked ? 1 : 2);
        if (firstLocked) second.vy = direction * Math.abs(second.vy);
        else if (secondLocked) first.vy = -direction * Math.abs(first.vy);
        else [first.vy, second.vy] = [second.vy, first.vy];
      }
    }
  }
  return encounters;
}

export default function SquarePage() {
  const { session } = useAuth();
  const { t } = useI18n();
  return session?.user.official ? (
    <Suspense
      fallback={(
        <AppChrome title={t("square.title")} hideTopbar shellClassName="desktop-tab-shell official-square-shell">
          <section className="official-square-prototype" aria-label={t("square.officialPrototype")} />
        </AppChrome>
      )}
    >
      <OfficialAccountSquarePage />
    </Suspense>
  ) : <CommunitySquarePage />;
}

function CommunitySquarePage() {
  const { t } = useI18n();
  const navigate = useNavigate();
  const { session } = useAuth();
  const groupSquareEnabled = useGroupSquareEnabled();
  const [viewState, setViewState] = useState<AppViewState>("idle");
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [onlineUsers, setOnlineUsers] = useState<UserDTO[]>([]);
  const [selectedUser, setSelectedUser] = useState<UserDTO | null>(null);
  const [selectedRelation, setSelectedRelation] = useState<"idle" | "loading" | "friend" | "stranger" | "sent">("idle");
  const [profileUserId, setProfileUserId] = useState<number | null>(null);
  const [profileSyncing, setProfileSyncing] = useState(false);
  const [refreshTick, setRefreshTick] = useState(0);
  const [orbRenderState, setOrbRenderState] = useState<OrbState[]>([]);
  const [exitingOrbs, setExitingOrbs] = useState<OrbState[]>([]);
  const [enteringOrbIds, setEnteringOrbIds] = useState<number[]>([]);
  const [interactingUserIds, setInteractingUserIds] = useState<number[]>([]);
  const stageRef = useRef<HTMLElement | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const lastTickRef = useRef<number | null>(null);
  const orbsRef = useRef<OrbState[]>([]);
  const selectedUserIdRef = useRef<number | null>(null);
  const hasLoadedOnceRef = useRef(false);
  const cacheHydratedRef = useRef(false);
  const exitTimersRef = useRef<Record<number, number>>({});
  const interactionTimersRef = useRef<Record<number, number>>({});
  const encounterCooldownRef = useRef(new Map<string, number>());
  const [stageSize, setStageSize] = useState({ width: 0, height: 0 });
  const cacheScope = buildTabCacheScope(session?.user.space_id, session?.user.user_id);

  selectedUserIdRef.current = selectedUser?.user_id ?? null;

  useEffect(() => {
    if (!groupSquareEnabled) {
      navigate("/app/chats", { replace: true });
      return;
    }

    const controller = new AbortController();
    if (!cacheHydratedRef.current) {
      cacheHydratedRef.current = true;
      const cached = readTabCache<UserDTO[]>(cacheScope, "square");
      if (cached) {
        setOnlineUsers(cached.data);
        setViewState("ready");
        hasLoadedOnceRef.current = true;
      }
    }
    if (!hasLoadedOnceRef.current) {
      setViewState("loading");
    }
    setSyncing(true);
    setError(null);

    api
      .getOnlineUsers({ limit: 80, offset: 0 }, controller.signal)
      .then((liveUsers) => {
        setOnlineUsers(liveUsers);
        setViewState("ready");
        hasLoadedOnceRef.current = true;
        writeTabCache(cacheScope, "square", liveUsers);
      })
      .catch((apiError) => {
        if (controller.signal.aborted) return;
        if (!hasLoadedOnceRef.current) {
          const message = apiError instanceof ApiError ? apiError.message : t("square.loadFailed");
          setError(message);
          setViewState("error");
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) setSyncing(false);
      });

    return () => controller.abort();
  }, [cacheScope, groupSquareEnabled, navigate, refreshTick]);

  useEffect(() => {
    const timer = window.setInterval(() => setRefreshTick((current) => current + 1), 15_000);
    return () => window.clearInterval(timer);
  }, []);

  const displayedOnlineUsers = useMemo(() => {
    const currentUser = session?.user;
    if (!currentUser || onlineUsers.some((user) => user.user_id === currentUser.user_id)) {
      return onlineUsers;
    }
    const self: UserDTO = {
      user_id: currentUser.user_id,
      name: currentUser.name,
      official: currentUser.official,
      avatar_type: currentUser.avatar_type,
      avatar_uri: currentUser.avatar_uri,
      is_alive: true,
      verified: Boolean(currentUser.verified),
      last_heartbeat: currentUser.last_heartbeat ?? Date.now() / 1000,
      welcome_message: currentUser.welcome_message,
      plaza_greeting: t("profile.defaultPlazaGreeting"),
      email_verified_at: currentUser.email_verified_at ?? null,
      phone_verified_at: currentUser.phone_verified_at ?? null,
      bark_verified_at: currentUser.bark_verified_at ?? null,
      is_permanent_vip: currentUser.is_permanent_vip,
      avatar_frame_style: currentUser.avatar_frame_style,
      square_outfit_style: currentUser.square_outfit_style,
      square_prop_style: currentUser.square_prop_style,
      square_motion_style: currentUser.square_motion_style,
      square_limb_style: currentUser.square_limb_style,
    };
    return [self, ...onlineUsers];
  }, [onlineUsers, session?.user]);
  const visibleOnlineUsers = useMemo(() => displayedOnlineUsers.slice(0, MAX_ORBS), [displayedOnlineUsers]);
  const orbSyncSignature = useMemo(() => buildOrbSyncSignature(visibleOnlineUsers), [visibleOnlineUsers]);

  const squareStageHeight = useMemo(() => {
    const rows = Math.max(1, Math.ceil(visibleOnlineUsers.length / 4));
    return Math.max(560, 220 + rows * 130);
  }, [visibleOnlineUsers.length]);

  useEffect(() => {
    const element = stageRef.current;
    if (!element || typeof ResizeObserver === "undefined") return;

    const updateSize = () => {
      setStageSize({
        width: element.clientWidth,
        height: element.clientHeight,
      });
    };

    const observer = new ResizeObserver(updateSize);
    observer.observe(element);
    updateSize();

    return () => observer.disconnect();
  }, [squareStageHeight]);

  useEffect(() => {
    if (!stageSize.width || !stageSize.height) return;
    const previousById = new Map(orbsRef.current.map((orb) => [orb.user.user_id, orb]));
    const incomingIds = new Set(visibleOnlineUsers.map((user) => user.user_id));
    const next = syncOrbsWithUsers(orbsRef.current, visibleOnlineUsers, stageSize.width, stageSize.height);

    const removed = orbsRef.current.filter((orb) => !incomingIds.has(orb.user.user_id));
    if (removed.length) {
      setExitingOrbs((current) => {
        const currentIds = new Set(current.map((orb) => orb.user.user_id));
        return [...current.filter((orb) => !incomingIds.has(orb.user.user_id)), ...removed.filter((orb) => !currentIds.has(orb.user.user_id))];
      });
      removed.forEach((orb) => {
        if (exitTimersRef.current[orb.user.user_id]) {
          window.clearTimeout(exitTimersRef.current[orb.user.user_id]);
        }
        exitTimersRef.current[orb.user.user_id] = window.setTimeout(() => {
          setExitingOrbs((current) => current.filter((item) => item.user.user_id !== orb.user.user_id));
          delete exitTimersRef.current[orb.user.user_id];
        }, ORB_EXIT_DURATION_MS);
      });
    }

    const added = next.filter((orb) => !previousById.has(orb.user.user_id));
    if (added.length) {
      setEnteringOrbIds((current) => [...new Set([...current, ...added.map((orb) => orb.user.user_id)])]);
      window.setTimeout(() => {
        setEnteringOrbIds((current) => current.filter((id) => !added.some((orb) => orb.user.user_id === id)));
      }, ORB_ENTER_DURATION_MS);
    }

    setExitingOrbs((current) => current.filter((orb) => !incomingIds.has(orb.user.user_id)));

    orbsRef.current = next;
    setOrbRenderState(next.map((orb) => ({ ...orb })));
  }, [orbSyncSignature, stageSize.height, stageSize.width]);

  useEffect(() => {
    if (!stageSize.width || !stageSize.height) return;

    const tick = (timestamp: number) => {
      const previousTick = lastTickRef.current ?? timestamp;
      const delta = Math.min(MAX_FRAME_DELTA, (timestamp - previousTick) / 1000);
      lastTickRef.current = timestamp;

      const next = orbsRef.current.map((orb) => ({ ...orb }));
      next.forEach((orb) => {
        const character = characterDimensions(orb.size);
        const minX = CHARACTER_PADDING + character.width / 2;
        const maxX = stageSize.width - CHARACTER_PADDING - character.width / 2;
        const minY = CHARACTER_PADDING + character.height / 2;
        const maxY = stageSize.height - CHARACTER_PADDING - character.height / 2;
        if (orb.user.user_id !== selectedUserIdRef.current) {
          orb.x += orb.vx * delta;
          orb.y += orb.vy * delta;
        }

        if (orb.x <= minX) {
          orb.x = minX;
          orb.vx = Math.abs(orb.vx);
        } else if (orb.x >= maxX) {
          orb.x = maxX;
          orb.vx = -Math.abs(orb.vx);
        }

        if (orb.y <= minY) {
          orb.y = minY;
          orb.vy = Math.abs(orb.vy);
        } else if (orb.y >= maxY) {
          orb.y = maxY;
          orb.vy = -Math.abs(orb.vy);
        }
      });

      if (next.length) {
        const encounters = resolveOrbCollisions(next, selectedUserIdRef.current);
        const now = Date.now();
        const encounter = encounters.find(([firstId, secondId]) => {
          const key = [firstId, secondId].sort((a, b) => a - b).join(":");
          return now - (encounterCooldownRef.current.get(key) ?? 0) > 9_000;
        });
        if (encounter && Math.random() < 0.025) {
          const key = [...encounter].sort((a, b) => a - b).join(":");
          encounterCooldownRef.current.set(key, now);
          setInteractingUserIds(encounter);
          encounter.forEach((userId) => {
            if (interactionTimersRef.current[userId]) window.clearTimeout(interactionTimersRef.current[userId]);
            interactionTimersRef.current[userId] = window.setTimeout(() => {
              setInteractingUserIds((current) => current.filter((id) => id !== userId));
              delete interactionTimersRef.current[userId];
            }, 1_900);
          });
        }
      }
      orbsRef.current = next;
      setOrbRenderState(next.map((orb) => ({ ...orb })));
      animationFrameRef.current = window.requestAnimationFrame(tick);
    };

    animationFrameRef.current = window.requestAnimationFrame(tick);

    return () => {
      if (animationFrameRef.current !== null) {
        window.cancelAnimationFrame(animationFrameRef.current);
      }
      animationFrameRef.current = null;
      lastTickRef.current = null;
    };
  }, [stageSize.height, stageSize.width]);

  useEffect(() => {
    if (!selectedUser) return;
    const refreshed = displayedOnlineUsers.find((user) => user.user_id === selectedUser.user_id);
    if (!refreshed) {
      setSelectedUser(null);
      return;
    }
    setSelectedUser(refreshed);
  }, [displayedOnlineUsers, selectedUser]);

  useEffect(() => {
    if (!selectedUser || selectedUser.user_id === session?.user.user_id) {
      setSelectedRelation("idle");
      return;
    }
    const controller = new AbortController();
    setSelectedRelation("loading");
    api.getFriendStatus(selectedUser.user_id, controller.signal)
      .then((status) => setSelectedRelation(status.is_friend ? "friend" : "stranger"))
      .catch(() => {
        if (!controller.signal.aborted) setSelectedRelation("stranger");
      });
    return () => controller.abort();
  }, [selectedUser?.user_id, session?.user.user_id]);

  useEffect(() => {
    return () => {
      Object.values(exitTimersRef.current).forEach((timer) => window.clearTimeout(timer));
      Object.values(interactionTimersRef.current).forEach((timer) => window.clearTimeout(timer));
    };
  }, []);

  const startChat = async (userId: number) => {
    try {
      const chat = await api.createDirectChat(userId);
      navigate(`/app/chats/${chat.chat_id}`);
    } catch (apiError) {
      const message = apiError instanceof ApiError ? apiError.message : t("profile.chatFailed");
      setError(message);
    }
  };

  const sendFriendRequest = async (userId: number) => {
    try {
      setSelectedRelation("loading");
      await api.createFriendRequest(userId);
      void api.claimGrowthEvent("plaza_friend");
      setSelectedRelation("sent");
      showToast(t("profile.requestSent"));
    } catch (apiError) {
      setSelectedRelation("stranger");
      const message = apiError instanceof ApiError ? apiError.message : t("members.requestFailed");
      setError(message);
    }
  };

  const waveToUser = (userId: number) => {
    const currentUserId = session?.user.user_id;
    const ids = currentUserId ? [currentUserId, userId] : [userId];
    setInteractingUserIds(ids);
    ids.forEach((id) => {
      if (interactionTimersRef.current[id]) window.clearTimeout(interactionTimersRef.current[id]);
      interactionTimersRef.current[id] = window.setTimeout(() => {
        setInteractingUserIds((current) => current.filter((item) => item !== id));
        delete interactionTimersRef.current[id];
      }, 2_200);
    });
    showToast(t("square.waved"));
  };

  const selectedOrb = selectedUser
    ? orbRenderState.find((orb) => orb.user.user_id === selectedUser.user_id) ?? null
    : null;
  const selectedIsSelf = selectedUser?.user_id === session?.user.user_id;
  const selectedCardBelow = Boolean(selectedOrb && selectedOrb.y < 250);
  const selectedCardStyle = selectedOrb
    ? {
        left: `${clamp(150, selectedOrb.x, Math.max(150, stageSize.width - 150))}px`,
        top: `${selectedOrb.y + (selectedCardBelow ? characterDimensions(selectedOrb.size).height / 2 + 12 : -characterDimensions(selectedOrb.size).height / 2 - 12)}px`,
      }
    : undefined;

  return (
    <AppChrome title={t("square.title")} hideTopbar shellClassName="desktop-tab-shell">
      <section className="page-stack square-plaza-page" style={{ "--square-scene-image": `url(${plazaBackground})` } as CSSProperties}>
        <div className="square-scene-title">
          <strong>{t("square.title")}</strong>
          <i aria-hidden="true" />
          <span>{t("square.people", { count: displayedOnlineUsers.length })}</span>
          <HeaderSyncIndicator syncing={syncing} />
        </div>
        <div className="square-plaza-toolbar">
          <VerificationBanner hasPassword={Boolean(session?.user?.has_password)} verified={Boolean(session?.user?.verified)} />
        </div>

        <section
          ref={stageRef}
          className={`square-plaza-stage${selectedUser ? " has-selection" : ""}`}
          onClick={() => setSelectedUser(null)}
          style={{ minHeight: `${squareStageHeight}px` }}
        >
          {orbRenderState.map((orb) => (
            <button
              key={orb.user.user_id}
              className={`square-character${enteringOrbIds.includes(orb.user.user_id) ? " is-entering" : ""}${interactingUserIds.includes(orb.user.user_id) ? " is-interacting" : ""}${selectedUser?.user_id === orb.user.user_id ? " is-selected" : ""}${(orb.user.growth_level ?? 1) >= 10 ? " has-growth-aura" : ""}${(orb.user.growth_level ?? 1) >= 18 ? " is-max-level" : ""}${orb.user.is_permanent_vip ? " is-permanent-vip" : ""}`}
              onClick={(event) => {
                event.stopPropagation();
                setSelectedUser((current) => current?.user_id === orb.user.user_id ? null : orb.user);
              }}
              style={
                {
                  left: `${orb.x}px`,
                  top: `${orb.y}px`,
                  "--orb-size": `${orb.size}px`,
                  "--walk-direction": orb.vx < 0 ? -1 : 1,
                } as CSSProperties
              }
              type="button"
            >
              <SquareCharacterFigure avatarFrame={orb.user.avatar_frame_style} avatarUri={orb.user.avatar_uri} direction={orb.vx < 0 ? -1 : 1} isOnline={orb.user.is_alive} isVip={orb.user.is_permanent_vip} limb={orb.user.square_limb_style ?? "line"} motion={orb.user.square_motion_style ?? "walk"} name={orb.user.name} outfit={orb.user.square_outfit_style ?? "sunset"} prop={orb.user.square_prop_style ?? "none"} />
              {interactingUserIds.includes(orb.user.user_id) ? <span className="square-character-emote" aria-hidden="true">✦</span> : null}
              <span className="square-character-name">{orb.user.name}</span>
            </button>
          ))}

          {exitingOrbs.map((orb) => (
            <div
              key={`exiting-${orb.user.user_id}`}
              className="square-character is-exiting"
              style={
                {
                  left: `${orb.x}px`,
                  top: `${orb.y}px`,
                  "--orb-size": `${orb.size}px`,
                  "--walk-direction": orb.vx < 0 ? -1 : 1,
                } as CSSProperties
              }
            >
              <SquareCharacterFigure avatarFrame={orb.user.avatar_frame_style} avatarUri={orb.user.avatar_uri} direction={orb.vx < 0 ? -1 : 1} isOnline={orb.user.is_alive} isVip={orb.user.is_permanent_vip} limb={orb.user.square_limb_style ?? "line"} motion={orb.user.square_motion_style ?? "walk"} name={orb.user.name} outfit={orb.user.square_outfit_style ?? "sunset"} prop={orb.user.square_prop_style ?? "none"} />
              <span className="square-character-name">{orb.user.name}</span>
            </div>
          ))}

          {selectedUser && selectedOrb && selectedCardStyle ? (
            <div
              className={`square-person-card${selectedCardBelow ? " is-below" : ""}`}
              onClick={(event) => event.stopPropagation()}
              style={selectedCardStyle}
            >
              <div className="square-person-card-identity">
                <UserAvatar
                  className={`square-person-card-avatar ${selectedUser.is_alive ? "status-online" : ""}`}
                  frame={selectedUser.avatar_frame_style}
                  name={selectedUser.name}
                  uri={selectedUser.avatar_uri}
                  vip={selectedUser.is_permanent_vip}
                />
                <div className="square-person-card-copy">
                  <div className="square-person-card-name">
                    <strong>{selectedUser.name}</strong>
                    {selectedUser.official ? <span>{t("square.official")}</span> : null}
                    {!selectedUser.official && selectedUser.growth_level ? (
                      <span className="square-growth-badge">Lv.{selectedUser.growth_level} {selectedUser.growth_level_name}</span>
                    ) : null}
                  </div>
                  <p>{selectedIsSelf ? t("square.youHere") : selectedUser.is_alive ? t("square.here") : t("square.left")}</p>
                </div>
              </div>
              {selectedUser.plaza_greeting?.trim() ? (
                <blockquote>{selectedUser.plaza_greeting.trim()}</blockquote>
              ) : null}
              <div className="square-person-card-actions">
                {selectedIsSelf ? (
                  <button className="button" onClick={() => navigate("/app/menu")} type="button">{t("square.settings")}</button>
                ) : (
                  <>
                    <button className="button" onClick={() => void startChat(selectedUser.user_id)} type="button">{t("profile.sendMessage")}</button>
                    <button className="ghost-button square-wave-button" onClick={() => waveToUser(selectedUser.user_id)} type="button">{t("square.wave")}</button>
                    {selectedRelation !== "friend" ? (
                      <button
                        className="ghost-button"
                        disabled={selectedRelation === "loading" || selectedRelation === "sent"}
                        onClick={() => void sendFriendRequest(selectedUser.user_id)}
                        type="button"
                      >
                        {selectedRelation === "loading" ? t("square.confirming") : selectedRelation === "sent" ? t("square.requested") : t("profile.addFriend")}
                      </button>
                    ) : null}
                    <button
                      className="square-person-profile-link"
                      onClick={() => {
                        setProfileUserId(selectedUser.user_id);
                        setSelectedUser(null);
                      }}
                      type="button"
                    >
                      {t("square.viewProfile")}
                    </button>
                  </>
                )}
              </div>
            </div>
          ) : null}

          {!displayedOnlineUsers.length && viewState === "ready" ? (
            <div className="square-plaza-status">
              <FeedbackState
                title={t("square.empty")}
                description={t("square.emptyHint")}
              />
            </div>
          ) : null}
        </section>
      </section>

      <SideDrawer
        open={profileUserId !== null}
        title={t("profile.details")}
        titleAccessory={<HeaderSyncIndicator syncing={profileSyncing} />}
        onClose={() => setProfileUserId(null)}
      >
        {profileUserId !== null ? (
          <UserProfilePanel
            userId={profileUserId}
            initialUser={displayedOnlineUsers.find((user) => user.user_id === profileUserId)}
            initialIsFriend={selectedRelation === "friend"}
            onSyncingChange={setProfileSyncing}
            onOpenChat={(chatId) => {
              setProfileUserId(null);
              navigate(`/app/chats/${chatId}`);
            }}
          />
        ) : null}
      </SideDrawer>
      <AsyncErrorDialog message={error ?? ""} onClose={() => setError(null)} open={Boolean(error)} />
    </AppChrome>
  );
}
