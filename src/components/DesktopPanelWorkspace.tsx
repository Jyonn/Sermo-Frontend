import { createContext, useCallback, useContext, useState, useSyncExternalStore, type ReactNode } from "react";
import { useLocation } from "react-router-dom";
import { desktopPanelMode, topDesktopPanel, type DesktopPanelLayer } from "../lib/desktopPanels";
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
  const [layers, setLayers] = useState<DesktopPanelLayer[]>([]);
  const register = useCallback((layer: DesktopPanelLayer) => setLayers((current) => {
    const existing = current.find((item) => item.id === layer.id);
    if (existing?.depth === layer.depth && existing.wide === layer.wide) return current;
    return [...current.filter((item) => item.id !== layer.id), layer];
  }), []);
  const unregister = useCallback((id: string) => setLayers((current) => current.some((item) => item.id === id) ? current.filter((item) => item.id !== id) : current), []);
  const top = topDesktopPanel(layers);
  const active = enabled && layers.length > 0;
  return <DesktopPanels.Provider value={{ enabled, host, topId: top?.id, register, unregister }}>
    <main className={`${className} desktop-panel-workspace${active ? ` has-desktop-panel panel-mode-${mode}` : ""}`}>
      {children}
      <div className={`desktop-panel-slot${top?.wide ? " is-wide" : ""}`} ref={setHost} hidden={!active} />
    </main>
  </DesktopPanels.Provider>;
}
