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
import { watchPwaUpdates } from "./lib/pwaUpdate";
import { LanguageProvider } from "./lib/language";
import { initializeTheme, ThemeProvider } from "./lib/theme";
import { getSpaceRouterBasename } from "./lib/spaceEntry";
import { FeatureDiscoveryProvider } from "./lib/featureDiscovery";
import { PlatformAdminAuthProvider } from "./lib/platformAdminAuth";
import { initializeScheduledSiteTheme } from "./lib/siteTheme";
import { isPageActive } from "./lib/pageActivity";

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

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <BrowserRouter basename={routerBasename}>
      <AdminAuthProvider>
        <PlatformAdminAuthProvider><AuthProvider>
          <ThemeProvider>
            <LanguageProvider>
              <FeatureDiscoveryProvider><App /></FeatureDiscoveryProvider>
            </LanguageProvider>
          </ThemeProvider>
        </AuthProvider></PlatformAdminAuthProvider>
      </AdminAuthProvider>
    </BrowserRouter>
  </React.StrictMode>
);

if (import.meta.env.PROD && "serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    void navigator.serviceWorker.register("/sw.js", { scope: "/", updateViaCache: "none" }).then((registration) => {
      watchPwaUpdates(registration);
      const checkForUpdate = () => {
        if (!isPageActive()) return;
        void registration.update().catch(() => undefined);
      };
      checkForUpdate();
      const timer = window.setInterval(checkForUpdate, 3 * 60 * 1000);
      const checkWhenVisible = () => {
        if (isPageActive()) checkForUpdate();
      };
      document.addEventListener("visibilitychange", checkWhenVisible);
      window.addEventListener("beforeunload", () => {
        window.clearInterval(timer);
        document.removeEventListener("visibilitychange", checkWhenVisible);
      }, { once: true });
    });
  });

  let refreshing = false;
  navigator.serviceWorker.addEventListener("controllerchange", () => {
    if (refreshing) return;
    refreshing = true;
    window.location.reload();
  });
}
