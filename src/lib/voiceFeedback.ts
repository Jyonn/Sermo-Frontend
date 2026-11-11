/** Blocking eligibility/permission decisions stay visible; transient failures use Toast. */
export function voiceFeedbackSurface(reason: string): 'modal' | 'toast' {
  return ['vip_required','quota_empty','peer_quota_empty','phone_required','microphone','forbidden'].includes(reason) ? 'modal' : 'toast';
}
