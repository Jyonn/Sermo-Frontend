export function availableSquareQuota(dailyUsed: number, dailyLimit: number | null, weeklyUsed: number, weeklyLimit: number | null) {
  const limits = [[dailyUsed, dailyLimit], [weeklyUsed, weeklyLimit]].flatMap(([used, limit]) => limit === null ? [] : [Math.max(0, limit - (used ?? 0))]);
  return limits.length ? Math.min(...limits) : null;
}
