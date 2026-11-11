import type { TinyUserDTO } from '../types';

export const voiceCallsEnabled = import.meta.env.DEV || import.meta.env.VITE_VOICE_CALLS_ENABLED === '1';
export type VoiceState = 'ringing' | 'connecting' | 'active' | 'ended';
export interface VoiceCallRecord {
  kind: 'voice_call';
  call_id: string;
  chat_id: number;
  caller_id: number;
  callee_id: number;
  state: VoiceState;
  reason: string;
  max_seconds: number;
  duration_seconds: number;
  connected_at: number | null;
  deadline_at: number | null;
}
export interface VoiceCall extends VoiceCallRecord {
  peer: TinyUserDTO;
  owned: boolean;
  expires_at: number;
  server_now: number;
  message_id: number;
}
export interface VoiceCapability {
  enabled: boolean;
  can_call: boolean;
  reason: string;
  remaining_seconds: number;
  max_seconds: number;
  reset_at: number;
  peer: TinyUserDTO;
  chat_id: number;
}
export function voiceTime(seconds: number) {
  const value = Math.max(0, Math.floor(seconds));
  return `${String(Math.floor(value / 60)).padStart(2, '0')}:${String(value % 60).padStart(2, '0')}`;
}
const endedLabels = {cancelled:'voice.cancelled', declined:'voice.declined', missed:'voice.missed', failed:'voice.failed',
  disconnected:'voice.disconnected', quota:'voice.quotaEnded', ineligible:'voice.ineligible'} as const;
const errorLabels = {vip_required:'voice.error.vip_required', quota_empty:'voice.error.quota_empty',peer_quota_empty:'voice.error.peer_quota_empty',
  phone_required:'voice.error.phone_required',same_person:'voice.error.same_person',busy:'voice.error.busy',other_device:'voice.error.other_device',
  unavailable:'voice.error.unavailable',forbidden:'voice.error.forbidden',expired:'voice.error.expired',microphone:'voice.error.microphone',network:'voice.error.network'} as const;
export function voiceErrorKey(reason:string) {return reason==='unsupported'?'voice.error.unsupported':errorLabels[reason as keyof typeof errorLabels]??'voice.error.network'}
export function voiceStatus(call: VoiceCallRecord, incoming = false) {
  if (call.state === 'ringing') return incoming ? 'voice.incoming' : 'voice.ringing';
  if (call.state === 'connecting') return 'voice.connecting';
  if (call.state === 'active') return 'voice.active';
  return endedLabels[call.reason as keyof typeof endedLabels] || 'voice.ended';
}
export function openVoiceCall(chatId: number) {
  window.dispatchEvent(new CustomEvent('frienden:voice-open', {detail:{chatId}}));
}
