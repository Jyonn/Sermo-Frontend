import './ActivityRewardRail.css';

/** Compact reward overview; detailed catalogs stay in the campaign's child panel. */
export function ActivityRewardRail({label,items,onOpen}:{label:string;items:Array<{key:string;title:string;step:string;reached:boolean;image?:string}>;onOpen:()=>void}) {
  return <section className="activity-reward-rail" aria-label={label}>
    <header><strong>{label}</strong><button type="button" onClick={onOpen} aria-label={label}><span aria-hidden="true">↗</span></button></header>
    <div>{items.map(item=><button key={item.key} type="button" className={item.reached?'is-reached':''} onClick={onOpen}>
      <span className="activity-reward-rail-art">{item.image?<img src={item.image} alt=""/>:<span className="material-symbols-outlined" aria-hidden="true">{item.reached?'check':'redeem'}</span>}</span>
      <b>{item.step}</b><small>{item.title}</small>
    </button>)}</div>
  </section>;
}
