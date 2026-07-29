import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App";
import "../styles.css";
import { AuthProvider } from "./lib/auth";
import { AdminAuthProvider } from "./lib/adminAuth";
import { restoreLastInstalledSpace, setupSpacePwaIdentity } from "./lib/pwaIdentity";
import { watchPwaUpdates } from "./lib/pwaUpdate";
import { LanguageProvider } from "./lib/language";
import { initializeTheme, ThemeProvider } from "./lib/theme";
import { getSpaceRouterBasename } from "./lib/spaceEntry";

restoreLastInstalledSpace();
void setupSpacePwaIdentity();
initializeTheme();
const routerBasename = getSpaceRouterBasename();

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <BrowserRouter basename={routerBasename}>
      <AdminAuthProvider>
        <AuthProvider>
          <ThemeProvider>
            <LanguageProvider>
              <App />
            </LanguageProvider>
          </ThemeProvider>
        </AuthProvider>
      </AdminAuthProvider>
    </BrowserRouter>
  </React.StrictMode>
);

if (import.meta.env.PROD && "serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    void navigator.serviceWorker.register("/sw.js", { scope: "/", updateViaCache: "none" }).then((registration) => {
      watchPwaUpdates(registration);
      const checkForUpdate = () => {
        void registration.update().catch(() => undefined);
      };
      checkForUpdate();
      window.setInterval(checkForUpdate, 3 * 60 * 1000);
    });
  });

  let refreshing = false;
  navigator.serviceWorker.addEventListener("controllerchange", () => {
    if (refreshing) return;
    refreshing = true;
    window.location.reload();
  });
}
