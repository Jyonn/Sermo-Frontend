import { useState } from "react";
import "../styles/mention-mobile-lab.css";

type Variant = "shelf" | "sheet" | "scene" | "rail";

const variants: Array<{ id: Variant; number: string; title: string; subtitle: string; strength: string }> = [
  { id: "shelf", number: "01", title: "贴近输入", subtitle: "候选紧贴输入框，仅占用键盘上方的安全高度", strength: "最少打断" },
  { id: "sheet", number: "02", title: "搜索抽屉", subtitle: "列表有独立标题与搜索区，键盘上方完整滚动", strength: "查找清晰" },
  { id: "scene", number: "03", title: "选人模式", subtitle: "暂时收起消息流，让成员列表获得完整空间", strength: "适合大群" },
  { id: "rail", number: "04", title: "快速点名", subtitle: "常用成员横向速选，需要时再展开全部", strength: "一步完成" },
];

const members = [
  { name: "Fly", role: "群主", color: "amber" },
  { name: "峡谷小蛋", role: "刚刚活跃", color: "blue" },
  { name: "福宝", role: "在线", color: "rose" },
  { name: "新少", role: "在线", color: "mint" },
  { name: "勇敢小美", role: "昨天活跃", color: "violet" },
  { name: "你的晚里有什么", role: "昨天活跃", color: "navy" },
  { name: "阿树", role: "3 天前活跃", color: "sage" },
];

function Avatar({ name, color }: { name: string; color: string }) {
  return <span className={`mention-lab-avatar is-${color}`}>{name.slice(0, 1)}</span>;
}

