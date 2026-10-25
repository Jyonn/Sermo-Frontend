import type { ReactNode } from "react";
import { useI18n } from "../lib/language";
import "./ChatComposerTextRow.css";

interface ChatComposerTextRowProps {
  input: ReactNode;
  inputAccessory?: ReactNode;
  leadingAction?: ReactNode;
  trailingAction: ReactNode;
  disabled?: boolean;
  canSend?: boolean;
}

export function ChatComposerTextRow({ input, inputAccessory, leadingAction, trailingAction, disabled = false, canSend = true }: ChatComposerTextRowProps) {
  const { t } = useI18n();
  return (
    <div className="message-draft-row">
      <div className="message-draft-input">{input}</div>
      <div className="message-draft-tools" role="toolbar" aria-label={t("common.more")}>
        {leadingAction}{inputAccessory}{trailingAction}
        <button className="message-draft-send" aria-label={t("common.send")} disabled={disabled || !canSend} type="submit"><span className="material-symbols-outlined" aria-hidden="true">arrow_upward</span></button>
      </div>
    </div>
  );
}
