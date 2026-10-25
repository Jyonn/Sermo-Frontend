import { useLayoutEffect, useRef, type ReactNode } from "react";
import { useI18n } from "../lib/language";
import { preloadLanguageChoices, type SupportedLanguage } from "../lib/i18n";
import { useTheme } from "../lib/theme";
import { DesktopPanelWorkspace } from "./DesktopPanelWorkspace";
import { PageTabs } from "./PageTabs";
import "./ManagementWorkspace.css";
import "./ManagementContent.css";

export interface ManagementDestination {
  id: string;
  icon: string;
  label: string;
  badge?: number;
  group: { id: string; label: string; icon: string };
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
  const subnav = useRef<HTMLDivElement>(null);
  const lastDestination = useRef<Record<string, string>>({});
  const activeItem = items.find((item) => item.id === activeId) ?? items[0];
  const groups = items.filter((item, index) => items.findIndex((other) => other.group.id === item.group.id) === index);
  const siblings = items.filter((item) => item.group.id === activeItem?.group.id);
  useLayoutEffect(() => {
    if (activeItem) lastDestination.current[activeItem.group.id] = activeItem.id;
    nav.current?.querySelector('[aria-current="page"]')?.scrollIntoView({ block: "nearest", inline: "nearest" });
    subnav.current?.querySelector('[aria-selected="true"]')?.scrollIntoView({ block: "nearest", inline: "nearest" });
    body.current?.scrollTo({ top: 0 });
  }, [activeId]);
  return <DesktopPanelWorkspace className={`management-workspace ${siblings.length > 1 ? "has-section-tabs" : ""} ${className}`} surfaceClassName="management-detail">
    <div className="management-brand">
      {avatar}
      <span><small>{title}</small><strong title={identity}>{identity}</strong></span>
    </div>
    <nav aria-label={title} className="management-nav" ref={nav}>
      {groups.map((item) => {
        const badge = items.filter((destination) => destination.group.id === item.group.id).reduce((sum, destination) => sum + (destination.badge ?? 0), 0);
        return <button aria-current={item.group.id === activeItem?.group.id ? "page" : undefined} key={item.group.id} onClick={() => onSelect(lastDestination.current[item.group.id] ?? item.id)} title={item.group.label} type="button">
          <span aria-hidden="true" className="material-symbols-outlined">{item.group.icon}</span>
          <span className="management-nav-label">{item.group.label}</span>
          {badge ? <b>{badge > 99 ? "99+" : badge}</b> : null}
        </button>;
      })}
    </nav>
    <section className="management-content">
      <header className="management-page-header">
        <div><small>{title}</small><h1>{activeItem?.group.label}</h1></div>
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
      <div className="management-section-tabs" hidden={siblings.length < 2} ref={subnav}>
        <PageTabs label={activeItem?.group.label ?? title} items={siblings.map((item) => ({ value: item.id, label: `${item.label}${item.badge ? ` · ${item.badge}` : ""}` }))} value={activeId} onChange={onSelect} />
      </div>
      <div className={`management-body${fill ? " is-fill" : ""}`} ref={body}>{children}</div>
    </section>
  </DesktopPanelWorkspace>;
}
