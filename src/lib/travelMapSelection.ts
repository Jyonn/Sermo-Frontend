export function selectedMapOwners<T extends {owner:{user_id:number}}>(maps:T[],selected:number[]|null,currentUserId?:number):T[]{
  return maps.filter(item=>item.owner.user_id===currentUserId||selected===null||selected.includes(item.owner.user_id));
}
export function toggleMapOwner(selected:number[]|null,id:number,currentUserId:number|undefined,all:number[]):number[]{
  const ids=selected??all;
  if(id===currentUserId)return ids;
  return ids.includes(id)?ids.filter(value=>value!==id):[...ids,id];
}
