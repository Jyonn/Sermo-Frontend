import { normalizeAgenda } from "./chronelleAgenda.ts";

export interface ChronelleProfileDTO {
  status: "active" | "hidden";
  events: unknown[];
  availability: "known" | "unknown";
}

// Header and profile must interpret the same server-side visibility projection.
export function profileAgenda(result: ChronelleProfileDTO) {
  const hidden = result.status === "hidden";
  return {
    hidden,
    known: !hidden && result.availability === "known",
    events: hidden ? [] : normalizeAgenda(result.events),
  };
}
