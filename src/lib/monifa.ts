export function monifaShareUrl(value?:string|null){
  try{const u=new URL(value??'');return u.protocol==='https:'&&u.hostname==='monifa.jyonn.space'&&!u.username&&!u.password&&!u.port&&u.pathname==='/'&&!u.search&&/^#\/share\/[A-Za-z0-9_-]{32,128}$/.test(u.hash)?u.href:null}catch{return null}
}
export interface MonifaOtp {status:'ready'|'unavailable'|'error';code?:string;issuer?:string;accountName?:string;remaining?:number;period?:number}