export default function MentionMobileLabPage() {
  const [variant, setVariant] = useState<Variant>("shelf");
  const [keyboard, setKeyboard] = useState(true);
  const [value, setValue] = useState("@");
  const [pickerOpen, setPickerOpen] = useState(true);
  const [expanded, setExpanded] = useState(false);
  const selectedVariant = variants.find((item) => item.id === variant)!;
  const query = value.match(/@([^@\s]*)$/)?.[1] ?? "";
  const candidates = members.filter((member) => member.name.toLowerCase().includes(query.toLowerCase()));
  const showPicker = pickerOpen && value.includes("@");

  const select = (name: string) => {
    setValue((current) => current.replace(/@[^@\s]*$/, `@${name} `));
    setPickerOpen(false);
    setExpanded(false);
  };

  const memberRow = (member: typeof members[number], compact = false) => (
    <button className={`mention-lab-member${compact ? " is-compact" : ""}`} key={member.name} onClick={() => select(member.name)} type="button">
      <Avatar name={member.name} color={member.color} />
      <span><strong>{member.name}</strong>{!compact ? <small>{member.role}</small> : null}</span>
      {!compact ? <span className="material-symbols-outlined">north_west</span> : null}
    </button>
  );

  const memberList = <div className="mention-lab-member-list">{candidates.length ? candidates.map((member) => memberRow(member)) : <p className="mention-lab-empty">没有找到这位成员</p>}</div>;

  return (
    <main className="mention-lab-page">
      <div className="mention-lab-intro">
        <div><span className="mention-lab-kicker">SERMO · INTERACTION STUDY / 04</span><h1>把 @，放在<br /><em>看得见的地方。</em></h1><p>手机键盘升起时，候选成员不该躲到屏幕之外。四种布局，共用同一段选择流程。</p></div>
        <div className="mention-lab-controls"><button aria-pressed={keyboard} onClick={() => setKeyboard((current) => !current)} type="button"><span className="material-symbols-outlined">keyboard</span>{keyboard ? "收起模拟键盘" : "展开模拟键盘"}</button><button onClick={() => { setValue("@"); setPickerOpen(true); setExpanded(false); }} type="button"><span className="material-symbols-outlined">restart_alt</span>重新输入 @</button></div>
      </div>
      <div className="mention-lab-layout">
        <nav className="mention-lab-tabs" aria-label="选择交互方案">{variants.map((item) => <button aria-current={variant === item.id ? "true" : undefined} className={variant === item.id ? "is-active" : ""} key={item.id} onClick={() => { setVariant(item.id); setValue("@"); setPickerOpen(true); setExpanded(false); }} type="button"><small>{item.number} / {item.strength}</small><strong>{item.title}</strong><span>{item.subtitle}</span></button>)}</nav>
        <div className="mention-lab-stage">
          <div className="mention-lab-frame">
            <div className={`mention-lab-phone variant-${variant}${keyboard ? " has-keyboard" : ""}`}>
              <header className="mention-lab-chat-head"><span className="material-symbols-outlined">arrow_back</span><span className="mention-lab-group-avatar">✦</span><span><strong>百星俱乐部 (7)</strong><small>7 人 · 一起聊天</small></span><span className="material-symbols-outlined">more_horiz</span></header>
              {variant === "scene" && showPicker ? (
                <div className="mention-lab-scene"><div className="mention-lab-scene-heading"><button onClick={() => setPickerOpen(false)} type="button"><span className="material-symbols-outlined">arrow_back</span></button><span><strong>选择要提及的人</strong><small>输入昵称可快速查找</small></span><span className="mention-lab-scene-count">{candidates.length} 位</span></div>{memberList}</div>
              ) : (
                <div className="mention-lab-messages"><time>今天 14:52</time><div className="mention-lab-message"><Avatar name="福宝" color="rose" /><span>今天大家都在吗？</span></div><div className="mention-lab-message is-self"><span>在，准备把新的照片发出来。</span></div><div className="mention-lab-message"><Avatar name="Fly" color="amber" /><span>记得叫上其他人一起看 👀</span></div></div>
              )}
              <div className="mention-lab-composer">
                {showPicker && variant === "shelf" ? <div className="mention-lab-shelf"><div className="mention-lab-picker-title"><span>提及群成员</span><small>{candidates.length} 位匹配</small></div>{memberList}</div> : null}
                {showPicker && variant === "sheet" ? <div className="mention-lab-sheet"><div className="mention-lab-grip" /><div className="mention-lab-picker-title"><span>提及群成员</span><small>轻点名字即可加入</small></div>{memberList}</div> : null}
                {showPicker && variant === "rail" ? <div className={`mention-lab-rail${expanded ? " is-expanded" : ""}`}><div className="mention-lab-rail-head"><span>快速 @</span><button onClick={() => setExpanded((current) => !current)} type="button">{expanded ? "收起" : "查看全部"}<span className="material-symbols-outlined">{expanded ? "expand_less" : "arrow_forward"}</span></button></div>{expanded ? memberList : <div className="mention-lab-rail-scroll">{candidates.map((member) => memberRow(member, true))}</div>}</div> : null}
                <div className="mention-lab-input-row"><input aria-label="聊天输入框" onChange={(event) => { setValue(event.target.value); setPickerOpen(event.target.value.includes("@")); }} onFocus={() => setKeyboard(true)} placeholder="说点什么，输入 @ 提及成员" value={value} /><button onClick={() => { setValue((current) => `${current}@`); setPickerOpen(true); }} title="提及成员" type="button">@</button></div><div className="mention-lab-tools"><span className="material-symbols-outlined">mic</span><span className="material-symbols-outlined">mood</span><span className="material-symbols-outlined">image</span><span className="material-symbols-outlined">description</span><span className="material-symbols-outlined">location_on</span></div>
              </div>
              {keyboard ? <div className="mention-lab-keyboard" aria-hidden="true"><div className="mention-lab-keyboard-row"><span>Q</span><span>W</span><span>E</span><span>R</span><span>T</span><span>Y</span><span>U</span><span>I</span><span>O</span><span>P</span></div><div className="mention-lab-keyboard-row"><span>A</span><span>S</span><span>D</span><span>F</span><span>G</span><span>H</span><span>J</span><span>K</span><span>L</span></div><div className="mention-lab-keyboard-row"><span>⇧</span><span>Z</span><span>X</span><span>C</span><span>V</span><span>B</span><span>N</span><span>M</span><span>⌫</span></div><div className="mention-lab-keyboard-row"><span>123</span><span className="is-space">空格</span><span>换行</span></div></div> : null}
              <div className="mention-lab-home-indicator"><i /></div>
            </div>
          </div>
          <aside className="mention-lab-annotation"><span>{selectedVariant.number} / INTERACTION</span><h2>{selectedVariant.title}</h2><p>{selectedVariant.subtitle}</p><div><strong>试一试</strong><span>切换键盘高度、输入昵称，或点选一位成员。选择后可重新输入 @ 再试。</span></div></aside>
        </div>
      </div>
    </main>
  );
}
