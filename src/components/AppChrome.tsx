import type { ReactNode } from "react";
import { Link, useLocation } from "react-router-dom";
import { useAuth } from "../lib/auth";
import logoUrl from "../assets/logo.svg";

interface AppChromeProps {
  children: ReactNode;
  title: string;
  topbarAction?: ReactNode;
  topbarLeading?: ReactNode;
  hideTopbar?: boolean;
  hideMobileNav?: boolean;
  hidePageTitle?: boolean;
  topbarClassName?: string;
  shellClassName?: string;
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
  shellClassName,
}: AppChromeProps) {
  const { session } = useAuth();
  const location = useLocation();

  const brandTarget = session ? "/app/chats" : "/entry";
  const hideGuestEntryLink = !session && (location.pathname === "/" || location.pathname === "/entry");

  return (
    <>
      {!hideTopbar ? (
        <header className={`topbar${topbarClassName ? ` ${topbarClassName}` : ""}`}>
          <div className="topbar-leading">
            {topbarLeading ?? (
              <Link className="brand" to={brandTarget}>
                <div className="brand-mark">
                  <span
                    aria-hidden="true"
                    className="brand-logo"
                    style={{
                      WebkitMaskImage: `url(${logoUrl})`,
                      maskImage: `url(${logoUrl})`,
                    }}
                  />
                </div>
                <div className="brand-copy">
                  <h1>Sermo</h1>
                  <p>空间 IM</p>
                </div>
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
        </header>
      ) : null}

      <main className={`shell page ${hideTopbar ? "shell-no-topbar" : ""} ${hideMobileNav ? "shell-no-mobile-nav" : ""} ${shellClassName ?? ""}`.trim()}>
        {children}
      </main>
    </>
  );
}
