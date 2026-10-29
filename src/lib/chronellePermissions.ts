export type CalendarVisibility = 'hidden' | 'busy' | 'detail';
export type CalendarAudience = 'strangers' | 'friends';
export type AudiencePolicy = {default:CalendarVisibility;overrides:Record<string,CalendarVisibility>};
export type CalendarPermissions = Record<CalendarAudience,AudiencePolicy>;
export type ChronellePermissionsSetup = {status:string;groups:{id:number;name:string}[];audiences?:CalendarPermissions;review_required?:boolean};
export const visibilityRank:Record<CalendarVisibility,number>={hidden:0,busy:1,detail:2};
export function permissionMode(policy:AudiencePolicy,id?:number|string){return id===undefined?policy.default:policy.overrides[String(id)]??policy.default;}
export function changeCalendarPermission(current:CalendarPermissions,tier:CalendarAudience,mode:CalendarVisibility|'inherit',id?:number):CalendarPermissions{
  const next:CalendarPermissions=structuredClone(current);
  if(id===undefined&&mode!=='inherit')next[tier]={default:mode,overrides:{}};
  else if(id!==undefined){if(mode==='inherit')delete next[tier].overrides[String(id)];else next[tier].overrides[String(id)]=mode;}
  if(visibilityRank[next.friends.default]<visibilityRank[next.strangers.default])next.friends.default=next.strangers.default;
  for(const key of new Set([...Object.keys(next.strangers.overrides),...Object.keys(next.friends.overrides)])){
    if(visibilityRank[permissionMode(next.friends,key)]<visibilityRank[permissionMode(next.strangers,key)])next.friends.overrides[key]=permissionMode(next.strangers,key);
  }
  return next;
}
