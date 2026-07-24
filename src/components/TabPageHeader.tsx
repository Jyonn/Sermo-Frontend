import { useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode, CSSProperties } from "react";
import { HeaderSyncIndicator } from "./HeaderSyncIndicator";

interface TabPageHeaderProps {
  title: string;
  syncing?: boolean;
  status?: ReactNode;
}

export function TabPageHeader({ title, syncing = false, status }: TabPageHeaderProps) {
  type ScrollContainer = Window | HTMLElement;
  const headerRef = useRef<HTMLDivElement | null>(null);
  const [elevation, setElevation] = useState(0);
  const isMobile = useMemo<boolean>(() => {
    if (typeof window === "undefined") return false;
    return window.matchMedia("(max-width: 900px)").matches;
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!isMobile) return;

    const host = headerRef.current;
    if (!host) return;

    const findScrollableRoot = (node: HTMLElement | null): Window | HTMLElement | null => {
      let current: HTMLElement | null = node;
      while (current) {
        if (current.tagName.toLowerCase() === "main") return current;
        const overflowY = window.getComputedStyle(current).overflowY;
        if (overflowY === "auto" || overflowY === "scroll") return current;
        current = current.parentElement;
      }
      return null;
    };

    const scroller = (findScrollableRoot(host.parentElement) ?? window) as ScrollContainer;

    let frameHandle = 0;
    const updateElevation = () => {
      const top = scroller === window ? window.scrollY : (scroller as HTMLElement).scrollTop;
      const next = Math.min(1, Math.max(0, top / 72));
      setElevation((current) => (Math.abs(current - next) > 0.01 ? next : current));
      frameHandle = 0;
    };

    const onScroll = () => {
      if (frameHandle) return;
      frameHandle = window.requestAnimationFrame(updateElevation);
    };

    updateElevation();
    scroller.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      if (frameHandle) window.cancelAnimationFrame(frameHandle);
      scroller.removeEventListener("scroll", onScroll);
    };
  }, [isMobile]);

  const style: CSSProperties = isMobile
    ? ({
        ["--tab-sticky-elevation"]: `${elevation.toFixed(2)}`,
      } as CSSProperties)
    : {};

  return (
    <div
      className={`tab-sticky-header ${!isMobile || elevation > 0.02 ? "is-elevated" : ""}`}
      ref={headerRef}
      style={style}
    >
      <div className="page-toolbar">
        <div className="page-toolbar-title-status">
          <h2 className="panel-title">{title}</h2>
          <HeaderSyncIndicator syncing={syncing} />
          {status}
        </div>
      </div>
    </div>
  );
}
