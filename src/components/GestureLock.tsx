import { useEffect, useMemo, useRef, useState, type PointerEvent } from "react";
import {
  MAX_GESTURE_LOCK_AFTER_MINUTES,
  buildGestureLockPayload,
  clearGestureUnlock,
  emitGestureLockPreferenceUpdated,
  markGestureUnlocked,
  normalizeGestureLockAfterMinutes,
  verifyGesturePattern,
} from "../lib/gestureLock";
import { ApiError, api } from "../lib/api";
import type { GestureLockPreferenceDTO } from "../types";

interface PatternGridProps {
  disabled?: boolean;
  tone?: "normal" | "error" | "success";
  onComplete: (pattern: string) => void;
}

const GESTURE_POINTS = Array.from({ length: 9 }, (_, index) => ({
  x: ((index % 3) + 0.5) * (100 / 3),
  y: (Math.floor(index / 3) + 0.5) * (100 / 3),
}));
const GESTURE_HIT_RADIUS = 14;

function patternFromPoints(points: number[]) {
  return points.join("-");
}

function distance(left: { x: number; y: number }, right: { x: number; y: number }) {
  return Math.hypot(left.x - right.x, left.y - right.y);
}

function distanceToSegment(point: { x: number; y: number }, start: { x: number; y: number }, end: { x: number; y: number }) {
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const lengthSquared = dx * dx + dy * dy;
  if (!lengthSquared) return { distance: distance(point, start), progress: 0 };
  const progress = Math.max(0, Math.min(1, ((point.x - start.x) * dx + (point.y - start.y) * dy) / lengthSquared));
  return {
    distance: distance(point, { x: start.x + progress * dx, y: start.y + progress * dy }),
    progress,
  };
}

function PatternGrid({ disabled = false, tone = "normal", onComplete }: PatternGridProps) {
  const boardRef = useRef<HTMLDivElement | null>(null);
  const selectedRef = useRef<number[]>([]);
  const [selected, setSelected] = useState<number[]>([]);
  const [dragging, setDragging] = useState(false);

  const linePoints = useMemo(
    () =>
      selected.map((index) => GESTURE_POINTS[index]),
    [selected]
  );

  const pointerPoint = (clientX: number, clientY: number) => {
    const rect = boardRef.current?.getBoundingClientRect();
    if (!rect) return null;
    const x = clientX - rect.left;
    const y = clientY - rect.top;
    if (x < 0 || y < 0 || x > rect.width || y > rect.height) return null;
    return {
      x: (x / rect.width) * 100,
      y: (y / rect.height) * 100,
    };
  };

  const hitTest = (clientX: number, clientY: number) => {
    const point = pointerPoint(clientX, clientY);
    if (!point) return null;
    let nearestIndex: number | null = null;
    let nearestDistance = Number.POSITIVE_INFINITY;
    GESTURE_POINTS.forEach((candidate, index) => {
      const currentDistance = distance(point, candidate);
      if (currentDistance < nearestDistance) {
        nearestDistance = currentDistance;
        nearestIndex = index;
      }
    });
    return nearestDistance <= GESTURE_HIT_RADIUS ? nearestIndex : null;
  };

  const hitPath = (clientX: number, clientY: number) => {
    const point = pointerPoint(clientX, clientY);
    if (!point) return [];
    const lastIndex = selectedRef.current[selectedRef.current.length - 1];
    if (lastIndex === undefined) {
      const nearest = hitTest(clientX, clientY);
      return nearest === null ? [] : [nearest];
    }
    const start = GESTURE_POINTS[lastIndex];
    return GESTURE_POINTS.map((candidate, index) => {
      if (selectedRef.current.includes(index)) return null;
      const hit = distanceToSegment(candidate, start, point);
      if (hit.distance > GESTURE_HIT_RADIUS) return null;
      return { index, progress: hit.progress };
    })
      .filter((item): item is { index: number; progress: number } => Boolean(item))
      .sort((left, right) => left.progress - right.progress)
      .map((item) => item.index);
  };

  const addPoint = (index: number | null) => {
    if (index === null) return;
    if (selectedRef.current.includes(index)) return;
    selectedRef.current = [...selectedRef.current, index];
    setSelected(selectedRef.current);
  };

  const addPoints = (indexes: number[]) => {
    indexes.forEach((index) => addPoint(index));
  };

  const start = (event: PointerEvent<HTMLDivElement>) => {
    if (disabled) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    const index = hitTest(event.clientX, event.clientY);
    selectedRef.current = index === null ? [] : [index];
    setSelected(selectedRef.current);
    setDragging(true);
  };

  const move = (event: PointerEvent<HTMLDivElement>) => {
    if (!dragging || disabled) return;
    addPoints(hitPath(event.clientX, event.clientY));
  };

  const end = () => {
    if (!dragging) return;
    setDragging(false);
    const pattern = patternFromPoints(selectedRef.current);
    window.setTimeout(() => {
      selectedRef.current = [];
      setSelected([]);
    }, 260);
    if (pattern) onComplete(pattern);
  };

  return (
    <div
      ref={boardRef}
      className={`gesture-grid gesture-grid-${tone}`}
      onPointerCancel={end}
      onPointerDown={start}
      onPointerMove={move}
      onPointerUp={end}
      role="application"
      aria-label="手势九宫格"
    >
      <svg className="gesture-lines" viewBox="0 0 100 100" aria-hidden="true">
        {linePoints.length > 1 ? (
          <polyline points={linePoints.map((point) => `${point.x},${point.y}`).join(" ")} />
        ) : null}
      </svg>
      {GESTURE_POINTS.map((point, index) => (
        <span
          key={index}
          className={`gesture-dot${selected.includes(index) ? " active" : ""}`}
          style={{ left: `${point.x}%`, top: `${point.y}%` }}
        >
          <span />
        </span>
      ))}
    </div>
  );
}

