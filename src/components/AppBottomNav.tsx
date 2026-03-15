import { Link, matchPath, useLocation } from "react-router-dom";

const mobileRoutes = [
  { key: "chats", href: "/app/chats", icon: "chat", label: "聊天" },
  { key: "square", href: "/app/square", icon: "explore", label: "广场" },
  { key: "notifications", href: "/app/notifications", icon: "notifications", label: "通知" },
  { key: "menu", href: "/app/menu", icon: "menu", label: "菜单" },
] as const;

function activeKey(pathname: string) {
  if (pathname.startsWith("/app/chats")) return "chats";
  if (pathname.startsWith("/app/square")) return "square";
  if (pathname.startsWith("/app/notifications")) return "notifications";
  if (pathname.startsWith("/app/menu")) return "menu";
  return null;
}

export function AppBottomNav() {
  const location = useLocation();

  if (!location.pathname.startsWith("/app/")) return null;
  if (matchPath("/app/chats/:chatId", location.pathname)) return null;

  const current = activeKey(location.pathname);
  if (!current) return null;

  return (
    <nav className="mobile-nav app-mobile-nav">
      {mobileRoutes.map((route) => (
        <Link key={route.key} className={`nav-button ${current === route.key ? "active" : ""}`} to={route.href}>
          <span className="material-symbols-outlined nav-button-icon">{route.icon}</span>
          <span className="nav-button-label">{route.label}</span>
        </Link>
      ))}
    </nav>
  );
}
