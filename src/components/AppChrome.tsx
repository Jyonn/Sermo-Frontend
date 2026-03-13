import type { ReactNode } from "react";
import { Link, useLocation } from "react-router-dom";
import type { MobileNavKey } from "../types";

interface AppChromeProps {
  children: ReactNode;
  mobileNav?: MobileNavKey;
  footerNote?: string;
}

const layerRoutes = [
  { href: "/entry", label: "进入层" },
  { href: "/app/chats", label: "会话层" },
  { href: "/app/friends/requests", label: "关系层" },
  { href: "/app/settings/account", label: "设置层" },
] as const;

const mobileRoutes = [
  { key: "chats", href: "/app/chats", icon: "chat", label: "聊天" },
  { key: "friends", href: "/app/friends/requests", icon: "group", label: "好友" },
  { key: "space", href: "/app/space-users", icon: "public", label: "空间" },
  { key: "settings", href: "/app/settings/account", icon: "settings", label: "设置" },
] as const;

function isRouteActive(pathname: string, href: string) {
  if (href === "/entry") {
    return pathname === "/entry" || pathname.startsWith("/space/");
  }
  return pathname.startsWith(href);
}

export function AppChrome({ children, mobileNav, footerNote }: AppChromeProps) {
  const location = useLocation();

  return (
    <>
      <header className="topbar">
        <div className="brand">
          <div className="brand-mark">
            <span className="material-symbols-outlined">rocket_launch</span>
          </div>
          <div className="brand-copy">
            <h1>Sermo</h1>
            <p>Neon Street System</p>
          </div>
        </div>

        <div className="route-nav">
          {layerRoutes.map((route) => (
            <Link
              key={route.href}
              className={`route-chip ${isRouteActive(location.pathname, route.href) ? "active" : ""}`}
              to={route.href}
            >
              {route.label}
            </Link>
          ))}
        </div>

        <div className="utility-nav">
          <span className="ghost-chip mono">React + Vite</span>
          <Link className="ghost-chip" to="/app/chats">
            Open App
          </Link>
        </div>
      </header>

      <main className="shell page">
        {children}
        {mobileNav ? (
          <nav className="mobile-nav">
            {mobileRoutes.map((route) => (
              <Link key={route.key} className={`nav-button ${mobileNav === route.key ? "active" : ""}`} to={route.href}>
                <span className="material-symbols-outlined">{route.icon}</span>
                {route.label}
              </Link>
            ))}
          </nav>
        ) : null}
      </main>

      {footerNote ? <div className="footer-note">{footerNote}</div> : null}
    </>
  );
}
