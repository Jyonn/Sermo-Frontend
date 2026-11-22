import type { CloudResourceQuotaDTO, SquareQuotaDTO } from '../types';

export type PermissionReason = 'space_disabled' | 'unavailable' | 'vip_required' | 'phone_required' |
  'muted' | 'voice_reserved' | 'exhausted' | 'publishing_disabled' | 'restricted' |
  'verification_required' | 'space_verification_required' | 'level_required';

export type PersonalPermission = {
  allowed: boolean;
  reason: PermissionReason | null;
  required_level?: number;
  until?: number | null;
};

export interface PersonalPermissionQuotaSnapshot {
  account: { user_id: number; space_id: number; space_name: string; level: number; vip: boolean };
  chat: {
    enabled: boolean;
    voice: {
      limit: number;
      reset_at: number;
      reason: PermissionReason | null;
      usage: { used: number; reserved: number; remaining: number } | null;
    };
    storage: CloudResourceQuotaDTO;
    send: Record<'image' | 'audio' | 'video' | 'file' | 'location', PersonalPermission>;
    group: Record<'create' | 'join' | 'send' | 'invite' | 'rename', PersonalPermission>;
    download_voice: PersonalPermission;
  };
  square: {
    enabled: boolean;
    quota: SquareQuotaDTO | null;
    publish: PersonalPermission;
    media: Record<'text' | 'image' | 'audio' | 'video', PersonalPermission>;
    comment: PersonalPermission;
    reply: PersonalPermission;
    like: PersonalPermission;
  };
  social: { limit: number; used: number; remaining: number; reset_at: number; reason: PermissionReason | null };
  research: { enabled: boolean; create: PersonalPermission };
}
