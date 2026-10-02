import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App";
import "../styles.css";
import "./styles/qixi-theme.css";
import "./styles/cloud-resources.css";
import { AuthProvider } from "./lib/auth";
import { AdminAuthProvider } from "./lib/adminAuth";
import { restoreLastInstalledSpace, setupSpacePwaIdentity } from "./lib/pwaIdentity";
import { checkForPwaUpdate } from "./lib/pwaUpdate";
import { LanguageProvider } from "./lib/language";
import { activateLanguage, getBrowserJoinLanguage } from "./lib/i18n";
import { initializeTheme, ThemeProvider } from "./lib/theme";
import { getSpaceRouterBasename } from "./lib/spaceEntry";
import { FeatureDiscoveryProvider } from "./lib/featureDiscovery";
import { PlatformAdminAuthProvider } from "./lib/platformAdminAuth";
import { initializeScheduledSiteTheme } from "./lib/siteTheme";
import { isPageActive } from "./lib/pageActivity";
import { MusicPlayerProvider } from "./lib/musicPlayer";

const PAGE_RELOAD_REASON_KEY = "sermo:diagnostics:reload-reason";
const navigationEntry = performance.getEntriesByType("navigation")[0] as PerformanceNavigationTiming | undefined;
const recordedReloadReason = window.sessionStorage.getItem(PAGE_RELOAD_REASON_KEY);
window.sessionStorage.removeItem(PAGE_RELOAD_REASON_KEY);
console.info("[sermo:page-lifecycle] app-start", {
  navigationType: navigationEntry?.type ?? "unknown",
  recordedReloadReason: recordedReloadReason ?? "none",
  visibilityState: document.visibilityState,
  serviceWorkerController: navigator.serviceWorker?.controller?.scriptURL ?? "none",
  timestamp: new Date().toISOString(),
});
window.addEventListener("pageshow", (event) => {
  console.info("[sermo:page-lifecycle] pageshow", {
    persisted: event.persisted,
    visibilityState: document.visibilityState,
    timestamp: new Date().toISOString(),
  });
});
window.addEventListener("pagehide", (event) => {
  console.info("[sermo:page-lifecycle] pagehide", {
    persisted: event.persisted,
    visibilityState: document.visibilityState,
    timestamp: new Date().toISOString(),
  });
});
document.addEventListener("visibilitychange", () => {
  console.info("[sermo:page-lifecycle] visibilitychange", {
    visibilityState: document.visibilityState,
    timestamp: new Date().toISOString(),
  });
});

restoreLastInstalledSpace();
void setupSpacePwaIdentity();
initializeTheme();
initializeScheduledSiteTheme();
const routerBasename = getSpaceRouterBasename();

function initializeMaterialSymbols(attempt = 0) {
  void document.fonts.load('24px "Material Symbols Outlined"').then((faces) => {
    if (faces.length) {
      document.documentElement.classList.add("material-symbols-ready");
      return;
    }
    if (attempt < 2) window.setTimeout(() => initializeMaterialSymbols(attempt + 1), 900 * (attempt + 1));
  }).catch(() => {
    if (attempt < 2) window.setTimeout(() => initializeMaterialSymbols(attempt + 1), 900 * (attempt + 1));
  });
}

initializeMaterialSymbols();

const zoomWindow = window as Window & { __sermoPageZoomController?: AbortController };
zoomWindow.__sermoPageZoomController?.abort();
const pageZoomController = new AbortController();
zoomWindow.__sermoPageZoomController = pageZoomController;
const preventGestureZoom = (event: Event) => event.preventDefault();
document.addEventListener("gesturestart", preventGestureZoom, { passive: false, signal: pageZoomController.signal });
document.addEventListener("gesturechange", preventGestureZoom, { passive: false, signal: pageZoomController.signal });
document.addEventListener("gestureend", preventGestureZoom, { passive: false, signal: pageZoomController.signal });
window.addEventListener("wheel", (event) => {
  if (event.ctrlKey) event.preventDefault();
}, { passive: false, signal: pageZoomController.signal });

async function renderApp() {
  await activateLanguage(getBrowserJoinLanguage()).catch(() => activateLanguage("en"));
  ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <BrowserRouter basename={routerBasename}>
      <AdminAuthProvider>
        <PlatformAdminAuthProvider><AuthProvider>
          <ThemeProvider>
            <LanguageProvider>
              <FeatureDiscoveryProvider><MusicPlayerProvider><App /></MusicPlayerProvider></FeatureDiscoveryProvider>
            </LanguageProvider>
          </ThemeProvider>
        </AuthProvider></PlatformAdminAuthProvider>
      </AdminAuthProvider>
    </BrowserRouter>
  </React.StrictMode>
  );
}

void renderApp();

if (import.meta.env.PROD) {
  window.addEventListener("load", () => {
    if ("serviceWorker" in navigator) {
      void navigator.serviceWorker.register("/sw.js", { scope: "/", updateViaCache: "none" }).catch((error: unknown) => {
        console.warn("[sermo:pwa-update] registration-failed", error);
      });
    }
    const checkForUpdate = () => {
      if (!isPageActive()) return;
      void checkForPwaUpdate();
    };
    checkForUpdate();
    const timer = window.setInterval(checkForUpdate, 3 * 60 * 1000);
    document.addEventListener("visibilitychange", checkForUpdate);
    window.addEventListener("beforeunload", () => {
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", checkForUpdate);
    }, { once: true });
  });
}
