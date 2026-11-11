export type SiteTheme = 'default' | 'qixi-2026' | 'birthday-botanical' | 'christmas-2026';

export function resolveSiteTheme(value: unknown): SiteTheme {
  return value === 'qixi-2026' || value === 'birthday-botanical' || value === 'christmas-2026' ? value : 'default';
}

export function applySiteTheme(value: unknown) {
  const theme = resolveSiteTheme(value);
  if (theme === 'default') delete document.documentElement.dataset.siteTheme;
  else document.documentElement.dataset.siteTheme = theme;
}
