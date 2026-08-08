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
  growth_level?: number;
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
  score_level?: number;
  effective_level?: number;
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
    category: "daily" | "weekly" | "explore" | "social" | "security" | "achievement" | "vip";
    title: string;
    points: number;
    created_at: number;
  }>;
  daily?: {
    earned: number;
    limit: number;
  };
  weekly?: {
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
    rewards: GrowthRewardDTO[];
    unlocked: boolean;
  }>;
  capabilities?: Record<string, {
    required_level: number;
    available: boolean;
  }>;
}

export interface GrowthRewardDTO {
  id: string;
  level: number;
  category: "capability" | "background" | "bubble" | "frame" | "identity";
  title: string;
  title_key?: string;
  description_key?: string;
  rarity: "common" | "uncommon" | "rare" | "epic" | "legendary";
  asset_key?: string | null;
  capability_key?: string | null;
  implementation_status: "live" | "partial" | "planned" | "available";
  preview_kind?: "live" | "image" | "before_after" | "collection";
  destination?: string;
  vip_exclusive?: boolean;
  vip_access?: "exclusive" | "early_preview" | "level_or_vip" | null;
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
  growth_level?: number;
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
  chat_background_theme?: ChatBackgroundTheme;
  chat_background_uri?: string;
}

export type ChatBubbleStyle = "default" | "comic" | "vip" | "niko" | "fufu" | "xiaobai" | "zen" | "hero" | "dragon" | "bauhaus" | "mosaic" | "typewriter" | "newspaper" | "receipt" | "sticker" | "toybrick";
export type ChatBackgroundTheme = "default" | "paper" | "mint" | "dusk" | "comic" | "zen" | "hero" | "dragon" | "bauhaus" | "mosaic" | "tidepool" | "forest" | "desert" | "snowfield" | "sakura" | "sunrise" | "midnight" | "rain" | "galaxy" | "aurora-sky" | "linen" | "terrazzo" | "blueprint" | "newsprint" | "hologram" | "arcade" | "jazz" | "spaceport" | "candy" | "noir-film" | "custom";
export type AvatarFrameStyle = "none" | "orbit" | "aurora" | "polaroid" | "soundwave" | "portal" | "butterfly" | "moon" | "camera" | "comet" | "snowfall" | "papercut" | "mechanical" | "niko-run" | "fufu-wave" | "xiaobai-run" | "vip";
export interface PersonalizationDTO {
  chat_bubble_style: ChatBubbleStyle;
  avatar_frame_style: AvatarFrameStyle;
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

export interface NotificationTopicPreferenceDTO {
  channel: 0 | 1 | 2 | 3;
  topic: 1 | 2 | 3 | 4 | 5 | 6;
  audience: 0 | 1 | 2;
  enabled: boolean;
}

export interface NotificationEventDTO {
  notification_event_id: number;
  event_type: number;
  topic: number | null;
  audience: number;
  actor: TinyUserDTO | null;
  payload: { statement_id?: number; comment_id?: number };
  is_read: boolean;
  created_at: number;
}

export interface NotificationEventListDTO {
  events: NotificationEventDTO[];
  unread_count: number;
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

export interface SquareStatementMediaDTO {
  media_id: number;
  kind: "image" | "audio" | "video";
  uri: string;
  thumbnail_uri?: string | null;
  mime_type?: string;
  duration_seconds?: number | null;
  location?: {
    latitude: number;
    longitude: number;
    address?: string;
  } | null;
  metadata_status?: number;
  metadata?: ImageMetadataDTO | VideoMetadataDTO | null;
}

export interface SquareStatementDTO {
  statement_id: number;
  user: TinyUserDTO;
  text: string;
  visibility: "public" | "friends";
  media: SquareStatementMediaDTO[];
  comment_count: number;
  like_count: number;
  liked: boolean;
  can_delete: boolean;
  created_at: number;
}

export interface SquareStatementCommentDTO {
  comment_id: number;
  statement_id: number;
  user: TinyUserDTO;
  text: string;
  parent_id?: number | null;
  like_count: number;
  reply_count: number;
  liked: boolean;
  replies?: SquareStatementCommentDTO[];
  created_at: number;
}

export interface SquareStatementDraftMedia {
  kind: "image" | "audio" | "video";
  key: string;
  mime_type?: string;
  duration_seconds?: number;
  location?: {
    latitude: number;
    longitude: number;
    address?: string;
  };
}

export interface SquareQuotaDTO {
  level: number;
  verified: boolean;
  unlimited: boolean;
  statements: {
    daily_used: number;
    daily_limit: number | null;
    weekly_used: number;
    weekly_limit: number | null;
  };
  comments: {
    daily_used: number;
    daily_limit: number | null;
    weekly_used: number;
    weekly_limit: number | null;
  };
  likes: {
    daily_used: number;
    unlimited: boolean;
  };
  media: {
    text: boolean;
    image: boolean;
    audio: boolean;
    audio_level: number;
    video: boolean;
    video_level: number;
  };
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

export interface MessageSearchResponseDTO {
  items: ChatMessageDTO[];
  has_more: boolean;
  next_before: number | null;
}

export interface QuotedMessageDTO {
  message_id: number;
  user: TinyUserDTO;
  type: number;
  content: string;
  is_deleted: boolean;
}

export interface MessageSyncEventDTO {
  event_id: number;
  type: "message.created" | "message.hidden" | "message.recalled";
  chat_id: number;
  message_id: number;
  message?: ChatMessageDTO;
}

export interface MessageEventSyncResponseDTO {
  events: MessageSyncEventDTO[];
  next_after: number;
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
  notifications_muted?: boolean;
}

export interface ChatPreferenceDTO {
  pinned: boolean;
  online_reminder_enabled: boolean;
  notifications_muted: boolean;
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
  notificationsMuted: boolean;
  detail: ChatDetail;
  messages: ChatMessage[];
}

export interface FriendAccepted {
  id: number;
  name: string;
  avatarUri?: string;
  avatarFrameStyle?: AvatarFrameStyle;
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
