import type { ReactNode } from "react";
import { createContext, useContext, useEffect, useMemo, useRef, useState } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { FeedbackState } from "../components/FeedbackState";
import { GestureDecoyChatScreen, GestureUnlockScreen } from "../components/GestureLock";
import { ApiError, api, configureApiAuth, refreshAuthSession } from "./api";
import {
  clearGestureUnlock,
  getGestureLastActivity,
  getGestureLockAfterMs,
  getGestureLockScope,
  isGestureUnlocked,
  isGestureDecoyActive,
  isGestureLockPreferenceEnabled,
  listenGestureLockPreferenceUpdated,
  markGestureActivity,
  markGestureLocked,
} from "./gestureLock";
import { getDetectedSpaceSlug } from "./spaceEntry";
import { rememberRecentSpace } from "./recentSpaces";
import { authStorage } from "./storage";
import type { AuthSession, GestureLockPreferenceDTO, JoinResponseDTO } from "../types";

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
  }, [session]);

  const value = useMemo<AuthContextValue>(
    () => ({
      ready,
      session,
      setSession(nextSession) {
        authStorage.set(nextSession);
        setSessionState(nextSession);
      },
      patchSessionUser(patch) {
        setSessionState((current) => {
          if (!current) return current;
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
      },
      loginFromJoin(payload) {
        rememberRecentSpace(payload.space);
        const nextSession = toSession(payload);
        authStorage.set(nextSession);
        setSessionState(nextSession);
        setReady(true);
      },
      async logout() {
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
      },
    }),
    [ready, session]
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
  const [gestureUnlocked, setGestureUnlocked] = useState(() => isGestureUnlocked(gestureScope));
  const [gestureDecoyActive, setGestureDecoyActive] = useState(() => isGestureDecoyActive(gestureScope));
  const [gesturePreference, setGesturePreference] = useState<GestureLockPreferenceDTO | null>(null);
  const [gesturePreferenceReady, setGesturePreferenceReady] = useState(false);

  useEffect(() => {
    setGestureUnlocked(isGestureUnlocked(gestureScope));
    setGestureDecoyActive(isGestureDecoyActive(gestureScope));
  }, [gestureScope, session?.accessToken]);

  useEffect(() => {
    if (!ready || !session) {
      setGesturePreference(null);
      setGesturePreferenceReady(true);
      return;
    }

    let cancelled = false;
    const loadPreference = (nextPreference?: GestureLockPreferenceDTO) => {
      if (nextPreference) {
        setGesturePreference(nextPreference);
        setGesturePreferenceReady(true);
        return;
      }
      setGesturePreferenceReady(false);
      api
        .getGestureLockPrefs()
        .then((preference) => {
          if (cancelled) return;
          setGesturePreference(preference);
        })
        .catch(() => {
          if (cancelled) return;
          setGesturePreference(null);
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
  }, [ready, session?.accessToken]);

  useEffect(() => {
    if (!gestureScope || !gestureUnlocked || !isGestureLockPreferenceEnabled(gesturePreference)) return;

    let timer: number | undefined;
    const listenerOptions: AddEventListenerOptions = { capture: true, passive: true };

    const lock = () => {
      if (timer) window.clearTimeout(timer);
      markGestureLocked(gestureScope);
      setGestureUnlocked(false);
      setGestureDecoyActive(false);
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
    if (!gestureScope || gestureUnlocked || gestureDecoyActive || !isGestureLockPreferenceEnabled(gesturePreference)) return;
    markGestureLocked(gestureScope);
  }, [gestureDecoyActive, gesturePreference, gestureScope, gestureUnlocked]);

  if (!ready || (session && !gesturePreferenceReady)) {
    return (
    <main className="auth-restore-screen">
        <div className="auth-restore-orb" aria-hidden="true" />
        <FeedbackState title="正在恢复登录" description="会话核验中" tone="loading" />
      </main>
    );
  }

  if (!session) {
    const detectedSlug = getDetectedSpaceSlug();
    return <Navigate replace state={{ from: location.pathname }} to={detectedSlug ? "/" : "/space"} />;
  }

  const activeGesturePreference = isGestureLockPreferenceEnabled(gesturePreference) ? gesturePreference : null;
  if (gestureScope && activeGesturePreference && gestureDecoyActive) {
    return <GestureDecoyChatScreen />;
  }

  if (gestureScope && activeGesturePreference && !gestureUnlocked) {
    return (
      <GestureUnlockScreen
        scope={gestureScope}
        preference={activeGesturePreference}
        userName={session.user.name}
        onUnlocked={() => setGestureUnlocked(true)}
        onDecoyUnlocked={() => {
          setGestureUnlocked(false);
          setGestureDecoyActive(true);
        }}
        onResetAndLogout={() => {
          clearGestureUnlock(gestureScope);
          void logout();
        }}
      />
    );
  }

  return children;
}
