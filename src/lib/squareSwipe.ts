export type SquareChannel='activities'|'all'|'friends'|'mine'|'user';
export function squareSwipeDirection(dx:number,dy:number,elapsed:number,width:number): -1|1|null {
  if(elapsed<0||elapsed>900||Math.abs(dx)<Math.max(48,Math.min(80,width*.15))||Math.abs(dx)<Math.abs(dy)*1.5)return null;
  return dx<0?1:-1;
}
export function adjacentSquareChannel(channels:SquareChannel[],current:SquareChannel,direction:-1|1){
  const index=channels.indexOf(current);return index<0?null:channels[index+direction]??null;
}
