import type {StickerAssetDTO} from '../types';
export interface StickerSeriesDTO {series_id:number;name:string;count:number;status:'draft'|'pending'|'approved'|'rejected';published:boolean;review_note:string;has_changes:boolean;descriptions?:Record<string,string>;missing_descriptions?:number;assets:StickerAssetDTO[];pending_snapshot?:{action:string;name:string;asset_ids:number[];descriptions?:Record<string,string>};owner?:{name:string};}
export function validStickerDescription(value:string) {
  const text=value.trim();
  return Boolean(text)&&Array.from(text).reduce((n,c)=>n+(c.codePointAt(0)!<128?1:2),0)<=16&&!/\p{C}/u.test(text);
}
export function validStickerSeriesName(name:string) {
  const value=name.trim();
  return Boolean(value)&&Array.from(value).reduce((sum,c)=>sum+(c.codePointAt(0)!<128?1:2),0)<=10&&/^[\p{L}\p{N} _-]+$/u.test(value);
}
