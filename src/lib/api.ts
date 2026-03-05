import type { AuthTokens, Chat, Message, NicknameCheck } from "./types"
import { storage, type StoredAuth } from "./storage"

const API_BASE = import.meta.env.VITE_API_BASE_URL || "http://localhost:8000"

export class ApiError extends Error {
  status?: number
  code?: number
  identifier?: string
  details?: unknown
  raw?: unknown

  constructor(
    message: string,
    options?: { status?: number; code?: number; identifier?: string; details?: unknown; raw?: unknown }
  ) {
    super(message)
    this.name = "ApiError"
    this.status = options?.status
    this.code = options?.code
    this.identifier = options?.identifier
    this.details = options?.details
    this.raw = options?.raw
  }
}

type ApiFetchOptions = {
  method?: string
  body?: Record<string, unknown> | null
  auth?: StoredAuth | null
  subdomain?: string | null
  query?: Record<string, string | number | boolean | null | undefined>
}

const buildQuery = (query?: ApiFetchOptions["query"]) => {
  if (!query) return ""
  const params = new URLSearchParams()
  Object.entries(query).forEach(([key, value]) => {
    if (value === null || value === undefined || value === "") return
    params.set(key, String(value))
  })
  const str = params.toString()
  return str ? `?${str}` : ""
}

const extractErrorMessage = (payload: any) => {
  if (!payload || typeof payload !== "object") return "Request failed"
  return (
    payload.message ||
    payload.msg ||
    payload.error ||
    payload.detail ||
    payload.details ||
    "Request failed"
  )
}

const unwrap = (payload: any) => {
  if (payload && typeof payload === "object") {
    if ("code" in payload) {
      const code = Number(payload.code)
      if (code === 0 || code === 200) {
        if ("auth" in payload || "refresh" in payload) {
          return payload
        }
        if ("data" in payload) {
          const data = payload.data
          if (data && typeof data === "object" && ("auth" in data || "refresh" in data)) {
            return data
          }
          if (data && typeof data === "object" && "data" in data) {
            const nested = data.data
            if (nested && typeof nested === "object" && ("auth" in nested || "refresh" in nested)) {
              return nested
            }
          }
          return data
        }
        return payload
      }
      throw new ApiError(extractErrorMessage(payload), {
        code,
        identifier: payload?.identifier,
        details: payload?.details,
        raw: payload,
      })
    }
    if ("data" in payload && Object.keys(payload).length === 1) {
      return payload.data
    }
  }
  return payload
}

const refreshAuth = async (refresh: string) => {
  const response = await fetch(`${API_BASE}/users/refresh`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({ refresh }),
  })
  const text = await response.text()
  let payload = text ? JSON.parse(text) : null
  if (payload && typeof payload === "object" && "code" in payload) {
    if ((payload.code === 0 || payload.code === 200) && "body" in payload) {
      payload = payload.body
    }
  }
  if (!response.ok) {
    throw new ApiError(extractErrorMessage(payload), {
      status: response.status,
      code: payload?.code,
      identifier: payload?.identifier,
      raw: payload,
    })
  }
  return payload as AuthTokens
}

let refreshPromise: Promise<AuthTokens> | null = null

const getRefreshedTokens = (refresh: string) => {
  if (!refreshPromise) {
    refreshPromise = refreshAuth(refresh).finally(() => {
      refreshPromise = null
    })
  }
  return refreshPromise
}

export const apiFetch = async <T>(path: string, options: ApiFetchOptions = {}): Promise<T> => {
  const attempt = async (retrying: boolean): Promise<T> => {
    const { method = "GET", body, auth, subdomain, query } = options
    const headers: Record<string, string> = {
      Accept: "application/json",
    }

    if (body !== undefined && body !== null) {
      headers["Content-Type"] = "application/json"
    }

    const resolvedAuth = auth ?? storage.getAuth()
    if (resolvedAuth?.auth) {
      headers.Authorization = `Bearer ${resolvedAuth.auth}`
    }

    if (subdomain) {
      headers["X-Sermo-Subdomain"] = subdomain
    }

    const response = await fetch(`${API_BASE}${path}${buildQuery(query)}`, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
    })

    const text = await response.text()
    let payload = text ? JSON.parse(text) : null
    if (payload && typeof payload === "object" && "code" in payload) {
      const code = Number(payload.code)
      if ((code === 0 || code === 200) && "body" in payload) {
        payload = (payload as any).body
      }
    }

    try {
      const unwrapped = unwrap(payload)
      if (!response.ok) {
        throw new ApiError(extractErrorMessage(payload), {
          status: response.status,
          code: payload?.code,
          identifier: payload?.identifier,
          raw: payload,
        })
      }
      return unwrapped as T
    } catch (error) {
      const resolvedAuth = auth ?? storage.getAuth()
      const isAuthError =
        error instanceof ApiError &&
        (error.identifier === "AUTH@EXPIRED" || error.identifier === "AUTH@REVOKED")
      const canRefresh = Boolean(resolvedAuth?.refresh)
      const isRefreshCall = path.startsWith("/users/refresh")
      if (isAuthError && !retrying && !isRefreshCall && canRefresh) {
        try {
          const tokens = await getRefreshedTokens(resolvedAuth!.refresh)
          storage.setAuth({
            ...resolvedAuth!,
            auth: tokens.auth,
            refresh: tokens.refresh,
          })
          return attempt(true)
        } catch {
          storage.clearAuth()
        }
      }
      if (error instanceof ApiError) {
        throw error
      }
      throw new ApiError(extractErrorMessage(payload), {
        status: response.status,
        code: payload?.code,
        identifier: payload?.identifier,
        raw: payload,
      })
    }
  }

  return attempt(false)
}

