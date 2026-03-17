import type { ReactNode } from "react";
import { Link, useLocation } from "react-router-dom";
import { useAuth } from "../lib/auth";

interface AppChromeProps {
  children: ReactNode;
  title: string;
  topbarAction?: ReactNode;
  topbarLeading?: ReactNode;
  hideTopbar?: boolean;
  hideMobileNav?: boolean;
  hidePageTitle?: boolean;
  topbarClassName?: string;
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
}: AppChromeProps) {
  const { session } = useAuth();
  const location = useLocation();

  const brandTarget = session ? "/app/chats" : "/entry";

  return (
    <>
      {!hideTopbar ? (
        <header className={`topbar${topbarClassName ? ` ${topbarClassName}` : ""}`}>
          <div className="topbar-leading">
            {topbarLeading ?? (
              <Link className="brand" to={brandTarget}>
                <div className="brand-mark">
                  <span className="material-symbols-outlined">rocket_launch</span>
                </div>
                <div className="brand-copy">
                  <h1>Sermo</h1>
                  <p>Space IM</p>
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
            {!session && location.pathname !== "/entry" && !location.pathname.startsWith("/space/") ? (
              <Link className="ghost-chip" to="/entry">
                返回入口
              </Link>
            ) : null}
          </div>
        </header>
      ) : null}

      <main className={`shell page ${hideTopbar ? "shell-no-topbar" : ""} ${hideMobileNav ? "shell-no-mobile-nav" : ""}`}>
        {children}
      </main>
    </>
  );
}
