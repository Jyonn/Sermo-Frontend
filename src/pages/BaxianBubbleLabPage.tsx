import { useState } from "react";

type Character = "lv" | "zhongli" | "he";
type Direction = "inset" | "corner" | "inline" | "watermark";

const characters: Array<{ key: Character; name: string; style: string }> = [
  { key: "lv", name: "吕洞宾", style: "baxian-lv" },
  { key: "zhongli", name: "钟离权", style: "baxian-zhongli" },
  { key: "he", name: "何仙姑", style: "baxian-he" },
];

const directions: Array<{ key: Direction; name: string; label: string; note: string; recommended?: boolean }> = [
  { key: "inset", name: "内嵌题签", label: "最稳妥", note: "印章落在阅读末端的内边距中；单行不抬高，多行不压字，合并气泡只在末条收束。", recommended: true },
  { key: "corner", name: "角落落款", label: "更含蓄", note: "印章贴住内容内角，像纸本落款。多行表现自然，短句会保留一小块呼吸空间。" },
  { key: "inline", name: "行尾签章", label: "更灵动", note: "印章跟随最后一个字自然换行，最像真实盖章；长短句节奏鲜明，但行高变化更明显。" },
  { key: "watermark", name: "暗纹水印", label: "更克制", note: "印章成为气泡内部的低对比暗纹，不额外占位，适合信息密度高的聊天场景。" },
];

function Seal({ character }: { character: Character }) {
  const asset = character === "lv" ? "lv-dongbin-blue-seal.png" : character === "he" ? "he-xiangu-pink-seal.png" : "zhongli-quan-red-seal.png";
  return <img alt="" aria-hidden="true" className="baxian-lab-seal" src={`/assets/baxian/${asset}`} />;
}

function Hero({ character }: { character: Character }) {
  const asset = character === "lv" ? "lv-dongbin" : character === "he" ? "he-xiangu" : "zhongli-quan";
  return <img alt="" aria-hidden="true" className="baxian-lab-hero-character" src={`/assets/baxian/${asset}-48-v4.webp`} />;
}

function Bubble({ character, direction, self, text, grouped }: { character: Character; direction: Direction; self?: boolean; text: string; grouped?: "start" | "middle" | "end" }) {
  return (
    <div className={`baxian-lab-row ${self ? "is-self" : "is-other"}`}>
      <div className={`baxian-lab-bubble direction-${direction} ${grouped ? `group-${grouped}` : "is-single"}`}>
        {grouped === "start" || !grouped ? <Hero character={character} /> : null}
        <span className="baxian-lab-copy">{text}</span>
        {grouped === "end" || !grouped ? <Seal character={character} /> : null}
      </div>
    </div>
  );
}

export default function BaxianBubbleLabPage() {
  const [direction, setDirection] = useState<Direction>("inset");
  const [character, setCharacter] = useState<Character>("lv");
  const current = directions.find((item) => item.key === direction) ?? directions[0];
  const currentCharacter = characters.find((item) => item.key === character) ?? characters[0];

  return (
    <main className={`baxian-lab-page theme-${currentCharacter.style}`}>
      <header className="baxian-lab-header">
        <div>
          <span>BAXIAN / BUBBLE STUDY</span>
          <h1>把印章收进气泡里</h1>
          <p>四套排版同时验证单行、多行、双方视角与连续消息；英雄动画只负责开场，印章负责收尾。</p>
        </div>
        <div className="baxian-lab-character-switcher" aria-label="切换角色">
          {characters.map((item) => <button className={character === item.key ? "is-active" : ""} key={item.key} onClick={() => setCharacter(item.key)} type="button">{item.name}</button>)}
        </div>
      </header>

      <nav className="baxian-lab-directions" aria-label="切换设计方案">
        {directions.map((item, index) => (
          <button className={direction === item.key ? "is-active" : ""} key={item.key} onClick={() => setDirection(item.key)} type="button">
            <span>{String(index + 1).padStart(2, "0")}</span><strong>{item.name}</strong><small>{item.label}</small>
          </button>
        ))}
      </nav>

      <section className="baxian-lab-stage">
        <header className="baxian-lab-stage-copy">
          <div><span>{String(directions.findIndex((item) => item.key === direction) + 1).padStart(2, "0")} / 04</span>{current.recommended ? <b>推荐</b> : null}</div>
          <h2>{current.name}</h2><p>{current.note}</p>
        </header>
        <div className="baxian-lab-phone">
          <div className="baxian-lab-chat-head"><span>八仙主题预览</span><small>{currentCharacter.name} · 双方视角</small></div>
          <div className="baxian-lab-chat-flow">
            <time>20:26</time>
            <Bubble character={character} direction={direction} text="今晚见。" />
            <Bubble character={character} direction={direction} self text="云开之后，从桥边一路走到灯影尽头。" />
            <div className="baxian-lab-group">
              <Bubble character={character} direction={direction} grouped="start" text="剑已收好。" />
              <Bubble character={character} direction={direction} grouped="middle" text="茶也温着。" />
              <Bubble character={character} direction={direction} grouped="end" text="等你来，再慢慢讲这一程。" />
            </div>
            <div className="baxian-lab-group is-self-group">
              <Bubble character={character} direction={direction} grouped="start" self text="好。" />
              <Bubble character={character} direction={direction} grouped="end" self text="不见不散。" />
            </div>
          </div>
        </div>
      </section>

      <section className="baxian-lab-rationale">
        <article><span>01</span><strong>单行</strong><p>印章不应把短句撑高，也不能与字面争抢视线。</p></article>
        <article><span>02</span><strong>多行</strong><p>固定在内容内侧，文字换行后仍保留稳定的阅读边界。</p></article>
        <article><span>03</span><strong>合并</strong><p>人物只在第一条登场，印章只在最后一条落款，形成完整叙事。</p></article>
      </section>
    </main>
  );
}
