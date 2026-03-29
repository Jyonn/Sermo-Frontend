import type { ReactNode } from "react";
import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { Navigate } from "react-router-dom";
import { configureAdminApiAuth } from "./api";
import { adminAuthStorage } from "./storage";
import type { SpaceAdminSession, SpaceDTO, SpaceAuthDTO } from "../types";

interface AdminAuthContextValue {
  session: SpaceAdminSession | null;
  setSession: (session: SpaceAdminSession | null) => void;
  login: (space: SpaceDTO, auth: SpaceAuthDTO) => void;
  patchSpace: (patch: Partial<SpaceDTO>) => void;
  logout: () => void;
}

const AdminAuthContext = createContext<AdminAuthContextValue | null>(null);

function toSession(space: SpaceDTO, auth: SpaceAuthDTO): SpaceAdminSession {
  return {
    accessToken: auth.auth,
    space,
  };
}

export function AdminAuthProvider({ children }: { children: ReactNode }) {
  const [session, setSessionState] = useState<SpaceAdminSession | null>(() => adminAuthStorage.get());

  useEffect(() => {
    adminAuthStorage.set(session);
  }, [session]);

  useEffect(() => {
    configureAdminApiAuth({
      getSession: () => adminAuthStorage.get(),
      setSession: (nextSession) => {
        adminAuthStorage.set(nextSession);
        setSessionState(nextSession);
      },
    });
  }, []);

  const value = useMemo<AdminAuthContextValue>(
    () => ({
      session,
      setSession: setSessionState,
      login(space, auth) {
        setSessionState(toSession(space, auth));
      },
      patchSpace(patch) {
        setSessionState((current) => {
          if (!current) return current;
          return {
            ...current,
            space: {
              ...current.space,
              ...patch,
            },
          };
        });
      },
      logout() {
        setSessionState(null);
      },
    }),
    [session]
  );

  return <AdminAuthContext.Provider value={value}>{children}</AdminAuthContext.Provider>;
}

export function useAdminAuth() {
  const context = useContext(AdminAuthContext);
  if (!context) {
    throw new Error("useAdminAuth must be used within AdminAuthProvider");
  }
  return context;
}

export function RequireAdminAuth({ children }: { children: JSX.Element }) {
  const { session } = useAdminAuth();
  if (!session) {
    return <Navigate replace to="/space?mode=login" />;
  }
  return children;
}
