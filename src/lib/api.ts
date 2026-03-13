import type {
  ApiEnvelope,
  AuthSession,
  ChatDTO,
  ChatMessageDTO,
  FriendshipRequestDTO,
  JoinResponseDTO,
  LoginAuthDTO,
  NotificationPreferenceDTO,
  SpaceDTO,
  SpaceAuthDTO,
  UserDTO,
} from "../types";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "/api";

type AuthConfig = {
  getSession: () => AuthSession | null;
  setSession: (session: AuthSession | null) => void;
};

type RequestOptions = {
  method?: "GET" | "POST" | "DELETE";
  body?: unknown;
  query?: Record<string, string | number | boolean | null | undefined>;
  auth?: boolean;
  retryOn401?: boolean;
  signal?: AbortSignal;
};

export class ApiError extends Error {
  identifier: string;
  status: number;

  constructor(message: string, identifier = "ERROR", status = 500) {
    super(message);
    this.name = "ApiError";
    this.identifier = identifier;
    this.status = status;
  }
}

let authConfig: AuthConfig = {
  getSession: () => null,
  setSession: () => undefined,
};

export function configureApiAuth(config: AuthConfig) {
  authConfig = config;
}

function withQuery(path: string, query?: RequestOptions["query"]) {
  if (!query) return path;
  const search = new URLSearchParams();
  Object.entries(query).forEach(([key, value]) => {
    if (value === null || value === undefined || value === "") return;
    search.set(key, String(value));
  });
  const suffix = search.toString();
  return suffix ? `${path}?${suffix}` : path;
}

async function parseEnvelope<T>(response: Response): Promise<T> {
  const text = await response.text();
  if (!text) {
    if (!response.ok) {
      throw new ApiError(`HTTP ${response.status}`, "HTTP_ERROR", response.status);
    }
    return null as T;
  }

  let payload: ApiEnvelope<T>;
  try {
    payload = JSON.parse(text) as ApiEnvelope<T>;
  } catch {
    if (!response.ok) {
      throw new ApiError(`HTTP ${response.status}`, "HTTP_ERROR", response.status);
    }
    return text as T;
  }

  if (!response.ok || payload.identifier !== "OK") {
    throw new ApiError(payload.user_message || payload.message || "Request failed", payload.identifier, response.status);
  }

  return payload.body;
}

async function refreshSession(currentSession: AuthSession) {
  const response = await fetch(`${API_BASE_URL}/users/refresh`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ refresh: currentSession.refreshToken }),
  });

  const body = await parseEnvelope<LoginAuthDTO>(response);
  const nextSession: AuthSession = {
    accessToken: body.auth,
    refreshToken: body.refresh,
    user: body.data,
  };
  authConfig.setSession(nextSession);
  return nextSession;
}

