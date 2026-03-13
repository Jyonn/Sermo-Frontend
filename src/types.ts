export type EntryMode = "create" | "login" | "join";
export type NotificationChannel = "email" | "sms" | "bark";
export type MobileNavKey = "chats" | "friends" | "space" | "settings";
export type FriendTab = "incoming" | "outgoing" | "accepted";
export type AppViewState = "idle" | "loading" | "ready" | "error";

export interface ApiEnvelope<T> {
  identifier: string;
  message: string;
  user_message?: string;
  body: T;
}

export interface TinyUserDTO {
  user_id: number;
  name: string;
}

export interface UserDTO extends TinyUserDTO {
  is_alive: boolean;
  verified: boolean;
  last_heartbeat: number;
  email_verified_at: number | null;
  phone_verified_at: number | null;
  bark_verified_at: number | null;
}

export interface SpaceDTO {
  space_id: number;
  name: string;
  slug: string;
  email: string;
  email_verified_at: number | null;
  group_square_enabled?: boolean;
  created_at?: number;
}

export interface AccessPayload {
  user_id: number;
  name: string;
  space_id: number;
  expire?: number;
  time?: number;
  type?: string;
}

export interface LoginAuthDTO {
  auth: string;
  refresh: string;
  data: AccessPayload;
}

export interface SpaceAuthDTO {
  auth: string;
  data: Record<string, unknown>;
}

export interface JoinResponseDTO {
  space: SpaceDTO;
  auth: LoginAuthDTO;
}

export interface NotificationPreferenceDTO {
  channel: number;
  enabled: boolean;
  offline_threshold_minutes: number;
}

export interface FriendshipRequestDTO {
  request_id: number;
  status: number;
  is_system_locked: boolean;
  from_user: TinyUserDTO;
  to_user: TinyUserDTO;
  created_at: number;
  updated_at: number;
  responded_at: number | null;
}

export interface ChatMessageDTO {
  message_id: number;
  user: TinyUserDTO;
  type: number;
  content: string;
  created_at: number;
}

export interface ChatDTO {
  chat_id: number;
  chat_type: number;
  title: string | null;
  owner: TinyUserDTO | null;
  members: UserDTO[];
  group: boolean;
  created_at: number;
  last_chat_at: number;
  last_message: ChatMessageDTO | null;
  unread_count?: number;
  last_read_at?: number | null;
}

export interface AuthSession {
  accessToken: string;
  refreshToken: string;
  user: AccessPayload;
}

export interface ChatMessage {
  id: number | string;
  from: "self" | "other";
  name: string;
  time: string;
  text: string;
}

export interface ChatDetail {
  summary: string;
  relation: string;
  actions: string[];
}

export interface Chat {
  id: number;
  title: string;
  subtitle: string;
  preview: string;
  time: string;
  unread: number;
  online: boolean;
  members: number;
  type: "direct" | "group";
  detail: ChatDetail;
  messages: ChatMessage[];
}

export interface FriendRequest {
  id: number;
  name: string;
  time: string;
  level: "Basic" | "Verified";
  note: string;
}

export interface FriendAccepted {
  id: number;
  name: string;
  status: string;
  mood: string;
}

export interface FriendRequestState {
  incoming: FriendRequest[];
  outgoing: FriendRequest[];
  accepted: FriendAccepted[];
}

export interface SpaceUser {
  id: number;
  name: string;
  level: "Basic" | "Verified";
  online: boolean;
  bio: string;
}

export interface NotificationPreference {
  enabled: boolean;
  threshold: number;
}

export type NotificationPreferences = Record<NotificationChannel, NotificationPreference>;

export type Contacts = Record<NotificationChannel, string>;
