import type { ResearchResource } from './research';

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

