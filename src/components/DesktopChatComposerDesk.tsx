import { useRef, useState } from "react";
import type { CSSProperties, KeyboardEvent, MouseEvent, PointerEvent, ReactNode } from "react";

const DESK_MIN_HEIGHT = 180;
const DESK_MAX_HEIGHT = 480;

interface DesktopChatComposerDeskProps {
  input: ReactNode;
  reply?: ReactNode;
  shortcutLabel: string;
  tools: ReactNode;
}

export function DesktopChatComposerDesk({
  input,
  reply,
  shortcutLabel,
  tools,
}: DesktopChatComposerDeskProps) {
  const [height, setHeight] = useState(220);
  const dragStart = useRef<{ height: number; y: number } | null>(null);
  const inputSurfaceRef = useRef<HTMLDivElement>(null);

  const maximumHeight = () => typeof window === "undefined"
    ? DESK_MAX_HEIGHT
    : Math.min(DESK_MAX_HEIGHT, Math.max(DESK_MIN_HEIGHT, window.innerHeight * 0.5));
  const clampHeight = (nextHeight: number) => Math.round(Math.min(maximumHeight(), Math.max(DESK_MIN_HEIGHT, nextHeight)));

  const startResize = (event: PointerEvent<HTMLDivElement>) => {
    dragStart.current = { height, y: event.clientY };
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const resize = (event: PointerEvent<HTMLDivElement>) => {
    if (!dragStart.current) return;
    setHeight(clampHeight(dragStart.current.height + dragStart.current.y - event.clientY));
  };

  const stopResize = (event: PointerEvent<HTMLDivElement>) => {
    dragStart.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
  };

  const resizeWithKeyboard = (event: KeyboardEvent<HTMLDivElement>) => {
    const step = event.shiftKey ? 32 : 16;
    let nextHeight: number | null = null;
    if (event.key === "ArrowUp") nextHeight = height + step;
    if (event.key === "ArrowDown") nextHeight = height - step;
    if (event.key === "Home") nextHeight = DESK_MIN_HEIGHT;
    if (event.key === "End") nextHeight = maximumHeight();
    if (nextHeight === null) return;
    event.preventDefault();
    setHeight(clampHeight(nextHeight));
  };

  const focusInput = (event: MouseEvent<HTMLDivElement>) => {
    if (event.target !== event.currentTarget) return;
    inputSurfaceRef.current?.querySelector<HTMLElement>("textarea, input, [contenteditable='true']")?.focus();
  };

  return (
    <div
      className={`desktop-writing-desk${reply ? " has-reply" : ""}`}
      style={{ "--desktop-writing-desk-height": `${height}px` } as CSSProperties}
    >
      <div className="desktop-writing-desk-toolbar" role="toolbar">
        <div className="desktop-writing-desk-tools">{tools}</div>
        <span className="desktop-writing-desk-shortcut">{shortcutLabel}</span>
      </div>
      <div
        aria-orientation="horizontal"
        aria-valuemax={Math.round(maximumHeight())}
        aria-valuemin={DESK_MIN_HEIGHT}
        aria-valuenow={height}
        className="desktop-writing-desk-resize-handle"
        onKeyDown={resizeWithKeyboard}
        onPointerCancel={stopResize}
        onPointerDown={startResize}
        onPointerMove={resize}
        onPointerUp={stopResize}
        role="separator"
        tabIndex={0}
      />
      {reply ? <div className="desktop-writing-desk-context">{reply}</div> : null}
      <div className="desktop-writing-desk-input" onClick={focusInput} ref={inputSurfaceRef}>{input}</div>
    </div>
  );
}
