import { useEffect, useId, useRef } from "react";

interface VerificationCodeInputProps {
  value: string;
  onChange: (value: string) => void;
  ariaLabel: string;
  autoFocus?: boolean;
  className?: string;
  disabled?: boolean;
}

const CODE_LENGTH = 6;

export function VerificationCodeInput({
  value,
  onChange,
  ariaLabel,
  autoFocus = false,
  className = "",
  disabled = false,
}: VerificationCodeInputProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const inputId = useId();
  const normalizedValue = value.replace(/\D/g, "").slice(0, CODE_LENGTH);

  useEffect(() => {
    if (autoFocus && !disabled) inputRef.current?.focus();
  }, [autoFocus, disabled]);

  return (
    <div
      className={`verification-code-input${className ? ` ${className}` : ""}${disabled ? " is-disabled" : ""}`}
      onClick={() => inputRef.current?.focus()}
      role="group"
    >
      <input
        aria-label={ariaLabel}
        autoComplete="one-time-code"
        disabled={disabled}
        id={inputId}
        inputMode="numeric"
        maxLength={CODE_LENGTH}
        onChange={(event) => onChange(event.target.value.replace(/\D/g, "").slice(0, CODE_LENGTH))}
        pattern="[0-9]*"
        ref={inputRef}
        type="text"
        value={normalizedValue}
      />
      <div aria-hidden="true" className="verification-code-cells">
        {Array.from({ length: CODE_LENGTH }, (_, index) => (
          <span
            className={`${normalizedValue[index] ? "is-filled" : ""}${index === normalizedValue.length && normalizedValue.length < CODE_LENGTH ? " is-active" : ""}`}
            key={index}
          >
            {normalizedValue[index] ?? ""}
          </span>
        ))}
      </div>
    </div>
  );
}
