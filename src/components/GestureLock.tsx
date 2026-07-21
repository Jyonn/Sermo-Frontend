import { useMemo, useRef, useState, type PointerEvent } from "react";
import { clearGestureLock, markGestureUnlocked, saveGesturePattern, verifyGesturePattern } from "../lib/gestureLock";

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
  enabled: boolean;
  onChanged: (enabled: boolean) => void;
}

export function GestureSetupPanel({ scope, enabled, onChanged }: GestureSetupPanelProps) {
  const [firstPattern, setFirstPattern] = useState("");
  const [status, setStatus] = useState(enabled ? "已开启。关闭后，下次进入网页不会再要求手势。" : "请连接至少 4 个点。");
  const [tone, setTone] = useState<"normal" | "error" | "success">("normal");
  const [saving, setSaving] = useState(false);

  const fail = (message: string) => {
    setStatus(message);
    setTone("error");
  };

  const complete = async (pattern: string) => {
    if (!scope || saving) return;
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
    await saveGesturePattern(scope, pattern);
    setSaving(false);
    setFirstPattern("");
    setStatus("手势解锁已开启。");
    setTone("success");
    onChanged(true);
  };

  const disable = () => {
    clearGestureLock(scope);
    setFirstPattern("");
    setStatus("手势解锁已关闭。");
    setTone("normal");
    onChanged(false);
  };

  return (
    <div className="gesture-setup-panel">
      <div className="gesture-status-card">
        <strong>{enabled ? "手势解锁已开启" : "手势解锁默认关闭"}</strong>
        <span>{status}</span>
      </div>
      {enabled ? (
        <button className="danger-button" onClick={disable} type="button">
          关闭手势解锁
        </button>
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
  userName?: string;
  onUnlocked: () => void;
  onResetAndLogout: () => void;
}

export function GestureUnlockScreen({ scope, userName, onUnlocked, onResetAndLogout }: GestureUnlockScreenProps) {
  const [message, setMessage] = useState("画出你的手势，继续进入 Sermo。");
  const [tone, setTone] = useState<"normal" | "error" | "success">("normal");
  const [checking, setChecking] = useState(false);

  const complete = async (pattern: string) => {
    if (checking) return;
    setChecking(true);
    const ok = await verifyGesturePattern(scope, pattern);
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
          清除本机手势并退出登录
        </button>
      </section>
    </main>
  );
}
