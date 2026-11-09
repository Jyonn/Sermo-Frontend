export const POCKLO_ORIGIN = "https://pocklo.jyonn.space";

export function pockloShareToken(value: string) {
  const match = /^https:\/\/pocklo\.jyonn\.space\/share\/([a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12})$/i.exec(value);
  return match?.[0] === value ? match[1].toLowerCase() : undefined;
}

export function pockloPickerMessage(event: MessageEvent, frame: Window | null) {
  if (!frame || event.source !== frame || event.origin !== POCKLO_ORIGIN) return null;
  const data = event.data;
  if (!data || data.version !== 1) return null;
  if (data.type === "pocklo.picker.ready") return { type: "ready" } as const;
  if (data.type === "pocklo.picker.cancelled") return { type: "cancelled" } as const;
  if (data.type === "pocklo.picker.error" && data.code === "popup_blocked") return { type: "blocked" } as const;
  if (data.type !== "pocklo.picker.selected" || typeof data.url !== "string") return null;
  const token = pockloShareToken(data.url);
  return token ? { type: "selected", url: POCKLO_ORIGIN + "/share/" + token } as const : null;
}
