import { POCKLO_ORIGIN, pockloShareToken } from "./pockloShare.ts";

const resourcePattern = /^[A-Za-z0-9_-]{1,128}$/;
const uuidPattern = /^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i;

function matches(pattern: RegExp, value: unknown): value is string {
  return typeof value === "string" && pattern.exec(value)?.[0] === value;
}

export function readPockloPickerMessage(event: MessageEvent, frame: Window | null) {
  if (!frame || event.source !== frame || event.origin !== POCKLO_ORIGIN) return null;
  const data = event.data;
  if (!data || data.version !== 1) return null;
  switch (data.type) {
    case "pocklo.picker.ready": return { type: "ready" } as const;
    case "pocklo.picker.cancelled": return { type: "cancelled" } as const;
    case "pocklo.picker.selected": {
      const token = typeof data.url === "string" ? pockloShareToken(data.url) : undefined;
      return token ? { type: "selected", url: POCKLO_ORIGIN + "/share/" + token } as const : null;
    }
    case "pocklo.picker.request": {
      const { action, requestId, resourceId, operationId, query, offset } = data;
      if (!matches(resourcePattern, requestId) || (resourceId !== "" && !matches(resourcePattern, resourceId))) return null;
      if (action === "files" && typeof query === "string" && query.length <= 256
          && Number.isSafeInteger(offset) && offset >= 0 && offset <= 99_999_999) {
        return { type: "files", requestId, resourceId, query, offset } as const;
      }
      if (action === "share" && resourceId && matches(uuidPattern, operationId)) {
        return { type: "share", requestId, resourceId, operationId } as const;
      }
      return null;
    }
    default: return null;
  }
}
