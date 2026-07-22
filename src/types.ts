export type NotificationChannel = "email" | "sms" | "bark";
export type FriendTab = "incoming" | "outgoing" | "accepted";
export type AppViewState = "idle" | "loading" | "ready" | "error";
export type MessageMediaKind = "image" | "video" | "audio" | "file";
export type MessageKind = "text" | "image" | "video" | "audio" | "file" | "system";
export type LinkPreviewStatus = "none" | "pending" | "ready" | "failed";

export interface ApiEnvelope<T> {
  identifier: string;
  message: string;
  user_message?: string;
  body: T;
}

export interface TinyUserDTO {
  user_id: number;
  name: string;
  official?: boolean;
  avatar_type?: "preset" | "custom";
  avatar_uri?: string;
}

export interface UserDTO extends TinyUserDTO {
  is_alive: boolean;
  verified: boolean;
  last_heartbeat: number;
  is_deleted?: boolean;
  has_removal_residue?: boolean;
  responded_at?: number | null;
  name_pinyin?: string | null;
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
  official_user?: TinyUserDTO | null;
  group_square_enabled?: boolean;
  member_limit?: number | null;
  created_at?: number;
}

export interface AccessPayload {
  user_id: number;
  name: string;
  space_id: number;
  has_password?: boolean;
  official?: boolean;
  verified?: boolean;
  avatar_type?: "preset" | "custom";
  avatar_uri?: string;
  welcome_message?: string;
  email?: string | null;
  phone?: string | null;
  bark?: string | null;
  last_heartbeat?: number;
  email_verified_at?: number | null;
  phone_verified_at?: number | null;
  bark_verified_at?: number | null;
  expire?: number;
  time?: number;
  type?: string;
  language?: string;
}

export interface UserMeDTO extends UserDTO {
  has_password: boolean;
  official?: boolean;
  language?: string;
  welcome_message?: string;
  email?: string | null;
  phone?: string | null;
  bark?: string | null;
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

export interface SpaceEmailCodeDTO {
  expires_in: number;
  masked_email: string;
}

export interface OfficialLoginTicketDTO {
  token: string;
  expires_in: number;
}

export interface SpaceAdminSession {
  accessToken: string;
  space: SpaceDTO;
}

export interface SpaceAdminDashboardDTO {
  space: SpaceDTO;
  stats: {
    members_count: number;
    online_count: number;
  };
}

export interface JoinResponseDTO {
  space: SpaceDTO;
  auth: LoginAuthDTO;
}

export interface NotificationPreferenceDTO {
  channel: number;
  enabled: boolean;
  offline_threshold_minutes: number;
  hide_message_content: boolean;
  hidden_direct_message_text: string;
  hidden_group_message_text: string;
  friend_online_message_text: string;
  open_chat_on_tap: boolean;
}

export interface WebReminderPreferenceDTO {
  sound_enabled: boolean;
  title_enabled: boolean;
}

export interface GestureLockPreferenceDTO {
  enabled: boolean;
  pattern_hash: string;
  salt: string;
  decoy_enabled: boolean;
  decoy_pattern_hash: string;
  decoy_salt: string;
  lock_after_minutes: number;
}

export interface AvatarUploadDTO {
  upload_token: string;
  upload_url: string;
  key: string;
  avatar_uri: string;
  expires_in: number;
  max_file_size: number;
}

export interface MessageUploadDTO {
  kind: MessageMediaKind;
  upload_token: string;
  upload_url: string;
  key: string;
  resource_uri: string;
  expires_in: number;
  max_file_size: number;
}

export interface LinkPreviewDTO {
  url?: string;
  status: LinkPreviewStatus;
  title?: string;
  description?: string;
  image_url?: string;
  site_name?: string;
  favicon_url?: string;
}

export interface ChatMessagePayloadDTO {
  kind: MessageKind;
  text?: string;
  uri?: string;
  thumbnail_uri?: string;
  mime_type?: string;
  duration_seconds?: number;
  file_name?: string;
  file_size?: number;
  link_preview?: LinkPreviewDTO | null;
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

export interface FriendshipStatusDTO {
  is_friend: boolean;
  friendship?: FriendshipRequestDTO;
}

export interface FriendInvitePreviewDTO {
  inviter: TinyUserDTO;
  space: SpaceDTO;
  expire: number | null;
  permanent: boolean;
}

export interface ChatMessageDTO {
  message_id: number;
  user: TinyUserDTO;
  type: number;
  content: string;
  payload?: ChatMessagePayloadDTO | null;
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
  pinned?: boolean;
  online_reminder_enabled?: boolean;
}

export interface ChatPreferenceDTO {
  pinned: boolean;
  online_reminder_enabled: boolean;
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
  type: number;
  kind: MessageKind;
  name: string;
  avatarUri?: string;
  time: string;
  createdAt: number;
  text: string;
  payload?: ChatMessagePayloadDTO | null;
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
    isOwner: boolean;
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
  pinned: boolean;
  onlineReminderEnabled: boolean;
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
  hideMessageContent: boolean;
  hiddenDirectMessageText: string;
  hiddenGroupMessageText: string;
  friendOnlineMessageText: string;
  openChatOnTap: boolean;
}

export type NotificationPreferences = Record<NotificationChannel, NotificationPreference>;
