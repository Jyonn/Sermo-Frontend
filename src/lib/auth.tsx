import type { ReactNode } from "react";
import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { api, configureApiAuth } from "./api";
import { buildJoinPath, getDetectedSpaceSlug } from "./spaceEntry";
import { authStorage } from "./storage";
import type { AuthSession, JoinResponseDTO } from "../types";

interface AuthContextValue {
  session: AuthSession | null;
  setSession: (session: AuthSession | null) => void;
  loginFromJoin: (payload: JoinResponseDTO) => void;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

function toSession(payload: JoinResponseDTO): AuthSession {
  return {
    accessToken: payload.auth.auth,
    refreshToken: payload.auth.refresh,
    user: payload.auth.data,
  };
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSessionState] = useState<AuthSession | null>(() => authStorage.get());

  useEffect(() => {
    authStorage.set(session);
  }, [session]);

  useEffect(() => {
    configureApiAuth({
      getSession: () => authStorage.get(),
      setSession: (nextSession) => {
        authStorage.set(nextSession);
        setSessionState(nextSession);
      },
    });
  }, []);

  useEffect(() => {
    if (!session) return;
    const timer = window.setInterval(() => {
      api.heartbeat().catch(() => undefined);
    }, 60_000);
    return () => window.clearInterval(timer);
  }, [session]);

  const value = useMemo<AuthContextValue>(
    () => ({
      session,
      setSession: setSessionState,
      loginFromJoin(payload) {
        setSessionState(toSession(payload));
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
    return <Navigate replace state={{ from: location.pathname }} to={detectedSlug ? buildJoinPath(detectedSlug) : "/space"} />;
  }

  return children;
}
