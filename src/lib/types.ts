export type UserTiny = {
  name: string
  user_id: number
}

export type HostUser = {
  name: string
  user_id: number
  is_alive: boolean
  guest: boolean
  last_heartbeat: number
  description?: string | null
  subdomain?: string | null
}

export type GuestUser = {
  name: string
  user_id: number
  is_alive: boolean
  guest: boolean
  last_heartbeat: number
}

export type Message = {
  message_id: number
  user: UserTiny
  type: number
  content: string
  created_at: number
}

export type ChatBase = {
  chat_id: number
  created_at: number
  last_chat_at: number
  group: boolean
  host: HostUser
  last_message?: Message | null
  unread_count?: number
  last_read_at?: number | null
}

export type SingleChat = ChatBase & {
  group: false
  guest: GuestUser
}

export type GroupChat = ChatBase & {
  group: true
  guests: GuestUser[]
  name: string
}

export type Chat = SingleChat | GroupChat

export type AuthTokens = {
  auth: string
  refresh: string
  data: Record<string, unknown>
}

export type NicknameCheck = {
  available: boolean
  reason?: string
}

export enum MessageType {
  TEXT = 0,
  IMAGE = 1,
  FILE = 2,
  SYSTEM = 3,
}
