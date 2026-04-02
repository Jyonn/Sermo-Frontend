import type {
  ApiEnvelope,
  AvatarUploadDTO,
  AuthSession,
  ChatDTO,
  ChatMessageDTO,
  MessageMediaKind,
  MessageUploadDTO,
  ChatSyncResponseDTO,
  FriendshipRequestDTO,
  FriendInvitePreviewDTO,
  FriendshipStatusDTO,
  JoinResponseDTO,
  LoginAuthDTO,
  OfficialLoginTicketDTO,
  NotificationPreferenceDTO,
  SpaceAdminDashboardDTO,
  SpaceAdminSession,
  SpaceDTO,
  SpaceEmailCodeDTO,
  SpaceAuthDTO,
  UserDTO,
  UserMeDTO,
} from "../types";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "/api";

type AuthConfig = {
  getSession: () => AuthSession | null;
  setSession: (session: AuthSession | null) => void;
};

type AdminAuthConfig = {
  getSession: () => SpaceAdminSession | null;
  setSession: (session: SpaceAdminSession | null) => void;
};

type RequestOptions = {
  method?: "GET" | "POST" | "DELETE";
  body?: unknown;
  query?: Record<string, string | number | boolean | null | undefined>;
  auth?: boolean;
  adminAuth?: boolean;
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
let adminAuthConfig: AdminAuthConfig = {
  getSession: () => null,
  setSession: () => undefined,
};
let refreshInFlight: Promise<AuthSession> | null = null;

export function configureApiAuth(config: AuthConfig) {
  authConfig = config;
}

export function configureAdminApiAuth(config: AdminAuthConfig) {
  adminAuthConfig = config;
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

function refreshSessionSingleFlight(currentSession: AuthSession) {
  if (!refreshInFlight) {
    refreshInFlight = refreshSession(currentSession).finally(() => {
      refreshInFlight = null;
    });
  }

  return refreshInFlight;
}

export function refreshAuthSession(currentSession: AuthSession) {
  return refreshSessionSingleFlight(currentSession);
}

async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { method = "GET", body, query, auth = false, adminAuth = false, retryOn401 = true, signal } = options;
  const session = auth ? authConfig.getSession() : null;
  const adminSession = adminAuth ? adminAuthConfig.getSession() : null;
  const headers = new Headers();
  headers.set("Accept", "application/json");
  if (body !== undefined) {
    headers.set("Content-Type", "application/json");
  }
  if (auth && session?.accessToken) {
    headers.set("Authorization", `Bearer ${session.accessToken}`);
  }
  if (adminAuth && adminSession?.accessToken) {
    headers.set("Authorization", `Bearer ${adminSession.accessToken}`);
  }

  const response = await fetch(`${API_BASE_URL}${withQuery(path, query)}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
    signal,
  });

  if (response.status === 401 && adminAuth) {
    adminAuthConfig.setSession(null);
    throw new ApiError("管理登录已失效，请重新登录。", "UNAUTHORIZED", response.status);
  }

  if (response.status === 401 && auth && retryOn401 && session?.refreshToken) {
    try {
      const latestSession = authConfig.getSession();
      const nextSession =
        latestSession?.refreshToken && latestSession.refreshToken !== session.refreshToken
          ? latestSession
          : await refreshSessionSingleFlight(session);
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
  getSpaceBySlug(slug: string, signal?: AbortSignal) {
    return request<SpaceDTO>("/spaces/lookup", {
      query: { slug },
      signal,
    });
  },

  postSpaceEmailCode(payload: { slug?: string; email?: string }) {
    return request<SpaceEmailCodeDTO>("/spaces/email-code", {
      method: "POST",
      body: payload,
    });
  },

  createSpace(payload: { name: string; slug: string; email: string; code: string; language: "en" | "zh-CN" }) {
    return request<{ space: SpaceDTO; auth: SpaceAuthDTO }>("/spaces/", {
      method: "POST",
      body: payload,
    });
  },

  loginSpace(payload: { slug: string; email?: string; code: string }) {
    return request<{ space: SpaceDTO; auth: SpaceAuthDTO }>("/spaces/login", {
      method: "POST",
      body: payload,
    });
  },

  joinSpace(payload: { slug: string; name: string; password?: string; language: "en" | "zh-CN" }) {
    return request<JoinResponseDTO>("/spaces/join", {
      method: "POST",
      body: payload,
    });
  },

  getSpaceMe(signal?: AbortSignal) {
    return request<SpaceDTO>("/spaces/me", { auth: true, signal });
  },

  getAdminDashboard(signal?: AbortSignal) {
    return request<SpaceAdminDashboardDTO>("/spaces/admin/dashboard", {
      adminAuth: true,
      signal,
    });
  },

  updateAdminSettings(payload: { name: string; group_square_enabled: 0 | 1; member_limit: number | null }) {
    return request<SpaceDTO>("/spaces/admin/settings", {
      method: "POST",
      adminAuth: true,
      body: payload,
    });
  },

  createOfficialLoginTicket() {
    return request<OfficialLoginTicketDTO>("/spaces/admin/official-login-ticket", {
      method: "POST",
      adminAuth: true,
    });
  },

  getAdminUsers(params: { q?: string; online?: 0 | 1; limit?: number; offset?: number }, signal?: AbortSignal) {
    return request<UserDTO[]>("/spaces/admin/users", {
      adminAuth: true,
      query: params,
      signal,
    });
  },

  removeAdminUser(user_id: number) {
    return request<Record<string, never>>("/spaces/admin/users/remove", {
      method: "DELETE",
      adminAuth: true,
      query: { user_id },
    });
  },

  exchangeOfficialLoginTicket(token: string) {
    return request<JoinResponseDTO>("/spaces/official-login/exchange", {
      method: "POST",
      body: { token },
    });
  },

  updateUserName(name: string) {
    return request<UserMeDTO>("/users/me/name", {
      method: "POST",
      auth: true,
      body: { name },
    });
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

  createGroupChat(users: number[], title?: string) {
    return request<ChatDTO>("/chats/group", {
      method: "POST",
      auth: true,
      body: { users, title: title?.trim() || undefined },
    });
  },

  renameGroupChat(chat_id: number, title: string) {
    return request<ChatDTO>("/chats/group/name", {
      method: "POST",
      auth: true,
      query: { chat_id },
      body: { title },
    });
  },

  addGroupMembers(chat_id: number, users: number[]) {
    return request<ChatDTO>("/chats/group/members", {
      method: "POST",
      auth: true,
      query: { chat_id },
      body: { users },
    });
  },

  removeGroupMembers(chat_id: number, users: number[]) {
    return request<ChatDTO>("/chats/group/members", {
      method: "DELETE",
      auth: true,
      query: { chat_id },
      body: { users },
    });
  },

  deleteGroupChat(chat_id: number) {
    return request<Record<string, never>>("/chats/group", {
      method: "DELETE",
      auth: true,
      query: { chat_id },
    });
  },

  leaveGroupChat(chat_id: number) {
    return request<Record<string, never>>("/chats/group/leave", {
      method: "POST",
      auth: true,
      query: { chat_id },
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

  getMessagesSync(params: { after: number; limit: number }, signal?: AbortSignal) {
    return request<ChatSyncResponseDTO>("/messages/sync", {
      auth: true,
      query: params,
      signal,
    });
  },

  createMessageUpload(kind: MessageMediaKind, file_name: string, content_type?: string) {
    return request<MessageUploadDTO>("/messages/upload", {
      method: "POST",
      auth: true,
      body: { kind, file_name, content_type },
    });
  },

  sendMessage(chat_id: number, type: number, content: string) {
    return request<ChatMessageDTO>("/messages/", {
      method: "POST",
      auth: true,
      query: { chat_id },
      body: { content, type },
    });
  },

  deleteMessage(message_id: number) {
    return request<Record<string, never>>("/messages/", {
      method: "DELETE",
      auth: true,
      query: { message_id },
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

  getFriendStatus(user_id: number, signal?: AbortSignal) {
    return request<FriendshipStatusDTO>("/friends/status", {
      auth: true,
      query: { user_id },
      signal,
    });
  },

  respondFriendRequest(user_id: number, accept: boolean) {
    return request<FriendshipRequestDTO>("/friends/requests/respond", {
      method: "POST",
      auth: true,
      query: { user_id },
      body: { accept: accept ? 1 : 0 },
    });
  },

  removeFriendRequest(user_id: number) {
    return request<Record<string, never>>("/friends/requests/remove", {
      method: "DELETE",
      auth: true,
      query: { user_id },
    });
  },

  createFriendRequest(to_user_id: number) {
    return request<FriendshipRequestDTO>("/friends/requests", {
      method: "POST",
      auth: true,
      body: { to_user_id },
    });
  },

  createFriendInviteToken(permanent = false) {
    return request<{ token: string; expire: number | null; permanent: boolean }>("/friends/invites/token", {
      method: "POST",
      auth: true,
      body: { permanent: permanent ? 1 : 0 },
    });
  },

  getFriendInvitePreview(token: string, signal?: AbortSignal) {
    return request<FriendInvitePreviewDTO>("/friends/invites/preview", {
      query: { token },
      signal,
    });
  },

  redeemFriendInviteToken(token: string) {
    return request<FriendshipRequestDTO>("/friends/invites/redeem", {
      method: "POST",
      auth: true,
      body: { token },
    });
  },

  getNotificationPrefs(signal?: AbortSignal) {
    return request<NotificationPreferenceDTO[]>("/users/me/notification-prefs", {
      auth: true,
      signal,
    });
  },

  getUserMe(signal?: AbortSignal) {
    return request<UserMeDTO>("/users/me", {
      auth: true,
      signal,
    });
  },

  updatePassword(payload: { new_password: string; old_password?: string }) {
    return request<{ has_password: boolean }>("/users/me/password", {
      method: "POST",
      auth: true,
      body: payload,
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

  sendContactCode(payload: { channel: number; target: string }) {
    return request<{ expires_in: number }>("/users/me/contact-code", {
      method: "POST",
      auth: true,
      body: payload,
    });
  },

  bindContact(payload: { channel: number; target: string; code: string }) {
    return request<UserMeDTO>("/users/me/bind-contact", {
      method: "POST",
      auth: true,
      body: payload,
    });
  },

  getWelcomeMessage(signal?: AbortSignal) {
    return request<{ welcome_message: string }>("/users/me/welcome-message", {
      auth: true,
      signal,
    });
  },

  updateWelcomeMessage(welcome_message: string) {
    return request<{ welcome_message: string }>("/users/me/welcome-message", {
      method: "POST",
      auth: true,
      body: { welcome_message },
    });
  },

  setPresetAvatar(avatar_preset_id: number) {
    return request<{ avatar_type: "preset" | "custom"; avatar_uri: string }>("/users/me/avatar/preset", {
      method: "POST",
      auth: true,
      body: { avatar_preset_id },
    });
  },

  createCustomAvatarUpload(file_name: string, content_type?: string) {
    return request<AvatarUploadDTO>("/users/me/avatar/custom/upload", {
      method: "POST",
      auth: true,
      body: { file_name, content_type },
    });
  },

  setCustomAvatar(key: string) {
    return request<{ avatar_type: "preset" | "custom"; avatar_uri: string }>("/users/me/avatar/custom", {
      method: "POST",
      auth: true,
      body: { key },
    });
  },
};
