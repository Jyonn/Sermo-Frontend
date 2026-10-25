export function daysInMonth(year: number, month: number) {
  return month === 2 ? (year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0) ? 29 : 28) : ([4, 6, 9, 11].includes(month) ? 30 : 31);
}

export function wheelDate(year: number, month: number, day: number) {
  return `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}-${String(Math.max(1, Math.min(day, daysInMonth(year, month)))).padStart(2, "0")}`;
}
