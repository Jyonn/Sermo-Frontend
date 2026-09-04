import { useEffect, useRef, type ReactNode } from "react";
import { HeaderSyncIndicator } from "./HeaderSyncIndicator";

interface TabPageHeaderProps {
  title: ReactNode;
  syncing?: boolean;
  status?: ReactNode;
  actions?: ReactNode;
  secondary?: ReactNode;
}

export function TabPageHeader({ title, syncing = false, status, actions, secondary }: TabPageHeaderProps) {
  const headerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!window.matchMedia("(max-width: 900px)").matches) return;

    let frame = 0;
    let scrollElement = headerRef.current?.parentElement ?? null;
    while (scrollElement) {
      const overflowY = window.getComputedStyle(scrollElement).overflowY;
      if (/auto|scroll|overlay/.test(overflowY)) break;
      scrollElement = scrollElement.parentElement;
    }
    const scrollTarget: HTMLElement | Window = scrollElement ?? window;

    const updateElevation = () => {
      frame = 0;
      const scrollTop = scrollElement?.scrollTop ?? window.scrollY;
      const elevation = Math.min(1, Math.max(0, scrollTop / 64));
      headerRef.current?.style.setProperty("--tab-sticky-elevation", elevation.toFixed(3));
    };

    const handleScroll = () => {
      if (frame) return;
      frame = window.requestAnimationFrame(updateElevation);
    };

    updateElevation();
    scrollTarget.addEventListener("scroll", handleScroll, { passive: true });

    return () => {
      scrollTarget.removeEventListener("scroll", handleScroll);
      if (frame) window.cancelAnimationFrame(frame);
    };
  }, []);

  return (
    <div ref={headerRef} className={`tab-sticky-header${secondary ? " has-secondary" : ""}`}>
      <div className="page-toolbar">
        <div className="page-toolbar-title-status">
          <h2 className="panel-title">{title}</h2>
          <span className="festival-theme-mark" aria-hidden="true" />
          <HeaderSyncIndicator syncing={syncing} />
          {status}
        </div>
        {actions ? <div className="page-toolbar-actions">{actions}</div> : null}
      </div>
      {secondary ? <div className="tab-sticky-header-secondary">{secondary}</div> : null}
    </div>
  );
}
