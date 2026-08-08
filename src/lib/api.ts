import type {
  ApiEnvelope,
  AdminMemberDTO,
  AvatarUploadDTO,
  AuthSession,
  AccountSwitchTicketDTO,
  ChatDTO,
  ChatPreferenceDTO,
  ChatMessageDTO,
  MessageMediaKind,
  MessageSearchResponseDTO,
  MessageUploadDTO,
  MessageEventSyncResponseDTO,
  FriendshipRequestDTO,
  FriendInvitePreviewDTO,
  FriendshipStatusDTO,
  GestureLockPreferenceDTO,
  JoinResponseDTO,
  LoginAuthDTO,
  LinkPreviewDTO,
  ImageMetadataDTO,
  VideoMetadataDTO,
  OfficialLoginTicketDTO,
  NotificationPreferenceDTO,
  PinnedMessageDTO,
  SpaceAdminDashboardDTO,
  SpaceAdminBroadcastResultDTO,
  SpaceAdminSession,
  SpaceDTO,
  SwitchAccountDTO,
  SpaceEmailCodeDTO,
  SpaceAuthDTO,
  UserDTO,
  UserGrowthDTO,
  PermanentVipCampaignDTO,
  PersonalizationDTO,
  UserMeDTO,
  WebReminderPreferenceDTO,
  EmojiUsageDTO,
  WebPushInfoDTO,
  WebPushSubscriptionDTO,
  MyTravelMapDTO,
  TravelMapCheckInDTO,
  ChatTravelMapAccessDTO,
  ChatTravelMapDTO,
  TravelMapAccessDTO,
  TravelMapComparisonDTO,
  TravelMapAccessOverviewDTO,
  SquareStatementDTO,
  SquareStatementCommentDTO,
  SquareStatementDraftMedia,
} from "../types";
import type { FeatureCollection } from "geojson";
import { i18n } from "./i18n";

const API_BASE_URL = import.meta.env.DEV ? "/api" : "https://api.sermo.jyonn.space";

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
const getRequestsInFlight = new Map<string, Promise<unknown>>();

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

async function requestCore<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { method = "GET", body, query, auth = false, adminAuth = false, retryOn401 = true, signal } = options;
  const session = auth ? authConfig.getSession() : null;
  const adminSession = adminAuth ? adminAuthConfig.getSession() : null;
  const headers = new Headers();
  headers.set("Accept", "application/json");
  headers.set(
    "Accept-Language",
    session?.user.language
      ?? (typeof navigator !== "undefined" && navigator.language.toLowerCase().startsWith("zh") ? "zh-CN" : "en")
  );
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
    throw new ApiError(i18n.t("admin.sessionExpired"), "UNAUTHORIZED", response.status);
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

function waitForSharedRequest<T>(shared: Promise<T>, signal?: AbortSignal): Promise<T> {
  if (!signal) return shared;
  if (signal.aborted) return Promise.reject(new DOMException("The operation was aborted.", "AbortError"));

  return new Promise<T>((resolve, reject) => {
    const abort = () => reject(new DOMException("The operation was aborted.", "AbortError"));
    signal.addEventListener("abort", abort, { once: true });
    shared.then(
      (value) => {
        signal.removeEventListener("abort", abort);
        resolve(value);
      },
      (error) => {
        signal.removeEventListener("abort", abort);
        reject(error);
      }
    );
  });
}

