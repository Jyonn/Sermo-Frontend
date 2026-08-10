import type { ReactNode } from "react";
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { GestureUnlockScreen } from "../components/GestureLock";
import { ApiError, api, configureApiAuth, refreshAuthSession } from "./api";
import {
  clearGestureUnlock,
  cacheGestureLockPreference,
  getGestureLastActivity,
  getGestureLockAfterMs,
  getGestureLockScope,
  isGestureUnlocked,
  isGestureLockPreferenceEnabled,
  listenGestureLockPreferenceUpdated,
  markGestureActivity,
  markGestureLocked,
  readCachedGestureLockPreference,
} from "./gestureLock";
import { getDetectedSpaceSlug } from "./spaceEntry";
import { rememberRecentSpace } from "./recentSpaces";
import { authStorage } from "./storage";
import type { AuthSession, GestureLockPreferenceDTO, JoinResponseDTO } from "../types";
import { i18n } from "./i18n";

interface AuthContextValue {
  ready: boolean;
  session: AuthSession | null;
  setSession: (session: AuthSession | null) => void;
  patchSessionUser: (patch: Partial<AuthSession["user"]>) => void;
  loginFromJoin: (payload: JoinResponseDTO) => void;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

configureApiAuth({
  getSession: () => authStorage.get(),
  setSession: (nextSession) => {
    authStorage.set(nextSession);
  },
});

function toSession(payload: JoinResponseDTO): AuthSession {
  return {
    accessToken: payload.auth.auth,
    refreshToken: payload.auth.refresh,
    user: payload.auth.data,
  };
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSessionState] = useState<AuthSession | null>(() => authStorage.get());
  const [ready, setReady] = useState(false);
  const heartbeatInFlightRef = useRef(false);

  configureApiAuth({
    getSession: () => authStorage.get(),
    setSession: (nextSession) => {
      authStorage.set(nextSession);
      setSessionState(nextSession);
    },
  });

  useEffect(() => {
    authStorage.set(session);
  }, [session]);

  const setSession = useCallback((nextSession: AuthSession | null) => {
    authStorage.set(nextSession);
    setSessionState(nextSession);
  }, []);

  const patchSessionUser = useCallback((patch: Partial<AuthSession["user"]>) => {
    setSessionState((current) => {
      if (!current) return current;
      const entries = Object.entries(patch) as Array<[keyof AuthSession["user"], AuthSession["user"][keyof AuthSession["user"]]]>;
      if (entries.every(([key, value]) => current.user[key] === value)) return current;
      const nextSession = {
        ...current,
        user: {
          ...current.user,
          ...patch,
        },
      };
      authStorage.set(nextSession);
      return nextSession;
    });
  }, []);

  const loginFromJoin = useCallback((payload: JoinResponseDTO) => {
    rememberRecentSpace(payload.space);
    const nextSession = toSession(payload);
    authStorage.set(nextSession);
    setSessionState(nextSession);
    setReady(true);
  }, []);

  const logout = useCallback(async () => {
    const current = authStorage.get();
    if (current?.refreshToken) {
      try {
        await api.logout(current.refreshToken);
      } catch {
        // Best-effort logout; local cleanup still proceeds.
      }
    }
    authStorage.set(null);
    setSessionState(null);
    setReady(true);
  }, []);

