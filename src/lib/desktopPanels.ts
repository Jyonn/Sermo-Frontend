export type DesktopPanelMode = "floating" | "split" | null;

export function desktopPanelMode(pathname: string): DesktopPanelMode {
  if (/^\/app\/(menu|notifications)(?:\/|$)/.test(pathname)) return "split";
  if (/^\/app\/(chats|square|submissions)(?:\/|$)/.test(pathname)) return "floating";
  return null;
}

export interface DesktopPanelLayer { id: string; depth: number; wide: boolean }

export function topDesktopPanel(layers: DesktopPanelLayer[]) {
  return layers.reduce<DesktopPanelLayer | undefined>((top, layer) => !top || layer.depth >= top.depth ? layer : top, undefined);
}
