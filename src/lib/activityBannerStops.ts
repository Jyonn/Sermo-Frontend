export function activityBannerStops(viewportWidth: number, contentWidth: number, offsets: number[]) {
  const maximum = Math.max(0, contentWidth - viewportWidth);
  return offsets.map((offset) => Math.min(maximum, Math.max(0, offset)))
    .filter((offset, index, items) => index === 0 || offset - items[index - 1] > 1);
}