export const userApi = {
  getHostBySubdomain(subdomain: string) {
    return apiFetch(`/users/host`, { subdomain })
  },
  hostLogin(name: string, password: string) {
    return apiFetch<AuthTokens>(`/users/host`, { method: "POST", body: { name, password } })
  },
  guestLogin(subdomain: string, name: string, password?: string) {
    return apiFetch<AuthTokens>(`/users/guest`, {
      method: "POST",
      body: { name, password: password || "" },
      subdomain,
    })
  },
  nicknameCheck(subdomain: string, name: string) {
    return apiFetch<NicknameCheck>(`/users/guest/nickname`, {
      subdomain,
      query: { name },
    })
  },
  listGuests(auth: StoredAuth, params?: { q?: string; online?: number; limit?: number; offset?: number }) {
    return apiFetch(`/users/host/guests`, {
      auth,
      query: params,
    })
  },
  deleteGuest(auth: StoredAuth, guest_id: number, purge_group_messages = 0) {
    return apiFetch(`/users/guest/delete`, {
      auth,
      method: "DELETE",
      query: { guest_id, purge_group_messages },
    })
  },
  heartbeat(auth: StoredAuth) {
    return apiFetch(`/users/heartbeat`, { auth })
  },
  refresh(refresh: string) {
    return apiFetch<AuthTokens>(`/users/refresh`, { method: "POST", body: { refresh } })
  },
  logout(refresh: string) {
    return apiFetch(`/users/logout`, { method: "POST", body: { refresh } })
  },
  checkSubdomain(subdomain: string) {
    return apiFetch(`/users/host/subdomain`, { query: { subdomain } })
  },
  setSubdomain(auth: StoredAuth, subdomain: string) {
    return apiFetch(`/users/host/subdomain`, { method: "POST", auth, body: { subdomain } })
  },
}

export const chatApi = {
  listChats(auth: StoredAuth) {
    return apiFetch<Chat[]>(`/chats/`, { auth })
  },
  markRead(auth: StoredAuth, chat_id: number) {
    return apiFetch(`/chats/read`, { auth, method: "POST", query: { chat_id } })
  },
  createGroup(auth: StoredAuth, guests: number[]) {
    return apiFetch(`/chats/group`, { auth, method: "POST", body: { guests } })
  },
  deleteGroup(auth: StoredAuth, chat_id: number) {
    return apiFetch(`/chats/group`, { auth, method: "DELETE", query: { chat_id } })
  },
  renameGroup(auth: StoredAuth, chat_id: number, name: string) {
    return apiFetch(`/chats/group/name`, { auth, method: "POST", query: { chat_id }, body: { name } })
  },
  addGroupMembers(auth: StoredAuth, chat_id: number, guests: number[]) {
    return apiFetch(`/chats/group/members`, { auth, method: "POST", query: { chat_id }, body: { guests } })
  },
  removeGroupMembers(auth: StoredAuth, chat_id: number, guests: number[]) {
    return apiFetch(`/chats/group/members`, { auth, method: "DELETE", query: { chat_id }, body: { guests } })
  },
}

export const messageApi = {
  listMessages(auth: StoredAuth, chat_id: number, params?: { limit?: number; before?: number; after?: number }) {
    return apiFetch<Message[]>(`/messages/`, {
      auth,
      query: { chat_id, limit: params?.limit, before: params?.before, after: params?.after },
    })
  },
  sendMessage(auth: StoredAuth, chat_id: number, content: string, type = 0) {
    return apiFetch<Message>(`/messages/`, {
      auth,
      method: "POST",
      query: { chat_id },
      body: { type, content },
    })
  },
  deleteMessage(auth: StoredAuth, message_id: number) {
    return apiFetch(`/messages/`, { auth, method: "DELETE", query: { message_id } })
  },
}
