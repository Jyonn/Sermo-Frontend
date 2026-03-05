export type StoredAuth = {
  auth: string
  refresh: string
  role: "host" | "guest"
  user?: { name?: string; user_id?: number; subdomain?: string | null }
  subdomain?: string | null
}

export type RecentHost = {
  name: string
  subdomain: string
  lastUsedAt: number
}

export type NotificationPrefs = {
  email: boolean
  push: boolean
  bark: boolean
  frequency: "instant" | "daily" | "weekly"
}

export type HostProfileDraft = {
  name?: string
  description?: string
  email?: string
  phone?: string
  bark?: string
}

const AUTH_KEY = "sermo.auth"
const SUBDOMAIN_KEY = "sermo.subdomain"
const HOST_KEY = "sermo.host"
const RECENT_HOSTS_KEY = "sermo.recent-hosts"
const NOTIFICATION_KEY = "sermo.notifications"
const PROFILE_KEY = "sermo.profile"

export const storage = {
  getAuth(): StoredAuth | null {
    const raw = localStorage.getItem(AUTH_KEY)
    if (!raw) return null
    try {
      return JSON.parse(raw) as StoredAuth
    } catch {
      return null
    }
  },
  setAuth(auth: StoredAuth) {
    localStorage.setItem(AUTH_KEY, JSON.stringify(auth))
  },
  clearAuth() {
    localStorage.removeItem(AUTH_KEY)
  },
  getSubdomain(): string | null {
    return localStorage.getItem(SUBDOMAIN_KEY)
  },
  setSubdomain(subdomain: string) {
    localStorage.setItem(SUBDOMAIN_KEY, subdomain)
  },
  clearSubdomain() {
    localStorage.removeItem(SUBDOMAIN_KEY)
  },
  getHost(): { name?: string; subdomain?: string } | null {
    const raw = localStorage.getItem(HOST_KEY)
    if (!raw) return null
    try {
      return JSON.parse(raw)
    } catch {
      return null
    }
  },
  setHost(host: { name?: string; subdomain?: string }) {
    localStorage.setItem(HOST_KEY, JSON.stringify(host))
  },
  clearHost() {
    localStorage.removeItem(HOST_KEY)
  },
  getRecentHosts(): RecentHost[] {
    const raw = localStorage.getItem(RECENT_HOSTS_KEY)
    if (!raw) return []
    try {
      return JSON.parse(raw) as RecentHost[]
    } catch {
      return []
    }
  },
  setRecentHosts(hosts: RecentHost[]) {
    localStorage.setItem(RECENT_HOSTS_KEY, JSON.stringify(hosts))
  },
  addRecentHost(host: { name: string; subdomain: string }) {
    const existing = storage.getRecentHosts().filter((item) => item.subdomain !== host.subdomain)
    const next: RecentHost[] = [
      { ...host, lastUsedAt: Date.now() },
      ...existing,
    ].slice(0, 8)
    storage.setRecentHosts(next)
  },
  clearRecentHosts() {
    localStorage.removeItem(RECENT_HOSTS_KEY)
  },
  getNotificationPrefs(): NotificationPrefs | null {
    const raw = localStorage.getItem(NOTIFICATION_KEY)
    if (!raw) return null
    try {
      return JSON.parse(raw) as NotificationPrefs
    } catch {
      return null
    }
  },
  setNotificationPrefs(prefs: NotificationPrefs) {
    localStorage.setItem(NOTIFICATION_KEY, JSON.stringify(prefs))
  },
  getHostProfile(): HostProfileDraft | null {
    const raw = localStorage.getItem(PROFILE_KEY)
    if (!raw) return null
    try {
      return JSON.parse(raw) as HostProfileDraft
    } catch {
      return null
    }
  },
  setHostProfile(profile: HostProfileDraft) {
    localStorage.setItem(PROFILE_KEY, JSON.stringify(profile))
  },
}