async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { method = "GET", body, query, auth = false, retryOn401 = true, signal } = options;
  const session = auth ? authConfig.getSession() : null;
  const headers = new Headers();
  headers.set("Accept", "application/json");
  if (body !== undefined) {
    headers.set("Content-Type", "application/json");
  }
  if (auth && session?.accessToken) {
    headers.set("Authorization", `Bearer ${session.accessToken}`);
  }

  const response = await fetch(`${API_BASE_URL}${withQuery(path, query)}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
    signal,
  });

  if (response.status === 401 && auth && retryOn401 && session?.refreshToken) {
    try {
      const nextSession = await refreshSession(session);
      const retryHeaders = new Headers(headers);
      retryHeaders.set("Authorization", `Bearer ${nextSession.accessToken}`);
      const retryResponse = await fetch(`${API_BASE_URL}${withQuery(path, query)}`, {
        method,
        headers: retryHeaders,
        body: body === undefined ? undefined : JSON.stringify(body),
        signal,
      });
      return parseEnvelope<T>(retryResponse);
    } catch (error) {
      authConfig.setSession(null);
      throw error;
    }
  }

  return parseEnvelope<T>(response);
}

export const api = {
  postSpaceEmailCode(payload: { slug?: string; email: string }) {
    return request<{ expires_in: number }>("/spaces/email-code", {
      method: "POST",
      body: payload,
    });
  },

  createSpace(payload: { name: string; slug: string; email: string; code: string }) {
    return request<{ space: SpaceDTO; auth: SpaceAuthDTO }>("/spaces/", {
      method: "POST",
      body: payload,
    });
  },

  loginSpace(payload: { slug: string; email: string; code: string }) {
    return request<{ space: SpaceDTO; auth: SpaceAuthDTO }>("/spaces/login", {
      method: "POST",
      body: payload,
    });
  },

  joinSpace(payload: { slug: string; name: string; password?: string }) {
    return request<JoinResponseDTO>("/spaces/join", {
      method: "POST",
      body: payload,
    });
  },

  getSpaceMe(signal?: AbortSignal) {
    return request<SpaceDTO>("/spaces/me", { auth: true, signal });
  },

  getSpaceUsers(params: { q?: string; online?: 0 | 1; limit?: number; offset?: number }, signal?: AbortSignal) {
    return request<UserDTO[]>("/spaces/users", { auth: true, query: params, signal });
  },

  getOnlineUsers(params: { q?: string; limit?: number; offset?: number }, signal?: AbortSignal) {
    return request<UserDTO[]>("/spaces/users/online", { auth: true, query: params, signal });
  },

  heartbeat() {
    return request<Record<string, never>>("/users/heartbeat", { auth: true });
  },

  logout(refresh: string) {
    return request<Record<string, never>>("/users/logout", {
      method: "POST",
      body: { refresh },
    });
  },

  getChats(signal?: AbortSignal) {
    return request<ChatDTO[]>("/chats/", { auth: true, signal });
  },

  createDirectChat(peer_user_id: number) {
    return request<ChatDTO>("/chats/direct", {
      method: "POST",
      auth: true,
      body: { peer_user_id },
    });
  },

  markChatRead(chat_id: number) {
    return request<{ last_read_at: number }>("/chats/read", {
      method: "POST",
      auth: true,
      query: { chat_id },
    });
  },

  getMessages(params: { chat_id: number; limit: number; before?: number; after?: number }, signal?: AbortSignal) {
    return request<ChatMessageDTO[]>("/messages/", {
      auth: true,
      query: params,
      signal,
    });
  },

  sendMessage(chat_id: number, content: string) {
    return request<ChatMessageDTO>("/messages/", {
      method: "POST",
      auth: true,
      query: { chat_id },
      body: { content, type: 0 },
    });
  },

  getFriends(signal?: AbortSignal) {
    return request<UserDTO[]>("/friends/", { auth: true, signal });
  },

  getFriendRequests(signal?: AbortSignal) {
    return request<{ incoming: FriendshipRequestDTO[]; outgoing: FriendshipRequestDTO[] }>("/friends/requests", {
      auth: true,
      signal,
    });
  },

  respondFriendRequest(request_id: number, accept: boolean) {
    return request<FriendshipRequestDTO>("/friends/requests/respond", {
      method: "POST",
      auth: true,
      query: { request_id },
      body: { accept: accept ? 1 : 0 },
    });
  },

  removeFriendRequest(request_id: number) {
    return request<Record<string, never>>("/friends/requests/remove", {
      method: "DELETE",
      auth: true,
      query: { request_id },
    });
  },

  createFriendRequest(to_user_id: number) {
    return request<FriendshipRequestDTO>("/friends/requests", {
      method: "POST",
      auth: true,
      body: { to_user_id },
    });
  },

  getNotificationPrefs(signal?: AbortSignal) {
    return request<NotificationPreferenceDTO[]>("/users/me/notification-prefs", {
      auth: true,
      signal,
    });
  },

  updateNotificationPref(payload: {
    channel: number;
    enabled?: 0 | 1;
    offline_threshold_minutes?: number;
  }) {
    return request<NotificationPreferenceDTO>("/users/me/notification-prefs", {
      method: "POST",
      auth: true,
      body: payload,
    });
  },

  sendVerifyEmailCode(email: string) {
    return request<{ expires_in: number }>("/users/me/email-code", {
      method: "POST",
      auth: true,
      body: { email },
    });
  },

  verifyEmail(payload: { email: string; code: string; password: string }) {
    return request<UserDTO>("/users/me/verify-email", {
      method: "POST",
      auth: true,
      body: payload,
    });
  },

  sendContactCode(payload: { channel: number; target: string }) {
    return request<{ expires_in: number }>("/users/me/contact-code", {
      method: "POST",
      auth: true,
      body: payload,
    });
  },

  bindContact(payload: { channel: number; target: string; code: string }) {
    return request<UserDTO>("/users/me/bind-contact", {
      method: "POST",
      auth: true,
      body: payload,
    });
  },
};