  useEffect(() => {
    let cancelled = false;
    const storedSession = authStorage.get();

    if (!storedSession?.refreshToken) {
      setReady(true);
      return;
    }

    refreshAuthSession(storedSession)
      .then((nextSession) => {
        if (cancelled) return;
        authStorage.set(nextSession);
        setSessionState(nextSession);
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        if (error instanceof ApiError && error.status === 401) {
          const latestSession = authStorage.get();
          if (latestSession?.refreshToken !== storedSession.refreshToken) {
            setSessionState(latestSession);
            return;
          }
          authStorage.set(null);
          setSessionState(null);
          return;
        }
        setSessionState(storedSession);
      })
      .finally(() => {
        if (cancelled) return;
        setReady(true);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!ready || !session) return;
    const timer = window.setInterval(() => {
      if (heartbeatInFlightRef.current) return;
      heartbeatInFlightRef.current = true;
      api
        .heartbeat()
        .catch(() => undefined)
        .finally(() => {
          heartbeatInFlightRef.current = false;
        });
    }, 60_000);
    return () => {
      heartbeatInFlightRef.current = false;
      window.clearInterval(timer);
    };
  }, [ready, session?.accessToken]);

  const value = useMemo<AuthContextValue>(
    () => ({
      ready,
      session,
      setSession,
      patchSessionUser,
      loginFromJoin,
      logout,
    }),
    [loginFromJoin, logout, patchSessionUser, ready, session, setSession]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return context;
}

export function RequireAuth({ children }: { children: JSX.Element }) {
  const { ready, session, logout } = useAuth();
  const location = useLocation();
  const gestureScope = getGestureLockScope(session);
  const initialGestureCache = readCachedGestureLockPreference(gestureScope);
  const [gestureUnlocked, setGestureUnlocked] = useState(() => isGestureUnlocked(gestureScope));
  const [gesturePreference, setGesturePreference] = useState<GestureLockPreferenceDTO | null>(initialGestureCache.preference);
  const [gesturePreferenceReady, setGesturePreferenceReady] = useState(initialGestureCache.found || gestureUnlocked);

  useEffect(() => {
    setGestureUnlocked(isGestureUnlocked(gestureScope));
  }, [gestureScope, session?.accessToken]);

  useEffect(() => {
    if (!session) {
      setGesturePreference(null);
      setGesturePreferenceReady(true);
      return;
    }

    let cancelled = false;
    const cached = readCachedGestureLockPreference(gestureScope);
    setGesturePreference(cached.preference);
    setGesturePreferenceReady(cached.found || isGestureUnlocked(gestureScope));
    const loadPreference = (nextPreference?: GestureLockPreferenceDTO) => {
      if (nextPreference) {
        cacheGestureLockPreference(gestureScope, nextPreference);
        setGesturePreference(nextPreference);
        setGesturePreferenceReady(true);
        return;
      }
      setGesturePreferenceReady(false);
      api
        .getGestureLockPrefs()
        .then((preference) => {
          if (cancelled) return;
          cacheGestureLockPreference(gestureScope, preference);
          setGesturePreference(preference);
        })
        .catch(() => {
          if (cancelled) return;
          if (!cached.found) setGesturePreference(null);
        })
        .finally(() => {
          if (cancelled) return;
          setGesturePreferenceReady(true);
        });
    };

    loadPreference();
    const cleanupPreferenceListener = listenGestureLockPreferenceUpdated(loadPreference);

    return () => {
      cancelled = true;
      cleanupPreferenceListener();
    };
  }, [gestureScope, session?.accessToken]);

  useEffect(() => {
    if (!gestureScope || !gestureUnlocked || !isGestureLockPreferenceEnabled(gesturePreference)) return;

    let timer: number | undefined;
    const listenerOptions: AddEventListenerOptions = { capture: true, passive: true };

    const lock = () => {
      if (timer) window.clearTimeout(timer);
      markGestureLocked(gestureScope);
      setGestureUnlocked(false);
    };

    const schedule = () => {
      if (timer) window.clearTimeout(timer);
      const timeoutMs = getGestureLockAfterMs(gesturePreference);
      const lastActivity = getGestureLastActivity(gestureScope) || Date.now();
      const remaining = timeoutMs - (Date.now() - lastActivity);
      timer = window.setTimeout(() => {
        const latestActivity = getGestureLastActivity(gestureScope) || lastActivity;
        if (Date.now() - latestActivity >= timeoutMs) {
          lock();
          return;
        }
        schedule();
      }, Math.max(250, remaining));
    };

    const recordActivity = () => {
      markGestureActivity(gestureScope);
      schedule();
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState !== "visible") return;
      const timeoutMs = getGestureLockAfterMs(gesturePreference);
      const lastActivity = getGestureLastActivity(gestureScope);
      if (lastActivity && Date.now() - lastActivity >= timeoutMs) {
        lock();
        return;
      }
      recordActivity();
    };

    if (!getGestureLastActivity(gestureScope)) markGestureActivity(gestureScope);
    schedule();

    const events = ["pointerdown", "keydown", "wheel", "scroll", "touchstart"];
    events.forEach((eventName) => window.addEventListener(eventName, recordActivity, listenerOptions));
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      if (timer) window.clearTimeout(timer);
      events.forEach((eventName) => window.removeEventListener(eventName, recordActivity, listenerOptions));
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [gesturePreference, gestureScope, gestureUnlocked, session?.accessToken]);

  useEffect(() => {
    if (!gestureScope || gestureUnlocked || !isGestureLockPreferenceEnabled(gesturePreference)) return;
    markGestureLocked(gestureScope);
  }, [gesturePreference, gestureScope, gestureUnlocked]);

  if (!ready && !session) {
    return (
      <main className="auth-restore-screen">
        <div className="auth-restore-inline" role="status">
          <span className="auth-restore-spinner" aria-hidden="true" />
          <span>{i18n.t("auth.restoring")}</span>
        </div>
      </main>
    );
  }

  if (!session) {
    const detectedSlug = getDetectedSpaceSlug();
    return <Navigate replace state={{ from: location.pathname }} to={detectedSlug ? "/" : "/space"} />;
  }

  if (!gesturePreferenceReady) {
    return (
      <main className="auth-restore-screen">
        <div className="auth-restore-inline" role="status">
          <span className="auth-restore-spinner" aria-hidden="true" />
          <span>{i18n.t("auth.restoring")}</span>
        </div>
      </main>
    );
  }

  const activeGesturePreference = isGestureLockPreferenceEnabled(gesturePreference) ? gesturePreference : null;
  if (gestureScope && activeGesturePreference && !gestureUnlocked) {
    return (
      <GestureUnlockScreen
        scope={gestureScope}
        preference={activeGesturePreference}
        userName={session.user.name}
        onUnlocked={() => setGestureUnlocked(true)}
        onResetAndLogout={() => {
          clearGestureUnlock(gestureScope);
          void logout();
        }}
      />
    );
  }

  return (
    <>
      {children}
      {!ready ? (
        <div className="session-refresh-indicator" aria-label={i18n.t("auth.restoring")} role="status">
          <span />
        </div>
      ) : null}
    </>
  );
}
