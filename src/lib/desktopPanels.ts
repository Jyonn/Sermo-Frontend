export type DesktopPanelMode = "floating" | "split" | null;

export function desktopPanelMode(pathname: string): DesktopPanelMode {
  if (/^\/app\/(menu|notifications)(?:\/|$)/.test(pathname)) return "split";
  if (/^\/app\/(chats|square|submissions)(?:\/|$)/.test(pathname)) return "floating";
  if (/^\/(admin|space\/dashboard)(?:\/|$)/.test(pathname)) return "floating";
  return null;
}

export interface DesktopPanelLayer { id: string; depth: number; wide: boolean }

export const panelSizing = { phone: 390, primaryMax: 960, gap: 16 } as const;

export const conversationPanelSizing = { listMin: 280, listMax: 340, detailMin: 480, detailMax: 960, gap: 16 } as const;

export const squarePanelSizing = { ...conversationPanelSizing, listMin: 360, listMax: 420 } as const;

export function conversationPanelLayout(available: number, square = false) {
  const { listMin, listMax, detailMin, detailMax, gap } = square ? squarePanelSizing : conversationPanelSizing;
  const width = Math.max(0, available);
  if (width < listMin + detailMin + gap) {
    return { presentation: "single" as const, primary: 0, secondary: Math.min(detailMax, width) };
  }
  const total = Math.min(width, listMax + detailMax + gap);
  const primary = Math.min(listMax, Math.max(listMin, total * (square ? .32 : .28)), total - detailMin - gap);
  return { presentation: "dual" as const, primary, secondary: total - primary - gap };
}

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
