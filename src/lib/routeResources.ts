type RouteResourceKey = "chats" | "square" | "notifications" | "menu" | "friends" | "space-users";

const routeLoaders = {
  chats: () => import("../pages/ChatsPage"),
  square: () => import("../pages/SquarePage"),
  notifications: () => import("../pages/NotificationsPage"),
  menu: () => import("../pages/MenuPage"),
  friends: () => import("../pages/FriendsPage"),
  "space-users": () => import("../pages/SpaceUsersPage"),
} satisfies Record<RouteResourceKey, () => Promise<unknown>>;

const pendingLoads = new Map<RouteResourceKey, Promise<unknown>>();

export function loadRouteResource(key: RouteResourceKey) {
  const existing = pendingLoads.get(key);
  if (existing) return existing;
  const pending = routeLoaders[key]().catch((error) => {
    pendingLoads.delete(key);
    throw error;
  });
  pendingLoads.set(key, pending);
  return pending;
}

export function preloadRouteResource(key: RouteResourceKey) {
  void loadRouteResource(key).catch(() => undefined);
}

export function preloadRouteForPath(pathname: string) {
  if (pathname.startsWith("/app/chats") || pathname.startsWith("/app/submissions")) return preloadRouteResource("chats");
  if (pathname.startsWith("/app/square")) return preloadRouteResource("square");
  if (pathname.startsWith("/app/notifications")) return preloadRouteResource("notifications");
  if (pathname.startsWith("/app/menu")) return preloadRouteResource("menu");
  if (pathname.startsWith("/app/friends")) return preloadRouteResource("friends");
  if (pathname.startsWith("/app/space-users")) return preloadRouteResource("space-users");
}

export const routeResources = routeLoaders;
