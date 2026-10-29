import type { ResearchResource } from './research';

export function formatResourceSize(bytes:number|null) {
  if(!bytes)return '0 B';
  const unit=bytes>=1024**3?'GB':bytes>=1024**2?'MB':bytes>=1024?'KB':'B';
  const divisor={B:1,KB:1024,MB:1024**2,GB:1024**3}[unit];
  return `${new Intl.NumberFormat(undefined,{maximumFractionDigits:1}).format(bytes/divisor)} ${unit}`;
}
export function resourceHost(url?:string|null){try{return new URL(url||'').hostname;}catch{return '';}}
export function resourceFileLabel(name:string){return name.includes('.')?name.split('.').pop()!.slice(0,6).toUpperCase():'FILE';}
export function visibleResources(items:ResearchResource[],parent:number|null,query:string,kind:string,sort:string) {
  const search=query.trim().toLocaleLowerCase();
  return items.filter(item=>(search?`${item.name} ${item.url||''}`.toLocaleLowerCase().includes(search):item.parent_id===parent)&&(kind==='all'||item.kind===kind))
    .sort((a,b)=>sort==='name'?a.name.localeCompare(b.name):b.created_at.localeCompare(a.created_at)||b.id-a.id);
}

export function resourcePath(items:ResearchResource[],parent:number|null) {
  const path:ResearchResource[]=[],seen=new Set<number>();
  let current=items.find(item=>item.id===parent);
  while(current&&!seen.has(current.id)) {
    seen.add(current.id);
    path.unshift(current);
    const next=current.parent_id;
    current=items.find(item=>item.id===next);
  }
  return path;
}

