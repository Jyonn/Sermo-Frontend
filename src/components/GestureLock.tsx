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
import { useI18n } from "../lib/language";
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
  const { t } = useI18n();
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
      aria-label={t("gesture.grid")}
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
  const { t } = useI18n();
  return (
    <div className="gesture-range-row">
      <div>
        <strong>{t("gesture.autoLock")}</strong>
        <span>{t("gesture.minutes", { count: value })}</span>
      </div>
      <input
        aria-label={t("gesture.autoLockInterval")}
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
  const { t } = useI18n();
  const enabled = Boolean(preference?.enabled && preference.pattern_hash && preference.salt);
  const [firstPattern, setFirstPattern] = useState("");
  const [timeoutMinutes, setTimeoutMinutes] = useState(normalizeGestureLockAfterMinutes(preference?.lock_after_minutes));
  const [status, setStatus] = useState(
    enabled
      ? t("gesture.enabled")
      : canEnable
        ? t("gesture.connectPoints")
        : t("gesture.verifyEmailFirst")
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
      fail(t("gesture.verifyEmailFirst"));
      return;
    }
    if (pattern.split("-").length < 4) {
      fail(t("gesture.minimumPoints"));
      return;
    }
    if (!firstPattern) {
      setFirstPattern(pattern);
      setStatus(t("gesture.drawAgain"));
      setTone("normal");
      return;
    }
    if (pattern !== firstPattern) {
      setFirstPattern("");
      fail(t("gesture.mismatch"));
      return;
    }
    setSaving(true);
    try {
      const payload = await buildGestureLockPayload(pattern, timeoutMinutes);
      const nextPreference = await api.updateGestureLockPrefs(payload);
      markGestureUnlocked(scope);
      emitGestureLockPreferenceUpdated(nextPreference);
      setFirstPattern("");
      setStatus(t("gesture.enabled"));
      setTone("success");
      onChanged(nextPreference);
    } catch (error) {
      fail(apiErrorMessage(error, t("gesture.saveFailed")));
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
      setStatus(t("gesture.disabled"));
      setTone("normal");
      setVerifyingDisable(false);
      onChanged(nextPreference);
    } catch (error) {
      fail(apiErrorMessage(error, t("gesture.disableFailed")));
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
      setStatus(t("gesture.updated"));
      onChanged(nextPreference);
    } catch (error) {
      setTimeoutMinutes(normalizeGestureLockAfterMinutes(preference?.lock_after_minutes));
      fail(apiErrorMessage(error, t("common.saveFailed")));
    } finally {
      setSaving(false);
    }
  };

  const verifyDisable = async (pattern: string) => {
    if (!preference || saving) return;
    const ok = await verifyGesturePattern(preference, pattern);
    if (!ok) {
      fail(t("gesture.incorrect"));
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
              <div className="gesture-message">{t("gesture.confirm")}</div>
              <PatternGrid disabled={!scope || saving} tone={tone} onComplete={(pattern) => void verifyDisable(pattern)} />
              <button className="ghost-button" disabled={saving} onClick={() => setVerifyingDisable(false)} type="button">
                {t("common.cancel")}
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
                {t("gesture.disable")}
              </button>
            </>
          )}
        </>
      ) : !canEnable ? (
        <div className="inline-note">{t("gesture.verifyEmailToEnable")}</div>
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
                setStatus(t("gesture.redraw"));
              }}
              type="button"
            >
              {t("gesture.restart")}
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
  const { t } = useI18n();
  const [message, setMessage] = useState(() => t("gesture.draw"));
  const [tone, setTone] = useState<"normal" | "error" | "success">("normal");
  const [checking, setChecking] = useState(false);

  const complete = async (pattern: string) => {
    if (checking) return;
    setChecking(true);
    const ok = await verifyGesturePattern(preference, pattern);
    setChecking(false);
    if (!ok) {
      setTone("error");
      setMessage(t("gesture.incorrect"));
      return;
    }
    markGestureUnlocked(scope);
    setTone("success");
    setMessage(t("gesture.unlocked"));
    window.setTimeout(onUnlocked, 120);
  };

  return (
    <main className="gesture-lock-screen">
      <section className="gesture-lock-card" aria-label={t("gesture.title")}>
        <p className="eyebrow">{t("gesture.eyebrow")}</p>
        <h1>{t("gesture.title")}</h1>
        <p>{userName ? t("gesture.welcomeUser", { name: userName }) : t("gesture.welcome")}</p>
        <PatternGrid disabled={checking} tone={tone} onComplete={(pattern) => void complete(pattern)} />
        <div className={`gesture-lock-message gesture-lock-message-${tone}`}>{message}</div>
        <button className="ghost-button gesture-lock-reset" onClick={onResetAndLogout} type="button">
          {t("auth.logout")}
        </button>
      </section>
    </main>
  );
}
