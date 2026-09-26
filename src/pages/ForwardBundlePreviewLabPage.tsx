import { useState } from "react";

type Variant = "seamless" | "viewport" | "ribbon" | "editorial";

const variants: Array<{ key: Variant; index: string; title: string; note: string }> = [
  { key: "seamless", index: "01", title: "原生缩放", note: "最贴近广场预览，仅保留聊天背景与轻量标题栏" },
  { key: "viewport", index: "02", title: "聊天视窗", note: "在消息宽度内增加清晰边界，强调内部可滚动" },
  { key: "ribbon", index: "03", title: "来源标签", note: "在预览上方标记原会话，再进入缩放消息流" },
  { key: "editorial", index: "04", title: "圆角画幅", note: "使用更柔和的预览轮廓，但仍遵守消息最大宽度" },
];

function Avatar({ name, tone }: { name: string; tone: "green" | "amber" | "blue" }) {
  return <span aria-label={name} className={`forward-lab-avatar tone-${tone}`}>{name.slice(0, 1)}</span>;
}

function Message({ author, children, self = false, tone = "green" }: {
  author: string;
  children: React.ReactNode;
  self?: boolean;
  tone?: "green" | "amber" | "blue";
}) {
  return (
    <article className={`forward-lab-message ${self ? "is-self" : ""}`}>
      {!self ? <Avatar name={author} tone={tone} /> : null}
      <div><small>{author}</small><p>{children}</p></div>
    </article>
  );
}

function NestedBundle() {
  return (
    <button className="forward-lab-nested" type="button">
      <span className="material-symbols-outlined">forum</span>
      <span><strong>合并聊天记录</strong><small>林夏：周六的照片我整理好啦</small></span>
      <span className="material-symbols-outlined">chevron_right</span>
    </button>
  );
}

function ChatPreview({ variant }: { variant: Variant }) {
  return (
    <section className={`forward-lab-preview variant-${variant}`}>
      <div className="forward-lab-preview-head">
        <span><i />聊天记录</span>
        <small>6 条消息</small>
      </div>
      <div className="forward-lab-scroll">
        <time>星期六 18:42</time>
        <Message author="林夏" tone="amber">海边的风比想象中舒服很多。</Message>
        <Message author="我" self>下次把大家都叫上吧</Message>
        <Message author="林夏" tone="amber"><span className="forward-lab-photo"><b>SUMMER</b><em>18:47</em></span></Message>
        <Message author="阿野" tone="blue">你们看这个，上一回的照片也在里面。</Message>
        <Message author="阿野" tone="blue"><NestedBundle /></Message>
        <Message author="我" self>好，今晚一起整理。</Message>
      </div>
      <button className="forward-lab-open" type="button"><span>进入完整预览</span><span className="material-symbols-outlined">arrow_forward</span></button>
    </section>
  );
}

function ForwardPreviewMessage({ variant }: { variant: Variant }) {
  return (
    <article className="forward-lab-forward-message">
      <Avatar name="林夏" tone="amber" />
      <div className="forward-lab-forward-content">
        <small>林夏</small>
        {variant === "ribbon" ? <div className="forward-lab-ribbon"><span>转发自</span><strong>周末出逃计划</strong></div> : null}
        <ChatPreview variant={variant} />
      </div>
    </article>
  );
}

function Conversation({ variant }: { variant: Variant }) {
  return (
    <div className="forward-lab-phone">
      <header><button type="button"><span className="material-symbols-outlined">arrow_back</span></button><span><strong>沿海公路</strong><small>4 人在线</small></span><button type="button"><span className="material-symbols-outlined">more_horiz</span></button></header>
      <main>
        <time>今天 20:16</time>
        <Message author="林夏" tone="amber">把那天的聊天记录发一下？</Message>
        <ForwardPreviewMessage variant={variant} />
        <Message author="我" self>收到了，我慢慢看。</Message>
      </main>
      <footer><span>说点什么…</span><span className="material-symbols-outlined">sentiment_satisfied</span><span className="material-symbols-outlined">add_circle</span></footer>
    </div>
  );
}

