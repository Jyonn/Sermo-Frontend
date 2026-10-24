import { createContext, useCallback, useContext, useLayoutEffect, useState, useSyncExternalStore, type CSSProperties, type ReactNode } from "react";
import { useLocation } from "react-router-dom";
import { desktopPanelLayout, desktopPanelMode, panelSizing, topDesktopPanel, type DesktopPanelLayer } from "../lib/desktopPanels";
import "./DesktopPanelWorkspace.css";

const query = "(min-width: 901px)";
const subscribe = (listener: () => void) => {
  const media = window.matchMedia(query);
  media.addEventListener("change", listener);
  return () => media.removeEventListener("change", listener);
};
const snapshot = () => window.matchMedia(query).matches;
const serverSnapshot = () => false;

interface PanelContext {
  enabled: boolean;
  host: HTMLDivElement | null;
  topId?: string;
  single: boolean;
  register: (layer: DesktopPanelLayer) => void;
  unregister: (id: string) => void;
}
const DesktopPanels = createContext<PanelContext | null>(null);
export const useDesktopPanels = () => useContext(DesktopPanels);

export function DesktopPanelWorkspace({ children, className }: { children: ReactNode; className: string }) {
  const { pathname } = useLocation();
  const desktop = useSyncExternalStore(subscribe, snapshot, serverSnapshot);
  const mode = desktopPanelMode(pathname);
  const enabled = desktop && mode !== null;
  const [host, setHost] = useState<HTMLDivElement | null>(null);
  const [workspace, setWorkspace] = useState<HTMLElement | null>(null);
  const [available, setAvailable] = useState(0);
  const [rightInset, setRightInset] = useState(24);
  useLayoutEffect(() => {
    if (!workspace) return;
    const measure = () => {
      setAvailable(workspace.clientWidth);
      setRightInset(Math.max(16, window.innerWidth - workspace.getBoundingClientRect().right + 16));
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(workspace);
    window.addEventListener("resize", measure);
    return () => { observer.disconnect(); window.removeEventListener("resize", measure); };
  }, [workspace]);
  const [layers, setLayers] = useState<DesktopPanelLayer[]>([]);
  const register = useCallback((layer: DesktopPanelLayer) => setLayers((current) => {
    const existing = current.find((item) => item.id === layer.id);
    if (existing?.depth === layer.depth && existing.wide === layer.wide) return current;
    return [...current.filter((item) => item.id !== layer.id), layer];
  }), []);
  const unregister = useCallback((id: string) => setLayers((current) => current.some((item) => item.id === id) ? current.filter((item) => item.id !== id) : current), []);
  const top = topDesktopPanel(layers);
  const active = enabled && layers.length > 0;
  const layout = desktopPanelLayout(available);
  const split = enabled && mode === "split";
  const single = split && active && layout.presentation === "single";
  const sizing = {
    "--panel-float-right": `${rightInset}px`,
    "--panel-available-width": `${Math.max(0, available - 32)}px`,
    ...(split ? {
      "--panel-primary-width": `${active ? layout.primary : Math.min(panelSizing.primaryMax, available)}px`,
      "--panel-secondary-width": `${active ? layout.secondary : 0}px`,
      "--panel-gap": active && !single ? `${panelSizing.gap}px` : "0px",
    } : {}),
  } as CSSProperties;
  return <DesktopPanels.Provider value={{ enabled, host, topId: top?.id, single, register, unregister }}>
    <main ref={setWorkspace} style={sizing} className={`${className} desktop-panel-workspace${enabled ? ` panel-mode-${mode}` : ""}${active ? " has-desktop-panel" : ""}${single ? " panel-single" : ""}`}>
      {children}
      <div className={`desktop-panel-slot${top?.wide ? " is-wide" : ""}`} ref={setHost} hidden={!active} />
    </main>
  </DesktopPanels.Provider>;
}
