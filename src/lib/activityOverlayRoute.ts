import {LANDLORD_KEY, LANDLORD_ROOM_PARAM} from './landlord';

export function activityKeyFromSearch(search:string):string|null {
  const key=new URLSearchParams(search).get('activity');
  return key&&/^[a-zA-Z0-9_-]{1,120}$/.test(key)?key:null;
}
export function activityOverlaySearch(search:string,key:string|null,room?:string) {
  const params=new URLSearchParams(search);
  if(key)params.set('activity',key);else params.delete('activity');
  if(key===LANDLORD_KEY&&room)params.set(LANDLORD_ROOM_PARAM,room);else params.delete(LANDLORD_ROOM_PARAM);
  const query=params.toString();
  return query?`?${query}`:'';
}
