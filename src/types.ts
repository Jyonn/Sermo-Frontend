export type NotificationChannel = "email" | "sms" | "bark";
export type FriendTab = "incoming" | "outgoing" | "accepted";
export type AppViewState = "idle" | "loading" | "ready" | "error";
export type MessageMediaKind = "image" | "video" | "audio" | "file";
export type MessageKind = "text" | "image" | "video" | "audio" | "file" | "location" | "map_access" | "system";
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
  is_permanent_vip?: boolean;
  chat_bubble_style?: ChatBubbleStyle;
  avatar_frame_style?: AvatarFrameStyle;
  square_outfit_style?: SquareOutfitStyle;
  square_prop_style?: SquarePropStyle;
  square_motion_style?: SquareMotionStyle;
  square_limb_style?: SquareLimbStyle;
}

export interface UserDTO extends TinyUserDTO {
  is_alive: boolean;
  verified: boolean;
  last_heartbeat: number;
  welcome_message?: string;
  plaza_greeting?: string;
  growth_level?: number;
  growth_level_name?: string;
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
  level_names?: string[];
  created_at?: number;
}

export interface UserGrowthDTO {
  score: number;
  level: number;
  acknowledged_level?: number;
  pending_level?: number | null;
  name: string;
  next_score: number | null;
  progress: number;
  privileges: string[];
  level_cap?: number;
  level_cap_reason?: string;
  recent_events?: Array<{
    key: string;
    category: "daily" | "explore" | "social" | "security";
    title: string;
    points: number;
    created_at: number;
  }>;
  daily_chat?: {
    earned: number;
    limit: number;
  };
  milestones?: Array<{
    key: string;
    category: "explore" | "social" | "security";
    title: string;
    points: number;
    earned: boolean;
  }>;
  levels?: Array<{
    level: number;
    name: string;
    score: number;
    unlocks: string[];
    unlocked: boolean;
  }>;
  capabilities?: Record<string, {
    required_level: number;
    available: boolean;
  }>;
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
  email_unbound_at?: number | null;
  phone_unbound_at?: number | null;
  bark_unbound_at?: number | null;
  is_private_account?: boolean;
  is_permanent_vip?: boolean;
  chat_bubble_style?: ChatBubbleStyle;
  avatar_frame_style?: AvatarFrameStyle;
  square_outfit_style?: SquareOutfitStyle;
  square_prop_style?: SquarePropStyle;
  square_motion_style?: SquareMotionStyle;
  square_limb_style?: SquareLimbStyle;
  expire?: number;
  time?: number;
  type?: string;
  language?: string;
  language_preference?: "system" | "en" | "zh-CN";
}

export interface UserMeDTO extends UserDTO {
  has_password: boolean;
  official?: boolean;
  language?: string;
  language_preference?: "system" | "en" | "zh-CN";
  welcome_message?: string;
  email?: string | null;
  phone?: string | null;
  bark?: string | null;
  email_unbound_at?: number | null;
  phone_unbound_at?: number | null;
  bark_unbound_at?: number | null;
  is_private_account: boolean;
  is_permanent_vip?: boolean;
  permanent_vip_campaign?: PermanentVipCampaignDTO;
  growth?: UserGrowthDTO;
  plaza_greeting?: string;
  name_changed_at?: number | null;
  nickname_change?: {
    interval_days: number | null;
    available_at: number | null;
  };
  chat_background_theme?: "default" | "paper" | "mint" | "dusk" | "comic" | "custom";
  chat_background_uri?: string;
}

export type ChatBubbleStyle = "default" | "comic" | "vip";
export type AvatarFrameStyle = "none" | "orbit" | "blaze" | "pixel";
export type SquareOutfitStyle = "sunset" | "varsity" | "noir" | "cloud";
export type SquarePropStyle = "none" | "star" | "coffee" | "flag";
export type SquareMotionStyle = "walk" | "bounce" | "float" | "dash";
export type SquareLimbStyle = "line" | "chunky" | "robot" | "ribbon";

export interface PersonalizationDTO {
  chat_bubble_style: ChatBubbleStyle;
  avatar_frame_style: AvatarFrameStyle;
  square_outfit_style: SquareOutfitStyle;
  square_prop_style: SquarePropStyle;
  square_motion_style: SquareMotionStyle;
  square_limb_style: SquareLimbStyle;
}

export interface PermanentVipCampaignDTO {
  limit: number;
  claimed: number;
  remaining: number;
  eligible: boolean;
  required_level: number;
  claimed_by_user: boolean;
  slot: number | null;
  active: boolean;
  requirements: {
    email: boolean;
    phone: boolean;
    level: boolean;
  };
}

export interface SwitchAccountDTO {
  user: TinyUserDTO;
  space: SpaceDTO;
}

