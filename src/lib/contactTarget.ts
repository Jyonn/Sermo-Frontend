import type { NotificationChannel } from "../types";

const barkEndpointPattern = /^https:\/\/api\.day\.app\/([^/?#\s]+)/i;

export function normalizeContactTarget(channel: NotificationChannel, target: string): string {
  const trimmed = target.trim();
  if (channel === "email") return trimmed.toLowerCase();
  if (channel !== "bark") return trimmed;

  const match = trimmed.match(barkEndpointPattern);
  return match ? `https://api.day.app/${match[1]}` : trimmed;
}