export default function ForwardBundlePreviewLabPage() {
  const [variant, setVariant] = useState<Variant>("seamless");
  const selected = variants.find((item) => item.key === variant)!;
  return (
    <main className="forward-lab-page">
      <style>{styles}</style>
      <header className="forward-lab-hero"><span>CHAT PREVIEW / MESSAGE STUDY</span><h1>它是一条消息，<br />内容是一段聊天。</h1><p>四版都保留发送方头像和普通消息宽度约束。浅绿色内容区使用聊天背景，内部头像、气泡与媒体像广场预览一样整体缩放。</p></header>
      <nav aria-label="设计版本" className="forward-lab-switcher">
        {variants.map((item) => <button className={item.key === variant ? "is-active" : ""} key={item.key} onClick={() => setVariant(item.key)} type="button"><i>{item.index}</i><span><strong>{item.title}</strong><small>{item.note}</small></span></button>)}
      </nav>
      <section className="forward-lab-stage">
        <aside><small>SELECTED DIRECTION</small><strong>{selected.title}</strong><p>{selected.note}</p><ul><li>保留此消息发送方头像</li><li>宽度不超过普通消息最大宽度</li><li>内部 Chat Preview 整体等比例缩放</li><li>超过最大高度后区域内滚动</li></ul></aside>
        <Conversation variant={variant} />
      </section>
    </main>
  );
}