export interface AccountSwitchTicketDTO {
  token: string;
  expires_in: number;
  space: SpaceDTO;
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

export interface AdminMemberContactDTO {
  bound: boolean;
  verified: boolean;
}

export interface AdminMemberDTO extends UserDTO {
  contacts: {
    email: AdminMemberContactDTO;
    sms: AdminMemberContactDTO;
    bark: AdminMemberContactDTO;
  };
  notification_preferences: Array<{
    channel: number;
    enabled: boolean;
    offline_threshold_minutes: number;
  }>;
}

export interface SpaceAdminBroadcastResultDTO {
  recipients_count: number;
  sent_count: number;
  duplicate_count: number;
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
  hidden_direct_message_title: string;
  hidden_direct_message_text: string;
  hidden_group_message_title: string;
  hidden_group_message_text: string;
  friend_online_message_title: string;
  friend_online_message_text: string;
  open_chat_on_tap: boolean;
  bark_icon_mode: 0 | 1 | 2;
}

export interface WebReminderPreferenceDTO {
  sound_enabled: boolean;
  title_enabled: boolean;
}

export interface EmojiUsageDTO {
  emoji: string;
  use_count: number;
  last_used_at: number;
}

export interface WebPushSubscriptionDTO {
  endpoint: string;
  origin: string;
  enabled: boolean;
  last_seen_at: string;
}

export interface WebPushInfoDTO {
  public_key: string;
  subscriptions: WebPushSubscriptionDTO[];
}

export interface GestureLockPreferenceDTO {
  enabled: boolean;
  pattern_hash: string;
  salt: string;
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
  image_metadata?: ImageMetadataDTO | null;
  video_metadata?: VideoMetadataDTO | null;
  latitude?: number;
  longitude?: number;
  address?: string;
  geocoding_provider?: string;
  obscured?: boolean;
  obscure_radius_km?: number;
  owner?: TinyUserDTO;
  target_user_id?: number;
  access?: TravelMapAccessDTO;
  chat_grant?: boolean;
  chat_access?: ChatTravelMapAccessDTO;
}

export interface TravelMapRegionDTO {
  region_code: string;
  region_name: string;
  country_code: string;
  country_name: string;
  checked_at: number;
}

export interface TravelMapAccessDTO {
  can_view_theirs: boolean;
  they_can_view_mine: boolean;
}

export interface MyTravelMapDTO {
  owner: TinyUserDTO;
  regions: TravelMapRegionDTO[];
}

export interface TravelMapCheckInDTO extends MyTravelMapDTO {
  checked_region: TravelMapRegionDTO;
}

export interface ChatTravelMapAccessDTO {
  authorized_by_me: boolean;
  shared_members: TinyUserDTO[];
  invitation_message?: ChatMessageDTO;
}

export interface ChatTravelMapDTO {
  chat_id: number;
  authorized_by_me: boolean;
  maps: Array<{
    owner: TinyUserDTO;
    regions: TravelMapRegionDTO[];
  }>;
}

export interface TravelMapAccessOverviewEntryDTO {
  chat_id: number;
  chat_type: "direct" | "group";
  title: string;
  users: TinyUserDTO[];
}

export interface TravelMapAccessOverviewDTO {
  shared_by_me: TravelMapAccessOverviewEntryDTO[];
  shared_with_me: TravelMapAccessOverviewEntryDTO[];
}

export interface TravelMapComparisonDTO {
  me: TinyUserDTO;
  other: TinyUserDTO;
  my_regions: TravelMapRegionDTO[];
  other_regions: TravelMapRegionDTO[];
  access: TravelMapAccessDTO;
}

export interface ImageMetadataDTO {
  status: number;
  make?: string;
  model?: string;
  lens_model?: string;
  software?: string;
  taken_at?: number | null;
  file_size?: number | null;
  pixel_width?: number | null;
  pixel_height?: number | null;
  latitude?: number | null;
  longitude?: number | null;
  address?: string;
  geocoding_provider?: "amap" | "opencage" | "nominatim" | string;
  geocoding_status?: number;
}

export interface VideoMetadataDTO {
  status: number;
  duration_seconds?: number | null;
  file_size?: number | null;
  pixel_width?: number | null;
  pixel_height?: number | null;
  frame_rate?: number | null;
  bit_rate?: number | null;
  video_codec?: string;
  audio_codec?: string;
  make?: string;
  model?: string;
  lens_model?: string;
  software?: string;
  taken_at?: number | null;
  latitude?: number | null;
  longitude?: number | null;
  address?: string;
  geocoding_provider?: "amap" | "opencage" | "nominatim" | string;
  geocoding_status?: number;
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
  client_message_id?: string | null;
  user: TinyUserDTO;
  type: number;
  content: string;
  payload?: ChatMessagePayloadDTO | null;
  reply_to?: QuotedMessageDTO | null;
  created_at: number;
}

export interface PinnedMessageDTO {
  pin_id: number;
  message: ChatMessageDTO;
  pinned_by_users: TinyUserDTO[];
  pinned_at: number;
}

export interface QuotedMessageDTO {
  message_id: number;
  user: TinyUserDTO;
  type: number;
  content: string;
  is_deleted: boolean;
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
  userId?: number;
  from: "self" | "other";
  type: number;
  kind: MessageKind;
  name: string;
  avatarUri?: string;
  isPermanentVip?: boolean;
  chatBubbleStyle?: ChatBubbleStyle;
  avatarFrameStyle?: AvatarFrameStyle;
  time: string;
  createdAt: number;
  text: string;
  payload?: ChatMessagePayloadDTO | null;
  localPreviewUri?: string;
  replyTo?: QuotedMessageDTO | null;
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
    avatarFrameStyle?: AvatarFrameStyle;
    isSelf: boolean;
    isOwner: boolean;
  }>;
}

export interface Chat {
  id: number;
  title: string;
  avatarUri?: string;
  avatarFrameStyle?: AvatarFrameStyle;
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
  hiddenDirectMessageTitle: string;
  hiddenDirectMessageText: string;
  hiddenGroupMessageTitle: string;
  hiddenGroupMessageText: string;
  friendOnlineMessageTitle: string;
  friendOnlineMessageText: string;
  openChatOnTap: boolean;
  barkIconMode: 0 | 1 | 2;
}

export type NotificationPreferences = Record<NotificationChannel, NotificationPreference>;
