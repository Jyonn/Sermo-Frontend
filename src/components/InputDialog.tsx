import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { useBodyScrollLock } from "../lib/bodyLock";

interface InputDialogProps {
  open: boolean;
  title: string;
  value: string;
  placeholder?: string;
  type?: "text" | "password";
  confirmLabel?: string;
  cancelLabel?: string;
  busy?: boolean;
  onChange: (value: string) => void;
  onClose: () => void;
  onConfirm: () => void;
}

export function InputDialog({
  open,
  title,
  value,
  placeholder,
  type = "text",
  confirmLabel = "确认",
  cancelLabel = "取消",
  busy = false,
  onChange,
  onClose,
  onConfirm,
}: InputDialogProps) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const closeRef = useRef(onClose);
  const confirmRef = useRef(onConfirm);

  useBodyScrollLock(open);

  useEffect(() => {
    closeRef.current = onClose;
    confirmRef.current = onConfirm;
  }, [onClose, onConfirm]);

  useEffect(() => {
    if (!open) return;

    const timer = window.setTimeout(() => {
      inputRef.current?.focus();
      inputRef.current?.select();
    }, 10);

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") closeRef.current();
      if (event.key === "Enter") {
        event.preventDefault();
        confirmRef.current();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [open]);

  if (!open || typeof document === "undefined") return null;

  return createPortal(
    <div className="dialog-backdrop" onClick={onClose} role="presentation">
      <section aria-modal="true" className="input-dialog" onClick={(event) => event.stopPropagation()} role="dialog">
        <div className="input-dialog-copy">
          <h2>{title}</h2>
        </div>
        <input
          ref={inputRef}
          className="input input-dialog-field"
          placeholder={placeholder}
          type={type}
          value={value}
          onChange={(event) => onChange(event.target.value)}
        />
        <div className="input-dialog-actions">
          <button className="ghost-button" disabled={busy} onClick={onClose} type="button">
            {cancelLabel}
          </button>
          <button className="button" disabled={busy} onClick={onConfirm} type="button">
            {busy ? "处理中..." : confirmLabel}
          </button>
        </div>
      </section>
    </div>,
    document.body
  );
}
