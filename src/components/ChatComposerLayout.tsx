import { useSyncExternalStore, type CSSProperties, type ReactNode } from "react";
import { useI18n } from "../lib/language";
import { DesktopChatComposerDesk } from "./DesktopChatComposerDesk";

const query = "(max-width: 719px)";
const subscribe = (listener: () => void) => {
  const media = window.matchMedia(query);
  media.addEventListener("change", listener);
  return () => media.removeEventListener("change", listener);
};
const snapshot = () => window.matchMedia(query).matches;
export const useMobileComposerLayout = () => useSyncExternalStore(subscribe, snapshot, () => false);

export function MobileChatComposer({ input, tools, toolCount }: {input: ReactNode; tools: ReactNode; toolCount: number}) {
  const { t } = useI18n();
  return <div className="mobile-quiet-composer">
    <div className="mobile-quiet-input-row">{input}</div>
    <div className="mobile-quiet-tool-row" role="toolbar" aria-label={t("composer.tools")} style={{"--mobile-composer-tool-columns": toolCount} as CSSProperties}>{tools}</div>
  </div>;
}

export function ChatComposerLayout({ input, tools, toolCount, mobile }: {input: ReactNode; tools: ReactNode; toolCount: number; mobile: boolean}) {
  const { t } = useI18n();
  return mobile
    ? <MobileChatComposer input={<div className="mobile-quiet-input-wrap">{input}</div>} tools={tools} toolCount={toolCount}/>
    : <DesktopChatComposerDesk input={input} tools={tools} shortcutLabel={t("composer.desktopShortcut")}/>;
}
