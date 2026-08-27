import { useEffect, useRef, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { useBodyScrollLock } from "../lib/bodyLock";
import { useI18n } from "../lib/language";

interface InputDialogProps {
  open: boolean;
  title: string;
  description?: ReactNode;
  value: string;
  placeholder?: string;
  type?: "text" | "password";
  confirmLabel?: string;
  cancelLabel?: string;
  busy?: boolean;
  maxLength?: number;
  onChange: (value: string) => void;
  onClose: () => void;
  onConfirm: () => void;
}

export function InputDialog({
  open,
  title,
  description,
  value,
  placeholder,
  type = "text",
  confirmLabel,
  cancelLabel,
  busy = false,
  maxLength,
  onChange,
  onClose,
  onConfirm,
}: InputDialogProps) {
  const { t } = useI18n();
  const inputRef = useRef<HTMLInputElement | null>(null);
  const composingRef = useRef(false);
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
      if (event.isComposing || event.keyCode === 229) return;
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
          {description ? <p>{description}</p> : null}
        </div>
        <input
          ref={inputRef}
          className="input input-dialog-field"
          placeholder={placeholder}
          type={type}
          value={value}
          onChange={(event) => {
            const nextValue = event.target.value;
            onChange(composingRef.current || maxLength === undefined
              ? nextValue
              : Array.from(nextValue).slice(0, maxLength).join(""));
          }}
          onCompositionStart={() => {
            composingRef.current = true;
          }}
          onCompositionEnd={(event) => {
            composingRef.current = false;
            const nextValue = event.currentTarget.value;
            onChange(maxLength === undefined
              ? nextValue
              : Array.from(nextValue).slice(0, maxLength).join(""));
          }}
        />
        <div className="input-dialog-actions">
          <button className="ghost-button" disabled={busy} onClick={onClose} type="button">
            {cancelLabel ?? t("common.cancel")}
          </button>
          <button className="button" disabled={busy} onClick={onConfirm} type="button">
            {busy ? t("common.processing") : confirmLabel ?? t("common.confirm")}
          </button>
        </div>
      </section>
    </div>,
    document.body
  );
}
