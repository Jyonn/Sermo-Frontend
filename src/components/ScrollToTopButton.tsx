import { useEffect, useRef, useState, type CSSProperties } from "react";
import { createPortal } from "react-dom";

const EXIT_ANIMATION_MS = 180;

type ScrollToTopButtonProps = {
  ariaLabel: string;
  className?: string;
  onClick: () => void;
  portal?: boolean;
  style?: CSSProperties;
  visible: boolean;
};

export function ScrollToTopButton({
  ariaLabel,
  className,
  onClick,
  portal = false,
  style,
  visible,
}: ScrollToTopButtonProps) {
  const [present, setPresent] = useState(visible);
  const buttonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (visible) {
      setPresent(true);
      return undefined;
    }
    if (!present) return undefined;
    buttonRef.current?.blur();
    const timeout = window.setTimeout(() => setPresent(false), EXIT_ANIMATION_MS);
    return () => window.clearTimeout(timeout);
  }, [present, visible]);

  if (!present) return null;

  const button = (
    <button
      aria-hidden={!visible}
      aria-label={ariaLabel}
      className={`scroll-to-top-button ${visible ? "is-visible" : "is-hiding"}${className ? ` ${className}` : ""}`}
      onClick={() => {
        if (visible) onClick();
      }}
      ref={buttonRef}
      style={style}
      tabIndex={visible ? 0 : -1}
      title={ariaLabel}
      type="button"
    >
      <svg aria-hidden="true" focusable="false" viewBox="0 0 24 24">
        <path d="M5 11 12 4l7 7M12 4v16" />
      </svg>
    </button>
  );

  return portal && typeof document !== "undefined" ? createPortal(button, document.body) : button;
}
