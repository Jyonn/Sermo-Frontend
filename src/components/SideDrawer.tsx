import { useCallback, useEffect, useId, useRef, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { useBodyScrollLock } from "../lib/bodyLock";
import { useI18n } from "../lib/language";

const activeDrawerIds = new Set<string>();

interface SideDrawerProps {
  open: boolean;
  title: string;
  className?: string;
  titleAccessory?: ReactNode;
  headerAction?: ReactNode;
  actionLabel?: string;
  actionDisabled?: boolean;
  actionBusy?: boolean;
  onAction?: () => void;
  onClose: () => void;
  children: ReactNode;
  historyKey?: string;
}

export function SideDrawer({
  open,
  title,
  className = "",
  titleAccessory,
  headerAction,
  actionLabel,
  actionDisabled = false,
  actionBusy = false,
  onAction,
  onClose,
  children,
  historyKey,
}: SideDrawerProps) {
  const { t } = useI18n();
  const drawerId = useId();
  const registeredRef = useRef(false);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  useBodyScrollLock(open);

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
    if (path.length) url.searchParams.set("_drawer", path.join("/"));
    else url.searchParams.delete("_drawer");
    return `${url.pathname}${url.search}${url.hash}`;
  };

  const requestClose = useCallback(() => {
    const stack = getDrawerStack();
    if (registeredRef.current && stack[stack.length - 1] === drawerId) {
      window.history.back();
      return;
    }
    onCloseRef.current();
  }, [drawerId]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (open && !registeredRef.current) {
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
      const nextPath = [...activePath, historyKey?.trim() || title];
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
  }, [drawerId, historyKey, open, title]);

  useEffect(() => {
    if (!open) return;
    const onPopState = () => {
      if (!getDrawerStack().includes(drawerId)) {
        activeDrawerIds.delete(drawerId);
        registeredRef.current = false;
        onCloseRef.current();
      }
    };
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, [drawerId, open]);

  useEffect(() => {
    if (!open) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") requestClose();
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, requestClose]);

  if (!open || typeof document === "undefined") return null;

  return createPortal(
    <div className="drawer-backdrop" onClick={requestClose} role="presentation">
      <aside aria-modal="true" className={`side-drawer${className ? ` ${className}` : ""}`} onClick={(event) => event.stopPropagation()} role="dialog">
        <header className="drawer-topbar">
          <div className="chat-conversation-topbar drawer-topbar-shell is-title-only">
            <button className="chat-back-button drawer-back-button" onClick={requestClose} type="button" aria-label={t("common.back")}>
              <span className="material-symbols-outlined">arrow_back</span>
            </button>
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
