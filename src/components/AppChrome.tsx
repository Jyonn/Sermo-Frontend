import type { CSSProperties, ReactNode } from "react";
import { Link, useLocation } from "react-router-dom";
import { useAuth } from "../lib/auth";
import { useSpaceBrand } from "../lib/spaceBrand";
import { UserAvatar } from "./UserAvatar";
import { useI18n } from "../lib/language";
import { useTheme } from "../lib/theme";
import { useSpaceFeatures } from "../lib/spaceFeatures";

interface AppChromeProps {
  children: ReactNode;
  title: string;
  topbarAction?: ReactNode;
  topbarLeading?: ReactNode;
  hideTopbar?: boolean;
  hideMobileNav?: boolean;
  hidePageTitle?: boolean;
  topbarClassName?: string;
  topbarStyle?: CSSProperties;
  topbarProgress?: number | null;
  shellClassName?: string;
  publicHeader?: boolean;
  guestSpaceBrand?: {
    name: string;
    avatarUri?: string;
  };
}

export function AppChrome({
  children,
  title,
  topbarAction,
  topbarLeading,
  hideTopbar = false,
  hideMobileNav = false,
  hidePageTitle = false,
  topbarClassName,
  topbarStyle,
  topbarProgress,
  shellClassName,
  publicHeader = false,
  guestSpaceBrand,
}: AppChromeProps) {
  const { session } = useAuth();
  const sessionSpace = useSpaceBrand();
  const location = useLocation();
  const { t, language, setPreference: setLanguagePreference } = useI18n();
  const { resolvedTheme, setPreference: setThemePreference } = useTheme();
  const features = useSpaceFeatures();

  const brandTarget = session ? (!features.ready ? "/app" : features.chatEnabled ? "/app/chats" : "/app/square") : "/entry";
  const hideGuestEntryLink = !session && (location.pathname === "/" || location.pathname === "/entry");
  const usePublicHeader = publicHeader || !session;
  const visibleSpaceBrand = guestSpaceBrand ?? (sessionSpace
    ? { name: sessionSpace.name, avatarUri: sessionSpace.official_user?.avatar_uri }
    : undefined);

  return (
    <>
      {!hideTopbar ? (
        <header
          className={`topbar${usePublicHeader ? " guest-topbar" : ""}${topbarClassName ? ` ${topbarClassName}` : ""}`}
          style={topbarStyle}
        >
          <div className="topbar-leading">
            {topbarLeading ?? (
              <Link className={`brand${visibleSpaceBrand ? " guest-space-brand" : ""}`} to={brandTarget}>
                <div className="brand-mark sermo-brand-mark">
                  <img alt="" aria-hidden="true" className="brand-logo" src="/icons/sermo-512.png?v=4" />
                </div>
                {visibleSpaceBrand ? (
                  <>
                    <span className="brand-collaboration-mark" aria-hidden="true">×</span>
                    <UserAvatar className="brand-space-avatar" name={visibleSpaceBrand.name} uri={visibleSpaceBrand.avatarUri} />
                  </>
                ) : null}
              </Link>
            )}
          </div>

          {!hidePageTitle ? (
            <div className="page-head">
              <p className="topbar-title">{title}</p>
            </div>
          ) : (
            <div className="page-head page-head-collapsed" />
          )}

          <div className="topbar-actions">
            {topbarAction}
            {!session ? (
              <div className="guest-appearance-actions" aria-label={t("guest.appearanceAndLanguage")}>
                <button
                  aria-label={resolvedTheme === "dark" ? t("guest.useLightTheme") : t("guest.useDarkTheme")}
                  className="guest-topbar-tool"
                  onClick={() => setThemePreference(resolvedTheme === "dark" ? "light" : "dark")}
                  title={resolvedTheme === "dark" ? t("guest.useLightTheme") : t("guest.useDarkTheme")}
                  type="button"
                >
                  <span className="material-symbols-outlined">{resolvedTheme === "dark" ? "light_mode" : "dark_mode"}</span>
                </button>
                <button
                  aria-label={language === "zh-CN" ? t("guest.switchToEnglish") : t("guest.switchToChinese")}
                  className="guest-topbar-tool guest-language-tool"
                  onClick={() => void setLanguagePreference(language === "zh-CN" ? "en" : "zh-CN")}
                  title={language === "zh-CN" ? t("guest.switchToEnglish") : t("guest.switchToChinese")}
                  type="button"
                >
                  {language === "zh-CN" ? "EN" : "中"}
                </button>
              </div>
            ) : null}
            {!hideGuestEntryLink && !session && location.pathname !== "/entry" && !location.pathname.startsWith("/space/") ? (
              <Link className="ghost-chip" to="/entry">
                {t("nav.returnEntry")}
              </Link>
            ) : null}
          </div>
          {topbarProgress !== null && topbarProgress !== undefined ? (
            <div className="topbar-progress" aria-label={t("app.sendProgress", { progress: Math.round(topbarProgress * 100) })} role="progressbar">
              <span style={{ transform: `scaleX(${Math.max(0.02, Math.min(1, topbarProgress))})` }} />
            </div>
          ) : null}
        </header>
      ) : null}

      <main className={`shell page ${hideTopbar ? "shell-no-topbar" : ""} ${hideMobileNav ? "shell-no-mobile-nav" : ""} ${shellClassName ?? ""}`.trim()}>
        {children}
      </main>
    </>
  );
}
