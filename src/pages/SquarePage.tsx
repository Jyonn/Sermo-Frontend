import type { CSSProperties } from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { AppChrome } from "../components/AppChrome";
import { UserAvatar } from "../components/UserAvatar";
import { AsyncErrorDialog } from "../components/AsyncErrorDialog";
import { BottomSheet } from "../components/BottomSheet";
import { FeedbackState } from "../components/FeedbackState";
import { ApiError, api } from "../lib/api";
import { useAuth } from "../lib/auth";
import { useGroupSquareEnabled } from "../lib/spaceFeatures";
import { VerificationBanner } from "../components/VerificationBanner";
import { TabPageHeader } from "../components/TabPageHeader";
import { buildTabCacheScope, readTabCache, writeTabCache } from "../lib/tabCache";
import type { AppViewState, UserDTO } from "../types";

const MAX_ORBS = 20;
const ORB_AREA_RATIO = 0.16;
const ORB_MIN_SIZE = 44;
const ORB_PADDING = 22;
const ORB_GAP = 16;
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
  if (!count || !width || !height) return ORB_MIN_SIZE;
  return Math.max(ORB_MIN_SIZE, Math.sqrt((ORB_AREA_RATIO * width * height) / count));
}

function randomBetween(min: number, max: number) {
  return min + Math.random() * (max - min);
}

function createInitialOrbs(users: UserDTO[], width: number, height: number) {
  const size = calculateOrbSize(users.length, width, height);
  return createOrbsWithSize(users, width, height, size);
}

