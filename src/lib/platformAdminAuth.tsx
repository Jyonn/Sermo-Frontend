import { createContext, useContext, useState, type ReactNode } from "react";
import { configurePlatformAdminApiAuth } from "./api";
import { platformAdminAuthStorage } from "./storage";
import type { PlatformAdminSession } from "../types";

type ContextValue = {
  session: PlatformAdminSession | null;
  setSession: (session: PlatformAdminSession | null) => void;
  logout: () => void;
};

const Context = createContext<ContextValue | null>(null);

export function PlatformAdminAuthProvider({ children }: { children: ReactNode }) {
  const [session, setState] = useState<PlatformAdminSession | null>(() => platformAdminAuthStorage.get());
  const setSession = (next: PlatformAdminSession | null) => {
    platformAdminAuthStorage.set(next);
    setState(next);
  };
  configurePlatformAdminApiAuth({ getSession: () => platformAdminAuthStorage.get(), setSession });
  return <Context.Provider value={{ session, setSession, logout: () => setSession(null) }}>{children}</Context.Provider>;
}

export function usePlatformAdminAuth() {
  const value = useContext(Context);
  if (!value) throw new Error("usePlatformAdminAuth must be used within PlatformAdminAuthProvider");
  return value;
}
