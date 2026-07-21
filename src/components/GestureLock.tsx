import { useEffect, useMemo, useRef, useState, type PointerEvent } from "react";
import {
  MAX_GESTURE_LOCK_AFTER_MINUTES,
  buildGestureLockPayload,
  clearGestureUnlock,
  emitGestureLockPreferenceUpdated,
  isGestureDecoyPreferenceEnabled,
  markGestureDecoyActive,
  markGestureUnlocked,
  normalizeGestureLockAfterMinutes,
  verifyGesturePattern,
  verifyGestureDecoyPattern,
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
const GESTURE_HIT_RADIUS = 10.5;
const GESTURE_PATH_HIT_RADIUS = 8;

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
      if (hit.distance > GESTURE_PATH_HIT_RADIUS) return null;
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

function GestureRange({
  disabled,
  value,
  saving,
  onChange,
  onCommit,
}: {
  disabled?: boolean;
  value: number;
  saving: boolean;
  onChange: (value: number) => void;
  onCommit: (value: number) => void;
}) {
  return (
    <div className="gesture-range-row">
      <div>
        <strong>自动上锁</strong>
        <span>{value} 分钟</span>
      </div>
      <input
        aria-label="自动上锁间隔"
        disabled={disabled || saving}
        max={MAX_GESTURE_LOCK_AFTER_MINUTES}
        min={1}
        onBlur={() => onCommit(value)}
        onChange={(event) => onChange(normalizeGestureLockAfterMinutes(event.target.value))}
        onKeyUp={() => onCommit(value)}
        onMouseUp={() => onCommit(value)}
        onTouchEnd={() => onCommit(value)}
        type="range"
        value={value}
      />
    </div>
  );
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
  const [verifyingDisable, setVerifyingDisable] = useState(false);

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
      emitGestureLockPreferenceUpdated(nextPreference);
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
      emitGestureLockPreferenceUpdated(nextPreference);
      setFirstPattern("");
      setStatus("已关闭");
      setTone("normal");
      setVerifyingDisable(false);
      onChanged(nextPreference);
    } catch (error) {
      fail(apiErrorMessage(error, "手势解锁关闭失败，请稍后再试。"));
    } finally {
      setSaving(false);
    }
  };

  const commitTimeout = async (nextValue: number) => {
    if (saving) return;
    const next = Math.min(MAX_GESTURE_LOCK_AFTER_MINUTES, Math.max(1, nextValue));
    if (!enabled || next === normalizeGestureLockAfterMinutes(preference?.lock_after_minutes)) return;
    setSaving(true);
    try {
      const nextPreference = await api.updateGestureLockPrefs({ lock_after_minutes: next });
      emitGestureLockPreferenceUpdated(nextPreference);
      setTimeoutMinutes(normalizeGestureLockAfterMinutes(nextPreference.lock_after_minutes));
      setStatus("已更新");
      onChanged(nextPreference);
    } catch (error) {
      setTimeoutMinutes(normalizeGestureLockAfterMinutes(preference?.lock_after_minutes));
      fail(apiErrorMessage(error, "保存失败"));
    } finally {
      setSaving(false);
    }
  };

  const verifyDisable = async (pattern: string) => {
    if (!preference || saving) return;
    const ok = await verifyGesturePattern(preference, pattern);
    if (!ok) {
      fail("手势不对");
      return;
    }
    await disable();
  };

  return (
    <div className="gesture-setup-panel">
      {enabled ? (
        <>
          {tone === "error" ? <div className="gesture-message gesture-message-error">{status}</div> : null}
          {verifyingDisable ? (
            <>
              <div className="gesture-message">确认手势</div>
              <PatternGrid disabled={!scope || saving} tone={tone} onComplete={(pattern) => void verifyDisable(pattern)} />
              <button className="ghost-button" disabled={saving} onClick={() => setVerifyingDisable(false)} type="button">
                取消
              </button>
            </>
          ) : (
            <>
              <GestureRange
                saving={saving}
                value={timeoutMinutes}
                onChange={setTimeoutMinutes}
                onCommit={(value) => void commitTimeout(value)}
              />
              <button className="danger-button" disabled={saving} onClick={() => setVerifyingDisable(true)} type="button">
                关闭手势解锁
              </button>
            </>
          )}
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

interface GestureDecoySetupPanelProps {
  scope: string | null;
  preference: GestureLockPreferenceDTO | null;
  onChanged: (preference: GestureLockPreferenceDTO) => void;
}

export function GestureDecoySetupPanel({ scope, preference, onChanged }: GestureDecoySetupPanelProps) {
  const decoyEnabled = Boolean(preference?.decoy_enabled && preference.decoy_pattern_hash && preference.decoy_salt);
  const [editing, setEditing] = useState(!decoyEnabled);
  const [firstPattern, setFirstPattern] = useState("");
  const [status, setStatus] = useState(decoyEnabled ? "已设置" : "");
  const [tone, setTone] = useState<"normal" | "error" | "success">("normal");
  const [saving, setSaving] = useState(false);
  const apiErrorMessage = (error: unknown, fallback: string) => (error instanceof ApiError ? error.message : fallback);

  const fail = (message: string) => {
    setStatus(message);
    setTone("error");
  };

  const complete = async (pattern: string) => {
    if (!scope || !preference || saving) return;
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
    if (await verifyGesturePattern(preference, pattern)) {
      fail("不能与真实手势相同");
      return;
    }
    const payload = await buildGestureLockPayload(pattern, preference.lock_after_minutes);
    setSaving(true);
    try {
      const nextPreference = await api.updateGestureLockPrefs({
        decoy_enabled: 1,
        decoy_pattern_hash: payload.pattern_hash,
        decoy_salt: payload.salt,
      });
      emitGestureLockPreferenceUpdated(nextPreference);
      setFirstPattern("");
      setEditing(false);
      setStatus("已设置");
      setTone("success");
      onChanged(nextPreference);
    } catch (error) {
      fail(apiErrorMessage(error, "保存失败"));
    } finally {
      setSaving(false);
    }
  };

  const disable = async () => {
    if (saving) return;
    setSaving(true);
    try {
      const nextPreference = await api.updateGestureLockPrefs({ decoy_enabled: 0 });
      emitGestureLockPreferenceUpdated(nextPreference);
      setEditing(true);
      setStatus("");
      setTone("normal");
      onChanged(nextPreference);
    } catch (error) {
      fail(apiErrorMessage(error, "关闭失败"));
    } finally {
      setSaving(false);
    }
  };

  if (!preference?.enabled) {
    return <div className="inline-note">先开启手势解锁</div>;
  }

  return (
    <div className="gesture-setup-panel">
      {status ? <div className={`gesture-message gesture-message-${tone}`}>{status}</div> : null}
      {editing ? (
        <>
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
      ) : (
        <>
          <button className="button" disabled={saving} onClick={() => setEditing(true)} type="button">
            重新设置
          </button>
          <button className="danger-button" disabled={saving} onClick={() => void disable()} type="button">
            关闭伪手势
          </button>
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
  onDecoyUnlocked?: () => void;
  onResetAndLogout: () => void;
}

export function GestureUnlockScreen({ scope, preference, userName, onUnlocked, onDecoyUnlocked, onResetAndLogout }: GestureUnlockScreenProps) {
  const [message, setMessage] = useState("画出手势");
  const [tone, setTone] = useState<"normal" | "error" | "success">("normal");
  const [checking, setChecking] = useState(false);

  const complete = async (pattern: string) => {
    if (checking) return;
    setChecking(true);
    const ok = await verifyGesturePattern(preference, pattern);
    const decoyOk = ok ? false : await verifyGestureDecoyPattern(preference, pattern);
    setChecking(false);
    if (!ok) {
      if (decoyOk) {
        markGestureDecoyActive(scope);
        setTone("success");
        setMessage("已解锁");
        window.setTimeout(() => onDecoyUnlocked?.(), 120);
        return;
      }
      setTone("error");
      setMessage("手势不对");
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
        {isGestureDecoyPreferenceEnabled(preference) ? <span className="gesture-lock-decoy-dot" aria-hidden="true" /> : null}
        <button className="ghost-button gesture-lock-reset" onClick={onResetAndLogout} type="button">
          退出登录
        </button>
      </section>
    </main>
  );
}

export function GestureDecoyChatScreen() {
  return (
    <main className="gesture-decoy-screen" aria-label="聊天">
      <section className="gesture-decoy-phone">
        <header className="gesture-decoy-header">
          <div className="gesture-decoy-avatar">S</div>
          <div>
            <strong>软糖小啾咪</strong>
            <span>在线</span>
          </div>
        </header>
        <div className="gesture-decoy-messages">
          <p className="gesture-decoy-time">刚刚</p>
          <div className="gesture-decoy-bubble other">在路上了。</div>
          <div className="gesture-decoy-bubble self">好。</div>
          <div className="gesture-decoy-bubble other">晚点聊。</div>
        </div>
        <footer className="gesture-decoy-input">输入消息...</footer>
      </section>
    </main>
  );
}
