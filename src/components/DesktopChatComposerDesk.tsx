import type { ReactNode } from "react";

interface DesktopChatComposerDeskProps {
  characterCount: number;
  input: ReactNode;
  reply?: ReactNode;
  sendDisabled?: boolean;
  sendLabel: string;
  shortcutLabel: string;
  tools: ReactNode;
}

export function DesktopChatComposerDesk({
  characterCount,
  input,
  reply,
  sendDisabled,
  sendLabel,
  shortcutLabel,
  tools,
}: DesktopChatComposerDeskProps) {
  return (
    <div className={`desktop-writing-desk${reply ? " has-reply" : ""}`}>
      <div className="desktop-writing-desk-toolbar" role="toolbar">
        <div className="desktop-writing-desk-tools">{tools}</div>
        <span className="desktop-writing-desk-shortcut">{shortcutLabel}</span>
      </div>
      {reply ? <div className="desktop-writing-desk-context">{reply}</div> : null}
      <div className="desktop-writing-desk-input">{input}</div>
      <div className="desktop-writing-desk-send">
        <button className="desktop-writing-desk-send-button" disabled={sendDisabled} type="submit">
          <span>{sendLabel}</span>
          <span className="material-symbols-outlined" aria-hidden="true">send</span>
        </button>
      </div>
      <footer className="desktop-writing-desk-footer">
        <span />
        <span><strong>{characterCount}</strong> / 2000</span>
      </footer>
    </div>
  );
}
