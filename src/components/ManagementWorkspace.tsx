import { Fragment, useLayoutEffect, useRef, type ReactNode } from "react";
import { useI18n } from "../lib/language";
import { useTheme } from "../lib/theme";
import { DesktopPanelWorkspace } from "./DesktopPanelWorkspace";
import { LanguageSelectControl } from './LanguageSelectControl';
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
    const group = nav.current?.querySelector('[data-current="true"]');
    const nestedPage = nav.current?.querySelector('[aria-current="page"]');
    const tab = subnav.current?.querySelector('[aria-current="page"]');
    const reveal = () => {
      const item = nestedPage?.getClientRects().length ? nestedPage : group;
      item?.scrollIntoView({ block: "nearest", inline: "nearest" });
      tab?.scrollIntoView({ block: "nearest", inline: "nearest" });
    };
    reveal();
    const observer = new ResizeObserver(reveal);
    for (const element of [nav.current, subnav.current, group, nestedPage, tab]) {
      if (element) observer.observe(element);
    }
    body.current?.scrollTo({ top: 0 });
    return () => observer.disconnect();
  }, [activeId]);
  return <DesktopPanelWorkspace className={`management-workspace ${siblings.length > 1 ? "has-section-tabs" : ""} ${className}`} surfaceClassName="management-detail">
    <div className="management-brand">
      {avatar}
      <span><small>{title}</small><strong title={identity}>{identity}</strong></span>
    </div>
    <nav aria-label={title} className="management-nav" ref={nav}>
      {groups.map((item) => {
        const destinations = items.filter((destination) => destination.group.id === item.group.id);
        const badge = destinations.reduce((sum, destination) => sum + (destination.badge ?? 0), 0);
        const current = item.group.id === activeItem?.group.id;
        return <Fragment key={item.group.id}>
          <button aria-current={current ? "true" : undefined} data-current={current ? "true" : undefined} onClick={() => onSelect(lastDestination.current[item.group.id] ?? item.id)} title={item.group.label} type="button">
            <span aria-hidden="true" className="material-symbols-outlined">{item.group.icon}</span>
            <span className="management-nav-label">{item.group.label}</span>
            {badge ? <b>{badge > 99 ? "99+" : badge}</b> : null}
          </button>
          {current && destinations.length > 1 && <div className="management-nav-pages">
            {destinations.map((destination) => <DestinationButton item={destination} key={destination.id} active={destination.id === activeId} onSelect={onSelect} />)}
          </div>}
        </Fragment>;
      })}
    </nav>
    <section className="management-content">
      <header className="management-page-header">
        <div className="management-page-context">
          <small><span className="management-mobile-space">{identity} · </span>{siblings.length > 1 ? activeItem?.group.label : title}</small>
          <h1 id="management-page-title">{activeItem?.label}</h1>
        </div>
        <div className="management-header-actions">
          {status}
          <label className="management-language-control" title={t("menu.language")}>
            <span aria-hidden="true" className="material-symbols-outlined">translate</span>
            <LanguageSelectControl value={language} onChange={setLanguagePreference}/>
          </label>
          <button aria-label={t(resolvedTheme === "dark" ? "guest.useLightTheme" : "guest.useDarkTheme")} onClick={() => setPreference(resolvedTheme === "dark" ? "light" : "dark")} type="button"><span aria-hidden="true" className="material-symbols-outlined">{resolvedTheme === "dark" ? "light_mode" : "dark_mode"}</span></button>
          <button aria-label={t("auth.logout")} onClick={onLogout} title={t("auth.logout")} type="button"><span aria-hidden="true" className="material-symbols-outlined">logout</span></button>
        </div>
      </header>
      <nav aria-label={activeItem?.group.label ?? title} className="management-section-tabs" hidden={siblings.length < 2} ref={subnav}>
        {siblings.map((item) => <DestinationButton item={item} key={item.id} active={item.id === activeId} onSelect={onSelect} />)}
      </nav>
      <div aria-labelledby="management-page-title" className={`management-body${fill ? " is-fill" : ""}`} data-page={activeId} ref={body} role="region">{children}</div>
    </section>
  </DesktopPanelWorkspace>;
}

function DestinationButton({ item, active, onSelect }: { item: ManagementDestination; active: boolean; onSelect: (id: string) => void }) {
  return <button aria-current={active ? "page" : undefined} onClick={() => onSelect(item.id)} type="button">
    <span aria-hidden="true" className="material-symbols-outlined">{item.icon}</span>
    <span>{item.label}</span>
    {!!item.badge && <b>{item.badge > 99 ? "99+" : item.badge}</b>}
  </button>;
}

export function ManagementFilter<T extends string>({ label, value, onChange, options }: {
  label: string;
  value: T;
  onChange: (value: T) => void;
  options: { value: T; label: string }[];
}) {
  return <select className="management-filter" aria-label={label} value={value} onChange={(event) => onChange(event.target.value as T)}>
    {options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
  </select>;
}

export function ManagementToolbar({ description, children }: { description?: ReactNode; children?: ReactNode }) {
  return <div className="management-toolbar">
    {description && <div className="management-toolbar-copy">{description}</div>}
    {children && <div className="management-toolbar-actions">{children}</div>}
  </div>;
}

export function ManagementSearch({ label, query, onChange }: { label: string; query: string; onChange: (value: string) => void }) {
  const { t } = useI18n();
  const input = useRef<HTMLInputElement>(null);
  return <div className="management-search" role="search">
    <span aria-hidden="true" className="material-symbols-outlined">search</span>
    <input aria-label={label} onChange={(event) => onChange(event.target.value)} placeholder={label} ref={input} type="search" value={query} />
    {query && <button aria-label={t("common.clear")} title={t("common.clear")} type="button" onClick={() => {
      onChange("");
      input.current?.focus();
    }}><span aria-hidden="true" className="material-symbols-outlined">close</span></button>}
  </div>;
}

export function ManagementSaveBar({ busy, disabled, onSave }: { busy: boolean; disabled?: boolean; onSave: () => void }) {
  const { t } = useI18n();
  return <footer className="management-form-actions">
    <button className="button" disabled={busy || disabled} onClick={onSave} type="button">{t(busy ? "common.saving" : "common.save")}</button>
  </footer>;
}
