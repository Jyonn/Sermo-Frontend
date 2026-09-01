import { useCallback, useEffect, useId, useMemo, useRef, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { useLocation } from "react-router-dom";
import { useBodyScrollLock } from "../lib/bodyLock";
import { useI18n } from "../lib/language";

const activeDrawerIds = new Set<string>();

interface SideDrawerProps {
  open: boolean;
  title: string;
  className?: string;
  backdropClassName?: string;
  titleLeading?: ReactNode;
  titleAccessory?: ReactNode;
  headerAction?: ReactNode;
  actionLabel?: string;
  actionDisabled?: boolean;
  actionBusy?: boolean;
  onAction?: () => void;
  onClose: () => void;
  children: ReactNode;
  historyKey?: string;
  historyMode?: "stack" | "route";
  onRouteOpen?: () => void;
}

const DRAWER_QUERY_KEY = "panel";

export function drawerPathFromSearch(search: string) {
  const params = new URLSearchParams(search);
  const value = params.get(DRAWER_QUERY_KEY) || "";
  return value.split("/").map((item) => item.trim()).filter(Boolean);
}

function normalizeDrawerKey(value: string | undefined) {
  const normalized = (value || "drawer")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return normalized || "drawer";
}

export function SideDrawer({
  open,
  title,
  className = "",
  backdropClassName = "",
  titleLeading,
  titleAccessory,
  headerAction,
  actionLabel,
  actionDisabled = false,
  actionBusy = false,
  onAction,
  onClose,
  children,
  historyKey,
  historyMode = "stack",
  onRouteOpen,
}: SideDrawerProps) {
  const { t } = useI18n();
  const location = useLocation();
  const drawerId = useId();
  const routeKey = useMemo(() => normalizeDrawerKey(historyKey), [historyKey]);
  const routePath = useMemo(() => drawerPathFromSearch(location.search), [location.search]);
  const routeIndex = routePath.findIndex((item) => item === routeKey || item === title);
  const routeRequested = historyMode === "stack" && routeIndex >= 0;
  const visible = open || routeRequested;
  const registeredRef = useRef(false);
  const onCloseRef = useRef(onClose);
  const onRouteOpenRef = useRef(onRouteOpen);
  onCloseRef.current = onClose;
  onRouteOpenRef.current = onRouteOpen;
  useBodyScrollLock(visible);

  const getDrawerStack = () => {
    const value = window.history.state?.sermoDrawerStack;
    return Array.isArray(value) ? (value as string[]) : [];
  };

  const getDrawerPath = () => {
    const value = window.history.state?.sermoDrawerPath;
    return Array.isArray(value) ? (value as string[]) : [];
  };

  const urlForDrawerPath = (path: string[]) => {
    const url = new URL(window.location.href);
    if (path.length) url.searchParams.set(DRAWER_QUERY_KEY, path.join("/"));
    else url.searchParams.delete(DRAWER_QUERY_KEY);
    return `${url.pathname}${url.search}${url.hash}`;
  };

  const requestClose = useCallback(() => {
    if (historyMode === "route") {
      onCloseRef.current();
      return;
    }
    if (routeRequested && !registeredRef.current) {
      const nextPath = routePath.slice(0, routeIndex);
      window.history.replaceState(
        { ...window.history.state, sermoDrawerStack: [], sermoDrawerPath: nextPath },
        "",
        urlForDrawerPath(nextPath)
      );
      window.dispatchEvent(new PopStateEvent("popstate", { state: window.history.state }));
      onCloseRef.current();
      return;
    }
    const stack = getDrawerStack();
    if (registeredRef.current && stack[stack.length - 1] === drawerId) {
      window.history.back();
      return;
    }
    onCloseRef.current();
  }, [drawerId, historyMode, routeIndex, routePath, routeRequested]);

  useEffect(() => {
    if (!routeRequested) return;
    onRouteOpenRef.current?.();
    if (routePath[routeIndex] === routeKey) return;
    const canonicalPath = [...routePath];
    canonicalPath[routeIndex] = routeKey;
    window.history.replaceState(
      { ...window.history.state, sermoDrawerPath: canonicalPath },
      "",
      urlForDrawerPath(canonicalPath)
    );
  }, [location.search, routeIndex, routeKey, routePath, routeRequested]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (historyMode === "route") return;
    if (open && !routeRequested && !registeredRef.current) {
      const storedStack = getDrawerStack();
      const activeStack = storedStack.filter((item) => activeDrawerIds.has(item));
      const storedPath = getDrawerPath();
      const activePath = storedPath.slice(0, activeStack.length);
      if (activeStack.length !== storedStack.length) {
        window.history.replaceState(
          { ...window.history.state, sermoDrawerStack: activeStack, sermoDrawerPath: activePath },
          "",
          urlForDrawerPath(activePath)
        );
      }
      const nextStack = [...activeStack, drawerId];
      const nextPath = [...activePath, routeKey];
      window.history.pushState(
        { ...window.history.state, sermoDrawerStack: nextStack, sermoDrawerPath: nextPath },
        "",
        urlForDrawerPath(nextPath)
      );
      activeDrawerIds.add(drawerId);
      registeredRef.current = true;
      return;
    }
    if (!open && registeredRef.current) {
      const stack = getDrawerStack();
      if (stack[stack.length - 1] === drawerId) {
        activeDrawerIds.delete(drawerId);
        registeredRef.current = false;
        window.history.back();
        return;
      }
      if (stack.includes(drawerId)) {
        window.addEventListener(
          "popstate",
          () => {
            const nextStack = getDrawerStack();
            if (nextStack[nextStack.length - 1] === drawerId) window.history.back();
            activeDrawerIds.delete(drawerId);
            registeredRef.current = false;
          },
          { once: true }
        );
        return;
      }
      activeDrawerIds.delete(drawerId);
      registeredRef.current = false;
    }
  }, [drawerId, historyMode, open, routeKey, routeRequested]);

  useEffect(() => {
    if (!visible || historyMode === "route") return;
    const onPopState = () => {
      if (!getDrawerStack().includes(drawerId)) {
        activeDrawerIds.delete(drawerId);
        registeredRef.current = false;
        onCloseRef.current();
      }
    };
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, [drawerId, historyMode, visible]);

  useEffect(() => {
    if (!visible) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") requestClose();
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [requestClose, visible]);

  if (!visible || typeof document === "undefined") return null;

  return createPortal(
    <div className={`drawer-backdrop${backdropClassName ? ` ${backdropClassName}` : ""}`} onClick={requestClose} role="presentation">
      <aside aria-modal="true" className={`side-drawer${className ? ` ${className}` : ""}`} onClick={(event) => event.stopPropagation()} role="dialog">
        <header className="drawer-topbar">
          <div className="chat-conversation-topbar drawer-topbar-shell is-title-only">
            <button className="chat-back-button drawer-back-button" onClick={requestClose} type="button" aria-label={t("common.back")}>
              <span className="material-symbols-outlined">arrow_back</span>
            </button>
            {titleLeading ? <div className="drawer-title-leading">{titleLeading}</div> : null}
            <div className="drawer-topbar-copy">
              <div className="drawer-topbar-meta">
                <div className="drawer-title-row">
                  <h3 className="drawer-title">{title}</h3>
                  {titleAccessory}
                </div>
              </div>
            </div>
            {headerAction}
            {actionLabel && onAction ? (
              <button
                className="drawer-topbar-action"
                disabled={actionDisabled || actionBusy}
                onClick={onAction}
                type="button"
              >
                {actionBusy ? t("common.processing") : actionLabel}
              </button>
            ) : null}
          </div>
        </header>
        <div className="drawer-body">{children}</div>
      </aside>
    </div>,
    document.body
  );
}
