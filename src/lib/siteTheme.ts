const QIXI_THEME = "qixi-2026";
const QIXI_START = Date.UTC(2026, 7, 18, 16);
const QIXI_END = Date.UTC(2026, 7, 20, 16);

function resolveScheduledSiteTheme(now = Date.now()) {
  return now >= QIXI_START && now < QIXI_END ? QIXI_THEME : null;
}

function applyScheduledSiteTheme() {
  const theme = resolveScheduledSiteTheme();
  if (theme) {
    document.documentElement.dataset.siteTheme = theme;
  } else {
    delete document.documentElement.dataset.siteTheme;
  }
}

export function initializeScheduledSiteTheme() {
  applyScheduledSiteTheme();

  const nextBoundary = Date.now() < QIXI_START ? QIXI_START : QIXI_END;
  const delay = nextBoundary - Date.now();
  if (delay > 0) window.setTimeout(applyScheduledSiteTheme, delay + 1000);

  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") applyScheduledSiteTheme();
  });
}
