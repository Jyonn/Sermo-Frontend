import type { ReactNode } from "react";

interface ChatComposerTextRowProps {
  input: ReactNode;
  inputAccessory?: ReactNode;
  leadingAction?: ReactNode;
  trailingAction: ReactNode;
}

export function ChatComposerTextRow({ input, inputAccessory, leadingAction, trailingAction }: ChatComposerTextRowProps) {
  return (
    <div className="composer-row composer-row-text">
      <div className={`composer-leading-actions${leadingAction ? "" : " is-empty"}`}>{leadingAction}</div>
      <div className="composer-input-wrap">
        {input}
        {inputAccessory}
      </div>
      {trailingAction}
      <button hidden type="submit" />
    </div>
  );
}
