import type { ReactNode } from "react";
import { createContext, useContext, useEffect, useMemo, useRef, useState } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { api, configureApiAuth } from "./api";
import { getDetectedSpaceSlug } from "./spaceEntry";
import { rememberRecentSpace } from "./recentSpaces";
import { authStorage } from "./storage";
import type { AuthSession, JoinResponseDTO } from "../types";

interface AuthContextValue {
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
    if (!session) return;
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
      },
    }),
    [session]
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
  const { session } = useAuth();
  const location = useLocation();

  if (!session) {
    const detectedSlug = getDetectedSpaceSlug();
    return <Navigate replace state={{ from: location.pathname }} to={detectedSlug ? "/" : "/space"} />;
  }

  return children;
}