function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { method = "GET", auth = false, adminAuth = false, query, signal } = options;
  if (method !== "GET") {
    return requestCore<T>(path, options).then((result) => {
      if (auth && path !== "/users/me/growth") {
        window.dispatchEvent(new CustomEvent("sermo:growth-refresh"));
      }
      return result;
    });
  }

  const sessionKey = auth ? authConfig.getSession()?.accessToken ?? "anonymous" : "";
  const adminSessionKey = adminAuth ? adminAuthConfig.getSession()?.accessToken ?? "anonymous" : "";
  const requestKey = `${withQuery(path, query)}|auth:${sessionKey}|admin:${adminSessionKey}`;
  let shared = getRequestsInFlight.get(requestKey) as Promise<T> | undefined;

  if (!shared) {
    shared = requestCore<T>(path, { ...options, signal: undefined }).finally(() => {
      getRequestsInFlight.delete(requestKey);
    });
    getRequestsInFlight.set(requestKey, shared);
  }

  return waitForSharedRequest(shared, signal);
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

  lookupPasswordRecovery(payload: { slug: string; name: string }) {
    return request<{ channels: Array<{ channel: number; type: "email" | "sms"; masked: string }> }>("/users/password-recovery/lookup", {
      method: "POST",
      body: payload,
    });
  },

  sendPasswordRecoveryCode(payload: { slug: string; name: string; channel: number }) {
    return request<{ challenge_id: number; expires_in: number }>("/users/password-recovery/code", {
      method: "POST",
      body: payload,
    });
  },

  verifyPasswordRecoveryCode(payload: { challenge_id: number; code: string }) {
    return request<{ reset_token: string; expires_in: number }>("/users/password-recovery/verify", {
      method: "POST",
      body: payload,
    });
  },

  resetRecoveredPassword(payload: { reset_token: string; new_password: string }) {
    return request<Record<string, never>>("/users/password-recovery/reset", {
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

  createAdminSessionFromOfficialAccount() {
    return request<{ space: SpaceDTO; auth: SpaceAuthDTO }>("/spaces/admin/session", {
      method: "POST",
      auth: true,
    });
  },

  updateAdminSettings(payload: { name: string; group_square_enabled: 0 | 1; member_limit: number | null; level_names: string[] }) {
    return request<SpaceDTO>("/spaces/admin/settings", {
      method: "POST",
      adminAuth: true,
      body: payload,
    });
  },

  claimGrowthEvent(event: "install_webapp" | "plaza_friend") {
    return request<{ awarded: number; growth: UserGrowthDTO }>("/users/me/growth-events", {
      method: "POST",
      auth: true,
      body: { event },
    });
  },

  createOfficialLoginTicket() {
    return request<OfficialLoginTicketDTO>("/spaces/admin/official-login-ticket", {
      method: "POST",
      adminAuth: true,
    });
  },

  getAdminUsers(params: { q?: string; online?: 0 | 1; limit?: number; offset?: number }, signal?: AbortSignal) {
    return request<AdminMemberDTO[]>("/spaces/admin/users", {
      adminAuth: true,
      query: params,
      signal,
    });
  },

  broadcastAdminMessage(payload: { content: string; type: number; broadcast_id: string }) {
    return request<SpaceAdminBroadcastResultDTO>("/spaces/admin/broadcast", {
      method: "POST",
      adminAuth: true,
      body: payload,
    });
  },

  createAdminBroadcastUpload(kind: MessageMediaKind, file_name: string, content_type?: string) {
    return request<MessageUploadDTO>("/spaces/admin/broadcast/upload", {
      method: "POST",
      adminAuth: true,
      body: { kind, file_name, content_type },
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

  deleteAccount(payload: { password?: string; name_confirmation?: string }) {
    return request<Record<string, never>>("/users/me", {
      method: "DELETE",
      auth: true,
      body: payload,
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

  updateChatPreference(chat_id: number, payload: { pinned?: 0 | 1; online_reminder_enabled?: 0 | 1 }) {
    return request<ChatPreferenceDTO>("/chats/preference", {
      method: "POST",
      auth: true,
      query: { chat_id },
      body: payload,
    });
  },

  getMessages(params: { chat_id: number; limit: number; before?: number; after?: number }, signal?: AbortSignal) {
    return request<ChatMessageDTO[]>("/messages/", {
      auth: true,
      query: params,
      signal,
    });
  },

  searchMessages(params: { chat_id: number; limit: number; keyword?: string; type?: number; before?: number }, signal?: AbortSignal) {
    return request<MessageSearchResponseDTO>("/messages/search", {
      auth: true,
      query: params,
      signal,
    });
  },

  getPinnedMessages(chat_id: number, signal?: AbortSignal) {
    return request<PinnedMessageDTO[]>("/messages/pins", {
      auth: true,
      query: { chat_id },
      signal,
    });
  },

  pinMessage(message_id: number) {
    return request<PinnedMessageDTO>("/messages/pins", {
      method: "POST",
      auth: true,
      query: { message_id },
    });
  },

  unpinMessage(message_id: number) {
    return request<Record<string, never>>("/messages/pins", {
      method: "DELETE",
      auth: true,
      query: { message_id },
    });
  },

  getMessageEventsSync(params: { after: number; limit: number }, signal?: AbortSignal) {
    return request<MessageEventSyncResponseDTO>("/messages/sync-v2", {
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

  getSquareStatements(params: { before?: number; limit?: number; friends_only?: number }, signal?: AbortSignal) {
    return request<SquareStatementDTO[]>("/square/statements", {
      auth: true,
      query: params,
      signal,
    });
  },

  getSquareStatement(statementId: number, signal?: AbortSignal) {
    return request<SquareStatementDTO>(`/square/statements/${statementId}`, { auth: true, signal });
  },

  createSquareStatement(payload: {
    text: string;
    visibility: "public" | "friends";
    media: SquareStatementDraftMedia[];
  }) {
    return request<SquareStatementDTO>("/square/statements", {
      method: "POST",
      auth: true,
      body: payload,
    });
  },

  getSquareStatementComments(statementId: number, params: { offset?: number; limit?: number }, signal?: AbortSignal) {
    return request<SquareStatementCommentDTO[]>(`/square/statements/${statementId}/comments`, {
      auth: true,
      query: params,
      signal,
    });
  },

  createSquareStatementComment(statementId: number, text: string, parentId?: number | null) {
    return request<SquareStatementCommentDTO>(`/square/statements/${statementId}/comments`, {
      method: "POST",
      auth: true,
      body: { text, parent_id: parentId ?? null },
    });
  },

  setSquareStatementLike(statementId: number, liked: boolean) {
    return request<{ liked: boolean; like_count: number }>(`/square/statements/${statementId}/like`, {
      method: liked ? "POST" : "DELETE",
      auth: true,
    });
  },

  setSquareCommentLike(commentId: number, liked: boolean) {
    return request<{ liked: boolean; like_count: number }>(`/square/comments/${commentId}/like`, {
      method: liked ? "POST" : "DELETE",
      auth: true,
    });
  },

  deleteSquareStatement(statementId: number) {
    return request<{ statement_id: number; deleted: boolean }>(`/square/statements/${statementId}`, {
      method: "DELETE",
      auth: true,
    });
  },

  createSquareUpload(kind: "image" | "audio" | "video", file_name: string, content_type?: string) {
    return request<MessageUploadDTO>("/square/upload", {
      method: "POST",
      auth: true,
      body: { kind, file_name, content_type },
    });
  },

  sendMessage(chat_id: number, type: number, content: string, reply_to_message_id?: number, client_message_id?: string) {
    return request<ChatMessageDTO>("/messages/", {
      method: "POST",
      auth: true,
      query: { chat_id },
      body: { content, type, reply_to_message_id: reply_to_message_id ?? null, client_message_id: client_message_id ?? null },
    });
  },

  getMyTravelMap(signal?: AbortSignal) {
    return request<MyTravelMapDTO>("/maps/me", { auth: true, signal });
  },

  checkInTravelMap(payload: {
    latitude: number;
    longitude: number;
    accuracy_meters: number;
    region_code: string;
    region_name: string;
    country_code: string;
    country_name: string;
  }) {
    return request<TravelMapCheckInDTO>("/maps/me/check-in", {
      method: "POST",
      auth: true,
      body: payload,
    });
  },

  getTravelMap(user_id: number, signal?: AbortSignal) {
    return request<TravelMapComparisonDTO>("/maps/users", {
      auth: true,
      query: { user_id },
      signal,
    });
  },

  getTravelMapAccess(user_id: number) {
    return request<TravelMapAccessDTO>("/maps/access", { auth: true, query: { user_id } });
  },

  getTravelMapAccessOverview(signal?: AbortSignal) {
    return request<TravelMapAccessOverviewDTO>("/maps/access/overview", {
      auth: true,
      signal,
    });
  },

  grantTravelMapAccess(user_id: number) {
    return request<TravelMapAccessDTO>("/maps/access", {
      method: "POST",
      auth: true,
      query: { user_id },
    });
  },

  reciprocateTravelMapAccess(user_id: number) {
    return request<TravelMapAccessDTO>("/maps/access/reciprocate", {
      method: "POST",
      auth: true,
      query: { user_id },
    });
  },

  revokeTravelMapAccess(user_id: number) {
    return request<Record<string, never>>("/maps/access", {
      method: "DELETE",
      auth: true,
      query: { user_id },
    });
  },

  getChatTravelMapAccess(chat_id: number, signal?: AbortSignal) {
    return request<ChatTravelMapAccessDTO>("/maps/chats/access", {
      auth: true,
      query: { chat_id },
      signal,
    });
  },

  grantChatTravelMapAccess(chat_id: number) {
    return request<ChatTravelMapAccessDTO>("/maps/chats/access", {
      method: "POST",
      auth: true,
      query: { chat_id },
    });
  },

  revokeChatTravelMapAccess(chat_id: number) {
    return request<ChatTravelMapAccessDTO>("/maps/chats/access", {
      method: "DELETE",
      auth: true,
      query: { chat_id },
    });
  },

  getChatTravelMaps(chat_id: number, signal?: AbortSignal) {
    return request<ChatTravelMapDTO>("/maps/chats/maps", {
      auth: true,
      query: { chat_id },
      signal,
    });
  },

  getTravelMapGeometry(country_code: string, signal?: AbortSignal) {
    return request<FeatureCollection>("/maps/geometry", {
      auth: true,
      query: { country_code },
      signal,
    });
  },

  deleteMessage(message_id: number, scope: "me" | "everyone" = "everyone") {
    return request<Record<string, never>>("/messages/", {
      method: "DELETE",
      auth: true,
      query: { message_id, scope },
    });
  },

  deleteMessages(message_ids: number[]) {
    return request<{ deleted_message_ids: number[] }>("/messages/batch", {
      method: "DELETE",
      auth: true,
      body: { message_ids },
    });
  },

  reconcileMessages(chat_id: number, message_ids: number[]) {
    return request<{ deleted_message_ids: number[] }>("/messages/reconcile", {
      method: "POST",
      auth: true,
      body: { chat_id, message_ids },
    });
  },

  getMessageLinkPreview(message_id: number) {
    return request<LinkPreviewDTO>("/messages/link-preview", {
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

  getGrowth(signal?: AbortSignal) {
    return request<UserGrowthDTO>("/users/me/growth", {
      auth: true,
      signal,
    });
  },

  acknowledgeGrowthLevel(level: number) {
    return request<UserGrowthDTO>("/users/me/growth", {
      method: "POST",
      auth: true,
      body: { level },
    });
  },

  claimPermanentVip() {
    return request<PermanentVipCampaignDTO>("/users/me/permanent-vip", {
      method: "POST",
      auth: true,
    });
  },

  getEmojiUsage(signal?: AbortSignal) {
    return request<EmojiUsageDTO[]>("/users/me/emoji-usage", {
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
    hide_message_content?: 0 | 1;
    hidden_direct_message_title?: string;
    hidden_direct_message_text?: string;
    hidden_group_message_title?: string;
    hidden_group_message_text?: string;
    friend_online_message_title?: string;
    friend_online_message_text?: string;
    open_chat_on_tap?: 0 | 1;
    bark_icon_mode?: 0 | 1 | 2;
  }) {
    return request<NotificationPreferenceDTO>("/users/me/notification-prefs", {
      method: "POST",
      auth: true,
      body: payload,
    });
  },

  getWebReminderPrefs(signal?: AbortSignal) {
    return request<WebReminderPreferenceDTO>("/users/me/web-reminder-prefs", {
      auth: true,
      signal,
    });
  },

  updateWebReminderPrefs(payload: { sound_enabled?: 0 | 1; title_enabled?: 0 | 1 }) {
    return request<WebReminderPreferenceDTO>("/users/me/web-reminder-prefs", {
      method: "POST",
      auth: true,
      body: payload,
    });
  },

  getImageMetadata(messageId: number, signal?: AbortSignal) {
    return request<ImageMetadataDTO>("/messages/image-metadata", {
      auth: true,
      query: { message_id: messageId },
      signal,
    });
  },

  getVideoMetadata(messageId: number, signal?: AbortSignal) {
    return request<VideoMetadataDTO>("/messages/video-metadata", {
      auth: true,
      query: { message_id: messageId },
      signal,
    });
  },

  getWebPushInfo(signal?: AbortSignal) {
    return request<WebPushInfoDTO>("/users/me/web-push", {
      auth: true,
      signal,
    });
  },

  registerWebPush(payload: { endpoint: string; p256dh: string; auth: string; origin: string }) {
    return request<WebPushSubscriptionDTO>("/users/me/web-push", {
      method: "POST",
      auth: true,
      body: payload,
    });
  },

  deleteWebPush(endpoint: string) {
    return request<null>("/users/me/web-push", {
      method: "DELETE",
      auth: true,
      body: { endpoint },
    });
  },

  getGestureLockPrefs(signal?: AbortSignal) {
    return request<GestureLockPreferenceDTO>("/users/me/gesture-lock", {
      auth: true,
      signal,
    });
  },

  updateGestureLockPrefs(payload: {
    enabled?: 0 | 1;
    pattern_hash?: string;
    salt?: string;
    lock_after_minutes?: number;
  }) {
    return request<GestureLockPreferenceDTO>("/users/me/gesture-lock", {
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

  unbindContact(payload: { channel: number; code?: string }) {
    return request<UserMeDTO>("/users/me/unbind-contact", {
      method: "DELETE",
      auth: true,
      body: payload,
    });
  },

  getSwitchAccounts(signal?: AbortSignal) {
    return request<SwitchAccountDTO[]>("/users/me/switch-accounts", { auth: true, signal });
  },

  createAccountSwitchTicket(user_id: number) {
    return request<AccountSwitchTicketDTO>("/users/me/switch-account", {
      method: "POST",
      auth: true,
      body: { user_id },
    });
  },

  exchangeAccountSwitchTicket(ticket: string) {
    return request<JoinResponseDTO>("/users/switch-account/exchange", {
      method: "POST",
      body: { ticket },
    });
  },

  updatePrivateAccount(enabled: boolean) {
    return request<UserMeDTO>("/users/me/private-account", {
      method: "POST",
      auth: true,
      body: { enabled: enabled ? 1 : 0 },
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

  updatePlazaGreeting(plaza_greeting: string) {
    return request<{ plaza_greeting: string }>("/users/me/plaza-greeting", {
      method: "POST",
      auth: true,
      body: { plaza_greeting },
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

  createChatBackgroundUpload(file_name: string, content_type?: string) {
    return request<{
      upload_token: string;
      upload_url: string;
      key: string;
      resource_uri: string;
      expires_in: number;
      max_file_size: number;
    }>("/users/me/chat-background/upload", {
      method: "POST",
      auth: true,
      body: { file_name, content_type },
    });
  },

  setChatBackground(theme: import("../types").ChatBackgroundTheme, key = "") {
    return request<UserMeDTO>("/users/me/chat-background", {
      method: "POST",
      auth: true,
      body: { theme, key },
    });
  },

  setPersonalization(payload: PersonalizationDTO) {
    return request<UserMeDTO>("/users/me/personalization", {
      method: "POST",
      auth: true,
      body: payload,
    });
  },

  setLanguagePreference(language_preference: "system" | "en" | "zh-CN", system_language: "en" | "zh-CN") {
    return request<UserMeDTO>("/users/me/language", {
      method: "POST",
      auth: true,
      body: { language_preference, system_language },
    });
  },
};