const styles = `
.forward-lab-page{--ink:#102d26;--muted:#6f857e;--mint:#08b982;min-height:100dvh;padding:clamp(28px,5vw,72px);color:var(--ink);background:radial-gradient(circle at 78% 8%,rgba(80,209,160,.17),transparent 27%),linear-gradient(145deg,#f5f3eb,#edf6ef 62%,#e6f0e9);font-family:"Avenir Next","Noto Sans SC",sans-serif}.forward-lab-page button{font:inherit}.forward-lab-hero{max-width:1120px;margin:auto}.forward-lab-hero>span,.forward-lab-stage aside>small{color:#087e5c;font-size:11px;font-weight:800;letter-spacing:.2em}.forward-lab-hero h1{margin:14px 0 12px;font-family:"Songti SC","STSong",serif;font-size:clamp(42px,6vw,78px);font-weight:800;line-height:.98;letter-spacing:-.06em}.forward-lab-hero p{max-width:650px;margin:0;color:var(--muted);font-size:15px;line-height:1.75}.forward-lab-switcher{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:10px;max-width:1120px;margin:32px auto 22px}.forward-lab-switcher button{display:grid;grid-template-columns:32px 1fr;gap:10px;min-width:0;padding:15px;color:var(--muted);border:1px solid rgba(16,45,38,.12);border-radius:18px;background:rgba(250,251,246,.58);text-align:left;cursor:pointer}.forward-lab-switcher button.is-active{color:var(--ink);border-color:rgba(8,185,130,.55);background:#fbfcf7;box-shadow:0 15px 40px rgba(23,65,52,.1)}.forward-lab-switcher i{color:var(--mint);font-size:11px;font-style:normal;font-weight:800}.forward-lab-switcher span{display:grid;gap:4px;min-width:0}.forward-lab-switcher strong{font-size:14px}.forward-lab-switcher small{overflow:hidden;font-size:10px;text-overflow:ellipsis;white-space:nowrap}.forward-lab-stage{display:grid;grid-template-columns:260px minmax(320px,430px);justify-content:center;gap:clamp(28px,7vw,100px);max-width:1120px;margin:auto;padding:clamp(24px,5vw,56px);border:1px solid rgba(16,45,38,.11);border-radius:38px;background:rgba(250,251,246,.6)}.forward-lab-stage aside{align-self:start;padding-top:48px}.forward-lab-stage aside>strong{display:block;margin-top:12px;font:800 36px/1.1 "Songti SC",serif}.forward-lab-stage aside p{color:var(--muted);line-height:1.65}.forward-lab-stage ul{margin:28px 0 0;padding:18px 0 0;border-top:1px solid rgba(16,45,38,.12);list-style:none}.forward-lab-stage li{margin:10px 0;color:#526c64;font-size:12px}.forward-lab-stage li:before{content:"";display:inline-block;width:5px;height:5px;margin-right:9px;border-radius:50%;background:var(--mint);vertical-align:2px}.forward-lab-phone{height:min(760px,82dvh);min-height:650px;overflow:hidden;border:7px solid #18342c;border-radius:36px;background:#f8f7f1;box-shadow:0 30px 75px rgba(17,48,39,.2)}.forward-lab-phone>header{height:66px;display:grid;grid-template-columns:42px 1fr 42px;align-items:center;padding:0 10px;border-bottom:1px solid #dfe8e1;background:#fbfaf5}.forward-lab-phone>header button{display:grid;place-items:center;width:38px;height:38px;border:0;border-radius:13px;color:#355149;background:transparent}.forward-lab-phone>header>span{display:grid;text-align:center}.forward-lab-phone>header strong{font-size:15px}.forward-lab-phone>header small{color:#82948e;font-size:9px}.forward-lab-phone>main{height:calc(100% - 126px);padding:15px 12px;overflow-y:auto;background:linear-gradient(rgba(236,246,239,.9),rgba(236,246,239,.9)),radial-gradient(circle at 1px 1px,#b9d2c4 1px,transparent 1px);background-size:auto,18px 18px}.forward-lab-phone>main>time,.forward-lab-scroll>time{display:block;margin:2px auto 14px;color:#83968f;font-size:9px;text-align:center}.forward-lab-message{display:grid;grid-template-columns:32px minmax(0,1fr);align-items:start;gap:7px;margin:12px 0}.forward-lab-message.is-self{display:flex;justify-content:flex-end}.forward-lab-avatar{display:grid;place-items:center;width:30px;height:30px;border:2px solid rgba(255,255,255,.86);border-radius:10px;color:#fff;font-size:10px;font-weight:800;box-shadow:0 2px 8px rgba(18,56,44,.12)}.tone-green{background:#36a17c}.tone-amber{background:#cc8e48}.tone-blue{background:#587fa6}.forward-lab-message>div{display:grid;justify-items:start;min-width:0}.forward-lab-message.is-self>div{justify-items:end}.forward-lab-message small{margin-bottom:3px;color:#738a82;font-size:9px}.forward-lab-message p{max-width:245px;margin:0;padding:9px 11px;border-radius:5px 15px 15px;color:#17372d;background:#fff;font-size:12px;line-height:1.5;box-shadow:0 2px 7px rgba(26,70,56,.08)}.forward-lab-message.is-self p{border-radius:15px 5px 15px;background:#bdf0d7}.forward-lab-inline-context{margin:17px -12px}.forward-lab-preview{position:relative;overflow:hidden;background:linear-gradient(rgba(229,242,233,.94),rgba(229,242,233,.94)),radial-gradient(circle at 1px 1px,#a9c7b5 1px,transparent 1px);background-size:auto,17px 17px}.forward-lab-preview-head{height:38px;display:flex;align-items:center;justify-content:space-between;padding:0 13px;color:#527168;background:rgba(249,250,245,.86);font-size:10px}.forward-lab-preview-head span{display:flex;align-items:center;gap:7px;font-weight:800}.forward-lab-preview-head i{width:6px;height:6px;border-radius:50%;background:var(--mint)}.forward-lab-preview-head small{font-size:9px}.forward-lab-scroll{max-height:310px;padding:10px 13px;overflow-y:auto;overscroll-behavior:contain}.forward-lab-open{width:100%;height:39px;display:flex;align-items:center;justify-content:space-between;padding:0 14px;border:0;border-top:1px solid rgba(42,91,75,.1);color:#127958;background:rgba(249,250,245,.9);font-size:10px;font-weight:800;cursor:pointer}.forward-lab-open .material-symbols-outlined{font-size:16px}.forward-lab-nested{display:grid;grid-template-columns:24px 1fr 18px;align-items:center;gap:7px;width:205px;padding:9px;border:0;border-radius:10px;color:#27473d;background:#f2f4ef;text-align:left}.forward-lab-nested>.material-symbols-outlined{color:#36896c;font-size:18px}.forward-lab-nested span:nth-child(2){display:grid;min-width:0}.forward-lab-nested strong{font-size:10px}.forward-lab-nested small{overflow:hidden;margin:2px 0 0;color:#81918c;font-size:8px;text-overflow:ellipsis;white-space:nowrap}.forward-lab-photo{display:grid;align-content:end;width:160px;height:100px;padding:10px;border-radius:10px;color:#fff;background:linear-gradient(0deg,rgba(7,35,27,.68),transparent),linear-gradient(135deg,#6ba5a2,#dfae75 55%,#799187)}.forward-lab-photo b{font:800 17px/1 "Avenir Next",sans-serif;letter-spacing:.12em}.forward-lab-photo em{font-size:8px;font-style:normal}.forward-lab-phone>footer{height:60px;display:grid;grid-template-columns:1fr 30px 30px;align-items:center;gap:5px;padding:0 13px;color:#8b9a95;background:#fbfaf5}.forward-lab-phone>footer>span:first-child{padding:10px 13px;border-radius:15px;background:#f0f2ed;font-size:11px}.forward-lab-phone>footer .material-symbols-outlined{font-size:20px}.variant-seamless{border-block:1px solid rgba(36,91,73,.1)}.variant-seamless .forward-lab-preview-head{background:transparent}.variant-viewport{margin:0 10px;border:1px solid rgba(42,91,75,.16);border-radius:21px;box-shadow:0 14px 30px rgba(23,65,52,.1)}.variant-ribbon{border-block:1px solid rgba(36,91,73,.1)}.forward-lab-ribbon{display:flex;align-items:center;gap:6px;padding:0 13px 7px;color:#698078;font-size:9px}.forward-lab-ribbon span{padding:3px 6px;border-radius:8px;background:#dcebe2}.forward-lab-ribbon strong{font-size:9px}.variant-ribbon .forward-lab-preview-head{display:none}.variant-editorial{margin:0 8px;border-radius:28px}.variant-editorial .forward-lab-preview-head{height:45px;padding-inline:17px;background:linear-gradient(#f8faf5,rgba(248,250,245,.7))}.variant-editorial .forward-lab-scroll{padding-inline:18px}.variant-editorial .forward-lab-open{justify-content:center;gap:8px;background:linear-gradient(rgba(249,250,245,.82),#f9faf5)}
.forward-lab-forward-message{display:grid;grid-template-columns:32px minmax(0,1fr);align-items:start;gap:7px;margin:17px 0}.forward-lab-forward-content{width:min(86%,292px);min-width:0}.forward-lab-forward-content>small{display:block;margin:0 0 4px;color:#738a82;font-size:9px}.forward-lab-forward-content .forward-lab-scroll>.forward-lab-message,.forward-lab-forward-content .forward-lab-scroll>time{zoom:.76}.forward-lab-forward-content .forward-lab-scroll{max-height:250px}.forward-lab-forward-content .forward-lab-nested{width:190px}.forward-lab-forward-content .forward-lab-ribbon{padding:0 3px 6px}.forward-lab-forward-content .variant-viewport,.forward-lab-forward-content .variant-editorial{margin:0}.forward-lab-forward-content .variant-editorial{border-radius:20px}
@media(max-width:760px){.forward-lab-page{padding:22px 12px 40px}.forward-lab-hero{padding:0 8px}.forward-lab-hero h1{font-size:42px}.forward-lab-switcher{grid-template-columns:1fr 1fr}.forward-lab-switcher small{display:none}.forward-lab-stage{display:block;padding:14px;border-radius:28px}.forward-lab-stage aside{padding:12px 8px 22px}.forward-lab-stage aside>strong{font-size:28px}.forward-lab-stage aside ul{display:none}.forward-lab-phone{height:720px;max-height:78dvh;min-height:600px;margin:auto}}
`;
