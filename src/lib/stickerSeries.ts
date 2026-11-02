import type {StickerAssetDTO} from '../types';
export interface StickerSeriesDTO {series_id:number;name:string;count:number;status:'draft'|'pending'|'approved'|'rejected';published:boolean;review_note:string;has_changes:boolean;assets:StickerAssetDTO[];pending_snapshot?:{action:string;name:string;asset_ids:number[]};owner?:{name:string};}
export function validStickerSeriesName(name:string) {
  const value=name.trim();
  return Boolean(value)&&Array.from(value).reduce((sum,c)=>sum+(c.codePointAt(0)!<128?1:2),0)<=10&&/^[\p{L}\p{N} _-]+$/u.test(value);
}
