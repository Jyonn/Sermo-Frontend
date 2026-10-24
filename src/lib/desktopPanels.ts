export type DesktopPanelMode = "floating" | "split" | null;

export function desktopPanelMode(pathname: string): DesktopPanelMode {
  if (/^\/app\/(menu|notifications)(?:\/|$)/.test(pathname)) return "split";
  if (/^\/app\/(chats|square|submissions)(?:\/|$)/.test(pathname)) return "floating";
  return null;
}

export interface DesktopPanelLayer { id: string; depth: number; wide: boolean }

export const panelSizing = { phone: 390, primaryMax: 960, gap: 16 } as const;

export function desktopPanelLayout(available: number) {
  const { phone, primaryMax, gap } = panelSizing;
  const dual = available >= phone * 2 + gap;
  return {
    presentation: dual ? "dual" as const : "single" as const,
    primary: dual ? Math.min(primaryMax, available - phone - gap) : 0,
    secondary: Math.min(dual ? phone : primaryMax, Math.max(0, available)),
  };
}

export function topDesktopPanel(layers: DesktopPanelLayer[]) {
  return layers.reduce<DesktopPanelLayer | undefined>((top, layer) => !top || layer.depth >= top.depth ? layer : top, undefined);
}
