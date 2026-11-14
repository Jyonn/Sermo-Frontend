export type PersonalTheme = 'default' | 'christmas-2026' | 'birthday-botanical';
export interface ThemeUnlock { theme: PersonalTheme; token: string }

/** Seasonal dates use Beijing time, matching birthday celebrations. */
export function availablePersonalThemes(now: number, birthdayActive: boolean, celebrationId?: string | null): ThemeUnlock[] {
  const date = new Date(now + 8 * 3600_000);
  const year = date.getUTCFullYear(), month = date.getUTCMonth() + 1, day = date.getUTCDate();
  const themes: ThemeUnlock[] = [{theme:'default',token:'default'}];
  if (month === 12 || (month === 11 && day >= 26)) themes.push({theme:'christmas-2026',token:`christmas:${year}`});
  if (birthdayActive) themes.push({theme:'birthday-botanical',token:`birthday:${celebrationId || `${year}-${month}-${day}`}`});
  return themes;
}

export function selectedPersonalTheme(unlocks: ThemeUnlock[], saved: {period?: string; theme?: string} | null): PersonalTheme {
  const period = unlocks.map(item => item.token).join('|');
  return saved?.period === period && unlocks.some(item => item.theme === saved.theme)
    ? saved.theme as PersonalTheme : unlocks[unlocks.length - 1].theme;
}
