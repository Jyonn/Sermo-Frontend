import React, { createContext, useCallback, useContext, useMemo, useState } from "react"
import { storage, type StoredAuth } from "./storage"

export type HostSnapshot = {
  name?: string
  subdomain?: string
}

type AuthContextValue = {
  auth: StoredAuth | null
  subdomain: string | null
  host: HostSnapshot | null
  setAuthState: (auth: StoredAuth | null) => void
  setSubdomain: (subdomain: string | null) => void
  setHost: (host: HostSnapshot | null) => void
  logout: () => void
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined)

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [auth, setAuth] = useState<StoredAuth | null>(() => storage.getAuth())
  const [subdomain, setSubdomainState] = useState<string | null>(() => storage.getSubdomain())
  const [host, setHostState] = useState<HostSnapshot | null>(() => storage.getHost())

  const setAuthState = useCallback((next: StoredAuth | null) => {
    setAuth(next)
    if (next) {
      storage.setAuth(next)
    } else {
      storage.clearAuth()
    }
  }, [])

  const setSubdomain = useCallback((next: string | null) => {
    setSubdomainState(next)
    if (next) {
      storage.setSubdomain(next)
    } else {
      storage.clearSubdomain()
    }
  }, [])

  const setHost = useCallback((next: HostSnapshot | null) => {
    setHostState(next)
    if (next) {
      storage.setHost(next)
    } else {
      storage.clearHost()
    }
  }, [])

  const logout = useCallback(() => {
    setAuthState(null)
  }, [setAuthState])

  const value = useMemo(
    () => ({ auth, subdomain, host, setAuthState, setSubdomain, setHost, logout }),
    [auth, subdomain, host, setAuthState, setSubdomain, setHost, logout]
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export const useAuth = () => {
  const ctx = useContext(AuthContext)
  if (!ctx) {
    throw new Error("useAuth must be used within AuthProvider")
  }
  return ctx
}
