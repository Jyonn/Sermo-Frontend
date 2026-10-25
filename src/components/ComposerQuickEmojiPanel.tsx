import { useI18n } from "../lib/language";

const emojis = ["😀", "😄", "😂", "🥹", "😊", "🙂", "😉", "😍", "🥰", "🤔", "🤭", "😅", "😭", "😤", "🥳", "🤩", "👍", "👏", "🙏", "👀", "❤️", "💚", "✨", "🎉"];

export function ComposerQuickEmojiPanel({ mobile, onSelect, inset = false }: {mobile:boolean;onSelect:(emoji:string)=>void;inset?:boolean}) {
  const { t } = useI18n();
  return <div className={mobile ? "mobile-composer-reveal is-open" : `desktop-emoji-reveal${inset ? " is-inset" : ""}`}>
    <div className={mobile ? "mobile-composer-reveal-inner" : undefined}>
      <div className="composer-emoji-panel" aria-label={t("emoji.picker")}><div className="composer-emoji-grid">
        {emojis.map((emoji) => <button key={emoji} onClick={() => onSelect(emoji)} type="button">{emoji}</button>)}
      </div></div>
    </div>
  </div>;
}