interface GestureSetupPanelProps {
  scope: string | null;
  canEnable: boolean;
  preference: GestureLockPreferenceDTO | null;
  onChanged: (preference: GestureLockPreferenceDTO) => void;
}

export function GestureSetupPanel({ scope, canEnable, preference, onChanged }: GestureSetupPanelProps) {
  const enabled = Boolean(preference?.enabled && preference.pattern_hash && preference.salt);
  const [firstPattern, setFirstPattern] = useState("");
  const [timeoutMinutes, setTimeoutMinutes] = useState(normalizeGestureLockAfterMinutes(preference?.lock_after_minutes));
  const [status, setStatus] = useState(
    enabled
      ? "已开启"
      : canEnable
        ? "连接至少 4 个点"
        : "请先认证邮箱"
  );
  const [tone, setTone] = useState<"normal" | "error" | "success">("normal");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setTimeoutMinutes(normalizeGestureLockAfterMinutes(preference?.lock_after_minutes));
  }, [preference?.lock_after_minutes]);

  const fail = (message: string) => {
    setStatus(message);
    setTone("error");
  };

  const apiErrorMessage = (error: unknown, fallback: string) => (error instanceof ApiError ? error.message : fallback);

  const complete = async (pattern: string) => {
    if (!scope || saving) return;
    if (!canEnable) {
      fail("请先认证邮箱");
      return;
    }
    if (pattern.split("-").length < 4) {
      fail("至少 4 个点");
      return;
    }
    if (!firstPattern) {
      setFirstPattern(pattern);
      setStatus("再画一次确认");
      setTone("normal");
      return;
    }
    if (pattern !== firstPattern) {
      setFirstPattern("");
      fail("不一致，请重画");
      return;
    }
    setSaving(true);
    try {
      const payload = await buildGestureLockPayload(pattern, timeoutMinutes);
      const nextPreference = await api.updateGestureLockPrefs(payload);
      markGestureUnlocked(scope);
      emitGestureLockPreferenceUpdated();
      setFirstPattern("");
      setStatus("已开启");
      setTone("success");
      onChanged(nextPreference);
    } catch (error) {
      fail(apiErrorMessage(error, "手势解锁保存失败，请稍后再试。"));
    } finally {
      setSaving(false);
    }
  };

  const disable = async () => {
    if (saving) return;
    setSaving(true);
    try {
      const nextPreference = await api.updateGestureLockPrefs({ enabled: 0 });
      clearGestureUnlock(scope);
      emitGestureLockPreferenceUpdated();
      setFirstPattern("");
      setStatus("已关闭");
      setTone("normal");
      onChanged(nextPreference);
    } catch (error) {
      fail(apiErrorMessage(error, "手势解锁关闭失败，请稍后再试。"));
    } finally {
      setSaving(false);
    }
  };

  const updateTimeout = async (nextValue: number) => {
    if (saving) return;
    const next = Math.min(MAX_GESTURE_LOCK_AFTER_MINUTES, Math.max(1, nextValue));
    setTimeoutMinutes(next);
    if (enabled) {
      setSaving(true);
      try {
        const nextPreference = await api.updateGestureLockPrefs({ lock_after_minutes: next });
        emitGestureLockPreferenceUpdated();
        setTimeoutMinutes(normalizeGestureLockAfterMinutes(nextPreference.lock_after_minutes));
        setStatus("已更新");
        onChanged(nextPreference);
      } catch (error) {
        setTimeoutMinutes(normalizeGestureLockAfterMinutes(preference?.lock_after_minutes));
        fail(apiErrorMessage(error, "自动上锁时间保存失败，请稍后再试。"));
      } finally {
        setSaving(false);
      }
    }
  };

  return (
    <div className="gesture-setup-panel">
      {enabled ? (
        <>
          {tone === "error" ? <div className="gesture-message gesture-message-error">{status}</div> : null}
          <div className="gesture-timeout-row">
            <div>
              <strong>自动上锁</strong>
              <span>{timeoutMinutes} 分钟</span>
            </div>
            <div className="menu-stepper">
              <button disabled={saving || timeoutMinutes <= 1} onClick={() => void updateTimeout(timeoutMinutes - 1)} type="button">
                -
              </button>
              <span className="menu-stepper-value mono">{timeoutMinutes}</span>
              <button disabled={saving || timeoutMinutes >= MAX_GESTURE_LOCK_AFTER_MINUTES} onClick={() => void updateTimeout(timeoutMinutes + 1)} type="button">
                +
              </button>
            </div>
          </div>
          <button className="danger-button" disabled={saving} onClick={() => void disable()} type="button">
            {saving ? "处理中..." : "关闭手势解锁"}
          </button>
        </>
      ) : !canEnable ? (
        <div className="inline-note">认证邮箱后可开启</div>
      ) : (
        <>
          {firstPattern || tone !== "normal" ? <div className={`gesture-message gesture-message-${tone}`}>{status}</div> : null}
          <PatternGrid disabled={!scope || saving} tone={tone} onComplete={(pattern) => void complete(pattern)} />
          {firstPattern ? (
            <button
              className="ghost-button"
              onClick={() => {
                setFirstPattern("");
                setTone("normal");
                setStatus("请重画");
              }}
              type="button"
            >
              重新开始
            </button>
          ) : null}
        </>
      )}
    </div>
  );
}

