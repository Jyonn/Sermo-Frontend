import {LANDLORD_KEY, LANDLORD_ROOM_PARAM} from './landlord';
import {isFourPlayerGame, TABLE_ROOM_PARAM} from './tabletop';

export function activityRoomParam(key: string | null) {
  if (key === LANDLORD_KEY) return LANDLORD_ROOM_PARAM;
  if (isFourPlayerGame(key)) return TABLE_ROOM_PARAM;
  return null;
}

export function activityKeyFromSearch(search:string):string|null {
  const key=new URLSearchParams(search).get('activity');
  return key&&/^[a-zA-Z0-9_-]{1,120}$/.test(key)?key:null;
}
export function activityOverlaySearch(search:string,key:string|null,room?:string) {
  const params=new URLSearchParams(search);
  if(key)params.set('activity',key);else params.delete('activity');
  params.delete(LANDLORD_ROOM_PARAM);
  params.delete(TABLE_ROOM_PARAM);
  const roomParam=activityRoomParam(key);
  if(roomParam&&room)params.set(roomParam,room);
  const query=params.toString();
  return query?`?${query}`:'';
}
