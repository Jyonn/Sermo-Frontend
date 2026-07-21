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

function patternFromPoints(points: number[]) {
  return points.join("-");
}

function PatternGrid({ disabled = false, tone = "normal", onComplete }: PatternGridProps) {
  const boardRef = useRef<HTMLDivElement | null>(null);
  const selectedRef = useRef<number[]>([]);
  const [selected, setSelected] = useState<number[]>([]);
  const [dragging, setDragging] = useState(false);

  const linePoints = useMemo(
    () =>
      selected.map((index) => ({
        x: ((index % 3) + 0.5) * (100 / 3),
        y: (Math.floor(index / 3) + 0.5) * (100 / 3),
      })),
    [selected]
  );

  const hitTest = (clientX: number, clientY: number) => {
    const rect = boardRef.current?.getBoundingClientRect();
    if (!rect) return null;
    const x = clientX - rect.left;
    const y = clientY - rect.top;
    if (x < 0 || y < 0 || x > rect.width || y > rect.height) return null;
    const col = Math.min(2, Math.max(0, Math.floor((x / rect.width) * 3)));
    const row = Math.min(2, Math.max(0, Math.floor((y / rect.height) * 3)));
    return row * 3 + col;
  };

  const addPoint = (index: number | null) => {
    if (index === null) return;
    if (selectedRef.current.includes(index)) return;
    selectedRef.current = [...selectedRef.current, index];
    setSelected(selectedRef.current);
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
    addPoint(hitTest(event.clientX, event.clientY));
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
      {Array.from({ length: 9 }, (_, index) => (
        <span key={index} className={`gesture-dot${selected.includes(index) ? " active" : ""}`}>
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
      ? "已开启。关闭后，下次进入网页不会再要求手势。"
      : canEnable
        ? "请连接至少 4 个点。"
        : "完成邮箱认证后才能开启手势解锁。"
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
      fail("完成邮箱认证后才能开启手势解锁。");
      return;
    }
    if (pattern.split("-").length < 4) {
      fail("至少连接 4 个点。");
      return;
    }
    if (!firstPattern) {
      setFirstPattern(pattern);
      setStatus("再画一次，确认手势。");
      setTone("normal");
      return;
    }
    if (pattern !== firstPattern) {
      setFirstPattern("");
      fail("两次手势不一致，请重新设置。");
      return;
    }
    setSaving(true);
    try {
      const payload = await buildGestureLockPayload(pattern, timeoutMinutes);
      const nextPreference = await api.updateGestureLockPrefs(payload);
      markGestureUnlocked(scope);
      emitGestureLockPreferenceUpdated();
      setFirstPattern("");
      setStatus(`${nextPreference.lock_after_minutes} 分钟没有新动作后会自动上锁。`);
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
      setStatus("手势解锁已关闭。");
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
        setStatus(`${nextPreference.lock_after_minutes} 分钟没有新动作后会自动上锁。`);
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
      <div className="gesture-status-card">
        <strong>{enabled ? "手势解锁已开启" : "手势解锁默认关闭"}</strong>
        <span>{status}</span>
      </div>
      <div className="gesture-timeout-row">
        <div>
          <strong>自动上锁</strong>
          <span>{timeoutMinutes} 分钟没有新动作</span>
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
      {enabled ? (
        <button className="danger-button" disabled={saving} onClick={() => void disable()} type="button">
          {saving ? "处理中..." : "关闭手势解锁"}
        </button>
      ) : !canEnable ? (
        <div className="inline-note">请先完成邮箱认证，再回到这里开启手势解锁。</div>
      ) : (
        <>
          <PatternGrid disabled={!scope || saving} tone={tone} onComplete={(pattern) => void complete(pattern)} />
          {firstPattern ? (
            <button
              className="ghost-button"
              onClick={() => {
                setFirstPattern("");
                setTone("normal");
                setStatus("请重新绘制第一遍手势。");
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