interface GestureUnlockScreenProps {
  scope: string;
  preference: GestureLockPreferenceDTO;
  userName?: string;
  onUnlocked: () => void;
  onResetAndLogout: () => void;
}

export function GestureUnlockScreen({ scope, preference, userName, onUnlocked, onResetAndLogout }: GestureUnlockScreenProps) {
  const [message, setMessage] = useState("画出你的手势，继续进入 Sermo。");
  const [tone, setTone] = useState<"normal" | "error" | "success">("normal");
  const [checking, setChecking] = useState(false);

  const complete = async (pattern: string) => {
    if (checking) return;
    setChecking(true);
    const ok = await verifyGesturePattern(preference, pattern);
    setChecking(false);
    if (!ok) {
      setTone("error");
      setMessage("手势不对，再试一次。");
      return;
    }
    markGestureUnlocked(scope);
    setTone("success");
    setMessage("已解锁。");
    window.setTimeout(onUnlocked, 120);
  };

  return (
    <main className="gesture-lock-screen">
      <section className="gesture-lock-card" aria-label="手势解锁">
        <p className="eyebrow">Gesture</p>
        <h1>手势解锁</h1>
        <p>欢迎回来{userName ? `，${userName}` : ""}</p>
        <PatternGrid disabled={checking} tone={tone} onComplete={(pattern) => void complete(pattern)} />
        <div className={`gesture-lock-message gesture-lock-message-${tone}`}>{message}</div>
        <button className="ghost-button gesture-lock-reset" onClick={onResetAndLogout} type="button">
          退出登录
        </button>
      </section>
    </main>
  );
}
