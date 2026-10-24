import { useLayoutEffect, useRef, type ReactNode } from "react";
import { useI18n } from "../lib/language";
import { preloadLanguageChoices, type SupportedLanguage } from "../lib/i18n";
import { useTheme } from "../lib/theme";
import { DesktopPanelWorkspace } from "./DesktopPanelWorkspace";
import "./ManagementWorkspace.css";

export interface ManagementDestination {
  id: string;
  icon: string;
  label: string;
  badge?: number;
}

export function ManagementWorkspace({ title, identity, avatar, items, activeId, onSelect, onLogout, status, children, className = "", fill = false }: {
  title: string;
  identity: string;
  avatar: ReactNode;
  items: ManagementDestination[];
  activeId: string;
  onSelect: (id: string) => void;
  onLogout: () => void;
  status?: ReactNode;
  children: ReactNode;
  className?: string;
  fill?: boolean;
}) {
  const { t, language, setPreference: setLanguagePreference } = useI18n();
  const { resolvedTheme, setPreference } = useTheme();
  const nav = useRef<HTMLElement>(null);
  const body = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    nav.current?.querySelector('[aria-current="page"]')?.scrollIntoView({ block: "nearest", inline: "nearest" });
    body.current?.scrollTo({ top: 0 });
  }, [activeId]);
  return <DesktopPanelWorkspace className={`management-workspace ${className}`} surfaceClassName="management-detail">
    <div className="management-brand">
      {avatar}
      <span><small>{title}</small><strong title={identity}>{identity}</strong></span>
    </div>
    <nav aria-label={title} className="management-nav" ref={nav}>
      {items.map((item) => <button aria-current={item.id === activeId ? "page" : undefined} key={item.id} onClick={() => onSelect(item.id)} title={item.label} type="button">
        <span aria-hidden="true" className="material-symbols-outlined">{item.icon}</span>
        <span className="management-nav-label">{item.label}</span>
        {item.badge ? <b>{item.badge > 99 ? "99+" : item.badge}</b> : null}
      </button>)}
    </nav>
    <section className="management-content">
      <header className="management-page-header">
        <div><small>{title}</small><h1>{items.find((item) => item.id === activeId)?.label}</h1></div>
        <div className="management-header-actions">
          {status}
          <label className="management-language-control" title={t("menu.language")}>
            <span aria-hidden="true" className="material-symbols-outlined">translate</span>
            <select aria-label={t("menu.language")} value={language} onFocus={preloadLanguageChoices} onPointerDown={preloadLanguageChoices} onChange={(event) => void setLanguagePreference(event.target.value as SupportedLanguage)}>
              <option value="zh-CN">简体中文</option>{/* i18n-ignore: language names stay native */}
              <option value="zh-TW">繁體中文</option>
              <option value="en">English</option>
              <option value="ja">日本語</option>
              <option value="ko">한국어</option>
              <option value="es">Español</option>
            </select>
          </label>
          <button aria-label={t(resolvedTheme === "dark" ? "guest.useLightTheme" : "guest.useDarkTheme")} onClick={() => setPreference(resolvedTheme === "dark" ? "light" : "dark")} type="button"><span aria-hidden="true" className="material-symbols-outlined">{resolvedTheme === "dark" ? "light_mode" : "dark_mode"}</span></button>
          <button aria-label={t("auth.logout")} onClick={onLogout} title={t("auth.logout")} type="button"><span aria-hidden="true" className="material-symbols-outlined">logout</span></button>
        </div>
      </header>
      <div className={`management-body${fill ? " is-fill" : ""}`} ref={body}>{children}</div>
    </section>
  </DesktopPanelWorkspace>;
}
