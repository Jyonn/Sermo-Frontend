export type NotificationChannel = "email" | "sms" | "bark";
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
  avatar_type?: "preset" | "custom";
  avatar_uri?: string;
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
  avatar_type?: "preset" | "custom";
  avatar_uri?: string;
  expire?: number;
  time?: number;
  type?: string;
  language?: string;
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

export interface ChatSyncItemDTO {
  chat_id: number;
  message: ChatMessageDTO;
}

export interface ChatSyncResponseDTO {
  after_message_id?: number;
  next_after?: number;
  items: ChatSyncItemDTO[];
  has_more: boolean;
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
  clientId: string;
  from: "self" | "other";
  name: string;
  avatarUri?: string;
  time: string;
  createdAt: number;
  text: string;
  status: "sent" | "pending" | "failed";
}

export interface ChatDetail {
  summary: string;
  relation: string;
  actions: string[];
  members: Array<{
    userId: number;
    name: string;
    avatarUri?: string;
    isSelf: boolean;
  }>;
}

export interface Chat {
  id: number;
  title: string;
  avatarUri?: string;
  subtitle: string;
  preview: string;
  time: string;
  lastActivity: number;
  unread: number;
  online: boolean;
  verified: boolean;
  members: number;
  type: "direct" | "group";
  isOwner: boolean;
  detail: ChatDetail;
  messages: ChatMessage[];
}

export interface FriendAccepted {
  id: number;
  name: string;
  avatarUri?: string;
  status: string;
  mood: string;
  verified: boolean;
}

export interface NotificationPreference {
  enabled: boolean;
  threshold: number;
}

export type NotificationPreferences = Record<NotificationChannel, NotificationPreference>;
