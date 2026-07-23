import type { ReactNode } from "react";
import { Link, useLocation } from "react-router-dom";
import { useAuth } from "../lib/auth";
import { useSpaceBrand } from "../lib/spaceBrand";
import { UserAvatar } from "./UserAvatar";

interface AppChromeProps {
  children: ReactNode;
  title: string;
  topbarAction?: ReactNode;
  topbarLeading?: ReactNode;
  hideTopbar?: boolean;
  hideMobileNav?: boolean;
  hidePageTitle?: boolean;
  topbarClassName?: string;
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
  topbarProgress,
  shellClassName,
  publicHeader = false,
  guestSpaceBrand,
}: AppChromeProps) {
  const { session } = useAuth();
  const sessionSpace = useSpaceBrand();
  const location = useLocation();

  const brandTarget = session ? "/app/chats" : "/entry";
  const hideGuestEntryLink = !session && (location.pathname === "/" || location.pathname === "/entry");
  const usePublicHeader = publicHeader || !session;
  const visibleSpaceBrand = guestSpaceBrand ?? (sessionSpace
    ? { name: sessionSpace.name, avatarUri: sessionSpace.official_user?.avatar_uri }
    : undefined);

  return (
    <>
      {!hideTopbar ? (
        <header className={`topbar${usePublicHeader ? " guest-topbar" : ""}${topbarClassName ? ` ${topbarClassName}` : ""}`}>
          <div className="topbar-leading">
            {topbarLeading ?? (
              <Link className={`brand${visibleSpaceBrand ? " guest-space-brand" : ""}`} to={brandTarget}>
                <div className="brand-mark sermo-brand-mark">
                  <img alt="" aria-hidden="true" className="brand-logo" src="/icons/sermo-512.png?v=3" />
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
            {!hideGuestEntryLink && !session && location.pathname !== "/entry" && !location.pathname.startsWith("/space/") ? (
              <Link className="ghost-chip" to="/entry">
                返回入口
              </Link>
            ) : null}
          </div>
          {topbarProgress !== null && topbarProgress !== undefined ? (
            <div className="topbar-progress" aria-label={`发送进度 ${Math.round(topbarProgress * 100)}%`} role="progressbar">
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
