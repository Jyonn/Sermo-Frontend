export function signedGrowthPoints(points: number): string {
  return points > 0 ? `+${points}` : String(points);
}
