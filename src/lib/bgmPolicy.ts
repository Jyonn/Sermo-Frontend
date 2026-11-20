import type { ActivityCampaignDTO } from '../types';

type Run = Pick<ActivityCampaignDTO, 'active' | 'starts_at' | 'ends_at'>;

export function bgmRunAvailable(activity: Run | null | undefined, now = Date.now()) {
  if (!activity?.active || !Number.isFinite(activity.starts_at) || activity.starts_at * 1000 > now) return false;
  return activity.ends_at === null || (Number.isFinite(activity.ends_at) && activity.ends_at * 1000 > now);
}

export function bgmDeadlineDelay(activity: Run | null | undefined, now = Date.now()) {
  if (!activity?.active || activity.ends_at === null || !Number.isFinite(activity.ends_at)) return null;
  return Math.min(2_147_483_647, Math.max(0, activity.ends_at * 1000 - now + 1));
}