function createOrbsWithSize(users: UserDTO[], width: number, height: number, size: number) {
  const radius = size / 2;
  const minX = ORB_PADDING + radius;
  const maxX = width - ORB_PADDING - radius;
  const minY = ORB_PADDING + radius;
  const maxY = height - ORB_PADDING - radius;
  const minDistance = size + ORB_GAP;
  const next: OrbState[] = [];

  users.forEach((user, index) => {
    let x = minX;
    let y = minY;

    for (let attempt = 0; attempt < 2000; attempt += 1) {
      x = randomBetween(minX, maxX);
      y = randomBetween(minY, maxY);
      const overlaps = next.some((orb) => {
        const dx = orb.x - x;
        const dy = orb.y - y;
        return Math.hypot(dx, dy) < minDistance;
      });
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
  const radius = nextSize / 2;
  const minX = ORB_PADDING + radius;
  const maxX = width - ORB_PADDING - radius;
  const minY = ORB_PADDING + radius;
  const maxY = height - ORB_PADDING - radius;
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
      const overlaps = next.some((orb) => Math.hypot(orb.x - addition.x, orb.y - addition.y) < nextSize + ORB_GAP);
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
    .map((user) => `${user.user_id}:${user.name}:${user.avatar_uri ?? ""}:${user.is_alive ? 1 : 0}`)
    .sort()
    .join("|");
}

function resolveOrbCollisions(orbs: OrbState[]) {
  if (!orbs.length) return;
  const minDistance = orbs[0].size + ORB_GAP;
  for (let i = 0; i < orbs.length; i += 1) {
    for (let j = i + 1; j < orbs.length; j += 1) {
      const first = orbs[i];
      const second = orbs[j];
      let dx = second.x - first.x;
      let dy = second.y - first.y;
      let distance = Math.hypot(dx, dy);

      if (distance === 0) {
        dx = 1;
        dy = 0;
        distance = 1;
      }

      if (distance >= minDistance) continue;

      const nx = dx / distance;
      const ny = dy / distance;
      const overlap = minDistance - distance;
      first.x -= nx * (overlap / 2);
      first.y -= ny * (overlap / 2);
      second.x += nx * (overlap / 2);
      second.y += ny * (overlap / 2);

      const firstNormal = first.vx * nx + first.vy * ny;
      const secondNormal = second.vx * nx + second.vy * ny;
      const normalDelta = firstNormal - secondNormal;
      if (normalDelta <= 0) continue;

      first.vx -= normalDelta * nx;
      first.vy -= normalDelta * ny;
      second.vx += normalDelta * nx;
      second.vy += normalDelta * ny;
    }
  }
}

export default function SquarePage() {
  const navigate = useNavigate();
  const { session } = useAuth();
  const groupSquareEnabled = useGroupSquareEnabled();
  const [query, setQuery] = useState("");
  const [viewState, setViewState] = useState<AppViewState>("idle");
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [onlineUsers, setOnlineUsers] = useState<UserDTO[]>([]);
  const [selectedUser, setSelectedUser] = useState<UserDTO | null>(null);
  const [refreshTick, setRefreshTick] = useState(0);
  const [orbRenderState, setOrbRenderState] = useState<OrbState[]>([]);
  const [exitingOrbs, setExitingOrbs] = useState<OrbState[]>([]);
  const [enteringOrbIds, setEnteringOrbIds] = useState<number[]>([]);
  const stageRef = useRef<HTMLElement | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const lastTickRef = useRef<number | null>(null);
  const orbsRef = useRef<OrbState[]>([]);
  const hasLoadedOnceRef = useRef(false);
  const cacheHydratedRef = useRef(false);
  const exitTimersRef = useRef<Record<number, number>>({});
  const [stageSize, setStageSize] = useState({ width: 0, height: 0 });
  const cacheScope = buildTabCacheScope(session?.user.space_id, session?.user.user_id);

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
      .getOnlineUsers({ q: query || undefined, limit: 80, offset: 0 }, controller.signal)
      .then((liveUsers) => {
        setOnlineUsers(liveUsers);
        setViewState("ready");
        hasLoadedOnceRef.current = true;
        if (!query.trim()) writeTabCache(cacheScope, "square", liveUsers);
      })
      .catch((apiError) => {
        if (controller.signal.aborted) return;
        if (!hasLoadedOnceRef.current) {
          const message = apiError instanceof ApiError ? apiError.message : "广场加载失败";
          setError(message);
          setViewState("error");
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) setSyncing(false);
      });

    return () => controller.abort();
  }, [cacheScope, groupSquareEnabled, navigate, query, refreshTick]);

  useEffect(() => {
    const timer = window.setInterval(() => setRefreshTick((current) => current + 1), 15_000);
    return () => window.clearInterval(timer);
  }, []);

  const visibleOnlineUsers = useMemo(() => onlineUsers.slice(0, MAX_ORBS), [onlineUsers]);
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
      const radius = next[0]?.size ? next[0].size / 2 : 0;
      const minX = ORB_PADDING + radius;
      const maxX = stageSize.width - ORB_PADDING - radius;
      const minY = ORB_PADDING + radius;
      const maxY = stageSize.height - ORB_PADDING - radius;

      next.forEach((orb) => {
        orb.x += orb.vx * delta;
        orb.y += orb.vy * delta;

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
        resolveOrbCollisions(next);
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
    const refreshed = onlineUsers.find((user) => user.user_id === selectedUser.user_id);
    if (!refreshed) {
      setSelectedUser(null);
      return;
    }
    setSelectedUser(refreshed);
  }, [onlineUsers, selectedUser]);

  useEffect(() => {
    return () => {
      Object.values(exitTimersRef.current).forEach((timer) => window.clearTimeout(timer));
    };
  }, []);

  const startChat = async (userId: number) => {
    try {
      const chat = await api.createDirectChat(userId);
      navigate(`/app/chats/${chat.chat_id}`);
    } catch (apiError) {
      const message = apiError instanceof ApiError ? apiError.message : "发起私聊失败";
      setError(message);
    }
  };

  const sendFriendRequest = async (userId: number) => {
    try {
      await api.createFriendRequest(userId);
      navigate("/app/notifications");
    } catch (apiError) {
      const message = apiError instanceof ApiError ? apiError.message : "发起好友申请失败";
      setError(message);
    }
  };

  return (
    <AppChrome title="广场" hideTopbar shellClassName="desktop-tab-shell">
      <section className="page-stack square-plaza-page">
        <TabPageHeader title="广场" syncing={syncing} />
        <div className="chat-list-screen-header square-plaza-toolbar">
          <VerificationBanner hasPassword={Boolean(session?.user?.has_password)} verified={Boolean(session?.user?.verified)} />
          <label className="search-box page-search square-search">
            <span className="material-symbols-outlined">search</span>
            <input
              className="input"
              style={{ border: 0, background: "transparent", height: "auto", padding: 0 }}
              placeholder="搜索在线成员"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />
          </label>
          <div className="square-online-meta">
            <strong>{query.trim() ? `找到 ${onlineUsers.length} 位在线成员` : `${onlineUsers.length} 人在线`}</strong>
            {query.trim() ? <span>点击头像直接开始一段对话</span> : null}
          </div>
        </div>

        <section ref={stageRef} className="square-plaza-stage" style={{ minHeight: `${squareStageHeight}px` }}>
          <div className="square-plaza-glow square-plaza-glow-a" />
          <div className="square-plaza-glow square-plaza-glow-b" />
          <div className="square-plaza-glow square-plaza-glow-c" />
          {orbRenderState.map((orb) => (
            <button
              key={orb.user.user_id}
              className={`avatar-orb square-orb ${enteringOrbIds.includes(orb.user.user_id) ? "is-entering" : ""}`}
              onClick={() => setSelectedUser(orb.user)}
              style={
                {
                  left: `${orb.x}px`,
                  top: `${orb.y}px`,
                  "--orb-size": `${orb.size}px`,
                } as CSSProperties
              }
              type="button"
            >
              <UserAvatar
                className={`avatar-orb-core ${orb.user.is_alive ? "status-online" : ""}`}
                name={orb.user.name}
                uri={orb.user.avatar_uri}
              />
              <span>{orb.user.name}</span>
            </button>
          ))}

          {exitingOrbs.map((orb) => (
            <div
              key={`exiting-${orb.user.user_id}`}
              className="avatar-orb square-orb is-exiting"
              style={
                {
                  left: `${orb.x}px`,
                  top: `${orb.y}px`,
                  "--orb-size": `${orb.size}px`,
                } as CSSProperties
              }
            >
              <UserAvatar className={`avatar-orb-core ${orb.user.is_alive ? "status-online" : ""}`} name={orb.user.name} uri={orb.user.avatar_uri} />
              <span>{orb.user.name}</span>
            </div>
          ))}

          {!onlineUsers.length && viewState === "ready" ? (
            <div className="square-plaza-status">
              <FeedbackState
                title={query.trim() ? "没有匹配的在线成员" : "现在还没有人在线"}
                description={query.trim() ? "换个关键词试试。" : "等有人上线后，这里会立刻热闹起来。"}
              />
            </div>
          ) : null}
        </section>
      </section>

      <BottomSheet
        open={Boolean(selectedUser)}
        title={selectedUser?.name ?? "成员"}
        description="在线成员"
        onClose={() => setSelectedUser(null)}
      >
        {selectedUser ? (
          <div className="detail-list">
            <div className="simple-sheet-user">
              <UserAvatar
                className={`mini-avatar ${selectedUser.is_alive ? "status-online" : ""}`}
                name={selectedUser.name}
                uri={selectedUser.avatar_uri}
              />
              <div>
                <strong>{selectedUser.name}</strong>
                <div className="row-subtle">{selectedUser.is_alive ? "在线" : "离线"}</div>
              </div>
            </div>
            <div className="sheet-action-list">
              <button className="button" onClick={() => void startChat(selectedUser.user_id)} type="button">
                发消息
              </button>
              <button className="ghost-button" onClick={() => void sendFriendRequest(selectedUser.user_id)} type="button">
                加好友
              </button>
            </div>
          </div>
        ) : null}
      </BottomSheet>
      <AsyncErrorDialog message={error ?? ""} onClose={() => setError(null)} open={Boolean(error)} />
    </AppChrome>
  );
}
