export function nextOverlayLevel(base: number, visibleLevels: number[], retained?:number) {
  if(retained!==undefined&&Number.isFinite(retained))return Math.max(Number.isFinite(base)?base:0,retained);
  return Math.max(100, Number.isFinite(base) ? base : 0, ...visibleLevels.filter(Number.isFinite).map(level => level + 2));
}
/** React ancestry survives portals; DOM order does not describe nested overlays. */
export function orderOverlayEntries<T extends {root:object;parents:readonly object[];order:number}>(entries:T[]):T[]{
  const sorted=[...entries].sort((a,b)=>a.order-b.order);
  const byRoot=new Map(entries.map(entry=>[entry.root,entry]));
  const visited=new Set<T>(),result:T[]=[];
  function visit(entry:T){
    if(visited.has(entry))return;
    visited.add(entry);
    for(const parent of entry.parents){const ancestor=byRoot.get(parent);if(ancestor)visit(ancestor);}
    result.push(entry);
  }
  sorted.forEach(visit);
  return result;
}
