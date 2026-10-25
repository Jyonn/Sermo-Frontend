export function legacySquareDateRange(date?: string | null) {
  if (!date) return { from: "", to: "" };
  if (date.length === 4) return { from: `${date}-01-01`, to: `${date}-12-31` };
  if (date.length === 7) {
    const end = new Date(`${date}-01T00:00:00Z`);
    end.setUTCMonth(end.getUTCMonth() + 1);
    end.setUTCDate(0);
    return { from: `${date}-01`, to: end.toISOString().slice(0, 10) };
  }
  return { from: date, to: date };
}
