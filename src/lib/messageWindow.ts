export interface MessageWindowItem {
  id: number | string;
}

function isServerMessage(message: MessageWindowItem) {
  return typeof message.id === "number";
}

export function latestWindowOverlaps<T extends MessageWindowItem>(cached: T[], latest: T[]) {
  const latestServerIds = new Set(
    latest.flatMap((message) => (typeof message.id === "number" ? [message.id] : [])),
  );
  return cached.some(
    (message) => typeof message.id === "number" && latestServerIds.has(message.id),
  );
}

/**
 * Reuse a cached tail only when the server's latest page overlaps it. Without
 * overlap there is no proof that the two sets are contiguous, so keeping both
 * would create an unreachable gap in the rendered timeline.
 */
export function latestWindowCandidates<T extends MessageWindowItem>(cached: T[], latest: T[]) {
  const reusableCached = latestWindowOverlaps(cached, latest)
    ? cached
    : cached.filter((message) => !isServerMessage(message));
  return [...reusableCached, ...latest];
}

export function shouldFollowLatestWindow(hasNewerMessages: boolean, isNearWindowEnd: boolean) {
  return !hasNewerMessages && isNearWindowEnd;
}
