import type { UserMeDTO } from '../types';

export function researchCreateRestriction(me:Pick<UserMeDTO,'growth'|'growth_level'|'verified'>) {
  const capability=me.growth?.capabilities?.['chat.group.create'];
  if(!capability||capability.available)return null;
  const level=capability.required_level;
  const current=me.growth?.level??me.growth_level??1;
  if(current<level)return {
    key:me.verified?'research.createNeedsLevel' as const:'research.createNeedsLevelAndVerification' as const,
    values:{level,current},
  };
  return {key:!me.verified?'research.createNeedsVerification' as const:'research.createDenied' as const,values:{level,current}};
}
